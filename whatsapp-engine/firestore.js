// ═══════════════════════════════════════════════════════════════
// BotForge WhatsApp Engine — Firestore Service Layer (Admin SDK)
// Privileged server identity: bypasses security rules, so the
// client-facing rules can stay locked to owners only.
// Credential: FIREBASE_SERVICE_ACCOUNT_B64 (base64 JSON) or
// GOOGLE_APPLICATION_CREDENTIALS (key file path).
// ═══════════════════════════════════════════════════════════════

const admin = require('firebase-admin');

const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_B64
  ? Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_B64, 'base64').toString('utf8')
  : null;

if (!admin.apps.length) {
  const credential = serviceAccountJson
    ? admin.credential.cert(JSON.parse(serviceAccountJson))
    : admin.credential.applicationDefault();
  admin.initializeApp({ credential });
}

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

// Every conversation/order document carries its owner's userId so the
// security rules can authorize reads/writes without a per-document get().
async function resolveOwnerUserId(botId, provided) {
  if (provided) return provided;
  const bot = await getBot(botId);
  return bot ? bot.userId || null : null;
}

// ─── Bots ─────────────────────────────────────────────────────

async function getActiveBots() {
  try {
    const snap = await db.collection('bots')
      .where('platform', '==', 'whatsapp')
      .where('isActive', '==', true)
      .get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) {
    console.error('[Firestore] Get active bots error:', e.message);
    return [];
  }
}

async function getBot(botId) {
  try {
    const snap = await db.collection('bots').doc(botId).get();
    return snap.exists ? { id: snap.id, ...snap.data() } : null;
  } catch (e) {
    console.error(`[Firestore] Get bot ${botId} error:`, e.message);
    return null;
  }
}

async function getBotsByOwner(userId) {
  try {
    const snap = await db.collection('bots')
      .where('userId', '==', userId)
      .get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) {
    console.error('[Firestore] Get bots by owner error:', e.message);
    return [];
  }
}

async function updateBotStatus(botId, status, extra = {}) {
  try {
    await db.collection('bots').doc(botId).update({
      whatsappStatus: status,
      isActive: status === 'connected',
      ...extra,
      updatedAt: FieldValue.serverTimestamp(),
    });
  } catch (e) {
    console.error(`[Firestore] Update bot status ${botId} error:`, e.message);
  }
}

// ─── Conversations (Messages) ─────────────────────────────────

async function logMessage({ botId, ownerUserId, from, userName, message, response = null }) {
  const ts = new Date().toISOString();
  try {
    const userId = await resolveOwnerUserId(botId, ownerUserId);

    // Save customer message
    await db.collection('conversations').add({
      botId,
      platform: 'whatsapp',
      userId: userId || '',
      telegramUserId: String(from),
      userName: userName || 'زبون واتساب',
      content: message.slice(0, 1000),
      role: 'user',
      createdAt: ts,
      timestamp: FieldValue.serverTimestamp(),
    });

    // Save bot response (absent in manual-takeover mode: only the
    // customer's message is logged, the owner replies themselves)
    if (response != null) {
      await db.collection('conversations').add({
        botId,
        platform: 'whatsapp',
        userId: userId || '',
        telegramUserId: String(from),
        userName: userName || 'زبون واتساب',
        content: response.slice(0, 1000),
        role: 'bot',
        createdAt: new Date(Date.now() + 10).toISOString(),
        timestamp: FieldValue.serverTimestamp(),
      });
    }
  } catch (e) {
    console.error('[Firestore] Log message error:', e.message);
  }
}

// Bot reply logged on its own (the customer's message is logged
// immediately on arrival, before the AI call, so it is never lost)
async function logBotMessage({ botId, ownerUserId, to, userName, message }) {
  try {
    const userId = await resolveOwnerUserId(botId, ownerUserId);
    await db.collection('conversations').add({
      botId,
      platform: 'whatsapp',
      userId: userId || '',
      telegramUserId: String(to),
      userName: userName || 'زبون واتساب',
      content: String(message).slice(0, 1000),
      role: 'bot',
      createdAt: new Date().toISOString(),
      timestamp: FieldValue.serverTimestamp(),
    });
  } catch (e) {
    console.error('[Firestore] Log bot message error:', e.message);
  }
}

// Owner's manual reply sent from the dashboard
async function logOwnerMessage({ botId, ownerUserId, to, userName, message }) {
  try {
    const userId = await resolveOwnerUserId(botId, ownerUserId);
    await db.collection('conversations').add({
      botId,
      platform: 'whatsapp',
      userId: userId || '',
      telegramUserId: String(to),
      userName: userName || 'المالك',
      content: String(message).slice(0, 1000),
      role: 'owner',
      createdAt: new Date().toISOString(),
      timestamp: FieldValue.serverTimestamp(),
    });
  } catch (e) {
    console.error('[Firestore] Log owner message error:', e.message);
  }
}

async function incrementMessageCount(botId) {
  try {
    await db.collection('bots').doc(botId).update({
      messagesCount: FieldValue.increment(1),
      lastActiveAt: new Date().toISOString(),
    });
  } catch (e) {
    console.error('[Firestore] Increment message count error:', e.message);
  }
}

// ─── Orders & Bookings ──────────────────────────────────────────

async function saveOrder(orderData) {
  try {
    const userId = await resolveOwnerUserId(orderData.botId, orderData.ownerUserId);
    await db.collection('orders').add({
      ...orderData,
      userId: userId || '',
      status: 'new',
      createdAt: new Date().toISOString(),
      timestamp: FieldValue.serverTimestamp(),
    });
    console.log(`[Firestore] 📦 WhatsApp Order saved: ${orderData.customerName} - ${orderData.product}`);
  } catch (e) {
    console.error('[Firestore] Save order error:', e.message);
  }
}

module.exports = {
  admin,
  db,
  getActiveBots,
  getBot,
  getBotsByOwner,
  updateBotStatus,
  logMessage,
  logBotMessage,
  logOwnerMessage,
  incrementMessageCount,
  saveOrder,
};
