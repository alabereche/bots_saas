// ═══════════════════════════════════════════════════════════════
// BotForge WhatsApp Engine — Bot Manager
// Creates, manages, and destroys WhatsApp client instances
// ═══════════════════════════════════════════════════════════════

const { Client, LocalAuth } = require('whatsapp-web.js');
const QRCode = require('qrcode');
const nexcloud = require('./nexcloud');
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
    // Destroy old instance before recreating
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
        '--single-process',
        '--disable-gpu',
        '--disable-features=IsolateOrigins,site-per-process',
        '--disable-site-isolation-trials',
        '--disable-web-security',
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

  // ─── QR Code Event ──────────────────────────────────────
  client.on('qr', async (qr) => {
    console.log(`[BotManager] QR generated for "${config.botName}"`);
    botState.qrCode = qr;
    botState.status = 'waiting_scan';

    // If phone pairing mode, request pairing code instead of showing QR
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

    await nexcloud.updateBotStatus(botId, 'waiting_scan').catch(() => {});
  });

  // ─── Ready Event (Connected) ────────────────────────────
  client.on('ready', async () => {
    console.log(`[BotManager] Bot "${config.botName}" connected to WhatsApp!`);
    botState.status = 'connected';
    botState.qrCode = null;
    botState.qrDataUrl = null;

    await nexcloud.updateBotStatus(botId, 'connected', {
      whatsappConnectedAt: new Date().toISOString(),
    }).catch(() => {});
  });

  // ─── Authentication Failure ─────────────────────────────
  client.on('auth_failure', async (msg) => {
    console.error(`[BotManager] Auth failure for "${config.botName}":`, msg);
    botState.status = 'auth_failure';
    await nexcloud.updateBotStatus(botId, 'auth_failure').catch(() => {});
  });

  // ─── Disconnected ───────────────────────────────────────
  client.on('disconnected', async (reason) => {
    console.log(`[BotManager] Bot "${config.botName}" disconnected:`, reason);
    botState.status = 'disconnected';
    await nexcloud.updateBotStatus(botId, 'disconnected').catch(() => {});
    activeBots.delete(botId);
  });

  // ─── Incoming Messages ──────────────────────────────────
  client.on('message', async (msg) => {
    if (msg.fromMe) return;
    await handleMessage(msg, config);
  });

  // ─── Error Handler ──────────────────────────────────────
  client.on('error', (err) => {
    console.error(`[BotManager] Client error "${config.botName}":`, err.message);
  });

  // Initialize the client with retry
  let retries = 0;
  const maxRetries = 2;

  while (retries <= maxRetries) {
    try {
      await client.initialize();
      break; // Success — exit loop
    } catch (err) {
      retries++;
      console.error(`[BotManager] Init attempt ${retries}/${maxRetries + 1} failed for "${config.botName}":`, err.message);

      if (retries > maxRetries) {
        console.error(`[BotManager] All retries exhausted for "${config.botName}". Marking as error.`);
        botState.status = 'error';
        await nexcloud.updateBotStatus(botId, 'error').catch(() => {});
        break;
      }

      // Clean up before retry
      try { await client.destroy(); } catch {}
      console.log(`[BotManager] Retrying in 3s...`);
      await new Promise(r => setTimeout(r, 3000));

      // Recreate client for retry
      const retryClient = new Client({
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
            '--single-process',
            '--disable-gpu',
            '--disable-features=IsolateOrigins,site-per-process',
            '--disable-site-isolation-trials',
            '--disable-web-security',
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

      botState.client = retryClient;

      // Re-bind events on retry client
      retryClient.on('qr', async (qr) => {
        console.log(`[BotManager] QR generated for "${config.botName}"`);
        botState.qrCode = qr;
        botState.status = 'waiting_scan';
        try {
          botState.qrDataUrl = await QRCode.toDataURL(qr, {
            width: 300, margin: 2,
            color: { dark: '#000000', light: '#ffffff' },
          });
        } catch {}
        await nexcloud.updateBotStatus(botId, 'waiting_scan').catch(() => {});
      });
      retryClient.on('ready', async () => {
        console.log(`[BotManager] Bot "${config.botName}" connected!`);
        botState.status = 'connected';
        botState.qrCode = null;
        botState.qrDataUrl = null;
        await nexcloud.updateBotStatus(botId, 'connected', {
          whatsappConnectedAt: new Date().toISOString(),
        }).catch(() => {});
      });
      retryClient.on('auth_failure', async (msg) => {
        botState.status = 'auth_failure';
        await nexcloud.updateBotStatus(botId, 'auth_failure').catch(() => {});
      });
      retryClient.on('disconnected', async (reason) => {
        botState.status = 'disconnected';
        await nexcloud.updateBotStatus(botId, 'disconnected').catch(() => {});
        activeBots.delete(botId);
      });
      retryClient.on('message', async (msg) => {
        if (msg.fromMe) return;
        await handleMessage(msg, config);
      });
      retryClient.on('error', (err) => {
        console.error(`[BotManager] Client error:`, err.message);
      });
    }
  }

  return botState;
}

// ─── Stop a WhatsApp Bot ──────────────────────────────────────
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
  await nexcloud.updateBotStatus(botId, 'disconnected').catch(() => {});
}

// ─── Get Bot Status ───────────────────────────────────────────
function getBotState(botId) {
  return activeBots.get(botId) || null;
}

// ─── Get QR Code ──────────────────────────────────────────────
function getQRCode(botId) {
  const state = activeBots.get(botId);
  if (!state) return null;
  return {
    status: state.status,
    qrDataUrl: state.qrDataUrl,
  };
}

// ─── Restore All Active Bots on Startup ───────────────────────
async function restoreBotsOnStartup() {
  try {
    const bots = await nexcloud.getActiveBots();
    const whatsappBots = bots.filter(b =>
      b.whatsappEnabled && b.whatsappStatus === 'connected'
    );
    console.log(`[BotManager] Found ${whatsappBots.length} WhatsApp bot(s) to restore.`);

    for (const bot of whatsappBots) {
      await createWhatsAppBot(bot.id, bot);
    }
  } catch (err) {
    console.error('[BotManager] Restore failed:', err.message);
  }
}

// ─── Get All Active Bot Statuses ──────────────────────────────
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
