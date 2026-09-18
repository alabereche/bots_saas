// ═══════════════════════════════════════════════════════════════
// BotForge WhatsApp Engine — Bot Manager (WPPConnect)
// Actively-maintained library replacing the stagnant whatsapp-web.js.
// Sessions persist as WPPConnect tokens (JSON) — instant restore on
// restart, no ready-hang, no page-level getter errors.
// ═══════════════════════════════════════════════════════════════

const path = require('path');
const fs = require('fs');
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
async function createWhatsAppBot(botId, config, phoneNumber = null, forceNew = false) {
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
      // Phone pairing: register by number + code instead of QR
      ...(phoneNumber ? { phonePairing: { phoneNumber: String(phoneNumber) } } : {}),
      log: (level, message) => {
        if (level === 'error') console.error(`[WPPConnect] ${message}`);
      },
    };

    const client = await wpp.create(createOpts);
    botState.client = client;

    // ─── QR event (fresh links) ───
    client.onQRCode?.((qrData) => {
      console.log(`[BotManager] QR generated for "${config.botName}"`);
      botState.qrCode = qrData;
      QRCode.toDataURL(qrData, { width: 300, margin: 2 })
        .then(url => { botState.qrDataUrl = url; })
        .catch(() => {});
      botState.status = 'waiting_scan';
    });

    // ─── Phone pairing code event ───
    client.onPairingCode?.((code) => {
      console.log(`[BotManager] Pairing code for "${config.botName}": ${code}`);
      botState.pairingCode = code;
      botState.pairingCodeExpiresAt = Date.now() + 180000;
      botState.status = 'waiting_scan';
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

    // ─── Status events (connected / disconnected) ───
    client.onStatus?.((status) => {
      console.log(`[BotManager] WPPConnect status "${config.botName}": ${status}`);
      if (status === 'CONNECTED' || status === 'authenticated') {
        botState.status = 'connected';
        botState.qrCode = null;
        botState.qrDataUrl = null;
        botState.pairingCode = null;
        healthMonitor.markReady(botId);
        healthMonitor.startWatch(botId);
        reconnectAttempts.delete(botId);
        lastHealthyAt.set(botId, Date.now());

        const phoneNum = client.getWideUserId?.() || '';
        firestore.updateBotStatus(botId, 'connected', {
          whatsappConnectedAt: new Date().toISOString(),
          ...(phoneNum ? { whatsappNumber: phoneNum, phoneNumber: phoneNum } : {}),
        }).catch(() => {});
      }
    });

    if (client.onDisconnected) {
      client.onDisconnected(async () => {
        console.log(`[BotManager] Bot "${config.botName}" disconnected.`);
        botState.status = 'reconnecting';
        healthMonitor.stopWatch(botId);
        lastDisconnectAt.set(botId, Date.now());
        firestore.updateBotStatus(botId, 'reconnecting').catch(() => {});
        if (config.userId && config.notificationsEnabled !== false) {
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
      });
    }

  } catch (err) {
    console.error(`[BotManager] WPPConnect init error for "${config.botName}":`, err.message);
    botState.status = 'error';
    firestore.updateBotStatus(botId, 'error').catch(() => {});
    if (activeBots.get(botId) === botState) activeBots.delete(botId);
    throw err;
  }

  return botState;
}

// ─── Stop Bot & Purge Session ─────────────────────────────────
async function stopWhatsAppBot(botId, purgeSession = true) {
  // Merchant stop wins over every self-healing path
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
    const whatsappBots = bots.filter(b => {
      const hasToken = fs.existsSync(path.join(TOKENS_DIR, b.id));
      return hasToken && (b.whatsappStatus === 'connected' || b.status === 'connected');
    });
    console.log(`[BotManager] Found ${whatsappBots.length} WhatsApp bot(s) to restore.`);
    for (const bot of whatsappBots) {
      await createWhatsAppBot(bot.id, bot).catch(err =>
        console.error(`[BotManager] Restore failed for "${bot.botName}":`, err.message)
      );
    }
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
};

// Wire the health monitor (injected to avoid a require cycle)
healthMonitor.install({ getBotState, healBot, markHealthy, markUnhealthy });
