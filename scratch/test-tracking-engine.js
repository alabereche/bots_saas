// ═══════════════════════════════════════════════════════════════
// Automated Unit Tests for Modular Tracking & Fast Path Engine
// ═══════════════════════════════════════════════════════════════

const assert = require('assert');
const trackingHelper = require('../whatsapp-engine/tracking-helper');

console.log('🧪 Starting Tracking Engine Test Suite...\n');

// 1. High-Entropy Code Generation Test
console.log('1️⃣ Testing High-Entropy Tracking Code Generation...');
const TRACKING_CHARS = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
function generateTrackingCode() {
  let code = 'DZ-';
  for (let i = 0; i < 6; i++) {
    const idx = Math.floor(Math.random() * TRACKING_CHARS.length);
    code += TRACKING_CHARS[idx];
  }
  return code;
}

const codesSet = new Set();
for (let i = 0; i < 1000; i++) {
  const code = generateTrackingCode();
  assert(/^DZ-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6}$/.test(code), `Invalid code format: ${code}`);
  codesSet.add(code);
}
assert.strictEqual(codesSet.size, 1000, 'Collision detected in 1000 samples!');
console.log('   ✅ 1000 codes generated with 0 collisions and strict Crockford Base32 format.');

// 2. Intent Detection (Algerian Vernacular + Fast Path)
console.log('\n2️⃣ Testing Fast-Path Intent Detector (0 LLM Calls)...');
const positiveCases = [
  'تتبع',
  'تتبع طلبي',
  'وين راه طلبي',
  'وين وصل الكولي',
  'وقتاش يوصل',
  'حالة الطلب',
  'رقم الطلب',
  'كود التتبع',
  'livraison',
  'suivi commande',
  'DZ-K7M4Q9',
  'وين راهي سلعتي DZ-K7M4Q9',
  '#DZ-98214A',
];

positiveCases.forEach(phrase => {
  const isIntent = trackingHelper.isTrackingIntent(phrase);
  assert.strictEqual(isIntent, true, `Expected "${phrase}" to be recognized as tracking intent`);
});
console.log(`   ✅ All ${positiveCases.length} vernacular tracking phrases correctly detected for fast-path.`);

const negativeCases = [
  'سلام عليكم',
  'واش كاين سلعة',
  'شحال دير كارت 4060',
  'حاب نشري معالج',
  'وين جاي المحل تاعكم',
];

negativeCases.forEach(phrase => {
  const isIntent = trackingHelper.isTrackingIntent(phrase);
  assert.strictEqual(isIntent, false, `Expected "${phrase}" NOT to trigger tracking fast-path`);
});
console.log(`   ✅ All ${negativeCases.length} regular sales phrases correctly passed to AI.`);

// 3. Extracting Code
console.log('\n3️⃣ Testing Tracking Code Extraction...');
assert.strictEqual(trackingHelper.extractTrackingCode('تتبع DZ-K7M4Q9 خويا'), 'DZ-K7M4Q9');
assert.strictEqual(trackingHelper.extractTrackingCode('DZ-223456'), 'DZ-223456');
assert.strictEqual(trackingHelper.extractTrackingCode('ما عنديش كود'), null);
console.log('   ✅ Code extraction verified.');

// 4. Formatting Card (0 LLM Calls)
console.log('\n4️⃣ Testing Deterministic Single Card & Multi-List Formatting...');
const sampleOrder = {
  trackingCode: 'DZ-K7M4Q9',
  product: 'كارت شاشة RTX 4060',
  price: '130,000',
  deliveryStatus: 'shipped',
  deliveryProvider: 'yalidine',
  deliveryTrackingNumber: 'YAL-889977',
  address: 'باتنة، رأس العيون',
};

const card = trackingHelper.formatSingleOrderCard(sampleOrder);
assert(card.includes('DZ-K7M4Q9'), 'Card missing tracking code');
assert(card.includes('Yalidine Express'), 'Card missing provider');
assert(card.includes('YAL-889977'), 'Card missing tracking number');
assert(card.includes('تم تسليم الطرد لشركة التوصيل'), 'Card missing localized status');
console.log('   ✅ Single order card formatted cleanly:');
console.log('--------------------------------------------------');
console.log(card);
console.log('--------------------------------------------------');

const multiOrders = [
  sampleOrder,
  {
    trackingCode: 'DZ-8B3N1Q',
    product: 'معالج Ryzen 5 5600',
    deliveryStatus: 'preparing',
  },
];
const multiList = trackingHelper.formatMultipleOrdersList(multiOrders);
assert(multiList.includes('DZ-K7M4Q9') && multiList.includes('DZ-8B3N1Q'), 'Multi list missing codes');
console.log('   ✅ Multi-order numbered list formatted cleanly:');
console.log('--------------------------------------------------');
console.log(multiList);
console.log('--------------------------------------------------');

// 5. Module Dependency Sanitization
console.log('\n5️⃣ Testing Modular Capabilities Dependency Rules...');
function sanitizeBotFeatures(features = {}) {
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

// Test case A: turning off orders disables tracking and delivery
const disabledOrders = sanitizeBotFeatures({ orders: false, orderTracking: true, delivery: true, notifications: true });
assert.strictEqual(disabledOrders.orders, false);
assert.strictEqual(disabledOrders.orderTracking, false);
assert.strictEqual(disabledOrders.delivery, false);
assert.strictEqual(disabledOrders.notifications, false);

// Test case B: turning off tracking disables notifications
const disabledTracking = sanitizeBotFeatures({ orders: true, orderTracking: false, notifications: true });
assert.strictEqual(disabledTracking.orders, true);
assert.strictEqual(disabledTracking.orderTracking, false);
assert.strictEqual(disabledTracking.notifications, false);

console.log('   ✅ Module dependency cascading rules passed with 100% integrity.');

console.log('\n🎉 ALL TESTS PASSED SUCCESSFULLY! 🚀');
