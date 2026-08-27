// ═══════════════════════════════════════════════════════════════
// BotForge — Telegram Bot Engine v3 (Powered by Firebase & Gemini)
// Realtime Firestore sync, threaded chat, order extraction,
// human takeover, instant bot lifecycle management
// ═══════════════════════════════════════════════════════════════

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import { Bot, InputFile } from 'grammy';
import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildSystemPrompt } from './prompt-builder.js';
import {
  isTrackingIntent,
  extractTrackingCode,
  formatSingleOrderCard,
  formatMultipleOrdersList,
  formatNoOrdersFound,
  DELIVERY_STATUS_LABELS,
  PROVIDER_NAMES,
} from './tracking-helper.js';
import { encrypt, decrypt } from './encryption.js';
import { syncToGoogleSheets } from './sheetsSync.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function isSafePublicHttpUrl(urlStr) {
  try {
    const parsed = new URL(urlStr);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;
    const hostname = parsed.hostname.toLowerCase();
    // Block loopback, private RFC1918, link-local, and cloud metadata IPs
    if (
      hostname === 'localhost' ||
      hostname.endsWith('.localhost') ||
      hostname === '127.0.0.1' ||
      hostname === '::1' ||
      hostname.startsWith('10.') ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('169.254.') ||
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname)
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

function resolveInputMedia(mediaUrl) {
  try {
    if (typeof mediaUrl === 'string') {
      // Direct support for compressed base64 data URLs
      if (mediaUrl.startsWith('data:')) {
        const parts = mediaUrl.split(',');
        if (parts.length === 2) {
          const buffer = Buffer.from(parts[1], 'base64');
          return new InputFile(buffer, 'product.jpg');
        }
      }

      if (mediaUrl.startsWith('http://') || mediaUrl.startsWith('https://')) {
        const parsed = new URL(mediaUrl);
        const filename = path.basename(parsed.pathname);
        const localPath = path.resolve(__dirname, '../whatsapp-engine/uploads', filename);
        if (fs.existsSync(localPath)) {
          return new InputFile(localPath);
        }
        if (!isSafePublicHttpUrl(mediaUrl)) {
          console.warn('[Telegram Engine] ⚠️ Blocked unsafe media URL (SSRF defense):', mediaUrl);
          return null;
        }
        return new InputFile(new URL(mediaUrl));
      } else if (!mediaUrl.includes('://')) {
        const safeName = path.basename(mediaUrl);
        const localPath = path.resolve(__dirname, '../whatsapp-engine/uploads', safeName);
        if (fs.existsSync(localPath)) {
          return new InputFile(localPath);
        }
      }
    }
  } catch (e) {
    console.warn('[Telegram Engine] resolveInputMedia warning:', e.message);
  }
  return null;
}

const PORT = process.env.PORT || 3002;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const AI_TIMEOUT_MS = 9000;
const MAX_HISTORY_KEYS = 5000;

// ─── Firebase Initialization (Admin SDK — privileged server identity,
// bypasses security rules so the client-facing rules can stay locked) ──
const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_B64
  ? Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_B64, 'base64').toString('utf8')
  : null;

if (!admin.apps.length) {
  const credential = serviceAccountJson
    ? admin.credential.cert(JSON.parse(serviceAccountJson))
    : admin.credential.applicationDefault();
  admin.initializeApp({ credential });
}

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

// Active running bot instances: botId -> { bot, config }
const activeBots = new Map();

// Human takeover tracker: "botId_userId" -> true
const humanTakeoverMap = new Map();

// Conversation history buffer: "botId_userId" -> array of messages
const conversationHistory = new Map();
const MAX_HISTORY = 20;

// User avatar cache: userId -> avatarUrl (TTL: in-memory)
const telegramAvatarCache = new Map();

// ─── Firestore Helpers ────────────────────────────────────────

// ownerUserId is stamped on every document so the security rules can
// authorize owner access without a per-document get()
async function saveMessage(botId, ownerUserId, telegramUserId, userName, content, role, platform = 'telegram', userAvatar = null) {
  try {
    await db.collection('conversations').add({
      botId,
      platform,
      userId: ownerUserId || '',
      telegramUserId: String(telegramUserId),
      customerId: String(telegramUserId),
      userName: userName || 'زبون',
      userAvatar: userAvatar || null,
      content,
      role, // 'user' | 'bot' | 'owner'
      createdAt: new Date().toISOString(),
      timestamp: FieldValue.serverTimestamp(),
    });
  } catch (e) {
    console.error('[Engine] Save message error:', e.message);
  }
}

async function incrementMessageCount(botId) {
  try {
    await db.collection('bots').doc(botId).update({
      messagesCount: FieldValue.increment(1),
      lastActiveAt: new Date().toISOString(),
    });
  } catch (e) {
    console.error('[Engine] Increment count error:', e.message);
  }
}


const TRACKING_CHARS = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

function generateTrackingCode() {
  let code = 'DZ-';
  for (let i = 0; i < 6; i++) {
    const idx = Math.floor(Math.random() * TRACKING_CHARS.length);
    code += TRACKING_CHARS[idx];
  }
  return code;
}

// ─── Notifications (in-app bell) ────────────────────────────────
// Engines write via Admin SDK; the merchant's dashboard listens live.
async function createNotification({ userId, botId, type = 'system', title, body = '', meta = {} }) {
  try {
    if (!userId) return null;
    const ref = await db.collection('notifications').add({
      userId,
      botId: botId || '',
      type,
      title: String(title).slice(0, 140),
      body: String(body).slice(0, 300),
      ...meta,
      read: false,
      createdIso: new Date().toISOString(),
      createdAt: FieldValue.serverTimestamp(),
    });
    return ref.id;
  } catch (e) {
    console.error('[Engine] Create notification error:', e.message);
    return null;
  }
}

// Resolves owner userId if missing
async function resolveOwnerUserId(botId, provided) {
  if (provided) return provided;
  if (!botId) return '';
  try {
    const snap = await db.collection('bots').doc(botId).get();
    return snap.exists ? (snap.data().userId || '') : '';
  } catch {
    return '';
  }
}

async function saveOrderToFirestore(orderData, orderMergeMode = 'merge') {
  try {
    const userId = await resolveOwnerUserId(orderData.botId, orderData.ownerUserId);
    const now = new Date().toISOString();

    // Check if merge mode is active and customer has a pending order
    if (orderMergeMode !== 'separate' && (orderData.customerId || orderData.phone)) {
      try {
        const snap = await db.collection('orders')
          .where('botId', '==', orderData.botId)
          .where('deliveryStatus', '==', 'pending')
          .limit(10)
          .get();

        const matchedDoc = snap.docs.find(d => {
          const data = d.data();
          const matchCustomer = orderData.customerId && String(data.customerId) === String(orderData.customerId);
          const matchPhone = orderData.phone && data.phone && String(data.phone).replace(/\D/g, '') === String(orderData.phone).replace(/\D/g, '');
          return matchCustomer || matchPhone;
        });

        if (matchedDoc) {
          const existing = matchedDoc.data();
          const finalName = orderData.customerName || existing.customerName || 'زبون';
          const finalPhone = orderData.phone || existing.phone || '';
          const finalAddress = orderData.address || existing.address || '';

          await matchedDoc.ref.update({
            product: orderData.product,
            price: orderData.price,
            customerName: finalName,
            phone: finalPhone,
            address: finalAddress,
            notes: orderData.notes || existing.notes || '-',
            updatedAt: now,
            lastModified: FieldValue.serverTimestamp(),
            statusHistory: FieldValue.arrayUnion({
              orderStatus: 'confirmed',
              deliveryStatus: 'pending',
              timestamp: now,
              note: 'تم تحديث ودمج الطلبية بنجاح',
            })
          });

          console.log(`[Engine] Telegram Order merged/updated: ${finalName} | Code: ${existing.trackingCode} | Products: ${orderData.product}`);
          return { id: matchedDoc.id, trackingCode: existing.trackingCode, isUpdate: true, customerName: finalName, phone: finalPhone, address: finalAddress };
        }
      } catch (mergeErr) {
        console.warn('[Engine] Merge check notice:', mergeErr.message);
      }
    }

    const trackingCode = orderData.trackingCode || generateTrackingCode();
    const initialHistory = [{
      orderStatus: 'confirmed',
      deliveryStatus: 'pending',
      timestamp: now,
      note: 'تم تسجيل وتأكيد الطلبية بنجاح',
    }];

    const docRef = await db.collection('orders').add({
      ...orderData,
      trackingCode,
      userId: userId || '',
      orderStatus: orderData.orderStatus || 'confirmed',
      deliveryStatus: orderData.deliveryStatus || 'pending',
      status: 'new', // backward compatibility
      statusHistory: initialHistory,
      deliveryProvider: orderData.deliveryProvider || 'manual',
      deliveryTrackingNumber: orderData.deliveryTrackingNumber || '',
      processedEvents: [],
      createdAt: now,
      timestamp: FieldValue.serverTimestamp(),
    });

    console.log(`[Engine] Order saved in Firestore: ${orderData.customerName} | Code: ${trackingCode} | Product: ${orderData.product}`);
    return { id: docRef.id, trackingCode, isUpdate: false };
  } catch (e) {
    console.error('[Engine] Save order error:', e.message);
    return null;
  }
}

async function saveLeadToFirestore(leadData) {
  try {
    const userId = await resolveOwnerUserId(leadData.botId, leadData.ownerUserId);
    const now = new Date().toISOString();
    const docRef = await db.collection('leads').add({
      botId: leadData.botId,
      userId: userId || '',
      platform: leadData.platform || 'telegram',
      customerId: String(leadData.customerId || ''),
      customerName: leadData.customerName || leadData.name || 'عميل محتمل',
      phone: leadData.phone || '',
      company: leadData.company || '',
      service: leadData.service || '',
      budget: leadData.budget || '',
      leadStatus: leadData.leadStatus || 'warm',
      status: leadData.status || 'new',
      notes: leadData.notes || '',
      createdAt: now,
      timestamp: FieldValue.serverTimestamp(),
    });

    console.log(`[Engine] Lead saved in Firestore: ${leadData.customerName || leadData.name} | Service: ${leadData.service}`);
    return { id: docRef.id, ...leadData };
  } catch (e) {
    console.error('[Engine] Save lead error:', e.message);
    return null;
  }
}

// Zero-IDOR Scoped Tracking Lookup
async function findOrdersForTracking(botId, customerId, specificCode = null) {
  try {
    if (specificCode) {
      const cleanCode = specificCode.trim().toUpperCase().replace('#', '');
      const snap = await db.collection('orders')
        .where('botId', '==', botId)
        .where('trackingCode', '==', cleanCode)
        .limit(1)
        .get();

      if (!snap.empty) {
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
      }
    }

    if (customerId) {
      const snap = await db.collection('orders')
        .where('botId', '==', botId)
        .where('customerId', '==', String(customerId))
        .get();

      if (!snap.empty) {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        return list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')).slice(0, 5);
      }
    }

    return [];
  } catch (e) {
    console.error('[Engine] Find orders error:', e.message);
    return [];
  }
}

// Idempotent Delivery Status Update with IDOR Protection (F02)
async function updateOrderDeliveryStatus(orderId, newDeliveryStatus, providerInfo = {}, eventId = null, expectedBotId = null, expectedUserId = null) {
  if (!orderId) return { success: false, reason: 'Missing orderId' };
  try {
    const orderRef = db.collection('orders').doc(orderId);
    const snap = await orderRef.get();
    if (!snap.exists) return { success: false, reason: 'Order not found' };

    const data = snap.data();

    // Security Check: Enforce tenant ownership (F02 IDOR Defense)
    if (expectedBotId && data.botId && data.botId !== expectedBotId) {
      return { success: false, reason: 'غير مصرح: الطلبية لا تنتمي لهذا المتجر' };
    }
    const orderOwner = data.ownerUserId || data.userId;
    if (expectedUserId && orderOwner && orderOwner !== expectedUserId) {
      return { success: false, reason: 'غير مصرح: الطلبية لا تخص هذا المستخدم' };
    }

    const processedEvents = Array.isArray(data.processedEvents) ? data.processedEvents : [];

    if (eventId && processedEvents.includes(eventId)) {
      return { success: true, alreadyProcessed: true, order: { id: snap.id, ...data } };
    }

    const now = new Date().toISOString();
    const historyEntry = {
      orderStatus: data.orderStatus || 'confirmed',
      deliveryStatus: newDeliveryStatus,
      timestamp: now,
      provider: providerInfo.provider || data.deliveryProvider || 'manual',
      trackingNumber: providerInfo.trackingNumber || data.deliveryTrackingNumber || '',
      note: providerInfo.note || `تم تحديث حالة الشحن إلى: ${newDeliveryStatus}`,
    };

    const updatePayload = {
      deliveryStatus: newDeliveryStatus,
      statusHistory: FieldValue.arrayUnion(historyEntry),
      updatedAt: now,
    };

    if (providerInfo.provider) updatePayload.deliveryProvider = providerInfo.provider;
    if (providerInfo.trackingNumber) updatePayload.deliveryTrackingNumber = providerInfo.trackingNumber;
    if (eventId) updatePayload.processedEvents = FieldValue.arrayUnion(eventId);

    await orderRef.update(updatePayload);
    return { success: true, order: { id: snap.id, ...data, ...updatePayload } };
  } catch (e) {
    console.error(`[Engine] Update delivery status error for order ${orderId}:`, e.message);
    return { success: false, reason: e.message };
  }
}

// ─── Robust JSON Parser (handles markdown codeblocks, whitespace, trailing commas) ───
function parseRobustJson(raw) {
  if (!raw || typeof raw !== 'string') return null;
  let text = raw.trim();
  try { return JSON.parse(text); } catch {}
  text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  try { return JSON.parse(text); } catch {}
  const firstOpen = text.indexOf('{');
  const lastClose = text.lastIndexOf('}');
  if (firstOpen !== -1 && lastClose > firstOpen) {
    const candidate = text.substring(firstOpen, lastClose + 1);
    try { return JSON.parse(candidate); } catch {}
    try {
      const cleanTrailing = candidate.replace(/,\s*([}\]])/g, '$1');
      return JSON.parse(cleanTrailing);
    } catch {}
  }
  return null;
}

// ─── Smart Order & Lead Extraction ───────────────────────────
const ORDER_TAG = '[ORDER_CONFIRMED]';
const LEAD_TAG = '[LEAD_QUALIFIED]';

function extractAndSaveOrder(botId, ownerUserId, customerId, customerName, rawReply, platform = 'telegram', catalogProducts = [], config = null) {
  const tagIndex = rawReply.indexOf(ORDER_TAG);
  if (tagIndex === -1) return { reply: rawReply, orderFound: false };

  const jsonStart = tagIndex + ORDER_TAG.length;
  const jsonStr = rawReply.slice(jsonStart).trim();
  const cleanReply = rawReply.slice(0, tagIndex).trim();

  try {
    const orderData = parseRobustJson(jsonStr);
    if (!orderData) {
      console.warn('[Engine] Order tag found but JSON parse returned null:', jsonStr.slice(0, 100));
      return { reply: cleanReply, orderFound: false };
    }
    const str = v => (typeof v === 'string' ? v.trim().slice(0, 300) : '');
    const phone = str(orderData?.phone);
    const product = str(orderData?.product);

    let validatedPrice = str(orderData?.price);
    if (Array.isArray(catalogProducts) && catalogProducts.length > 0 && product) {
      const matchedProd = catalogProducts.find(p => p && (
        (p.name && p.name.toLowerCase().includes(product.toLowerCase())) ||
        (product && product.toLowerCase().includes(p.name?.toLowerCase()))
      ));
      if (matchedProd && matchedProd.price) {
        validatedPrice = String(matchedProd.price);
      }
    }

    const customerNameFromOrder = str(orderData?.name);
    const finalCustomerName = customerNameFromOrder || customerName || 'زبون';

    if (product || phone) {
      saveOrderToFirestore({
        botId,
        ownerUserId,
        platform,
        customerId: String(customerId),
        customerName: finalCustomerName,
        phone,
        address: str(orderData?.address),
        product,
        price: validatedPrice,
        notes: str(orderData?.notes),
        orderSummary: cleanReply.slice(-500),
      }, config?.orderMergeMode || 'merge').then((saved) => {
        if (!saved) return;

        // Sync to Google Sheets
        if (config) {
          syncToGoogleSheets(config, {
            event: 'new_order',
            isUpdate: !!saved.isUpdate,
            orderId: saved.id,
            trackingCode: saved.trackingCode,
            customerName: saved.customerName || finalCustomerName,
            phone: saved.phone || phone,
            address: saved.address || str(orderData?.address),
            product,
            price: validatedPrice,
            notes: orderData?.notes || (saved.isUpdate ? 'تعديل/إضافة للطلبية' : '-'),
            orderSummary: '-',
            platform,
            createdAt: new Date().toISOString(),
          }).catch(() => {});
        }

        if (!config || config.notificationsEnabled === false) return;
        createNotification({
          userId: ownerUserId,
          botId,
          type: 'order',
          title: saved.isUpdate ? `تعديل طلبية #${saved.trackingCode}` : `طلبية جديدة #${saved.trackingCode}`,
          body: `${saved.customerName || finalCustomerName} — ${product || 'منتج'}${validatedPrice ? ` — ${validatedPrice} دج` : ''}`,
          meta: { orderId: saved.id, trackingCode: saved.trackingCode },
        }).catch(() => {});
      }).catch(() => {});
      return { reply: cleanReply, orderFound: true };
    }
    return { reply: cleanReply, orderFound: false };
  } catch (e) {
    console.error('[Engine] Order JSON parse error:', e.message);
    return { reply: cleanReply, orderFound: false };
  }
}

function extractAndSaveLead(botId, ownerUserId, customerId, customerName, rawReply, platform = 'telegram', config = null) {
  const tagIndex = rawReply.indexOf(LEAD_TAG);
  if (tagIndex === -1) return { reply: rawReply, leadFound: false };

  const jsonStart = tagIndex + LEAD_TAG.length;
  const jsonStr = rawReply.slice(jsonStart).trim();
  const cleanReply = rawReply.slice(0, tagIndex).trim();

  try {
    const leadData = parseRobustJson(jsonStr);
    const str = v => (typeof v === 'string' ? v.trim().slice(0, 300) : '');
    const lead = {
      name: str(leadData?.name) || customerName,
      phone: str(leadData?.phone),
      company: str(leadData?.company),
      service: str(leadData?.service),
      budget: str(leadData?.budget),
      leadStatus: ['hot', 'warm', 'cold'].includes(leadData?.leadStatus) ? leadData.leadStatus : 'hot',
      notes: str(leadData?.notes) || cleanReply.slice(-300),
    };

    if (lead.name || lead.phone || lead.service) {
      saveLeadToFirestore({
        botId,
        ownerUserId,
        platform,
        customerId: String(customerId),
        customerName: lead.name,
        phone: lead.phone,
        company: lead.company,
        service: lead.service,
        budget: lead.budget,
        leadStatus: lead.leadStatus,
        notes: lead.notes,
      }).then((savedLead) => {
        if (!savedLead) return;

        // Sync Lead to Google Sheets
        if (config) {
          syncToGoogleSheets(config, {
            event: 'new_lead',
            leadId: savedLead.id,
            customerName: lead.name,
            phone: lead.phone,
            company: lead.company,
            service: lead.service,
            budget: lead.budget,
            leadStatus: lead.leadStatus,
            notes: lead.notes,
            platform,
            createdAt: new Date().toISOString(),
          }).catch(() => {});
        }

        if (!config || config.notificationsEnabled === false) return;
        createNotification({
          userId: ownerUserId,
          botId,
          type: 'lead',
          title: `عميل محتمل جديد (${lead.leadStatus === 'hot' ? 'هام ومستعجل' : 'مهتم'})`,
          body: `${lead.name} — ${lead.service || 'استفسار مخصص'}${lead.phone ? ` (${lead.phone})` : ''}`,
          meta: { leadId: savedLead.id },
        }).catch(() => {});
      }).catch(() => {});
      return { reply: cleanReply, leadFound: true };
    }
    return { reply: cleanReply, leadFound: false };
  } catch (e) {
    console.error('[Engine] Lead JSON parse error:', e.message);
    return { reply: cleanReply, leadFound: false };
  }
}

// ─── Google Gemini AI ─────────────────────────────────────────

async function callGemini(apiKey, model, messages, audioData = null) {
  const modelsToTry = [
    model || 'gemini-3.7-flash-lite',
    'gemini-3.5-flash-lite',
    'gemini-2.5-flash-lite',
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-2.0-flash-lite',
    'gemini-1.5-flash',
  ];

  const systemInstruction = messages.find(m => m.role === 'system')?.content || '';
  const nonSystemMessages = messages.filter(m => m.role !== 'system');

  const contents = nonSystemMessages.map((m, idx) => {
    const isAssistant = m.role === 'assistant';
    const isLatestUserTurn = !isAssistant && idx === nonSystemMessages.length - 1;

    if (isLatestUserTurn && audioData && audioData.data) {
      const cleanMimeType = (audioData.mimeType || 'audio/ogg').split(';')[0].trim();
      const parts = [
        {
          inlineData: {
            mimeType: cleanMimeType,
            data: audioData.data,
          },
        },
        {
          text: m.content && m.content !== '[رسالة صوتية]'
            ? `الزبون أرسل تسجيلاً صوتياً ومرفق معه النص: "${m.content}". استمع للتسجيل الصوتي وافهم لهجته بدقة أياً كانت (دارجة جزائرية، مغاربية، عربية، فرنسية، إنجليزية أو أي لغة/لهجة)، وأجب عن طلبه وفقاً لقواعد النشاط والكتالوج.`
            : 'الزبون أرسل تسجيلاً صوتياً أعلاه. استمع له بعناية فائقة: افهم لهجته بدقة أياً كانت (دارجة جزائرية بجميع تنوعاتها، مغاربية، عربية، فرنسية، إنجليزية أو أي لهجة)، واستخرج طلبه أو سؤاله وأجب عنه بدقة ولباقة واحترافية وفقاً لتعليمات النشاط والكتالوج.',
        },
      ];
      return { role: 'user', parts };
    }

    return {
      role: isAssistant ? 'model' : 'user',
      parts: [{ text: m.content || '' }],
    };
  });

  const isBearer = apiKey && (apiKey.startsWith('AQ') || apiKey.startsWith('ya29') || apiKey.length > 80);
  const urlBase = 'https://generativelanguage.googleapis.com/v1beta/models';

  let lastError = null;
  for (const geminiModel of modelsToTry) {
    try {
      const url = `${urlBase}/${geminiModel}:generateContent`;

      const headers = { 'Content-Type': 'application/json' };
      if (isBearer) {
        headers['Authorization'] = `Bearer ${apiKey}`;
      } else {
        headers['x-goog-api-key'] = apiKey;
      }

      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined,
          contents,
          generationConfig: { maxOutputTokens: 800, temperature: 0.7 },
        }),
        signal: AbortSignal.timeout(AI_TIMEOUT_MS),
      });

      if (res.ok) {
        const data = await res.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) return text;
        lastError = new Error(`Gemini ${geminiModel}: empty response`);
      } else {
        const err = await res.text();
        lastError = new Error(`Gemini ${geminiModel} ${res.status}: ${err}`);
        // 404 = this model doesn't exist → the next fallback may work.
        // 400/401/403 = bad request or credentials → every model will
        // fail the same way; retrying only multiplies the latency.
        if (res.status === 400 || res.status === 401 || res.status === 403) break;
      }
    } catch (e) {
      lastError = e;
    }
  }

  if (lastError) throw lastError;
  return null;
}

async function askAI(config, userId, userMessage, audioData = null) {
  const historyKey = `${config.id}_${userId}`;
  if (!conversationHistory.has(historyKey)) {
    // Bound the number of tracked chats so memory stays flat
    if (conversationHistory.size >= MAX_HISTORY_KEYS) {
      const oldestKey = conversationHistory.keys().next().value;
      conversationHistory.delete(oldestKey);
    }
    conversationHistory.set(historyKey, []);
  }
  const history = conversationHistory.get(historyKey);
  const effectiveMessage = userMessage || (audioData ? '[رسالة صوتية]' : '');
  if (effectiveMessage) {
    history.push({ role: 'user', content: effectiveMessage });
  }
  if (history.length > MAX_HISTORY) {
    history.splice(0, history.length - MAX_HISTORY);
  }

  const systemPrompt = buildSystemPrompt(config);
  const messages = [{ role: 'system', content: systemPrompt }, ...history];
  const model = config.aiModel || 'gemini-3.5-flash-lite';
  const apiKey = config.customApiKey || config.geminiApiKey || config.apiKey || GEMINI_API_KEY;

  let reply;
  try {
    reply = await callGemini(apiKey, model, messages, audioData);
  } catch (err) {
    // The attempt failed: drop the user message so a retry doesn't carry a phantom turn
    if (effectiveMessage) {
      history.pop();
    }
    throw err;
  }
  if (!reply) reply = 'عذراً، لم أتمكن من الرد. يرجى المحاولة مرة أخرى.';
  history.push({ role: 'assistant', content: reply });
  return reply;
}

// ─── Zero-Trust Product Media Resolution (ID-Based) ───────────
const SHOW_PRODUCT_TAG = '[SHOW_PRODUCT:';
const SHOW_GALLERY_TAG = '[SHOW_PRODUCT_GALLERY:';

function extractProductMedia(rawReply, productsList = []) {
  let cleanReply = rawReply || '';
  let singleProductId = null;
  let galleryProductId = null;

  // 1. Check for [SHOW_PRODUCT_GALLERY: xyz] (supports newlines and spaces)
  const galleryMatch = cleanReply.match(/\[(?:SHOW_PRODUCT_GALLERY|GALLERY)\s*:\s*([^\]]+)\]/i);
  if (galleryMatch) {
    galleryProductId = galleryMatch[1].replace(/\s+/g, '').trim();
    cleanReply = cleanReply.replace(galleryMatch[0], '');
  }

  // 2. Check for [SHOW_PRODUCT: xyz] or [PRODUCT: xyz]
  const singleMatch = cleanReply.match(/\[(?:SHOW_PRODUCT|PRODUCT)\s*:\s*([^\]]+)\]/i);
  if (singleMatch) {
    singleProductId = singleMatch[1].replace(/\s+/g, '').trim();
    cleanReply = cleanReply.replace(singleMatch[0], '');
  }

  // 3. Fallback: Check for direct [prod_xxx] tags
  const directMatch = cleanReply.match(/\[(prod_[a-zA-Z0-9_\-\s]+)\]/i);
  if (directMatch) {
    singleProductId = directMatch[1].replace(/\s+/g, '').trim();
    cleanReply = cleanReply.replace(directMatch[0], '');
  }

  // Clean any remaining bracket tags
  cleanReply = cleanReply
    .replace(/\[(?:SHOW_PRODUCT|SHOW_PRODUCT_GALLERY|PRODUCT|prod)[^\]]*\]/gis, '')
    .trim();

  let mediaToSend = [];
  const targetId = galleryProductId || singleProductId;

  if (targetId && Array.isArray(productsList)) {
    const product = productsList.find(p => p && (
      String(p.id).trim() === targetId ||
      String(p.id).trim() === `prod_${targetId}` ||
      targetId.includes(String(p.id)) ||
      String(p.id).includes(targetId)
    ));

    if (product) {
      if (galleryProductId) {
        const allImages = [];
        if (product.primaryImage) allImages.push(product.primaryImage);
        if (Array.isArray(product.secondaryImages)) {
          allImages.push(...product.secondaryImages.filter(Boolean));
        } else if (Array.isArray(product.images)) {
          allImages.push(...product.images.filter(Boolean));
        }
        mediaToSend = allImages.slice(0, 5);
      } else {
        const mainImg = product.primaryImage || (Array.isArray(product.images) ? product.images[0] : null);
        if (mainImg) mediaToSend = [mainImg];
      }
    }
  }

  return { cleanReply, mediaToSend };
}


async function startBot(config) {
  if (activeBots.has(config.id)) return;
  if (!config.telegramToken || config.platform !== 'telegram') return;

  try {
    console.log(`[Engine] Initializing Telegram bot "${config.botName}" (${config.id})...`);
    const bot = new Bot(config.telegramToken.trim());
    // Register in activeBots immediately to prevent concurrent duplicate instances
    activeBots.set(config.id, { bot, config });

    bot.command('start', async (ctx) => {
      const greeting = config.responseStyle === 'formal'
        ? `مرحباً بك. أنا ${config.botName}، مساعدك الآلي من ${config.businessName}. كيف يمكنني مساعدتك اليوم؟`
        : `أهلاً وسهلاً بك. أنا ${config.botName} من ${config.businessName}. كيف يمكنني مساعدتك اليوم؟`;
      await ctx.reply(greeting);
    });

    bot.on(['message:text', 'message:voice', 'message:audio'], async (ctx) => {
      const isVoice = !!(ctx.message.voice || ctx.message.audio);
      const userMessage = (ctx.message.text || ctx.message.caption || '').trim();
      const userId = ctx.from.id;
      const userName = ctx.from.first_name || ctx.from.username || 'زبون تيليغرام';
      const takeoverKey = `${config.id}_${userId}`;

      // Skip empty non-audio messages
      if (!userMessage && !isVoice) {
        return;
      }

      // Download audio data in-memory without saving to disk
      let audioData = null;
      if (isVoice) {
        try {
          const voiceObj = ctx.message.voice || ctx.message.audio;
          const fileId = voiceObj.file_id;
          const mimeType = ctx.message.voice ? (voiceObj.mime_type || 'audio/ogg') : (voiceObj.mime_type || 'audio/mp3');
          const fileInfo = await ctx.api.getFile(fileId);
          if (fileInfo && fileInfo.file_path) {
            const fileUrl = `https://api.telegram.org/file/bot${config.telegramToken.trim()}/${fileInfo.file_path}`;
            const audioRes = await fetch(fileUrl, { signal: AbortSignal.timeout(10000) });
            if (audioRes.ok) {
              const arrayBuf = await audioRes.arrayBuffer();
              audioData = {
                data: Buffer.from(arrayBuf).toString('base64'),
                mimeType: mimeType.split(';')[0] || 'audio/ogg',
              };
            }
          }
        } catch (audioErr) {
          console.warn('[Telegram Engine] Audio download failed:', audioErr.message);
        }
      }

      // Fetch user profile photo (cached in memory)
      let userAvatar = telegramAvatarCache.get(userId);
      if (userAvatar === undefined) {
        try {
          const photos = await ctx.api.getUserProfilePhotos(userId, { limit: 1 }).catch(() => null);
          if (photos && photos.total_count > 0 && photos.photos[0] && photos.photos[0].length > 0) {
            const photo = photos.photos[0][0];
            const fileInfo = await ctx.api.getFile(photo.file_id).catch(() => null);
            if (fileInfo && fileInfo.file_path) {
              userAvatar = `https://api.telegram.org/file/bot${config.telegramToken.trim()}/${fileInfo.file_path}`;
            }
          }
          telegramAvatarCache.set(userId, userAvatar || null);
        } catch {
          telegramAvatarCache.set(userId, null);
        }
      }

      const displayMessage = userMessage || (isVoice ? '[رسالة صوتية]' : '');

      // Save user message immediately
      saveMessage(config.id, config.userId, userId, userName, displayMessage, 'user', 'telegram', userAvatar);

      // Check human takeover
      if (humanTakeoverMap.get(takeoverKey)) {
        console.log(`[Engine] Human takeover active for user ${userId} in bot ${config.botName}`);
        return;
      }

      // If audio download failed completely and no text exists
      if (isVoice && !userMessage && !audioData) {
        await ctx.reply('عذراً، لم أتمكن من تشغيل التسجيل الصوتي. هل يمكنك كتابة استفسارك أو إعادة إرساله؟ 🙏');
        return;
      }

      // Retrieve latest live config from activeBots
      const liveEntry = activeBots.get(config.id);
      const currentConfig = (liveEntry && liveEntry.config) ? liveEntry.config : config;

      // ─── Fast-Path Tracking Engine (0 LLM Calls) ────────────────
      const trackingEnabled = currentConfig.features
        ? currentConfig.features.orderTracking !== false && currentConfig.features.orders !== false
        : (currentConfig.orderTrackingEnabled !== false);

      if (trackingEnabled && userMessage && isTrackingIntent(userMessage)) {
        const explicitCode = extractTrackingCode(userMessage);
        const orders = await findOrdersForTracking(currentConfig.id, userId, explicitCode);
        let trackingReply = '';

        if (orders.length === 1) {
          trackingReply = formatSingleOrderCard(orders[0]);
        } else if (orders.length > 1) {
          trackingReply = formatMultipleOrdersList(orders);
        } else {
          trackingReply = formatNoOrdersFound(explicitCode);
        }

        await ctx.reply(trackingReply, { parse_mode: 'Markdown' }).catch(() => ctx.reply(trackingReply));
        saveMessage(currentConfig.id, currentConfig.userId, userId, userName, trackingReply, 'bot');
        incrementMessageCount(currentConfig.id);
        console.log(`[Telegram Engine] ⚡ Fast-Path Tracking Reply sent to ${userName} (${userId}) — 0 LLM calls`);
        return;
      }

      try {
        await ctx.replyWithChatAction('typing');

        const aiConfig = {
          ...currentConfig,
          autoOrdersEnabled: currentConfig.autoOrdersTelegram !== false && (currentConfig.features ? currentConfig.features.orders !== false : true),
        };

        const rawReply = await askAI(aiConfig, userId, userMessage, audioData);
        const { reply: replyWithoutOrder, orderFound } = extractAndSaveOrder(
          currentConfig.id,
          currentConfig.userId,
          userId,
          userName,
          rawReply,
          'telegram',
          currentConfig.products,
          currentConfig
        );
        const { reply: replyWithoutTags, leadFound } = extractAndSaveLead(
          currentConfig.id,
          currentConfig.userId,
          userId,
          userName,
          replyWithoutOrder,
          'telegram',
          currentConfig
        );
        const { cleanReply: finalReplyText, mediaToSend } = extractProductMedia(replyWithoutTags, currentConfig.products);
        const reply = finalReplyText || replyWithoutTags;


        if (mediaToSend.length > 1) {
          // Send Telegram Media Group (Album) via direct InputFile upload
          const mediaGroup = mediaToSend.map((url, idx) => ({
            type: 'photo',
            media: resolveInputMedia(url),
            caption: idx === 0 ? reply : undefined,
            parse_mode: idx === 0 ? 'Markdown' : undefined,
          }));
          await ctx.replyWithMediaGroup(mediaGroup).catch(async (err) => {
            console.warn('[Telegram Engine] replyWithMediaGroup failed, fallback to single photo:', err.message);
            await ctx.replyWithPhoto(resolveInputMedia(mediaToSend[0]), { caption: reply, parse_mode: 'Markdown' }).catch(async (err2) => {
              console.warn('[Telegram Engine] replyWithPhoto fallback failed:', err2.message);
              await ctx.reply(reply, { parse_mode: 'Markdown' }).catch(() => ctx.reply(reply));
            });
          });
        } else if (mediaToSend.length === 1) {
          // Send Single Photo with Caption via direct InputFile upload
          await ctx.replyWithPhoto(resolveInputMedia(mediaToSend[0]), { caption: reply, parse_mode: 'Markdown' }).catch(async (err) => {
            console.warn('[Telegram Engine] replyWithPhoto failed:', err.message);
            await ctx.reply(reply, { parse_mode: 'Markdown' }).catch(() => ctx.reply(reply));
          });
        } else {
          // Standard Text Reply
          await ctx.reply(reply, { parse_mode: 'Markdown' }).catch(async () => {
            await ctx.reply(reply);
          });
        }


        // Save bot reply
        saveMessage(config.id, config.userId, userId, userName, reply, 'bot');
        incrementMessageCount(config.id);


      } catch (err) {
        console.error(`[Engine] Bot "${config.botName}" error:`, err.message);
        await ctx.reply('عذراً، حدث خطأ أثناء المعالجة. يرجى المحاولة مرة أخرى.');
      }
    });

    bot.catch((err) => {
      console.error(`[Engine] Bot "${config.botName}" error:`, err.message);
    });

    bot.start({
      onStart: (botInfo) => {
        console.log(`[Engine] Bot "${config.botName}" is running online (@${botInfo?.username || 'unknown'}).`);
        if (botInfo && botInfo.username && botInfo.username !== config.telegramUsername) {
          db.collection('bots').doc(config.id).update({
            telegramUsername: botInfo.username,
          }).catch(() => {});
        }
      },
    });
  } catch (err) {
    activeBots.delete(config.id);
    console.error(`[Engine] Failed to start bot "${config.botName}":`, err.message);
  }
}

async function stopBot(botId) {
  const entry = activeBots.get(botId);
  if (!entry) return;
  try {
    await entry.bot.stop();
    activeBots.delete(botId);
    console.log(`[Engine] Bot "${entry.config.botName}" stopped.`);
  } catch (err) {
    console.error(`[Engine] Error stopping bot ${botId}:`, err.message);
    activeBots.delete(botId);
  }
}

// ─── Realtime Firestore Sync ──────────────────────────────────

function listenToBots() {
  console.log('[Engine] Subscribing to Firestore "bots" collection (Telegram sync) in realtime...');

  db.collection('bots').onSnapshot((snapshot) => {
    const currentBotIds = new Set();

    snapshot.docs.forEach((docSnap) => {
      const config = { id: docSnap.id, ...docSnap.data() };
      const isTelegram = config.telegramEnabled === true || config.platform === 'telegram' || (Array.isArray(config.channels) && config.channels.includes('telegram'));

      if (isTelegram && config.telegramToken && config.telegramToken.trim()) {
        currentBotIds.add(config.id);
        const isRunning = activeBots.has(config.id);
        if (config.isActive && !isRunning) {
          startBot(config);
        } else if (!config.isActive && isRunning) {
          stopBot(config.id);
        } else if (config.isActive && isRunning) {
          // Update config reference
          const entry = activeBots.get(config.id);
          if (entry) entry.config = config;
        }
      }
    });

    // Clean up any deleted bots
    for (const [id] of activeBots) {
      if (!currentBotIds.has(id)) {
        stopBot(id);
      }
    }
  }, (err) => {
    console.error('[Engine] Firestore listener error:', err.message);
  });
}

// ─── Express API Server ───────────────────────────────────────

// ─── Express API Server ───────────────────────────────────────

const app = express();
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});
app.use(cors({ origin: '*' }));
app.use(express.json({
  limit: '1mb',
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));

// ─── Rate limiting (sliding window per-user / per-IP) ────────
// Safe eviction prunes only expired records when map grows (F11)
function rateLimit({ windowMs = 60000, max = 120 } = {}) {
  const buckets = new Map();
  return (req, res, next) => {
    if (req.method === 'OPTIONS') return next();
    const key = req.uid || req.ip || 'unknown';
    const now = Date.now();
    let bucket = buckets.get(key);
    if (!bucket || now - bucket.start > windowMs) {
      bucket = { start: now, count: 0 };
      buckets.set(key, bucket);
    }

    // Safely prune expired entries without wiping active rate limits
    if (buckets.size > 5000) {
      for (const [k, b] of buckets.entries()) {
        if (now - b.start > windowMs) {
          buckets.delete(k);
        }
      }
    }

    if (++bucket.count > max) {
      return res.status(429).json({ error: 'عدد كبير من الطلبات — يرجى المحاولة لاحقاً' });
    }
    next();
  };
}

app.use('/api', rateLimit({ windowMs: 60000, max: 120 }));

// ─── Security: Firebase ID token verification ──────────────────
app.use('/api', async (req, res, next) => {
  if (req.method === 'OPTIONS') return next();
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'مصادقة مطلوبة — سجل الدخول وأعد المحاولة' });
  }
  try {
    const decoded = await admin.auth().verifyIdToken(header.slice(7));
    req.uid = decoded.uid;
    next();
  } catch {
    return res.status(401).json({ error: 'رمز المصادقة غير صالح أو منتهي الصلاحية' });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    engine: 'telegram_engine',
    activeBots: activeBots.size,
    uptime: process.uptime(),
  });
});

// Ownership guard: the authenticated user must own this bot (F14 Fix)
async function requireBotAccess(res, uid, botId) {
  try {
    const botDoc = await db.collection('bots').doc(botId).get();
    if (!botDoc.exists) {
      res.status(404).json({ error: 'البوت غير موجود' });
      return null;
    }
    const config = { id: botDoc.id, ...botDoc.data() };
    if (config.userId !== uid) {
      res.status(403).json({ error: 'لا تملك صلاحية الوصول إلى هذا البوت' });
      return null;
    }
    return config;
  } catch (err) {
    res.status(500).json({ error: 'فشل التحقق من صلاحيات البوت' });
    return null;
  }
}

// ─── Telegram Manual Reply ───
app.post('/api/reply', async (req, res) => {
  const { botId, customerId, telegramUserId, message, platform } = req.body;
  const targetUserId = customerId || telegramUserId;

  if (!botId || !targetUserId || !message) {
    return res.status(400).json({ error: 'معطيات ناقصة (botId, customerId, message)' });
  }

  const botConfig = await requireBotAccess(res, req.uid, botId);
  if (!botConfig) return;

  try {
    const takeoverKey = `${botId}_${targetUserId}`;
    if (!req.body.system) {
      humanTakeoverMap.set(takeoverKey, true);
    }

    const entry = activeBots.get(botId);
    if (entry && entry.bot) {
      await entry.bot.api.sendMessage(targetUserId, message);
    } else if (botConfig.telegramToken) {
      const tempBot = new Bot(botConfig.telegramToken);
      await tempBot.api.sendMessage(targetUserId, message);
    } else {
      throw new Error('قناة تيليغرام غير مهيأة');
    }

    // Save message to Firestore
    await saveMessage(botId, botConfig.userId, targetUserId, 'المالك', message, 'owner', 'telegram');

    res.json({ success: true, takeover: true });
  } catch (err) {
    console.error('[API] Telegram reply error:', err.message);
    res.status(500).json({ error: err.message || 'فشل إرسال الرد' });
  }
});

// Human takeover toggle (supports all platforms - F14)
app.post('/api/takeover', async (req, res) => {
  const { botId, customerId, telegramUserId, enabled } = req.body;
  const targetId = customerId || telegramUserId;
  if (!botId || !targetId) {
    return res.status(400).json({ error: 'معطيات ناقصة (botId, customerId)' });
  }

  const botConfig = await requireBotAccess(res, req.uid, botId);
  if (!botConfig) return;

  const key = `${botId}_${targetId}`;
  humanTakeoverMap.set(key, !!enabled);
  res.json({ success: true, takeover: !!enabled });
});

// POST /api/sheets/test-sync — Send test event to verify Google Sheets Webhook
app.post('/api/sheets/test-sync', async (req, res) => {
  const { botId, webhookUrl } = req.body;
  if (!botId) {
    return res.status(400).json({ error: 'botId مطلوب' });
  }
  const botConfig = await requireBotAccess(res, req.uid, botId);
  if (!botConfig) return;

  const targetUrl = webhookUrl || botConfig.googleSheetsWebhookUrl || botConfig.webhookUrl;
  if (!targetUrl) {
    return res.status(400).json({ error: 'يرجى إدخال رابط Google Sheets Webhook أولاً' });
  }

  const testPayload = {
    event: 'test_ping',
    trackingCode: 'DZ-TEST01',
    customerName: 'تجربة AuraBot',
    phone: '0660000000',
    address: 'الجزائر - تجربة المزامنة',
    product: 'منتج تجريبي / Lead Test',
    price: '1000',
    service: 'خدمة تجريبية',
    budget: '5000',
    leadStatus: 'hot',
    notes: 'تم إرسال هذا السطر لاختبار نجاح الربط مع Google Sheets',
  };

  const success = await syncToGoogleSheets({ id: botId, botName: botConfig.botName, googleSheetsWebhookUrl: targetUrl }, testPayload);
  if (success) {
    res.json({ success: true, message: 'تم إرسال سطر التجربة بنجاح إلى Google Sheets' });
  } else {
    res.status(502).json({ error: 'تعذر الاتصال بالرابط، تأكد من صحة رابط الـ Webhook ونشره كـ Web App' });
  }
});

// ─── Order Tracking & Delivery Management ─────────────────────

// POST /api/orders/:id/delivery-status — Update delivery status with IDOR protection (F02)
app.post('/api/orders/:id/delivery-status', async (req, res) => {
  const orderId = req.params.id;
  const { botId, deliveryStatus, provider, trackingNumber, notifyCustomer } = req.body;

  if (!orderId || !botId || !deliveryStatus) {
    return res.status(400).json({ error: 'معطيات ناقصة (orderId, botId, deliveryStatus)' });
  }

  const botConfig = await requireBotAccess(res, req.uid, botId);
  if (!botConfig) return;

  const eventId = `evt_${orderId}_${deliveryStatus}_${Date.now()}`;
  const updateResult = await updateOrderDeliveryStatus(
    orderId,
    deliveryStatus,
    { provider, trackingNumber },
    eventId,
    botId,
    req.uid
  );

  if (!updateResult.success) {
    return res.status(500).json({ error: updateResult.reason || 'فشل تحديث حالة الطلبية' });
  }

  const order = updateResult.order;
  let notificationSent = false;

  if (notifyCustomer && order && order.customerId && !updateResult.alreadyProcessed) {
    try {
      const statusLabel = DELIVERY_STATUS_LABELS[deliveryStatus] || deliveryStatus;
      const providerName = PROVIDER_NAMES[provider] || provider || '';

      let notifMsg = `*تحديث حالة طلبيتك:*\n\n`;
      notifMsg += `أهلاً بك! تم تحديث حالة طردك إلى:\n`;
      notifMsg += `• ${statusLabel}\n\n`;
      if (order.product) {
        notifMsg += `• *المنتج:* ${order.product}\n`;
      }
      if (providerName && provider !== 'manual') {
        notifMsg += `• *شركة الشحن:* ${providerName}\n`;
      }
      if (trackingNumber) {
        notifMsg += `• *رقم بوليصة الشحن:* \`${trackingNumber}\`\n`;
      }
      if (order.trackingCode) {
        notifMsg += `\n*كود التتبع الخاص بك (لنسخه واستخدامه مباشرة):*\n`;
        notifMsg += `\`${order.trackingCode || 'DZ-XXXXXX'}\`\n\n`;
      }
      notifMsg += `يمكنك كتابة "تتبع" في أي وقت للاستعلام المباشر عن حالة الطرد.`;

      // Dispatch Telegram notification
      const entry = activeBots.get(botId);
      if (entry && entry.bot) {
        await entry.bot.api.sendMessage(order.customerId, notifMsg, { parse_mode: 'Markdown' });
        notificationSent = true;
      }

      await saveMessage(botId, botConfig.userId, order.customerId, order.customerName || 'الزبون', notifMsg, 'bot', 'telegram');
    } catch (sendErr) {
      console.warn(`[Delivery Notif] Notification send failed for customer ${order.customerId}:`, sendErr.message);
    }
  }

  res.json({
    success: true,
    order: updateResult.order,
    notificationSent,
    alreadyProcessed: !!updateResult.alreadyProcessed,
  });
});

// ─── Telegram Abandoned Lead Recovery Background Worker ────────
async function runTelegramAbandonedRecoveryCron() {
  try {
    for (const [botId, entry] of activeBots.entries()) {
      const config = entry.config;
      const isRecoveryEnabled = config.features?.abandonedRecovery === true || config.abandonedRecoveryEnabled === true;
      if (!isRecoveryEnabled || !entry.bot) continue;

      const delayHours = Number(config.abandonedRecoveryDelayHours) || 2;
      const cutoffDate = new Date(Date.now() - delayHours * 3600 * 1000).toISOString();
      const maxLookbackDate = new Date(Date.now() - 48 * 3600 * 1000).toISOString();

      // Fetch recent messages
      const convSnap = await db.collection('conversations')
        .where('botId', '==', botId)
        .where('platform', '==', 'telegram')
        .where('createdAt', '>=', maxLookbackDate)
        .orderBy('createdAt', 'desc')
        .limit(100)
        .get();

      if (convSnap.empty) continue;

      const threads = {};
      convSnap.docs.forEach(d => {
        const data = d.data();
        const cid = data.telegramUserId || data.customerId;
        if (!cid) return;
        if (!threads[cid]) {
          threads[cid] = {
            customerId: cid,
            userName: data.userName || 'زبون',
            lastMessageAt: data.createdAt,
            messages: [],
          };
        }
        threads[cid].messages.push(data);
      });

      // Orders check
      const orderSnap = await db.collection('orders')
        .where('botId', '==', botId)
        .where('createdAt', '>=', maxLookbackDate)
        .get();
      
      const customersWithOrders = new Set();
      orderSnap.docs.forEach(d => {
        const o = d.data();
        if (o.customerId) customersWithOrders.add(String(o.customerId));
      });

      // Past reminders check
      const reminderSnap = await db.collection('abandoned_reminders')
        .where('botId', '==', botId)
        .where('remindedAt', '>=', maxLookbackDate)
        .get();
      
      const remindedCustomers = new Set();
      reminderSnap.docs.forEach(d => {
        const r = d.data();
        if (r.customerId) remindedCustomers.add(String(r.customerId));
      });

      for (const cid of Object.keys(threads)) {
        const t = threads[cid];
        const takeoverKey = `${botId}_${cid}`;
        if (humanTakeoverMap.get(takeoverKey)) continue;

        if (
          t.lastMessageAt <= cutoffDate &&
          !customersWithOrders.has(cid) &&
          !remindedCustomers.has(cid) &&
          t.messages.length >= 1
        ) {
          const reminderMsg = config.abandonedRecoveryMessage ||
            `مرحباً بك ${t.userName || 'أخي الكريم'}، لاحظنا أنك كنت مهتماً بخدماتنا واستفسرت سابقاً. هل ما زلت بحاجة لأي استفسار أو ترغب في إتمام طلبك؟ نحن في خدمتك دائماً.`;

          try {
            await entry.bot.api.sendMessage(cid, reminderMsg);
            await saveMessage(botId, config.userId, cid, t.userName, reminderMsg, 'bot', 'telegram');
            await db.collection('abandoned_reminders').add({
              botId,
              customerId: String(cid),
              remindedAt: new Date().toISOString(),
              timestamp: FieldValue.serverTimestamp(),
            });
            console.log(`[Telegram Recovery] Sent abandoned reminder to ${cid} for bot ${botId}`);
          } catch (sendErr) {
            console.warn(`[Telegram Recovery] Failed to send reminder to ${cid}:`, sendErr.message);
          }
        }
      }
    }
  } catch (err) {
    console.error('[Telegram Recovery] Cron error:', err.message);
  }
}

// Process Crash Guards
process.on('unhandledRejection', (reason) => {
  console.warn('[Process] Caught unhandledRejection:', reason?.message || reason);
});

process.on('uncaughtException', (err) => {
  console.error('[Process] Caught uncaughtException:', err.message);
});

// Start Express and Firestore Listener
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[Engine] HTTP API running on port ${PORT} (0.0.0.0)`);
  listenToBots();

  // Run abandoned recovery cron every 10 minutes
  setInterval(runTelegramAbandonedRecoveryCron, 10 * 60 * 1000);
  setTimeout(runTelegramAbandonedRecoveryCron, 45 * 1000);
});
