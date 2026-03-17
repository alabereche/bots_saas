// ═══════════════════════════════════════════════════════════════
// BotForge WhatsApp Engine — OpenRouter AI Integration
// Sends messages to LLMs via OpenRouter API
// ═══════════════════════════════════════════════════════════════

const { buildSystemPrompt } = require('./promptGenerator');

// In-memory conversation history per user
const conversationHistory = new Map();
const MAX_HISTORY = 20;

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

  const messages = [
    { role: 'system', content: systemPrompt },
    ...history,
  ];

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + config.openrouterKey,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.SITE_URL || 'https://botforge.app',
      'X-Title': 'BotForge WhatsApp',
    },
    body: JSON.stringify({
      model: config.aiModel || 'meta-llama/llama-3.1-8b-instruct',
      messages,
      max_tokens: 1024,
      temperature: 0.7,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error('OpenRouter error: ' + err);
  }

  const data = await res.json();
  const reply = data.choices?.[0]?.message?.content || 'عذراً، لم أتمكن من المعالجة.';

  history.push({ role: 'assistant', content: reply });

  return reply;
}

function clearHistory(configId, userId) {
  conversationHistory.delete(`${configId}_${userId}`);
}

module.exports = { askOpenRouter, clearHistory };
