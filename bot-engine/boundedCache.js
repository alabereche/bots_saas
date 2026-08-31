// ═══════════════════════════════════════════════════════════════
// Bounded cache with real TTL — shared fix for the unbounded
// avatar Maps (F-findings: "TTL 24h" comment over a plain Map).
// Insertion-ordered Map: set() evicts the OLDEST entry past the cap,
// get() expires entries past the TTL. Zero dependencies.
// ═══════════════════════════════════════════════════════════════

function createBoundedCache({ maxEntries = 2000, ttlMs = 24 * 60 * 60 * 1000 } = {}) {
  const m = new Map();
  return {
    get(key) {
      const entry = m.get(key);
      if (entry === undefined) return undefined;
      if (Date.now() - entry.at > ttlMs) {
        m.delete(key);
        return undefined;
      }
      return entry.value;
    },
    has(key) {
      const entry = m.get(key);
      if (entry === undefined) return false;
      if (Date.now() - entry.at > ttlMs) {
        m.delete(key);
        return false;
      }
      return true;
    },
    set(key, value) {
      if (m.has(key)) m.delete(key); // refresh insertion order
      m.set(key, { value, at: Date.now() });
      while (m.size > maxEntries) {
        m.delete(m.keys().next().value); // oldest first
      }
    },
    get size() { return m.size; },
  };
}

module.exports = { createBoundedCache };
