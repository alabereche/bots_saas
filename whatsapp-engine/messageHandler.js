// ═══════════════════════════════════════════════════════════════
// BotForge WhatsApp Engine — Message Handler
// Processes incoming WhatsApp messages via Gemini AI
// with smart order extraction and customer confirmation
// ═══════════════════════════════════════════════════════════════

const { askOpenRouter } = require('./openrouter');
const nexcloud = require('./nexcloud');

// ─── Smart Order Extraction ──────────────────────────────────
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

  const chat = await msg.getChat();
  
  // Skip group messages to avoid spamming
  if (chat.isGroup) {
    return;
  }

  const userMessage = msg.body.trim();
  const contact = await msg.getContact();
  const userName = contact.pushname || contact.name || 'زبون';
  const userId = msg.from;

  try {
    // Show typing state
    await chat.sendStateTyping();

    // Build config with auto-orders flag
    const aiConfig = {
      ...config,
      autoOrdersEnabled: config.autoOrdersWhatsapp !== false, // enabled by default
    };

    // Get AI response
    const rawReply = await askOpenRouter(aiConfig, userId, userMessage);

    // Extract order if present and clean the reply
    const { reply, orderData } = extractOrder(rawReply);

    // Send cleaned reply to customer
    await msg.reply(reply);

    // Save order if confirmed
    if (orderData) {
      nexcloud.saveOrder({
        botId: config.id,
        platform: 'whatsapp',
        customerId: String(userId),
        customerName: userName,
        phone: orderData.phone || '',
        address: orderData.address || '',
        product: orderData.product || '',
        price: orderData.price || '',
        orderSummary: reply.slice(-500),
        status: 'new',
        createdAt: new Date().toISOString(),
      }).then(() => {
        console.log(`[Handler] ✅ Order saved: ${userName} — ${orderData.product} (whatsapp)`);
      }).catch(e => console.error('[Handler] Save order error:', e.message));
    }

    // Log to NexCloud (non-blocking)
    nexcloud.logMessage({
      botId: config.id,
      from: userId,
      userName,
      message: userMessage,
      response: reply,
    }).catch(e => console.error('[Handler] Log error:', e.message));

    nexcloud.incrementMessageCount(config.id)
      .catch(e => console.error('[Handler] Count error:', e.message));

  } catch (err) {
    console.error(`[Handler] Error for bot "${config.botName}":`, err.message);
    await msg.reply('عذراً، حدث خطأ أثناء المعالجة. حاول مرة أخرى.').catch(() => {});
  }
}

module.exports = { handleMessage };
