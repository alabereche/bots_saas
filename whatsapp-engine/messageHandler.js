// ═══════════════════════════════════════════════════════════════
// BotForge WhatsApp Engine — Message Handler
// Processes incoming WhatsApp messages via Gemini AI
// with universal order/booking extraction and customer confirmation
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

// ─── Message Handler ─────────────────────────────────────────
async function handleMessage(msg, config) {
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

    const userId = msg.from;
    const userName = msg._data?.notifyName || msg.notifyName || 'زبون واتساب';

    console.log(`[Handler] 📩 New message from ${userName} (${userId}): "${userMessage}"`);

    // Manual mode: the owner took over this chat — log the message
    // for the dashboard but stay silent (no AI reply)
    if (isTakeoverActive(config.id, userId)) {
      console.log(`[Handler] ✋ Manual mode ON for ${userId} — skipping AI reply`);
      await firestore.logMessage({
        botId: config.id,
        from: userId,
        userName,
        message: userMessage,
        response: null,
      }).catch(e => console.error('[Handler] Log error:', e.message));
      return;
    }

    // Build config with auto-orders flag
    const aiConfig = {
      ...config,
      autoOrdersEnabled: config.autoOrdersWhatsapp !== false,
    };

    // Get AI response from Gemini 3.5 Flash-Lite
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

    // Save order / booking if confirmed
    if (orderData) {
      firestore.saveOrder({
        botId: config.id,
        platform: 'whatsapp',
        customerId: String(userId),
        customerName: userName,
        phone: orderData.phone || '',
        address: orderData.address || '',
        product: orderData.product || '',
        price: orderData.price || '',
        orderSummary: reply.slice(-500),
      }).catch(e => console.error('[Handler] Save order error:', e.message));
    }

    // Log to Firestore (non-blocking)
    firestore.logMessage({
      botId: config.id,
      from: userId,
      userName,
      message: userMessage,
      response: reply,
    }).catch(e => console.error('[Handler] Log error:', e.message));

    firestore.incrementMessageCount(config.id)
      .catch(e => console.error('[Handler] Count error:', e.message));

  } catch (err) {
    console.error(`[Handler] Error for WhatsApp bot "${config?.botName}":`, err.message);
  }
}

module.exports = { handleMessage };
