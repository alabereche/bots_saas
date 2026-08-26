// ═══════════════════════════════════════════════════════════════
// BotForge WhatsApp Engine — Gemini AI Integration
// Hardened: request timeout, key sent in a header (never the URL),
// no blind retries on fatal 4xx, bounded history map.
// ═══════════════════════════════════════════════════════════════

const { buildSystemPrompt } = require('./promptGenerator');

const conversationHistory = new Map();
const MAX_HISTORY = 20;
const MAX_HISTORY_KEYS = 5000;
const AI_TIMEOUT_MS = 9000;

// Gemini API key from environment only — never from client-writable
// bot documents
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

// --- Google Gemini ---
async function callGemini(apiKey, model, messages, audioData = null) {
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

// --- Unified AI (Gemini only) ---
async function askOpenRouter(config, userId, userMessage, audioData = null) {
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

  let reply = null;

  try {
    const apiKey = config.customApiKey || config.geminiApiKey || config.apiKey || process.env.GEMINI_API_KEY || GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY غير مضبوط على المحرك أو إعدادات البوت');
    }
    const model = config.aiModel || config.model || process.env.DEFAULT_AI_MODEL || 'gemini-2.5-flash-lite';
    reply = await callGemini(apiKey, model, messages, audioData);
  } catch (err) {
    // The attempt failed: drop the user message from history so a
    // retry doesn't carry a phantom turn
    if (effectiveMessage) {
      history.pop();
    }
    console.error(`[WA Engine] Gemini call failed: ${err.message}`);
    throw err;
  }

  if (!reply) reply = 'عذراً، لم أتمكن من المعالجة. يرجى إعادة المحاولة.';
  history.push({ role: 'assistant', content: reply });
  return reply;
}

function clearHistory(configId, userId) {
  conversationHistory.delete(`${configId}_${userId}`);
}

module.exports = { askOpenRouter, clearHistory };
