// ═══════════════════════════════════════════════════════════════
// BotForge — WhatsApp Engine Stress Test
// Progressively launches real (unlinked) WhatsApp bot sessions via
// botManager directly (bypassing HTTP + auth), measures system RAM /
// load after each boot, auto-stops at a danger floor, then cleans up.
//
// Usage:  node stress-test.cjs [maxBots=12] [freeFloorMB=450]
// ═══════════════════════════════════════════════════════════════
const { execSync } = require('child_process');
const os = require('os');
const fs = require('fs');
const path = require('path');

let bm;
try {
  bm = require('./botManager');
} catch (e) {
  console.error('❌ تعذر تحميل botManager (هذا السكربت يعمل داخل مجلد المحرك فقط):', e.message);
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function memInfo() {
  // Linux `free -m` gives the honest system-wide picture (incl. Chromium children)
  try {
    const line = execSync('free -m').toString().split('\n')[1].trim().split(/\s+/);
    const [, total, used, , avail] = line.map(Number);
    return { total, used, avail: Number.isFinite(avail) && avail > 0 ? avail : Math.max(total - used, 0) };
  } catch {
    return {
      total: Math.round(os.totalmem() / 1048576),
      used: null,
      avail: Math.round(os.freemem() / 1048576),
    };
  }
}

const maxBots = parseInt(process.argv[2], 10) || 12;
const floorMB = parseInt(process.argv[3], 10) || 450;
const prefix = `stress-${Date.now().toString(36)}`;
const launched = [];
let busy = false;

async function cleanup(signal = false) {
  if (busy) return;
  busy = true;
  console.log(`\n🧹 التنظيف: إيقاف ${launched.length} جلسة اختبارية ...`);
  for (const id of launched) {
    try { await bm.stopWhatsAppBot(id); } catch { /* already gone */ }
    try { fs.rmSync(path.join(__dirname, 'sessions', `session-${id}`), { recursive: true, force: true }); } catch {}
  }
  const m = memInfo();
  console.log(`✅ تم التنظيف — الرام المتاح عاد إلى: ${m.avail}MB`);
  if (signal) process.exit(0);
}

(async () => {
  console.log('════════════════════════════════════════════════');
  console.log('  اختبار ضغط بوتات واتساب (جلسات حقيقية غير مربوطة)');
  console.log(`  الحد الأقصى: ${maxBots} جلسة | حد التوقف الآمن: ${floorMB}MB متاحة`);
  console.log('════════════════════════════════════════════════');

  const base = memInfo();
  console.log(`📊 الأساس قبل الاختبار: المستخدم ${base.used ?? '?'}MB | المتاح ${base.avail}MB / ${base.total}MB\n`);

  process.on('SIGINT', () => cleanup(true));

  let crashedEarly = 0;

  for (let i = 1; i <= maxBots; i++) {
    const botId = `${prefix}-${i}`;
    process.stdout.write(`(${i}/${maxBots}) إقلاع ${botId} ... `);

    try {
      // Fire-and-forget on purpose: an UNLINKED session's initialize() may
      // never resolve until someone scans — we only need Chromium booted.
      const p = bm.createWhatsAppBot(
        botId,
        { id: botId, botName: `STRESS-${i}`, userId: 'stress-test', features: {} },
        null,
        true
      );
      p.catch(() => {});
      await Promise.race([p, sleep(25000)]);
      launched.push(botId);
      process.stdout.write('أقلع ✓\n');
    } catch (e) {
      crashedEarly++;
      console.log(`فشل: ${e.message}`);
    }

    await sleep(7000); // let Chromium settle before sampling

    const m = memInfo();
    let liveCount = launched.length;
    try { liveCount = bm.getAllBotStatuses().length || launched.length; } catch {}

    const load = os.loadavg()[0];
    console.log(
      `   ↳ جلسات مباشرة: ${liveCount} | رام مستخدم: ${m.used ?? '?'}MB` +
      ` | متاح: ${m.avail}MB | حمل المعالج: ${load.toFixed(2)}`
    );

    const availNow = m.avail;
    if (availNow <= floorMB) {
      console.log(`\n⛔ حد الأمان — توقف تلقائي عند ${launched.length} جلسة (المتاح ${availNow}MB ≤ ${floorMB}MB)`);
      break;
    }
    if (crashedEarly >= 4) {
      console.log('\n⛔ فشل إقلاع متكرر (قد يكون واتساب يحدّ الجلسات المتزامنة من نفس IP) — توقف.');
      break;
    }
  }

  if (crashedEarly === 0 && launched.length >= 3) {
    const last = memInfo();
    console.log('\n💡 قراءة تقديرية: كل جلسة كلّفت وسطياً ≈ ' +
      Math.round(((base.avail - last.avail) / Math.max(launched.length, 1)) * 10) / 10 + 'MB');
  }

  await cleanup(false);
  const after = memInfo();
  console.log(`\n📈 بعد التنظيف: المتاح ${after.avail}MB (كان ${base.avail}MB قبل البدء)`);
  console.log('انتهى الاختبار — شاركني الجدول أعلاه كاملاً.');
  process.exit(0);
})();
