// ═══════════════════════════════════════════════════════════════
// BotForge WhatsApp Engine — Human Takeover State
// When active for a chat, the AI stays silent and the owner
// replies manually from the dashboard.
// Kept in its own module to avoid a botManager <-> messageHandler
// circular require.
// ═══════════════════════════════════════════════════════════════

// Key: `${botId}_${chatId}` -> true
const humanTakeoverMap = new Map();

function setTakeover(botId, chatId, enabled) {
  const key = `${botId}_${chatId}`;
  if (enabled) {
    humanTakeoverMap.set(key, true);
  } else {
    humanTakeoverMap.delete(key);
  }
}

function isTakeoverActive(botId, chatId) {
  return humanTakeoverMap.get(`${botId}_${chatId}`) === true;
}

// All chats currently in manual mode for a bot, as { chatId: true }
function getTakeoverMap(botId) {
  const prefix = `${botId}_`;
  const result = {};
  for (const [key, val] of humanTakeoverMap) {
    if (val && key.startsWith(prefix)) {
      result[key.slice(prefix.length)] = true;
    }
  }
  return result;
}

module.exports = { setTakeover, isTakeoverActive, getTakeoverMap };
