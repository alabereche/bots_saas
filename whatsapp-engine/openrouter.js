// ═══════════════════════════════════════════════════════════════
// BotForge WhatsApp Engine — Gemini AI Integration
// Uses Google Gemini 2.5 Flash directly
// ═══════════════════════════════════════════════════════════════

const { buildSystemPrompt } = require('./promptGenerator');

const conversationHistory = new Map();
const MAX_HISTORY = 20;

// Hardcoded Gemini API key — used for all bots
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'AIzaSyAnTqZ5upTb05CEapy8sGTMyiWDbTlb7JQ';

// --- Google Gemini ---
async function callGemini(apiKey, model, messages) {
  const modelsToTry = [
    model || 'gemini-3.5-flash-lite',
    'gemini-2.5-flash-lite',
    'gemini-2.5-flash',
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

  let lastError = null;
  for (const geminiModel of modelsToTry) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${apiKey}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined,
          contents,
          generationConfig: { maxOutputTokens: 800, temperature: 0.7 },
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) return text;
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

// --- Unified AI (Gemini only) ---
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

  let reply = null;

  try {
    reply = await callGemini(GEMINI_API_KEY, 'gemini-2.5-flash', messages);
  } catch (err) {
    console.error(`[WA Engine] Gemini call failed: ${err.message}`);
    throw err;
  }

  if (!reply) reply = 'عذراً، لم أتمكن من المعالجة.';
  history.push({ role: 'assistant', content: reply });
  return reply;
}

function clearHistory(configId, userId) {
  conversationHistory.delete(`${configId}_${userId}`);
}

module.exports = { askOpenRouter, clearHistory };
