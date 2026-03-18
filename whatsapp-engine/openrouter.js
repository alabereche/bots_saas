// ═══════════════════════════════════════════════════════════════
// BotForge WhatsApp Engine — OpenRouter AI Integration
// Sends messages to LLMs via OpenRouter API
// ═══════════════════════════════════════════════════════════════

const { buildSystemPrompt } = require('./promptGenerator');

// In-memory conversation history per user
const conversationHistory = new Map();
const MAX_HISTORY = 20;

async function callOpenRouter(apiKey, model, messages) {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + apiKey,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.SITE_URL || 'https://botforge.app',
      'X-Title': 'BotForge WhatsApp',
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

async function askOpenRouter(config, userId, userMessage) {
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

  const primaryModel = config.aiModel || 'openrouter/free';
  const fallbackModel = 'openrouter/free';

  let reply = null;

  try {
    reply = await callOpenRouter(config.openrouterKey, primaryModel, messages);
  } catch (err) {
    console.warn(`[WA Engine] Primary model failed, trying fallback. Error: ${err.message}`);
    if (primaryModel !== fallbackModel) {
      try {
        reply = await callOpenRouter(config.openrouterKey, fallbackModel, messages);
      } catch (fallbackErr) {
        console.error(`[WA Engine] Fallback also failed: ${fallbackErr.message}`);
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

function clearHistory(configId, userId) {
  conversationHistory.delete(`${configId}_${userId}`);
}

module.exports = { askOpenRouter, clearHistory };
