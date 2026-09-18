// ═══════════════════════════════════════════════════════════════
// BotForge WhatsApp Engine — Health Monitor & Self-Healing
//
// Three ways a bot dies, three ways we catch it:
//  1. The page dies LOUDLY (Target closed)        -> getState() throws -> heal
//  2. The page never reaches ready / init hangs   -> caps below       -> heal
//  3. The page lives but the CHANNEL is dead      -> LIVENESS PROBE   -> heal
// Case 3 is the silent killer (autopsy 2026-09-16: a revived session
// was born paralyzed — authenticated+ready, yet getChats() failed and
// not a single message arrived for 9 hours while getState kept saying
// CONNECTED). The probe FORCES the server to talk (getChats) — a hang
// or throw means the channel is dead regardless of what the page claims.
// ═══════════════════════════════════════════════════════════════

const STATE_CHECK_TIMEOUT_MS = parseInt(process.env.HEALTH_STATE_TIMEOUT_MS || '12000', 10);
const WATCHDOG_INTERVAL_MS = parseInt(process.env.HEALTH_CHECK_INTERVAL_MS || '30000', 10);
const INIT_HARD_CAP_MS = parseInt(process.env.HEALTH_INIT_CAP_MS || '180000', 10);
// Authenticated but never reached 'ready' (hung history sync) — heal it.
const READY_LATE_CAP_MS = parseInt(process.env.HEALTH_READY_CAP_MS || '240000', 10);
// Liveness probe cadence: probe when no incoming message has arrived
// for this long (an active chat IS the proof of life — never probe then).
const LIVENESS_AFTER_SILENCE_MS = parseInt(process.env.HEALTH_LIVENESS_MINUTES || '60', 10) * 60 * 1000;
const PROBE_TIMEOUT_MS = parseInt(process.env.HEALTH_PROBE_TIMEOUT_MS || '25000', 10);

// States that mean the session is genuinely alive. SYNCING/STREAMING are
// healthy-but-busy (long chat history sync); OPENING persistently is not.
const LIVE_STATES = ['CONNECTED', 'SYNCING', 'STREAMING'];

let botManagerRef = null;
let firestoreRef = null;
const watchers = new Map();        // botId -> interval handle
const lastIncomingAt = new Map();  // botId -> epoch ms (set by botManager on every message)
const lastProbeOkAt = new Map();   // botId -> epoch ms of last successful server round-trip
const probeFailStreak = new Map(); // botId -> consecutive probe failures

// getChats() throws a bogus minified "r" error even on sessions that
// receive messages fine (verified 2026-09-16/17 logs) — a single probe
// failure must NEVER heal directly. Only a sustained streak with zero
// incoming traffic may.
const PROBE_HEAL_THRESHOLD = parseInt(process.env.HEALTH_PROBE_HEAL_THRESHOLD || '6', 10);

function install(botManager, firestore) {
  botManagerRef = botManager;
  firestoreRef = firestore || null;
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

// Called by botManager for EVERY incoming message — fresh traffic is the
// cheapest and most honest proof of life; it resets the probe countdown.
function markIncoming(botId) {
  lastIncomingAt.set(botId, Date.now());
  probeFailStreak.delete(botId);
}

// A fresh ready IS a successful server handshake (auth round-tripped
// seconds ago) — it anchors the silence window so a newborn session is
// never probed instantly (the 03:13 heal-storm bug: empty maps anchored
// at epoch 0 and the first tick probed 28s after ready).
function markReady(botId) {
  lastProbeOkAt.set(botId, Date.now());
  probeFailStreak.delete(botId);
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

  // WPPConnect: no ready-late trap (status IS the connection state) — but
  // keep a cheap direct state check with a timeout guard.
  let raw = null;
  try {
    raw = await Promise.race([
      Promise.resolve(state.client.getConnectionState ? state.client.getConnectionState() : 'CONNECTED'),
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
  if (!live) {
    console.warn(`[Health] ⚠️ Bot ${botId} reports state "${raw ?? 'null'}" while status=connected — treating as zombie.`);
    bm.markUnhealthy(botId);
    return bm.healBot(botId, `zombie state: ${raw ?? 'null'}`);
  }

  bm.markHealthy(botId);

  // ─── Liveness probe: page says alive — now make the SERVER prove it ───
  const lastIn = lastIncomingAt.get(botId) || 0;
  const lastOk = lastProbeOkAt.get(botId) || 0;
  const anchor = Math.max(lastIn, lastOk);
  if (Date.now() - anchor >= LIVENESS_AFTER_SILENCE_MS) {
    await probeNow(botId, 'silence window elapsed');
  }
}

// Forces a real server round-trip (getChats). A hang means the channel
// is dead for sure; a THROW is only weak evidence (known bogus "r" error
// on healthy sessions) — throws accumulate a streak and heal only after
// PROBE_HEAL_THRESHOLD consecutive failures with no incoming traffic.
async function probeNow(botId, reason = 'manual') {
  const bm = botManagerRef;
  if (!bm) return false;
  const state = bm.getBotState(botId);
  if (!state || !state.client) return false;

  try {
    const chats = await Promise.race([
      state.client.getChats(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`liveness probe hung >${PROBE_TIMEOUT_MS}ms`)), PROBE_TIMEOUT_MS)
      ),
    ]);
    if (!Array.isArray(chats)) throw new Error('probe returned non-array');
    lastProbeOkAt.set(botId, Date.now());
    probeFailStreak.delete(botId);
    console.log(`[Health] 💓 Liveness OK for bot ${botId} (${chats.length} chats) — ${reason}`);
    return true;
  } catch (e) {
    // Full diagnostics: name + message (the notorious "r" carries no info)
    const diagnostic = `${e?.name || 'Error'}: ${e?.message || '(no message)'} | ${(e?.stack || '').split('\n')[1]?.trim().slice(0, 90) || ''}`;

    // A HUNG probe is unambiguous channel death — heal immediately.
    const hung = /hung|timeout/i.test(String(e.message || ''));
    if (hung) {
      console.warn(`[Health] ⚠️ Liveness probe HUNG for bot ${botId} (${reason}) — healing now.`);
      probeFailStreak.delete(botId);
      bm.markUnhealthy(botId);
      await bm.healBot(botId, `liveness probe hung (${reason})`);
      return false;
    }

    // The minified "r" (name===message==="r", from ExecutionContext
    // #evaluate) is thrown by getChats on EVERY session on this WhatsApp
    // build — healthy and dead alike. It is noise: log once, never count.
    const msg = String(e?.message || '');
    if (msg.length <= 3 && String(e?.name || '').length <= 3) {
      lastProbeOkAt.set(botId, Date.now()); // treat as "probe ran, page answered"
      console.log(`[Health] Liveness probe hit the known bogus "${msg}" error for bot ${botId} (${reason}) — page responsive, ignored.`);
      return false;
    }

    // Any OTHER throw is weak evidence — require a sustained streak.
    const streak = (probeFailStreak.get(botId) || 0) + 1;
    probeFailStreak.set(botId, streak);
    if (streak < PROBE_HEAL_THRESHOLD) {
      console.warn(`[Health] Liveness probe threw for bot ${botId} (${reason}), streak ${streak}/${PROBE_HEAL_THRESHOLD} — ${diagnostic}`);
      return false;
    }
    console.warn(`[Health] ⚠️ Liveness probe FAILED ${streak}x for bot ${botId} (${reason}) — healing. Last error: ${diagnostic}`);
    probeFailStreak.delete(botId);
    bm.markUnhealthy(botId);
    await bm.healBot(botId, `liveness probe failed ${streak}x (${reason})`);
    return false;
  }
}

// Called by botManager right after every 'ready': a revived session can
// be born paralyzed (ceremony passes, channel dead). One probe shortly
// after birth catches it within a minute instead of nine hours.
function scheduleBirthProbe(botId, delayMs = 45000) {
  const key = `birth:${botId}`;
  if (watchers.has(key)) clearTimeout(watchers.get(key));
  const t = setTimeout(() => {
    watchers.delete(key);
    probeNow(botId, 'post-ready birth probe').catch(() => {});
  }, delayMs);
  watchers.set(key, t);
}

function forget(botId) {
  lastIncomingAt.delete(botId);
  lastProbeOkAt.delete(botId);
  probeFailStreak.delete(botId);
  const key = `birth:${botId}`;
  if (watchers.has(key)) {
    clearTimeout(watchers.get(key));
    watchers.delete(key);
  }
}

module.exports = {
  install,
  startWatch,
  stopWatch,
  stopAll,
  markIncoming,
  markReady,
  probeNow,
  scheduleBirthProbe,
  forget,
  WATCHDOG_INTERVAL_MS,
};
