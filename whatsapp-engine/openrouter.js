// ═══════════════════════════════════════════════════════════════
// BotForge WhatsApp Engine — Gemini AI Integration
// Hardened: request timeout, key sent in a header (never the URL),
// no blind retries on fatal 4xx, bounded history map.
// ═══════════════════════════════════════════════════════════════

const { buildSystemPrompt } = require('./promptGenerator');

const conversationHistory = new Map();
const MAX_HISTORY = 20;
const MAX_HISTORY_KEYS = 5000;
const AI_TIMEOUT_MS = 20000;

// Gemini API key from environment only — never from client-writable
// bot documents
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

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

  const isBearer = apiKey && (apiKey.startsWith('AQ') || apiKey.startsWith('ya29') || apiKey.length > 80);
  const urlBase = 'https://generativelanguage.googleapis.com/v1beta/models';

  let lastError = null;
  for (const geminiModel of modelsToTry) {
    try {
      // The key travels in a header, never in the URL where it would
      // land in proxy/access logs
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
        // Fatal client errors (bad key, bad request) fail on every
        // model — retrying only multiplies the latency
        const retryable = res.status === 429 || res.status >= 500;
        if (!retryable) break;
      }
    } catch (e) {
      lastError = e;
      // Timeouts and network errors are worth one more model; abort
      // errors from our own timeout bubble up after the loop
      if (e.name === 'AbortError' || e.name === 'TimeoutError') break;
    }
  }

  if (lastError) throw lastError;
  return null;
}

// --- Unified AI (Gemini only) ---
async function askOpenRouter(config, userId, userMessage) {
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

  let reply = null;

  try {
    if (!GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY غير مضبوط على المحرك');
    }
    const model = config.aiModel || process.env.DEFAULT_AI_MODEL || 'gemini-3.5-flash-lite';
    reply = await callGemini(GEMINI_API_KEY, model, messages);
  } catch (err) {
    // The attempt failed: drop the user message from history so a
    // retry doesn't carry a phantom turn
    history.pop();
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
