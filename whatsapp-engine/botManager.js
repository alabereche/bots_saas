// ═══════════════════════════════════════════════════════════════
// BotForge WhatsApp Engine — Bot Manager (WPPConnect)
// Actively-maintained library replacing the stagnant whatsapp-web.js.
// Sessions persist as WPPConnect tokens (JSON) — instant restore on
// restart, no ready-hang, no page-level getter errors.
// ═══════════════════════════════════════════════════════════════

const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');
const wpp = require('@wppconnect-team/wppconnect');
const QRCode = require('qrcode');
const firestore = require('./firestore');
const { handleMessage } = require('./messageHandler');
const messageQueue = require('./messageQueue');
const healthMonitor = require('./healthMonitor');

// Active bots: botId -> { client, config, qrCode, status }
const activeBots = new Map();

// WPPConnect token persistence folder
const TOKENS_DIR = path.join(__dirname, 'tokens');
if (!fs.existsSync(TOKENS_DIR)) fs.mkdirSync(TOKENS_DIR, { recursive: true });

// ─── Self-healing state (same backoff ladder as the wa-web era) ──
const reconnectTimers = new Map();
const reconnectAttempts = new Map();
const lastDisconnectAt = new Map();
const lastHealthyAt = new Map();
const RESTART_DELAYS = [10000, 30000, 60000, 120000, 300000];

// Bots the merchant deliberately stopped — self-healing must respect this
const merchantStopped = new Set();

function clearMerchantStop(botId) {
  merchantStopped.delete(botId);
}

// ─── Unattended QR-wait reaper ────────────────────────────────
// autoClose is disabled (it killed QR sessions mid-scan), so an abandoned
// link would keep a Chromium page open indefinitely (~250MB each). Our own
// reaper releases the browser when nobody scans within the window. It also
// marks the bot merchant-stopped so the create-rejection does NOT schedule
// a restart churn loop.
const QR_WAIT_TIMEOUT_MS = parseInt(process.env.QR_WAIT_TIMEOUT_MINUTES || '10', 10) * 60 * 1000;
const qrWaitTimers = new Map();

function clearQrWaitTimeout(botId) {
  const t = qrWaitTimers.get(botId);
  if (t) {
    clearTimeout(t);
    qrWaitTimers.delete(botId);
  }
}

function armQrWaitTimeout(botId, config) {
  clearQrWaitTimeout(botId);
  const t = setTimeout(async () => {
    qrWaitTimers.delete(botId);
    const st = activeBots.get(botId);
    if (!st || st.status === 'connected') return;
    console.log(`[BotManager] QR wait timeout (${Math.round(QR_WAIT_TIMEOUT_MS / 60000)}min) for "${config.botName}" — releasing browser.`);
    merchantStopped.add(botId);
    try {
      if (st.client) {
        await Promise.race([
          st.client.close(),
          new Promise(r => setTimeout(r, 5000)),
        ]);
      } else {
        // In-flight wpp.create(): the browser isn't exposed yet — the only
        // lever is killing the Chromium holding this bot's token dir.
        await killPendingBrowser(botId);
      }
    } catch { /* best effort */ }
    if (activeBots.get(botId) === st) activeBots.delete(botId);
    firestore.updateBotStatus(botId, 'disconnected').catch(() => {});
  }, QR_WAIT_TIMEOUT_MS);
  qrWaitTimers.set(botId, t);
}

// Kills any Chromium holding this bot's token userDataDir. Needed because a
// create still awaiting its first QR never exposes a client object to close.
function killPendingBrowser(botId) {
  return new Promise((resolve) => {
    if (process.platform === 'win32') return resolve();
    execFile('pkill', ['-f', `whatsapp-engine/tokens/${botId}`], () => resolve());
  });
}

function cleanSession(botId) {
  try {
    const tokenDir = path.join(TOKENS_DIR, botId);
    if (fs.existsSync(tokenDir)) {
      fs.rmSync(tokenDir, { recursive: true, force: true });
      console.log(`[BotManager] Purged WPPConnect tokens for bot: ${botId}`);
    }
  } catch (e) {
    console.error(`[BotManager] Error cleaning session for bot ${botId}:`, e.message);
  }
}

// ─── Create a WhatsApp Bot (WPPConnect) ────────────────────────
// Join-or-refuse gate: two concurrent creates on one bot would launch TWO
// Chromiums on the same token dir ("browser is already running") and the
// loser's failure loop orphans the winner's QR state — the dashboard then
// polls an object nobody writes to (spinner forever). A plain re-open JOINS
// the pending session; a mode switch/forced relink is refused politely.
const pendingCreates = new Map();

function isCreating(botId) {
  return pendingCreates.has(botId);
}

async function createWhatsAppBot(botId, config, phoneNumber = null, forceNew = false) {
  const pending = pendingCreates.get(botId);
  if (pending) {
    if (!phoneNumber && !forceNew) {
      console.log(`[BotManager] Create already in flight for "${config.botName}" — joining the pending session.`);
      return pending;
    }
    const err = new Error('create already in flight');
    err.code = 'CREATE_IN_FLIGHT';
    throw err;
  }
  const p = createWhatsAppBotInner(botId, config, phoneNumber, forceNew).finally(() => {
    pendingCreates.delete(botId);
  });
  pendingCreates.set(botId, p);
  return p;
}

async function createWhatsAppBotInner(botId, config, phoneNumber = null, forceNew = false) {
  clearQrWaitTimeout(botId);
  if (activeBots.has(botId)) {
    const existing = activeBots.get(botId);
    if (existing.status === 'connected' && !phoneNumber && !forceNew) {
      console.log(`[BotManager] Bot "${config.botName}" already connected.`);
      return existing;
    }
    try { await existing.client?.close(); } catch {}
    if (activeBots.get(botId) === existing) activeBots.delete(botId);
  }

  if (phoneNumber || forceNew) {
    cleanSession(botId);
  }

  console.log(`[BotManager] Initializing WPPConnect bot "${config.botName}"...`);

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

  try {
    const createOpts = {
      session: botId,
      folderNameToken: path.join(TOKENS_DIR, botId),
      // Auto-close MUST be fully disabled: the 60s default (autoClose) and
      // the 3min device-sync cap (deviceSyncTimeout) both kill the session
      // before the merchant can scan the QR ("Auto Close Called").
      autoClose: 0,
      deviceSyncTimeout: 0,
      logQR: false, // QR reaches the dashboard via catchQR — no ASCII floods in pm2 logs
      puppeteerOptions: {
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
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding',
          '--window-size=1280,800',
        ],
      },
      // Phone pairing: top-level phoneNumber option + catchLinkCode callback
      // (the 2.x API — NOT the invalid phonePairing object form)
      ...(phoneNumber ? { phoneNumber: String(phoneNumber) } : {}),

      // QR events fire DURING create() — before the promise resolves —
      // so they must be captured here, not via listeners on the client.
      catchQR: (base64Image, _asciiQr, attempt, urlCode) => {
        console.log(`[BotManager] QR generated for "${config.botName}" (attempt ${attempt})`);
        botState.qrCode = urlCode || botState.qrCode;
        // base64Image is canvas.toDataURL() — directly renderable; fall back
        // to encoding the urlCode ourselves if the canvas scrape failed.
        if (typeof base64Image === 'string' && base64Image.startsWith('data:')) {
          botState.qrDataUrl = base64Image;
        } else if (urlCode) {
          QRCode.toDataURL(urlCode, { width: 300, margin: 2 })
            .then(url => { botState.qrDataUrl = url; })
            .catch(() => {});
        }
        botState.status = 'waiting_scan';
        armQrWaitTimeout(botId, config);
      },

      // Pairing code events also fire during create()
      catchLinkCode: (code) => {
        console.log(`[BotManager] Pairing code for "${config.botName}": ${code}`);
        botState.pairingCode = code;
        botState.pairingCodeExpiresAt = Date.now() + 180000;
        botState.status = 'waiting_scan';
        armQrWaitTimeout(botId, config);
      },

      // Authoritative lifecycle signals (the only "connected" truth)
      statusFind: (status) => {
        console.log(`[BotManager] WPPConnect status "${config.botName}": ${status}`);
        if (status === 'inChat') {
          botState.status = 'connected';
          botState.qrCode = null;
          botState.qrDataUrl = null;
          botState.pairingCode = null;
          botState.hadDisconnectNotice = false;
          merchantStopped.delete(botId);
          reconnectAttempts.delete(botId);
          lastHealthyAt.set(botId, Date.now());
          healthMonitor.markReady(botId);
          healthMonitor.startWatch(botId);
          // A revived session can be born paralyzed — probe it shortly
          // after birth (the 9-hour silent-death autopsy lesson)
          healthMonitor.scheduleBirthProbe(botId);
          clearQrWaitTimeout(botId);
          // Phone number is fetched after create() resolves (see below) —
          // `client` is still uninitialized while statusFind fires.
          firestore.updateBotStatus(botId, 'connected', {
            whatsappConnectedAt: new Date().toISOString(),
          }).catch(() => {});
        } else if (status === 'qrReadSuccess') {
          botState.status = 'syncing';
        } else if (status === 'notLogged') {
          if (botState.status !== 'connected') botState.status = 'waiting_scan';
        } else if (status === 'isLogged') {
          // Token restored — no scan needed; stay 'initializing' until inChat.
        } else if (status === 'disconnectedMobile' || status === 'serverClose' || status === 'browserClose') {
          handleDisconnect(botId, config, `statusFind: ${status}`);
        }
        // qrReadError / qrReadFail / autocloseCalled / phoneNotConnected:
        // create() rejects on its own for the fatal ones — the catch below
        // schedules the retry.
      },

      log: (level, message) => {
        if (level === 'error') console.error(`[WPPConnect] ${message}`);
      },
    };

    const client = await wpp.create(createOpts);
    botState.client = client;

    // Connected via statusFind('inChat') during create — enrich the bot
    // document with the linked phone number now that the client is live.
    if (botState.status === 'connected') {
      Promise.race([
        client.getHostDevice(),
        new Promise(r => setTimeout(r, 8000)),
      ]).then(hd => {
        const phoneNum = String(hd?.wid?.user || hd?.phone_number || '').replace(/\D/g, '');
        if (phoneNum) {
          firestore.updateBotStatus(botId, 'connected', {
            whatsappNumber: phoneNum,
            phoneNumber: phoneNum,
          }).catch(() => {});
        }
      }).catch(() => {});
    }

    // ─── Live connection-state changes (post-login) ───
    client.onStateChange?.((state) => {
      if (state === 'CONNECTED') {
        healthMonitor.markReady(botId);
        healthMonitor.startWatch(botId);
      } else if (state === 'UNPAIRED' || state === 'UNPAIRED_IDLE') {
        handleDisconnect(botId, config, `socket state: ${state}`);
      } else if (state === 'CONFLICT' || state === 'TIMEOUT') {
        console.warn(`[BotManager] Socket "${state}" for "${config.botName}" — healing.`);
        const entry = activeBots.get(botId);
        if (entry) healBot(botId, `socket state: ${state}`);
      }
    });

    // ─── Incoming messages ───
    client.onMessage(async (msg) => {
      if (msg.fromMe) return;
      if (msg.isGroupMsg || (msg.from && msg.from.includes('@g.us'))) return;
      if (msg.from === 'status@broadcast') return;

      // Fresh traffic = proof of life
      healthMonitor.markIncoming(botId);

      const normalized = {
        from: msg.from,
        to: msg.to || '',
        body: msg.content || msg.text || '',
        type: msg.type || 'chat',
        hasMedia: !!msg.isMedia,
        mimetype: msg.mimetype || '',
        timestamp: msg.timestamp || Date.now(),
        userName: msg.sender?.pushname || msg.notification?.name || '',
        client,       // transport for replies
        _raw: msg,    // WPPConnect original
      };

      messageQueue.enqueueCustomerMessage(botId, normalized, async (items) => {
        for (const item of items) {
          await handleMessage(item, config);
        }
      });
    });

  } catch (err) {
    console.error(`[BotManager] WPPConnect init error for "${config.botName}":`, err.message);
    botState.status = 'error';
    firestore.updateBotStatus(botId, 'error').catch(() => {});
    if (activeBots.get(botId) === botState) activeBots.delete(botId);
    // Transient init failures (browser crash, page closed) must self-heal —
    // a retry regenerates the QR so the dashboard picks it up automatically.
    if (!merchantStopped.has(botId)) {
      if (/already running/i.test(err.message || '')) {
        // A zombie Chromium holds the token dir (crashed create, rapid
        // double-click era) — free it or every retry hits the same wall.
        await killPendingBrowser(botId);
      }
      scheduleAutoRestart(botId, config);
    }
    throw err;
  }

  return botState;
}

// ─── Unified disconnect flow (socket states + statusFind) ─────
function handleDisconnect(botId, config, reason = 'unknown') {
  if (merchantStopped.has(botId)) return;
  // An in-flight create owns its own recovery — touching the map here would
  // orphan the very state object its catchQR/statusFind are writing into.
  if (pendingCreates.has(botId)) return;
  const botState = activeBots.get(botId);
  if (!botState || botState.status === 'reconnecting') return;

  console.log(`[BotManager] Bot "${config?.botName || botId}" disconnected (${reason}).`);
  botState.status = 'reconnecting';
  healthMonitor.stopWatch(botId);
  lastDisconnectAt.set(botId, Date.now());
  firestore.updateBotStatus(botId, 'reconnecting').catch(() => {});
  if (config?.userId && config.notificationsEnabled !== false && !botState.hadDisconnectNotice) {
    botState.hadDisconnectNotice = true;
    firestore.createNotification({
      userId: config.userId,
      botId,
      type: 'system',
      title: 'انقطع اتصال واتساب — الإنقاذ التلقائي جارٍ',
      body: `البوت "${config.botName}" فقد الاتصال. المحرك يعيد الاتصال تلقائياً بالجلسة المحفوظة — لا حاجة لأي خطوة منك.`,
    }).catch(() => {});
  }
  if (activeBots.get(botId) === botState) activeBots.delete(botId);
  scheduleAutoRestart(botId, config);
}

// ─── Stop Bot & Purge Session ─────────────────────────────────
async function stopWhatsAppBot(botId, purgeSession = true) {
  // Merchant stop wins over every self-healing path
  merchantStopped.add(botId);
  clearQrWaitTimeout(botId);
  const pendingTimer = reconnectTimers.get(botId);
  if (pendingTimer) {
    clearTimeout(pendingTimer);
    reconnectTimers.delete(botId);
  }
  reconnectAttempts.delete(botId);
  lastDisconnectAt.delete(botId);
  lastHealthyAt.delete(botId);
  healthMonitor.forget(botId);

  const entry = activeBots.get(botId);
  activeBots.delete(botId);

  if (entry && entry.client) {
    try {
      await Promise.race([
        entry.client.close(),
        new Promise(r => setTimeout(r, 5000)),
      ]);
      console.log(`[BotManager] Bot "${entry.config?.botName || botId}" stopped.`);
    } catch (e) {
      console.warn('[BotManager] Close notice:', e.message);
    }
  } else if (pendingCreates.has(botId)) {
    // Stop during an in-flight link: no client exists yet — kill the
    // Chromium holding the token dir so the pending create rejects and
    // nothing keeps waiting for a scan the merchant cancelled.
    await killPendingBrowser(botId);
  }

  if (purgeSession) {
    cleanSession(botId);
  }

  firestore.updateBotStatus(botId, 'disconnected', {
    whatsappConnectedAt: null,
  }).catch(() => {});
}

// ─── State Accessors ──────────────────────────────────────────
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
    // Orphan sweep BEFORE restoring: the dashboard's bot-delete removes only
    // the Firestore doc — it never tells the engine — so every deleted bot
    // left a full Chromium profile here forever (~50-200MB each, and they
    // pile up across create/delete cycles). Any folder without a live bot
    // is dead weight: sweep it at every boot.
    const activeIds = new Set(bots.map(b => b.id));
    const tokenEntries = fs.existsSync(TOKENS_DIR) ? fs.readdirSync(TOKENS_DIR) : [];
    let swept = 0;
    for (const entry of tokenEntries) {
      if (!activeIds.has(entry)) {
        fs.rmSync(path.join(TOKENS_DIR, entry), { recursive: true, force: true });
        swept++;
      }
    }
    if (swept > 0) {
      console.log(`[BotManager] 🧹 Swept ${swept} orphaned token folder(s) (bots deleted from the dashboard).`);
    }

    // Restore by TOKEN PRESENCE, not by the stored status label. The label
    // ('error'/'disconnected') gets written by transient failures (browser
    // lock ladders, the unattended-QR reaper, crash recovery) — trusting it
    // made every engine restart abandon bots whose tokens were perfectly
    // valid, which read to the owner as "every update breaks the linking".
    // The token dir is the truth: a valid token reconnects in seconds; a
    // dead one produces a QR through the normal catchQR flow. Deliberate
    // unlink purges the dir (not restored — correct), and paused
    // ('disabled') bots are excluded upstream by getActiveBots.
    const whatsappBots = bots.filter(b => fs.existsSync(path.join(TOKENS_DIR, b.id)));
    console.log(`[BotManager] Found ${whatsappBots.length} WhatsApp bot(s) to restore (by token presence).`);
    // Fire-and-forget with a stagger: wpp.create() BLOCKS until inChat, and
    // an expired token can sit in QR-wait indefinitely — awaiting inside the
    // loop would stall every bot after the first stale one. 5s between boots
    // keeps the Chromium startup spike off the RAM ceiling.
    whatsappBots.forEach((bot, i) => {
      setTimeout(() => {
        createWhatsAppBot(bot.id, bot).catch(err =>
          console.error(`[BotManager] Restore failed for "${bot.botName}":`, err.message)
        );
      }, i * 5000);
    });
  } catch (err) {
    console.error('[BotManager] Restore failed:', err.message);
  }
}

function getAllBotStatuses() {
  const statuses = [];
  activeBots.forEach((state, id) => {
    statuses.push({
      id,
      botName: state.config.botName,
      status: state.status,
      hasQR: !!state.qrDataUrl,
    });
  });
  return statuses;
}

// ─── Heal: close and restart on the SAME token (no re-scan) ──
async function healBot(botId, reason = 'unhealthy') {
  const entry = activeBots.get(botId);
  if (!entry) return;
  console.warn(`[BotManager] Healing bot "${entry.config?.botName || botId}" — ${reason}`);
  lastDisconnectAt.set(botId, Date.now());
  reconnectTimers.delete(botId);
  clearQrWaitTimeout(botId);
  try {
    await Promise.race([
      entry.client?.close(),
      new Promise(r => setTimeout(r, 5000)),
    ]);
  } catch { /* best effort */ }
  if (activeBots.get(botId) === entry) activeBots.delete(botId);
  scheduleAutoRestart(botId, entry.config);
}

function markHealthy(botId) {
  lastHealthyAt.set(botId, Date.now());
}

function markUnhealthy(botId) {
  if (!lastHealthyAt.has(botId)) lastHealthyAt.set(botId, Date.now() - 120000);
}

// ─── Auto-restart with backoff ────────────────────────────────
function scheduleAutoRestart(botId, config) {
  if (reconnectTimers.has(botId)) return;
  const attempts = reconnectAttempts.get(botId) || 0;
  if (attempts >= RESTART_DELAYS.length) {
    console.error(`[BotManager] All ${RESTART_DELAYS.length} auto-restart attempts exhausted for "${config.botName}".`);
    firestore.updateBotStatus(botId, 'disconnected').catch(() => {});
    if (config.userId && config.notificationsEnabled !== false) {
      firestore.createNotification({
        userId: config.userId,
        botId,
        type: 'system',
        title: 'تعذّر استعادة الاتصال تلقائياً',
        body: `البوت "${config.botName}" لم ينجح في إعادة الاتصال — يرجى إعادة الربط من صفحة القنوات.`,
      }).catch(() => {});
    }
    return;
  }
  const delay = RESTART_DELAYS[attempts];
  reconnectAttempts.set(botId, attempts + 1);
  console.log(`[BotManager] Auto-restart #${attempts + 1} for "${config.botName}" in ${delay / 1000}s`);
  const timer = setTimeout(async () => {
    reconnectTimers.delete(botId);
    try {
      await createWhatsAppBot(botId, config);
    } catch (e) {
      console.error(`[BotManager] Auto-restart failed for "${config.botName}":`, e.message);
      scheduleAutoRestart(botId, config);
    }
  }, delay);
  reconnectTimers.set(botId, timer);
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
  clearMerchantStop,
  isCreating,
};

// Wire the health monitor (injected to avoid a require cycle)
healthMonitor.install({ getBotState, healBot, markHealthy, markUnhealthy });
