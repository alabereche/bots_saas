// ═══════════════════════════════════════════════════════════════
// BotForge WhatsApp Engine — Health Monitor & Self-Healing
//
// The silent killer: a Chromium page can die (renderer crash, network
// blip, WhatsApp web update) WITHOUT whatsapp-web.js emitting
// 'disconnected'. The bot then sits in the map looking "connected"
// while deaf — customers message it and nothing replies.
//
// This monitor polls every connected client's real browser state.
// A state check that hangs, throws, or reports anything other than a
// live session means a zombie: the watchdog hands the bot to
// botManager.healBot() which destroys it and auto-restarts it on the
// SAVED session (no merchant re-link), and the recovery pass in
// botManager replays messages missed while it was deaf.
// ═══════════════════════════════════════════════════════════════

const STATE_CHECK_TIMEOUT_MS = parseInt(process.env.HEALTH_STATE_TIMEOUT_MS || '12000', 10);
const WATCHDOG_INTERVAL_MS = parseInt(process.env.HEALTH_CHECK_INTERVAL_MS || '30000', 10);
const INIT_HARD_CAP_MS = parseInt(process.env.HEALTH_INIT_CAP_MS || '180000', 10);

// States that mean the session is genuinely alive. SYNCING/STREAMING are
// healthy-but-busy (long chat history sync); OPENING persistently is not.
const LIVE_STATES = ['CONNECTED', 'SYNCING', 'STREAMING'];

let botManagerRef = null;
const watchers = new Map(); // botId -> interval handle

function install(ref) {
  botManagerRef = ref;
}

function startWatch(botId) {
  if (watchers.has(botId)) return;
  const handle = setInterval(() => {
    tick(botId).catch(e =>
      console.error(`[Health] Watchdog tick error for ${botId}:`, e.message)
    );
  }, WATCHDOG_INTERVAL_MS);
  watchers.set(botId, handle);
  console.log(`[Health] 🫀 Watchdog started for bot ${botId}`);
}

function stopWatch(botId) {
  const handle = watchers.get(botId);
  if (handle) {
    clearInterval(handle);
    watchers.delete(botId);
    console.log(`[Health] Watchdog stopped for bot ${botId}`);
  }
}

function stopAll() {
  for (const botId of [...watchers.keys()]) stopWatch(botId);
}

async function tick(botId) {
  const bm = botManagerRef;
  if (!bm) return;

  const state = bm.getBotState(botId);
  if (!state) return stopWatch(botId);

  // An initialize() that never lands blocks the slot forever — force it.
  if (state.status === 'initializing' && state.startedAt &&
      Date.now() - state.startedAt > INIT_HARD_CAP_MS) {
    console.warn(`[Health] ⚠️ Bot ${botId} stuck initializing >${Math.round(INIT_HARD_CAP_MS / 1000)}s — forcing heal.`);
    return bm.healBot(botId, 'initialization exceeded hard time cap');
  }

  if (state.status !== 'connected' || !state.client) return;

  let raw = null;
  try {
    raw = await Promise.race([
      state.client.getState(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`state check hung >${STATE_CHECK_TIMEOUT_MS}ms`)), STATE_CHECK_TIMEOUT_MS)
      ),
    ]);
  } catch (e) {
    console.warn(`[Health] ⚠️ Bot ${botId} state check FAILED (${e.message}) — treating as zombie.`);
    bm.markUnhealthy(botId);
    return bm.healBot(botId, `state check failed: ${e.message}`);
  }

  const live = raw && LIVE_STATES.includes(String(raw).toUpperCase());
  if (live) {
    bm.markHealthy(botId);
    return;
  }

  console.warn(`[Health] ⚠️ Bot ${botId} reports state "${raw ?? 'null'}" while status=connected — treating as zombie.`);
  bm.markUnhealthy(botId);
  return bm.healBot(botId, `zombie state: ${raw ?? 'null'}`);
}

module.exports = { install, startWatch, stopWatch, stopAll, WATCHDOG_INTERVAL_MS };
