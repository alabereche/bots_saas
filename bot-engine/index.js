// ═══════════════════════════════════════════════════════════════
// BotForge — Bot Engine v2
// Threaded conversations, owner reply, order detection,
// human takeover, multi-provider AI
// ═══════════════════════════════════════════════════════════════

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { Bot } from 'grammy';
import { buildSystemPrompt } from './prompt-builder.js';

const API = process.env.NEXCLOUD_URL || 'https://nexcloud-production.up.railway.app/api/v1';
const KEY = process.env.NEXCLOUD_KEY;
const PORT = process.env.PORT || 3002;

// Store active bot instances: botDocId -> { bot, config }
const activeBots = new Map();

// Track human takeover per user: "botId_userId" -> true
const humanTakeoverMap = new Map();

// ─── NexCloud Helpers ─────────────────────────────────────────
async function nex(method, path, body) {
  const headers = { 'x-api-key': KEY, 'Content-Type': 'application/json' };
  const opt = { method, headers };
  if (body) opt.body = JSON.stringify(body);
  const res = await fetch(API + path, opt);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'HTTP ' + res.status);
  return data;
}

async function getAllBots() {
  const res = await nex('GET', '/database/ext/bots/documents?page=1&limit=100');
  return (res.documents || []).map(d => ({ id: d.id, ...d.data }));
}

async function updateBotStatus(botId, isActive) {
  await nex('PATCH', '/database/ext/bots/documents/' + botId, {
    data: { isActive },
    merge: true,
  });
}

// ─── Message Storage (Threaded) ──────────────────────────────
async function saveMessage(botId, telegramUserId, userName, content, role) {
  await nex('POST', '/database/ext/conversations/documents', {
    data: {
      botId,
      telegramUserId: String(telegramUserId),
      userName: userName || 'زبون',
      content,
      role, // 'user' | 'bot' | 'owner'
      createdAt: new Date().toISOString(),
    },
  });
}

async function incrementMessageCount(botId) {
  try {
    const res = await nex('GET', '/database/ext/bots/documents/' + botId);
    const current = res.document?.data?.messagesCount || 0;
    await nex('PATCH', '/database/ext/bots/documents/' + botId, {
      data: { messagesCount: current + 1 },
      merge: true,
    });
  } catch (e) {
    console.error('[Engine] Failed to increment message count:', e.message);
  }
}

// ─── Smart Order Extraction ──────────────────────────────────
// Parses [ORDER_CONFIRMED]{json} from AI reply, saves order, returns cleaned reply
const ORDER_TAG = '[ORDER_CONFIRMED]';

function extractAndSaveOrder(botId, platform, customerId, customerName, rawReply) {
  const tagIndex = rawReply.indexOf(ORDER_TAG);
  if (tagIndex === -1) return { reply: rawReply, orderFound: false };

  // Extract the JSON part after the tag
  const jsonStart = tagIndex + ORDER_TAG.length;
  const jsonStr = rawReply.slice(jsonStart).trim();
  
  // Clean the reply — remove the hidden tag line from what the customer sees
  const cleanReply = rawReply.slice(0, tagIndex).trim();

  try {
    const orderData = JSON.parse(jsonStr);
    
    // Save order to database (non-blocking)
    nex('POST', '/database/ext/orders/documents', {
      data: {
        botId,
        platform,
        customerId: String(customerId),
        customerName: customerName || 'زبون',
        phone: orderData.phone || '',
        address: orderData.address || '',
        product: orderData.product || '',
        price: orderData.price || '',
        orderSummary: cleanReply.slice(-500),
        status: 'new',
        createdAt: new Date().toISOString(),
      },
    }).then(() => {
      console.log(`[Engine] ✅ Order saved: ${customerName} — ${orderData.product} (${platform})`);
    }).catch(e => {
      console.error('[Engine] Failed to save order:', e.message);
    });

    return { reply: cleanReply, orderFound: true };
  } catch (e) {
    console.error('[Engine] Failed to parse order JSON:', e.message);
    return { reply: cleanReply, orderFound: false };
  }
}

// ─── Multi-Provider AI ────────────────────────────────────────
const conversationHistory = new Map();
const MAX_HISTORY = 20;

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

// Hardcoded Gemini API key — used for all bots
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'AIzaSyAnTqZ5upTb05CEapy8sGTMyiWDbTlb7JQ';

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
  let reply = null;

  try {
    reply = await callGemini(GEMINI_API_KEY, model, messages);
  } catch (err) {
    console.error(`[Engine] Gemini call failed: ${err.message}`);
    throw err;
  }

  if (!reply) reply = 'عذراً، لم أتمكن من المعالجة.';
  history.push({ role: 'assistant', content: reply });
  return reply;
}

// ─── Start a Single Bot ───────────────────────────────────────
async function startBot(config) {
  if (activeBots.has(config.id)) return;
  if (!config.telegramToken) return;

  try {
    const bot = new Bot(config.telegramToken);

    bot.command('start', async (ctx) => {
      const greeting = config.responseStyle === 'formal'
        ? `مرحباً بك. أنا ${config.botName}، مساعدك الآلي من ${config.businessName}. كيف يمكنني مساعدتك؟`
        : `أهلاً وسهلاً! أنا ${config.botName} مساعدك من ${config.businessName}. كيف اقدر اساعدك؟`;
      await ctx.reply(greeting);
    });

    bot.on('message:text', async (ctx) => {
      const userMessage = ctx.message.text;
      const userId = ctx.from.id;
      const userName = ctx.from.first_name || ctx.from.username || '';
      const takeoverKey = `${config.id}_${userId}`;

      // Save user message
      saveMessage(config.id, userId, userName, userMessage, 'user').catch(() => {});

      // Check human takeover — if owner is handling, don't auto-reply
      if (humanTakeoverMap.get(takeoverKey)) {
        console.log(`[Engine] Skipping AI reply for user ${userId} — human takeover active`);
        return;
      }

      try {
        await ctx.replyWithChatAction('typing');
        
        // Build config with auto-orders flag
        const aiConfig = {
          ...config,
          autoOrdersEnabled: config.autoOrdersTelegram !== false, // enabled by default
        };
        const rawReply = await askAI(aiConfig, userId, userMessage);

        // Extract order if present and clean the reply
        const { reply, orderFound } = extractAndSaveOrder(
          config.id, 'telegram', userId, userName, rawReply
        );

        await ctx.reply(reply, { parse_mode: 'Markdown' }).catch(async () => {
          await ctx.reply(reply);
        });

        // Save bot reply (cleaned version)
        saveMessage(config.id, userId, userName, reply, 'bot').catch(() => {});
        incrementMessageCount(config.id).catch(() => {});

        if (orderFound) {
          console.log(`[Engine] 📦 Order confirmed by ${userName} in Telegram`);
        }

        // Auto-detect transfer to owner request
        const transferPhrases = ['سأحولك', 'سأحيلك', 'سأوصلك', 'يرجى الانتظار', 'صاحب المحل'];
        const isTransfer = transferPhrases.some(p => reply.includes(p));
        if (isTransfer) {
          humanTakeoverMap.set(takeoverKey, true);
          console.log(`[Engine] Auto-takeover ON for user ${userId} — transfer detected in AI reply`);
        }

      } catch (err) {
        console.error(`[Engine] Error in bot "${config.botName}":`, err.message);
        await ctx.reply('عذراً، حدث خطأ أثناء المعالجة. حاول مرة أخرى.');
      }
    });

    bot.on('message', async (ctx) => {
      if (ctx.message.text) return;
      await ctx.reply('عذراً، حالياً أستطيع الرد على الرسائل النصية فقط.');
    });

    bot.catch((err) => {
      console.error(`[Engine] Bot "${config.botName}" error:`, err.message);
    });

    bot.start();
    activeBots.set(config.id, { bot, config });
    await updateBotStatus(config.id, true);
    console.log(`[Engine] Bot "${config.botName}" started successfully.`);
  } catch (err) {
    console.error(`[Engine] Failed to start bot "${config.botName}":`, err.message);
  }
}

// ─── Stop a Single Bot ────────────────────────────────────────
async function stopBot(botId) {
  const entry = activeBots.get(botId);
  if (!entry) return;
  try {
    await entry.bot.stop();
    activeBots.delete(botId);
    await updateBotStatus(botId, false);
    console.log(`[Engine] Bot "${entry.config.botName}" stopped.`);
  } catch (err) {
    console.error(`[Engine] Error stopping bot:`, err.message);
    activeBots.delete(botId);
  }
}

// ─── Sync: Poll DB for changes ────────────────────────────────
async function syncBots() {
  try {
    const bots = await getAllBots();
    for (const botConfig of bots) {
      const isRunning = activeBots.has(botConfig.id);
      if (botConfig.isActive && !isRunning) {
        await startBot(botConfig);
      } else if (!botConfig.isActive && isRunning) {
        await stopBot(botConfig.id);
      }
    }
    for (const [id] of activeBots) {
      if (!bots.find(b => b.id === id)) {
        await stopBot(id);
      }
    }
  } catch (err) {
    console.error('[Engine] Sync failed:', err.message);
  }
}

// ─── Express API (for dashboard interactions) ─────────────────
const app = express();

// Security: Restrict CORS to known origins
const allowedOrigins = [
  'https://saas-ruddy-alpha.vercel.app',
  'http://localhost:5173',
  'http://localhost:4173',
];
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) cb(null, true);
    else cb(new Error('Not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));

// Security: API key auth for all /api routes
app.use('/api', (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  if (apiKey !== KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
});

// Security: Basic rate limiter (per IP, 60 req/min)
const rateLimitMap = new Map();
app.use('/api', (req, res, next) => {
  const ip = req.ip || req.connection.remoteAddress;
  const now = Date.now();
  const windowMs = 60000;
  const maxReqs = 60;
  if (!rateLimitMap.has(ip)) rateLimitMap.set(ip, []);
  const hits = rateLimitMap.get(ip).filter(t => now - t < windowMs);
  if (hits.length >= maxReqs) {
    return res.status(429).json({ error: 'Too many requests' });
  }
  hits.push(now);
  rateLimitMap.set(ip, hits);
  next();
});
// Clean rate limit map every 5 minutes
setInterval(() => rateLimitMap.clear(), 300000);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', bots: activeBots.size });
});

// Owner sends a reply to a customer
app.post('/api/reply', async (req, res) => {
  const { botId, telegramUserId, message } = req.body;
  if (!botId || !telegramUserId || !message) {
    return res.status(400).json({ error: 'Missing botId, telegramUserId, or message' });
  }
  // Security: Input validation
  if (typeof message !== 'string' || message.length > 5000) {
    return res.status(400).json({ error: 'Message too long or invalid' });
  }
  if (typeof botId !== 'string' || botId.length > 100 || typeof telegramUserId !== 'string') {
    return res.status(400).json({ error: 'Invalid parameters' });
  }

  const entry = activeBots.get(botId);
  if (!entry) {
    return res.status(404).json({ error: 'Bot not running' });
  }

  try {
    // Auto-enable takeover when owner starts replying
    const takeoverKey = `${botId}_${telegramUserId}`;
    if (!humanTakeoverMap.get(takeoverKey)) {
      humanTakeoverMap.set(takeoverKey, true);
      console.log(`[Engine] Auto-takeover ON for user ${telegramUserId} — owner started replying`);
    }

    // Send message via Telegram
    await entry.bot.api.sendMessage(telegramUserId, message);

    // Save owner reply to DB
    await saveMessage(botId, telegramUserId, 'المالك', message, 'owner');

    res.json({ success: true, takeover: true });
  } catch (err) {
    console.error('[API] Reply failed:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Toggle human takeover for a customer
app.post('/api/takeover', async (req, res) => {
  const { botId, telegramUserId, enabled } = req.body;
  if (!botId || !telegramUserId) {
    return res.status(400).json({ error: 'Missing botId or telegramUserId' });
  }

  const key = `${botId}_${telegramUserId}`;
  humanTakeoverMap.set(key, !!enabled);

  console.log(`[Engine] Human takeover ${enabled ? 'ON' : 'OFF'} for user ${telegramUserId} in bot ${botId}`);
  res.json({ success: true, takeover: !!enabled });
});

// Get takeover status for a customer
app.get('/api/takeover/:botId/:telegramUserId', (req, res) => {
  const key = `${req.params.botId}_${req.params.telegramUserId}`;
  res.json({ takeover: !!humanTakeoverMap.get(key) });
});

// Update order status
app.post('/api/orders/status', async (req, res) => {
  const { orderId, status } = req.body;
  if (!orderId || !status) {
    return res.status(400).json({ error: 'Missing orderId or status' });
  }
  try {
    await nex('PATCH', '/database/ext/orders/documents/' + orderId, {
      data: { status },
      merge: true,
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Global Error Handler (prevents stack trace leaks) ───────
app.use((err, req, res, next) => {
  console.error('[Engine] Unhandled error:', err.message);
  res.status(500).json({ error: 'حدث خطأ داخلي' });
});

// ─── Main ─────────────────────────────────────────────────────
async function main() {
  console.log('');
  console.log('══════════════════════════════════════════');
  console.log('  BotForge Engine v2 — Starting...');
  console.log('══════════════════════════════════════════');
  console.log('');

  // Start Express API server
  app.listen(PORT, () => {
    console.log(`[Engine] HTTP API listening on port ${PORT}`);
  });

  // Initial load
  try {
    const bots = await getAllBots();
    console.log(`[Engine] Found ${bots.length} bot(s) in database.`);
    for (const config of bots) {
      if (config.telegramToken) {
        await startBot(config);
      }
    }
  } catch (err) {
    console.error('[Engine] Failed to load bots:', err.message);
  }

  // Poll for changes every 30 seconds
  setInterval(syncBots, 30000);
  console.log('[Engine] Running. Polling DB every 30s for changes.');
}

main();
