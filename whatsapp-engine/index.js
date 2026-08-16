// ═══════════════════════════════════════════════════════════════
// BotForge WhatsApp Engine — Express API Server
// Manages WhatsApp bot lifecycle via REST endpoints
// ═══════════════════════════════════════════════════════════════

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const {
  createWhatsAppBot,
  stopWhatsAppBot,
  getBotState,
  getQRCode,
  restoreBotsOnStartup,
  getAllBotStatuses,
} = require('./botManager');
const firestore = require('./firestore');
const { setTakeover, getTakeoverMap } = require('./takeover');

const app = express();
const PORT = process.env.PORT || 3001;
const API_SECRET = process.env.API_KEY || 'botforge_secret_key_2026';

// ─── Middleware ───────────────────────────────────────────────
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '2mb' }));

// ─── Security: API Key Verification ───────────────────────────
app.use('/api', (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey || (apiKey !== API_SECRET && apiKey !== process.env.NEXCLOUD_KEY)) {
    return res.status(401).json({ error: 'غير مصرح - مفتاح API مفقود أو غير صحيح' });
  }
  next();
});

// ─── Routes ──────────────────────────────────────────────────

// POST /api/whatsapp/create — Initialize a WhatsApp bot
app.post('/api/whatsapp/create', async (req, res) => {
  const { botId } = req.body;
  if (!botId) {
    return res.status(400).json({ error: 'botId مطلوب' });
  }

  try {
    const config = await firestore.getBot(botId);
    if (!config) {
      return res.status(404).json({ error: 'البوت غير موجود في قاعدة البيانات' });
    }

    const state = await createWhatsAppBot(botId, config);

    res.json({
      success: true,
      status: state.status,
      message: 'جاري تهيئة البوت، انتظر ظهور QR Code',
    });
  } catch (err) {
    console.error('[API] Create error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/whatsapp/:id/qr — Get QR code
app.get('/api/whatsapp/:id/qr', (req, res) => {
  const qr = getQRCode(req.params.id);
  if (!qr) {
    return res.json({ status: 'not_initialized', qrDataUrl: null });
  }
  res.json(qr);
});

// GET /api/whatsapp/:id/status — Get bot status
app.get('/api/whatsapp/:id/status', (req, res) => {
  const state = getBotState(req.params.id);
  if (!state) {
    return res.json({ status: 'not_initialized' });
  }
  res.json({
    status: state.status,
    botName: state.config.botName,
    hasQR: !!state.qrDataUrl,
  });
});

// POST /api/whatsapp/:id/stop — Disconnect bot
app.post('/api/whatsapp/:id/stop', async (req, res) => {
  try {
    await stopWhatsAppBot(req.params.id);
    res.json({ success: true, message: 'تم ايقاف البوت' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/whatsapp/:id/restart — Restart bot connection
app.post('/api/whatsapp/:id/restart', async (req, res) => {
  const botId = req.params.id;
  try {
    await stopWhatsAppBot(botId);
    const config = await firestore.getBot(botId);
    if (!config) {
      return res.status(404).json({ error: 'البوت غير موجود' });
    }
    const state = await createWhatsAppBot(botId, config);
    res.json({
      success: true,
      status: state.status,
      message: 'جاري إعادة تهيئة البوت',
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/whatsapp/all — Get all active bot statuses
app.get('/api/whatsapp/all', (req, res) => {
  res.json({ bots: getAllBotStatuses() });
});

// ─── Manual Reply & Human Takeover (dashboard) ────────────────

// POST /api/reply — Owner manual reply via dashboard
app.post('/api/reply', async (req, res) => {
  const { botId, telegramUserId, message } = req.body;
  if (!botId || !telegramUserId || !message) {
    return res.status(400).json({ error: 'معطيات ناقصة (botId, telegramUserId, message)' });
  }

  const state = getBotState(botId);
  if (!state) {
    return res.status(404).json({ error: 'البوت غير مشغل على محرك واتساب — أعد ربط واتساب من صفحة الإعدادات' });
  }
  if (state.status !== 'connected') {
    return res.status(409).json({ error: `واتساب غير متصل حالياً (الحالة: ${state.status})` });
  }

  try {
    // A manual reply implies manual mode: pause the AI for this customer
    setTakeover(botId, telegramUserId, true);

    await state.client.sendMessage(String(telegramUserId), String(message));

    await firestore.logOwnerMessage({
      botId,
      to: telegramUserId,
      message: String(message),
    });

    console.log(`[API] ✉️ Manual reply sent to ${telegramUserId} for bot ${botId}`);
    res.json({ success: true, takeover: true });
  } catch (err) {
    console.error('[API] Reply error:', err.message);
    res.status(500).json({ error: 'فشل إرسال الرسالة عبر واتساب: ' + err.message });
  }
});

// POST /api/takeover — Toggle manual (human) mode for a customer
app.post('/api/takeover', (req, res) => {
  const { botId, telegramUserId, enabled } = req.body;
  if (!botId || !telegramUserId) {
    return res.status(400).json({ error: 'معطيات ناقصة (botId, telegramUserId)' });
  }
  setTakeover(botId, telegramUserId, !!enabled);
  console.log(`[API] ${enabled ? '🖐️' : '🤖'} Takeover ${enabled ? 'ON' : 'OFF'} for ${telegramUserId} (bot ${botId})`);
  res.json({ success: true, takeover: !!enabled });
});

// GET /api/takeover/:botId — Current manual-mode customers of a bot
app.get('/api/takeover/:botId', (req, res) => {
  res.json({ takeovers: getTakeoverMap(req.params.botId) });
});

// GET /health
app.get('/health', (req, res) => {
  res.json({ status: 'ok', engine: 'whatsapp', uptime: process.uptime() });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('[Server] Unhandled error:', err.message);
  res.status(500).json({ error: 'حدث خطأ داخلي' });
});

// Start Server
app.listen(PORT, async () => {
  console.log('');
  console.log('══════════════════════════════════════════════════');
  console.log('  BotForge WhatsApp Engine (Firestore Enabled)');
  console.log(`  Running on port ${PORT}`);
  console.log('══════════════════════════════════════════════════');
  console.log('');

  await restoreBotsOnStartup();
});
