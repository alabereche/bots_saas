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

function resolveInputMedia(mediaUrl) {
  try {
    if (typeof mediaUrl === 'string') {
      const filename = path.basename(new URL(mediaUrl).pathname);
      const localPath = path.resolve(__dirname, '../whatsapp-engine/uploads', filename);
      if (fs.existsSync(localPath)) {
        return new InputFile(localPath);
      }
      return new InputFile(new URL(mediaUrl));
    }
  } catch (e) {
    console.warn('[Telegram Engine] resolveInputMedia warning:', e.message);
  }
  return mediaUrl;
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

// Idempotent Delivery Status Update
async function updateOrderDeliveryStatus(orderId, newDeliveryStatus, providerInfo = {}, eventId = null) {
  if (!orderId) return { success: false, reason: 'Missing orderId' };
  try {
    const orderRef = db.collection('orders').doc(orderId);
    const snap = await orderRef.get();
    if (!snap.exists) return { success: false, reason: 'Order not found' };

    const data = snap.data();
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

function extractAndSaveOrder(botId, ownerUserId, customerId, customerName, rawReply) {
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
    if (product || phone) {
      saveOrderToFirestore({
        botId,
        ownerUserId,
        platform: 'telegram',
        customerId: String(customerId),
        customerName: customerName || 'زبون',
        phone,
        address: str(orderData?.address),
        product,
        price: str(orderData?.price),
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
  const model = config.aiModel || 'gemini-2.5-flash';

  let reply;
  try {
    reply = await callGemini(GEMINI_API_KEY, model, messages);
  } catch (err) {
    // The attempt failed: drop the user message so a retry doesn't
    // carry a phantom turn
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
  let cleanReply = rawReply;
  let singleProductId = null;
  let galleryProductId = null;

  const singleIdx = cleanReply.indexOf(SHOW_PRODUCT_TAG);
  if (singleIdx !== -1) {
    const endIdx = cleanReply.indexOf(']', singleIdx);
    if (endIdx !== -1) {
      singleProductId = cleanReply.slice(singleIdx + SHOW_PRODUCT_TAG.length, endIdx).trim();
      cleanReply = cleanReply.slice(0, singleIdx) + cleanReply.slice(endIdx + 1);
    }
  }

  const galleryIdx = cleanReply.indexOf(SHOW_GALLERY_TAG);
  if (galleryIdx !== -1) {
    const endIdx = cleanReply.indexOf(']', galleryIdx);
    if (endIdx !== -1) {
      galleryProductId = cleanReply.slice(galleryIdx + SHOW_GALLERY_TAG.length, endIdx).trim();
      cleanReply = cleanReply.slice(0, galleryIdx) + cleanReply.slice(endIdx + 1);
    }
  }

  cleanReply = cleanReply.trim();

  let mediaToSend = [];
  const targetId = galleryProductId || singleProductId;

  if (targetId && Array.isArray(productsList)) {
    const product = productsList.find(p => p && String(p.id).trim() === targetId);
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
      } else if (singleProductId) {
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
        const { reply: replyWithoutOrder, orderFound } = extractAndSaveOrder(currentConfig.id, currentConfig.userId, userId, userName, rawReply);
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
  console.log('[Engine] Subscribing to Firestore "bots" collection in realtime...');

  db.collection('bots').onSnapshot((snapshot) => {
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

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '1mb' }));

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

// Incoming Events from Messenger & Instagram
app.post('/api/meta/webhook', async (req, res) => {
  res.status(200).send('EVENT_RECEIVED');

  try {
    const body = req.body;
    if (body.object !== 'page' && body.object !== 'instagram') return;

    for (const entry of body.entry || []) {
      for (const event of entry.messaging || []) {
        if (!event.message || event.message.is_echo) continue;

        const senderId = event.sender?.id;
        const recipientId = event.recipient?.id;
        const text = event.message.text || '';
        const platform = body.object === 'instagram' ? 'instagram' : 'facebook';

        console.log(`[Meta Webhook] 📩 Received ${platform} message from sender ${senderId} to page/account ${recipientId}: "${text}"`);

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

        // Save incoming user message
        const senderName = `زبون ${platform === 'instagram' ? 'إنستغرام' : 'فيسبوك'}`;
        await saveMessage(botConfig.id, botConfig.userId, senderId, senderName, text, 'user', platform);
        await incrementMessageCount(botConfig.id);

        // Check Fast-path tracking intent (0 LLM Calls)
        let reply = '';
        if (isTrackingIntent(text) && botConfig.features?.orderTracking !== false) {
          const snap = await db.collection('orders').where('botId', '==', botConfig.id).get();
          const allOrders = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          const matched = allOrders.filter(o => o.customerId === senderId || (o.trackingCode && text.toUpperCase().includes(o.trackingCode)));
          
          if (matched.length === 1) {
            reply = formatSingleOrderCard(matched[0]);
          } else if (matched.length > 1) {
            reply = formatMultipleOrdersList(matched);
          } else {
            reply = formatNoOrdersFound(botConfig.businessName);
          }
        } else {
          // Generate AI reply with Gemini
          const prompt = buildSystemPrompt(botConfig);
          const history = [{ role: 'user', content: text }];
          const messages = [{ role: 'system', content: prompt }, ...history];
          const apiKey = botConfig.customApiKey || GEMINI_API_KEY;
          const rawAiReply = await callGemini(apiKey, botConfig.aiModel || 'gemini-3.5-flash-lite', messages);
          const processed = processOrderTag(rawAiReply, botConfig.id, botConfig.userId, senderId, senderName);
          reply = processed.reply;
        }

        // Send reply via Meta Graph API
        const graphUrl = `https://graph.facebook.com/v19.0/me/messages?access_token=${pageToken}`;
        const sendRes = await fetch(graphUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recipient: { id: senderId },
            message: { text: reply }
          })
        });

        const sendData = await sendRes.json();
        console.log(`[Meta Webhook] 📤 Graph API reply sent (status: ${sendRes.status}):`, sendData);

        // Save bot reply
        await saveMessage(botConfig.id, botConfig.userId, senderId, botConfig.botName, reply, 'bot', platform);
        await incrementMessageCount(botConfig.id);
      }
    }
  } catch (err) {
    console.error('[Meta Webhook] Error processing event:', err.message);
  }
});

// ─── Security: Firebase ID token verification ──────────────────
// The dashboard signs in with Firebase Auth and sends its ID token;
// the engine verifies the token and checks the caller owns the bot.
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
    engine: 'telegram',
    activeBots: activeBots.size,
    uptime: process.uptime(),
  });
});

// Ownership guard: the authenticated user must own this running bot
function requireBotAccess(res, uid, entry) {
  if (!entry) {
    res.status(404).json({ error: 'البوت غير مشغل حالياً' });
    return false;
  }
  if (!entry.config.userId || entry.config.userId !== uid) {
    res.status(403).json({ error: 'لا تملك صلاحية الوصول إلى هذا البوت' });
    return false;
  }
  return true;
}

// Owner manual reply via dashboard
app.post('/api/reply', async (req, res) => {
  const { botId, telegramUserId, message } = req.body;
  if (!botId || !telegramUserId || !message) {
    return res.status(400).json({ error: 'معطيات ناقصة (botId, telegramUserId, message)' });
  }

  const entry = activeBots.get(botId);
  if (!requireBotAccess(res, req.uid, entry)) return;

  try {
    const takeoverKey = `${botId}_${telegramUserId}`;
    humanTakeoverMap.set(takeoverKey, true);

    await entry.bot.api.sendMessage(telegramUserId, message);
    await saveMessage(botId, entry.config.userId, telegramUserId, 'المالك', message, 'owner');

    res.json({ success: true, takeover: true });
  } catch (err) {
    console.error('[API] Reply error:', err.message);
    res.status(500).json({ error: 'فشل إرسال الرسالة — يرجى المحاولة لاحقاً' });
  }
});

// Human takeover toggle
app.post('/api/takeover', async (req, res) => {
  const { botId, telegramUserId, enabled } = req.body;
  if (!botId || !telegramUserId) {
    return res.status(400).json({ error: 'معطيات ناقصة (botId, telegramUserId)' });
  }
  const entry = activeBots.get(botId);
  if (!requireBotAccess(res, req.uid, entry)) return;
  const key = `${botId}_${telegramUserId}`;
  humanTakeoverMap.set(key, !!enabled);
  res.json({ success: true, takeover: !!enabled });
});

// ─── Order Tracking & Delivery Management ─────────────────────

// POST /api/orders/:id/delivery-status — Update delivery status and send idempotent notification
app.post('/api/orders/:id/delivery-status', async (req, res) => {
  const orderId = req.params.id;
  const { botId, deliveryStatus, provider, trackingNumber, notifyCustomer } = req.body;

  if (!orderId || !botId || !deliveryStatus) {
    return res.status(400).json({ error: 'معطيات ناقصة (orderId, botId, deliveryStatus)' });
  }

  const entry = activeBots.get(botId);
  if (!requireBotAccess(res, req.uid, entry)) return;

  const eventId = `evt_${orderId}_${deliveryStatus}_${Date.now()}`;
  const updateResult = await updateOrderDeliveryStatus(
    orderId,
    deliveryStatus,
    { provider, trackingNumber },
    eventId
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
      notifMsg += `\n*كود التتبع الخاص بك (لنسخه واستخدامه مباشرة):*\n`;
      notifMsg += `\`${order.trackingCode || 'DZ-XXXXXX'}\`\n\n`;
      notifMsg += `يمكنك كتابة "تتبع" في أي وقت للاستعلام المباشر عن حالة الطرد.`;

      await entry.bot.api.sendMessage(order.customerId, notifMsg, { parse_mode: 'Markdown' });
      notificationSent = true;

      await saveMessage(botId, entry.config.userId, order.customerId, order.customerName || 'الزبون', notifMsg, 'bot');
    } catch (sendErr) {
      console.warn(`[Telegram API] Notification send failed for customer ${order.customerId}:`, sendErr.message);
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

// 1. Generate secure OAuth Authorization URL with CSRF protection
app.get('/api/meta/oauth/url', async (req, res) => {
  const { botId, redirectUri } = req.query;
  if (!botId || !redirectUri) {
    return res.status(400).json({ error: 'معطيات ناقصة (botId, redirectUri)' });
  }

  // Verify ownership
  const botDoc = await db.collection('bots').doc(botId).get();
  if (!botDoc.exists || botDoc.data().userId !== req.uid) {
    return res.status(403).json({ error: 'لا تملك صلاحية الوصول إلى هذا المتجر' });
  }

  // State encodes uid, botId, timestamp, and signature to prevent CSRF
  const statePayload = { uid: req.uid, botId, ts: Date.now() };
  const state = Buffer.from(JSON.stringify(statePayload)).toString('base64url');

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

// 2. Exchange OAuth Code for Long-Lived Token & Fetch Merchant's Pages
app.post('/api/meta/oauth/exchange', async (req, res) => {
  const { code, redirectUri, botId, state } = req.body;
  if (!code || !redirectUri || !botId) {
    return res.status(400).json({ error: 'معطيات ناقصة (code, redirectUri, botId)' });
  }

  try {
    // Verify CSRF state
    if (state) {
      const decodedState = JSON.parse(Buffer.from(state, 'base64url').toString('utf8'));
      if (decodedState.uid !== req.uid || decodedState.botId !== botId) {
        return res.status(403).json({ error: 'فشل التحقق الأمني من الـ CSRF State' });
      }
    }

    // Verify ownership
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
