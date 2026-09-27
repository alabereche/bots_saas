// ═══════════════════════════════════════════════════════════════
// BotForge — Telegram Bot Engine v3 (Powered by Firebase & Gemini)
// Realtime Firestore sync, threaded chat, order extraction,
// human takeover, instant bot lifecycle management
// ═══════════════════════════════════════════════════════════════

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import { Bot, InputFile, InlineKeyboard } from 'grammy';
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
  customerStatusLabel,
  PROVIDER_NAMES,
} from './tracking-helper.js';
import { validateWebhookUrl } from './ssrf-guard.js';
import { parseGeminiKeys, runKeyPool } from './gemini-pool.js';
import { encrypt, decrypt } from './encryption.js';
import { syncToGoogleSheets } from './sheetsSync.js';
import { initBilling, getLimits, checkAndCountMessage, markLimitNotified, wasLimitNotified, adjustProductStock } from './billing.mjs';
import { enqueueTelegramTask, clearTelegramQueue } from './telegramQueue.js';

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
// Key pool — comma-separated list; on 429 the next key takes over
const GEMINI_API_KEYS = parseGeminiKeys(process.env);
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
initBilling(db, FieldValue);

// Plan-gate notices are sent once per bot (never nag in a loop)
const planGateNotified = new Set();

// Active running bot instances: botId -> { bot, config }
const activeBots = new Map();

// Human takeover tracker: "botId_userId" -> true
const humanTakeoverMap = new Map();

// Conversation history buffer: "botId_userId" -> array of messages
const conversationHistory = new Map();
const MAX_HISTORY = 20;

// User avatar cache: userId -> avatarUrl (TTL: in-memory)
// Bounded cache with real TTL (see boundedCache.js — duplicated per
// service by design: engines are isolated deploy units)
function createBoundedCache({ maxEntries = 2000, ttlMs = 24 * 60 * 60 * 1000 } = {}) {
  const m = new Map();
  return {
    get(key) {
      const entry = m.get(key);
      if (entry === undefined) return undefined;
      if (Date.now() - entry.at > ttlMs) { m.delete(key); return undefined; }
      return entry.value;
    },
    has(key) {
      const entry = m.get(key);
      if (entry === undefined) return false;
      if (Date.now() - entry.at > ttlMs) { m.delete(key); return false; }
      return true;
    },
    set(key, value) {
      if (m.has(key)) m.delete(key);
      m.set(key, { value, at: Date.now() });
      while (m.size > maxEntries) m.delete(m.keys().next().value);
    },
  };
}

const telegramAvatarCache = createBoundedCache({ maxEntries: 2000, ttlMs: 24 * 60 * 60 * 1000 }); // سقف + انتهاء حقيقي

// ─── Firestore Helpers ────────────────────────────────────────

// ownerUserId is stamped on every document so the security rules can
// authorize owner access without a per-document get()
async function saveMessage(botId, ownerUserId, telegramUserId, userName, content, role, platform = 'telegram', userAvatar = null, receiptUrl = null) {
  try {
    const msgDoc = {
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
    };
    if (receiptUrl) msgDoc.receiptUrl = receiptUrl;
    await db.collection('conversations').add(msgDoc);
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
const recentTgNotificationsCache = new Map();
const SYSTEM_TG_NOTIF_COOLDOWN_MS = 6 * 60 * 60 * 1000;

async function createNotification({ userId, botId, type = 'system', title, body = '', meta = {} }) {
  try {
    if (!userId) return null;

    if (type === 'system' && botId) {
      const cacheKey = `${userId}_${botId}_${title}`;
      const lastSent = recentTgNotificationsCache.get(cacheKey) || 0;
      if (Date.now() - lastSent < SYSTEM_TG_NOTIF_COOLDOWN_MS) {
        return null;
      }
      recentTgNotificationsCache.set(cacheKey, Date.now());
    }

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
  if (provided && typeof provided === 'string' && provided.trim()) return provided.trim();
  if (!botId) return '';
  try {
    const snap = await db.collection('bots').doc(botId).get();
    if (snap.exists) {
      const data = snap.data();
      return data.userId || data.ownerId || data.uid || '';
    }
    return '';
  } catch {
    return '';
  }
}

// Auto-Heal: repairs existing leads in Firestore that have empty or mismatched userId
async function repairOrphanLeads(botId, ownerUserId) {
  if (!botId) return;
  try {
    const resolvedUid = await resolveOwnerUserId(botId, ownerUserId);
    if (!resolvedUid) return;

    const snap = await db.collection('leads')
      .where('botId', '==', botId)
      .get();

    if (snap.empty) return;
    const batch = db.batch();
    let count = 0;

    snap.docs.forEach((docSnap) => {
      const d = docSnap.data();
      if (!d.userId || d.userId !== resolvedUid) {
        batch.update(docSnap.ref, { userId: resolvedUid });
        count++;
      }
    });

    if (count > 0) {
      await batch.commit();
      console.log(`[Engine] Auto-Healed ${count} orphan lead(s) for bot ${botId} with owner userId: ${resolvedUid}`);
    }
  } catch (err) {
    console.warn('[Engine] repairOrphanLeads notice:', err.message);
  }
}

// Deterministic phone number extractor
function extractPhoneNumber(text) {
  if (!text || typeof text !== 'string') return null;
  // Match Algerian phone numbers (05, 06, 07 followed by 8 digits or with international code)
  const dzMatch = text.match(/(?:(?:\+|00)213\s?|0)[567]\d{8}/);
  if (dzMatch) return dzMatch[0].replace(/\s+/g, '');
  // Match standard 9-15 digit phone patterns
  const genMatch = text.match(/(?:\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,5}/);
  if (genMatch) {
    const digits = genMatch[0].replace(/\D/g, '');
    if (digits.length >= 8 && digits.length <= 15) {
      return genMatch[0].trim();
    }
  }
  return null;
}

async function saveOrderToFirestore(orderData, orderMergeMode = 'merge') {
  try {
    const userId = await resolveOwnerUserId(orderData.botId, orderData.ownerUserId);
    const now = new Date().toISOString();

    // Check if merge mode is active and customer has an open (accepted-stage) order
    if (orderMergeMode !== 'separate' && (orderData.customerId || orderData.phone)) {
      try {
        // 'in' covers the new accepted stage plus legacy pending/preparing rows
        const snap = await db.collection('orders')
          .where('botId', '==', orderData.botId)
          .where('deliveryStatus', 'in', ['accepted', 'pending', 'preparing'])
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
              deliveryStatus: 'accepted',
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
      deliveryStatus: 'accepted',
      timestamp: now,
      note: 'تم تسجيل وتأكيد الطلبية بنجاح',
    }];

    const docRef = await db.collection('orders').add({
      ...orderData,
      trackingCode,
      userId: userId || '',
      orderStatus: orderData.orderStatus || 'confirmed',
      deliveryStatus: orderData.deliveryStatus || 'accepted',
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

    // Auto-heal in background
    if (userId) {
      repairOrphanLeads(leadData.botId, userId).catch(() => {});
    }

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
      }, config?.orderMergeMode || 'merge').then(async (saved) => {
        if (!saved) return;

        // Reservation model: a confirmed order reserves one unit
        if (product) adjustProductStock(botId, product, 'reserve', ownerUserId).catch(() => {});

        // Tracking code follow-up (plain text on TG — long-press to copy)
        if (saved.trackingCode && !saved.isUpdate) {
          const botInstance = activeBots.get(botId)?.bot;
          if (botInstance) {
            botInstance.api.sendMessage(String(customerId),
              'رمز تتبع طلبك: ' + saved.trackingCode + '\nاكتب «تتبع» في أي وقت للاستعلام عن حالة طلبيتك.'
            ).catch(() => {});
          }
        }

        // Sync to Google Sheets — Pro capability (plan-checked)
        if (config && (await getLimits(config.userId)).sheets) {
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
      }).then(async (savedLead) => {
        if (!savedLead) return;

        // Sync Lead to Google Sheets — Pro capability (plan-checked)
        if (config && (await getLimits(config.userId)).sheets) {
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

function normalizeGeminiModel(rawModel) {
  if (!rawModel || typeof rawModel !== 'string') return 'gemini-3.5-flash-lite';
  const m = rawModel.trim();
  if (m.includes('1.5') || m.includes('2.5') || m === 'gemini-3.7-flash-lite') {
    return 'gemini-3.5-flash-lite';
  }
  return m;
}

// ─── Google Gemini AI ─────────────────────────────────────────

async function callGemini(apiKey, model, messages, audioData = null) {
  const primaryModel = normalizeGeminiModel(model);
  const modelsToTry = [
    primaryModel,
    'gemini-3.5-flash-lite',
    'gemini-3.5-flash',
    'gemini-3.7-flash',
    'gemini-3.8-flash',
    'gemini-3.6-flash',
    'gemini-2.0-flash',
    'gemini-2.0-flash-lite',
  ].filter((v, i, a) => a.indexOf(v) === i);

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

  // `AQ.`-prefixed strings from AI Studio are API keys → x-goog-api-key.
  // Bearer is for real OAuth access tokens (ya29…) only.
  const isBearer = apiKey && (apiKey.startsWith('ya29') || (apiKey.length > 80 && !apiKey.startsWith('AQ.')));

  let lastError = null;
  for (const geminiModel of modelsToTry) {
    // gemini-3.5-flash-lite does not support custom temperature
    const generationConfig = { maxOutputTokens: 800 };
    if (!geminiModel.includes('flash-lite')) {
      generationConfig.temperature = 0.7;
    }

    const payload = JSON.stringify({
      systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined,
      contents,
      generationConfig,
    });

    const apiVersions = ['v1', 'v1beta'];
    for (const apiVersion of apiVersions) {
      try {
        const url = `https://generativelanguage.googleapis.com/${apiVersion}/models/${geminiModel}:generateContent`;

        const headers = { 'Content-Type': 'application/json' };
        if (isBearer) {
          headers['Authorization'] = `Bearer ${apiKey}`;
        } else {
          headers['x-goog-api-key'] = apiKey;
        }

        const res = await fetch(url, {
          method: 'POST',
          headers,
          body: payload,
          signal: AbortSignal.timeout(AI_TIMEOUT_MS),
        });

        if (res.ok) {
          const data = await res.json();
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) {
            console.log(`[Gemini] Success using ${geminiModel} (${apiVersion})`);
            return text;
          }
          lastError = new Error(`Gemini ${geminiModel} (${apiVersion}): empty response`);
        } else {
          const err = await res.text();
          lastError = new Error(`Gemini ${geminiModel} (${apiVersion}) ${res.status}: ${err}`);
          console.warn(`[Gemini] ${geminiModel} (${apiVersion}) failed with ${res.status}`);

          if ((res.status === 401 || res.status === 403) && !isBearer && apiKey.startsWith('AQ.')) {
            try {
              const res2 = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
                body: payload,
                signal: AbortSignal.timeout(AI_TIMEOUT_MS),
              });
              if (res2.ok) {
                const data2 = await res2.json();
                const text2 = data2.candidates?.[0]?.content?.parts?.[0]?.text;
                if (text2) {
                  console.log(`[Gemini] Success using ${geminiModel} (${apiVersion}) via Bearer`);
                  return text2;
                }
              }
            } catch { /* fall through to next model/version */ }
          }

          if (res.status === 404) continue;
          if (res.status === 400 || res.status === 401 || res.status === 403 || res.status === 429) {
            break;
          }
        }
      } catch (e) {
        lastError = e;
      }
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
  const model = normalizeGeminiModel(config.aiModel || config.model || process.env.DEFAULT_AI_MODEL || 'gemini-3.5-flash-lite');
  const customKey = config.customApiKey || config.geminiApiKey || config.apiKey;
  const keys = customKey ? [customKey] : GEMINI_API_KEYS;

  // ─── Plan enforcement: daily AI-message meter (counted right before
  // the AI call — the tracking fast-path never burns quota) ───────────
  const bill = await checkAndCountMessage(config);
  if (!bill.allowed) {
    if (!wasLimitNotified(config.id)) {
      markLimitNotified(config.id);
      db.collection('notifications').add({
        userId: config.userId,
        botId: config.id,
        type: 'system',
        title: 'بلغ البوت حدّ رسائل اليوم',
        body: `توقف الرد التلقائي حتى نهاية اليوم بعد ${bill.limits.dailyMessages} رسالة. رقّ باقتك من صفحة الاشتراكات.`,
      }).catch(() => {});
    }
    console.log(`[Billing] Daily cap reached for TG bot ${config.id} (${bill.limits.dailyMessages})`);
    return `وصلتَ حدّ الرسائل اليومي لباقتك الحالية (${bill.limits.dailyMessages} رسالة). سأعود لخدمتك غداً — أو رقّ حسابك من لوحة التحكم في صفحة الاشتراكات.`;
  }

  let reply;
  try {
    reply = await runKeyPool(keys, (key) => callGemini(key, model, messages, audioData));
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

  // 2. ALL product tags — [SHOW_PRODUCT: x], [PRODUCT: x], direct [prod_xxx] —
  //    ordered by appearance, deduped, capped at 4 (visual showcase cap)
  const singleIds = [];
  const tagRe = /\[(?:SHOW_PRODUCT|PRODUCT)\s*:\s*([^\]]+)\]|\[(prod_[a-zA-Z0-9_\-]+)\]/gi;
  let tm;
  while ((tm = tagRe.exec(cleanReply)) !== null) {
    const id = (tm[1] || tm[2] || '').replace(/\s+/g, '').trim();
    if (id && !singleIds.includes(id)) singleIds.push(id);
  }
  if (singleIds.length > 0) {
    cleanReply = cleanReply
      .replace(/\[(?:SHOW_PRODUCT|PRODUCT)\s*:\s*[^\]]+\]/gi, '')
      .replace(/\[prod_[a-zA-Z0-9_\-]+\]/gi, '')
      .trim();
  }

  // Clean any remaining bracket tags
  cleanReply = cleanReply
    .replace(/\[(?:SHOW_PRODUCT|SHOW_PRODUCT_GALLERY|PRODUCT|prod)[^\]]*\]/gis, '')
    .trim();

  // mediaItems: [{ image, caption }] — caption '__REPLY__' means "use the
  // AI's textual pitch as the caption" (single product / gallery first img)
  const mediaItems = [];
  const showcasedNames = [];
  let useReplyOnFirst = false;

  const findProduct = (targetId) => Array.isArray(productsList) ? productsList.find(p => p && (
    String(p.id).trim() === targetId ||
    String(p.id).trim() === `prod_${targetId}` ||
    targetId.includes(String(p.id)) ||
    String(p.id).includes(targetId)
  )) : null;

  if (galleryProductId) {
    const product = findProduct(galleryProductId);
    if (product) {
      showcasedNames.push(String(product.name || '').trim());
      const allImages = [];
      if (product.primaryImage) allImages.push(product.primaryImage);
      if (Array.isArray(product.secondaryImages)) {
        allImages.push(...product.secondaryImages.filter(Boolean));
      } else if (Array.isArray(product.images)) {
        allImages.push(...product.images.filter(Boolean));
      }
      allImages.slice(0, 5).forEach((img, i) => {
        mediaItems.push({ image: img, caption: i === 0 ? '__REPLY__' : null });
      });
      useReplyOnFirst = true;
    }
  } else if (singleIds.length > 0) {
    useReplyOnFirst = singleIds.length === 1;
    for (const id of singleIds.slice(0, 4)) {
      const product = findProduct(id);
      if (!product) continue;
      const mainImg = product.primaryImage || (Array.isArray(product.images) ? product.images[0] : null);
      if (!mainImg) continue;
      const op = parseFloat(product.oldPrice), np = parseFloat(product.price);
      const hasDisc = op > 0 && np > 0 && op > np;
      const discPct = hasDisc ? Math.round((1 - np / op) * 100) : 0;
      const cap = `${product.name || 'منتج'} - السعر: ${product.price}${hasDisc ? ` بدلاً من ${product.oldPrice} (خصم ${discPct}%)` : ''}`;
      mediaItems.push({ image: mainImg, caption: cap });
      showcasedNames.push(String(product.name || '').trim());
    }
  }

  return { cleanReply, mediaItems, useReplyOnFirst, showcasedNames };
}

// ═══════════════════════════════════════════════════════════════
// Telegram Digital Store & Interactive Studio Backend Helpers
// ═══════════════════════════════════════════════════════════════

function parseStoreRows(input) {
  if (!input) return [];
  if (typeof input === 'string') {
    try {
      const p = JSON.parse(input);
      if (Array.isArray(p)) return p;
    } catch { return []; }
  }
  if (typeof input === 'object' && !Array.isArray(input)) {
    if (input.rowsJson) {
      try {
        const p = JSON.parse(input.rowsJson);
        if (Array.isArray(p)) return p;
      } catch { /* fallback */ }
    }
    input = input.rows;
  }
  if (Array.isArray(input)) {
    if (input.length > 0 && Array.isArray(input[0])) {
      return input;
    }
    if (input.length > 0 && input[0] && Array.isArray(input[0].buttons)) {
      return input.map(r => (r.buttons || []).map(b => {
        let sub = b.subButtons;
        if (typeof sub === 'string') {
          try { sub = JSON.parse(sub); } catch { sub = []; }
        }
        return { ...b, subButtons: sub };
      }));
    }
  }
  return [];
}

const DEFAULT_STORE_PAYMENT_METHODS = [
  {
    id: 'binance',
    name: '🔸 الدفع عبر Binance',
    details: 'معرف الدفع (Binance Pay ID): 123456789\nأو تحويل USDT على شبكة BEP20:\n0x1234567890abcdef1234567890abcdef12345678',
    enabled: true,
  },
  {
    id: 'baridimob',
    name: '💳 بريدي موب (BaridiMob)',
    details: 'RIP: 00799999000123456789\nالاسم: MOHAMED ALGERIA',
    enabled: true,
  },
  {
    id: 'ccp',
    name: '📬 الحساب البريدي الجاري (CCP)',
    details: 'رقم الحساب: 1234567 مفتاح 89\nالاسم: محمد الجزائري',
    enabled: true,
  },
  {
    id: 'usdt',
    name: '₮ العملات الرقمية USDT (TRC20)',
    details: 'العنوان: TXYz1234567890abcdef1234567890abcdef\nالشبكة: TRC20 (Tron)',
    enabled: false,
  },
];

function getStorePaymentMethods(storeConfig) {
  if (!storeConfig) return DEFAULT_STORE_PAYMENT_METHODS;
  if (storeConfig.paymentMethodsJson) {
    try {
      const parsed = JSON.parse(storeConfig.paymentMethodsJson);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch { /* fallback */ }
  }
  if (Array.isArray(storeConfig.paymentMethods) && storeConfig.paymentMethods.length > 0) {
    return storeConfig.paymentMethods;
  }
  return DEFAULT_STORE_PAYMENT_METHODS;
}

function generateOrderReference() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let ref = 'BF';
  for (let i = 0; i < 8; i++) {
    ref += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return ref;
}

function buildStoreKeyboard(rowsInput = []) {
  const keyboard = new InlineKeyboard();
  const rows = parseStoreRows(rowsInput);
  if (!Array.isArray(rows) || rows.length === 0) return keyboard;

  rows.forEach((row, rIdx) => {
    if (!Array.isArray(row) || row.length === 0) return;
    row.forEach((btn) => {
      if (!btn || !btn.id) return;
      const label = btn.text || 'زر';
      if (btn.action === 'url' && btn.url) {
        const link = btn.url.startsWith('http') ? btn.url : `https://${btn.url}`;
        keyboard.url(label, link);
      } else if (btn.action === 'submenu') {
        keyboard.text(label, `tgstore_sub_${btn.id}`);
      } else if (btn.action === 'product') {
        keyboard.text(label, `tgstore_prod_${btn.id}`);
      } else if (btn.action === 'wallet') {
        keyboard.text(label, 'tgstore_wallet');
      } else if (btn.action === 'rules') {
        keyboard.text(label, 'tgstore_rules');
      } else if (btn.action === 'custom_message') {
        keyboard.text(label, `tgstore_msg_${btn.id}`);
      } else {
        keyboard.text(label, `tgstore_btn_${btn.id}`);
      }
    });
    if (rIdx < rows.length - 1) {
      keyboard.row();
    }
  });

  return keyboard;
}

function findStoreButton(rowsInput = [], targetId) {
  const rows = parseStoreRows(rowsInput);
  if (!Array.isArray(rows) || !targetId) return null;
  for (const row of rows) {
    if (!Array.isArray(row)) continue;
    for (const btn of row) {
      if (!btn) continue;
      if (String(btn.id) === String(targetId)) return btn;
      if (btn.subButtons) {
        const subMatch = findStoreButton(btn.subButtons, targetId);
        if (subMatch) return subMatch;
      }
    }
  }
  return null;
}

async function checkUserSubscription(ctx, channelIdentifier) {
  try {
    if (!channelIdentifier || typeof channelIdentifier !== 'string') return true;
    let target = channelIdentifier.trim();
    if (target.startsWith('https://t.me/')) {
      target = target.replace('https://t.me/', '@');
    }
    if (!target.startsWith('@') && !target.startsWith('-100') && !/^\d+$/.test(target)) {
      target = `@${target}`;
    }
    const member = await ctx.api.getChatMember(target, ctx.from.id);
    const validStatuses = ['creator', 'administrator', 'member', 'restricted'];
    return validStatuses.includes(member.status);
  } catch (err) {
    // Fail-open: if bot is not admin in channel or username is invalid, don't lock customer out
    console.warn('[Telegram Store] checkUserSubscription notice (fail-open):', err.message);
    return true;
  }
}

async function broadcastToLogsChannel(api, channelId, itemTitle, price, buyerName, storeName) {
  try {
    if (!channelId || typeof channelId !== 'string') return;
    let target = channelId.trim();
    if (target.startsWith('https://t.me/')) {
      target = target.replace('https://t.me/', '@');
    }
    if (!target.startsWith('@') && !target.startsWith('-100') && !/^\d+$/.test(target)) {
      target = `@${target}`;
    }

    const logText =
      `*عملية شراء جديدة ناجحة!*\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `*المنتج:* ${itemTitle}\n` +
      `*القيمة:* ${price ? price + ' دج' : 'مدفوع'}\n` +
      `*المشتري:* ${buyerName || 'زبون مميز'}\n` +
      `*المتجر:* ${storeName || 'المتجر الرسمي'}\n` +
      `*الحالة:* تم الحجز وجاري التسليم الفوري\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `شكراً لثقتكم المستمرة بنا!`;

    await api.sendMessage(target, logText, { parse_mode: 'Markdown' });
    console.log(`[Telegram Store] Broadcasted order log to channel ${target}`);
  } catch (err) {
    console.warn('[Telegram Store] Broadcast to logs channel failed:', err.message);
  }
}

async function handleStoreStart(ctx, currentConfig) {
  const storeConfig = currentConfig.telegramStore || {};
  const isForceSub = storeConfig.forceSubscribeEnabled !== false && !!storeConfig.forceSubscribeChannel;

  if (isForceSub) {
    const isSubscribed = await checkUserSubscription(ctx, storeConfig.forceSubscribeChannel);
    if (!isSubscribed) {
      const channelRaw = storeConfig.forceSubscribeChannel.trim();
      const channelLink = channelRaw.startsWith('http')
        ? channelRaw
        : `https://t.me/${channelRaw.replace(/^@/, '')}`;

      const subKeyboard = new InlineKeyboard()
        .url('اضغط هنا للانضمام للقناة', channelLink)
        .row()
        .text('تحقق من الانضمام', 'tgstore_check_sub');

      const notice =
        `أهلاً بك في متجر *${currentConfig.businessName || currentConfig.botName}*!\n\n` +
        `*تنبيه:* للانضمام واستخدام المتجر وتصفح العروض الحصرية، يجب أولاً الاشتراك في قناتنا الرسمية للإثباتات واللوغز.\n\n` +
        `اشترك بالقناة عبر الزر أدناه ثم اضغط على «تحقق من الانضمام» للدخول:`;

      await ctx.reply(notice, { reply_markup: subKeyboard, parse_mode: 'Markdown' }).catch(async () => {
        await ctx.reply(notice, { reply_markup: subKeyboard });
      });
      return;
    }
  }

  await sendStoreMainMenu(ctx, currentConfig);
}

async function sendStoreMainMenu(ctx, currentConfig) {
  const storeConfig = currentConfig.telegramStore || {};
  const welcome = storeConfig.welcomeMessage ||
    `مرحباً بك في متجر *${currentConfig.businessName || currentConfig.botName}*!\nاختر الخدمة أو المنتج الذي تريده لتأكيد طلبك فوراً:`;
  const keyboard = buildStoreKeyboard(storeConfig);

  const banner = storeConfig.bannerUrl ? resolveInputMedia(storeConfig.bannerUrl) : null;

  if (banner) {
    await ctx.replyWithPhoto(banner, {
      caption: welcome,
      reply_markup: keyboard,
      parse_mode: 'Markdown',
    }).catch(async (err) => {
      console.warn('[Telegram Store] Banner send failed, fallback to text:', err.message);
      await ctx.reply(welcome, { reply_markup: keyboard, parse_mode: 'Markdown' }).catch(() => {
        ctx.reply(welcome, { reply_markup: keyboard });
      });
    });
  } else {
    await ctx.reply(welcome, { reply_markup: keyboard, parse_mode: 'Markdown' }).catch(() => {
      ctx.reply(welcome, { reply_markup: keyboard });
    });
  }
}

async function startBot(config) {
  if (activeBots.has(config.id)) return;
  const isTelegram = config.telegramEnabled === true || config.platform === 'telegram' || (Array.isArray(config.channels) && config.channels.includes('telegram'));
  if (!config.telegramToken || !isTelegram) return;

  // Auto-heal any orphaned leads for this bot on startup
  if (config.userId) {
    repairOrphanLeads(config.id, config.userId).catch(() => {});
  }

  try {
    console.log(`[Engine] Initializing Telegram bot "${config.botName}" (${config.id})...`);
    const bot = new Bot(config.telegramToken.trim());
    // Register in activeBots immediately to prevent concurrent duplicate instances
    activeBots.set(config.id, { bot, config });

    bot.command('start', async (ctx) => {
      const liveEntry = activeBots.get(config.id);
      const currentConfig = (liveEntry && liveEntry.config) ? liveEntry.config : config;
      const storeConfig = currentConfig.telegramStore;
      const isStoreMode = storeConfig?.enabled === true || currentConfig.businessType === 'telegram_store';

      if (isStoreMode) {
        return handleStoreStart(ctx, currentConfig);
      }

      const greeting = config.responseStyle === 'formal'
        ? `مرحباً بك. أنا ${config.botName}، مساعدك الآلي من ${config.businessName}. كيف يمكنني مساعدتك اليوم؟`
        : `أهلاً وسهلاً بك. أنا ${config.botName} من ${config.businessName}. كيف يمكنني مساعدتك اليوم؟`;
      await ctx.reply(greeting);
    });

    bot.on('callback_query:data', async (ctx) => {
      const data = ctx.callbackQuery?.data;
      if (!data || !data.startsWith('tgstore_')) return;

      const liveEntry = activeBots.get(config.id);
      const currentConfig = (liveEntry && liveEntry.config) ? liveEntry.config : config;
      const storeConfig = currentConfig.telegramStore || {};

      try {
        if (data === 'tgstore_check_sub') {
          const isSub = await checkUserSubscription(ctx, storeConfig.forceSubscribeChannel);
          if (isSub) {
            await ctx.answerCallbackQuery({ text: 'تم التحقق بنجاح! مرحباً بك في المتجر.' }).catch(() => {});
            await sendStoreMainMenu(ctx, currentConfig);
          } else {
            await ctx.answerCallbackQuery({
              text: 'لم تشترك بعد في القناة! يرجى الاشتراك أولاً ثم الضغط للتحقق.',
              show_alert: true,
            }).catch(() => {});
          }
          return;
        }

        if (!data.startsWith('tgstore_chk_')) {
          await ctx.answerCallbackQuery().catch(() => {});
        }

        if (data === 'tgstore_main') {
          await sendStoreMainMenu(ctx, currentConfig);
          return;
        }

        if (data === 'tgstore_wallet') {
          const walletText = storeConfig.walletInfo ||
            '*معلومات وطرق الدفع المعتمدة:*\n\n• بريدي موب (BaridiMob)\n• بينانس (Binance Pay / USDT)\n• الحساب البريدي الجاري (CCP)\n\nبعد التحويل، يرجى إرسال صورة وصل الدفع أو معرف العملية (Binance Pay ID / TxID) هنا في المحادثة مباشرة لتأكيد طلبك فوراً!';
          const kb = new InlineKeyboard().text('العودة للقائمة الرئيسية', 'tgstore_main');
          await ctx.reply(walletText, { reply_markup: kb, parse_mode: 'Markdown' }).catch(() => {
            ctx.reply(walletText, { reply_markup: kb });
          });
          return;
        }

        if (data === 'tgstore_rules') {
          const rules = storeConfig.rulesText ||
            '*قوانين وشروط المتجر والضمان:*\n\n1. جميع المنتجات والحسابات أصلية ومضمونة.\n2. التسليم يتم فور مراجعة وصل الدفع.\n3. الدعم متوفر لمساعدتك في أي وقت.';
          const kb = new InlineKeyboard().text('العودة للقائمة الرئيسية', 'tgstore_main');
          await ctx.reply(rules, { reply_markup: kb, parse_mode: 'Markdown' }).catch(() => {
            ctx.reply(rules, { reply_markup: kb });
          });
          return;
        }

        if (data.startsWith('tgstore_sub_')) {
          const subId = data.replace('tgstore_sub_', '');
          const btn = findStoreButton(storeConfig, subId);
          if (btn && btn.subButtons) {
            const subKb = buildStoreKeyboard(btn.subButtons);
            subKb.row().text('العودة للقائمة الرئيسية', 'tgstore_main');
            const subTitle = `*${btn.text || 'قائمة المنتجات'}*\nاختر من الخيارات التالية:`;
            await ctx.reply(subTitle, { reply_markup: subKb, parse_mode: 'Markdown' }).catch(() => {
              ctx.reply(subTitle, { reply_markup: subKb });
            });
          }
          return;
        }

        if (data.startsWith('tgstore_prod_')) {
          const prodId = data.replace('tgstore_prod_', '');
          const btn = findStoreButton(storeConfig, prodId);
          if (btn) {
            const priceStr = btn.productPrice ? `${btn.productPrice} دج` : 'سعر خاص';
            const prodText =
              `*${btn.text}*\n` +
              `━━━━━━━━━━━━━━━━━━\n` +
              `*السعر:* ${priceStr}\n` +
              (btn.customMessage ? `\n${btn.customMessage}\n` : '') +
              `\nللتأكيد الفوري اضغط على زر «شراء الآن» أدناه:`;

            const prodKb = new InlineKeyboard()
              .text('شراء الآن (تأكيد الطلب)', `tgstore_buy_${btn.id}`)
              .row()
              .text('طرق الدفع', 'tgstore_wallet')
              .text('رجوع', 'tgstore_main');

            await ctx.reply(prodText, { reply_markup: prodKb, parse_mode: 'Markdown' }).catch(() => {
              ctx.reply(prodText, { reply_markup: prodKb });
            });
          }
          return;
        }

        if (data.startsWith('tgstore_msg_')) {
          const msgId = data.replace('tgstore_msg_', '');
          const btn = findStoreButton(storeConfig, msgId);
          if (btn) {
            const msgText = btn.customMessage || btn.text || 'مرحباً بك!';
            const kb = new InlineKeyboard().text('🔙 العودة للقائمة الرئيسية', 'tgstore_main');
            await ctx.reply(msgText, { reply_markup: kb, parse_mode: 'Markdown' }).catch(() => {
              ctx.reply(msgText, { reply_markup: kb });
            });
          }
          return;
        }

        if (data.startsWith('tgstore_buy_')) {
          const buyId = data.replace('tgstore_buy_', '');
          const btn = findStoreButton(storeConfig, buyId);
          const itemTitle = btn ? btn.text : 'منتج رقمي';
          const itemPrice = btn ? (btn.productPrice || '') : '';
          const customerName = ctx.from.first_name || ctx.from.username || 'زبون تيليغرام';
          const timeoutMinutes = parseInt(storeConfig.paymentTimeoutMinutes, 10) || 15;
          const expiresAt = new Date(Date.now() + timeoutMinutes * 60 * 1000).toISOString();
          const refCode = generateOrderReference();

          // 1. Register order in Firestore & retrieve order ID + trackingCode
          let orderId = '';
          let trackingCode = '';
          try {
            const newOrder = await saveOrderToFirestore({
              botId: currentConfig.id,
              ownerUserId: currentConfig.userId,
              platform: 'telegram',
              customerId: String(ctx.from.id),
              customerName: customerName,
              phone: ctx.from.username ? `@${ctx.from.username}` : '',
              address: '',
              product: itemTitle,
              price: itemPrice,
              orderType: 'telegram_store',
              deliveryStatus: 'pending',
              orderStatus: 'pending_payment',
              paymentTimeoutMinutes: timeoutMinutes,
              expiresAt: expiresAt,
              referenceCode: refCode,
              notes: `طلب شراء متجر — مهلة الدفع: ${timeoutMinutes} دقيقة`,
              orderSummary: `طلب شراء ${itemTitle} بقيمة ${itemPrice || 'غير محدد'}`,
            }, 'separate');
            if (newOrder) {
              orderId = newOrder.id;
              trackingCode = newOrder.trackingCode;
            }
          } catch (orderSaveErr) {
            console.warn('[Telegram Store] Buy order save notice:', orderSaveErr.message);
          }

          if (!orderId) {
            orderId = `tmp_${Date.now().toString(36)}`;
          }

          // 2. Broadcast anonymous log to proof channel
          if (storeConfig.logsChannelId) {
            const anonName = (ctx.from.first_name || 'عميل').slice(0, 3) + '***';
            broadcastToLogsChannel(ctx.api, storeConfig.logsChannelId, itemTitle, itemPrice, anonName, currentConfig.businessName);
          }

          // 3. Format message exactly matching the reference style
          const formattedPrice = itemPrice ? `${itemPrice}${itemPrice.includes('$') || itemPrice.includes('دج') ? '' : '$'}` : 'سعر خاص';
          const summaryText =
            `🛒 *طلب جديد*\n\n` +
            `🧾 *الطلب:* #${trackingCode || '53880'}\n` +
            `📦 *المنتج:* ${itemTitle}\n` +
            `🔢 *الكمية:* 1\n` +
            `💰 *المجموع:* ${formattedPrice}\n` +
            `🏷️ *المرجع:* \`${refCode}\`\n` +
            `⏳ *مهلة الدفع:* ${timeoutMinutes} دقيقة\n\n` +
            `💳 *اختر طريقة الدفع:*`;

          const enabledMethods = getStorePaymentMethods(storeConfig).filter(m => m.enabled !== false);
          const payKb = new InlineKeyboard();
          if (enabledMethods.length > 0) {
            enabledMethods.forEach(m => {
              payKb.text(m.name || 'وسيلة دفع', `tgstore_pay_${orderId}_${m.id}`).row();
            });
          } else {
            payKb.text('💳 طرق الدفع المعتمدة', 'tgstore_wallet').row();
          }
          payKb.text('❌ إلغاء', `tgstore_cnl_${orderId}`);

          const banner = storeConfig.bannerUrl ? resolveInputMedia(storeConfig.bannerUrl) : null;
          if (banner) {
            await ctx.replyWithPhoto(banner, {
              caption: summaryText,
              reply_markup: payKb,
              parse_mode: 'Markdown',
            }).catch(async () => {
              await ctx.reply(summaryText, { reply_markup: payKb, parse_mode: 'Markdown' }).catch(() => {
                ctx.reply(summaryText, { reply_markup: payKb });
              });
            });
          } else {
            await ctx.reply(summaryText, { reply_markup: payKb, parse_mode: 'Markdown' }).catch(() => {
              ctx.reply(summaryText, { reply_markup: payKb });
            });
          }
          return;
        }

        // When customer chooses a payment method
        if (data.startsWith('tgstore_pay_')) {
          const raw = data.replace('tgstore_pay_', '');
          const [orderId, ...rest] = raw.split('_');
          const methodId = rest.join('_');

          let orderData = null;
          let orderDocRef = null;
          try {
            const snap = await db.collection('orders').doc(orderId).get();
            if (snap.exists) {
              orderData = snap.data();
              orderDocRef = snap.ref;
            }
          } catch (fetchErr) {
            console.warn('[Telegram Store] Fetch order error:', fetchErr.message);
          }

          if (!orderData) {
            try {
              const qSnap = await db.collection('orders')
                .where('botId', '==', currentConfig.id)
                .where('customerId', '==', String(ctx.from.id))
                .limit(5)
                .get();
              if (qSnap && !qSnap.empty) {
                const sorted = qSnap.docs.slice().sort((a, b) => (b.data().createdAt || '').localeCompare(a.data().createdAt || ''));
                orderData = sorted[0].data();
                orderDocRef = sorted[0].ref;
              }
            } catch {}
          }

          const timeoutMinutes = orderData?.paymentTimeoutMinutes || parseInt(storeConfig.paymentTimeoutMinutes, 10) || 15;
          const expiresAtMs = orderData?.expiresAt ? new Date(orderData.expiresAt).getTime() : 0;
          const remainingMs = expiresAtMs ? (expiresAtMs - Date.now()) : (timeoutMinutes * 60 * 1000);
          const isExpired = orderData?.orderStatus === 'expired' || remainingMs <= 0;

          if (isExpired) {
            if (orderDocRef) {
              await orderDocRef.update({
                orderStatus: 'expired',
                updatedAt: new Date().toISOString(),
              }).catch(() => {});
            }
            const expiredText =
              `⌛ *انتهت مهلة الدفع لهذه الصفقة!*\n` +
              `━━━━━━━━━━━━━━━━━━\n` +
              `لقد انقضت المهلة المحددة (${timeoutMinutes} دقيقة) وتم إغلاق الصفقة مؤقتاً.\n\n` +
              `💡 *إذا كنت قد دفعت:* يرجى الضغط على زر إعادة فتح الصفقة أدناه، أو أرسل صورة الوصل / معرف العملية هنا في المحادثة مباشرة لتأكيد طلبك!\n` +
              `━━━━━━━━━━━━━━━━━━`;

            const expiredKb = new InlineKeyboard()
              .text('🔄 إعادة فتح الصفقة', `tgstore_rop_${orderId}`)
              .row()
              .text('🔙 العودة لقائمة المتجر', 'tgstore_main');

            await ctx.reply(expiredText, { reply_markup: expiredKb, parse_mode: 'Markdown' }).catch(() => {
              ctx.reply(expiredText, { reply_markup: expiredKb });
            });
            return;
          }

          const allMethods = getStorePaymentMethods(storeConfig);
          const selectedMethod = allMethods.find(m => m.id === methodId) || allMethods[0] || {
            name: 'الدفع الإلكتروني',
            details: storeConfig.walletInfo || 'يرجى مراجعة إدارة المتجر',
          };

          const remainingMinutes = Math.max(1, Math.ceil(remainingMs / (60 * 1000)));

          if (orderDocRef) {
            await orderDocRef.update({
              chosenPaymentMethod: selectedMethod.name,
              chosenPaymentId: methodId,
              updatedAt: new Date().toISOString(),
            }).catch(() => {});
          }

          const priceStr = orderData?.price ? `${orderData.price}${orderData.price.includes('$') || orderData.price.includes('دج') ? '' : '$'}` : 'سعر خاص';
          const payText =
            `💳 *تفاصيل الدفع — ${selectedMethod.name}*\n` +
            `━━━━━━━━━━━━━━━━━━\n` +
            `🧾 *الطلب:* #${orderData?.trackingCode || '1001'}\n` +
            `📦 *المنتج:* ${orderData?.product || 'منتج رقمي'}\n` +
            `💰 *المبلغ المطلوب:* ${priceStr}\n` +
            `🏷️ *كود المرجع:* \`${orderData?.referenceCode || 'REF'}\`\n` +
            `━━━━━━━━━━━━━━━━━━\n` +
            `⏳ *مؤقت الدفع المتبقي:* ⏳ *${remainingMinutes} دقيقة متبقية*\n` +
            `⚠️ *تنبيه:* يرجى التحويل قبل انتهاء العداد لتجنب إغلاق الصفقة.\n` +
            `━━━━━━━━━━━━━━━━━━\n\n` +
            `📋 *معلومات التحويل للحساب:*\n` +
            `${selectedMethod.details || 'لا توجد تعليمات محددة'}\n\n` +
            `━━━━━━━━━━━━━━━━━━\n` +
            `🚀 *بعد إتمام التحويل:*\n` +
            `أرسل *صورة الوصل* أو *معرف العملية (Binance Pay ID / TxID)* هنا في المحادثة مباشرة لتأكيد طلبك وتثبيته فوراً!`;

          const payActionKb = new InlineKeyboard()
            .text('🔄 فحص حالة المؤقت والدفع', `tgstore_chk_${orderId}`)
            .row()
            .text('❌ إلغاء الطلب', `tgstore_cnl_${orderId}`);

          await ctx.reply(payText, { reply_markup: payActionKb, parse_mode: 'Markdown' }).catch(() => {
            ctx.reply(payText, { reply_markup: payActionKb });
          });
          return;
        }

        // Check payment timer / status
        if (data.startsWith('tgstore_chk_')) {
          const orderId = data.replace('tgstore_chk_', '');
          let orderData = null;
          let orderDocRef = null;

          if (orderId && !orderId.startsWith('tmp_')) {
            try {
              const snap = await db.collection('orders').doc(orderId).get();
              if (snap.exists) {
                orderData = snap.data();
                orderDocRef = snap.ref;
              }
            } catch (err) {
              console.warn('[Telegram Store] Fetch order by id error:', err.message);
            }
          }

          if (!orderData) {
            try {
              const qSnap = await db.collection('orders')
                .where('botId', '==', currentConfig.id)
                .where('customerId', '==', String(ctx.from.id))
                .limit(5)
                .get();
              if (qSnap && !qSnap.empty) {
                const sorted = qSnap.docs.slice().sort((a, b) => (b.data().createdAt || '').localeCompare(a.data().createdAt || ''));
                orderData = sorted[0].data();
                orderDocRef = sorted[0].ref;
              }
            } catch (err) {
              console.warn('[Telegram Store] Fetch order by customerId error:', err.message);
            }
          }

          const resolvedOrderId = orderDocRef ? orderDocRef.id : orderId;
          const timeoutMinutes = orderData?.paymentTimeoutMinutes || parseInt(storeConfig.paymentTimeoutMinutes, 10) || 15;
          const expiresAtMs = orderData?.expiresAt ? new Date(orderData.expiresAt).getTime() : 0;
          const remainingMs = expiresAtMs ? (expiresAtMs - Date.now()) : 0;
          const isExpired = orderData?.orderStatus === 'expired' || remainingMs <= 0;

          if (isExpired) {
            if (orderDocRef) {
              await orderDocRef.update({ orderStatus: 'expired', updatedAt: new Date().toISOString() }).catch(() => {});
            }
            await ctx.answerCallbackQuery({
              text: '⌛ انتهت مهلة الدفع لهذه الصفقة! يمكنك إعادة فتحها بالزر أدناه.',
              show_alert: true,
            }).catch(() => {});

            const expiredText =
              `⌛ *انتهت مهلة الدفع لهذه الصفقة!*\n` +
              `━━━━━━━━━━━━━━━━━━\n` +
              `لقد انقضت مهلة الـ ${timeoutMinutes} دقيقة المحددة.\n` +
              `إذا كنت قد دفعت، اضغط أدناه لإعادة فتح الصفقة وإرسال إثبات الدفع فوراً:`;

            const expiredKb = new InlineKeyboard()
              .text('🔄 إعادة فتح الصفقة', `tgstore_rop_${resolvedOrderId}`)
              .row()
              .text('🔙 العودة لقائمة المتجر', 'tgstore_main');

            await ctx.reply(expiredText, { reply_markup: expiredKb, parse_mode: 'Markdown' }).catch(() => {
              ctx.reply(expiredText, { reply_markup: expiredKb });
            });
          } else {
            const totalSec = Math.max(0, Math.floor(remainingMs / 1000));
            const mins = Math.floor(totalSec / 60);
            const secs = totalSec % 60;
            const timeStr = mins > 0 ? `${mins} دقيقة و ${secs} ثانية` : `${secs} ثانية`;

            await ctx.answerCallbackQuery({
              text: `⏳ مؤقت الدفع: متبقي ${timeStr}!`,
              show_alert: true,
            }).catch(() => {});

            const statusKb = new InlineKeyboard()
              .text('🔄 فحص حالة المؤقت والدفع', `tgstore_chk_${resolvedOrderId}`)
              .row()
              .text('❌ إلغاء الطلب', `tgstore_cnl_${resolvedOrderId}`);

            const statusMsg =
              `⏳ *فحص مؤقت الدفع للطلب #${orderData?.trackingCode || ''}:*\n` +
              `━━━━━━━━━━━━━━━━━━\n` +
              `⏰ *الوقت المتبقي:* ⏳ *${timeStr}*\n` +
              (orderData?.product ? `📦 *المنتج:* ${orderData.product}\n` : '') +
              (orderData?.price ? `💰 *المبلغ:* ${orderData.price}${orderData.price.includes('$') || orderData.price.includes('دج') ? '' : '$'}\n` : '') +
              `━━━━━━━━━━━━━━━━━━\n` +
              `🚀 يرجى التحويل وإرسال صورة الوصل أو معرف العملية هنا مباشرة لتأكيد طلبك قبل انتهاء الوقت!`;

            await ctx.reply(statusMsg, { reply_markup: statusKb, parse_mode: 'Markdown' }).catch(() => {
              ctx.reply(statusMsg, { reply_markup: statusKb });
            });
          }
          return;
        }

        // Reselect payment method
        if (data.startsWith('tgstore_rsl_')) {
          const orderId = data.replace('tgstore_rsl_', '');
          let orderData = null;
          try {
            const snap = await db.collection('orders').doc(orderId).get();
            if (snap.exists) orderData = snap.data();
          } catch {}

          const enabledMethods = getStorePaymentMethods(storeConfig).filter(m => m.enabled !== false);
          const payKb = new InlineKeyboard();
          if (enabledMethods.length > 0) {
            enabledMethods.forEach(m => {
              payKb.text(m.name || 'وسيلة دفع', `tgstore_pay_${orderId}_${m.id}`).row();
            });
          } else {
            payKb.text('💳 طرق الدفع المعتمدة', 'tgstore_wallet').row();
          }
          payKb.text('❌ إلغاء الطلب', `tgstore_cnl_${orderId}`);

          const reselectText = `💳 *اختر وسيلة الدفع التي تناسبك للطلب #${orderData?.trackingCode || ''}:*`;
          await ctx.reply(reselectText, { reply_markup: payKb, parse_mode: 'Markdown' }).catch(() => {
            ctx.reply(reselectText, { reply_markup: payKb });
          });
          return;
        }

        // Reopen expired deal
        if (data.startsWith('tgstore_rop_')) {
          const orderId = data.replace('tgstore_rop_', '');
          const timeoutMinutes = parseInt(storeConfig.paymentTimeoutMinutes, 10) || 15;
          const newExpiresAt = new Date(Date.now() + timeoutMinutes * 60 * 1000).toISOString();
          let orderData = null;

          try {
            const docRef = db.collection('orders').doc(orderId);
            const snap = await docRef.get();
            if (snap.exists) {
              orderData = snap.data();
              await docRef.update({
                orderStatus: 'pending_payment',
                paymentTimeoutMinutes: timeoutMinutes,
                expiresAt: newExpiresAt,
                updatedAt: new Date().toISOString(),
              });
            }
          } catch (ropErr) {
            console.warn('[Telegram Store] Reopen order notice:', ropErr.message);
          }

          const reopenText =
            `🔄 *تمت إعادة فتح الصفقة بنجاح!*\n` +
            `━━━━━━━━━━━━━━━━━━\n` +
            `🧾 *الطلب:* #${orderData?.trackingCode || ''}\n` +
            `⏳ *المؤقت الجديد:* ${timeoutMinutes} دقيقة\n\n` +
            `اختر وسيلة الدفع أدناه أو أرسل صورة الوصل / معرف العملية هنا في المحادثة مباشرة إذا كنت قد حولت بالفعل 👇`;

          const enabledMethods = getStorePaymentMethods(storeConfig).filter(m => m.enabled !== false);
          const payKb = new InlineKeyboard();
          if (enabledMethods.length > 0) {
            enabledMethods.forEach(m => {
              payKb.text(m.name || 'وسيلة دفع', `tgstore_pay_${orderId}_${m.id}`).row();
            });
          } else {
            payKb.text('💳 طرق الدفع المعتمدة', 'tgstore_wallet').row();
          }
          payKb.text('❌ إلغاء الطلب', `tgstore_cnl_${orderId}`);

          await ctx.reply(reopenText, { reply_markup: payKb, parse_mode: 'Markdown' }).catch(() => {
            ctx.reply(reopenText, { reply_markup: payKb });
          });
          return;
        }

        // Cancel order
        if (data.startsWith('tgstore_cnl_')) {
          const orderId = data.replace('tgstore_cnl_', '');
          try {
            await db.collection('orders').doc(orderId).update({
              orderStatus: 'cancelled',
              updatedAt: new Date().toISOString(),
            });
          } catch {}

          const cancelKb = new InlineKeyboard().text('🔙 العودة لقائمة المتجر', 'tgstore_main');
          const cancelMsg = `❌ *تم إلغاء الطلب بنجاح.*\nيمكنك اختيار أي منتج في أي وقت من قائمة المتجر!`;
          await ctx.reply(cancelMsg, { reply_markup: cancelKb, parse_mode: 'Markdown' }).catch(() => {
            ctx.reply(cancelMsg, { reply_markup: cancelKb });
          });
          return;
        }
      } catch (cbErr) {
        console.error('[Telegram Store] Callback error:', cbErr.message);
      }
    });

    async function runTelegramIncoming(ctx) {
      const isVoice = !!(ctx.message.voice || ctx.message.audio);
      const isPhoto = !!(ctx.message.photo && ctx.message.photo.length > 0);
      const userMessage = (ctx.message.text || ctx.message.caption || '').trim();
      const userId = ctx.from.id;
      const userName = ctx.from.first_name || ctx.from.username || 'زبون تيليغرام';
      const takeoverKey = `${config.id}_${userId}`;

      // Skip empty non-audio / non-photo messages
      if (!userMessage && !isVoice && !isPhoto) {
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

      const displayMessage = userMessage || (isVoice ? '[رسالة صوتية]' : (isPhoto ? '[صورة / وصل دفع]' : ''));

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
      const storeConfig = currentConfig.telegramStore || {};
      const isStoreMode = storeConfig.enabled === true || currentConfig.businessType === 'telegram_store';

      // ═════════════════════════════════════════════════════════════════
      // ─── TELEGRAM STORE MODE (System 2): Pure Deterministic Engine ──
      // 0 LLM Calls — Zero Token Waste — No AI Hallucinations
      // ═════════════════════════════════════════════════════════════════
      if (isStoreMode) {
        // 1. Photo Receipt Detection
        if (isPhoto) {
          let receiptUrl = '';
          try {
            const photos = ctx.message.photo;
            if (photos && photos.length > 0) {
              const highestPhoto = photos[photos.length - 1];
              const fileInfo = await ctx.api.getFile(highestPhoto.file_id).catch(() => null);
              if (fileInfo && fileInfo.file_path) {
                receiptUrl = `https://api.telegram.org/file/bot${currentConfig.telegramToken.trim()}/${fileInfo.file_path}`;
              }
            }
          } catch (photoErr) {
            console.warn('[Telegram Store] Failed to fetch receipt URL:', photoErr.message);
          }

          // Link with latest pending or expired order or create one in Firestore
          let linkedTrackingCode = '';
          let wasExpired = false;
          try {
            const existingOrderSnap = await db.collection('orders')
              .where('botId', '==', currentConfig.id)
              .where('customerId', '==', String(userId))
              .limit(5)
              .get();

            if (existingOrderSnap && !existingOrderSnap.empty) {
              const sorted = existingOrderSnap.docs.slice().sort((a, b) => (b.data().createdAt || '').localeCompare(a.data().createdAt || ''));
              const orderDoc = sorted[0];
              const oData = orderDoc.data();
              linkedTrackingCode = oData.trackingCode || '';
              if (oData.orderStatus === 'expired') wasExpired = true;

              await orderDoc.ref.update({
                receiptUrl: receiptUrl || null,
                proofType: 'photo_receipt',
                hasProof: true,
                deliveryStatus: 'pending',
                orderStatus: 'pending_verification',
                timerStopped: true,
                updatedAt: new Date().toISOString(),
              });
            } else {
              const newOrder = await saveOrderToFirestore({
                botId: currentConfig.id,
                ownerUserId: currentConfig.userId,
                platform: 'telegram',
                customerId: String(userId),
                customerName: userName,
                phone: ctx.from.username ? `@${ctx.from.username}` : '',
                address: '',
                product: 'طلب مباشر (وصل تحويل)',
                price: '',
                orderType: 'telegram_store',
                receiptUrl: receiptUrl || null,
                proofType: 'photo_receipt',
                hasProof: true,
                deliveryStatus: 'pending',
                orderStatus: 'pending_verification',
                timerStopped: true,
                notes: 'أرسل الزبون وصل دفع في المحادثة',
                orderSummary: 'وصل تحويل عبر متجر تيليغرام',
              }, 'separate');
              if (newOrder) linkedTrackingCode = newOrder.trackingCode;
            }
          } catch (linkErr) {
            console.warn('[Telegram Store] Order link error:', linkErr.message);
          }

          const userMsgContent = receiptUrl ? `[وصل دفع]\n${receiptUrl}` : '[صورة / وصل دفع]';
          saveMessage(currentConfig.id, currentConfig.userId, userId, userName, userMsgContent, 'user', 'telegram', userAvatar, receiptUrl);

          const receiptReply =
            `✅ *تم استلام صورة وصل التحويل بنجاح!*\n\n` +
            (linkedTrackingCode ? `🔖 *رقم الطلب الخاص بك:* #${linkedTrackingCode}\n` : '') +
            (wasExpired ? `🔄 *تمت إعادة تنشيط الصفقة تلقائياً وإيقاف العداد!*\n` : `⏳ *تم إيقاف المؤقت وتثبيت الصفقة!*\n`) +
            `🔍 *الحالة:* جاري مراجعة الوصل وبيانات الدفع من طرف المشرفين.\n` +
            `🚀 سيتم تسليم طلبك في أقرب وقت ممكن بعد المراجعة.\n\n` +
            `شكراً لثقتكم واختياركم لنا!`;

          const kb = new InlineKeyboard().text('🔙 العودة لقائمة المتجر', 'tgstore_main');
          await ctx.reply(receiptReply, { reply_markup: kb, parse_mode: 'Markdown' }).catch(() => {
            ctx.reply(receiptReply, { reply_markup: kb });
          });
          saveMessage(currentConfig.id, currentConfig.userId, userId, userName, receiptReply, 'bot');
          incrementMessageCount(currentConfig.id);

          createNotification({
            userId: currentConfig.userId,
            botId: currentConfig.id,
            type: 'order',
            title: `وصل دفع جديد من ${userName}`,
            body: `أرسل الزبون وصل دفع ${linkedTrackingCode ? `للطلب #${linkedTrackingCode}` : ''}. يرجى مراجعته وتسليمه من لوحة التحكم.`,
            meta: { customerId: String(userId) },
          }).catch(() => {});

          console.log(`[Telegram Store] Receipt acknowledged & saved for ${userName} (${userId}) — 0 LLM calls`);
          return;
        }

        // 2. Order Tracking check
        if (userMessage && isTrackingIntent(userMessage)) {
          const explicitCode = extractTrackingCode(userMessage);
          const orders = await findOrdersForTracking(currentConfig.id, userId, explicitCode);
          let trackingReply = '';
          if (orders.length === 1) {
            trackingReply = formatSingleOrderCard(orders[0], 'telegram_store');
          } else if (orders.length > 1) {
            trackingReply = formatMultipleOrdersList(orders, 'telegram_store');
          } else {
            trackingReply = formatNoOrdersFound(explicitCode);
          }
          await ctx.reply(trackingReply, { parse_mode: 'Markdown' }).catch(() => ctx.reply(trackingReply));
          saveMessage(currentConfig.id, currentConfig.userId, userId, userName, trackingReply, 'bot');
          incrementMessageCount(currentConfig.id);
          return;
        }

        // 3. Text Payment Proof Detection (Binance Pay ID / TxID / Numbers / References)
        let hasPendingOrder = false;
        let pendingOrderDoc = null;
        try {
          const snap = await db.collection('orders')
            .where('botId', '==', currentConfig.id)
            .where('customerId', '==', String(userId))
            .limit(5)
            .get();
          if (snap && !snap.empty) {
            const sorted = snap.docs.slice().sort((a, b) => (b.data().createdAt || '').localeCompare(a.data().createdAt || ''));
            const o = sorted[0].data();
            const orderAgeHours = (Date.now() - new Date(o.createdAt).getTime()) / (1000 * 60 * 60);
            if (orderAgeHours < 48 && (o.deliveryStatus === 'pending' || !o.hasProof || o.orderStatus === 'pending_verification' || o.orderStatus === 'pending_payment' || o.orderStatus === 'expired')) {
              hasPendingOrder = true;
              pendingOrderDoc = sorted[0];
            }
          }
        } catch (findErr) {
          console.warn('[Telegram Store] Pending order check error:', findErr.message);
        }

        const cleanNums = userMessage.replace(/[^\d]/g, '');
        const isNumericRef = cleanNums.length >= 5;
        const hasPaymentKeywords = /(binance|txid|tx_id|hash|pay|ccp|barid|baridimob|وصل|تحويل|مرجع|معرف|معرّف|رقم|دفعت|حولت|إثبات|اثبات)/i.test(userMessage);
        const isBriefGreeting = /^(سلام|السلام عليكم|مرحبا|مرحباً|أهلاً|اهلا|الو|صباح الخير|مساء الخير|hi|hello|hey)$/i.test(userMessage.trim());

        const isPaymentProof = !isBriefGreeting && (hasPendingOrder || isNumericRef || hasPaymentKeywords);

        if (isPaymentProof) {
          let linkedTrackingCode = '';
          let wasExpired = false;
          try {
            if (pendingOrderDoc) {
              const oData = pendingOrderDoc.data();
              linkedTrackingCode = oData.trackingCode || '';
              if (oData.orderStatus === 'expired') wasExpired = true;
              await pendingOrderDoc.ref.update({
                paymentReference: userMessage,
                proofType: 'text_reference',
                hasProof: true,
                deliveryStatus: 'pending',
                orderStatus: 'pending_verification',
                timerStopped: true,
                notes: `معرف الدفع / إثبات نصي: ${userMessage}`,
                updatedAt: new Date().toISOString(),
              });
            } else {
              const newOrder = await saveOrderToFirestore({
                botId: currentConfig.id,
                ownerUserId: currentConfig.userId,
                platform: 'telegram',
                customerId: String(userId),
                customerName: userName,
                phone: ctx.from.username ? `@${ctx.from.username}` : '',
                address: '',
                product: 'طلب مباشر (إثبات دفع نصي / بينانس)',
                price: '',
                orderType: 'telegram_store',
                paymentReference: userMessage,
                proofType: 'text_reference',
                hasProof: true,
                deliveryStatus: 'pending',
                orderStatus: 'pending_verification',
                timerStopped: true,
                notes: `معرف العملية / البروف: ${userMessage}`,
                orderSummary: `إثبات دفع نصي: ${userMessage.slice(0, 100)}`,
              }, 'separate');
              if (newOrder) linkedTrackingCode = newOrder.trackingCode;
            }
          } catch (saveErr) {
            console.warn('[Telegram Store] Save text proof error:', saveErr.message);
          }

          const receiptReply =
            `✅ *تم تسجيل وتوثيق إثبات الدفع بنجاح!*\n\n` +
            (linkedTrackingCode ? `🔖 *رقم الطلب الخاص بك:* #${linkedTrackingCode}\n` : '') +
            `📝 *معرف العملية / البروف المسجل:*\n\`${userMessage}\`\n\n` +
            (wasExpired ? `🔄 *تمت إعادة تنشيط الصفقة تلقائياً وإيقاف العداد!*\n` : `⏳ *تم إيقاف المؤقت وتثبيت الصفقة!*\n`) +
            `🔍 *الحالة:* جاري التحقق من المعاملة وبيانات الدفع من طرف المشرفين.\n` +
            `🚀 سيتم تسليم الطلب والبيانات في هذه المحادثة فور المراجعة.\n\n` +
            `شكراً لثقتكم واختياركم لنا!`;

          const kb = new InlineKeyboard().text('🔙 العودة لقائمة المتجر', 'tgstore_main');
          await ctx.reply(receiptReply, { reply_markup: kb, parse_mode: 'Markdown' }).catch(() => {
            ctx.reply(receiptReply, { reply_markup: kb });
          });
          saveMessage(currentConfig.id, currentConfig.userId, userId, userName, receiptReply, 'bot');
          incrementMessageCount(currentConfig.id);

          createNotification({
            userId: currentConfig.userId,
            botId: currentConfig.id,
            type: 'order',
            title: `إثبات دفع نصي (Binance/Ref) من ${userName}`,
            body: `أرسل الزبون معرف الدفع: ${userMessage} ${linkedTrackingCode ? `للطلب #${linkedTrackingCode}` : ''}. يرجى مراجعته وتسليمه من لوحة التحكم.`,
            meta: { customerId: String(userId) },
          }).catch(() => {});

          if (storeConfig.logsChannelId) {
            const anonName = (ctx.from.first_name || 'عميل').slice(0, 3) + '***';
            broadcastToLogsChannel(ctx.api, storeConfig.logsChannelId, 'طلب عبر بينانس / دفع إلكتروني', '', anonName, currentConfig.businessName);
          }

          console.log(`[Telegram Store] Text payment proof registered for ${userName} (${userId}): "${userMessage}" — 0 LLM calls`);
          return;
        }

        // 4. Any other message in Store Mode: Direct to Store Buttons (0 LLM Calls)
        const storePrompt =
          `مرحباً بك في متجر *${currentConfig.businessName || currentConfig.botName}*!\n\n` +
          `• إذا قمت بالتحويل، يرجى إرسال *صورة الوصل* أو *معرف الطلب (Binance Pay ID / CCP Ref)* هنا مباشرة لتأكيد طلبك.\n` +
          `• لتصفح العروض وشراء الباقات أو شحن المحفظة، يرجى استخدام أزرار المتجر أدناه 👇`;

        const keyboard = buildStoreKeyboard(storeConfig);
        await ctx.reply(storePrompt, { reply_markup: keyboard, parse_mode: 'Markdown' }).catch(() => {
          ctx.reply(storePrompt, { reply_markup: keyboard });
        });
        saveMessage(currentConfig.id, currentConfig.userId, userId, userName, storePrompt, 'bot');
        incrementMessageCount(currentConfig.id);
        console.log(`[Telegram Store] Guided user ${userName} (${userId}) to store keyboard — 0 LLM calls`);
        return;
      }

      // If photo in standard bot without caption
      if (isPhoto && !userMessage) {
        const photoReply = 'شكراً لإرسال الصورة! هل يمكنك توضيح استفسارك أو طلبك بخصوصها؟ 🙏';
        await ctx.reply(photoReply);
        saveMessage(currentConfig.id, currentConfig.userId, userId, userName, photoReply, 'bot');
        incrementMessageCount(currentConfig.id);
        return;
      }

      // ─── Fast-Path Tracking Engine (0 LLM Calls) ────────────────
      const trackingEnabled = currentConfig.features
        ? currentConfig.features.orderTracking !== false && currentConfig.features.orders !== false
        : (currentConfig.orderTrackingEnabled !== false);

      if (trackingEnabled && userMessage && isTrackingIntent(userMessage)) {
        const explicitCode = extractTrackingCode(userMessage);
        const orders = await findOrdersForTracking(currentConfig.id, userId, explicitCode);
        let trackingReply = '';

        if (orders.length === 1) {
          trackingReply = formatSingleOrderCard(orders[0], currentConfig.businessType);
        } else if (orders.length > 1) {
          trackingReply = formatMultipleOrdersList(orders, currentConfig.businessType);
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

        // Deterministic Fallback: If AI omitted [LEAD_QUALIFIED] but user provided a valid phone number
        if (!leadFound && !orderFound && userMessage) {
          const detectedPhone = extractPhoneNumber(userMessage);
          if (detectedPhone) {
            console.log(`[Telegram Engine] Deterministic Lead Interceptor caught phone: ${detectedPhone} from ${userName}`);
            saveLeadToFirestore({
              botId: currentConfig.id,
              ownerUserId: currentConfig.userId,
              platform: 'telegram',
              customerId: String(userId),
              customerName: userName || 'عميل محتمل',
              phone: detectedPhone,
              company: '',
              service: currentConfig.businessType === 'booking' ? 'حجز موعد / استشارة' : (currentConfig.businessName || 'طلب خدمة واستفسار'),
              budget: '',
              leadStatus: 'hot',
              notes: userMessage.slice(0, 300),
            }).then(async (savedLead) => {
              if (savedLead && currentConfig && (await getLimits(currentConfig.userId)).sheets) {
                syncToGoogleSheets(currentConfig, {
                  event: 'new_lead',
                  leadId: savedLead.id,
                  customerName: userName || 'عميل محتمل',
                  phone: detectedPhone,
                  company: '',
                  service: currentConfig.businessType === 'booking' ? 'حجز موعد / استشارة' : (currentConfig.businessName || 'طلب خدمة واستفسار'),
                  budget: '',
                  leadStatus: 'hot',
                  notes: userMessage.slice(0, 300),
                  platform: 'telegram',
                  createdAt: new Date().toISOString(),
                }).catch(() => {});
              }
            }).catch(() => {});
          }
        }

        const { cleanReply: finalReplyText, mediaItems, useReplyOnFirst, showcasedNames } = extractProductMedia(replyWithoutTags, currentConfig.products);
        let reply = finalReplyText || rawReply;

        // Multi-product showcase: the photos right below carry every name +
        // price caption — strip any pitch line that re-lists a showcased
        // product so the text stays a short intro (mirrors the WA engine).
        if (mediaItems.length > 1 && showcasedNames.length > 0 && reply) {
          const lows = showcasedNames.map((n) => n.toLowerCase()).filter(Boolean);
          reply = reply
            .split('\n')
            .filter((line) => {
              const low = line.toLowerCase();
              return !lows.some((n) => low.includes(n));
            })
            .join('\n')
            .replace(/\n{2,}/g, '\n')
            .trim();
        }

        if (mediaItems.length > 1 && useReplyOnFirst) {
          // Gallery: multiple images of ONE product -> album, caption on first
          const mediaGroup = mediaItems.map((it, idx) => ({
            type: 'photo',
            media: resolveInputMedia(it.image),
            caption: idx === 0 ? reply : undefined,
            parse_mode: idx === 0 ? 'Markdown' : undefined,
          }));
          await ctx.replyWithMediaGroup(mediaGroup).catch(async (err) => {
            console.warn('[Telegram Engine] replyWithMediaGroup failed, fallback to single photo:', err.message);
            await ctx.replyWithPhoto(resolveInputMedia(mediaItems[0].image), { caption: reply, parse_mode: 'Markdown' }).catch(async (err2) => {
              console.warn('[Telegram Engine] replyWithPhoto fallback failed:', err2.message);
              await ctx.reply(reply, { parse_mode: 'Markdown' }).catch(() => ctx.reply(reply));
            });
          });
        } else if (mediaItems.length > 0) {
          // Visual showcase: pitch text first, then each product photo with
          // its own name + price caption
          if (reply && reply.trim()) {
            await ctx.reply(reply, { parse_mode: 'Markdown' }).catch(async () => {
              await ctx.reply(reply);
            });
            await new Promise(r => setTimeout(r, 400));
          }
          for (const it of mediaItems) {
            await ctx.replyWithPhoto(resolveInputMedia(it.image), { caption: it.caption || undefined }).catch(async (err) => {
              console.warn('[Telegram Engine] showcase photo failed:', err.message);
              await ctx.reply(it.caption || '').catch(() => {});
            });
            await new Promise(r => setTimeout(r, 400));
          }
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
    }

    // Text debounce: merge rapid-fire fragments ("سلام" / "شنو عندكم")
    // into ONE processing call. Voice bypasses the debounce.
    const tgDebounce = new Map();
    const TG_DEBOUNCE_MS = parseInt(process.env.TG_MESSAGE_DEBOUNCE_MS || '4000', 10);
    const TG_MAX_WAIT_MS = parseInt(process.env.TG_MESSAGE_MAX_WAIT_MS || '10000', 10);

    bot.on(['message:text', 'message:voice', 'message:audio', 'message:photo'], async (ctx) => {
      const isVoice = !!(ctx.message.voice || ctx.message.audio);
      const isPhoto = !!(ctx.message.photo && ctx.message.photo.length > 0);
      const text = (ctx.message.text || ctx.message.caption || '').trim();

      if (!isVoice && !isPhoto && text) {
        const key = `${config.id}:${ctx.from.id}`;
        let g = tgDebounce.get(key);
        if (!g) { g = { frags: [], ctx: null, timer: null, firstAt: Date.now() }; tgDebounce.set(key, g); }
        g.frags.push(text);
        g.ctx = ctx;
        const elapsed = Date.now() - g.firstAt;
        const wait = Math.min(TG_DEBOUNCE_MS, Math.max(0, TG_MAX_WAIT_MS - elapsed));
        if (g.timer) clearTimeout(g.timer);
        g.timer = setTimeout(async () => {
          tgDebounce.delete(key);
          if (g.ctx) {
            g.ctx.message.text = g.frags.join('\n');
            await enqueueTelegramTask(config.id, () => runTelegramIncoming(g.ctx)).catch((err) => {
              console.error(`[Telegram Queue] Error processing debounced message for bot ${config.id}:`, err.message);
            });
          }
        }, wait);
        return;
      }

      await enqueueTelegramTask(config.id, () => runTelegramIncoming(ctx)).catch((err) => {
        console.error(`[Telegram Queue] Error processing message for bot ${config.id}:`, err.message);
      });
    });

    bot.catch((err) => {
      console.error(`[Engine] Bot "${config.botName}" error:`, err.message);
    });

    await bot.api.deleteWebhook({ drop_pending_updates: false }).catch(() => {});

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
  clearTelegramQueue(botId);
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

// Plan gates for starting a TG bot: (1) TG slots per plan — counted from
// THIS engine's running bots of the same owner; (2) the one-channel lock —
// a free bot already linked on WhatsApp stays one-channel. Denials log
// once and notify the owner once (never a loop).
async function planGateTgStart(config) {
  try {
    const limits = await getLimits(config.userId);

    if (limits.channelsPerBot === 1 &&
        (config.whatsappStatus === 'connected' || config.whatsappNumber)) {
      const key = 'chan:' + config.id;
      if (!planGateNotified.has(key)) {
        planGateNotified.add(key);
        console.warn(`[Billing] TG start denied for ${config.id} — one-channel lock (free plan), WA already linked.`);
        db.collection('notifications').add({
          userId: config.userId,
          botId: config.id,
          type: 'system',
          title: 'القناة الثانية متاحة في الباقة الاحترافية',
          body: 'بوتك مرتبط على واتساب — إضافة تيليغرام على نفس البوت تتطلب الباقة الاحترافية.',
        }).catch(() => {});
      }
      // Announce the denial on the bot doc so the dashboard can tell the
      // truth (token saved != bot running)
      db.collection('bots').doc(config.id).set(
        { telegramGateDenied: 'القناة الثانية متاحة في الباقة الاحترافية' },
        { merge: true }
      ).catch(() => {});
      return false;
    }

    let sameOwnerRunning = 0;
    for (const [, entry] of activeBots) {
      if (entry.config?.userId === config.userId && entry.config?.id !== config.id) sameOwnerRunning++;
    }
    if (sameOwnerRunning >= limits.maxTGBots) {
      const key = 'slots:' + config.userId;
      if (!planGateNotified.has(key)) {
        planGateNotified.add(key);
        console.warn(`[Billing] TG start denied for ${config.id} — TG slots cap (${limits.maxTGBots}) reached for owner.`);
        db.collection('notifications').add({
          userId: config.userId,
          botId: config.id,
          type: 'system',
          title: 'بلغت حدّ بوتات التيليغرام',
          body: `باقتك تسمح بـ ${limits.maxTGBots} بوتات تيليغرام. رقّ حسابك من صفحة الاشتراكات لمزيد من البوتات.`,
        }).catch(() => {});
      }
      return false;
      db.collection('bots').doc(config.id).set(
        { telegramGateDenied: 'بلغت حدّ بوتات التيليغرام في باقتك' },
        { merge: true }
      ).catch(() => {});
    }
    db.collection('bots').doc(config.id).set(
      { telegramGateDenied: null },
      { merge: true }
    ).catch(() => {});
    return true;
  } catch (e) {
    console.warn('[Billing] TG gate error (allowing start):', e.message);
    return true; // fail-open for availability; WA engine + rules still guard the plan field
  }
}

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
        const isBotActive = config.isActive === true || config.status === 'active' || config.telegramStore?.enabled === true;
        if (isBotActive && !isRunning) {
          // Plan gates BEFORE launch: TG slots per plan + the one-channel
          // lock (a bot already speaking on WhatsApp cannot gain Telegram
          // on the free plan). Async, non-blocking for the snapshot loop.
          planGateTgStart(config).then((allowed) => { if (allowed) startBot(config); });
        } else if (!isBotActive && isRunning) {
          stopBot(config.id);
        } else if (isBotActive && isRunning) {
          // Update config reference
          const entry = activeBots.get(config.id);
          if (entry) entry.config = config;
          // Stale denial cleanup: a running bot proves its gate passed —
          // an old telegramGateDenied (written pre-upgrade) must not haunt
          if (config.telegramGateDenied) {
            db.collection('bots').doc(config.id)
              .set({ telegramGateDenied: null }, { merge: true })
              .catch(() => {});
          }
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
  // Google Sheets is a Pro capability — enforced here, not in the UI
  const sheetLimits = await getLimits(botConfig.userId);
  if (!sheetLimits.sheets) {
    return res.status(403).json({ code: 'PLAN_LIMIT', error: 'مزامنة Google Sheets متاحة في الباقة الاحترافية — رقّ حسابك من صفحة الاشتراكات.' });
  }
  if (webhookUrl) {
    const ssrfError = validateWebhookUrl(webhookUrl);
    if (ssrfError) return res.status(400).json({ error: ssrfError });
  }

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

  // Stock lifecycle: «تم التوصيل» converts the reservation into a permanent
  // decrement; «ملغي/مرتجع» releases it back. Each fires exactly once per
  // order (flags on the order doc survive re-presses).
  if (order && order.product && !order.stockDelivered && deliveryStatus === 'delivered') {
    await adjustProductStock(botId, order.product, 'deliver', order.ownerUserId || order.userId || botConfig.userId).catch(() => {});
    db.collection('orders').doc(orderId).set({ stockDelivered: true }, { merge: true }).catch(() => {});
  }
  if (order && order.product && !order.stockReleased && deliveryStatus === 'cancelled') {
    await adjustProductStock(botId, order.product, 'release', order.ownerUserId || order.userId || botConfig.userId).catch(() => {});
    db.collection('orders').doc(orderId).set({ stockReleased: true }, { merge: true }).catch(() => {});
  }

  if (notifyCustomer && order && order.customerId && !updateResult.alreadyProcessed) {
    try {
      const statusLabel = customerStatusLabel(deliveryStatus, botConfig.businessType);
      const providerName = PROVIDER_NAMES[provider] || provider || '';

      let notifMsg = `*📢 تحديث حالة طلبيتك:*\n\n`;
      notifMsg += `${statusLabel}\n\n`;
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
      notifMsg += `يمكنك كتابة "تتبع" في أي وقت للاستعلام المباشر عن حالة الطلبية.`;

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

      // Fetch recent messages (in-memory filtering avoids composite index requirement)
      const convSnap = await db.collection('conversations')
        .where('botId', '==', botId)
        .limit(200)
        .get();

      if (convSnap.empty) continue;

      const threads = {};
      convSnap.docs.forEach(d => {
        const data = d.data();
        if (data.platform !== 'telegram') return;
        if (!data.createdAt || data.createdAt < maxLookbackDate) return;
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
