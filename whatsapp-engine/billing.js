// ═══════════════════════════════════════════════════════════════
// BotForge WhatsApp Engine — Billing & Plan Enforcement
//
// Single source of truth for plan limits. Every limit is enforced
// SERVER-SIDE (the dashboard only mirrors them visually):
//   - WA bot count        → /api/whatsapp/create
//   - daily AI messages   → messageHandler before the Gemini call
//   - catalog size        → messageHandler before the prompt build
//   - reminder cap        → abandoned-recovery cron
//   - Google Sheets       → sync + test-sync call sites
//
// SECURITY MODEL:
//   - plan lives on users/{uid} and is written ONLY here through the
//     Admin SDK; Firestore rules deny clients touching it (verified)
//   - activation/deactivation endpoints are SUPER_ADMIN_UID-gated
//   - the daily counter survives engine restarts: seeded from the
//     persisted usage doc on first use of each day
// ═══════════════════════════════════════════════════════════════

const firestore = require('./firestore');
const { db, admin } = firestore;

const FieldValue = admin.firestore.FieldValue;

const PLAN_LIMITS = {
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

// ─── Plan resolution (5-min cache; expiry-aware & 7-day trial) ──────────────
const planCache = new Map(); // uid -> { plan, expiresAt, loadedAt }
const TRIAL_DAYS = 7;

function getSubscriptionDetails(doc) {
  if (!doc) {
    return {
      plan: 'free',
      isTrial: false,
      trialDaysLeft: 0,
      trialExpired: false,
      planExpiresAt: null,
    };
  }

  // 1. Explicit Paid Pro Plan
  if (doc.plan === 'pro') {
    if (doc.planExpiresAt) {
      const exp = new Date(doc.planExpiresAt).getTime();
      if (Number.isFinite(exp) && Date.now() > exp) {
        return {
          plan: 'free',
          isTrial: false,
          trialDaysLeft: 0,
          trialExpired: false,
          planExpiresAt: null,
          isExpired: true,
        };
      }
    }
    return {
      plan: 'pro',
      isTrial: false,
      trialDaysLeft: 0,
      trialExpired: false,
      planExpiresAt: doc.planExpiresAt || null,
      isExpired: false,
    };
  }

  // 2. Automatic 7-Day Pro Trial for all users
  let trialExp = null;
  const now = Date.now();
  const maxTrialWindow = (TRIAL_DAYS + 1) * 24 * 3600 * 1000;

  if (doc.trialExpiresAt) {
    const rawExp = new Date(doc.trialExpiresAt).getTime();
    // Safety check: trial expiration cannot exceed max allowed window from now
    if (Number.isFinite(rawExp) && rawExp <= now + maxTrialWindow) {
      trialExp = rawExp;
    }
  } else if (doc.createdAt) {
    const created = doc.createdAt?.toDate ? doc.createdAt.toDate().getTime() : new Date(doc.createdAt).getTime();
    // Safety check: createdAt cannot be in the future (allowing max 5 min clock drift)
    if (Number.isFinite(created) && created <= now + 5 * 60 * 1000) {
      trialExp = created + TRIAL_DAYS * 24 * 3600 * 1000;
    }
  }

  if (trialExp && Number.isFinite(trialExp)) {
    const diff = trialExp - Date.now();
    if (diff > 0) {
      const daysLeft = Math.max(1, Math.ceil(diff / (24 * 3600 * 1000)));
      return {
        plan: 'pro',
        isTrial: true,
        trialDaysLeft: daysLeft,
        trialExpired: false,
        planExpiresAt: new Date(trialExp).toISOString(),
        isExpired: false,
      };
    } else {
      return {
        plan: 'free',
        isTrial: false,
        trialDaysLeft: 0,
        trialExpired: true,
        planExpiresAt: null,
        isExpired: false,
      };
    }
  }

  return {
    plan: 'free',
    isTrial: false,
    trialDaysLeft: 0,
    trialExpired: false,
    planExpiresAt: null,
    isExpired: false,
  };
}

function effectivePlan(doc) {
  return getSubscriptionDetails(doc).plan;
}

async function resolvePlan(uid) {
  if (!uid) return 'free';
  const cached = planCache.get(uid);
  if (cached && Date.now() - cached.loadedAt < 5 * 60 * 1000) {
    return effectivePlan(cached);
  }
  let doc = null;
  try {
    const snap = await db.collection('users').doc(uid).get();
    doc = snap.exists ? snap.data() : null;
  } catch (e) {
    console.warn('[Billing] Plan read failed for', uid, e.message);
  }
  const entry = {
    plan: doc?.plan || 'free',
    planExpiresAt: doc?.planExpiresAt || null,
    trialExpiresAt: doc?.trialExpiresAt || null,
    createdAt: doc?.createdAt || null,
    loadedAt: Date.now(),
  };
  planCache.set(uid, entry);
  return effectivePlan(entry);
}

function invalidatePlanCache(uid) {
  if (uid) planCache.delete(uid);
  else planCache.clear();
}

async function getLimits(uid) {
  return PLAN_LIMITS[await resolvePlan(uid)] || PLAN_LIMITS.free;
}

// ─── Activation (Admin SDK — rules do not apply here) ─────────
async function setPlan(uid, plan, months = 0) {
  if (!uid || !PLAN_LIMITS[plan]) return false;
  const update = {
    plan,
    planActivatedAt: new Date().toISOString(),
  };
  if (plan === 'pro' && Number(months) > 0) {
    update.planExpiresAt = new Date(Date.now() + Number(months) * 30 * 24 * 3600 * 1000).toISOString();
  } else if (plan === 'free') {
    update.planExpiresAt = null;
  }
  await db.collection('users').doc(uid).set(update, { merge: true });
  invalidatePlanCache(uid);
  console.log(`[Billing] Plan for ${uid} set to ${plan}` +
    (update.planExpiresAt ? ` (until ${update.planExpiresAt})` : ''));
  return true;
}

// ─── Daily AI-message meter (restart-proof) ───────────────────
const memUsage = new Map(); // botId -> { date, count, limitNotified }

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

// Seeds the in-memory counter from the persisted doc on the first
// message of each day (per bot), then counts in memory and persists
// every increment. A restart can no longer hand out a fresh quota.
async function checkAndCountMessage(bot) {
  const limits = await getLimits(bot.userId);
  const key = todayKey();
  let u = memUsage.get(bot.id);
  if (!u || u.date !== key) {
    u = { date: key, count: 0, limitNotified: false };
    try {
      const snap = await db.collection('usage').doc(`${bot.id}_${key}`).get();
      if (snap.exists && snap.data().date === key) u.count = snap.data().count || 0;
    } catch { /* cold start with no doc — quota starts at 0 */ }
    memUsage.set(bot.id, u);
  }
  if (u.count >= limits.dailyMessages) {
    return { allowed: false, limits, usage: u.count };
  }
  u.count++;
  db.collection('usage').doc(`${bot.id}_${key}`)
    .set({
      botId: bot.id,
      userId: bot.userId,
      date: key,
      count: FieldValue.increment(1),
    }, { merge: true })
    .catch(() => {});
  return { allowed: true, limits, usage: u.count };
}

function markLimitNotified(botId) {
  const u = memUsage.get(botId);
  if (u) u.limitNotified = true;
}

function wasLimitNotified(botId) {
  const u = memUsage.get(botId);
  return !!(u && u.limitNotified);
}

async function getDailyUsageForUser(uid) {
  const key = todayKey();
  try {
    const botsSnap = await db.collection('bots').where('userId', '==', uid).limit(50).get();
    const out = [];
    for (const d of botsSnap.docs) {
      const u = memUsage.get(d.id);
      let count = u && u.date === key ? u.count : 0;
      if (count === 0) {
        try {
          const snap = await db.collection('usage').doc(`${d.id}_${key}`).get();
          if (snap.exists) count = snap.data().count || 0;
        } catch { /* ignore */ }
      }
      out.push({ botId: d.id, botName: d.data().botName || '', messagesToday: count });
    }
    return out;
  } catch {
    return [];
  }
}

module.exports = {
  PLAN_LIMITS,
  resolvePlan,
  getLimits,
  setPlan,
  invalidatePlanCache,
  checkAndCountMessage,
  markLimitNotified,
  wasLimitNotified,
  getDailyUsageForUser,
  getSubscriptionDetails,
};
