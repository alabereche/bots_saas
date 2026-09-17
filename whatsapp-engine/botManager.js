// ═══════════════════════════════════════════════════════════════
// BotForge WhatsApp Engine — Bot Manager
// Creates, manages, and destroys WhatsApp client instances
// with Cloud Firestore integration
// ═══════════════════════════════════════════════════════════════

const path = require('path');
const fs = require('fs');
const { Client, LocalAuth } = require('whatsapp-web.js');
const QRCode = require('qrcode');
const firestore = require('./firestore');
const { handleMessage } = require('./messageHandler');
const messageQueue = require('./messageQueue');
const healthMonitor = require('./healthMonitor');

// Active bots: botId -> { client, config, qrCode, status }
const activeBots = new Map();

// ─── Self-healing state ───────────────────────────────────────
// reconnectTimers: one pending auto-restart per bot (dedupes watchdog
// heal + disconnected event from double-scheduling the same revive).
// reconnectAttempts: backoff counter, reset on every successful 'ready'.
// lastDisconnectAt / lastHealthyAt: recovery windows — messages that
// arrived while the session was deaf are replayed from the unread queue.
const reconnectTimers = new Map();
const reconnectAttempts = new Map();
const lastDisconnectAt = new Map();
const lastHealthyAt = new Map();
const RESTART_DELAYS = [10000, 30000, 60000, 120000, 300000];

function cleanSession(botId) {
  try {
    const sessionDir = path.join(__dirname, 'sessions', `session-${botId}`);
    if (fs.existsSync(sessionDir)) {
      fs.rmSync(sessionDir, { recursive: true, force: true });
      console.log(`[BotManager] 🧹 Purged session directory for bot: ${botId}`);
    }
  } catch (e) {
    console.error(`[BotManager] Error cleaning session for bot ${botId}:`, e.message);
  }
}

// Chromium leaves lock files behind after a hard kill (OOM, pkill) and then
// refuses to relaunch on the same profile with "The browser is already running"
function clearStaleLocks(botId) {
  try {
    const sessionDir = path.join(__dirname, 'sessions', `session-${botId}`);
    for (const lock of ['SingletonLock', 'SingletonSocket', 'SingletonCookie']) {
      fs.rmSync(path.join(sessionDir, lock), { force: true });
    }
  } catch { /* best effort */ }
}

// ─── Create a WhatsApp Bot ────────────────────────────────────
async function createWhatsAppBot(botId, config, phoneNumber = null, forceNew = false) {
  // A fresh create supersedes any pending auto-restart for this bot
  const pending = reconnectTimers.get(botId);
  if (pending) {
    clearTimeout(pending);
    reconnectTimers.delete(botId);
  }

  if (activeBots.has(botId)) {
    const existing = activeBots.get(botId);
    if (existing.status === 'connected' && !phoneNumber && !forceNew) {
      console.log(`[BotManager] Bot "${config.botName}" already connected.`);
      return existing;
    }
    // An initialize() still in flight owns the browser — destroying it
    // mid-init orphans Chromium holding the profile lock, and every later
    // attempt then dies with "The browser is already running". Join it.
    if (existing.status === 'initializing' && existing.initPromise) {
      console.log(`[BotManager] Bot "${config.botName}" is still initializing — joining the in-flight attempt.`);
      await existing.initPromise.catch(() => {});
      if (activeBots.get(botId) === existing && existing.status === 'connected') {
        return existing;
      }
    }
    try { await existing.client.destroy(); } catch {}
    if (activeBots.get(botId) === existing) activeBots.delete(botId);
  }

  clearStaleLocks(botId);

  // If pairing with a phone or forcing a new connection, wipe any previous saved session
  if (phoneNumber || forceNew) {
    cleanSession(botId);
  }

  console.log(`[BotManager] Initializing bot "${config.botName}"${phoneNumber ? ' (phone pairing mode)' : ''}...`);

  const botState = {
    client: null,
    botId,
    config,
    qrCode: null,
    qrDataUrl: null,
    pairingCode: null,
    status: 'initializing',
    startedAt: Date.now(),
    hadDisconnectNotice: false,
  };
  activeBots.set(botId, botState);

  const clientOptions = {
    authStrategy: new LocalAuth({
      clientId: botId,
      // Absolute so wipes in cleanSession() hit the same dir regardless of pm2 cwd
      dataPath: path.join(__dirname, 'sessions'),
    }),
    puppeteer: {
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-first-run',
        '--disable-extensions',
        '--disable-default-apps',
        '--disable-translate',
        '--disable-sync',
        // keep the renderer from being throttled/frozen when the tab is
        // backgrounded — a throttled page stops answering message events
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--window-size=1280,800',
      ],
      defaultViewport: { width: 1280, height: 800 },
      timeout: 90000,
    },
    // Remote web-version: THE fix for the Sept-17 outage. WhatsApp drifts
    // its web build continuously; the library's bundled/local copy ages
    // and sessions hang at "authenticated, ready never fires". This pulls
    // the CURRENT compatible WA-Web build from the wppconnect community
    // archive at every launch (wa-web.js caches it locally after success,
    // so a transient GitHub failure falls back to the cached copy).
    webVersionCache: {
      type: 'remote',
      remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.3000.1047806989-alpha.html',
    },
  };

  if (phoneNumber) {
    clientOptions.pairWithPhoneNumber = {
      phoneNumber: String(phoneNumber),
      showNotification: true,
    };
  }

  const client = new Client(clientOptions);

  botState.client = client;

  // Pairing Code Event (Emitted by whatsapp-web.js when pairWithPhoneNumber is enabled)
  client.on('code', async (code) => {
    console.log(`[BotManager] ✅ Pairing code event received for "${config.botName}" (${phoneNumber}): ${code}`);
    botState.pairingCode = code;
    botState.pairingCodeExpiresAt = Date.now() + 180000;
    botState.status = 'waiting_scan';
    await firestore.updateBotStatus(botId, 'waiting_scan').catch(() => {});
  });

  // QR Code Event (Emitted when QR mode is used)
  client.on('qr', async (qr) => {
    console.log(`[BotManager] 📷 QR generated for "${config.botName}"`);
    botState.qrCode = qr;
    botState.status = 'waiting_scan';

    try {
      botState.qrDataUrl = await QRCode.toDataURL(qr, {
        width: 300,
        margin: 2,
        color: { dark: '#000000', light: '#ffffff' },
      });
    } catch (e) {
      console.error('[BotManager] QR generation error:', e.message);
    }

    await firestore.updateBotStatus(botId, 'waiting_scan').catch(() => {});
  });

  // Authenticated Event (Fires immediately upon pairing code / QR scan confirmation)
  client.on('authenticated', async () => {
    console.log(`[BotManager] 🔑 Bot "${config.botName}" authenticated with WhatsApp!`);
    botState.status = 'connected';
    botState.qrCode = null;
    botState.qrDataUrl = null;
    botState.pairingCode = null;
    botState.pairingCodeExpiresAt = null;

    // 'ready' can lag behind authentication by minutes (history sync) or,
    // in rare page states, never fire at all — the watchdog must be on
    // duty from the auth moment either way. healthMonitor enforces the
    // ready-late cap; here we just arm it early.
    botState.readySeen = false;
    botState.authenticatedAt = Date.now();
    healthMonitor.startWatch(botId);

    await firestore.updateBotStatus(botId, 'connected', {
      whatsappConnectedAt: new Date().toISOString(),
    }).catch(() => {});
  });

  // Ready Event (Full sync completed)
  client.on('ready', async () => {
    console.log(`[BotManager] 🚀 Bot "${config.botName}" fully ready and synced on WhatsApp!`);
    botState.status = 'connected';
    botState.readySeen = true;
    botState.qrCode = null;
    botState.qrDataUrl = null;
    botState.pairingCode = null;
    botState.pairingCodeExpiresAt = null;

    const phoneNum = client.info?.wid?.user || '';
    await firestore.updateBotStatus(botId, 'connected', {
      whatsappConnectedAt: new Date().toISOString(),
      ...(phoneNum ? { whatsappNumber: phoneNum, phoneNumber: phoneNum } : {}),
    }).catch(() => {});

    // ─── Self-healing bookkeeping ───
    reconnectAttempts.delete(botId);
    healthMonitor.startWatch(botId);
    healthMonitor.markReady(botId);
    lastHealthyAt.set(botId, Date.now());
    // A session can be born paralyzed: ceremony passes (auth+ready) while
    // the channel never wakes. A soft probe shortly after birth adds a
    // data point (throws are debounced — only sustained failure heals).
    healthMonitor.scheduleBirthProbe(botId, 90000);

    // Missed-message recovery: only when THIS ready follows a known
    // disconnect inside this process (never on a fresh first link — the
    // merchant's personal unread chats must not be answered by the bot).
    const since = lastDisconnectAt.get(botId);
    if (since) {
      const recoverSince = Math.max(Date.now() - 6 * 60 * 60 * 1000, since - 120000);
      lastDisconnectAt.delete(botId);
      await recoverUnreadMessages(botState, recoverSince);
    }

    // The merchant was told we dropped — tell him we came back on our own.
    if (botState.hadDisconnectNotice) {
      botState.hadDisconnectNotice = false;
      if (config.userId && config.notificationsEnabled !== false) {
        firestore.createNotification({
          userId: config.userId,
          botId,
          type: 'system',
          title: 'عاد اتصال واتساب تلقائياً',
          body: `البوت "${config.botName}" استعاد اتصاله بنفسه — وتمت معالجة أي رسائل وصلت أثناء الانقطاع.`,
        }).catch(() => {});
      }
    }
  });

  // Authentication Failure
  client.on('auth_failure', async (msg) => {
    console.error(`[BotManager] Auth failure for "${config.botName}":`, msg);
    botState.status = 'auth_failure';
    healthMonitor.stopWatch(botId);
    healthMonitor.forget(botId);
    reconnectAttempts.delete(botId);
    lastDisconnectAt.delete(botId);
    lastHealthyAt.delete(botId);
    firestore.updateBotStatus(botId, 'auth_failure').catch(() => {});
    // Release the slot immediately, and only if THIS client still owns
    // it (a restart may have replaced the map entry meanwhile)
    if (activeBots.get(botId) === botState) activeBots.delete(botId);
    // Destroy the browser explicitly — dropping the map entry alone
    // leaks a Chromium process and its memory
    try { await client.destroy(); } catch {}
    // The saved session was rejected — it is dead weight on disk
    cleanSession(botId);
  });

  // Disconnected — the moment of truth: a real logout means the merchant
  // must re-link, but the overwhelming majority of disconnects (network
  // blips, renderer crash, NAVIGATION, timeouts) leave the SAVED session
  // perfectly valid. Those we auto-restart on the saved session instead
  // of demanding the merchant scan a QR again.
  client.on('disconnected', async (reason) => {
    if (botState.disconnectHandled) return; // destroy() can re-emit — handle once
    botState.disconnectHandled = true;
    const reasonStr = String(reason || '');
    const isLogout = /LOGOFF|LOGOUT|auth/i.test(reasonStr);
    console.log(`[BotManager] Bot "${config.botName}" disconnected (${reasonStr}) — ${isLogout ? 'logout, merchant must re-link' : 'transient, auto-restarting on saved session'}`);
    botState.status = isLogout ? 'disconnected' : 'reconnecting';
    healthMonitor.stopWatch(botId);
    lastHealthyAt.delete(botId);
    lastDisconnectAt.set(botId, Date.now());

    firestore.updateBotStatus(botId, isLogout ? 'disconnected' : 'reconnecting').catch(() => {});

    if (config.userId && config.notificationsEnabled !== false) {
      botState.hadDisconnectNotice = true;
      firestore.createNotification({
        userId: config.userId,
        botId,
        type: 'system',
        title: isLogout ? 'أُلغي ربط واتساب من الهاتف' : 'انقطع اتصال واتساب — الإنقاذ التلقائي جارٍ',
        body: isLogout
          ? `تم تسجيل خروج رقم البوت "${config.botName}" من واتساب. حُذفت الجلسة وكل المحادثات والعملاء المرتبطين بها من السيرفر نهائياً — أعد الربط من صفحة القنوات عند الحاجة.`
          : `البوت "${config.botName}" فقد الاتصال. المحرك يعيد الاتصال تلقائياً بالجلسة المحفوظة — لا حاجة لأي خطوة منك.`,
      }).catch(() => {});
    }

    // Release the slot immediately, and only if THIS client still owns
    // it (a restart may have replaced the map entry meanwhile)
    if (activeBots.get(botId) === botState) activeBots.delete(botId);
    // Destroy the browser explicitly — dropping the map entry alone
    // leaks a Chromium process and its memory
    try { await client.destroy(); } catch {}

    if (isLogout) {
      // The linking is dead BY THE MERCHANT'S OWN HAND on his phone —
      // nothing of this channel may remain on the server: saved session,
      // conversations, leads, reminders. Orders survive (business records).
      cleanSession(botId);
      await firestore.purgeBotChannelData(botId).catch(() => {});
      healthMonitor.forget(botId);
      reconnectAttempts.delete(botId);
      lastDisconnectAt.delete(botId);
      lastHealthyAt.delete(botId);
      console.log(`[BotManager] 🧨 WhatsApp-side logout for "${config.botName}" — session + channel data purged from server.`);
      return;
    }

    scheduleAutoRestart(botId, config);
  });

  // Incoming Messages
  // Fragmented customer messages ("سلام" / "شحال" / "المنتج") go through a
  // per-customer debounce queue: one merged AI call per intent instead of
  // parallel racing calls. Media flushes immediately.
  client.on('message', (msg) => {
    console.log(`[BotManager] Incoming WhatsApp message from ${msg.from}: "${msg.body}"`);
    if (msg.fromMe) return;
    // Fresh traffic = the channel is provably alive — resets the liveness
    // probe countdown so an active bot is never probed needlessly
    healthMonitor.markIncoming(botId);
    messageQueue.enqueueCustomerMessage(botId, msg, async (items) => {
      for (const item of items) {
        await handleMessage(item, config);
      }
    });
  });

  client.on('message_create', async (msg) => {
    if (msg.fromMe) {
      console.log(`[BotManager] Outgoing/Self message: "${msg.body}"`);
    }
  });

  // Error Handler
  client.on('error', (err) => {
    console.error(`[BotManager] Client error "${config.botName}":`, err.message);
  });

  // Initialize client with retry — exposed as initPromise so concurrent
  // create calls join this attempt instead of racing over the same profile
  botState.initPromise = (async () => {
    let retries = 0;
    const maxRetries = 2;

    while (retries <= maxRetries) {
      try {
        await client.initialize();
        break;
      } catch (err) {
        retries++;
        console.error(`[BotManager] Init attempt ${retries}/${maxRetries + 1} failed for "${config.botName}":`, err.message);

        if (retries > maxRetries) {
          console.error(`[BotManager] All retries exhausted for "${config.botName}". Marking as error.`);
          botState.status = 'error';
          await firestore.updateBotStatus(botId, 'error').catch(() => {});
          // Release the browser and the concurrency slot — leaking either
          // starves every future create attempt on the 4GB VPS
          try { await client.destroy(); } catch {}
          if (activeBots.get(botId) === botState) activeBots.delete(botId);
          // The "linking sometimes fails" complaint: a failed boot no longer
          // dead-ends the merchant — it goes into the same backoff revive
          // queue, and the frontend /qr polling picks the fresh QR up.
          scheduleAutoRestart(botId, config);
          break;
        }

        try { await client.destroy(); } catch {}
        console.log(`[BotManager] Retrying in 3s...`);
        await new Promise(r => setTimeout(r, 3000));
      }
    }
  })();
  await botState.initPromise;

  return botState;
}

// ─── Self-Healing: auto-restart / heal / missed-message replay ─

// Revive a bot on its SAVED session with escalating backoff. Called by
// the 'disconnected' handler (transient reasons) and by healBot().
function scheduleAutoRestart(botId, config) {
  if (reconnectTimers.has(botId)) return; // one pending revive per bot
  const attempts = reconnectAttempts.get(botId) || 0;
  if (attempts >= RESTART_DELAYS.length) {
    console.error(`[BotManager] ❌ All ${RESTART_DELAYS.length} auto-restart attempts exhausted for "${config.botName}" — handing back to the merchant.`);
    firestore.updateBotStatus(botId, 'disconnected').catch(() => {});
    if (config.userId && config.notificationsEnabled !== false) {
      firestore.createNotification({
        userId: config.userId,
        botId,
        type: 'system',
        title: 'تعذر استعادة الاتصال تلقائياً',
        body: `البوت "${config.botName}" لم ينجح في إعادة الاتصال — يرجى إعادة الربط من صفحة القنوات.`,
      }).catch(() => {});
    }
    return;
  }
  const delay = RESTART_DELAYS[attempts];
  reconnectAttempts.set(botId, attempts + 1);
  console.log(`[BotManager] ♻️ Auto-restart #${attempts + 1} for "${config.botName}" in ${delay / 1000}s`);
  const timer = setTimeout(async () => {
    reconnectTimers.delete(botId);
    try {
      await createWhatsAppBot(botId, config);
    } catch (e) {
      console.error(`[BotManager] Auto-restart failed for "${config.botName}":`, e.message);
      scheduleAutoRestart(botId, config); // next backoff rung
    }
  }, delay);
  reconnectTimers.set(botId, timer);
}

// Called by the health watchdog when a "connected" bot is actually deaf
// (zombie page) or stuck initializing. Surgical: destroy + revive on the
// saved session. The recovery window is anchored so messages that
// arrived while the bot was deaf get replayed after it revives.
async function healBot(botId, reason = 'unhealthy') {
  const entry = activeBots.get(botId);
  if (!entry) return;
  console.warn(`[BotManager] 🩺 Healing bot "${entry.config?.botName || botId}" — ${reason}`);
  lastDisconnectAt.set(botId, Date.now());
  reconnectTimers.delete(botId); // heal supersedes any pending revive
  try {
    await Promise.race([
      entry.client.destroy().catch(() => {}),
      new Promise(r => setTimeout(r, 5000)),
    ]);
  } catch { /* best effort */ }
  if (activeBots.get(botId) === entry) activeBots.delete(botId);
  scheduleAutoRestart(botId, entry.config);
}

// Watchdog bookkeeping — lastHealthyAt anchors the replay window when a
// zombie is detected (the bot may have been deaf since the LAST pass).
function markHealthy(botId) {
  lastHealthyAt.set(botId, Date.now());
}

function markUnhealthy(botId) {
  // keep the value — healBot uses the LAST healthy pass as the window start
  const last = lastHealthyAt.get(botId);
  if (!last) lastHealthyAt.set(botId, Date.now() - 2 * 60 * 1000);
}

// Replay customer messages that arrived while the session was deaf.
// Reads each chat's server-side unread counter, so messages answered
// live are never re-processed. Only used on reconnects — never on a
// fresh first link (the merchant's personal unread chats must not be
// answered by the bot).
async function recoverUnreadMessages(botState, sinceMs) {
  const { client, config } = botState;
  try {
    const chats = await client.getChats();
    let recovered = 0;
    for (const chat of chats) {
      const unread = chat.unreadCount || 0;
      if (unread < 1) continue;
      let msgs = [];
      try {
        msgs = await chat.fetchMessages({ limit: Math.min(unread, 20) });
      } catch (e) {
        console.warn(`[Recovery] fetch failed for ${chat.id?._serialized || 'chat'}:`, e.message);
        continue;
      }
      for (const m of msgs) {
        if (m.fromMe) continue;
        if ((m.timestamp * 1000) < sinceMs) continue;
        console.log(`[Recovery] 🔁 Replaying missed message from ${m.from}: "${(m.body || '').slice(0, 60)}"`);
        messageQueue.enqueueCustomerMessage(botState.botId, m, async (items) => {
          for (const item of items) {
            await handleMessage(item, config);
          }
        });
        recovered++;
      }
      try { await chat.sendSeen(); } catch { /* cosmetic */ }
    }
    if (recovered > 0) {
      console.log(`[Recovery] ✅ ${recovered} missed message(s) replayed for "${config.botName}"`);
    }
  } catch (e) {
    console.warn(`[Recovery] Pass failed for "${config.botName}":`, e.message);
  }
}

// Stop Bot & Purge Session
async function stopWhatsAppBot(botId, purgeSession = true) {
  // A merchant-initiated stop must silence every self-healing path —
  // the bot must not resurrect itself behind his back
  const pendingTimer = reconnectTimers.get(botId);
  if (pendingTimer) {
    clearTimeout(pendingTimer);
    reconnectTimers.delete(botId);
  }
  reconnectAttempts.delete(botId);
  lastDisconnectAt.delete(botId);
  lastHealthyAt.delete(botId);
  healthMonitor.stopWatch(botId);
  healthMonitor.forget(botId);

  const entry = activeBots.get(botId);
  activeBots.delete(botId);

  if (entry && entry.client) {
    try {
      if (entry.status === 'connected') {
        console.log(`[BotManager] Logging out WhatsApp session for "${entry.config?.botName || botId}"...`);
        await Promise.race([
          entry.client.logout().catch(() => {}),
          new Promise(r => setTimeout(r, 2000)),
        ]);
      }
    } catch (e) {
      console.warn('[BotManager] Logout notice:', e.message);
    }

    try {
      await Promise.race([
        entry.client.destroy().catch(() => {}),
        new Promise(r => setTimeout(r, 3000)),
      ]);
      console.log(`[BotManager] Bot "${entry.config?.botName || botId}" stopped.`);
    } catch (e) {
      console.warn('[BotManager] Destroy notice:', e.message);
    }
  }

  if (purgeSession) {
    cleanSession(botId);
  }

  await firestore.updateBotStatus(botId, 'disconnected', {
    whatsappConnectedAt: null,
  }).catch(() => {});
}

function getBotState(botId) {
  return activeBots.get(botId) || null;
}

function getQRCode(botId) {
  const state = activeBots.get(botId);
  if (!state) return null;
  return {
    status: state.status,
    qrDataUrl: state.qrDataUrl,
    pairingCode: state.pairingCode,
    pairingCodeExpiresAt: state.pairingCodeExpiresAt,
  };
}

async function restoreBotsOnStartup() {
  try {
    const bots = await firestore.getActiveBots();
    const whatsappBots = bots.filter(b => {
      const sessionDir = path.join(__dirname, 'sessions', `session-${b.id}`);
      const hasSavedSession = fs.existsSync(sessionDir);
      return hasSavedSession && (b.whatsappStatus === 'connected' || b.status === 'connected');
    });
    console.log(`[BotManager] Found ${whatsappBots.length} WhatsApp bot(s) to restore.`);

    // Restore in small staggered groups: each bot boots its own
    // Chromium (~150-300MB), and launching them all at once on a
    // small VPS spikes memory past PM2's restart cap
    const CHUNK = 3;
    for (let i = 0; i < whatsappBots.length; i += CHUNK) {
      const group = whatsappBots.slice(i, i + CHUNK);
      await Promise.all(group.map(bot =>
        createWhatsAppBot(bot.id, bot).catch(err =>
          console.error(`[BotManager] Restore failed for "${bot.botName}":`, err.message)
        )
      ));
      if (i + CHUNK < whatsappBots.length) {
        console.log(`[BotManager] Restored ${Math.min(i + CHUNK, whatsappBots.length)}/${whatsappBots.length} — pausing before next group...`);
        await new Promise(r => setTimeout(r, 5000));
      }
    }
  } catch (err) {
    console.error('[BotManager] Restore failed:', err.message);
  }
}

function getAllBotStatuses() {
  const statuses = [];
  for (const [id, state] of activeBots) {
    statuses.push({
      id,
      botName: state.config.botName,
      status: state.status,
      hasQR: !!state.qrDataUrl,
    });
  }
  return statuses;
}

module.exports = {
  createWhatsAppBot,
  stopWhatsAppBot,
  getBotState,
  getQRCode,
  restoreBotsOnStartup,
  getAllBotStatuses,
  healBot,
  markHealthy,
  markUnhealthy,
};

// Wire the watchdog to us (injected, not required — avoids a load cycle)
healthMonitor.install({ getBotState, healBot, markHealthy, markUnhealthy });