/**
 * Modular Feature Flags and Subscription Plan Readiness Helper
 * Pre-structured to easily bind features to subscription tiers (Basic, Pro, Enterprise) in the future.
 */

export const PLAN_TIERS = {
  FREE: 'free',
  STARTER: 'starter',
  PRO: 'pro',
  ENTERPRISE: 'enterprise',
};

// Feature definitions mapped to minimum required plan tier (ready for future gating)
export const FEATURES_CONFIG = {
  whatsapp: {
    id: 'whatsapp',
    nameAr: 'ربط واتساب',
    minTier: PLAN_TIERS.FREE,
  },
  telegram: {
    id: 'telegram',
    nameAr: 'ربط تيليغرام',
    minTier: PLAN_TIERS.FREE,
  },
  webWidget: {
    id: 'webWidget',
    nameAr: 'ودجت الشات للمواقع وتطبيقات فلاتر',
    minTier: PLAN_TIERS.FREE, // Configured for instant access now, ready to gate to PRO later
  },
  abandonedRecovery: {
    id: 'abandonedRecovery',
    nameAr: 'استرجاع المحادثات والطلبات المتروكة',
    minTier: PLAN_TIERS.FREE, // Ready to gate to PRO/ENTERPRISE later
  },
  autoOrders: {
    id: 'autoOrders',
    nameAr: 'تأكيد الطلبات التلقائي',
    minTier: PLAN_TIERS.FREE,
  },
  orderTracking: {
    id: 'orderTracking',
    nameAr: 'نظام تتبع الشحنات الذكي',
    minTier: PLAN_TIERS.FREE,
  },
};

/**
 * Checks if a specific feature is enabled on a bot and accessible under current plan.
 * Currently permits all configured features, prepared for instant subscription gating.
 */
export function isFeatureAccessible(bot, featureKey, userPlan = PLAN_TIERS.FREE) {
  if (!bot) return false;
  
  // Future Subscription Tier Gating Hook
  // const featureDef = FEATURES_CONFIG[featureKey];
  // if (featureDef && !isPlanEligible(userPlan, featureDef.minTier)) return false;

  // Bot-level toggle check
  if (bot.features && typeof bot.features[featureKey] !== 'undefined') {
    return bot.features[featureKey] === true;
  }

  // Feature-specific root fallback properties
  if (featureKey === 'webWidget') return bot.webWidgetEnabled !== false;
  if (featureKey === 'abandonedRecovery') return bot.abandonedRecoveryEnabled === true;
  if (featureKey === 'autoOrders') return bot.autoOrdersEnabled !== false;
  if (featureKey === 'orderTracking') return bot.orderTrackingEnabled !== false;

  return true;
}
