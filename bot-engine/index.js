// ═══════════════════════════════════════════════════════════════
// BotForge — Telegram Bot Engine v3 (Powered by Firebase & Gemini)
// Realtime Firestore sync, threaded chat, order extraction,
// human takeover, instant bot lifecycle management
// ═══════════════════════════════════════════════════════════════

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
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

// ─── Firestore Helpers ────────────────────────────────────────

// ownerUserId is stamped on every document so the security rules can
// authorize owner access without a per-document get()
async function saveMessage(botId, ownerUserId, telegramUserId, userName, content, role, platform = 'telegram') {
  try {
    await db.collection('conversations').add({
      botId,
      platform,
      userId: ownerUserId || '',
      telegramUserId: String(telegramUserId),
      customerId: String(telegramUserId),
      userName: userName || 'زبون',
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

async function saveOrderToFirestore(orderData) {
  try {
    const trackingCode = orderData.trackingCode || generateTrackingCode();
    const now = new Date().toISOString();

    const initialHistory = [{
      orderStatus: 'confirmed',
      deliveryStatus: 'pending',
      timestamp: now,
      note: 'تم تسجيل وتأكيد الطلبية بنجاح',
    }];

    const docRef = await db.collection('orders').add({
      ...orderData,
      trackingCode,
      userId: orderData.ownerUserId || '',
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

    console.log(`[Engine] 📦 Order saved in Firestore: ${orderData.customerName} | Code: ${trackingCode} | Product: ${orderData.product}`);
    return { id: docRef.id, trackingCode };
  } catch (e) {
    console.error('[Engine] Save order error:', e.message);
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

// ─── Smart Order Extraction ──────────────────────────────────
const ORDER_TAG = '[ORDER_CONFIRMED]';

function extractAndSaveOrder(botId, ownerUserId, customerId, customerName, rawReply, platform = 'telegram', catalogProducts = []) {
  const tagIndex = rawReply.indexOf(ORDER_TAG);
  if (tagIndex === -1) return { reply: rawReply, orderFound: false };

  const jsonStart = tagIndex + ORDER_TAG.length;
  const jsonStr = rawReply.slice(jsonStart).trim();
  const cleanReply = rawReply.slice(0, tagIndex).trim();

  try {
    const orderData = JSON.parse(jsonStr);
    // AI output is untrusted: whitelist fields and clamp length
    const str = v => (typeof v === 'string' ? v.trim().slice(0, 300) : '');
    const phone = str(orderData?.phone);
    const product = str(orderData?.product);

    // Validate price against official product catalog (F13 Prompt Injection Defense)
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

    if (product || phone) {
      saveOrderToFirestore({
        botId,
        ownerUserId,
        platform,
        customerId: String(customerId),
        customerName: customerName || 'زبون',
        phone,
        address: str(orderData?.address),
        product,
        price: validatedPrice,
        orderSummary: cleanReply.slice(-500),
      });
      return { reply: cleanReply, orderFound: true };
    }
    return { reply: cleanReply, orderFound: false };
  } catch (e) {
    console.error('[Engine] Order JSON parse error:', e.message);
    return { reply: cleanReply, orderFound: false };
  }
}

// ─── Google Gemini AI ─────────────────────────────────────────

async function callGemini(apiKey, model, messages) {
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
  const contents = messages
    .filter(m => m.role !== 'system')
    .map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

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

async function askAI(config, userId, userMessage) {
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
  history.push({ role: 'user', content: userMessage });
  if (history.length > MAX_HISTORY) {
    history.splice(0, history.length - MAX_HISTORY);
  }

  const systemPrompt = buildSystemPrompt(config);
  const messages = [{ role: 'system', content: systemPrompt }, ...history];
  const model = config.aiModel || 'gemini-3.5-flash-lite';
  const apiKey = config.customApiKey || config.geminiApiKey || config.apiKey || GEMINI_API_KEY;

  let reply;
  try {
    reply = await callGemini(apiKey, model, messages);
  } catch (err) {
    // The attempt failed: drop the user message so a retry doesn't carry a phantom turn
    history.pop();
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

    bot.command('start', async (ctx) => {
      const greeting = config.responseStyle === 'formal'
        ? `مرحباً بك. أنا ${config.botName}، مساعدك الآلي من ${config.businessName}. كيف يمكنني مساعدتك اليوم؟`
        : `أهلاً وسهلاً بيك! أنا ${config.botName} من ${config.businessName}. كيفاش نقدر نعاونك اليوم؟ 😊`;
      await ctx.reply(greeting);
    });

    bot.on('message:text', async (ctx) => {
      const userMessage = ctx.message.text;
      const userId = ctx.from.id;
      const userName = ctx.from.first_name || ctx.from.username || 'زبون تيليغرام';
      const takeoverKey = `${config.id}_${userId}`;

      // Save user message immediately
      saveMessage(config.id, config.userId, userId, userName, userMessage, 'user');

      // Check human takeover
      if (humanTakeoverMap.get(takeoverKey)) {
        console.log(`[Engine] Human takeover active for user ${userId} in bot ${config.botName}`);
        return;
      }

      // Retrieve latest live config from activeBots
      const liveEntry = activeBots.get(config.id);
      const currentConfig = (liveEntry && liveEntry.config) ? liveEntry.config : config;

      // ─── Fast-Path Tracking Engine (0 LLM Calls) ────────────────
      const trackingEnabled = currentConfig.features
        ? currentConfig.features.orderTracking !== false && currentConfig.features.orders !== false
        : (currentConfig.orderTrackingEnabled !== false);

      if (trackingEnabled && isTrackingIntent(userMessage)) {
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
          autoOrdersEnabled: currentConfig.autoOrdersTelegram !== false,
        };

        const rawReply = await askAI(aiConfig, userId, userMessage);
        const { reply: replyWithoutOrder, orderFound } = extractAndSaveOrder(
          currentConfig.id,
          currentConfig.userId,
          userId,
          userName,
          rawReply,
          'telegram',
          currentConfig.products
        );
        const { cleanReply: finalReplyText, mediaToSend } = extractProductMedia(replyWithoutOrder, currentConfig.products);
        const reply = finalReplyText || replyWithoutOrder;


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

    bot.start();
    activeBots.set(config.id, { bot, config });
    console.log(`[Engine] ✅ Bot "${config.botName}" is running online.`);
  } catch (err) {
    console.error(`[Engine] Failed to start bot "${config.botName}":`, err.message);
  }
}

async function stopBot(botId) {
  const entry = activeBots.get(botId);
  if (!entry) return;
  try {
    await entry.bot.stop();
    activeBots.delete(botId);
    console.log(`[Engine] 🛑 Bot "${entry.config.botName}" stopped.`);
  } catch (err) {
    console.error(`[Engine] Error stopping bot ${botId}:`, err.message);
    activeBots.delete(botId);
  }
}

// ─── Realtime Firestore Sync ──────────────────────────────────

function listenToBots() {
  console.log('[Engine] Subscribing to Firestore "bots" collection (platform: telegram) in realtime...');

  db.collection('bots').where('platform', '==', 'telegram').onSnapshot((snapshot) => {
    const currentBotIds = new Set();

    snapshot.docs.forEach((docSnap) => {
      const config = { id: docSnap.id, ...docSnap.data() };
      currentBotIds.add(config.id);

      if (config.platform === 'telegram' && config.telegramToken) {
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

// ─── Meta (Facebook Messenger & Instagram Direct) Webhook ───────
// Verification Challenge from Meta
app.get('/api/meta/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  const expectedToken = process.env.META_VERIFY_TOKEN || 'botforge_meta_verify_2026';

  if (mode === 'subscribe' && token === expectedToken) {
    console.log('[Meta Webhook] ✅ Verified webhook challenge successfully');
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

async function sendMetaImage(pageToken, recipientId, mediaUrl) {
  try {
    if (!mediaUrl) return;

    let buffer = null;
    let mimeType = 'image/jpeg';

    if (mediaUrl.startsWith('data:')) {
      const match = mediaUrl.match(/^data:([A-Za-z0-9\/+.-]+);base64,(.+)$/);
      if (match) {
        mimeType = match[1] || 'image/jpeg';
        buffer = Buffer.from(match[2], 'base64');
      }
    } else if (typeof mediaUrl === 'string') {
      try {
        const urlObj = new URL(mediaUrl);
        const filename = path.basename(urlObj.pathname);
        const possiblePaths = [
          path.resolve(__dirname, '../whatsapp-engine/uploads', filename),
          path.resolve(__dirname, 'uploads', filename),
          path.resolve(__dirname, '../uploads', filename)
        ];
        for (const p of possiblePaths) {
          if (fs.existsSync(p)) {
            buffer = await fs.promises.readFile(p);
            mimeType = filename.endsWith('.webp') ? 'image/webp' : (filename.endsWith('.png') ? 'image/png' : 'image/jpeg');
            break;
          }
        }
      } catch (e) {
        // Not a standard URL
      }
    }

    if (buffer) {
      // Local file / Base64 upload via FormData to Meta Graph API
      const blob = new Blob([buffer], { type: mimeType });
      const form = new FormData();
      form.append('recipient', JSON.stringify({ id: recipientId }));
      form.append('message', JSON.stringify({ attachment: { type: 'image', payload: {} } }));
      form.append('filedata', blob, 'product.jpg');

      const res = await fetch(`https://graph.facebook.com/v19.0/me/messages?access_token=${pageToken}`, {
        method: 'POST',
        body: form
      });
      const data = await res.json();
      console.log(`[Meta Webhook] 🖼️ Local image uploaded to Meta (status ${res.status}):`, data);
      return;
    }

    if (mediaUrl.startsWith('https://') && isSafePublicHttpUrl(mediaUrl)) {
      // Public HTTPS URL (SSRF protected)
      const res = await fetch(`https://graph.facebook.com/v19.0/me/messages?access_token=${pageToken}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient: { id: recipientId },
          message: {
            attachment: {
              type: 'image',
              payload: { url: mediaUrl, is_reusable: true }
            }
          }
        })
      });
      const data = await res.json();
      console.log(`[Meta Webhook] 🖼️ HTTPS image sent to Meta (status ${res.status}):`, data);
    }
  } catch (err) {
    console.error('[Meta Webhook] ❌ sendMetaImage error:', err.message);
  }
}

// Incoming Events from Messenger & Instagram
app.post('/api/meta/webhook', async (req, res) => {
  // ─── 0. Verify Meta HMAC-SHA256 Signature (F01 Security Defense) ──
  const metaAppSecret = process.env.META_APP_SECRET;
  if (metaAppSecret) {
    const signature = req.headers['x-hub-signature-256'];
    if (!signature) {
      console.warn('[Meta Webhook] ❌ Missing X-Hub-Signature-256 header');
      return res.status(401).send('Signature required');
    }
    const rawBodyBuffer = req.rawBody || Buffer.from(JSON.stringify(req.body));
    const hmac = crypto.createHmac('sha256', metaAppSecret);
    const digest = 'sha256=' + hmac.update(rawBodyBuffer).digest('hex');

    const sigBuf = Buffer.from(signature);
    const digBuf = Buffer.from(digest);
    if (sigBuf.length !== digBuf.length || !crypto.timingSafeEqual(sigBuf, digBuf)) {
      console.warn('[Meta Webhook] ❌ Invalid X-Hub-Signature-256 signature');
      return res.status(403).send('Invalid signature');
    }
  }

  res.status(200).send('EVENT_RECEIVED');

  try {
    const body = req.body;
    if (body.object !== 'page' && body.object !== 'instagram') return;

    for (const entry of body.entry || []) {
      for (const event of entry.messaging || []) {
        if (event.message?.is_echo) continue;

        const senderId = event.sender?.id;
        const recipientId = event.recipient?.id;
        const platform = body.object === 'instagram' ? 'instagram' : 'facebook';

        if (!senderId) continue;

        const quickReplyPayload = event.message?.quick_reply?.payload;
        const postbackPayload = event.postback?.payload;
        const actionPayload = quickReplyPayload || postbackPayload;
        const text = event.message?.text || event.postback?.title || '';

        console.log(`[Meta Webhook] 📩 Event (${platform}) from ${senderId} -> ${recipientId}: "${text}" (payload: ${actionPayload || 'none'})`);

        // Lookup bot by facebookPageId or instagramUserId
        const fieldName = platform === 'instagram' ? 'instagramUserId' : 'facebookPageId';
        const botQuery = await db.collection('bots')
          .where(fieldName, '==', recipientId)
          .limit(1)
          .get();

        if (botQuery.empty) {
          console.warn(`[Meta Webhook] ⚠️ No bot found with ${fieldName} == ${recipientId}`);
          continue;
        }

        const botDoc = botQuery.docs[0];
        const botConfig = { id: botDoc.id, ...botDoc.data() };
        if (!botConfig.isActive) {
          console.warn(`[Meta Webhook] Bot ${botConfig.id} is inactive`);
          continue;
        }

        const rawToken = platform === 'instagram' ? botConfig.instagramToken : botConfig.facebookPageToken;
        if (!rawToken) {
          console.warn(`[Meta Webhook] No page token configured for bot ${botConfig.id}`);
          continue;
        }

        // Support both encrypted and plain tokens
        const pageToken = decrypt(rawToken) || rawToken;
        const senderName = `زبون ${platform === 'instagram' ? 'إنستغرام' : 'فيسبوك'}`;

        // Save incoming user message
        if (text) {
          await saveMessage(botConfig.id, botConfig.userId, senderId, senderName, text, 'user', platform);
          await incrementMessageCount(botConfig.id);
        }

        // Check if Human Takeover is active
        const takeoverKey = `${botConfig.id}_${senderId}`;
        if (humanTakeoverMap.get(takeoverKey)) {
          console.log(`[Meta Webhook] ⏸️ Human takeover active for ${senderId} — skipping AI response`);
          continue;
        }

        let reply = '';
        let mediaToSend = [];
        let matchedProduct = null;

        // ─── 1. Handle Quick Action Button Clicks ───────────────────────
        if (actionPayload) {
          if (actionPayload.startsWith('BUY_')) {
            const pId = actionPayload.replace('BUY_', '');
            matchedProduct = (botConfig.products || []).find(p => p && (String(p.id) === pId || pId.includes(String(p.id))));
            const pName = matchedProduct ? matchedProduct.name : 'المنتج';
            const pPrice = matchedProduct?.price ? `بسعر ${matchedProduct.price} دج` : '';
            reply = `اختيار رائع خويا! 🌟\nلتأكيد وحجز (${pName}) ${pPrice}، يرجى تزويدي بالمعلومات التالية:\n1. الاسم الكامل\n2. الولاية والبلدية (العنوان بالتفصيل)\n3. رقم الهاتف الشغال\nوسنقوم بتجهيز الشحن فوراً وتأكيد الطلبية معكم!`;
          } else if (actionPayload.startsWith('GALLERY_')) {
            const pId = actionPayload.replace('GALLERY_', '');
            matchedProduct = (botConfig.products || []).find(p => p && (String(p.id) === pId || pId.includes(String(p.id))));
            if (matchedProduct) {
              const allImages = [];
              if (matchedProduct.primaryImage) allImages.push(matchedProduct.primaryImage);
              if (Array.isArray(matchedProduct.secondaryImages)) allImages.push(...matchedProduct.secondaryImages.filter(Boolean));
              else if (Array.isArray(matchedProduct.images)) allImages.push(...matchedProduct.images.filter(Boolean));
              mediaToSend = allImages.slice(0, 5);
              reply = `تفضل خويا، ها هي كامل صور (${matchedProduct.name}) المتوفرة عندنا في المحل 📸`;
            } else {
              reply = `تفضل خويا، ها هي صور المنتج.`;
            }
          } else if (actionPayload === 'TRACK_ORDER') {
            reply = `📦 مرحباً بك في خدمة التتبع المباشر لمتجر (${botConfig.businessName || botConfig.botName})!\nيرجى كتابة رقم هاتفك أو كود التتبع (#DZ-XXXXXX) المسجل للبحث عن طلبيتك فوراً.`;
          } else if (actionPayload === 'HUMAN_SUPPORT') {
            reply = `💬 تم إشعار مسؤول المتجر! سيتواصل معك أحد ممثلينا في أقرب وقت. يمكنك ترك استفسارك وسؤالك هنا في الشات وسنرد عليك مباشرة.`;
            try {
              await db.collection('bots').doc(botConfig.id).collection('conversations').doc(String(senderId)).set({
                needsHumanSupport: true,
                lastSupportRequest: new Date().toISOString(),
                platform
              }, { merge: true });
            } catch (e) {}
          }
        } else if (isTrackingIntent(text) && botConfig.features?.orderTracking !== false) {
          // ─── 2. Fast-Path Order Tracking (0 LLM Calls & Indexed Queries - F08) ───
          let matched = [];
          const customerOrdersSnap = await db.collection('orders')
            .where('botId', '==', botConfig.id)
            .where('customerId', '==', String(senderId))
            .limit(5)
            .get();

          if (!customerOrdersSnap.empty) {
            matched = customerOrdersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
          } else {
            const trackingCodeMatch = text.toUpperCase().match(/DZ-[A-Z0-9]{4,10}/);
            if (trackingCodeMatch) {
              const codeSnap = await db.collection('orders')
                .where('botId', '==', botConfig.id)
                .where('trackingCode', '==', trackingCodeMatch[0])
                .limit(1)
                .get();
              if (!codeSnap.empty) {
                matched = codeSnap.docs.map(d => ({ id: d.id, ...d.data() }));
              }
            }
          }
          
          if (matched.length === 1) {
            reply = formatSingleOrderCard(matched[0]);
          } else if (matched.length > 1) {
            reply = formatMultipleOrdersList(matched);
          } else {
            reply = formatNoOrdersFound(botConfig.businessName);
          }
        } else {
          // ─── 3. Gemini AI Conversational Engine ───────────────────────
          let rawAiReply = '';
          try {
            rawAiReply = await askAI(botConfig, senderId, text);
          } catch (aiErr) {
            console.error('[Meta Webhook] ⚠️ AI call failed:', aiErr.message);
            rawAiReply = `مرحباً بك في ${botConfig.businessName || botConfig.botName || 'متجرنا'}! كيف يمكنني مساعدتك اليوم؟`;
          }

          const processed = extractAndSaveOrder(
            botConfig.id,
            botConfig.userId,
            senderId,
            senderName,
            rawAiReply,
            platform,
            botConfig.products
          );
          const extracted = extractProductMedia(processed.reply, botConfig.products);
          reply = extracted.cleanReply || processed.reply;
          mediaToSend = extracted.mediaToSend || [];

          // Find if any product was referenced
          if (Array.isArray(botConfig.products) && botConfig.products.length > 0) {
            matchedProduct = botConfig.products.find(p => p && reply.includes(p.name));
          }
        }

        // Send Product Media (Binary upload from local disk or URL)
        if (mediaToSend && mediaToSend.length > 0) {
          for (const mediaUrl of mediaToSend) {
            await sendMetaImage(pageToken, senderId, mediaUrl);
          }
        }

        // Clean formatting for Messenger
        const cleanSendReply = (reply || '')
          .replace(/`([^`]+)`/g, '$1')
          .replace(/#([A-Za-z0-9_-]+)/g, '$1')
          .trim();

        // Build Native Quick Action Chips (Interactive Buttons)
        const quickReplies = [];
        if (matchedProduct) {
          quickReplies.push({
            content_type: 'text',
            title: '🛒 حجز وشراء الآن',
            payload: `BUY_${matchedProduct.id}`
          });
          const hasMoreImgs = (matchedProduct.secondaryImages?.length || 0) > 0 || (matchedProduct.images?.length || 0) > 1;
          if (hasMoreImgs) {
            quickReplies.push({
              content_type: 'text',
              title: '📸 صور إضافية',
              payload: `GALLERY_${matchedProduct.id}`
            });
          }
        }
        quickReplies.push({
          content_type: 'text',
          title: '📦 تتبع طلبي',
          payload: 'TRACK_ORDER'
        });
        quickReplies.push({
          content_type: 'text',
          title: '💬 التحدث مع مسؤول',
          payload: 'HUMAN_SUPPORT'
        });

        // Send reply via Meta Graph API with interactive quick replies
        const graphUrl = `https://graph.facebook.com/v19.0/me/messages?access_token=${pageToken}`;
        const sendRes = await fetch(graphUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recipient: { id: senderId },
            message: {
              text: cleanSendReply || 'أهلاً بك! كيف يمكنني مساعدتك؟',
              quick_replies: quickReplies.slice(0, 5)
            }
          })
        });

        const sendData = await sendRes.json();
        console.log(`[Meta Webhook] 📤 Graph API reply sent (status: ${sendRes.status}):`, sendData);

        // Save bot reply
        await saveMessage(botConfig.id, botConfig.userId, senderId, botConfig.botName, cleanSendReply, 'bot', platform);
        await incrementMessageCount(botConfig.id);
      }
    }
  } catch (err) {
    console.error('[Meta Webhook] Error processing event:', err.message);
  }
});

// ─── Security: Firebase ID token verification ──────────────────
app.use('/api', async (req, res, next) => {
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
    engine: 'telegram_and_meta',
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

// ─── Universal Omnichannel Manual Reply (Messenger, IG, Telegram, WhatsApp) ───
app.post('/api/reply', async (req, res) => {
  const { botId, customerId, telegramUserId, message, platform } = req.body;
  const targetUserId = customerId || telegramUserId;

  if (!botId || !targetUserId || !message) {
    return res.status(400).json({ error: 'معطيات ناقصة (botId, customerId, message)' });
  }

  const botConfig = await requireBotAccess(res, req.uid, botId);
  if (!botConfig) return;

  try {
    const targetPlatform = platform || (botConfig.platform === 'telegram' ? 'telegram' : 'facebook');

    // Activate Human Takeover — except for system notifications
    // (delivery receipts, arrival notices) which must NOT silence the AI
    const takeoverKey = `${botId}_${targetUserId}`;
    if (!req.body.system) {
      humanTakeoverMap.set(takeoverKey, true);
    }

    if (targetPlatform === 'facebook' || targetPlatform === 'instagram' || targetPlatform === 'messenger') {
      const rawToken = targetPlatform === 'instagram' ? botConfig.instagramToken : botConfig.facebookPageToken;
      const pageToken = decrypt(rawToken) || rawToken;
      if (!pageToken) {
        return res.status(400).json({ error: 'لا يوجد رمز وصول مفعل لقناة فيسبوك/إنستغرام' });
      }

      const graphUrl = `https://graph.facebook.com/v19.0/me/messages?access_token=${pageToken}`;
      const graphRes = await fetch(graphUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient: { id: targetUserId },
          message: { text: message }
        })
      });
      const graphData = await graphRes.json();
      if (!graphRes.ok || graphData.error) {
        throw new Error(graphData.error?.message || 'فشل الإرسال عبر فيسبوك Graph API');
      }
    } else if (targetPlatform === 'telegram') {
      const entry = activeBots.get(botId);
      if (entry && entry.bot) {
        await entry.bot.api.sendMessage(targetUserId, message);
      } else if (botConfig.telegramToken) {
        const tempBot = new Bot(botConfig.telegramToken);
        await tempBot.api.sendMessage(targetUserId, message);
      } else {
        throw new Error('قناة تيليغرام غير مهيأة');
      }
    }

    // Save message to Firestore
    await saveMessage(botId, botConfig.userId, targetUserId, 'المالك', message, 'owner', targetPlatform);

    res.json({ success: true, takeover: true });
  } catch (err) {
    console.error('[API] Universal reply error:', err.message);
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

      // Dispatch based on platform
      const targetPlatform = order.platform || botConfig.platform || 'telegram';
      if (targetPlatform === 'facebook' || targetPlatform === 'instagram' || targetPlatform === 'messenger') {
        const rawToken = targetPlatform === 'instagram' ? botConfig.instagramToken : botConfig.facebookPageToken;
        const pageToken = decrypt(rawToken) || rawToken;
        if (pageToken) {
          const graphUrl = `https://graph.facebook.com/v19.0/me/messages?access_token=${pageToken}`;
          await fetch(graphUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              recipient: { id: order.customerId },
              message: { text: notifMsg.replace(/\*/g, '') }
            })
          });
          notificationSent = true;
        }
      } else {
        const entry = activeBots.get(botId);
        if (entry && entry.bot) {
          await entry.bot.api.sendMessage(order.customerId, notifMsg, { parse_mode: 'Markdown' });
          notificationSent = true;
        }
      }

      await saveMessage(botId, botConfig.userId, order.customerId, order.customerName || 'الزبون', notifMsg, 'bot', targetPlatform);
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

// ─── Meta OAuth 2.0 (1-Click Facebook & Instagram Connect) ─────

const META_APP_ID = process.env.META_APP_ID || '111222333444555';
const META_APP_SECRET = process.env.META_APP_SECRET || '';

// 1. Generate secure OAuth Authorization URL with HMAC-signed CSRF protection (F04)
app.get('/api/meta/oauth/url', async (req, res) => {
  const { botId, redirectUri } = req.query;
  if (!botId || !redirectUri) {
    return res.status(400).json({ error: 'معطيات ناقصة (botId, redirectUri)' });
  }

  const botConfig = await requireBotAccess(res, req.uid, botId);
  if (!botConfig) return;

  // State encodes uid, botId, timestamp, and cryptographic HMAC signature
  const stateData = { uid: req.uid, botId, ts: Date.now() };
  const stateJson = JSON.stringify(stateData);
  const stateSig = crypto.createHmac('sha256', META_APP_SECRET || 'botforge_oauth_secret').update(stateJson).digest('hex');
  const state = Buffer.from(JSON.stringify({ data: stateJson, sig: stateSig })).toString('base64url');

  const scope = [
    'pages_show_list',
    'pages_messaging',
    'pages_read_engagement',
    'pages_manage_metadata',
    'instagram_basic',
    'instagram_manage_messages',
    'public_profile'
  ].join(',');

  const oauthUrl = `https://www.facebook.com/v19.0/dialog/oauth?client_id=${META_APP_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}&scope=${scope}&response_type=code`;

  res.json({ oauthUrl, state });
});

// 2. Exchange OAuth Code for Long-Lived Token & Fetch Merchant's Pages with Strict CSRF Check (F04)
app.post('/api/meta/oauth/exchange', async (req, res) => {
  const { code, redirectUri, botId, state } = req.body;
  if (!code || !redirectUri || !botId) {
    return res.status(400).json({ error: 'معطيات ناقصة (code, redirectUri, botId)' });
  }

  // Mandatory CSRF state verification (F04)
  if (!state) {
    return res.status(400).json({ error: 'معامل الأمان (CSRF state) مطلوب للتحقق من المصادقة' });
  }

  try {
    const parsedStateWrapper = JSON.parse(Buffer.from(state, 'base64url').toString('utf8'));
    const expectedSig = crypto.createHmac('sha256', META_APP_SECRET || 'botforge_oauth_secret').update(parsedStateWrapper.data || '').digest('hex');

    const sigBuf = Buffer.from(parsedStateWrapper.sig || '');
    const expBuf = Buffer.from(expectedSig);
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return res.status(403).json({ error: 'فشل التحقق من التوقيع الرقمي للـ CSRF State' });
    }

    const decodedState = JSON.parse(parsedStateWrapper.data);
    if (decodedState.uid !== req.uid || decodedState.botId !== botId || (Date.now() - decodedState.ts > 600000)) {
      return res.status(403).json({ error: 'جلسة الربط منتهية الصلاحية أو غير مصرح بها' });
    }

    const botDoc = await db.collection('bots').doc(botId).get();
    if (!botDoc.exists || botDoc.data().userId !== req.uid) {
      return res.status(403).json({ error: 'لا تملك صلاحية الوصول إلى هذا المتجر' });
    }

    if (!META_APP_SECRET) {
      // In dev fallback simulation if no app secret set
      return res.json({
        pages: [
          {
            id: 'page_dev_demo_1',
            name: botDoc.data().businessName || 'صفحة المتجر',
            category: 'E-commerce Store',
            instagramAccount: { id: 'ig_dev_demo_1', username: 'mystore_official' },
            tokenEncrypted: encrypt('EAADevDemoPageToken123456789')
          }
        ]
      });
    }

    // Exchange code for short-lived token
    const tokenUrl = `https://graph.facebook.com/v19.0/oauth/access_token?client_id=${META_APP_ID}&client_secret=${META_APP_SECRET}&redirect_uri=${encodeURIComponent(redirectUri)}&code=${code}`;
    const tokenRes = await fetch(tokenUrl);
    const tokenData = await tokenRes.json();

    if (tokenData.error) {
      return res.status(400).json({ error: tokenData.error.message || 'فشل استبدال رمز فيسبوك' });
    }

    const shortLivedToken = tokenData.access_token;

    // Exchange for Long-Lived User Token (60 days)
    const longLivedUrl = `https://graph.facebook.com/v19.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${META_APP_ID}&client_secret=${META_APP_SECRET}&fb_exchange_token=${shortLivedToken}`;
    const longRes = await fetch(longLivedUrl);
    const longData = await longRes.json();
    const userToken = longData.access_token || shortLivedToken;

    // Fetch user's managed Facebook Pages and linked Instagram accounts
    const pagesUrl = `https://graph.facebook.com/v19.0/me/accounts?fields=id,name,category,access_token,instagram_business_account{id,username,profile_picture_url}&access_token=${userToken}`;
    const pagesRes = await fetch(pagesUrl);
    const pagesData = await pagesRes.json();

    if (pagesData.error) {
      return res.status(400).json({ error: pagesData.error.message || 'تعذر جلب صفحات فيسبوك' });
    }

    // Sanitize and encrypt page tokens before sending to client session
    const pages = (pagesData.data || []).map(p => ({
      id: p.id,
      name: p.name,
      category: p.category,
      instagramAccount: p.instagram_business_account ? {
        id: p.instagram_business_account.id,
        username: p.instagram_business_account.username,
        profilePic: p.instagram_business_account.profile_picture_url,
      } : null,
      tokenEncrypted: encrypt(p.access_token),
    }));

    res.json({ pages });
  } catch (err) {
    console.error('[Meta OAuth] Exchange error:', err.message);
    res.status(500).json({ error: 'خطأ أثناء معالجة تسجيل الدخول بفيسبوك' });
  }
});

// 3. Connect selected Page and auto-subscribe to Webhooks
app.post('/api/meta/oauth/connect-page', async (req, res) => {
  const { botId, pageId, pageName, tokenEncrypted, instagramUserId, instagramUsername } = req.body;
  if (!botId || !pageId || !tokenEncrypted) {
    return res.status(400).json({ error: 'معطيات ناقصة (botId, pageId, tokenEncrypted)' });
  }

  try {
    // Verify ownership
    const botDoc = await db.collection('bots').doc(botId).get();
    if (!botDoc.exists || botDoc.data().userId !== req.uid) {
      return res.status(403).json({ error: 'لا تملك صلاحية الوصول إلى هذا المتجر' });
    }

    const pageAccessToken = decrypt(tokenEncrypted);
    if (!pageAccessToken) {
      return res.status(400).json({ error: 'رمز الصفحة غير صالح' });
    }

    // Auto-subscribe the Facebook Page to our app's Webhooks
    if (META_APP_SECRET) {
      const subscribeUrl = `https://graph.facebook.com/v19.0/${pageId}/subscribed_apps?subscribed_fields=messages,messaging_postbacks,message_deliveries&access_token=${pageAccessToken}`;
      const subRes = await fetch(subscribeUrl, { method: 'POST' });
      const subData = await subRes.json();
      console.log(`[Meta OAuth] Auto-subscribed page ${pageId}:`, subData);
    }

    // Update Bot in Firestore
    await db.collection('bots').doc(botId).update({
      facebookPageId: pageId,
      facebookPageName: pageName || '',
      facebookPageToken: pageAccessToken,
      facebookEnabled: true,
      instagramUserId: instagramUserId || null,
      instagramUsername: instagramUsername || null,
      instagramToken: pageAccessToken,
      instagramEnabled: !!instagramUserId,
      updatedAt: new Date().toISOString(),
    });

    res.json({
      success: true,
      message: 'تم ربط صفحة فيسبوك وحساب إنستغرام بنجاح!',
      pageName,
      hasInstagram: !!instagramUserId,
    });
  } catch (err) {
    console.error('[Meta OAuth] Connect page error:', err.message);
    res.status(500).json({ error: 'فشل ربط الصفحة: ' + err.message });
  }
});

// 4. Disconnect Facebook & Instagram
app.post('/api/meta/oauth/disconnect', async (req, res) => {
  const { botId } = req.body;
  if (!botId) return res.status(400).json({ error: 'معطيات ناقصة (botId)' });

  try {
    const botDoc = await db.collection('bots').doc(botId).get();
    if (!botDoc.exists || botDoc.data().userId !== req.uid) {
      return res.status(403).json({ error: 'لا تملك صلاحية الوصول' });
    }

    const botData = botDoc.data();
    if (botData.facebookPageId && botData.facebookPageToken && META_APP_SECRET) {
      // Unsubscribe from webhooks
      const unsubUrl = `https://graph.facebook.com/v19.0/${botData.facebookPageId}/subscribed_apps?access_token=${botData.facebookPageToken}`;
      await fetch(unsubUrl, { method: 'DELETE' }).catch(() => {});
    }

    await db.collection('bots').doc(botId).update({
      facebookPageId: null,
      facebookPageName: null,
      facebookPageToken: null,
      facebookEnabled: false,
      instagramUserId: null,
      instagramUsername: null,
      instagramToken: null,
      instagramEnabled: false,
      updatedAt: new Date().toISOString(),
    });

    res.json({ success: true, message: 'تم فصل اتصال فيسبوك وإنستغرام بنجاح' });
  } catch (err) {
    res.status(500).json({ error: 'فشل فصل الاتصال: ' + err.message });
  }
});

// Start Express and Firestore Listener
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[Engine] HTTP API running on port ${PORT} (0.0.0.0)`);
  listenToBots();
});
