// ═══════════════════════════════════════════════════════════════
// BotForge WhatsApp Engine — Bot Manager
// Creates, manages, and destroys WhatsApp client instances
// with Cloud Firestore integration
// ═══════════════════════════════════════════════════════════════

const { Client, LocalAuth } = require('whatsapp-web.js');
const QRCode = require('qrcode');
const firestore = require('./firestore');
const { handleMessage } = require('./messageHandler');

// Active bots: botId -> { client, config, qrCode, status }
const activeBots = new Map();

// ─── Create a WhatsApp Bot ────────────────────────────────────
async function createWhatsAppBot(botId, config, phoneNumber = null) {
  if (activeBots.has(botId)) {
    const existing = activeBots.get(botId);
    if (existing.status === 'connected') {
      console.log(`[BotManager] Bot "${config.botName}" already connected.`);
      return existing;
    }
    try { await existing.client.destroy(); } catch {}
    activeBots.delete(botId);
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

  const client = new Client({
    authStrategy: new LocalAuth({
      clientId: botId,
      dataPath: './sessions',
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
        '--no-zygote',
        '--disable-extensions',
        '--disable-default-apps',
        '--disable-translate',
        '--disable-sync',
      ],
      timeout: 60000,
    },
    webVersionCache: {
      type: 'remote',
      remotePath: 'https://raw.githubusercontent.com/nicorm02/nicorm-web.js/main/AltPedidos/AltPedidos.json',
    },
  });

  botState.client = client;

  // QR Code Event
  client.on('qr', async (qr) => {
    console.log(`[BotManager] QR generated for "${config.botName}"`);
    botState.qrCode = qr;
    botState.status = 'waiting_scan';

    if (phoneNumber) {
      try {
        const code = await client.requestPairingCode(phoneNumber);
        botState.pairingCode = code;
        console.log(`[BotManager] Pairing code for ${phoneNumber}: ${code}`);
      } catch (e) {
        console.error('[BotManager] Pairing code request failed:', e.message);
      }
    } else {
      try {
        botState.qrDataUrl = await QRCode.toDataURL(qr, {
          width: 300,
          margin: 2,
          color: { dark: '#000000', light: '#ffffff' },
        });
      } catch (e) {
        console.error('[BotManager] QR generation error:', e.message);
      }
    }

    await firestore.updateBotStatus(botId, 'waiting_scan').catch(() => {});
  });

  // Ready Event (Connected)
  client.on('ready', async () => {
    console.log(`[BotManager] Bot "${config.botName}" connected to WhatsApp!`);
    botState.status = 'connected';
    botState.qrCode = null;
    botState.qrDataUrl = null;

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

  // Initialize client with retry
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
        break;
      }

      try { await client.destroy(); } catch {}
      console.log(`[BotManager] Retrying in 3s...`);
      await new Promise(r => setTimeout(r, 3000));
    }
  }

  return botState;
}

// Stop Bot
async function stopWhatsAppBot(botId) {
  const entry = activeBots.get(botId);
  if (!entry) return;

  try {
    await entry.client.destroy();
    console.log(`[BotManager] Bot "${entry.config.botName}" stopped.`);
  } catch (e) {
    console.error(`[BotManager] Error stopping bot:`, e.message);
  }

  activeBots.delete(botId);
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
