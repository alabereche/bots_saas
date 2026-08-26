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

// ─── In-Memory Bot Config Cache (TTL: 60s) ───────────────────
const botConfigCache = new Map();
const BOT_CACHE_TTL_MS = 60 * 1000;

function invalidateBotCache(botId) {
  if (botId) botConfigCache.delete(botId);
}

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
    const snap = await db.collection('bots').get();
    return snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(b => {
        const isWhatsapp = b.whatsappEnabled === true || b.platform === 'whatsapp' || (Array.isArray(b.channels) && b.channels.includes('whatsapp'));
        const notDisabled = b.whatsappStatus !== 'disabled' && b.status !== 'disabled';
        return isWhatsapp && notDisabled;
      });
  } catch (e) {
    console.error('[Firestore] Get active bots error:', e.message);
    return [];
  }
}

async function getBot(botId, forceRefresh = false) {
  if (!botId) return null;
  const now = Date.now();
  const cached = botConfigCache.get(botId);

  if (!forceRefresh && cached && now - cached.timestamp < BOT_CACHE_TTL_MS) {
    return cached.data;
  }

  try {
    const snap = await db.collection('bots').doc(botId).get();
    if (snap.exists) {
      const data = { id: snap.id, ...snap.data() };
      botConfigCache.set(botId, { data, timestamp: now });
      return data;
    }
    botConfigCache.delete(botId);
    return null;
  } catch (e) {
    console.error(`[Firestore] Get bot ${botId} error:`, e.message);
    return cached ? cached.data : null; // Graceful fallback on network glitch
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

async function logMessage({ botId, ownerUserId, from, userName, userAvatar = null, message, response = null }) {
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
      userAvatar: userAvatar || null,
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
        userAvatar: userAvatar || null,
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
async function logBotMessage({ botId, ownerUserId, to, userName, message, platform }) {
  try {
    const userId = await resolveOwnerUserId(botId, ownerUserId);
    await db.collection('conversations').add({
      botId,
      platform: platform || 'whatsapp',
      userId: userId || '',
      telegramUserId: String(to),
      userName: userName || (platform === 'web' ? 'زائر الموقع' : 'زبون واتساب'),
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

// ─── Tracking Code Generator (Crockford Base32 High-Entropy) ───
const TRACKING_CHARS = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

function generateTrackingCode() {
  let code = 'DZ-';
  for (let i = 0; i < 6; i++) {
    const idx = Math.floor(Math.random() * TRACKING_CHARS.length);
    code += TRACKING_CHARS[idx];
  }
  return code;
}

// ─── Orders & Tracking Engine ───────────────────────────────────

async function saveOrder(orderData) {
  try {
    const userId = await resolveOwnerUserId(orderData.botId, orderData.ownerUserId);
    const trackingCode = orderData.trackingCode || generateTrackingCode();
    const now = new Date().toISOString();

    const initialHistory = [{
      orderStatus: 'confirmed',
      deliveryStatus: 'pending',
      timestamp: now,
      note: 'تم تسجيل وتأكيد الطلبية بنجاح',
    }];

    const docRef = await db.collection('orders').add({
      ...orderData,
      trackingCode,
      userId: userId || '',
      orderStatus: orderData.orderStatus || 'confirmed',
      deliveryStatus: orderData.deliveryStatus || 'pending',
      status: 'new', // backward compatibility
      statusHistory: initialHistory,
      deliveryProvider: orderData.deliveryProvider || 'manual',
      deliveryTrackingNumber: orderData.deliveryTrackingNumber || '',
      processedEvents: [],
      createdAt: now,
      timestamp: FieldValue.serverTimestamp(),
    });

    console.log(`[Firestore] 📦 WhatsApp Order saved: ${orderData.customerName} | Code: ${trackingCode} | Product: ${orderData.product}`);
    return { id: docRef.id, trackingCode };
  } catch (e) {
    console.error('[Firestore] Save order error:', e.message);
    return null;
  }
}

// Zero-IDOR Scoped Tracking Lookup
async function findOrdersForTracking(botId, customerId, specificCode = null) {
  try {
    if (specificCode) {
      const cleanCode = specificCode.trim().toUpperCase().replace('#', '');
      const snap = await db.collection('orders')
        .where('botId', '==', botId)
        .where('trackingCode', '==', cleanCode)
        .limit(1)
        .get();

      if (!snap.empty) {
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
      }
    }

    if (customerId) {
      const snap = await db.collection('orders')
        .where('botId', '==', botId)
        .where('customerId', '==', String(customerId))
        .get();

      if (!snap.empty) {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        return list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')).slice(0, 5);
      }
    }

    return [];
  } catch (e) {
    console.error('[Firestore] Find orders error:', e.message);
    return [];
  }
}

// Idempotent Delivery Status Update with IDOR Protection
async function updateOrderDeliveryStatus(orderId, newDeliveryStatus, providerInfo = {}, eventId = null, expectedBotId = null, expectedUserId = null) {
  if (!orderId) return { success: false, reason: 'Missing orderId' };
  try {
    const orderRef = db.collection('orders').doc(orderId);
    const snap = await orderRef.get();
    if (!snap.exists) return { success: false, reason: 'Order not found' };

    const data = snap.data();

    // Security Check: Enforce tenant ownership (F02 IDOR Defense)
    if (expectedBotId && data.botId && data.botId !== expectedBotId) {
      return { success: false, reason: 'غير مصرح: الطلبية لا تنتمي لهذا المتجر' };
    }
    const orderOwner = data.ownerUserId || data.userId;
    if (expectedUserId && orderOwner && orderOwner !== expectedUserId) {
      return { success: false, reason: 'غير مصرح: الطلبية لا تخص هذا المستخدم' };
    }

    const processedEvents = Array.isArray(data.processedEvents) ? data.processedEvents : [];

    if (eventId && processedEvents.includes(eventId)) {
      return { success: true, alreadyProcessed: true, order: { id: snap.id, ...data } };
    }

    const now = new Date().toISOString();
    const historyEntry = {
      orderStatus: data.orderStatus || 'confirmed',
      deliveryStatus: newDeliveryStatus,
      timestamp: now,
      provider: providerInfo.provider || data.deliveryProvider || 'manual',
      trackingNumber: providerInfo.trackingNumber || data.deliveryTrackingNumber || '',
      note: providerInfo.note || `تم تحديث حالة الشحن إلى: ${newDeliveryStatus}`,
    };

    const updatePayload = {
      deliveryStatus: newDeliveryStatus,
      statusHistory: FieldValue.arrayUnion(historyEntry),
      updatedAt: now,
    };

    if (providerInfo.provider) updatePayload.deliveryProvider = providerInfo.provider;
    if (providerInfo.trackingNumber) updatePayload.deliveryTrackingNumber = providerInfo.trackingNumber;
    if (eventId) updatePayload.processedEvents = FieldValue.arrayUnion(eventId);

    await orderRef.update(updatePayload);
    return { success: true, order: { id: snap.id, ...data, ...updatePayload } };
  } catch (e) {
    console.error(`[Firestore] Update delivery status error for order ${orderId}:`, e.message);
    return { success: false, reason: e.message };
  }
}

// ─── Notifications (in-app bell) ────────────────────────────────
// Engines write via Admin SDK (client create is denied by rules);
// the merchant's dashboard listens in realtime.
async function createNotification({ userId, botId, type = 'system', title, body = '', meta = {} }) {
  try {
    if (!userId) return null;
    const ref = await db.collection('notifications').add({
      userId,
      botId: botId || '',
      type,
      title: String(title).slice(0, 140),
      body: String(body).slice(0, 300),
      ...meta,
      read: false,
      createdIso: new Date().toISOString(),
      createdAt: FieldValue.serverTimestamp(),
    });
    return ref.id;
  } catch (e) {
    console.error('[Firestore] Create notification error:', e.message);
    return null;
  }
}

async function getConversationHistory(botId, customerId, limitCount = 10) {
  try {
    const snap = await db.collection('conversations')
      .where('botId', '==', botId)
      .where('telegramUserId', '==', String(customerId))
      .orderBy('createdAt', 'desc')
      .limit(limitCount)
      .get();
    
    return snap.docs.map(d => d.data()).reverse();
  } catch (e) {
    console.error('[Firestore] Get conversation history error:', e.message);
    return [];
  }
}

async function findAbandonedLeads(botId, delayHours = 2) {
  try {
    const cutoffDate = new Date(Date.now() - delayHours * 3600 * 1000).toISOString();
    const maxLookbackDate = new Date(Date.now() - 48 * 3600 * 1000).toISOString();

    // 1. Fetch recent conversations in the last 48h
    const convSnap = await db.collection('conversations')
      .where('botId', '==', botId)
      .where('createdAt', '>=', maxLookbackDate)
      .orderBy('createdAt', 'desc')
      .limit(150)
      .get();

    if (convSnap.empty) return [];

    // Group by customer
    const threads = {};
    convSnap.docs.forEach(d => {
      const data = d.data();
      const cid = data.telegramUserId || data.customerId;
      if (!cid) return;
      if (!threads[cid]) {
        threads[cid] = {
          customerId: cid,
          userName: data.userName || 'زبون',
          platform: data.platform || 'whatsapp',
          lastMessageAt: data.createdAt,
          messages: [],
        };
      }
      threads[cid].messages.push(data);
    });

    // 2. Fetch existing orders in the last 48h
    const orderSnap = await db.collection('orders')
      .where('botId', '==', botId)
      .where('createdAt', '>=', maxLookbackDate)
      .get();
    
    const customersWithOrders = new Set();
    orderSnap.docs.forEach(d => {
      const o = d.data();
      if (o.customerId) customersWithOrders.add(String(o.customerId));
      if (o.phone) customersWithOrders.add(String(o.phone));
    });

    // 3. Fetch past reminders in the last 48h
    const reminderSnap = await db.collection('abandoned_reminders')
      .where('botId', '==', botId)
      .where('remindedAt', '>=', maxLookbackDate)
      .get();
    
    const remindedCustomers = new Set();
    reminderSnap.docs.forEach(d => {
      const r = d.data();
      if (r.customerId) remindedCustomers.add(String(r.customerId));
    });

    const eligible = [];
    for (const cid of Object.keys(threads)) {
      const t = threads[cid];
      // Criteria:
      // - Customer sent at least 1 message
      // - Last message older than cutoffDate
      // - No order placed
      // - No reminder sent yet
      if (
        t.lastMessageAt <= cutoffDate &&
        !customersWithOrders.has(cid) &&
        !remindedCustomers.has(cid) &&
        t.messages.length >= 1
      ) {
        eligible.push(t);
      }
    }

    return eligible;
  } catch (e) {
    console.error('[Firestore] Find abandoned leads error:', e.message);
    return [];
  }
}

async function saveLead(leadData) {
  try {
    const userId = await resolveOwnerUserId(leadData.botId, leadData.ownerUserId);
    const now = new Date().toISOString();

    const docRef = await db.collection('leads').add({
      botId: leadData.botId,
      userId: userId || '',
      platform: leadData.platform || 'whatsapp',
      customerId: String(leadData.customerId || ''),
      customerName: leadData.customerName || leadData.name || 'عميل محتمل',
      phone: leadData.phone || '',
      company: leadData.company || '',
      service: leadData.service || '',
      budget: leadData.budget || '',
      leadStatus: leadData.leadStatus || 'warm', // hot, warm, cold
      status: leadData.status || 'new', // new, contacted, qualified, closed, lost
      notes: leadData.notes || '',
      createdAt: now,
      timestamp: FieldValue.serverTimestamp(),
    });

    console.log(`[Firestore] Lead saved: ${leadData.customerName || leadData.name} | Service: ${leadData.service} | Status: ${leadData.leadStatus}`);
    return { id: docRef.id, ...leadData };
  } catch (e) {
    console.error('[Firestore] Save lead error:', e.message);
    return null;
  }
}

async function findLeads(botId) {
  try {
    const snap = await db.collection('leads')
      .where('botId', '==', botId)
      .orderBy('createdAt', 'desc')
      .limit(100)
      .get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) {
    console.error('[Firestore] Find leads error:', e.message);
    return [];
  }
}

module.exports = {
  admin,
  db,
  getActiveBots,
  getBot,
  invalidateBotCache,
  getBotsByOwner,
  updateBotStatus,
  logMessage,
  logBotMessage,
  logOwnerMessage,
  incrementMessageCount,
  saveOrder,
  generateTrackingCode,
  findOrdersForTracking,
  updateOrderDeliveryStatus,
  createNotification,
  getConversationHistory,
  findAbandonedLeads,
  recordAbandonedReminder,
  saveLead,
  findLeads,
};
