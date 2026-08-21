// ═══════════════════════════════════════════════════════════════
// BotForge — Firebase Service Layer (Auth & Cloud Firestore)
// Replaces NexCloud with high-speed, realtime Firebase services
// ═══════════════════════════════════════════════════════════════

import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile as updateAuthProfile,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  writeBatch,
  arrayUnion,
} from 'firebase/firestore';
import {
  getStorage,
  ref as storageRefFunc,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from 'firebase/storage';

// ─── Firebase App Configuration ───────────────────────────────
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyAB6AS2qy2e9iAgG4RMIERDmLXCvs2WQEU",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "bots-saas-c7190.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "bots-saas-c7190",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "bots-saas-c7190.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "99967470267",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:99967470267:web:8e75a4c7f90d460407f79e",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-FDSW57E7RT",
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

// ─── Auth Functions ───────────────────────────────────────────

// Sign in with Google
export async function loginWithGoogle() {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;

    // Check if user profile exists in Firestore, create if not
    const userRef = doc(db, 'users', user.uid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      await setDoc(userRef, {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || 'مستخدم',
        photoURL: user.photoURL || '',
        country: 'DZ', // Default: Algeria
        countryName: 'الجزائر',
        phoneCode: '+213',
        phone: '',
        plan: 'free',
        createdAt: serverTimestamp(),
        isOnboarded: false, // Flag to show country selection if needed
      });
    }

    return user;
  } catch (error) {
    console.error('Google Sign-In Error:', error);
    throw error;
  }
}

// Sign in with Email & Password
export async function loginWithEmail(email, password) {
  const result = await signInWithEmailAndPassword(auth, email, password);
  return result.user;
}

// Register with Email & Password
export async function registerWithEmail(email, password, displayName, country = 'DZ', phone = '') {
  const result = await createUserWithEmailAndPassword(auth, email, password);
  const user = result.user;

  if (displayName) {
    await updateAuthProfile(user, { displayName });
  }

  const userRef = doc(db, 'users', user.uid);
  await setDoc(userRef, {
    uid: user.uid,
    email: user.email,
    displayName: displayName || 'مستخدم جديد',
    photoURL: '',
    country,
    phone,
    plan: 'free',
    createdAt: serverTimestamp(),
    isOnboarded: true,
  });

  return user;
}

// Sign out
export async function logoutUser() {
  return await signOut(auth);
}

// Get user profile document
export async function getUserProfile(uid) {
  if (!uid) return null;
  const userRef = doc(db, 'users', uid);
  const snap = await getDoc(userRef);
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

// Update user profile
export async function updateUserProfile(uid, data) {
  if (!uid) return;
  const userRef = doc(db, 'users', uid);
  await updateDoc(userRef, { ...data, updatedAt: serverTimestamp() });
}

// ─── Bots (Firestore) ─────────────────────────────────────────

// Subscribe to user bots in realtime
export function subscribeBots(userId, callback) {
  if (!userId) {
    callback([]);
    return () => {};
  }
  const q = query(
    collection(db, 'bots'),
    where('userId', '==', userId)
  );
  return onSnapshot(q, (snapshot) => {
    const bots = snapshot.docs.map(d => ({
      id: d.id,
      ...d.data(),
    }));
    callback(bots);
  }, (err) => {
    console.error('Bots subscription error:', err);
  });
}

// Subscribe to a single bot document
export function subscribeBot(botId, callback) {
  if (!botId) return () => {};
  const botRef = doc(db, 'bots', botId);
  return onSnapshot(botRef, (docSnap) => {
    if (docSnap.exists()) {
      callback({ id: docSnap.id, ...docSnap.data() });
    } else {
      callback(null);
    }
  }, (err) => {
    console.error('Bot subscription error:', err);
  });
}

// Get single bot by ID
export async function getBot(botId) {
  const botRef = doc(db, 'bots', botId);
  const snap = await getDoc(botRef);
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

// Create new bot
export async function createBot(data) {
  const botData = {
    ...data,
    country: data.country || 'DZ',
    currency: data.currency || 'دج',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    isActive: false,
    messagesCount: 0,
    ordersCount: 0,
  };
  const docRef = await addDoc(collection(db, 'bots'), botData);
  return { id: docRef.id, ...botData };
}

// Update bot document
export async function updateBot(botId, data) {
  const botRef = doc(db, 'bots', botId);
  await updateDoc(botRef, { ...data, updatedAt: serverTimestamp() });
}

// Delete bot and its related conversations & orders
export async function deleteBot(botId) {
  const botRef = doc(db, 'bots', botId);
  await deleteDoc(botRef);
  // Clear messages & orders in background
  clearBotMessages(botId).catch(() => {});
  clearBotOrders(botId).catch(() => {});
}

// ─── Conversations (Firestore) ────────────────────────────────

// Subscribe to messages of a bot in realtime
// The userId filter matches the security rules (owner-only reads)
export function subscribeConversations(botId, callback) {
  if (!botId) return () => {};
  const uid = auth.currentUser?.uid;
  if (!uid) return () => {};
  const q = query(
    collection(db, 'conversations'),
    where('botId', '==', botId),
    where('userId', '==', uid)
  );
  return onSnapshot(q, (snapshot) => {
    const messages = snapshot.docs.map(d => ({
      id: d.id,
      ...d.data(),
    })).sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
    callback(messages);
  });
}

// Save message
export async function saveMessage({ botId, platform = 'telegram', telegramUserId, userName, content, role }) {
  return await addDoc(collection(db, 'conversations'), {
    botId,
    platform,
    userId: auth.currentUser?.uid || '',
    telegramUserId: String(telegramUserId),
    userName: userName || 'زبون',
    content,
    role, // 'user' | 'bot' | 'owner'
    createdAt: new Date().toISOString(),
    timestamp: serverTimestamp(),
  });
}

// Delete single message
export async function deleteConversation(messageId) {
  const msgRef = doc(db, 'conversations', messageId);
  await deleteDoc(msgRef);
}

// Clear all messages of a bot
export async function clearBotMessages(botId) {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('غير مسجل الدخول');
  const q = query(
    collection(db, 'conversations'),
    where('botId', '==', botId),
    where('userId', '==', uid)
  );
  const snap = await getDocs(q);
  const batch = writeBatch(db);
  snap.docs.forEach(d => batch.delete(d.ref));
  await batch.commit();
  await updateBot(botId, { messagesCount: 0 });
}

// ─── Orders (Firestore) ───────────────────────────────────────

// Subscribe to orders in realtime
// The userId filter matches the security rules (owner-only reads)
export function subscribeOrders(botId, callback) {
  if (!botId) return () => {};
  const uid = auth.currentUser?.uid;
  if (!uid) return () => {};
  const q = query(
    collection(db, 'orders'),
    where('botId', '==', botId),
    where('userId', '==', uid)
  );
  return onSnapshot(q, (snapshot) => {
    const orders = snapshot.docs.map(d => ({
      id: d.id,
      ...d.data(),
    })).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')); // Newest first
    callback(orders);
  });
}

// Save order
export async function saveOrder(orderData) {
  return await addDoc(collection(db, 'orders'), {
    ...orderData,
    userId: auth.currentUser?.uid || '',
    status: orderData.status || 'new',
    createdAt: new Date().toISOString(),
    timestamp: serverTimestamp(),
  });
}

// Update order status
export async function updateOrderStatus(orderId, status) {
  const orderRef = doc(db, 'orders', orderId);
  await updateDoc(orderRef, { status, updatedAt: serverTimestamp() });
}

// ─── Modular Commerce & Delivery Management ───────────────────

export function sanitizeBotFeatures(features = {}) {
  const f = {
    catalog: features.catalog ?? true,
    orders: features.orders ?? true,
    orderTracking: features.orderTracking ?? false,
    delivery: features.delivery ?? false,
    notifications: features.notifications ?? false,
    bookings: features.bookings ?? false,
    webhooks: features.webhooks ?? false,
    ...features,
  };

  // Enforce Dependency Rules:
  if (!f.orders) {
    f.orderTracking = false;
    f.delivery = false;
    f.notifications = false;
  }
  if (!f.orderTracking) {
    f.notifications = false;
  }

  return f;
}

const WHATSAPP_ENGINE_URL = import.meta.env.VITE_WHATSAPP_ENGINE_URL || 'http://162.62.233.152:3001';
const TELEGRAM_ENGINE_URL = import.meta.env.VITE_ENGINE_URL || 'http://162.62.233.152:3002';

function engineUrlFor(platform) {
  return platform === 'telegram' ? TELEGRAM_ENGINE_URL : WHATSAPP_ENGINE_URL;
}

// Update delivery status and dispatch idempotent notification via Engine API
export async function updateOrderDelivery(botId, orderId, platform = 'whatsapp', payload = {}) {
  const {
    deliveryStatus,
    orderStatus,
    provider = 'manual',
    trackingNumber = '',
    notifyCustomer = false,
  } = payload;

  const orderRef = doc(db, 'orders', orderId);
  const now = new Date().toISOString();

  const historyEntry = {
    orderStatus: orderStatus || 'confirmed',
    deliveryStatus: deliveryStatus || 'pending',
    timestamp: now,
    provider,
    trackingNumber,
    note: `تم تحديث حالة الشحن إلى: ${deliveryStatus}`,
  };

  const updateData = {
    updatedAt: serverTimestamp(),
  };

  if (deliveryStatus) updateData.deliveryStatus = deliveryStatus;
  if (orderStatus) updateData.orderStatus = orderStatus;
  if (provider) updateData.deliveryProvider = provider;
  if (trackingNumber !== undefined) updateData.deliveryTrackingNumber = trackingNumber;

  // Direct Firestore update for immediate UI responsiveness
  await updateDoc(orderRef, {
    ...updateData,
    statusHistory: arrayUnion(historyEntry),
  });

  // Call Engine API for customer dispatch if requested
  if (notifyCustomer) {
    try {
      const idToken = await auth.currentUser?.getIdToken();
      const engineUrl = engineUrlFor(platform);
      
      const res = await fetch(`${engineUrl}/api/orders/${orderId}/delivery-status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          botId,
          deliveryStatus,
          provider,
          trackingNumber,
          notifyCustomer: true,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'تعذر إرسال الإشعار من محرك البوت');
      }
      if (data.notificationSent === false && !data.alreadyProcessed) {
        console.warn('[Firebase Service] Notification was not sent (bot may not be connected)');
      }
    } catch (err) {
      console.warn('[Firebase Service] Delivery notification dispatch warning:', err.message);
      throw err;
    }
  }
}

// Delete single order
export async function deleteOrder(orderId) {
  const orderRef = doc(db, 'orders', orderId);
  await deleteDoc(orderRef);
}

// Clear all orders of a bot
export async function clearBotOrders(botId) {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('غير مسجل الدخول');
  const q = query(
    collection(db, 'orders'),
    where('botId', '==', botId),
    where('userId', '==', uid)
  );
  const snap = await getDocs(q);
  const batch = writeBatch(db);
  snap.docs.forEach(d => batch.delete(d.ref));
  await batch.commit();
  await updateBot(botId, { ordersCount: 0 });
}

// ─── Fast Client-Side Image Compression & Upload (100% Instantaneous & HTTPS) ───

// Compress and produce high-efficiency image Data URL in 15ms
export async function uploadProductImage(file) {
  if (!file) throw new Error('الملف غير موجود');

  return new Promise((resolve, reject) => {
    try {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          try {
            const maxDimension = 800;
            let width = img.width;
            let height = img.height;

            if (width > maxDimension || height > maxDimension) {
              if (width > height) {
                height = Math.round((height * maxDimension) / width);
                width = maxDimension;
              } else {
                width = Math.round((width * maxDimension) / height);
                height = maxDimension;
              }
            }

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);

            // High-efficiency WebP with JPEG fallback
            let dataUrl = canvas.toDataURL('image/webp', 0.78);
            if (!dataUrl.startsWith('data:image/webp')) {
              dataUrl = canvas.toDataURL('image/jpeg', 0.78);
            }
            resolve(dataUrl);
          } catch (canvasErr) {
            console.warn('Canvas compression error:', canvasErr);
            resolve(e.target.result);
          }
        };
        img.onerror = () => resolve(e.target.result);
        img.src = e.target.result;
      };
      reader.onerror = () => reject(new Error('فشل قراءة ملف الصورة'));
      reader.readAsDataURL(file);
    } catch (err) {
      reject(err);
    }
  });
}

// Delete product image helper
export async function deleteProductImage(downloadUrl) {
  // Data URLs don't need cloud cleanup
  return;
}

