// ═══════════════════════════════════════════════════════════════
// BotForge Telegram Engine — Concurrency Throttler & VPS Shield
//
// Protects the server CPU and memory from high-traffic spikes
// (multiple simultaneous voice downloads + Gemini AI invocations)
// and avoids Telegram API 429 Too Many Requests rate-limiting.
// ═══════════════════════════════════════════════════════════════

const MAX_CONCURRENT = parseInt(process.env.TG_CONCURRENCY_LIMIT || '3', 10);
const GAP_MIN_MS = parseInt(process.env.TG_QUEUE_GAP_MIN_MS || '500', 10);
const GAP_MAX_MS = parseInt(process.env.TG_QUEUE_GAP_MAX_MS || '1500', 10);

// botId -> { activeCount: number, queue: Array<{ taskFn, resolve, reject }> }
const botQueues = new Map();

function getQueueState(botId) {
  let state = botQueues.get(botId);
  if (!state) {
    state = { activeCount: 0, queue: [] };
    botQueues.set(botId, state);
  }
  return state;
}

function scheduleNext(botId) {
  const state = botQueues.get(botId);
  if (!state || state.queue.length === 0) return;
  if (state.activeCount >= MAX_CONCURRENT) return;

  const nextTask = state.queue.shift();
  state.activeCount++;

  executeTask(botId, nextTask);
}

async function executeTask(botId, task) {
  const state = botQueues.get(botId);
  try {
    const result = await task.taskFn();
    task.resolve(result);
  } catch (err) {
    task.reject(err);
  } finally {
    if (state) {
      state.activeCount = Math.max(0, state.activeCount - 1);
    }

    const gap = Math.floor(Math.random() * (GAP_MAX_MS - GAP_MIN_MS + 1)) + GAP_MIN_MS;
    if (gap > 0) {
      setTimeout(() => {
        scheduleNext(botId);
      }, gap);
    } else {
      setImmediate(() => {
        scheduleNext(botId);
      });
    }
  }
}

/**
 * Enqueue a Telegram incoming processing task through the concurrency throttler.
 * @param {string} botId
 * @param {() => Promise<any>} taskFn
 * @returns {Promise<any>}
 */
export function enqueueTelegramTask(botId, taskFn) {
  return new Promise((resolve, reject) => {
    const state = getQueueState(botId);
    const task = { taskFn, resolve, reject };

    if (state.activeCount < MAX_CONCURRENT) {
      state.activeCount++;
      executeTask(botId, task);
    } else {
      state.queue.push(task);
    }
  });
}

export function getActiveCount(botId) {
  const state = botQueues.get(botId);
  return state ? state.activeCount : 0;
}

export function getPendingCount(botId) {
  const state = botQueues.get(botId);
  return state ? state.queue.length : 0;
}

export function clearTelegramQueue(botId) {
  const state = botQueues.get(botId);
  if (state) {
    while (state.queue.length > 0) {
      const item = state.queue.shift();
      item.resolve({ skipped: true, reason: 'queue_cleared' });
    }
    state.activeCount = 0;
  }
}

export default {
  enqueueTelegramTask,
  getActiveCount,
  getPendingCount,
  clearTelegramQueue,
};
