// ═══════════════════════════════════════════════════════════════
// BotForge WhatsApp Engine — Express API Server
// Manages WhatsApp bot lifecycle via REST endpoints.
// Every /api route requires a Firebase ID token (Authorization:
// Bearer) AND ownership of the botId it touches.
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
const { admin } = require('./firestore');
const { setTakeover, getTakeoverMap } = require('./takeover');

const app = express();
const PORT = process.env.PORT || 3001;
const MAX_CONCURRENT_BOTS = parseInt(process.env.MAX_CONCURRENT_BOTS || '10', 10);

// ─── Middleware ───────────────────────────────────────────────
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '2mb' }));

// ─── Security: Firebase ID token verification ──────────────────
// The dashboard signs in with Firebase Auth and sends its ID token;
// the engine verifies the token and checks the caller owns the bot.
app.use('/api', async (req, res, next) => {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'مصادقة مطلوبة — سجل الدخول وأعد المحاولة' });
  }
  try {
    const decoded = await admin.auth().verifyIdToken(header.slice(7));
    req.uid = decoded.uid;
    next();
  } catch {
    return res.status(401).json({ error: 'رمز المصادقة غير صالح أو منتهي الصلاحية' });
  }
});

// ─── Security: rate limiting (fixed window, in-memory, per user) ──
// Each limiter keeps its OWN buckets, keyed by the verified user id
// (auth runs first) — keying by IP would collapse every tenant into
// one bucket behind a reverse proxy.
function rateLimit({ windowMs = 60000, max = 120 } = {}) {
  const buckets = new Map();
  return (req, res, next) => {
    const key = req.uid || req.ip || 'unknown';
    const now = Date.now();
    let bucket = buckets.get(key);
    if (!bucket || now - bucket.start > windowMs) {
      bucket = { start: now, count: 0 };
      buckets.set(key, bucket);
      if (buckets.size > 10000) buckets.clear();
    }
    if (++bucket.count > max) {
      return res.status(429).json({ error: 'عدد كبير من الطلبات — يرجى المحاولة لاحقاً' });
    }
    next();
  };
}
app.use('/api', rateLimit({ windowMs: 60000, max: 120 }));
app.use('/api/whatsapp/create', rateLimit({ windowMs: 60000, max: 10 }));

// ─── Ownership guard: caller must own this bot ─────────────────
// Resolves the bot and attaches it; responds 403 unless the
// authenticated user owns it. Returns null after responding.
async function requireBotAccess(res, uid, botId) {
  if (!botId || typeof botId !== 'string') {
    res.status(400).json({ error: 'معرّف البوت مطلوب' });
    return null;
  }
  const bot = await firestore.getBot(botId);
  if (!bot) {
    res.status(404).json({ error: 'البوت غير موجود في قاعدة البيانات' });
    return null;
  }
  if (!bot.userId || bot.userId !== uid) {
    res.status(403).json({ error: 'لا تملك صلاحية الوصول إلى هذا البوت' });
    return null;
  }
  return bot;
}

// ─── Routes ──────────────────────────────────────────────────

// POST /api/whatsapp/create — Initialize a WhatsApp bot
app.post('/api/whatsapp/create', async (req, res) => {
  const { botId } = req.body;
  const config = await requireBotAccess(res, req.uid, botId);
  if (!config) return;

  try {
    if (!getBotState(botId) && getAllBotStatuses().length >= MAX_CONCURRENT_BOTS) {
      return res.status(503).json({ error: 'المحرك ممتلئ حالياً — يرجى المحاولة لاحقاً' });
    }

    const state = await createWhatsAppBot(botId, config);

    res.json({
      success: true,
      status: state.status,
      message: 'جاري تهيئة البوت، انتظر ظهور QR Code',
    });
  } catch (err) {
    console.error('[API] Create error:', err.message);
    res.status(500).json({ error: 'حدث خطأ داخلي أثناء تهيئة البوت' });
  }
});

// GET /api/whatsapp/:id/qr — Get QR code
app.get('/api/whatsapp/:id/qr', async (req, res) => {
  if (!(await requireBotAccess(res, req.uid, req.params.id))) return;
  const qr = getQRCode(req.params.id);
  if (!qr) {
    return res.json({ status: 'not_initialized', qrDataUrl: null });
  }
  res.json(qr);
});

// GET /api/whatsapp/:id/status — Get bot status
app.get('/api/whatsapp/:id/status', async (req, res) => {
  if (!(await requireBotAccess(res, req.uid, req.params.id))) return;
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
  if (!(await requireBotAccess(res, req.uid, req.params.id))) return;
  try {
    await stopWhatsAppBot(req.params.id);
    res.json({ success: true, message: 'تم ايقاف البوت' });
  } catch (err) {
    console.error('[API] Stop error:', err.message);
    res.status(500).json({ error: 'حدث خطأ داخلي أثناء إيقاف البوت' });
  }
});

// POST /api/whatsapp/:id/restart — Restart bot connection
app.post('/api/whatsapp/:id/restart', async (req, res) => {
  const botId = req.params.id;
  const config = await requireBotAccess(res, req.uid, botId);
  if (!config) return;
  try {
    await stopWhatsAppBot(botId);
    const state = await createWhatsAppBot(botId, config);
    res.json({
      success: true,
      status: state.status,
      message: 'جاري إعادة تهيئة البوت',
    });
  } catch (err) {
    console.error('[API] Restart error:', err.message);
    res.status(500).json({ error: 'حدث خطأ داخلي أثناء إعادة تشغيل البوت' });
  }
});

// GET /api/whatsapp/all — Bot statuses of the CALLER's bots only
app.get('/api/whatsapp/all', async (req, res) => {
  const myBots = await firestore.getBotsByOwner(req.uid);
  const ids = new Set(myBots.map(b => b.id));
  res.json({
    bots: getAllBotStatuses().filter(s => ids.has(s.id)),
  });
});

// ─── Manual Reply & Human Takeover (dashboard) ────────────────

// POST /api/reply — Owner manual reply via dashboard
app.post('/api/reply', async (req, res) => {
  const { botId, telegramUserId, message } = req.body;
  if (!telegramUserId || !message) {
    return res.status(400).json({ error: 'معطيات ناقصة (telegramUserId, message)' });
  }
  const bot = await requireBotAccess(res, req.uid, botId);
  if (!bot) return;

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

    await state.client.sendMessage(String(telegramUserId), String(message).slice(0, 1000));

    await firestore.logOwnerMessage({
      botId,
      ownerUserId: bot.userId,
      to: telegramUserId,
      message: String(message),
    });

    console.log(`[API] ✉️ Manual reply sent for bot ${botId}`);
    res.json({ success: true, takeover: true });
  } catch (err) {
    console.error('[API] Reply error:', err.message);
    res.status(500).json({ error: 'فشل إرسال الرسالة عبر واتساب — يرجى المحاولة لاحقاً' });
  }
});

// POST /api/takeover — Toggle manual (human) mode for a customer
app.post('/api/takeover', async (req, res) => {
  const { botId, telegramUserId, enabled } = req.body;
  if (!telegramUserId) {
    return res.status(400).json({ error: 'معطيات ناقصة (telegramUserId)' });
  }
  if (!(await requireBotAccess(res, req.uid, botId))) return;
  setTakeover(botId, telegramUserId, !!enabled);
  console.log(`[API] ${enabled ? '🖐️' : '🤖'} Takeover ${enabled ? 'ON' : 'OFF'} (bot ${botId})`);
  res.json({ success: true, takeover: !!enabled });
});

// GET /api/takeover/:botId — Current manual-mode customers of a bot
app.get('/api/takeover/:botId', async (req, res) => {
  if (!(await requireBotAccess(res, req.uid, req.params.botId))) return;
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
  console.log('  BotForge WhatsApp Engine (Admin SDK + ID-token auth)');
  console.log(`  Running on port ${PORT}`);
  console.log('══════════════════════════════════════════════════');
  console.log('');

  await restoreBotsOnStartup();
});
