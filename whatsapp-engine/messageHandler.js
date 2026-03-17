// ═══════════════════════════════════════════════════════════════
// BotForge WhatsApp Engine — Message Handler
// Processes incoming WhatsApp messages via OpenRouter AI
// ═══════════════════════════════════════════════════════════════

const { askOpenRouter } = require('./openrouter');
const nexcloud = require('./nexcloud');

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
    const chat = await msg.getChat();
    await chat.sendStateTyping();

    // Get AI response
    const reply = await askOpenRouter(config, userId, userMessage);

    // Send reply
    await msg.reply(reply);

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
