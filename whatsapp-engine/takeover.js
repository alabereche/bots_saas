// ═══════════════════════════════════════════════════════════════
// BotForge WhatsApp Engine — Human Takeover State
// When active for a chat, the AI stays silent and the owner
// replies manually from the dashboard.
// Kept in its own module to avoid a botManager <-> messageHandler
// circular require.
//
// AUTO-EXPIRE (the "bot stopped replying" trap): a manual reply used to
// silence the AI for that customer FOREVER — the owner forgets to press
// «إعادة تشغيل البوت» and the storefront goes mute for days. Manual mode
// now expires on its own (default 60 min, env-tunable): the owner keeps
// the floor while he is actively talking, and the AI resumes after the
// customer goes quiet past the window.
// ═══════════════════════════════════════════════════════════════

const TTL_MS = parseInt(process.env.MANUAL_TAKEOVER_TTL_MINUTES || '10', 10) * 60 * 1000;

// Key: `${botId}_${chatId}` -> enabledAt epoch ms
const humanTakeoverMap = new Map();

function setTakeover(botId, chatId, enabled) {
  const key = `${botId}_${chatId}`;
  if (enabled) {
    humanTakeoverMap.set(key, Date.now());
    console.log(`[Takeover] ✋ ON key=${key} — AI muted (auto-expires in ${TTL_MS / 60000}min)`);
    return;
  }
  // Log EVERY off request, including no-ops: a silent no-op OFF on a wrong
  // key (duplicate thread id for the same human) is exactly the bug class
  // being hunted — invisible no-ops made the button look dead
  if (humanTakeoverMap.has(key)) {
    console.log(`[Takeover] 🤖 OFF key=${key} — AI resumes`);
  } else {
    console.log(`[Takeover] 🤖 OFF (no-op, was not muted) key=${key}`);
  }
  humanTakeoverMap.delete(key);
}

function isTakeoverActive(botId, chatId) {
  const key = `${botId}_${chatId}`;
  const enabledAt = humanTakeoverMap.get(key);
  if (!enabledAt) return false;
  if (Date.now() - enabledAt > TTL_MS) {
    humanTakeoverMap.delete(key); // expired — the AI takes the floor back
    return false;
  }
  return true;
}

// All chats currently in manual mode for a bot, as { chatId: true }.
// Expired entries are pruned on read so the dashboard never shows a
// stale manual state.
function getTakeoverMap(botId) {
  const prefix = `${botId}_`;
  const now = Date.now();
  const result = {};
  for (const [key, enabledAt] of humanTakeoverMap) {
    if (!key.startsWith(prefix)) continue;
    if (now - enabledAt > TTL_MS) {
      humanTakeoverMap.delete(key);
      continue;
    }
    result[key.slice(prefix.length)] = true;
  }
  return result;
}

module.exports = { setTakeover, isTakeoverActive, getTakeoverMap };
