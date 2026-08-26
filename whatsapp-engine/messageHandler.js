// ═══════════════════════════════════════════════════════════════
// BotForge WhatsApp Engine — Message Handler
// Processes incoming WhatsApp messages via Gemini AI
// with universal order/booking extraction and customer confirmation.
// The customer's message is logged BEFORE the AI call so it is
// never lost, and AI-derived order data is validated before saving.
// ═══════════════════════════════════════════════════════════════

const { MessageMedia } = require('whatsapp-web.js');
const { askOpenRouter } = require('./openrouter');
const firestore = require('./firestore');
const { isTakeoverActive } = require('./takeover');
const trackingHelper = require('./tracking-helper');

// ─── Smart Order & Booking Extraction ─────────────────────────
const ORDER_TAG = '[ORDER_CONFIRMED]';

function extractOrder(rawReply) {
  const tagIndex = rawReply.indexOf(ORDER_TAG);
  if (tagIndex === -1) return { reply: rawReply, orderData: null };

  const jsonStart = tagIndex + ORDER_TAG.length;
  const jsonStr = rawReply.slice(jsonStart).trim();
  const cleanReply = rawReply.slice(0, tagIndex).trim();

  try {
    const orderData = JSON.parse(jsonStr);
    return { reply: cleanReply, orderData };
  } catch (e) {
    console.error('[Handler] Failed to parse order JSON:', e.message);
    return { reply: cleanReply, orderData: null };
  }
}

// ─── Zero-Trust Product Media Resolution (ID-Based) ───────────
const SHOW_PRODUCT_TAG = '[SHOW_PRODUCT:';
const SHOW_GALLERY_TAG = '[SHOW_PRODUCT_GALLERY:';

function extractProductMedia(rawReply, productsList = []) {
  let cleanReply = rawReply;
  let singleProductId = null;
  let galleryProductId = null;

  // 1. Check for single product tag [SHOW_PRODUCT: prod_id]
  const singleIdx = cleanReply.indexOf(SHOW_PRODUCT_TAG);
  if (singleIdx !== -1) {
    const endIdx = cleanReply.indexOf(']', singleIdx);
    if (endIdx !== -1) {
      singleProductId = cleanReply.slice(singleIdx + SHOW_PRODUCT_TAG.length, endIdx).trim();
      cleanReply = cleanReply.slice(0, singleIdx) + cleanReply.slice(endIdx + 1);
    }
  }

  // 2. Check for gallery tag [SHOW_PRODUCT_GALLERY: prod_id]
  const galleryIdx = cleanReply.indexOf(SHOW_GALLERY_TAG);
  if (galleryIdx !== -1) {
    const endIdx = cleanReply.indexOf(']', galleryIdx);
    if (endIdx !== -1) {
      galleryProductId = cleanReply.slice(galleryIdx + SHOW_GALLERY_TAG.length, endIdx).trim();
      cleanReply = cleanReply.slice(0, galleryIdx) + cleanReply.slice(endIdx + 1);
    }
  }

  cleanReply = cleanReply.trim();

  // Lookup strictly in trusted products array (Zero-Trust)
  let mediaToSend = [];
  const targetId = galleryProductId || singleProductId;

  if (targetId && Array.isArray(productsList)) {
    const product = productsList.find(p => p && String(p.id).trim() === targetId);
    if (product) {
      if (galleryProductId) {
        // Gallery mode: Send all available images (primary + secondary) up to 5
        const allImages = [];
        if (product.primaryImage) allImages.push(product.primaryImage);
        if (Array.isArray(product.secondaryImages)) {
          allImages.push(...product.secondaryImages.filter(Boolean));
        } else if (Array.isArray(product.images)) {
          allImages.push(...product.images.filter(Boolean));
        }
        mediaToSend = allImages.slice(0, 5);
      } else if (singleProductId) {
        // Single mode: Send primary image
        const mainImg = product.primaryImage || (Array.isArray(product.images) ? product.images[0] : null);
        if (mainImg) mediaToSend = [mainImg];
      }
    }
  }

  return { cleanReply, mediaToSend };
}

// Helper: send plain text reply
async function sendTextReply(msg, userId, text) {
  await msg.reply(text).catch(async (replyErr) => {
    console.warn('[Handler] msg.reply failed, trying sendMessage:', replyErr.message);
    if (msg.client && typeof msg.client.sendMessage === 'function') {
      await msg.client.sendMessage(userId, text);
    }
  });
}

// AI output is untrusted input: whitelist the fields we accept and
// clamp their length before anything reaches the database.
function sanitizeOrder(orderData) {
  if (!orderData || typeof orderData !== 'object') return null;
  const str = v => (typeof v === 'string' ? v.trim().slice(0, 300) : '');
  const sanitized = {
    phone: str(orderData.phone),
    address: str(orderData.address),
    product: str(orderData.product),
    price: str(orderData.price),
  };
  if (!sanitized.product && !sanitized.phone) return null;
  return sanitized;
}

const path = require('path');
const fs = require('fs');

async function resolveWhatsAppMedia(mediaUrl) {
  try {
    if (!mediaUrl || typeof mediaUrl !== 'string') return null;

    // Direct support for compressed base64 data URLs
    if (mediaUrl.startsWith('data:')) {
      const parts = mediaUrl.split(',');
      if (parts.length === 2) {
        const header = parts[0];
        const base64Data = parts[1];
        const mimeMatch = header.match(/:(.*?);/);
        const mimetype = mimeMatch ? mimeMatch[1] : 'image/jpeg';
        return new MessageMedia(mimetype, base64Data, 'product.jpg');
      }
    }

    if (mediaUrl.startsWith('http://') || mediaUrl.startsWith('https://')) {
      const filename = path.basename(new URL(mediaUrl).pathname);
      const localPath = path.resolve(__dirname, 'uploads', filename);
      if (fs.existsSync(localPath)) {
        return MessageMedia.fromFilePath(localPath);
      }
    }
  } catch (e) {}
  return await MessageMedia.fromUrl(mediaUrl, { unsafeMime: true }).catch(() => null);
}

const crypto = require('crypto');

// ─── Pure Node.js WhatsApp Media Decryption (HKDF + AES-256-CBC) ───
function toMediaKeyBuffer(rawKey) {
  if (!rawKey) return null;
  if (Buffer.isBuffer(rawKey)) return rawKey;
  if (rawKey instanceof Uint8Array || Array.isArray(rawKey)) return Buffer.from(rawKey);
  if (typeof rawKey === 'object' && Array.isArray(rawKey.data)) return Buffer.from(rawKey.data);
  if (typeof rawKey === 'string') {
    try {
      const b64 = Buffer.from(rawKey, 'base64');
      if (b64.length === 32) return b64;
    } catch {}
    try {
      const bin = Buffer.from(rawKey, 'binary');
      if (bin.length === 32) return bin;
    } catch {}
  }
  return null;
}

function decryptWhatsAppMedia(encryptedBuffer, rawMediaKey, mediaType = 'audio') {
  const mediaKey = toMediaKeyBuffer(rawMediaKey);
  if (!mediaKey || mediaKey.length !== 32) {
    throw new Error('Invalid mediaKey length (must be 32 bytes)');
  }

  const info = mediaType === 'image'
    ? 'WhatsApp Image Keys'
    : mediaType === 'video'
    ? 'WhatsApp Video Keys'
    : mediaType === 'document'
    ? 'WhatsApp Document Keys'
    : 'WhatsApp Audio Keys';

  const expandedAB = crypto.hkdfSync('sha256', mediaKey, Buffer.alloc(0), Buffer.from(info), 112);
  const expanded = Buffer.from(expandedAB);
  const iv = expanded.subarray(0, 16);
  const cipherKey = expanded.subarray(16, 48);

  const encData = encryptedBuffer.length > 10
    ? encryptedBuffer.subarray(0, encryptedBuffer.length - 10)
    : encryptedBuffer;

  const decipher = crypto.createDecipheriv('aes-256-cbc', cipherKey, iv);
  return Buffer.concat([decipher.update(encData), decipher.final()]);
}

// ─── Multi-Strategy WhatsApp Audio Extractor ─────────────────
async function extractWhatsAppAudio(msg, maxRetries = 4, delayMs = 500) {
  if (!msg) return null;

  // 1. Primary: Direct Node.js CDN Fetch + HKDF-AES Decrypt (100% Reliable, 0% Puppeteer Dependency)
  try {
    let directPath = msg._data?.directPath || msg.directPath;
    let mediaKey = msg._data?.mediaKey || msg.mediaKey;
    let mimetype = msg._data?.mimetype || msg.mimetype || 'audio/ogg';

    if ((!directPath || !mediaKey) && msg.client && msg.client.pupPage) {
      const meta = await msg.client.pupPage.evaluate((msgId) => {
        try {
          const m = window.Store.Msg.get(msgId) || (window.Store.Msg.getMessagesById && window.Store.Msg.getMessagesById([msgId])?.messages?.[0]);
          if (!m) return null;
          return {
            directPath: m.directPath || m.mediaData?.directPath,
            mediaKey: m.mediaKey || m.mediaData?.mediaKey,
            mimetype: m.mimetype || m.mediaData?.mimetype,
            clientUrl: m.clientUrl || m.mediaData?.clientUrl,
          };
        } catch {
          return null;
        }
      }, msg.id._serialized);

      if (meta) {
        directPath = directPath || meta.directPath || meta.clientUrl;
        mediaKey = mediaKey || meta.mediaKey;
        mimetype = mimetype || meta.mimetype;
      }
    }

    if (directPath && mediaKey) {
      const cdnUrl = directPath.startsWith('http') ? directPath : `https://mmg.whatsapp.net${directPath}`;
      const cdnRes = await fetch(cdnUrl, {
        signal: AbortSignal.timeout(12000),
        headers: {
          'User-Agent': 'WhatsApp/2.24.6.77 i',
          'Origin': 'https://web.whatsapp.com',
          'Referer': 'https://web.whatsapp.com/',
        },
      });

      if (cdnRes.ok) {
        const encBuffer = Buffer.from(await cdnRes.arrayBuffer());
        const decrypted = decryptWhatsAppMedia(encBuffer, mediaKey, 'audio');
        if (decrypted && decrypted.length > 0) {
          console.log(`[Handler] ⚡ Voice note decrypted directly in Node.js via HKDF-AES (${Math.round(decrypted.length / 1024)}KB)`);
          return {
            data: decrypted.toString('base64'),
            mimeType: (mimetype || 'audio/ogg').split(';')[0].trim(),
          };
        }
      }
    }
  } catch (nodeCryptoErr) {
    console.warn('[Handler] Direct Node.js decrypt notice:', nodeCryptoErr.message);
  }

  // 2. Secondary fallback: WWebJS downloadMedia with retry
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const stdMedia = await msg.downloadMedia();
      if (stdMedia && stdMedia.data && typeof stdMedia.data === 'string' && stdMedia.data.length > 0) {
        console.log(`[Handler] ✅ Voice note extracted via WWebJS on attempt ${attempt}`);
        return {
          data: stdMedia.data,
          mimeType: (stdMedia.mimetype || 'audio/ogg').split(';')[0].trim(),
        };
      }
    } catch (err) {}

    if (attempt < maxRetries) {
      await new Promise(r => setTimeout(r, delayMs));
    }
  }

  return null;
}

// ─── Contact Avatar Cache (TTL: 24h) ─────────────────────────
const avatarCache = new Map();

// ─── Message Handler ─────────────────────────────────────────
async function handleMessage(msg, config) {
  let userId = null;
  let userName = null;
  let userAvatar = null;
  try {
    // Skip messages from the bot itself
    if (msg.fromMe) return;

    // Skip status broadcasts and system messages
    if (msg.from === 'status@broadcast' || !msg.from) return;

    // Skip group messages (IDs ending with @g.us) to avoid group spam
    if (typeof msg.from === 'string' && msg.from.endsWith('@g.us')) {
      return;
    }

    // Check if message is a voice note / audio
    const isAudio = msg.type === 'ptt' ||
                    msg.type === 'audio' ||
                    (msg.hasMedia && (msg.type === 'ptt' || msg.type === 'audio' || (msg._data?.mimetype && msg._data.mimetype.includes('audio'))));
    const userMessage = (msg.body || '').trim();

    // Skip empty or non-text messages unless it is an audio/voice note
    if (!userMessage && !isAudio) {
      return;
    }

    userId = msg.from;
    userName = msg._data?.notifyName || msg.notifyName || 'زبون واتساب';

    // Fetch customer avatar URL if available (cached in memory)
    if (avatarCache.has(userId)) {
      userAvatar = avatarCache.get(userId);
    } else if (msg.client) {
      try {
        const contact = await msg.getContact();
        userAvatar = (contact && typeof contact.getProfilePicUrl === 'function')
          ? await contact.getProfilePicUrl().catch(() => null)
          : null;
        avatarCache.set(userId, userAvatar || null);
      } catch {
        avatarCache.set(userId, null);
      }
    }

    // Download audio data with multi-strategy extractor
    let audioData = null;
    if (isAudio) {
      const extracted = await extractWhatsAppAudio(msg, 5, 600);
      if (extracted && extracted.data) {
        audioData = {
          data: extracted.data,
          mimeType: extracted.mimetype || extracted.mimeType || 'audio/ogg',
        };
      }
    }

    const displayMessage = userMessage || (isAudio ? '[رسالة صوتية]' : '');
    console.log(`[Handler] New message from ${userName} (${userId}): "${displayMessage}"`);

    // Log the customer's message IMMEDIATELY — before any AI call —
    // so a provider outage can never silently swallow it
    await firestore.logMessage({
      botId: config.id,
      ownerUserId: config.userId,
      from: userId,
      userName,
      userAvatar,
      message: displayMessage,
      response: null,
    }).catch(e => console.error('[Handler] Log error:', e.message));

    // Manual mode: the owner took over this chat — message is logged
    // above; stay silent (no AI reply)
    if (isTakeoverActive(config.id, userId)) {
      console.log(`[Handler] ✋ Manual mode ON for ${userId} — skipping AI reply`);
      return;
    }

    // If audio download failed completely and no text exists
    if (isAudio && !userMessage && !audioData) {
      await sendTextReply(msg, userId, 'عذراً، لم أتمكن من تشغيل التسجيل الصوتي. هل يمكنك إعادة إرساله أو كتابة استفسارك؟ 🙏');
      return;
    }

    // Fetch live bot document to guarantee instant sync of newly added products
    let liveConfig = config;
    try {
      const freshBot = await firestore.getBot(config.id);
      if (freshBot) {
        liveConfig = { ...config, ...freshBot };
      }
    } catch (e) {}

    // ─── Fast-Path Tracking Engine (0 LLM Calls) ────────────────
    const trackingEnabled = liveConfig.features
      ? liveConfig.features.orderTracking !== false && liveConfig.features.orders !== false
      : (liveConfig.orderTrackingEnabled !== false);

    if (trackingEnabled && userMessage && trackingHelper.isTrackingIntent(userMessage)) {
      const explicitCode = trackingHelper.extractTrackingCode(userMessage);
      const orders = await firestore.findOrdersForTracking(config.id, userId, explicitCode);
      let trackingReply = '';

      if (orders.length === 1) {
        trackingReply = trackingHelper.formatSingleOrderCard(orders[0]);
      } else if (orders.length > 1) {
        trackingReply = trackingHelper.formatMultipleOrdersList(orders);
      } else {
        trackingReply = trackingHelper.formatNoOrdersFound(explicitCode);
      }

      await sendTextReply(msg, userId, trackingReply);

      firestore.logBotMessage({
        botId: config.id,
        ownerUserId: config.userId,
        to: userId,
        userName,
        message: trackingReply,
      }).catch(() => {});

      firestore.incrementMessageCount(config.id).catch(() => {});
      console.log(`[Handler] ⚡ Fast-Path Tracking Reply sent to ${userName} (${userId}) — 0 LLM calls`);
      return;
    }

    // Build config with auto-orders flag
    const aiConfig = {
      ...liveConfig,
      autoOrdersEnabled: liveConfig.autoOrdersWhatsapp !== false,
    };

    // Get AI response from Gemini (with audioData if available)
    const rawReply = await askOpenRouter(aiConfig, userId, userMessage, audioData);

    // Extract order if present
    const { reply: replyWithoutOrder, orderData } = extractOrder(rawReply);

    // Extract Zero-Trust product media tags
    const { cleanReply: finalReplyText, mediaToSend } = extractProductMedia(replyWithoutOrder, liveConfig.products);
    const reply = finalReplyText || replyWithoutOrder;

    // Send reply with media (Primary Image / Gallery) or Fallback to Text
    if (mediaToSend.length > 0) {
      try {
        const media = await resolveWhatsAppMedia(mediaToSend[0]);
        if (media && msg.client) {
          // Send primary image with caption text
          await msg.client.sendMessage(userId, media, { caption: reply });

          // Send secondary images if in gallery mode
          for (let i = 1; i < mediaToSend.length; i++) {
            const extraMedia = await resolveWhatsAppMedia(mediaToSend[i]);
            if (extraMedia) {
              await new Promise(r => setTimeout(r, 400));
              await msg.client.sendMessage(userId, extraMedia);
            }
          }
        } else {
          // Fallback to text if media failed to download
          await sendTextReply(msg, userId, reply);
        }
      } catch (mediaErr) {
        console.warn('[Handler] Media send failed, falling back to text:', mediaErr.message);
        await sendTextReply(msg, userId, reply);
      }
    } else {
      // Standard text reply
      await sendTextReply(msg, userId, reply);
    }


    console.log(`[Handler] 🤖 Sent AI reply to ${userName}: "${reply.slice(0, 50)}..."`);


    // Log the bot's reply on its own
    firestore.logBotMessage({
      botId: config.id,
      ownerUserId: config.userId,
      to: userId,
      userName,
      message: reply,
    }).catch(e => console.error('[Handler] Log error:', e.message));

    // Save order / booking if confirmed (validated: whitelisted fields only)
    const order = sanitizeOrder(orderData);
    if (order) {
      firestore.saveOrder({
        botId: config.id,
        ownerUserId: config.userId,
        platform: 'whatsapp',
        customerId: String(userId),
        customerName: userName,
        phone: order.phone,
        address: order.address,
        product: order.product,
        price: order.price,
        orderSummary: reply.slice(-500),
      }).then(async (saved) => {
        if (!saved || config.notificationsEnabled === false) return;

        // 1) In-app bell notification (dashboard listens in realtime)
        firestore.createNotification({
          userId: config.userId,
          botId: config.id,
          type: 'order',
          title: `طلبية جديدة #${saved.trackingCode}`,
          body: `${userName} — ${order.product || 'منتج'}${order.price ? ` — ${order.price} دج` : ''}`,
          meta: { orderId: saved.id, trackingCode: saved.trackingCode },
        }).catch(() => {});

        // 2) WhatsApp self-message to the merchant's own chat
        try {
          const selfJid = msg.client.info.wid._serialized;
          await msg.client.sendMessage(selfJid,
            `📦 *طلبية جديدة!* #${saved.trackingCode}\n\n` +
            `👤 ${userName}\n` +
            `🛒 ${order.product || '—'}` +
            (order.price ? `\n💰 ${order.price} دج` : '') +
            (order.address ? `\n📍 ${order.address}` : '') +
            `\n\nأدرها من لوحة AuraBot.`);
        } catch (e) {
          console.warn('[Handler] Merchant self-notify failed:', e.message);
        }
      }).catch(e => console.error('[Handler] Save order error:', e.message));
    }

    firestore.incrementMessageCount(config.id)
      .catch(e => console.error('[Handler] Count error:', e.message));

  } catch (err) {
    console.error(`[Handler] Error for WhatsApp bot "${config?.botName}":`, err.message);
    // Never leave the customer in silence when the AI fails
    if (userId) {
      try {
        await msg.reply('عذراً، حدث خطأ مؤقت في المعالجة. يرجى إعادة إرسال رسالتك بعد قليل. 🙏');
      } catch {}
    }
  }
}

module.exports = { handleMessage };
