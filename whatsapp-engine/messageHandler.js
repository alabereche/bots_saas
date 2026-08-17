// ═══════════════════════════════════════════════════════════════
// BotForge WhatsApp Engine — Message Handler
// Processes incoming WhatsApp messages via Gemini AI
// with universal order/booking extraction and customer confirmation.
// The customer's message is logged BEFORE the AI call so it is
// never lost, and AI-derived order data is validated before saving.
// ═══════════════════════════════════════════════════════════════

const { askOpenRouter } = require('./openrouter');
const firestore = require('./firestore');
const { isTakeoverActive } = require('./takeover');

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

// ─── Message Handler ─────────────────────────────────────────
async function handleMessage(msg, config) {
  let userId = null;
  let userName = null;
  try {
    // Skip messages from the bot itself
    if (msg.fromMe) return;

    // Skip status broadcasts and system messages
    if (msg.from === 'status@broadcast' || !msg.from) return;

    // Skip group messages (IDs ending with @g.us) to avoid group spam
    if (typeof msg.from === 'string' && msg.from.endsWith('@g.us')) {
      return;
    }

    // Skip empty or non-text messages
    const userMessage = (msg.body || '').trim();
    if (!userMessage) {
      return;
    }

    userId = msg.from;
    userName = msg._data?.notifyName || msg.notifyName || 'زبون واتساب';

    console.log(`[Handler] 📩 New message from ${userName} (${userId}): "${userMessage}"`);

    // Log the customer's message IMMEDIATELY — before any AI call —
    // so a provider outage can never silently swallow it
    await firestore.logMessage({
      botId: config.id,
      ownerUserId: config.userId,
      from: userId,
      userName,
      message: userMessage,
      response: null,
    }).catch(e => console.error('[Handler] Log error:', e.message));

    // Manual mode: the owner took over this chat — message is logged
    // above; stay silent (no AI reply)
    if (isTakeoverActive(config.id, userId)) {
      console.log(`[Handler] ✋ Manual mode ON for ${userId} — skipping AI reply`);
      return;
    }

    // Build config with auto-orders flag
    const aiConfig = {
      ...config,
      autoOrdersEnabled: config.autoOrdersWhatsapp !== false,
    };

    // Get AI response from Gemini
    const rawReply = await askOpenRouter(aiConfig, userId, userMessage);

    // Extract order if present and clean the reply
    const { reply, orderData } = extractOrder(rawReply);

    // Send reply to customer
    await msg.reply(reply).catch(async (replyErr) => {
      console.warn('[Handler] msg.reply failed, trying sendMessage:', replyErr.message);
      if (msg.client && typeof msg.client.sendMessage === 'function') {
        await msg.client.sendMessage(userId, reply);
      }
    });

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
