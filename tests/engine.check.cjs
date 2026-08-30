#!/usr/bin/env node
'use strict';
// ═══════════════════════════════════════════════════════════════
// BotForge engine guard — catches the breakage classes that have
// actually hit this repo, on every push:
//   G1  syntax validity of every engine module          (spliced/corrupted files)
//   G2  module.exports shorthand names must be defined  (recordAbandonedReminder class)
//   G3  promptGenerator functional assertions           (deleted prompt systems)
//
// Zero dependencies. Exit 1 on any failure. Usage:
//   node tests/engine.check.cjs <engineDir relative to repo root>
// ═══════════════════════════════════════════════════════════════
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const target = path.resolve(process.argv[2] || 'whatsapp-engine');
const rel = (f) => path.relative(ROOT, f).split(path.sep).join('/');

let failures = 0;
const fail = (msg) => { failures++; console.error('  ✗ ' + msg); };
const pass = (msg) => console.log('  ✓ ' + msg);

function listJsFiles(dir) {
  const out = [];
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, e.name);
      if (e.isDirectory()) {
        if (['node_modules', 'sessions', 'logs', 'dist', 'scratch'].includes(e.name)) continue;
        walk(full);
      } else if (e.name.endsWith('.js')) out.push(full);
    }
  };
  walk(dir);
  return out;
}

// ─── G1: syntax gate ───
const files = listJsFiles(target);
console.log(`\n[G1] فحص الصياغة — ${files.length} ملف في ${rel(target)}`);
for (const f of files) {
  try {
    execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' });
    pass(rel(f));
  } catch (e) {
    fail(`SYNTAX: ${rel(f)}\n      ${String(e.stderr || e.message).trim().split('\n').slice(0, 4).join('\n      ')}`);
  }
}

// ─── G2: exports ↔ definitions gate ───
// Every shorthand identifier inside `module.exports = { ... }` must be
// declared somewhere in the same file. Catches the "exported but never
// defined" require-time ReferenceError that killed the engine (47ad9c2).
console.log('\n[G2] مطابقة الصادرات مع التعريفات');
function checkExports(file) {
  const src = fs.readFileSync(file, 'utf8');
  const m = src.match(/module\.exports\s*=\s*\{([\s\S]*?)\};/);
  if (!m) return; // no object-form exports — nothing to check
  const entries = m[1]
    .split(',')
    .map(s => s.replace(/\/\/.*$/gm, '').trim())
    .filter(s => s && !s.startsWith('...') && !s.includes(':'));
  if (entries.length === 0) return;

  const missing = entries.filter(name => {
    if (!/^[A-Za-z_$][\w$]*$/.test(name)) return false; // not a plain identifier — skip
    const decl = new RegExp(
      `(function\\s+${name}\\b)|(async\\s+function\\s+${name}\\b)|((const|let|var)\\s+${name}\\b)|(class\\s+${name}\\b)`
    );
    return !decl.test(src);
  });

  if (missing.length) {
    fail(`${rel(file)} — صادرات بلا تعريف: ${missing.join(', ')}`);
  } else {
    pass(`${rel(file)} — ${entries.length} صادرة كلها معرّفة`);
  }
}
files.forEach(checkExports);

// ─── G3: promptGenerator functional gate (dependency-free module) ───
const pgPath = path.join(target, 'promptGenerator.js');
if (fs.existsSync(pgPath)) {
  console.log('\n[G3] اختبار وظيفي — promptGenerator');
  try {
    delete require.cache[require.resolve(pgPath)];
    const { buildSystemPrompt } = require(pgPath);
    if (typeof buildSystemPrompt !== 'function') throw new Error('buildSystemPrompt ليست دالة');

    const withCatalog = buildSystemPrompt({
      botName: 'ت', businessName: 'متجر', currency: 'دج',
      services: 'منتج اختبار — 100 دج',
      features: { orders: true, leadQualification: true },
      autoOrdersEnabled: true,
    });
    const emptyCatalog = buildSystemPrompt({
      botName: 'ت', businessName: 'متجر', currency: 'دج',
      features: { orders: true, leadQualification: true },
      autoOrdersEnabled: true,
    });

    const checks = [
      ['نظام الطلبيات (ORDER_CONFIRMED)', withCatalog.includes('ORDER_CONFIRMED')],
      ['نظام تأهيل الليدات (LEAD_QUALIFIED)', withCatalog.includes('LEAD_QUALIFIED')],
      ['قاعدة الحصانة (8)', withCatalog.includes('الحصانة')],
      ['منع الاختلاق مع كتالوج', withCatalog.includes('منع اختلاق المنتجات')],
      ['منع الهلوسة بكتالوج فارغ', emptyCatalog.includes('الكتالوج غير متاح بعد')],
    ];
    for (const [label, ok] of checks) ok ? pass(label) : fail(`${label} — مفقود من البرومبت!`);
  } catch (e) {
    fail(`promptGenerator لا يُحمَّل أصلاً: ${e.message}`);
  }
}

// ─── G4: message queue functional gate (merge + per-customer isolation) ───
const mqPath = path.join(target, 'messageQueue.js');
if (fs.existsSync(mqPath)) {
  console.log('\n[G4] اختبار وظيفي — messageQueue');
  const mq = require(mqPath);
  const savedDebounce = process.env.MESSAGE_DEBOUNCE_MS;
  process.env.MESSAGE_DEBOUNCE_MS = '150';
  // note: the module reads the env at require-time, so re-require in a
  // child process for a deterministic short debounce
  delete require.cache[require.resolve(mqPath)];
  const { execFileSync } = require('child_process');
  try {
    const runner = `
const mq = require('./messageQueue.js');
const batches = [];
const proc = async (items) => batches.push(items.map(m => m.body));
mq.enqueueCustomerMessage('b1', { from: 'c1', body: 'a', hasMedia: false }, proc);
mq.enqueueCustomerMessage('b1', { from: 'c1', body: 'b', hasMedia: false }, proc);
mq.enqueueCustomerMessage('b1', { from: 'c2', body: 'c', hasMedia: false }, proc);
setTimeout(() => {
  const merged = batches.find(x => x.length === 1 && x[0] === 'a\\nb');
  const sep = batches.some(x => x.length === 1 && x[0] === 'c');
  const ok = batches.length === 2 && merged && sep;
  console.log(ok ? 'PASS' : 'FAIL ' + JSON.stringify(batches));
  process.exit(ok ? 0 : 1);
}, 600);`;
    const out = execFileSync(process.execPath, ['-e', runner], {
      cwd: target, env: { ...process.env, MESSAGE_DEBOUNCE_MS: '150' }, stdio: 'pipe',
    }).toString();
    if (out.includes('PASS')) pass('دمج الشظايا + عزل الزبائن');
    else fail('messageQueue: ' + out.trim());
  } catch (e) {
    const out = String(e.stdout || '') + '\n[stderr]\n' + String(e.stderr || '') + '\n[exit] ' + e.status;
    fail('messageQueue test failed:\n' + out);
  } finally {
    if (savedDebounce === undefined) delete process.env.MESSAGE_DEBOUNCE_MS;
    else process.env.MESSAGE_DEBOUNCE_MS = savedDebounce;
  }
}

// ─── Verdict ───
console.log('\n──────────────────────────────');
if (failures > 0) {
  console.error(`✗ فشل — ${failures} مشكلة. لا تنشر حتى تُصلحها.`);
  process.exit(1);
}
console.log('✓ كل الفحوص نجحت — آمن للنشر');
