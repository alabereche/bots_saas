// ═══════════════════════════════════════════════════════════════
// BotForge WhatsApp Engine — Multi-Provider AI Integration
// Supports OpenRouter, Google Gemini, and OpenAI
// ═══════════════════════════════════════════════════════════════

const { buildSystemPrompt } = require('./promptGenerator');

const conversationHistory = new Map();
const MAX_HISTORY = 20;

// --- OpenRouter ---
async function callOpenRouter(apiKey, model, messages) {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + apiKey,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.SITE_URL || 'https://botforge.app',
      'X-Title': 'BotForge WhatsApp',
    },
    body: JSON.stringify({ model, messages, max_tokens: 1024, temperature: 0.7 }),
  });
  if (!res.ok) {
    const err = await res.text();
    console.error(`[OpenRouter] Model "${model}" error ${res.status}:`, err);
    throw new Error(`OpenRouter ${res.status}: ${err}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content || null;
}

// --- Google Gemini ---
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
    console.error(`[Gemini] Model "${geminiModel}" error ${res.status}:`, err);
    throw new Error(`Gemini ${res.status}: ${err}`);
  }
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
}

// --- OpenAI ---
async function callOpenAI(apiKey, model, messages) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: model || 'gpt-4o-mini', messages, max_tokens: 1024, temperature: 0.7 }),
  });
  if (!res.ok) {
    const err = await res.text();
    console.error(`[OpenAI] Model "${model}" error ${res.status}:`, err);
    throw new Error(`OpenAI ${res.status}: ${err}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content || null;
}

// --- Unified AI Router ---
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
  const provider = config.aiProvider || 'openrouter';
  const model = config.aiModel;

  let reply = null;

  try {
    if (provider === 'gemini') {
      reply = await callGemini(config.geminiKey, model, messages);
    } else if (provider === 'openai') {
      reply = await callOpenAI(config.openaiKey, model, messages);
    } else {
      // OpenRouter (default) with fallback
      const primaryModel = model || 'openrouter/free';
      try {
        reply = await callOpenRouter(config.openrouterKey, primaryModel, messages);
      } catch (err) {
        if (primaryModel !== 'openrouter/free') {
          console.warn(`[WA Engine] Primary model failed, trying openrouter/free. Error: ${err.message}`);
          reply = await callOpenRouter(config.openrouterKey, 'openrouter/free', messages);
        } else {
          throw err;
        }
      }
    }
  } catch (err) {
    console.error(`[WA Engine] AI call failed (${provider}): ${err.message}`);
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
