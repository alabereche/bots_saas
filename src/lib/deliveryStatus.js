// ═══════════════════════════════════════════════════════════════
// BotForge — Unified delivery lifecycle (4 statuses)
// accepted → shipped → delivered, + cancelled (terminal).
// Legacy 7-stage keys are normalized read-time so old Firestore
// rows keep rendering without any data migration.
// Each business nature gets its own voice: a perfume shop
// "ships parcels", a clinic "completes bookings" — same machine,
// different words. Engines carry a twin of this map.
// ═══════════════════════════════════════════════════════════════

export const STATUS_ORDER = ['accepted', 'shipped', 'delivered', 'cancelled'];

const LEGACY_MAP = {
  pending: 'accepted',
  preparing: 'accepted',
  out_for_delivery: 'shipped',
  returned: 'cancelled',
};

export function normalizeDeliveryStatus(s) {
  if (!s) return 'accepted';
  if (LEGACY_MAP[s]) return LEGACY_MAP[s];
  return STATUS_ORDER.includes(s) ? s : 'accepted';
}

const VOICES = {
  commerce: {
    accepted: { label: 'تم القبول', customer: '⏳ طلبيتك مقبولة ومؤكدة، وهي قيد التحضير للشحن' },
    shipped: { label: 'تم الشحن', customer: '🚚 تم شحن طلبيتك وتسليمها لشركة التوصيل — في الطريق إليك' },
    delivered: { label: 'تم التوصيل', customer: '✅ تم تسليم طلبيتك بنجاح. شكراً لثقتك بنا!' },
    cancelled: { label: 'ملغي/مرتجع', customer: '❌ تم إلغاء هذه الطلبية' },
  },
  restaurant: {
    accepted: { label: 'تم التأكيد', customer: '⏳ تم تأكيد طلبك وهو قيد التحضير الآن' },
    shipped: { label: 'في الطريق', customer: '🛵 طلبك في الطريق إليك الآن' },
    delivered: { label: 'تم التسليم', customer: '✅ تم تسليم طلبك. بالصحة والهناء!' },
    cancelled: { label: 'ملغي', customer: '❌ تم إلغاء هذا الطلب' },
  },
  service: {
    accepted: { label: 'تم التأكيد', customer: '⏳ تم تسجيل طلبك وتأكيده بنجاح' },
    shipped: { label: 'قيد التنفيذ', customer: '🔧 طلبك قيد التنفيذ الآن' },
    delivered: { label: 'مكتمل', customer: '✅ تم إنجاز طلبك بنجاح. سعدنا بخدمتك!' },
    cancelled: { label: 'ملغي', customer: '❌ تم إلغاء هذا الطلب' },
  },
};

// shop/realestate talk commerce; restaurant gets delivery language;
// everything else (booking, clinic, education, agency, services,
// support, assistant, custom) gets neutral service language.
const TYPE_TO_VOICE = { shop: 'commerce', realestate: 'commerce', restaurant: 'restaurant' };

export function voiceFor(businessType) {
  return VOICES[TYPE_TO_VOICE[businessType] || 'service'];
}
