// ═══════════════════════════════════════════════════════════════
// BotForge WhatsApp Engine — Message Handler
// Processes incoming WhatsApp messages via Gemini AI
// with universal order/booking extraction and customer confirmation
// ═══════════════════════════════════════════════════════════════

const { askOpenRouter } = require('./openrouter');
const firestore = require('./firestore');

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
  // Skip messages from the bot itself
  if (msg.fromMe) return;

  // Skip non-text messages
  if (!msg.body || msg.body.trim() === '') {
    await msg.reply('عذراً، حالياً أستطيع الرد على الرسائل النصية فقط.');
    return;
  }

  let isGroup = false;
  let chat = null;
  try {
    chat = await msg.getChat();
    isGroup = chat?.isGroup || false;
  } catch (e) {
    isGroup = false;
  }
  
  // Skip group messages to avoid spamming
  if (isGroup) return;

  const userMessage = msg.body.trim();
  let userName = 'زبون واتساب';
  try {
    const contact = await msg.getContact();
    userName = contact?.pushname || contact?.name || 'زبون واتساب';
  } catch (e) {
    userName = 'زبون واتساب';
  }
  const userId = msg.from;

  console.log(`[Handler] 📩 Message from ${userName} (${userId}): "${userMessage}"`);

  try {
    // Show typing state if possible
    if (chat && typeof chat.sendStateTyping === 'function') {
      chat.sendStateTyping().catch(() => {});
    }

    // Build config with auto-orders flag
    const aiConfig = {
      ...config,
      autoOrdersEnabled: config.autoOrdersWhatsapp !== false,
    };

    // Get AI response
    const rawReply = await askOpenRouter(aiConfig, userId, userMessage);

    // Extract order if present and clean the reply
    const { reply, orderData } = extractOrder(rawReply);

    // Send cleaned reply to customer
    await msg.reply(reply);

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
    console.error(`[Handler] Error for bot "${config.botName}":`, err.message);
    await msg.reply('عذراً، حدث خطأ أثناء المعالجة. حاول مرة أخرى.').catch(() => {});
  }
}

module.exports = { handleMessage };
