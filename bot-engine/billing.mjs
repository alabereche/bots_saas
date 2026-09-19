// ═══════════════════════════════════════════════════════════════
// BotForge Telegram Engine — Billing & Plan Limits (ESM twin)
// Mirrors whatsapp-engine/billing.js. Plans are enforced SERVER-SIDE:
// TG bot slots, the one-channel lock, and the daily AI-message meter.
// The plan field itself is writable ONLY via the Admin SDK.
// ═══════════════════════════════════════════════════════════════

let dbRef = null;
let FieldValueRef = null;

export function initBilling(db, FieldValue) {
  dbRef = db;
  FieldValueRef = FieldValue || null;
}

export const PLAN_LIMITS = {
  free: {
    maxWABots: 1,
    maxTGBots: 1,
    channelsPerBot: 1,
    dailyMessages: 50,
    maxProducts: 10,
    maxReminders: 1,
    sheets: false,
    analytics: false,
    delivery: false,
    badge: true,
  },
  pro: {
    maxWABots: 5,
    maxTGBots: 8,
    channelsPerBot: 2,
    dailyMessages: 500,
    maxProducts: 500,
    maxReminders: 3,
    sheets: true,
    analytics: true,
    delivery: true,
    badge: false,
  },
};

const planCache = new Map(); // uid -> { plan, expiresAt, loadedAt }

function effectivePlan(doc) {
  const plan = doc?.plan === 'pro' ? 'pro' : 'free';
  if (plan === 'pro' && doc?.planExpiresAt) {
    const exp = new Date(doc.planExpiresAt).getTime();
    if (Number.isFinite(exp) && Date.now() > exp) return 'free';
  }
  return plan;
}

export async function resolvePlan(uid) {
  if (!uid || !dbRef) return 'free';
  const cached = planCache.get(uid);
  if (cached && Date.now() - cached.loadedAt < 5 * 60 * 1000) {
    return effectivePlan(cached);
  }
  let doc = null;
  try {
    const snap = await dbRef.collection('users').doc(uid).get();
    doc = snap.exists ? snap.data() : null;
  } catch (e) {
    console.warn('[Billing] Plan read failed for', uid, e.message);
  }
  const entry = {
    plan: doc?.plan === 'pro' ? 'pro' : 'free',
    planExpiresAt: doc?.planExpiresAt || null,
    loadedAt: Date.now(),
  };
  planCache.set(uid, entry);
  return effectivePlan(entry);
}

export async function getLimits(uid) {
  return PLAN_LIMITS[await resolvePlan(uid)] || PLAN_LIMITS.free;
}

export function invalidatePlanCache(uid) {
  if (uid) planCache.delete(uid);
  else planCache.clear();
}

// ─── Daily AI-message meter (restart-proof, mirrors the WA engine) ──
const memUsage = new Map(); // botId -> { date, count, limitNotified }

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

export async function checkAndCountMessage(bot) {
  const limits = await getLimits(bot.userId);
  const key = todayKey();
  let u = memUsage.get(bot.id);
  if (!u || u.date !== key) {
    u = { date: key, count: 0, limitNotified: false };
    try {
      const snap = await dbRef.collection('usage').doc(`${bot.id}_${key}`).get();
      if (snap.exists && snap.data().date === key) u.count = snap.data().count || 0;
    } catch { /* cold start with no doc */ }
    memUsage.set(bot.id, u);
  }
  if (u.count >= limits.dailyMessages) {
    return { allowed: false, limits, usage: u.count };
  }
  u.count++;
  if (FieldValueRef) {
    dbRef.collection('usage').doc(`${bot.id}_${key}`)
      .set({ botId: bot.id, userId: bot.userId, date: key, count: FieldValueRef.increment(1) }, { merge: true })
      .catch(() => {});
  }
  return { allowed: true, limits, usage: u.count };
}

export function markLimitNotified(botId) {
  const u = memUsage.get(botId);
  if (u) u.limitNotified = true;
}

export function wasLimitNotified(botId) {
  const u = memUsage.get(botId);
  return !!(u && u.limitNotified);
}

// ─── Stock ledger (bound to the catalog products on the bot doc) ────
// Reservation model mirroring whatsapp-engine/billing.js: confirmed order
// RESERVES, «تم التوصيل» decrements permanently, «ملغي/مرتجع» releases.
// Availability = stock - reserved. Smart name matching (bidirectional
// containment, longest name wins) because the AI paraphrases names.
const LOW_STOCK_THRESHOLD = 3;

function findProductIdx(products, productName) {
  const nameKey = String(productName || '').trim().toLowerCase();
  if (!nameKey) return -1;
  let idx = products.findIndex((p) => p && String(p.name || '').trim().toLowerCase() === nameKey);
  if (idx !== -1) return idx;
  let best = -1, bestLen = 0;
  products.forEach((p, i) => {
    const n = String(p?.name || '').trim().toLowerCase();
    if (!n) return;
    if ((n.includes(nameKey) || nameKey.includes(n)) && n.length > bestLen) {
      best = i; bestLen = n.length;
    }
  });
  return best;
}

export async function adjustProductStock(botId, productName, action, ownerUserId) {
  if (!dbRef || !botId || !productName || !['reserve', 'deliver', 'release'].includes(action)) {
    return { ok: false };
  }
  try {
    const result = await dbRef.runTransaction(async (tx) => {
      const botRef = dbRef.collection('bots').doc(botId);
      const botSnap = await tx.get(botRef);
      if (!botSnap.exists) return { skipped: true };
      const products = Array.isArray(botSnap.data().products) ? botSnap.data().products : [];
      const idx = findProductIdx(products, productName);
      if (idx === -1) return { skipped: true, reason: 'product not found' };
      const p = products[idx];
      if (p.stock === null || p.stock === undefined) return { skipped: true, reason: 'unmanaged' };
      const reserved = p.reserved || 0;
      const avail = p.stock - reserved;
      let newStock = p.stock, newReserved = reserved;

      if (action === 'reserve') {
        if (avail <= 0) return { ok: false, reason: 'out of stock', productName: p.name };
        newReserved = reserved + 1;
      } else if (action === 'deliver') {
        newStock = Math.max(0, p.stock - 1);
        newReserved = Math.max(0, reserved - 1);
      } else {
        newReserved = Math.max(0, reserved - 1);
      }

      if (newStock === p.stock && newReserved === reserved) return { skipped: true, reason: 'no change' };
      products[idx] = { ...p, stock: newStock, reserved: newReserved };
      tx.update(botRef, { products });
      return {
        ok: true, action, productName: p.name,
        stock: newStock, reserved: newReserved,
        oldAvail: p.stock - reserved, avail: newStock - newReserved,
      };
    });
    if (!result.ok || result.skipped) return result;

    if (ownerUserId && result.action === 'reserve') {
      let title = null, body = null;
      if (result.avail === 0) {
        title = 'كل كمية منتج محجوزة';
        body = 'كل وحدات «' + result.productName + '» أصبحت محجوزة لطلبيات قائمة — أعد التزويد أو أخفِه حتى التسليم.';
      } else if (result.oldAvail > LOW_STOCK_THRESHOLD && result.avail <= LOW_STOCK_THRESHOLD) {
        title = 'منتج على وشك النفاذ';
        body = 'بقيت ' + result.avail + ' قطع متاحة فقط من «' + result.productName + '» (الباقي محجوز لطلبيات).';
      }
      if (title) {
        dbRef.collection('notifications').add({
          userId: ownerUserId, botId, type: 'stock', title, body,
          createdAt: new Date(),
        }).catch(() => {});
      }
    }
    return result;
  } catch (e) {
    console.warn('[Billing] Stock adjust error:', e.message);
    return { ok: false, error: e.message };
  }
}
