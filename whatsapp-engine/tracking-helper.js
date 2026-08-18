// ═══════════════════════════════════════════════════════════════
// BotForge — Fast-Path Tracking Engine (Zero LLM Calls)
// ═══════════════════════════════════════════════════════════════

const DELIVERY_STATUS_LABELS = {
  pending: '⏳ قيد التأكيد والمراجعة من المتجر',
  preparing: '📦 قيد التجهيز والتغليف في المستودع',
  shipped: '🚚 تم تسليم الطرد لشركة التوصيل (في الطريق إليك)',
  out_for_delivery: '🛵 في الطريق للتوصيل إلى عنوانك اليوم',
  delivered: '✅ تم تسليم الطلبية بنجاح',
  returned: '↩️ تم إرجاع الطلبية',
  cancelled: '❌ ملغى',
};

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

function formatSingleOrderCard(order) {
  const code = order.trackingCode || 'DZ-XXXXXX';
  const statusText = DELIVERY_STATUS_LABELS[order.deliveryStatus] || DELIVERY_STATUS_LABELS.pending;
  const providerText = PROVIDER_NAMES[order.deliveryProvider] || order.deliveryProvider || 'شركة التوصيل';
  
  let card = `📦 حالة طلبيتك (كود التتبع: #${code})\n\n`;
  card += `• المنتج: ${order.product || 'منتج'}\n`;
  if (order.price) card += `• المبلغ الإجمالي: ${order.price} دج (الدفع عند الاستلام)\n`;
  card += `• حالة الشحن: ${statusText}\n`;

  if (order.deliveryProvider && order.deliveryProvider !== 'manual') {
    card += `• شركة الشحن: ${providerText}\n`;
  }
  if (order.deliveryTrackingNumber) {
    card += `• رقم بوليصة الشحن: ${order.deliveryTrackingNumber}\n`;
  }
  if (order.address) {
    card += `• عنوان الاستلام: ${order.address}\n`;
  }

  card += `\nسيتصل بك الموزع لتأكيد موعد التسليم. شكراً لتسوقك معنا!`;
  return card;
}

function formatMultipleOrdersList(orders) {
  let list = `📦 وجدنا ${orders.length} طلبات مسجلة لك:\n\n`;
  orders.forEach((o, idx) => {
    const code = o.trackingCode || 'DZ-XXXXXX';
    const statusText = DELIVERY_STATUS_LABELS[o.deliveryStatus] || DELIVERY_STATUS_LABELS.pending;
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
  isTrackingIntent,
  extractTrackingCode,
  formatSingleOrderCard,
  formatMultipleOrdersList,
  formatNoOrdersFound,
  DELIVERY_STATUS_LABELS,
  PROVIDER_NAMES,
};
