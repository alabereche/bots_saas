// ═══════════════════════════════════════════════════════════════
// Per-customer message queue with typing-debounce.
//
// Customers write in fragments ("سلام" / "شحال" / "العطر الأول").
// Processing each fragment instantly means parallel AI calls, racing
// replies and duplicated orders. This queue:
//   - buffers each customer's messages (key = botId:userId)
//   - waits DEBOUNCE_MS after the last fragment (human-like pause)
//   - hands the WHOLE burst to the processor as one merged message
//     (one AI call, full intent, no racing)
//   - hard-caps the wait at MAX_WAIT_MS so a continuous typer is
//     never starved
//   - media messages flush the queue immediately (high intent) and
//     bursts containing media are processed sequentially in order
//
// In-memory only: a restart inside the <5s window drops the fragments
// — the customer simply re-sends. Acceptable by design.
// ═══════════════════════════════════════════════════════════════

const DEBOUNCE_MS = parseInt(process.env.MESSAGE_DEBOUNCE_MS || '4000', 10);
const MAX_WAIT_MS = parseInt(process.env.MESSAGE_MAX_WAIT_MS || '10000', 10);

const queues = new Map(); // `${botId}:${from}` -> { items, timer, firstAt }

/**
 * Buffer a customer message; the processor receives the burst once the
 * customer pauses (or immediately for media / max-wait).
 * @param {string} botId
 * @param {object} msg      raw whatsapp-web.js message
 * @param {(items: object[], botId: string) => Promise<void>} processBatch
 */
function enqueueCustomerMessage(botId, msg, processBatch) {
  const key = `${botId}:${msg.from}`;
  const now = Date.now();

  let q = queues.get(key);
  if (!q) {
    q = { items: [], timer: null, firstAt: now };
    queues.set(key, q);
  }
  q.items.push(msg);

  const elapsed = now - q.firstAt;
  let wait;
  if (msg.hasMedia) wait = 0;                                  // media: flush now
  else if (elapsed >= MAX_WAIT_MS) wait = 0;                   // continuous typer: unstarve
  else wait = Math.min(DEBOUNCE_MS, MAX_WAIT_MS - elapsed);    // normal debounce

  if (q.timer) clearTimeout(q.timer);
  q.timer = setTimeout(() => {
    queues.delete(key);                 // remove first so new fragments start a fresh queue
    flush(key, q.items, msg.from, processBatch).catch(e =>
      console.error(`[Queue] Flush error for ${key}:`, e.message)
    );
  }, wait);
}

async function flush(key, items, from, processBatch) {
  if (!items || items.length === 0) return;

  try {
    if (items.length === 1) {
      await processBatch(items, botIdFromKey(key));
      return;
    }

    const hasMedia = items.some(i => i.hasMedia);
    if (hasMedia) {
      // mixed burst: process strictly in order, one call each
      console.log(`[Queue] ${key}: ${items.length} رسائل (فيها وسائط) — معالجة متسلسلة`);
      for (const it of items) await processBatch([it], botIdFromKey(key));
      return;
    }

    // pure text burst: merge bodies INTO THE LAST REAL MESSAGE — mutating
    // the real object keeps every library getter/method (client, reply...)
    // intact; a synthetic clone loses them and replies never reach the
    // customer ("Cannot read properties of undefined").
    const last = items[items.length - 1];
    last.body = items.map(i => (i.body || '').trim()).filter(Boolean).join('\n');
    console.log(`[Queue] ${key}: دمج ${items.length} رسائل متتالية في استدعاء واحد`);
    await processBatch([last], botIdFromKey(key));
  } catch (e) {
    console.error(`[Queue] Processing error for ${key}:`, e.message);
  }
}

function botIdFromKey(key) {
  const idx = key.indexOf(':');
  return idx === -1 ? key : key.slice(0, idx);
}

function pendingCount() {
  let n = 0;
  queues.forEach(q => { n += q.items.length; });
  return n;
}

module.exports = { enqueueCustomerMessage, pendingCount, DEBOUNCE_MS, MAX_WAIT_MS };
