// ═══════════════════════════════════════════════════════════════
// BotForge — Gemini key pool (CJS · whatsapp-engine)
// Multiple free-tier API keys: on 429 (quota) or an invalid key
// (401/403), the next key in line takes over transparently.
// Keys come from GEMINI_API_KEYS="k1,k2,..." (falls back to the
// single legacy GEMINI_API_KEY). A per-bot custom key always runs
// alone — merchants' own keys never join the house pool.
// ═══════════════════════════════════════════════════════════════

function parseGeminiKeys(env) {
  const raw = (env && (env.GEMINI_API_KEYS || env.GEMINI_API_KEY)) || '';
  return String(raw)
    .split(',')
    .map(k => k.trim())
    .filter(Boolean);
}

/**
 * Runs `attempt(key)` over the key pool in order.
 * - truthy return  → success, returned immediately
 * - null/undefined → empty-response (key-independent), try next key
 * - throw with " 400:" → malformed request (key-independent) → abort pool
 * - any other throw (401/403 invalid key, 429 quota) → next key
 * Throws the last error when every key is exhausted.
 */
async function runKeyPool(keys, attempt) {
  if (!Array.isArray(keys) || keys.length === 0) {
    throw new Error('GEMINI_API_KEYS غير مضبوط على المحرك أو إعدادات البوت');
  }
  let lastError = null;
  for (const key of keys) {
    try {
      const out = await attempt(key);
      if (out) return out;
      lastError = new Error('Gemini: empty response');
    } catch (e) {
      lastError = e;
      if (/ 400:/.test(String((e && e.message) || e))) throw e; // shape issue, not key issue
    }
  }
  throw lastError || new Error('Gemini: pool exhausted');
}

module.exports = { parseGeminiKeys, runKeyPool };
