// ═══════════════════════════════════════════════════════════════
// BotForge WhatsApp Engine — NexCloud Service Layer
// Database + Storage + Notifications via NexCloud API
// ═══════════════════════════════════════════════════════════════

const API = process.env.NEXCLOUD_URL || 'https://nexcloud-production.up.railway.app/api/v1';
const KEY = process.env.NEXCLOUD_KEY;

async function nex(method, path, body) {
  const headers = { 'x-api-key': KEY, 'Content-Type': 'application/json' };
  const opt = { method, headers };
  if (body) opt.body = JSON.stringify(body);
  const res = await fetch(API + path, opt);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'NexCloud HTTP ' + res.status);
  return data;
}

// ─── Bots ─────────────────────────────────────────────────────
async function getActiveBots() {
  const res = await nex('GET', '/database/ext/bots/documents?page=1&limit=100');
  return (res.documents || []).map(d => ({ id: d.id, ...d.data }));
}

async function getBot(botId) {
  const res = await nex('GET', '/database/ext/bots/documents/' + botId);
  return res.document ? { id: res.document.id, ...res.document.data } : null;
}

async function updateBotStatus(botId, status, extra = {}) {
  await nex('PATCH', '/database/ext/bots/documents/' + botId, {
    data: { whatsappStatus: status, ...extra },
    merge: true,
  });
}

// ─── Conversations ────────────────────────────────────────────
async function logMessage({ botId, from, userName, message, response }) {
  const ts = new Date().toISOString();
  // Save user message
  await nex('POST', '/database/ext/conversations/documents', {
    data: {
      botId,
      platform: 'whatsapp',
      telegramUserId: String(from),
      userName: userName || 'زبون واتساب',
      content: message.slice(0, 500),
      role: 'user',
      createdAt: ts,
    },
  });
  // Save bot reply
  await nex('POST', '/database/ext/conversations/documents', {
    data: {
      botId,
      platform: 'whatsapp',
      telegramUserId: String(from),
      userName: userName || 'زبون واتساب',
      content: response.slice(0, 500),
      role: 'bot',
      createdAt: new Date(Date.now() + 1).toISOString(), // +1ms to ensure correct order
    },
  });
}

async function incrementMessageCount(botId) {
  try {
    const res = await nex('GET', '/database/ext/bots/documents/' + botId);
    const current = res.document?.data?.messagesCount || 0;
    await nex('PATCH', '/database/ext/bots/documents/' + botId, {
      data: { messagesCount: current + 1 },
      merge: true,
    });
  } catch (e) {
    console.error('[NexCloud] Failed to increment count:', e.message);
  }
}

async function getTodayMessageCount(botId) {
  try {
    const bot = await getBot(botId);
    return bot?.messagesCount || 0;
  } catch {
    return 0;
  }
}

// ─── Orders ────────────────────────────────────────────────────
async function saveOrder(orderData) {
  await nex('POST', '/database/ext/orders/documents', {
    data: orderData,
  });
}

module.exports = {
  getActiveBots,
  getBot,
  updateBotStatus,
  logMessage,
  incrementMessageCount,
  getTodayMessageCount,
  saveOrder,
};
