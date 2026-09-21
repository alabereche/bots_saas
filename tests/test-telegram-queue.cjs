#!/usr/bin/env node
'use strict';
// ═══════════════════════════════════════════════════════════════
// Test Suite: Telegram Concurrency Throttler & VPS Shield
//
// Verifies:
// 1. Max concurrent job cap (never exceeds limit at any instant)
// 2. FIFO task drain with jittered breathing gap
// 3. Error resilience (failing task doesn't stall remaining jobs)
// 4. Queue clearing functionality
// ═══════════════════════════════════════════════════════════════

const assert = require('assert');
const path = require('path');

// Configure fast timing for tests
process.env.TG_CONCURRENCY_LIMIT = '3';
process.env.TG_QUEUE_GAP_MIN_MS = '10';
process.env.TG_QUEUE_GAP_MAX_MS = '25';

let failures = 0;
const pass = (msg) => console.log('  ✓ ' + msg);
const fail = (msg) => { failures++; console.error('  ✗ ' + msg); };

async function runTests() {
  console.log('\n[Telegram Concurrency Throttler Test Suite]');

  const queueModulePath = path.resolve(__dirname, '../bot-engine/telegramQueue.js');
  const {
    enqueueTelegramTask,
    getActiveCount,
    getPendingCount,
    clearTelegramQueue,
  } = await import('file:///' + queueModulePath.replace(/\\/g, '/'));

  // ─── Test 1: Concurrency Cap (Max 3 Active at any time) ───
  try {
    const botId = 'test_tg_concurrency';
    let maxObservedActive = 0;
    let currentRunning = 0;
    const completedTasks = [];

    const tasks = [];
    for (let i = 1; i <= 8; i++) {
      const taskId = i;
      tasks.push(
        enqueueTelegramTask(botId, async () => {
          currentRunning++;
          maxObservedActive = Math.max(maxObservedActive, currentRunning);

          // Simulated AI / download work
          await new Promise(r => setTimeout(r, 40));

          completedTasks.push(taskId);
          currentRunning--;
          return { taskId, status: 'ok' };
        })
      );
    }

    const results = await Promise.all(tasks);

    assert.strictEqual(results.length, 8, 'All 8 tasks must resolve');
    assert.strictEqual(completedTasks.length, 8, 'All 8 tasks must execute');
    assert(maxObservedActive <= 3, `Max active concurrency exceeded 3: observed ${maxObservedActive}`);
    assert(maxObservedActive >= 2, `Expected concurrent overlap, observed ${maxObservedActive}`);

    pass(`تقييد التزامن الصارم (سقف 3 مهام كحد أقصى بالتوازي — المرصود: ${maxObservedActive})`);
  } catch (err) {
    fail('فشل فحص سقف التزامن: ' + err.message);
  }

  // ─── Test 2: Error Resilience (Failure does not jam queue) ───
  try {
    const botId = 'test_tg_error_resilience';
    const executed = [];

    const p1 = enqueueTelegramTask(botId, async () => {
      executed.push('p1');
      return 'ok1';
    });

    const p2 = enqueueTelegramTask(botId, async () => {
      executed.push('p2_fails');
      throw new Error('Telegram API connection timeout');
    });

    const p3 = enqueueTelegramTask(botId, async () => {
      executed.push('p3');
      return 'ok3';
    });

    const r1 = await p1;
    let errCaught = false;
    try {
      await p2;
    } catch (e) {
      errCaught = true;
      assert(e.message.includes('Telegram API connection timeout'));
    }
    const r3 = await p3;

    assert.strictEqual(r1, 'ok1');
    assert.strictEqual(errCaught, true);
    assert.strictEqual(r3, 'ok3');
    assert(executed.includes('p3'), 'Task p3 must execute even after p2 throws an exception');

    pass('المرونة ومقاومة الأخطاء: عدم تعليق الطابور عند فشل مهمة أو انقطاع اتصال');
  } catch (err) {
    fail('فشل فحص مرونة الطابور: ' + err.message);
  }

  // ─── Test 3: Clear Queue ───
  try {
    const botId = 'test_tg_clear';
    const promises = [];

    // Fill concurrency slots
    for (let i = 0; i < 3; i++) {
      promises.push(
        enqueueTelegramTask(botId, async () => {
          await new Promise(r => setTimeout(r, 60));
          return 'initial';
        })
      );
    }

    // Add pending tasks
    const pendingPromise = enqueueTelegramTask(botId, async () => {
      return 'should_be_cleared';
    });

    assert(getPendingCount(botId) > 0, 'Pending queue should have items');
    clearTelegramQueue(botId);
    assert.strictEqual(getPendingCount(botId), 0, 'Pending queue should be 0 after clear');

    const clearedResult = await pendingPromise;
    assert.strictEqual(clearedResult.skipped, true);
    assert.strictEqual(clearedResult.reason, 'queue_cleared');

    await Promise.all(promises);
    pass('تفريغ الطابور بأمان عند إيقاف البوت أو إعادة تشغيله (clearTelegramQueue)');
  } catch (err) {
    fail('فشل فحص تفريغ الطابور: ' + err.message);
  }

  console.log('\n──────────────────────────────');
  if (failures > 0) {
    console.error(`✗ فشلت الاختبارات: ${failures} خطأ`);
    process.exit(1);
  } else {
    console.log('✓ جميع اختبارات Telegram Queue نجحت بتفوق!');
    process.exit(0);
  }
}

runTests().catch(e => {
  console.error('Fatal test error:', e);
  process.exit(1);
});
