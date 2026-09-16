// ═══════════════════════════════════════════════════════════════
// BotForge WhatsApp Engine — Gemini AI Integration
// Hardened: request timeout, key sent in a header (never the URL),
// no blind retries on fatal 4xx, bounded history map.
// ═══════════════════════════════════════════════════════════════

const { buildSystemPrompt } = require('./promptGenerator');

const conversationHistory = new Map(); // key -> { msgs: [], lastUsedAt }
const MAX_HISTORY = 20;
const MAX_HISTORY_KEYS = 5000;
const AI_TIMEOUT_MS = 9000;
// Idle entries are pruned after this long — memory stays flat without
// forgetting anyone mid-conversation (12h covers any realistic chat)
const HISTORY_IDLE_TTL_MS = parseInt(process.env.AI_HISTORY_TTL_HOURS || '12', 10) * 3600 * 1000;

const firestore = require('./firestore');

// Periodic sweep: drop customer contexts untouched past the TTL. One map
// walk per hour — nothing measurable. unref: never holds the process open.
setInterval(() => {
  const now = Date.now();
  let pruned = 0;
  for (const [key, entry] of conversationHistory) {
    if (now - entry.lastUsedAt > HISTORY_IDLE_TTL_MS) {
      conversationHistory.delete(key);
      pruned++;
    }
  }
  if (pruned > 0) console.log(`[AI-Memory] pruned ${pruned} idle conversation context(s)`);
}, 60 * 60 * 1000).unref();

// Gemini API key from environment only — never from client-writable
// bot documents
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
// Key pool — comma-separated list; on 429 the next key takes over
const { parseGeminiKeys, runKeyPool } = require('./gemini-pool');
const GEMINI_API_KEYS = parseGeminiKeys(process.env);

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

  // `AQ.`-prefixed strings from AI Studio are API keys → x-goog-api-key.
// Bearer is for real OAuth access tokens (ya29…) only.
const isBearer = apiKey && (apiKey.startsWith('ya29') || (apiKey.length > 80 && !apiKey.startsWith('AQ.')));
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
        if ((res.status === 401 || res.status === 403) && !isBearer && apiKey.startsWith('AQ.')) {
          // New AI Studio keys: header auth rejected → try Bearer once
          try {
            const res2 = await fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
              body: JSON.stringify({
                systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined,
                contents,
                generationConfig: { maxOutputTokens: 800, temperature: 0.7 },
              }),
              signal: AbortSignal.timeout(AI_TIMEOUT_MS),
            });
            if (res2.ok) {
              const data2 = await res2.json();
              const text2 = data2.candidates?.[0]?.content?.parts?.[0]?.text;
              if (text2) return text2;
            }
          } catch { /* fall through to next model */ }
        }
        // 400 = malformed request (key-independent); 401/403 = bad key;
        // 429 = this key's quota — all three stop this key's model loop.
        if (res.status === 400 || res.status === 401 || res.status === 403 || res.status === 429) break;
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
    // Hydrate from Firestore on a cache miss (engine restart / TTL prune /
    // FIFO eviction): the bot greets a returning customer with his context
    // intact instead of amnesia. Persisted logs remain the source of truth.
    let seed = [];
    try {
      const docs = await firestore.getConversationHistory(config.id, userId, MAX_HISTORY);
      seed = docs
        .filter(d => d && typeof d.content === 'string' && d.content.trim())
        .map(d => ({
          role: d.role === 'bot' ? 'assistant' : (d.role === 'owner' ? 'assistant' : 'user'),
          content: d.content,
        }));
    } catch { /* hydration is best-effort — a fresh start is acceptable */ }
    if (seed.length > 0) {
      console.log(`[AI-Memory] hydrated ${seed.length} turns for ${historyKey} from Firestore`);
    }
    conversationHistory.set(historyKey, { msgs: seed.slice(-MAX_HISTORY), lastUsedAt: Date.now() });
  }
  const entry = conversationHistory.get(historyKey);
  entry.lastUsedAt = Date.now();
  const history = entry.msgs;
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
    const customKey = config.customApiKey || config.geminiApiKey || config.apiKey;
    const keys = customKey ? [customKey] : GEMINI_API_KEYS;
    const model = config.aiModel || config.model || process.env.DEFAULT_AI_MODEL || 'gemini-2.5-flash-lite';
    reply = await runKeyPool(keys, (key) => callGemini(key, model, messages, audioData));
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
