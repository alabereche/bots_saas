#!/usr/bin/env node
'use strict';
// ═══════════════════════════════════════════════════════════════
// Test Suite: WhatsApp Adaptive Outbox Queue & Anti-Ban Protection
//
// Verifies:
// 1. Adaptive delay calculations (new inquiries, ongoing dialogue, queue pressure)
// 2. Typing presence calculation and duration bounds
// 3. Serial execution order & typing lifecycle (startTyping -> wait -> stopTyping -> send)
// 4. Merchant takeover cancellation (dropped safely when owner takes over)
// 5. 7 concurrent inbound simulated bursts handled gracefully
// ═══════════════════════════════════════════════════════════════

const assert = require('assert');
const path = require('path');

// Configure fast timing for integration test
process.env.OUTBOX_INITIAL_MIN_MS = '20';
process.env.OUTBOX_INITIAL_MAX_MS = '40';
process.env.OUTBOX_ONGOING_MIN_MS = '10';
process.env.OUTBOX_ONGOING_MAX_MS = '20';
process.env.OUTBOX_PRESSURE_MIN_MS = '5';
process.env.OUTBOX_PRESSURE_MAX_MS = '15';
process.env.OUTBOX_PRESSURE_THRESHOLD = '4';
process.env.OUTBOX_TYPING_MIN_MS = '10';
process.env.OUTBOX_TYPING_MAX_MS = '30';
process.env.OUTBOX_INTER_GAP_MIN_MS = '10';
process.env.OUTBOX_INTER_GAP_MAX_MS = '20';

const outboxQueuePath = path.resolve(__dirname, '../whatsapp-engine/outboxQueue.js');
const takeoverPath = path.resolve(__dirname, '../whatsapp-engine/takeover.js');

const {
  calculateDelay,
  calculateTypingDuration,
  enqueueOutgoingReply,
  getPendingCount,
  clearBotQueue,
} = require(outboxQueuePath);
const { setTakeover } = require(takeoverPath);

let failures = 0;
const pass = (msg) => console.log('  ✓ ' + msg);
const fail = (msg) => { failures++; console.error('  ✗ ' + msg); };

async function runTests() {
  console.log('\n[WhatsApp Outbox Queue Test Suite]');

  // ─── Test 1: calculateDelay thresholds ───
  try {
    // 1. Under queue pressure (>= 4)
    for (let i = 0; i < 20; i++) {
      const delay = calculateDelay(true, 4);
      assert(delay >= 5 && delay <= 15, `Pressure delay ${delay} outside expected [5, 15]`);
    }
    pass('حساب التأخير: تفعيل وضع الضغط (queue >= 4) بنجاح');

    // 2. New conversation without pressure
    for (let i = 0; i < 20; i++) {
      const delay = calculateDelay(true, 1);
      assert(delay >= 20 && delay <= 40, `New chat delay ${delay} outside expected [20, 40]`);
    }
    pass('حساب التأخير: تأخير المحادثة الجديدة (مدروس بشرياً)');

    // 3. Ongoing conversation without pressure
    for (let i = 0; i < 20; i++) {
      const delay = calculateDelay(false, 1);
      assert(delay >= 10 && delay <= 20, `Ongoing delay ${delay} outside expected [10, 20]`);
    }
    pass('حساب التأخير: حوار نشط سريع ومناسب');
  } catch (err) {
    fail('فشل فحص حساب التأخير: ' + err.message);
  }

  // ─── Test 2: calculateTypingDuration ───
  try {
    const emptyTyping = calculateTypingDuration(0);
    assert(emptyTyping >= 10, 'Empty typing duration below min');

    const shortTyping = calculateTypingDuration(10);
    assert(shortTyping >= 10 && shortTyping <= 30, 'Short text typing out of bounds');

    const longTyping = calculateTypingDuration(5000);
    assert.strictEqual(longTyping, 30, 'Long text typing must cap at max bound');
    pass('حساب مدة الكتابة ومطابقة الحدود القصوى والدنيا');
  } catch (err) {
    fail('فشل فحص مدة الكتابة: ' + err.message);
  }

  // ─── Test 3: Serial Outbox Dispatch & Typing Lifecycle ───
  try {
    const botId = 'test_bot_serial';
    const events = [];

    const mockClient = {
      startTyping: async (to, duration) => {
        events.push({ event: 'startTyping', to, duration });
      },
      stopTyping: async (to) => {
        events.push({ event: 'stopTyping', to });
      },
    };

    const p1 = enqueueOutgoingReply({
      botId,
      userId: 'user_1',
      client: mockClient,
      text: 'مرحبا بك في متجرنا',
      sendFn: async () => {
        events.push({ event: 'send', to: 'user_1' });
        return { messageId: 'msg_1' };
      },
      isFirstInbound: true,
    });

    const p2 = enqueueOutgoingReply({
      botId,
      userId: 'user_2',
      client: mockClient,
      text: 'طلبك قيد المعالجة',
      sendFn: async () => {
        events.push({ event: 'send', to: 'user_2' });
        return { messageId: 'msg_2' };
      },
      isFirstInbound: false,
    });

    const [r1, r2] = await Promise.all([p1, p2]);

    assert.strictEqual(r1.messageId, 'msg_1');
    assert.strictEqual(r2.messageId, 'msg_2');

    // Verify ordering
    const sendIndices = [
      events.findIndex(e => e.event === 'send' && e.to === 'user_1'),
      events.findIndex(e => e.event === 'send' && e.to === 'user_2'),
    ];
    assert(sendIndices[0] >= 0 && sendIndices[1] >= 0, 'Both sends must occur');
    assert(sendIndices[0] < sendIndices[1], 'user_1 must be sent before user_2');

    // Verify typing lifecycle for user_1
    const u1Start = events.findIndex(e => e.event === 'startTyping' && e.to === 'user_1');
    const u1Stop = events.findIndex(e => e.event === 'stopTyping' && e.to === 'user_1');
    assert(u1Start !== -1 && u1Stop !== -1 && u1Start < u1Stop && u1Stop < sendIndices[0],
      'Lifecycle: startTyping -> stopTyping -> send');

    pass('المعالجة التسلسلية ومحاكاة الكتابة الحية (startTyping -> stopTyping -> send)');
  } catch (err) {
    fail('فشل فحص دورة حياة الكتابة والإرسال: ' + err.message);
  }

  // ─── Test 4: Merchant Takeover Cancellation ───
  try {
    const botId = 'test_bot_takeover';
    const events = [];
    const mockClient = {
      startTyping: async () => {},
      stopTyping: async () => {},
    };

    // Customer 1 will have takeover enabled before reply executes
    setTakeover(botId, 'user_takeover', true);

    const res = await enqueueOutgoingReply({
      botId,
      userId: 'user_takeover',
      client: mockClient,
      text: 'رد أوتوماتيكي تم إلغاؤه',
      sendFn: async () => {
        events.push('should_not_send');
        return { messageId: 'bad' };
      },
    });

    assert.strictEqual(res.skipped, true);
    assert.strictEqual(res.reason, 'takeover_active');
    assert.strictEqual(events.length, 0, 'sendFn must never be called during takeover');

    // Clean up takeover
    setTakeover(botId, 'user_takeover', false);
    pass('إلغاء الرد الآلي فوراً عند تدخل التاجر يدوياً (Takeover Guard)');
  } catch (err) {
    fail('فشل فحص حماية تدخل التاجر: ' + err.message);
  }

  // ─── Test 5: 7 Simultaneous Inbound Simulation ───
  try {
    const botId = 'test_bot_burst';
    const sendOrder = [];
    const mockClient = {
      startTyping: async () => {},
      stopTyping: async () => {},
    };

    const promises = [];
    for (let i = 1; i <= 7; i++) {
      const uId = `customer_${i}`;
      promises.push(
        enqueueOutgoingReply({
          botId,
          userId: uId,
          client: mockClient,
          text: `رد رقم ${i}`,
          sendFn: async () => {
            sendOrder.push(uId);
            return { sent: true, uId };
          },
          isFirstInbound: true,
        })
      );
    }

    const results = await Promise.all(promises);
    assert.strictEqual(results.length, 7, 'All 7 replies must resolve');
    assert.strictEqual(sendOrder.length, 7, 'All 7 sends must execute in sequence');

    // Ensure sequential FIFO order
    for (let i = 1; i <= 7; i++) {
      assert.strictEqual(sendOrder[i - 1], `customer_${i}`, `Order mismatch at index ${i - 1}`);
    }

    pass('محاكاة تدفق 7 زبائن في نفس اللحظة: تمت المعالجة بالتتابع وبدون أي انهيار أو تداخل');
  } catch (err) {
    fail('فشل فحص تدفق 7 زبائن: ' + err.message);
  }

  console.log('\n──────────────────────────────');
  if (failures > 0) {
    console.error(`✗ فشلت الاختبارات: ${failures} خطأ`);
    process.exit(1);
  } else {
    console.log('✓ جميع اختبارات WhatsApp Outbox Queue نجحت بتفوق!');
    process.exit(0);
  }
}

runTests().catch(e => {
  console.error('Fatal test error:', e);
  process.exit(1);
});
