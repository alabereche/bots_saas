// ═══════════════════════════════════════════════════════════════
// BotForge WhatsApp Engine — Firestore Service Layer
// Cloud Firestore integration for bot configs, logs & orders
// ═══════════════════════════════════════════════════════════════

const { initializeApp, getApps, getApp } = require('firebase/app');
const {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  where,
  serverTimestamp,
} = require('firebase/firestore');

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY || "AIzaSyAB6AS2qy2e9iAgG4RMIERDmLXCvs2WQEU",
  authDomain: process.env.FIREBASE_AUTH_DOMAIN || "bots-saas-c7190.firebaseapp.com",
  projectId: process.env.FIREBASE_PROJECT_ID || "bots-saas-c7190",
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "bots-saas-c7190.firebasestorage.app",
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || "99967470267",
  appId: process.env.FIREBASE_APP_ID || "1:99967470267:web:8e75a4c7f90d460407f79e",
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);

// ─── Bots ─────────────────────────────────────────────────────

async function getActiveBots() {
  try {
    const q = query(
      collection(db, 'bots'),
      where('platform', '==', 'whatsapp'),
      where('isActive', '==', true)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) {
    console.error('[Firestore] Get active bots error:', e.message);
    return [];
  }
}

async function getBot(botId) {
  try {
    const botRef = doc(db, 'bots', botId);
    const snap = await getDoc(botRef);
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
  } catch (e) {
    console.error(`[Firestore] Get bot ${botId} error:`, e.message);
    return null;
  }
}

async function updateBotStatus(botId, status, extra = {}) {
  try {
    const botRef = doc(db, 'bots', botId);
    await updateDoc(botRef, {
      whatsappStatus: status,
      isActive: status === 'connected',
      ...extra,
      updatedAt: serverTimestamp(),
    });
  } catch (e) {
    console.error(`[Firestore] Update bot status ${botId} error:`, e.message);
  }
}

// ─── Conversations (Messages) ─────────────────────────────────

async function logMessage({ botId, from, userName, message, response }) {
  const ts = new Date().toISOString();
  try {
    // Save customer message
    await addDoc(collection(db, 'conversations'), {
      botId,
      platform: 'whatsapp',
      telegramUserId: String(from),
      userName: userName || 'زبون واتساب',
      content: message.slice(0, 1000),
      role: 'user',
      createdAt: ts,
      timestamp: serverTimestamp(),
    });

    // Save bot response
    await addDoc(collection(db, 'conversations'), {
      botId,
      platform: 'whatsapp',
      telegramUserId: String(from),
      userName: userName || 'زبون واتساب',
      content: response.slice(0, 1000),
      role: 'bot',
      createdAt: new Date(Date.now() + 10).toISOString(),
      timestamp: serverTimestamp(),
    });
  } catch (e) {
    console.error('[Firestore] Log message error:', e.message);
  }
}

async function incrementMessageCount(botId) {
  try {
    const bot = await getBot(botId);
    if (bot) {
      const botRef = doc(db, 'bots', botId);
      await updateDoc(botRef, {
        messagesCount: (bot.messagesCount || 0) + 1,
        lastActiveAt: new Date().toISOString(),
      });
    }
  } catch (e) {
    console.error('[Firestore] Increment message count error:', e.message);
  }
}

// ─── Orders ────────────────────────────────────────────────────

async function saveOrder(orderData) {
  try {
    await addDoc(collection(db, 'orders'), {
      ...orderData,
      status: 'new',
      createdAt: new Date().toISOString(),
      timestamp: serverTimestamp(),
    });
    console.log(`[Firestore] 📦 WhatsApp Order saved: ${orderData.customerName} - ${orderData.product}`);
  } catch (e) {
    console.error('[Firestore] Save order error:', e.message);
  }
}

module.exports = {
  db,
  getActiveBots,
  getBot,
  updateBotStatus,
  logMessage,
  incrementMessageCount,
  saveOrder,
};
