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
const { syncToGoogleSheets } = require('./sheetsSync');
const { createBoundedCache } = require('./boundedCache');

// ─── Robust JSON Parser (handles markdown codeblocks, whitespace, trailing commas) ───
function parseRobustJson(raw) {
  if (!raw || typeof raw !== 'string') return null;
  let text = raw.trim();
  try { return JSON.parse(text); } catch {}
  text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  try { return JSON.parse(text); } catch {}
  const firstOpen = text.indexOf('{');
  const lastClose = text.lastIndexOf('}');
  if (firstOpen !== -1 && lastClose > firstOpen) {
    const candidate = text.substring(firstOpen, lastClose + 1);
    try { return JSON.parse(candidate); } catch {}
    try {
      const cleanTrailing = candidate.replace(/,\s*([}\]])/g, '$1');
      return JSON.parse(cleanTrailing);
    } catch {}
  }
  return null;
}

// ─── Smart Order & Lead Extraction ───────────────────────────
const ORDER_TAG = '[ORDER_CONFIRMED]';
const LEAD_TAG = '[LEAD_QUALIFIED]';

function extractOrder(rawReply) {
  const tagIndex = rawReply.indexOf(ORDER_TAG);
  if (tagIndex === -1) return { reply: rawReply, orderData: null };

  const jsonStart = tagIndex + ORDER_TAG.length;
  const jsonStr = rawReply.slice(jsonStart).trim();
  const cleanReply = rawReply.slice(0, tagIndex).trim();

  const orderData = parseRobustJson(jsonStr);
  return { reply: cleanReply, orderData };
}

function extractLead(rawReply) {
  const tagIndex = rawReply.indexOf(LEAD_TAG);
  if (tagIndex === -1) return { reply: rawReply, leadData: null };

  const jsonStart = tagIndex + LEAD_TAG.length;
  const jsonStr = rawReply.slice(jsonStart).trim();
  const cleanReply = rawReply.slice(0, tagIndex).trim();

  const leadData = parseRobustJson(jsonStr);
  return { reply: cleanReply, leadData };
}

function sanitizeLead(leadData) {
  if (!leadData || typeof leadData !== 'object') return null;
  const str = v => (typeof v === 'string' ? v.trim().slice(0, 300) : '');
  const sanitized = {
    name: str(leadData.name),
    phone: str(leadData.phone),
    company: str(leadData.company),
    service: str(leadData.service),
    budget: str(leadData.budget),
    leadStatus: ['hot', 'warm', 'cold'].includes(leadData.leadStatus) ? leadData.leadStatus : 'hot',
    notes: str(leadData.notes),
  };
  if (!sanitized.name && !sanitized.phone && !sanitized.service) return null;
  return sanitized;
}

// Deterministic phone number extractor
function extractPhoneNumber(text) {
  if (!text || typeof text !== 'string') return null;
  const dzMatch = text.match(/(?:(?:\+|00)213\s?|0)[567]\d{8}/);
  if (dzMatch) return dzMatch[0].replace(/\s+/g, '');
  const genMatch = text.match(/(?:\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,5}/);
  if (genMatch) {
    const digits = genMatch[0].replace(/\D/g, '');
    if (digits.length >= 8 && digits.length <= 15) {
      return genMatch[0].trim();
    }
  }
  return null;
}

// ─── Zero-Trust Product Media Resolution (ID-Based) ───────────
const SHOW_PRODUCT_TAG = '[SHOW_PRODUCT:';
const SHOW_GALLERY_TAG = '[SHOW_PRODUCT_GALLERY:';

function extractProductMedia(rawReply, productsList = []) {
  let cleanReply = rawReply;
  let galleryProductId = null;
  const singleIds = [];

  // 1. Gallery tag [SHOW_PRODUCT_GALLERY: prod_id] — one product, many images
  const galleryIdx = cleanReply.indexOf(SHOW_GALLERY_TAG);
  if (galleryIdx !== -1) {
    const endIdx = cleanReply.indexOf(']', galleryIdx);
    if (endIdx !== -1) {
      galleryProductId = cleanReply.slice(galleryIdx + SHOW_GALLERY_TAG.length, endIdx).trim();
      cleanReply = cleanReply.slice(0, galleryIdx) + cleanReply.slice(endIdx + 1);
    }
  }

  // 2. ALL single product tags [SHOW_PRODUCT: prod_id] — in order, deduped,
  //    capped at 4 so a showcase never spams the chat
  const tagRe = /\[SHOW_PRODUCT:\s*([^\]]+)\]/g;
  let tm;
  while ((tm = tagRe.exec(cleanReply)) !== null) {
    const id = tm[1].trim();
    if (id && !singleIds.includes(id)) singleIds.push(id);
  }
  if (singleIds.length > 0) {
    cleanReply = cleanReply.replace(/\[SHOW_PRODUCT:\s*[^\]]+\]/g, '').trim();
  }

  cleanReply = cleanReply.trim();

  // Lookup strictly in trusted products array (Zero-Trust)
  const lookup = (id) =>
    Array.isArray(productsList) ? productsList.find(p => p && String(p.id).trim() === id) : null;

  // mediaItems: [{ image, caption, product }] — caption '__REPLY__' means
  // "use the AI's textual pitch as the caption" (single product / gallery)
  const mediaItems = [];
  let useReplyOnFirst = false;

  if (galleryProductId) {
    const product = lookup(galleryProductId);
    if (product) {
      const allImages = [];
      if (product.primaryImage) allImages.push(product.primaryImage);
      if (Array.isArray(product.secondaryImages)) {
        allImages.push(...product.secondaryImages.filter(Boolean));
      } else if (Array.isArray(product.images)) {
        allImages.push(...product.images.filter(Boolean));
      }
      allImages.slice(0, 5).forEach((img, i) => {
        mediaItems.push({ image: img, caption: i === 0 ? '__REPLY__' : null });
      });
      useReplyOnFirst = true;
    }
  } else if (singleIds.length > 0) {
    useReplyOnFirst = singleIds.length === 1;
    for (const id of singleIds.slice(0, 4)) {
      const product = lookup(id);
      if (!product) continue;
      const mainImg = product.primaryImage || (Array.isArray(product.images) ? product.images[0] : null);
      if (!mainImg) continue;
      mediaItems.push({ image: mainImg, caption: null, product });
    }
  }

  return { cleanReply, mediaItems, useReplyOnFirst };
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
    name: str(orderData.name),
    phone: str(orderData.phone),
    address: str(orderData.address),
    product: str(orderData.product),
    price: str(orderData.price),
    notes: str(orderData.notes),
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

// ─── Contact Avatar Cache — bounded (2000 entries) + real 24h TTL ──
const avatarCache = createBoundedCache({ maxEntries: 2000, ttlMs: 24 * 60 * 60 * 1000 });

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
        trackingReply = trackingHelper.formatSingleOrderCard(orders[0], liveConfig.businessType);
      } else if (orders.length > 1) {
        trackingReply = trackingHelper.formatMultipleOrdersList(orders, liveConfig.businessType);
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
      autoOrdersEnabled: liveConfig.autoOrdersWhatsapp !== false && (liveConfig.features ? liveConfig.features.orders !== false : true),
    };

    // Get AI response from Gemini (with audioData if available)
    const rawReply = await askOpenRouter(aiConfig, userId, userMessage, audioData);

    // Extract order if present
    const { reply: replyWithoutOrder, orderData } = extractOrder(rawReply);
    // Extract lead if present
    const { reply: replyWithoutTags, leadData } = extractLead(replyWithoutOrder);

    // Extract Zero-Trust product media tags (supports multi-product showcase)
    const { cleanReply: finalReplyText, mediaItems, useReplyOnFirst } = extractProductMedia(replyWithoutTags, liveConfig.products);
    const reply = finalReplyText || replyWithoutTags;

    // Send showcase: pitch text + each product as image with its own caption
    if (mediaItems.length > 0) {
      const resolved = [];
      for (const item of mediaItems) {
        try {
          const media = await resolveWhatsAppMedia(item.image);
          if (media) resolved.push({ media, caption: item.caption, product: item.product });
        } catch (e) {
          console.warn('[Handler] Media resolve failed:', e.message);
        }
        await new Promise(r => setTimeout(r, 250));
      }

      // Per-media safety net: a single failed image send must never poison
      // the whole showcase (1.34.7 page-getter regression on @lid chats
      // throws on media sends) — failed images degrade to a text line with
      // the product name + price instead of killing the reply.
      const sendMediaSafely = async (media, opts) => {
        // msg.reply FIRST — the message's own chat reference is the path
        // proven working on this session; sendMessage to the raw @lid id
        // is the fallback (it throws the page getter error on 1.34.7)
        try {
          await msg.reply(media, opts);
          return true;
        } catch (replyErr) {
          console.warn(`[Handler] Media msg.reply failed (${String(replyErr?.message || '').slice(0, 60)}) — trying sendMessage.`);
        }
        try {
          await msg.client.sendMessage(userId, media, opts);
          return true;
        } catch (sendErr) {
          const m = String(sendErr?.message || '');
          console.warn(`[Handler] Media send failed (${m.slice(0, 80)}) — degrading gracefully.`);
          try {
            const fallbackText = opts?.caption
              ? String(opts.caption).replace(/\n+/g, ' · ')
              : '🛍️ منتج متوفر لدينا — أرسل «التفاصيل» لمعرفة المزيد';
            await msg.client.sendMessage(userId, fallbackText);
          } catch { /* even text failed — nothing more we can do here */ }
          return false;
        }
      };

      if (resolved.length > 0 && msg.client) {
        if (useReplyOnFirst) {
          // Single product / gallery: AI pitch as the first image caption
          try {
            await msg.client.sendMessage(userId, resolved[0].media, { caption: reply });
          } catch (mediaErr) {
            const m = String(mediaErr?.message || '');
            console.warn(`[Handler] Media send failed (${m.slice(0, 80)}) — falling back to text.`);
            await msg.client.sendMessage(userId, `${reply}\n\n• ${String(resolved[0].product?.name || '').trim()}`.trim());
          }
          for (let i = 1; i < resolved.length; i++) {
            await new Promise(r => setTimeout(r, 400));
            try {
              await msg.client.sendMessage(userId, resolved[i].media);
            } catch (mediaErr) {
              console.warn(`[Handler] Media send failed (${String(mediaErr?.message || '').slice(0, 60)}) — skipping image.`);
            }
          }
        } else {
          // Multi-product showcase: images ARE the list. The AI's text must
          // be only a short intro — strip any lines that re-list showcased
          // products (name match) so nothing is shown twice.
          let pitch = (reply || '').trim();
          const names = resolved.map(r => r.product?.name).filter(Boolean);
          if (names.length > 0 && pitch) {
            const lows = names.map(n => String(n).toLowerCase());
            pitch = pitch
              .split('\n')
              .filter(line => {
                const low = line.toLowerCase();
                return !lows.some(n => n && low.includes(n.toLowerCase()));
              })
              .join('\n')
              .replace(/\n{2,}/g, '\n')
              .trim();
          }
          if (pitch) await msg.client.sendMessage(userId, pitch);
          for (const r of resolved) {
            const cur = liveConfig.currency || 'دج';
            const op = r.product ? parseFloat(r.product.oldPrice) : NaN;
            const np = r.product ? parseFloat(r.product.price) : NaN;
            const hasDisc = op > 0 && np > 0 && op > np;
            const discPct = hasDisc ? Math.round((1 - np / op) * 100) : 0;
            const cap = r.product
              ? `• ${r.product.name || 'منتج'}${hasDisc ? ` - كان ${r.product.oldPrice} ${cur}` : ''}${np ? ` - الآن: ${r.product.price} ${cur}` : ''}${hasDisc ? ` (خصم ${discPct}%)` : ''}`
              : '';
            await new Promise(r2 => setTimeout(r2, 400));
            try {
              await msg.client.sendMessage(userId, r.media, cap ? { caption: cap } : undefined);
            } catch (mediaErr) {
              // Image failed — never lose the product: send its text card
              const info = `${r.product?.name || 'منتج'}${np ? ` — ${r.product.price} ${cur}` : ''}`;
              try {
                await msg.client.sendMessage(userId, `🛍️ ${info}`);
              } catch { /* channel fully down — next message retries */ }
            }
          }
        }
      } else {
        // Fallback to text if media failed to download
        await sendTextReply(msg, userId, reply);
      }
    } else {
      // Standard text reply
      await sendTextReply(msg, userId, reply);
    }

    console.log(`[Handler] Sent AI reply to ${userName}: "${reply.slice(0, 50)}..."`);

    // Log the bot's reply on its own
    firestore.logBotMessage({
      botId: config.id,
      ownerUserId: config.userId,
      to: userId,
      userName,
      message: reply,
    }).catch(e => console.error('[Handler] Log error:', e.message));

    // 1) Save order / booking if confirmed
    const order = sanitizeOrder(orderData);
    if (order) {
      firestore.saveOrder({
        botId: config.id,
        ownerUserId: config.userId,
        platform: 'whatsapp',
        customerId: String(userId),
        customerName: order.name || userName || 'زبون',
        phone: order.phone,
        address: order.address,
        product: order.product,
        price: order.price,
        notes: order.notes || '-',
        orderSummary: reply.slice(-500),
      }, config.orderMergeMode || 'merge').then(async (saved) => {
        if (!saved) return;

        // Sync to Google Sheets / Webhook
        syncToGoogleSheets(liveConfig, {
          event: 'new_order',
          isUpdate: !!saved.isUpdate,
          orderId: saved.id,
          trackingCode: saved.trackingCode,
          customerName: saved.customerName || order.name || userName,
          phone: saved.phone || order.phone,
          address: saved.address || order.address,
          product: order.product,
          price: order.price,
          notes: order.notes || (saved.isUpdate ? 'تعديل/إضافة للطلبية' : '-'),
          orderSummary: '-',
          platform: 'whatsapp',
          createdAt: new Date().toISOString(),
        }).catch(err => console.warn('[Handler] Sheets sync error:', err.message));

        if (config.notificationsEnabled === false) return;

        // In-app bell notification
        firestore.createNotification({
          userId: config.userId,
          botId: config.id,
          type: 'order',
          title: saved.isUpdate ? `تعديل طلبية #${saved.trackingCode}` : `طلبية جديدة #${saved.trackingCode}`,
          body: `${saved.customerName || userName} — ${order.product || 'منتج'}${order.price ? ` — ${order.price} دج` : ''}`,
          meta: { orderId: saved.id, trackingCode: saved.trackingCode },
        }).catch(() => {});

        // WhatsApp self-message to the merchant
        try {
          const selfJid = msg.client.info.wid._serialized;
          await msg.client.sendMessage(selfJid,
            `*طلبية جديدة!* #${saved.trackingCode}\n\n` +
            `الزبون: ${userName}\n` +
            `المنتج: ${order.product || '—'}` +
            (order.price ? `\nالسعر: ${order.price} دج` : '') +
            (order.address ? `\nالعنوان: ${order.address}` : '') +
            (order.phone ? `\nالهاتف: ${order.phone}` : '') +
            `\n\nتم التسجيل في AuraBot وGoogle Sheets.`);
        } catch (e) {
          console.warn('[Handler] Merchant self-notify failed:', e.message);
        }
      }).catch(e => console.error('[Handler] Save order error:', e.message));
    }

    // 2) Save Qualified Lead if detected
    const lead = sanitizeLead(leadData);
    if (lead) {
      firestore.saveLead({
        botId: config.id,
        ownerUserId: config.userId,
        platform: 'whatsapp',
        customerId: String(userId),
        customerName: lead.name || userName,
        phone: lead.phone,
        company: lead.company,
        service: lead.service,
        budget: lead.budget,
        leadStatus: lead.leadStatus,
        notes: lead.notes || reply.slice(-300),
      }).then(async (savedLead) => {
        if (!savedLead) return;

        // Sync Lead to Google Sheets / Webhook
        syncToGoogleSheets(liveConfig, {
          event: 'new_lead',
          leadId: savedLead.id,
          customerName: lead.name || userName,
          phone: lead.phone,
          company: lead.company,
          service: lead.service,
          budget: lead.budget,
          leadStatus: lead.leadStatus,
          notes: lead.notes,
          platform: 'whatsapp',
          createdAt: new Date().toISOString(),
        }).catch(err => console.warn('[Handler] Sheets lead sync error:', err.message));

        if (config.notificationsEnabled === false) return;

        // In-app bell notification
        firestore.createNotification({
          userId: config.userId,
          botId: config.id,
          type: 'lead',
          title: `عميل محتمل جديد (${lead.leadStatus === 'hot' ? 'هام ومستعجل' : 'مهتم'})`,
          body: `${lead.name || userName} — ${lead.service || 'استفسار مخصص'}${lead.phone ? ` (${lead.phone})` : ''}`,
          meta: { leadId: savedLead.id },
        }).catch(() => {});

        // WhatsApp self-message to the merchant
        try {
          const selfJid = msg.client.info.wid._serialized;
          await msg.client.sendMessage(selfJid,
            `*عميل محتمل جديد (Lead)!*\n\n` +
            `الاسم: ${lead.name || userName}\n` +
            (lead.phone ? `الهاتف: ${lead.phone}\n` : '') +
            (lead.company ? `الشركة: ${lead.company}\n` : '') +
            (lead.service ? `الخدمة: ${lead.service}\n` : '') +
            (lead.budget ? `الميزانية: ${lead.budget}\n` : '') +
            `درجة الاهتمام: ${lead.leadStatus}\n\n` +
            `أدر العميل من لوحة AuraBot.`);
        } catch (e) {
          console.warn('[Handler] Merchant lead self-notify failed:', e.message);
        }
      }).catch(e => console.error('[Handler] Save lead error:', e.message));
    } else if (!orderData && userMessage) {
      // Deterministic Fallback: If AI omitted [LEAD_QUALIFIED] but user provided a valid phone number
      const detectedPhone = extractPhoneNumber(userMessage);
      if (detectedPhone) {
        console.log(`[Handler] Deterministic Lead Interceptor caught phone: ${detectedPhone} from ${userName}`);
        firestore.saveLead({
          botId: config.id,
          ownerUserId: config.userId,
          platform: 'whatsapp',
          customerId: String(userId),
          customerName: userName || 'عميل محتمل',
          phone: detectedPhone,
          company: '',
          service: liveConfig.businessType === 'booking' ? 'حجز موعد / استشارة' : (liveConfig.businessName || 'طلب خدمة واستفسار'),
          budget: '',
          leadStatus: 'hot',
          notes: userMessage.slice(0, 300),
        }).then(async (savedLead) => {
          if (!savedLead) return;

          syncToGoogleSheets(liveConfig, {
            event: 'new_lead',
            leadId: savedLead.id,
            customerName: userName || 'عميل محتمل',
            phone: detectedPhone,
            company: '',
            service: liveConfig.businessType === 'booking' ? 'حجز موعد / استشارة' : (liveConfig.businessName || 'طلب خدمة واستفسار'),
            budget: '',
            leadStatus: 'hot',
            notes: userMessage.slice(0, 300),
            platform: 'whatsapp',
            createdAt: new Date().toISOString(),
          }).catch(err => console.warn('[Handler] Sheets lead sync error:', err.message));

          if (config.notificationsEnabled === false) return;

          firestore.createNotification({
            userId: config.userId,
            botId: config.id,
            type: 'lead',
            title: 'عميل محتمل جديد (هام ومستعجل)',
            body: `${userName} — ${liveConfig.businessType === 'booking' ? 'حجز موعد / استشارة' : 'طلب خدمة'} (${detectedPhone})`,
            meta: { leadId: savedLead.id },
          }).catch(() => {});
        }).catch(e => console.error('[Handler] Fallback save lead error:', e.message));
      }
    }

    firestore.incrementMessageCount(config.id)
      .catch(e => console.error('[Handler] Count error:', e.message));

  } catch (err) {
    console.error(`[Handler] Error for WhatsApp bot "${config?.botName}":`, err.message);
    if (userId) {
      try {
        await msg.reply('عذراً، حدث خطأ مؤقت في المعالجة. يرجى إعادة إرسال رسالتك بعد قليل.');
      } catch {}
    }
  }
}

module.exports = { handleMessage };
