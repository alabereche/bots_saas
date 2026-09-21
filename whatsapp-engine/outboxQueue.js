// ═══════════════════════════════════════════════════════════════
// BotForge WhatsApp Engine — Adaptive Human-Paced Outbox Queue
//
// Solves two critical operational risks:
// 1. WhatsApp Anti-Ban: Prevents instant 0.2s robotic blasts and simultaneous
//    multi-recipient bursts by pacing outgoing messages with realistic human
//    timing (16-24s for new chats, 4-8s for ongoing, plus typing presence).
// 2. Queue Jam / Ad Spikes: Dynamically compresses dispatch intervals (3-5s)
//    when queue pressure rises (> 4 pending) so merchants running paid ad
//    campaigns never have customers waiting minutes for responses.
// ═══════════════════════════════════════════════════════════════

const { isTakeoverActive } = require('./takeover');

// Configurable timing thresholds (tunable via environment variables)
const INITIAL_DELAY_MIN = parseInt(process.env.OUTBOX_INITIAL_MIN_MS || '16000', 10);
const INITIAL_DELAY_MAX = parseInt(process.env.OUTBOX_INITIAL_MAX_MS || '24000', 10);
const ONGOING_DELAY_MIN = parseInt(process.env.OUTBOX_ONGOING_MIN_MS || '4000', 10);
const ONGOING_DELAY_MAX = parseInt(process.env.OUTBOX_ONGOING_MAX_MS || '8000', 10);
const PRESSURE_DELAY_MIN = parseInt(process.env.OUTBOX_PRESSURE_MIN_MS || '3000', 10);
const PRESSURE_DELAY_MAX = parseInt(process.env.OUTBOX_PRESSURE_MAX_MS || '5000', 10);
const PRESSURE_THRESHOLD = parseInt(process.env.OUTBOX_PRESSURE_THRESHOLD || '4', 10);
const TYPING_MIN_MS = parseInt(process.env.OUTBOX_TYPING_MIN_MS || '2500', 10);
const TYPING_MAX_MS = parseInt(process.env.OUTBOX_TYPING_MAX_MS || '6000', 10);
const INTER_GAP_MIN_MS = parseInt(process.env.OUTBOX_INTER_GAP_MIN_MS || '1500', 10);
const INTER_GAP_MAX_MS = parseInt(process.env.OUTBOX_INTER_GAP_MAX_MS || '3000', 10);

// Map of botId -> { items: Array, isProcessing: boolean, lastInteractionByUser: Map }
const botQueues = new Map();

function getBotQueueState(botId) {
  let state = botQueues.get(botId);
  if (!state) {
    state = {
      items: [],
      isProcessing: false,
      lastInteractionByUser: new Map(),
    };
    botQueues.set(botId, state);
  }
  return state;
}

function calculateDelay(isNewConversation, queueLength) {
  // If high traffic / ad campaign detected (> 4 messages waiting), compress delay
  if (queueLength >= PRESSURE_THRESHOLD) {
    return Math.floor(Math.random() * (PRESSURE_DELAY_MAX - PRESSURE_DELAY_MIN + 1)) + PRESSURE_DELAY_MIN;
  }

  // New incoming inquiry: deliberate human response delay
  if (isNewConversation) {
    return Math.floor(Math.random() * (INITIAL_DELAY_MAX - INITIAL_DELAY_MIN + 1)) + INITIAL_DELAY_MIN;
  }

  // Active ping-pong conversation: snappy human conversational response
  return Math.floor(Math.random() * (ONGOING_DELAY_MAX - ONGOING_DELAY_MIN + 1)) + ONGOING_DELAY_MIN;
}

function calculateTypingDuration(textLength) {
  if (!textLength) return TYPING_MIN_MS;
  // ~40ms per character, bounded between TYPING_MIN_MS and TYPING_MAX_MS
  return Math.min(Math.max(TYPING_MIN_MS, Math.floor(textLength * 40)), TYPING_MAX_MS);
}

/**
 * Enqueue an outgoing reply for human-paced delivery.
 * @param {Object} params
 * @param {string} params.botId
 * @param {string} params.userId
 * @param {Object} params.client        WPPConnect client
 * @param {string} [params.text]        Reply text (used for typing duration)
 * @param {Function} params.sendFn      Async callback that executes the actual send
 * @param {boolean} [params.isFirstInbound] Whether this is the first message in the session
 * @returns {Promise<any>}
 */
function enqueueOutgoingReply({ botId, userId, client, text = '', sendFn, isFirstInbound = false }) {
  return new Promise((resolve, reject) => {
    const state = getBotQueueState(botId);

    const lastSeen = state.lastInteractionByUser.get(userId) || 0;
    const isRecent = Date.now() - lastSeen < 75000; // within 75 seconds = ongoing dialogue
    const isNew = isFirstInbound || !isRecent;

    const queueItem = {
      userId,
      client,
      text,
      sendFn,
      isNew,
      enqueuedAt: Date.now(),
      resolve,
      reject,
    };

    state.items.push(queueItem);

    // If dispatcher is idle, kick off processing
    if (!state.isProcessing) {
      processNext(botId).catch(err => {
        console.error(`[OutboxQueue] Unexpected queue error for bot ${botId}:`, err.message);
      });
    }
  });
}

async function processNext(botId) {
  const state = botQueues.get(botId);
  if (!state || state.items.length === 0) {
    if (state) state.isProcessing = false;
    return;
  }

  state.isProcessing = true;
  const item = state.items.shift();
  const queueRemaining = state.items.length;

  try {
    // 1. Takeover guard: If merchant intervened during delay, drop bot reply
    if (isTakeoverActive && isTakeoverActive(botId, item.userId)) {
      console.log(`[OutboxQueue] 🛑 Dropped queued bot reply for ${item.userId} — merchant takeover active.`);
      item.resolve({ skipped: true, reason: 'takeover_active' });
      setImmediate(() => processNext(botId));
      return;
    }

    // 2. Calculate natural human delay
    const totalDelay = calculateDelay(item.isNew, queueRemaining);
    const typingDuration = calculateTypingDuration(item.text.length);

    // Initial human "reading" pause before typing
    const preTypingPause = Math.max(0, totalDelay - typingDuration);
    if (preTypingPause > 0) {
      await new Promise(r => setTimeout(r, preTypingPause));
    }

    // 3. Takeover check again after the pause
    if (isTakeoverActive && isTakeoverActive(botId, item.userId)) {
      console.log(`[OutboxQueue] 🛑 Dropped queued bot reply for ${item.userId} — merchant takeover triggered during delay.`);
      item.resolve({ skipped: true, reason: 'takeover_active' });
      setImmediate(() => processNext(botId));
      return;
    }

    // 4. Trigger typing presence indicator
    if (item.client && typeof item.client.startTyping === 'function') {
      try {
        await item.client.startTyping(item.userId, typingDuration);
      } catch { /* best effort */ }
    }

    // Wait typing duration
    await new Promise(r => setTimeout(r, typingDuration));

    // Stop typing
    if (item.client && typeof item.client.stopTyping === 'function') {
      try {
        await item.client.stopTyping(item.userId);
      } catch { /* best effort */ }
    }

    // 5. Final takeover check before message transmission
    if (isTakeoverActive && isTakeoverActive(botId, item.userId)) {
      console.log(`[OutboxQueue] 🛑 Dropped queued bot reply for ${item.userId} — merchant takeover triggered before send.`);
      item.resolve({ skipped: true, reason: 'takeover_active' });
      setImmediate(() => processNext(botId));
      return;
    }

    // 6. Execute the actual send
    const result = await item.sendFn();
    state.lastInteractionByUser.set(item.userId, Date.now());
    item.resolve(result);

  } catch (err) {
    console.warn(`[OutboxQueue] Error sending reply for user ${item.userId}:`, err.message);
    item.reject(err);
  } finally {
    // Inter-customer breathing gap so sequential replies to different users don't fire on the same tick
    const interCustomerGap = Math.floor(Math.random() * (INTER_GAP_MAX_MS - INTER_GAP_MIN_MS + 1)) + INTER_GAP_MIN_MS;
    setTimeout(() => {
      processNext(botId).catch(() => {});
    }, interCustomerGap);
  }
}

function getPendingCount(botId) {
  const state = botQueues.get(botId);
  return state ? state.items.length : 0;
}

function clearBotQueue(botId) {
  const state = botQueues.get(botId);
  if (state) {
    while (state.items.length > 0) {
      const it = state.items.shift();
      it.resolve({ skipped: true, reason: 'queue_cleared' });
    }
    state.isProcessing = false;
  }
}

module.exports = {
  enqueueOutgoingReply,
  getPendingCount,
  clearBotQueue,
  calculateDelay,
  calculateTypingDuration,
};
