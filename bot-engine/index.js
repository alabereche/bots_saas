// ═══════════════════════════════════════════════════════════════
// BotForge — Bot Engine
// Reads bot configs from NexCloud, starts Telegram bots,
// routes messages through OpenRouter AI
// ═══════════════════════════════════════════════════════════════

import 'dotenv/config';
import { Bot } from 'grammy';
import { buildSystemPrompt } from './prompt-builder.js';

const API = process.env.NEXCLOUD_URL || 'https://nexcloud-production.up.railway.app/api/v1';
const KEY = process.env.NEXCLOUD_KEY;

// Store active bot instances: botDocId -> { bot, config }
const activeBots = new Map();

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

async function saveConversation(botId, userId, userName, userMessage, botReply) {
  await nex('POST', '/database/ext/conversations/documents', {
    data: {
      botId,
      telegramUserId: String(userId),
      userName: userName || 'مجهول',
      lastMessage: userMessage.slice(0, 200),
      botReply: botReply.slice(0, 500),
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

// ─── OpenRouter AI ────────────────────────────────────────────
// Conversation history per user (in-memory, resets on restart)
const conversationHistory = new Map();
const MAX_HISTORY = 20; // Keep last 20 messages per user

async function callOpenRouter(apiKey, model, messages) {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + apiKey,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://botforge.app',
      'X-Title': 'BotForge',
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: 1024,
      temperature: 0.7,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error(`[OpenRouter] Model "${model}" error ${res.status}:`, err);
    throw new Error(`OpenRouter ${res.status}: ${err}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || null;
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

  // Primary model from bot config, fallback to OpenRouter's free auto-router
  const primaryModel = config.aiModel || 'openrouter/free';
  const fallbackModel = 'openrouter/free';

  let reply = null;

  try {
    reply = await callOpenRouter(config.openrouterKey, primaryModel, messages);
  } catch (err) {
    console.warn(`[Engine] Primary model failed, trying fallback. Error: ${err.message}`);
    // Only try fallback if it's different from primary
    if (primaryModel !== fallbackModel) {
      try {
        reply = await callOpenRouter(config.openrouterKey, fallbackModel, messages);
      } catch (fallbackErr) {
        console.error(`[Engine] Fallback model also failed: ${fallbackErr.message}`);
        throw fallbackErr;
      }
    } else {
      throw err;
    }
  }

  if (!reply) reply = 'عذراً، لم أتمكن من المعالجة.';

  history.push({ role: 'assistant', content: reply });
  return reply;
}


// ─── Start a Single Bot ───────────────────────────────────────
async function startBot(config) {
  if (activeBots.has(config.id)) {
    console.log(`[Engine] Bot "${config.botName}" already running, skipping.`);
    return;
  }

  if (!config.telegramToken) {
    console.warn(`[Engine] Bot "${config.botName}" has no Telegram token, skipping.`);
    return;
  }

  try {
    const bot = new Bot(config.telegramToken);

    // Handle /start command
    bot.command('start', async (ctx) => {
      const greeting = config.responseStyle === 'formal'
        ? `مرحباً بك. أنا ${config.botName}، مساعدك الآلي من ${config.businessName}. كيف يمكنني مساعدتك؟`
        : `أهلاً وسهلاً! أنا ${config.botName} 🤖 مساعدك من ${config.businessName}. كيف اقدر اساعدك؟`;
      await ctx.reply(greeting);
    });

    // Handle all text messages
    bot.on('message:text', async (ctx) => {
      const userMessage = ctx.message.text;
      const userId = ctx.from.id;
      const userName = ctx.from.first_name || ctx.from.username || '';

      try {
        // Show "typing..." indicator
        await ctx.replyWithChatAction('typing');

        // Get AI response
        const reply = await askAI(config, userId, userMessage);

        // Send reply
        await ctx.reply(reply, { parse_mode: 'Markdown' }).catch(async () => {
          // If Markdown fails, send as plain text
          await ctx.reply(reply);
        });

        // Save conversation & increment count (don't await to keep fast)
        saveConversation(config.id, userId, userName, userMessage, reply).catch(() => {});
        incrementMessageCount(config.id).catch(() => {});

      } catch (err) {
        console.error(`[Engine] Error in bot "${config.botName}":`, err.message);
        await ctx.reply('عذراً، حدث خطأ أثناء المعالجة. حاول مرة أخرى.');
      }
    });

    // Handle non-text messages
    bot.on('message', async (ctx) => {
      if (ctx.message.text) return; // already handled above
      await ctx.reply('عذراً، حالياً أستطيع الرد على الرسائل النصية فقط.');
    });

    // Error handler
    bot.catch((err) => {
      console.error(`[Engine] Bot "${config.botName}" error:`, err.message);
    });

    // Start the bot
    bot.start();
    activeBots.set(config.id, { bot, config });

    // Update status in DB
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
        // Should be running but isn't — start it
        await startBot(botConfig);
      } else if (!botConfig.isActive && isRunning) {
        // Should be stopped but is running — stop it
        await stopBot(botConfig.id);
      }
    }

    // Stop bots that were deleted from DB
    for (const [id] of activeBots) {
      if (!bots.find(b => b.id === id)) {
        await stopBot(id);
      }
    }
  } catch (err) {
    console.error('[Engine] Sync failed:', err.message);
  }
}

// ─── Main ─────────────────────────────────────────────────────
async function main() {
  console.log('');
  console.log('══════════════════════════════════════════');
  console.log('  BotForge Engine — Starting...');
  console.log('══════════════════════════════════════════');
  console.log('');

  // Initial load — start all active bots
  try {
    const bots = await getAllBots();
    console.log(`[Engine] Found ${bots.length} bot(s) in database.`);

    const activeBotConfigs = bots.filter(b => b.telegramToken && b.openrouterKey);
    console.log(`[Engine] ${activeBotConfigs.length} bot(s) have valid credentials.`);

    for (const config of activeBotConfigs) {
      await startBot(config);
    }
  } catch (err) {
    console.error('[Engine] Failed to load bots:', err.message);
  }

  // Poll for changes every 30 seconds
  setInterval(syncBots, 30000);

  console.log('');
  console.log('[Engine] Running. Polling DB every 30s for changes.');
  console.log('[Engine] Press Ctrl+C to stop.');
  console.log('');
}

main();
