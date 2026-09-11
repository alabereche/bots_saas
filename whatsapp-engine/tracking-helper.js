// ═══════════════════════════════════════════════════════════════
// BotForge — Fast-Path Tracking Engine (Zero LLM Calls)
// 4-status lifecycle: accepted → shipped → delivered (+ cancelled).
// Legacy 7-stage keys normalize read-time; labels adapt to the
// bot's business nature (commerce / restaurant / service).
// ═══════════════════════════════════════════════════════════════

const STATUS_ORDER = ['accepted', 'shipped', 'delivered', 'cancelled'];

const LEGACY_MAP = {
  pending: 'accepted',
  preparing: 'accepted',
  out_for_delivery: 'shipped',
  returned: 'cancelled',
};

function normalizeDeliveryStatus(s) {
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
// everything else gets neutral service language.
const TYPE_TO_VOICE = { shop: 'commerce', realestate: 'commerce', restaurant: 'restaurant' };

function voiceFor(businessType) {
  return VOICES[TYPE_TO_VOICE[businessType] || 'service'];
}

function customerStatusLabel(status, businessType) {
  const voice = voiceFor(businessType);
  return voice[normalizeDeliveryStatus(status)].customer;
}

const PROVIDER_NAMES = {
  manual: 'التوصيل الخاص بالمتجر',
  yalidine: 'Yalidine Express',
  zr_express: 'ZR Express',
  maystro: 'Maystro Delivery',
  kazitour: 'Kazi Tour',
  ecotrack: 'EcoTrack Delivery',
};

// Vernacular Algerian & standard tracking intent regex
const TRACKING_INTENT_REGEX = /(تتبع|وين راه|وين وصل|وقتاش يوصل|حالة الطلب|رقم الطلب|كود التتبع|livraison|suivi)/i;
const TRACKING_CODE_REGEX = /#?DZ-[A-Za-z0-9]{4,10}/i;

function extractTrackingCode(text) {
  if (!text) return null;
  const match = text.toUpperCase().match(TRACKING_CODE_REGEX);
  return match ? match[0].replace('#', '') : null;
}

function isTrackingIntent(text) {
  if (!text) return false;
  const clean = text.trim();
  return TRACKING_INTENT_REGEX.test(clean) || TRACKING_CODE_REGEX.test(clean);
}

function formatSingleOrderCard(order, businessType) {
  const voice = voiceFor(businessType);
  const key = normalizeDeliveryStatus(order.deliveryStatus);
  const code = order.trackingCode || 'DZ-XXXXXX';
  const providerText = PROVIDER_NAMES[order.deliveryProvider] || order.deliveryProvider || 'شركة التوصيل';

  let card = `📦 حالة طلبيتك (كود التتبع: #${code})\n\n`;
  card += `• المنتج: ${order.product || 'منتج'}\n`;
  if (order.price) card += `• المبلغ الإجمالي: ${order.price} دج (الدفع عند الاستلام)\n`;
  card += `• الحالة: ${voice[key].customer}\n`;

  if (order.deliveryProvider && order.deliveryProvider !== 'manual') {
    card += `• شركة التوصيل: ${providerText}\n`;
  }
  if (order.deliveryTrackingNumber) {
    card += `• رقم بوليصة الشحن: ${order.deliveryTrackingNumber}\n`;
  }
  if (order.address) {
    card += `• عنوان الاستلام: ${order.address}\n`;
  }

  if (key === 'delivered') {
    card += `\nشكراً لتسوقك معنا!`;
  } else if (TYPE_TO_VOICE[businessType] === 'restaurant') {
    card += `\nسيصلك طلبك قريباً. بالصحة والهناء!`;
  } else if (TYPE_TO_VOICE[businessType] === 'commerce') {
    card += `\nسيتصل بك الموزع لتأكيد موعد التسليم. شكراً لتسوقك معنا!`;
  } else {
    card += `\nسيتم التواصل معك قريباً لمتابعة طلبك. شكراً لثقتك!`;
  }
  return card;
}

function formatMultipleOrdersList(orders, businessType) {
  const voice = voiceFor(businessType);
  let list = `📦 وجدنا ${orders.length} طلبات مسجلة لك:\n\n`;
  orders.forEach((o, idx) => {
    const code = o.trackingCode || 'DZ-XXXXXX';
    const statusText = voice[normalizeDeliveryStatus(o.deliveryStatus)].label;
    list += `${idx + 1}. #${code} — ${o.product || 'طلب'}\n   الحالة: ${statusText}\n\n`;
  });
  list += `💡 لمعرفة تفاصيل أي طلبية، أرسل كود التتبع الخاص بها (مثال: #${orders[0]?.trackingCode || 'DZ-...'}).`;
  return list;
}

function formatNoOrdersFound(searchedCode = null) {
  if (searchedCode) {
    return `🔍 لم نجد أي طلبية مسجلة برقم التتبع (#${searchedCode}).\nيرجى التأكد من كتابة الكود بشكل صحيح (مثل: #DZ-XXXXXX) أو التواصل مع المتجر مباشرة للمساعدة.`;
  }
  return `🔍 لم نجد أي طلبات مسجلة لرقمك حالياً.\nإذا كنت قد قمت بالطلب مؤخراً، أرسل لنا كود التتبع المذكور في رسالة تأكيد الطلب وسنساعدك فوراً!`;
}

module.exports = {
  STATUS_ORDER,
  isTrackingIntent,
  extractTrackingCode,
  normalizeDeliveryStatus,
  voiceFor,
  customerStatusLabel,
  formatSingleOrderCard,
  formatMultipleOrdersList,
  formatNoOrdersFound,
  PROVIDER_NAMES,
};
