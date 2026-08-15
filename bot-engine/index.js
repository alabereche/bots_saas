// ═══════════════════════════════════════════════════════════════
// BotForge — Telegram Bot Engine v3 (Powered by Firebase & Gemini)
// Realtime Firestore sync, threaded chat, order extraction,
// human takeover, instant bot lifecycle management
// ═══════════════════════════════════════════════════════════════

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { Bot } from 'grammy';
import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  addDoc,
  updateDoc,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import { buildSystemPrompt } from './prompt-builder.js';

const PORT = process.env.PORT || 3002;
const API_SECRET_KEY = process.env.API_KEY || 'botforge_secret_key_2026';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'AIzaSyAnTqZ5upTb05CEapy8sGTMyiWDbTlb7JQ';

// ─── Firebase Initialization ──────────────────────────────────
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY || "AIzaSyAB6AS2qy2e9iAgG4RMIERDmLXCvs2WQEU",
  authDomain: process.env.FIREBASE_AUTH_DOMAIN || "bots-saas-c7190.firebaseapp.com",
  projectId: process.env.FIREBASE_PROJECT_ID || "bots-saas-c7190",
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "bots-saas-c7190.firebasestorage.app",
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || "99967470267",
  appId: process.env.FIREBASE_APP_ID || "1:99967470267:web:8e75a4c7f90d460407f79e",
};

const app_fb = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app_fb);

// Active running bot instances: botId -> { bot, config }
const activeBots = new Map();

// Human takeover tracker: "botId_userId" -> true
const humanTakeoverMap = new Map();

// Conversation history buffer: "botId_userId" -> array of messages
const conversationHistory = new Map();
const MAX_HISTORY = 20;

// ─── Firestore Helpers ────────────────────────────────────────

async function saveMessage(botId, telegramUserId, userName, content, role) {
  try {
    await addDoc(collection(db, 'conversations'), {
      botId,
      platform: 'telegram',
      telegramUserId: String(telegramUserId),
      userName: userName || 'زبون تيليغرام',
      content,
      role, // 'user' | 'bot' | 'owner'
      createdAt: new Date().toISOString(),
      timestamp: serverTimestamp(),
    });
  } catch (e) {
    console.error('[Engine] Save message error:', e.message);
  }
}

async function incrementMessageCount(botId, currentCount = 0) {
  try {
    const botRef = doc(db, 'bots', botId);
    await updateDoc(botRef, {
      messagesCount: (currentCount || 0) + 1,
      lastActiveAt: new Date().toISOString(),
    });
  } catch (e) {
    console.error('[Engine] Increment count error:', e.message);
  }
}

async function saveOrderToFirestore(orderData) {
  try {
    await addDoc(collection(db, 'orders'), {
      ...orderData,
      status: 'new',
      createdAt: new Date().toISOString(),
      timestamp: serverTimestamp(),
    });
    console.log(`[Engine] 📦 Order saved in Firestore: ${orderData.customerName} - ${orderData.product}`);
  } catch (e) {
    console.error('[Engine] Save order error:', e.message);
  }
}

// ─── Smart Order Extraction ──────────────────────────────────
const ORDER_TAG = '[ORDER_CONFIRMED]';

function extractAndSaveOrder(botId, customerId, customerName, rawReply) {
  const tagIndex = rawReply.indexOf(ORDER_TAG);
  if (tagIndex === -1) return { reply: rawReply, orderFound: false };

  const jsonStart = tagIndex + ORDER_TAG.length;
  const jsonStr = rawReply.slice(jsonStart).trim();
  const cleanReply = rawReply.slice(0, tagIndex).trim();

  try {
    const orderData = JSON.parse(jsonStr);
    saveOrderToFirestore({
      botId,
      platform: 'telegram',
      customerId: String(customerId),
      customerName: customerName || 'زبون',
      phone: orderData.phone || '',
      address: orderData.address || '',
      product: orderData.product || '',
      price: orderData.price || '',
      orderSummary: cleanReply.slice(-500),
    });
    return { reply: cleanReply, orderFound: true };
  } catch (e) {
    console.error('[Engine] Order JSON parse error:', e.message);
    return { reply: cleanReply, orderFound: false };
  }
}

// ─── Google Gemini AI ─────────────────────────────────────────

async function callGemini(apiKey, model, messages) {
  const geminiModel = model || 'gemini-2.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${apiKey}`;
  const systemInstruction = messages.find(m => m.role === 'system')?.content || '';
  const contents = messages
    .filter(m => m.role !== 'system')
    .map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined,
      contents,
      generationConfig: { maxOutputTokens: 1024, temperature: 0.7 },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini ${res.status}: ${err}`);
  }
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
}

async function askAI(config, userId, userMessage) {
  const historyKey = `${config.id}_${userId}`;
  if (!conversationHistory.has(historyKey)) {
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

  let reply = await callGemini(GEMINI_API_KEY, model, messages);
  if (!reply) reply = 'عذراً، لم أتمكن من الرد. يرجى المحاولة مرة أخرى.';
  history.push({ role: 'assistant', content: reply });
  return reply;
}

// ─── Start / Stop Grammy Bot ──────────────────────────────────

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
      saveMessage(config.id, userId, userName, userMessage, 'user');

      // Check human takeover
      if (humanTakeoverMap.get(takeoverKey)) {
        console.log(`[Engine] Human takeover active for user ${userId} in bot ${config.botName}`);
        return;
      }

      try {
        await ctx.replyWithChatAction('typing');

        const aiConfig = {
          ...config,
          autoOrdersEnabled: config.autoOrdersTelegram !== false,
        };

        const rawReply = await askAI(aiConfig, userId, userMessage);
        const { reply, orderFound } = extractAndSaveOrder(config.id, userId, userName, rawReply);

        await ctx.reply(reply, { parse_mode: 'Markdown' }).catch(async () => {
          await ctx.reply(reply);
        });

        // Save bot reply
        saveMessage(config.id, userId, userName, reply, 'bot');
        incrementMessageCount(config.id, config.messagesCount || 0);

        // Detect transfer to owner request
        const transferPhrases = ['سأحولك', 'سأحيلك', 'سأوصلك', 'يرجى الانتظار', 'صاحب المحل', 'صاحب المشروع'];
        if (transferPhrases.some(p => reply.includes(p))) {
          humanTakeoverMap.set(takeoverKey, true);
          console.log(`[Engine] Auto-takeover ON for user ${userId}`);
        }

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
  const botsCol = collection(db, 'bots');

  onSnapshot(botsCol, (snapshot) => {
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

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    engine: 'telegram',
    activeBots: activeBots.size,
    uptime: process.uptime(),
  });
});

// Owner manual reply via dashboard
app.post('/api/reply', async (req, res) => {
  const { botId, telegramUserId, message } = req.body;
  if (!botId || !telegramUserId || !message) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  const entry = activeBots.get(botId);
  if (!entry) {
    return res.status(404).json({ error: 'Bot is not running or inactive' });
  }

  try {
    const takeoverKey = `${botId}_${telegramUserId}`;
    humanTakeoverMap.set(takeoverKey, true);

    await entry.bot.api.sendMessage(telegramUserId, message);
    await saveMessage(botId, telegramUserId, 'المالك', message, 'owner');

    res.json({ success: true, takeover: true });
  } catch (err) {
    console.error('[API] Reply error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Human takeover toggle
app.post('/api/takeover', (req, res) => {
  const { botId, telegramUserId, enabled } = req.body;
  if (!botId || !telegramUserId) {
    return res.status(400).json({ error: 'Missing parameters' });
  }
  const key = `${botId}_${telegramUserId}`;
  humanTakeoverMap.set(key, !!enabled);
  res.json({ success: true, takeover: !!enabled });
});

// Start Express and Firestore Listener
app.listen(PORT, () => {
  console.log(`[Engine] HTTP API running on port ${PORT}`);
  listenToBots();
});
