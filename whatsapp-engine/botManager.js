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

// Active bots: botId -> { client, config, qrCode, status }
const activeBots = new Map();

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
    config,
    qrCode: null,
    qrDataUrl: null,
    pairingCode: null,
    status: 'initializing',
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
        '--window-size=1280,800',
      ],
      defaultViewport: { width: 1280, height: 800 },
      timeout: 60000,
    },
    // Local cache: the remote wppconnect archive 404s for the pinned web
    // version, which made every boot fall back to a fragile live-page load
    webVersionCache: {
      type: 'local',
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

    await firestore.updateBotStatus(botId, 'connected', {
      whatsappConnectedAt: new Date().toISOString(),
    }).catch(() => {});
  });

  // Ready Event (Full sync completed)
  client.on('ready', async () => {
    console.log(`[BotManager] 🚀 Bot "${config.botName}" fully ready and synced on WhatsApp!`);
    botState.status = 'connected';
    botState.qrCode = null;
    botState.qrDataUrl = null;
    botState.pairingCode = null;
    botState.pairingCodeExpiresAt = null;

    await firestore.updateBotStatus(botId, 'connected', {
      whatsappConnectedAt: new Date().toISOString(),
    }).catch(() => {});
  });

  // Authentication Failure
  client.on('auth_failure', async (msg) => {
    console.error(`[BotManager] Auth failure for "${config.botName}":`, msg);
    botState.status = 'auth_failure';
    firestore.updateBotStatus(botId, 'auth_failure').catch(() => {});
    // Release the slot immediately, and only if THIS client still owns
    // it (a restart may have replaced the map entry meanwhile)
    if (activeBots.get(botId) === botState) activeBots.delete(botId);
    // Destroy the browser explicitly — dropping the map entry alone
    // leaks a Chromium process and its memory
    try { await client.destroy(); } catch {}
  });

  // Disconnected
  client.on('disconnected', async (reason) => {
    console.log(`[BotManager] Bot "${config.botName}" disconnected:`, reason);
    botState.status = 'disconnected';
    firestore.updateBotStatus(botId, 'disconnected').catch(() => {});
    // Release the slot immediately, and only if THIS client still owns
    // it (a restart may have replaced the map entry meanwhile)
    if (activeBots.get(botId) === botState) activeBots.delete(botId);
    // Destroy the browser explicitly — dropping the map entry alone
    // leaks a Chromium process and its memory
    try { await client.destroy(); } catch {}
  });

  // Incoming Messages
  client.on('message', async (msg) => {
    console.log(`[BotManager] Incoming WhatsApp message from ${msg.from}: "${msg.body}"`);
    if (msg.fromMe) return;
    await handleMessage(msg, config);
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

// Stop Bot & Purge Session
async function stopWhatsAppBot(botId, purgeSession = true) {
  const entry = activeBots.get(botId);
  if (entry) {
    try {
      if (entry.status === 'connected' && entry.client) {
        console.log(`[BotManager] 🚪 Logging out WhatsApp session for "${entry.config.botName}"...`);
        await entry.client.logout().catch(() => {});
      }
    } catch (e) {
      console.warn('[BotManager] Logout notice:', e.message);
    }

    try {
      await entry.client.destroy();
      console.log(`[BotManager] Bot "${entry.config.botName}" stopped.`);
    } catch (e) {
      console.error(`[BotManager] Error stopping bot:`, e.message);
    }
    activeBots.delete(botId);
  }

  if (purgeSession) {
    cleanSession(botId);
  }

  await firestore.updateBotStatus(botId, 'disconnected').catch(() => {});
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
    const whatsappBots = bots.filter(b => b.whatsappEnabled && b.whatsappStatus === 'connected');
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
};
