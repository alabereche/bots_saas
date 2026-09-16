// ═══════════════════════════════════════════════════════════════
// BotForge WhatsApp Engine — Express API Server
// Manages WhatsApp bot lifecycle via REST endpoints.
// Every /api route requires a Firebase ID token (Authorization:
// Bearer) AND ownership of the botId it touches.
// ═══════════════════════════════════════════════════════════════

const path = require('path');
const fs = require('fs');
require('dotenv').config();
require('dotenv').config({ path: path.join(__dirname, '.env') });
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const crypto = require('crypto');
const multer = require('multer');
let sharp = null;
try {
  sharp = require('sharp');
} catch (e) {
  console.warn('[Engine] Sharp optional image optimization not loaded:', e.message);
}
const express = require('express');
const cors = require('cors');
const {
  createWhatsAppBot,
  stopWhatsAppBot,
  getBotState,
  getQRCode,
  restoreBotsOnStartup,
  getAllBotStatuses,
  healBot,
} = require('./botManager');
const firestore = require('./firestore');
const { admin, db } = require('./firestore');
const { setTakeover, getTakeoverMap } = require('./takeover');
const trackingHelper = require('./tracking-helper');
const ssrfGuard = require('./ssrf-guard');
const selfUpdate = require('./selfUpdate');

// Engine self-update is gated to the platform owner's uid ONLY — this
// endpoint runs npm install and restarts the process, so it must never
// be reachable by merchant accounts. Set SUPER_ADMIN_UID in .env.
const SUPER_ADMIN_UID = process.env.SUPER_ADMIN_UID || '';

function requireSuperAdmin(req, res) {
  if (!SUPER_ADMIN_UID) {
    res.status(403).json({ error: 'خاصية التحديث الذاتي غير مهيأة — أضف SUPER_ADMIN_UID في .env' });
    return false;
  }
  if (req.uid !== SUPER_ADMIN_UID) {
    res.status(403).json({ error: 'هذه العملية متاحة لمالك المنصة فقط' });
    return false;
  }
  return true;
}

const app = express();
const PORT = process.env.PORT || 3001;
// 14 = measured safe ceiling on the 4GB VPS (~142MB/session + TG pair,
// 450MB always free). .env can still override downward or upward.
const MAX_CONCURRENT_BOTS = parseInt(process.env.MAX_CONCURRENT_BOTS || '14', 10);

// ─── Uploads Directory & Static Serving ───────────────────────
const UPLOADS_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Serve uploaded static WebP images
app.use('/uploads', express.static(UPLOADS_DIR, {
  maxAge: '30d',
  immutable: true,
  setHeaders: (res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
  }
}));

// ─── Multer Storage & Validation ──────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max per image
    files: 5,                  // Max 5 images per upload batch
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('نوع الملف غير مدعوم — يرجى رفع صور بصيغة JPG أو PNG أو WebP فقط'));
    }
  },
});

// ─── Middleware ───────────────────────────────────────────────
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '2mb' }));

// ─── Security: Firebase ID token verification ──────────────────
// The dashboard signs in with Firebase Auth and sends its ID token;
// the engine verifies the token and checks the caller owns the bot.
app.use('/api', async (req, res, next) => {
  if (req.method === 'OPTIONS') return next();

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
// ─── Rate limiting (sliding window per-user / per-IP) ────────
// Safe eviction prunes only expired records when map grows (F11)
function rateLimit({ windowMs = 60000, max = 120 } = {}) {
  const buckets = new Map();
  return (req, res, next) => {
    const key = req.uid || req.ip || 'unknown';
    const now = Date.now();
    let bucket = buckets.get(key);
    if (!bucket || now - bucket.start > windowMs) {
      bucket = { start: now, count: 0 };
      buckets.set(key, bucket);
    }

    // Safely prune expired entries without wiping active rate limits
    if (buckets.size > 5000) {
      for (const [k, b] of buckets.entries()) {
        if (now - b.start > windowMs) {
          buckets.delete(k);
        }
      }
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

const pairingAttempts = new Map(); // uid -> { count, start }

// A send that dies with a session/page error means a zombie client that
// still LOOKS connected — hand it to the self-healing path instead of
// failing silently until the next watchdog pass
function maybeHealClient(botId, err) {
  const msgText = String((err && err.message) || '');
  if (/Session closed|Target closed|Protocol error|Execution context|Evaluation failed|browser has been closed/i.test(msgText)) {
    try {
      healBot(botId, `send failure: ${msgText.slice(0, 100)}`);
    } catch { /* healing is best-effort */ }
  }
}

function checkPairingRateLimit(uid) {
  const now = Date.now();
  const windowMs = 5 * 60 * 1000; // 5 mins
  const maxAttempts = 3;
  let record = pairingAttempts.get(uid);
  if (!record || now - record.start > windowMs) {
    record = { count: 1, start: now };
    pairingAttempts.set(uid, record);
    return true;
  }
  if (record.count >= maxAttempts) {
    return false;
  }
  record.count++;
  return true;
}

// ─── Routes ──────────────────────────────────────────────────

// POST /api/whatsapp/create — Initialize a WhatsApp bot (supports QR or Pairing Code)
app.post('/api/whatsapp/create', async (req, res) => {
  const { botId, phoneNumber } = req.body;
  const config = await requireBotAccess(res, req.uid, botId);
  if (!config) return;

  let cleanPhone = null;
  if (phoneNumber) {
    cleanPhone = String(phoneNumber).replace(/\D/g, '');
    if (!/^[1-9]\d{9,14}$/.test(cleanPhone)) {
      return res.status(400).json({ error: 'رقم الهاتف غير صالح — يرجى إدخال الرقم بالصيغة الدولية مثل 213672475892' });
    }
    if (!checkPairingRateLimit(req.uid)) {
      return res.status(429).json({ error: 'تجاوزت الحد المسموح لطلب أكواد الربط (3 طلبات كل 5 دقائق) — يرجى الانتظار قليلاً' });
    }
  }

  try {
    if (!getBotState(botId) && getAllBotStatuses().length >= MAX_CONCURRENT_BOTS) {
      return res.status(503).json({ error: 'المحرك ممتلئ حالياً — يرجى المحاولة لاحقاً' });
    }

    const state = await createWhatsAppBot(botId, config, cleanPhone, !!cleanPhone);

    res.json({
      success: true,
      status: state.status,
      message: cleanPhone ? 'جاري توليد كود الربط السريع لهاتفك' : 'جاري تهيئة البوت، انتظر ظهور QR Code',
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

// ─── Manual Reply & Human Takeover (dashboard) ────────────────

// POST /api/reply — Owner manual reply via dashboard
app.post('/api/reply', async (req, res) => {
  const { botId, telegramUserId, message, platform } = req.body;
  if (!telegramUserId || !message) {
    return res.status(400).json({ error: 'معطيات ناقصة (telegramUserId, message)' });
  }
  const bot = await requireBotAccess(res, req.uid, botId);
  if (!bot) return;

  const isWeb = platform === 'web' || String(telegramUserId).startsWith('web_');

  try {
    // A manual reply implies manual mode: pause the AI for this customer.
    // System notifications (delivery receipts etc.) must NOT silence the AI.
    if (!req.body.system) {
      setTakeover(botId, telegramUserId, true);
    }

    if (!isWeb) {
      const state = getBotState(botId);
      if (!state) {
        return res.status(404).json({ error: 'البوت غير مشغل على محرك واتساب — أعد ربط واتساب من صفحة الإعدادات' });
      }
      if (state.status !== 'connected') {
        return res.status(409).json({ error: `واتساب غير متصل حالياً (الحالة: ${state.status})` });
      }
      await state.client.sendMessage(String(telegramUserId), String(message).slice(0, 1000));
    }

    await firestore.logOwnerMessage({
      botId,
      ownerUserId: bot.userId,
      to: telegramUserId,
      message: String(message),
      platform: isWeb ? 'web' : 'whatsapp',
    });

    console.log(`[API] Manual reply sent for bot ${botId} (${isWeb ? 'Web' : 'WhatsApp'})`);
    res.json({ success: true, takeover: true });
  } catch (err) {
    maybeHealClient(botId, err);
    console.error('[API] Reply error:', err.message);
    res.status(500).json({ error: 'فشل إرسال الرسالة — يرجى المحاولة لاحقاً' });
  }
});

// POST /api/takeover — Toggle manual (human) mode for a customer
app.post('/api/takeover', async (req, res) => {
  const { botId, telegramUserId, enabled } = req.body;
  if (!telegramUserId) {
    return res.status(400).json({ error: 'معطيات ناقصة (telegramUserId)' });
  }
  if (!(await requireBotAccess(res, req.uid, botId))) return;
  // Boundary log: EVERY toggle request is visible the moment it lands on
  // THIS engine — a mute that never ends has nowhere left to hide
  console.log(`[API] Takeover request on WA engine: bot=${botId} chat=${telegramUserId} enabled=${!!enabled}`);
  setTakeover(botId, telegramUserId, !!enabled);
  console.log(`[API] ${enabled ? '🖐️' : '🤖'} Takeover ${enabled ? 'ON' : 'OFF'} (bot ${botId})`);
  res.json({ success: true, takeover: !!enabled });
});

// GET /api/takeover/:botId — Current manual-mode customers of a bot
// (used by the dashboard to restore takeover state after a page reload)
app.get('/api/takeover/:botId', async (req, res) => {
  if (!(await requireBotAccess(res, req.uid, req.params.botId))) return;
  res.json({ takeovers: getTakeoverMap(req.params.botId) });
});

// ─── Engine Self-Update (super admin only) ────────────────────

// GET /api/engine/check-update — installed vs latest whatsapp-web.js
app.get('/api/engine/check-update', async (req, res) => {
  if (!requireSuperAdmin(req, res)) return;
  try {
    res.json(await selfUpdate.checkForUpdate());
  } catch (err) {
    res.status(500).json({ error: 'تعذر التحقق من التحديثات' });
  }
});

// POST /api/engine/self-update — npm install @latest + PM2 self-revive
app.post('/api/engine/self-update', async (req, res) => {
  if (!requireSuperAdmin(req, res)) return;
  try {
    const result = await selfUpdate.performUpdate();
    if (result.success && SUPER_ADMIN_UID) {
      firestore.createNotification({
        userId: SUPER_ADMIN_UID,
        type: 'system',
        title: 'تم تحديث محرك واتساب',
        body: result.message,
      }).catch(() => {});
    }
    res.json(result);
  } catch (err) {
    console.error('[API] Self-update error:', err.message);
    res.status(500).json({ error: err.message || 'فشل التحديث' });
  }
});

// POST /api/sheets/test-sync — Send a test event to verify Google Sheets Webhook connection
app.post('/api/sheets/test-sync', async (req, res) => {
  const { botId, webhookUrl } = req.body;
  if (!botId) {
    return res.status(400).json({ error: 'botId مطلوب' });
  }
  const bot = await requireBotAccess(res, req.uid, botId);
  if (!bot) return;
  if (webhookUrl) {
    const ssrfError = ssrfGuard.validateWebhookUrl(webhookUrl);
    if (ssrfError) return res.status(400).json({ error: ssrfError });
  }

  const targetUrl = webhookUrl || bot.googleSheetsWebhookUrl || bot.webhookUrl;
  if (!targetUrl) {
    return res.status(400).json({ error: 'يرجى إدخال رابط Google Sheets Webhook أولاً' });
  }

  const { syncToGoogleSheets } = require('./sheetsSync');
  const testPayload = {
    event: 'test_ping',
    trackingCode: 'DZ-TEST01',
    customerName: 'تجربة AuraBot',
    phone: '0660000000',
    address: 'الجزائر - تجربة المزامنة',
    product: 'منتج تجريبي / Lead Test',
    price: '1000',
    service: 'خدمة تجريبية',
    budget: '5000',
    leadStatus: 'hot',
    notes: 'تم إرسال هذا السطر لاختبار نجاح الربط مع Google Sheets',
  };

  const success = await syncToGoogleSheets({ id: botId, botName: bot.botName, googleSheetsWebhookUrl: targetUrl }, testPayload);
  if (success) {
    res.json({ success: true, message: 'تم إرسال سطر التجربة بنجاح إلى Google Sheets' });
  } else {
    res.status(502).json({ error: 'تعذر الاتصال بالرابط، تأكد من صحة رابط الـ Webhook ونشره كـ Web App' });
  }
});

// ─── Order Tracking & Delivery Management ─────────────────────

// POST /api/orders/:id/delivery-status — Update delivery status and send idempotent notification
app.post('/api/orders/:id/delivery-status', async (req, res) => {
  const orderId = req.params.id;
  const { botId, deliveryStatus, provider, trackingNumber, notifyCustomer } = req.body;

  if (!orderId || !botId || !deliveryStatus) {
    return res.status(400).json({ error: 'معطيات ناقصة (orderId, botId, deliveryStatus)' });
  }

  const bot = await requireBotAccess(res, req.uid, botId);
  if (!bot) return;

  const eventId = `evt_${orderId}_${deliveryStatus}_${Date.now()}`;
  const updateResult = await firestore.updateOrderDeliveryStatus(
    orderId,
    deliveryStatus,
    { provider, trackingNumber },
    eventId,
    botId,
    req.uid
  );

  if (!updateResult.success) {
    return res.status(500).json({ error: updateResult.reason || 'فشل تحديث حالة الطلبية' });
  }

  const order = updateResult.order;
  let notificationSent = false;

  // Send idempotent customer notification if requested and customerId is present
  const customerTarget = order?.customerId || order?.phone;
  if (notifyCustomer && order && customerTarget && !updateResult.alreadyProcessed) {
    const state = getBotState(botId);
    if (state && state.status === 'connected' && state.client) {
      try {
        const statusLabel = trackingHelper.customerStatusLabel(deliveryStatus, bot.businessType);
        const providerName = trackingHelper.PROVIDER_NAMES[provider] || provider || '';

        let notifMsg = `📢 تحديث حالة طلبيتك:\n\n`;
        notifMsg += `${statusLabel}\n\n`;
        if (order.product) {
          notifMsg += `• المنتج: ${order.product}\n`;
        }
        if (providerName && provider !== 'manual') {
          notifMsg += `• شركة الشحن: ${providerName}\n`;
        }
        if (trackingNumber) {
          notifMsg += `• رقم بوليصة الشحن: ${trackingNumber}\n`;
        }
        notifMsg += `\nكود التتبع الخاص بك (لنسخه واستخدامه مباشرة):\n`;
        notifMsg += `${order.trackingCode || 'DZ-XXXXXX'}\n\n`;
        notifMsg += `يمكنك كتابة "تتبع" في أي وقت للاستعلام المباشر عن حالة الطلبية.`;

        let targetId = String(customerTarget).trim();
        if (!targetId.includes('@')) {
          let cleanPhone = targetId.replace(/[^0-9]/g, '');
          if (cleanPhone.startsWith('0')) cleanPhone = '213' + cleanPhone.slice(1);
          targetId = `${cleanPhone}@c.us`;
        }

        console.log(`[API] 📢 Dispatching WhatsApp delivery notification for order ${orderId} to ${targetId}...`);
        await state.client.sendMessage(targetId, notifMsg);
        notificationSent = true;
        console.log(`[API] ✅ WhatsApp notification sent successfully to ${targetId}`);

        await firestore.logBotMessage({
          botId,
          ownerUserId: bot.userId,
          to: targetId,
          userName: order.customerName || 'الزبون',
          message: notifMsg,
        }).catch(() => {});
      } catch (sendErr) {
        maybeHealClient(botId, sendErr);
        console.error(`[API] ❌ Notification send failed for customer ${customerTarget}:`, sendErr.message);
      }
    } else {
      console.warn(`[API] ⚠️ Bot ${botId} is not connected to WhatsApp, state:`, state ? state.status : 'null');
    }
  }

  res.json({
    success: true,
    order: updateResult.order,
    notificationSent,
    alreadyProcessed: !!updateResult.alreadyProcessed,
  });
});

// ─── Product Image Upload & Management ─────────────────────────

// POST /api/upload — Upload and auto-compress product images to WebP
app.post('/api/upload', (req, res, next) => {
  upload.array('images', 5)(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message || 'خطأ أثناء رفع الملفات' });
    }
    next();
  });
}, async (req, res) => {
  const botId = req.body.botId;
  if (!botId) {
    return res.status(400).json({ error: 'معرّف البوت مطلوب (botId)' });
  }

  // Security check: caller must own this bot
  const bot = await requireBotAccess(res, req.uid, botId);
  if (!bot) return;

  const files = req.files;
  if (!files || files.length === 0) {
    return res.status(400).json({ error: 'لم يتم إرسال أي صورة' });
  }

  try {
    const uploadedUrls = [];
    const publicUrl = process.env.PUBLIC_API_URL || process.env.VITE_WHATSAPP_ENGINE_URL;
    const protocol = req.protocol === 'https' || req.get('x-forwarded-proto') === 'https' ? 'https' : 'http';
    const rawHost = req.get('host');
    const validHostPattern = /^[a-zA-Z0-9.\-_:]+$/;
    const safeHost = (rawHost && validHostPattern.test(rawHost)) ? rawHost : `162.62.233.152:${PORT}`;
    const baseUrl = publicUrl ? publicUrl.replace(/\/$/, '') : `${protocol}://${safeHost}`;

    for (const file of files) {
      const filename = `prod_${Date.now()}_${crypto.randomBytes(4).toString('hex')}.webp`;
      const outputPath = path.join(UPLOADS_DIR, filename);

      // WebP compression & resizing (max 1200px width/height, 80% quality)
      await sharp(file.buffer)
        .resize({ width: 1200, height: 1200, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 80, effort: 4 })
        .toFile(outputPath);

      const url = `${baseUrl}/uploads/${filename}`;
      uploadedUrls.push({
        filename,
        url,
        size: fs.statSync(outputPath).size,
      });
    }

    res.json({
      success: true,
      images: uploadedUrls,
      message: 'تم رفع وضغط الصور بنجاح',
    });
  } catch (err) {
    console.error('[Upload] Image processing error:', err.message);
    res.status(500).json({ error: 'فشل معالجة وضغط الصورة' });
  }
});

// POST /api/upload/delete — Delete product image from VPS disk (Garbage Collection)
app.post('/api/upload/delete', async (req, res) => {
  const { botId, filename, url } = req.body;
  if (!botId) {
    return res.status(400).json({ error: 'معرّف البوت مطلوب (botId)' });
  }

  // Security check: caller must own this bot
  const bot = await requireBotAccess(res, req.uid, botId);
  if (!bot) return;

  let targetFilename = filename;
  if (!targetFilename && url) {
    try {
      const parsedUrl = new URL(url);
      targetFilename = path.basename(parsedUrl.pathname);
    } catch {
      targetFilename = path.basename(url);
    }
  }

  if (!targetFilename) {
    return res.status(400).json({ error: 'اسم الملف أو رابطه مطلوب' });
  }

  // Sanitize filename to prevent directory traversal
  const safeFilename = path.basename(targetFilename);
  const targetPath = path.join(UPLOADS_DIR, safeFilename);

  // Security check: ensure path is within UPLOADS_DIR
  if (!targetPath.startsWith(UPLOADS_DIR)) {
    return res.status(403).json({ error: 'مسار غير مصرح به' });
  }

  // Security check: ensure image belongs to this bot's product catalog before deleting (F03 IDOR defense)
  const isImageInBot = Array.isArray(bot.products) && bot.products.some(p => {
    if (!p) return false;
    if (p.primaryImage && p.primaryImage.includes(safeFilename)) return true;
    if (Array.isArray(p.secondaryImages) && p.secondaryImages.some(img => img && img.includes(safeFilename))) return true;
    if (Array.isArray(p.images) && p.images.some(img => img && img.includes(safeFilename))) return true;
    return false;
  });

  if (!isImageInBot && fs.existsSync(targetPath)) {
    return res.status(403).json({ error: 'غير مصرح: هذه الصورة لا تخص منتجات هذا البوت' });
  }

  try {
    if (fs.existsSync(targetPath)) {
      fs.unlinkSync(targetPath);
      console.log(`[Upload] Deleted image file: ${safeFilename} for bot ${botId}`);
    }
    res.json({ success: true, message: 'تم حذف الصورة بنجاح' });
  } catch (err) {
    console.error('[Upload] Delete file error:', err.message);
    res.status(500).json({ error: 'فشل حذف الملف من السيرفر' });
  }
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

// ─── Abandoned Lead Recovery Background Worker ─────────────────
async function runAbandonedRecoveryCron() {
  try {
    const bots = await firestore.getActiveBots();
    for (const bot of bots) {
      const isRecoveryEnabled = bot.features?.abandonedRecovery === true || bot.abandonedRecoveryEnabled === true;
      if (!isRecoveryEnabled) continue;

      const delayHours = Number(bot.abandonedRecoveryDelayHours) || 2;
      const leads = await firestore.findAbandonedLeads(bot.id, delayHours);
      if (!leads || leads.length === 0) continue;

      const state = getBotState(bot.id);
      if (!state || state.status !== 'connected' || !state.client) continue;

      for (const lead of leads) {
        // Skip if manual takeover is currently active
        const { isTakeoverActive } = require('./takeover');
        if (isTakeoverActive(bot.id, lead.customerId)) continue;

        const reminderMsg = bot.abandonedRecoveryMessage ||
          `مرحباً بك ${lead.userName || 'أخي الكريم'}، لاحظنا أنك كنت مهتماً بخدماتنا واستفسرت سابقاً. هل ما زلت بحاجة لأي استفسار أو ترغب في إتمام طلبك؟ نحن في خدمتك دائماً.`;

        try {
          await state.client.sendMessage(String(lead.customerId), reminderMsg);

          await firestore.logBotMessage({
            botId: bot.id,
            ownerUserId: bot.userId,
            to: lead.customerId,
            userName: lead.userName,
            message: reminderMsg,
            platform: 'whatsapp',
          });

          await firestore.recordAbandonedReminder(bot.id, lead.customerId);
          console.log(`[Recovery] Sent abandoned reminder to ${lead.customerId} for bot ${bot.id}`);
        } catch (sendErr) {
          maybeHealClient(bot.id, sendErr);
          console.warn(`[Recovery] Failed to send reminder to ${lead.customerId}:`, sendErr.message);
        }
      }
    }
  } catch (err) {
    console.error('[Recovery] Cron execution error:', err.message);
  }
}

// Process Crash Guards (Prevent unhandled Puppeteer errors from crashing the engine)
process.on('unhandledRejection', (reason) => {
  console.warn('[Process] Caught unhandledRejection:', reason?.message || reason);
});

process.on('uncaughtException', (err) => {
  console.error('[Process] Caught uncaughtException:', err.message);
});

// Start Server
app.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('══════════════════════════════════════════════════');
  console.log('  BotForge WhatsApp Engine (Admin SDK + ID-token auth)');
  console.log(`  Running on http://0.0.0.0:${PORT}`);
  console.log('══════════════════════════════════════════════════');
  console.log('');

  restoreBotsOnStartup().catch(err => {
    console.error('[Startup] Restore error:', err.message);
  });

  // Run abandoned lead recovery check every 10 minutes
  setInterval(runAbandonedRecoveryCron, 10 * 60 * 1000);
  setTimeout(runAbandonedRecoveryCron, 30 * 1000); // Initial check after 30s

  // ─── Dawn renewal (preventive): sessions age and their internal
  // channels rot silently. Every day at DAWN_RENEWAL_HOUR (default 4am,
  // the dead hour) each CONNECTED bot is reborn on its saved session —
  // fresh channel before it ever has a chance to die mid-day. Merchant
  // notifications stay quiet: this is maintenance, not an incident.
  const DAWN_HOUR = parseInt(process.env.DAWN_RENEWAL_HOUR ?? '4', 10);
  const dawnEnabled = (process.env.DAWN_RENEWAL_ENABLED ?? 'true') !== 'false';
  let dawnLastRunDate = '';
  setInterval(async () => {
    if (!dawnEnabled) return;
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    if (now.getHours() !== DAWN_HOUR || dawnLastRunDate === today) return;
    dawnLastRunDate = today;
    try {
      const statuses = getAllBotStatuses().filter(s => s.status === 'connected');
      console.log(`[DawnRenewal] 🌅 Renewing ${statuses.length} session(s) for a fresh day...`);
      for (const s of statuses) {
        // staggered: each reborn Chromium costs ~150MB — never together
        await healBot(s.id, 'scheduled dawn renewal');
        await new Promise(r => setTimeout(r, 8000));
      }
    } catch (err) {
      console.error('[DawnRenewal] Failed:', err.message);
    }
  }, 15 * 60 * 1000);

  // ─── Update watcher: WhatsApp drifts ahead of the library constantly —
  // it is THE recurring breaker. Notice the owner via dashboard
  // notification; he updates with one click (no silent auto-updates).
  async function runUpdateCheck() {
    if (!SUPER_ADMIN_UID) return;
    try {
      const status = await selfUpdate.checkForUpdate();
      if (status.updateAvailable && !selfUpdate.alreadyNotified(status.installed, status.latest)) {
        selfUpdate.markNotified(status.installed, status.latest);
        await firestore.createNotification({
          userId: SUPER_ADMIN_UID,
          type: 'system',
          title: 'تحديث محرك واتساب متوفر',
          body: `إصدار جديد للمكتبة (${status.installed} → ${status.latest}) — حدّث من صفحة القنوات بضغطة واحدة قبل أن يكسر التحديث الجديد للواتساب الربط.`,
        }).catch(() => {});
        console.log(`[SelfUpdate] Update available: ${status.installed} → ${status.latest}`);
      }
    } catch (err) {
      console.warn('[SelfUpdate] Check failed:', err.message);
    }
  }
  setTimeout(runUpdateCheck, 90 * 1000);
  setInterval(runUpdateCheck, 24 * 60 * 60 * 1000);
});
