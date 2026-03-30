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
const nexcloud = require('./nexcloud');

const app = express();
const PORT = process.env.PORT || 3001;

// ─── Middleware ───────────────────────────────────────────────
// Security: Restrict CORS to known origins
const allowedOrigins = [
  'https://saas-ruddy-alpha.vercel.app',
  'http://localhost:5173',
  'http://localhost:4173',
];
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) cb(null, true);
    else cb(new Error('Not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));

// Security: API key check
app.use('/api', (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  if (apiKey !== process.env.NEXCLOUD_KEY) {
    return res.status(401).json({ error: 'غير مصرح' });
  }
  next();
});

// Security: Basic rate limiter (per IP, 60 req/min)
const rateLimitMap = new Map();
app.use('/api', (req, res, next) => {
  const ip = req.ip || req.connection.remoteAddress;
  const now = Date.now();
  const windowMs = 60000;
  const maxReqs = 60;
  if (!rateLimitMap.has(ip)) rateLimitMap.set(ip, []);
  const hits = rateLimitMap.get(ip).filter(t => now - t < windowMs);
  if (hits.length >= maxReqs) {
    return res.status(429).json({ error: 'Too many requests' });
  }
  hits.push(now);
  rateLimitMap.set(ip, hits);
  next();
});
setInterval(() => rateLimitMap.clear(), 300000);

// ─── Routes ──────────────────────────────────────────────────

// POST /api/whatsapp/create — Initialize a WhatsApp bot
app.post('/api/whatsapp/create', async (req, res) => {
  const { botId } = req.body;
  if (!botId) {
    return res.status(400).json({ error: 'botId مطلوب' });
  }

  try {
    // Get bot config from NexCloud
    const config = await nexcloud.getBot(botId);
    if (!config) {
      return res.status(404).json({ error: 'البوت غير موجود' });
    }



    // Create the WhatsApp client
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

// GET /api/whatsapp/:id/qr — Get QR code for scanning
app.get('/api/whatsapp/:id/qr', (req, res) => {
  const qr = getQRCode(req.params.id);

  if (!qr) {
    return res.json({ status: 'not_initialized', qrDataUrl: null });
  }

  res.json(qr);
});

// GET /api/whatsapp/:id/status — Get bot connection status
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

// POST /api/whatsapp/:id/stop — Stop and disconnect bot
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
    // Stop existing
    await stopWhatsAppBot(botId);

    // Get fresh config
    const config = await nexcloud.getBot(botId);
    if (!config) {
      return res.status(404).json({ error: 'البوت غير موجود' });
    }

    // Recreate
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

// ─── Health Check ────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});
// ─── Global Error Handler (prevents stack trace leaks) ───────
app.use((err, req, res, next) => {
  console.error('[Server] Unhandled error:', err.message);
  res.status(500).json({ error: 'حدث خطأ داخلي' });
});

// ─── Start Server ────────────────────────────────────────────
app.listen(PORT, async () => {
  console.log('');
  console.log('══════════════════════════════════════════════════');
  console.log('  BotForge WhatsApp Engine');
  console.log(`  Running on port ${PORT}`);
  console.log('══════════════════════════════════════════════════');
  console.log('');

  // Restore previously active bots
  await restoreBotsOnStartup();

  console.log('');
  console.log('[Server] Ready. API endpoints:');
  console.log(`  POST   http://localhost:${PORT}/api/whatsapp/create`);
  console.log(`  GET    http://localhost:${PORT}/api/whatsapp/:id/qr`);
  console.log(`  GET    http://localhost:${PORT}/api/whatsapp/:id/status`);
  console.log(`  POST   http://localhost:${PORT}/api/whatsapp/:id/stop`);
  console.log(`  POST   http://localhost:${PORT}/api/whatsapp/:id/restart`);
  console.log(`  GET    http://localhost:${PORT}/api/whatsapp/all`);
  console.log('');
});
