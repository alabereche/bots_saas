import { useMemo, useState } from 'react';

// ═══════════════════════════════════════════════════════════════
// BotForge — Analytics Tab (merchant-facing, per-bot)
//
// Zero new reads: everything is computed from the live subscriptions
// already held by BotDetail (conversations, orders) + the bot's catalog.
// Answers the merchant's four questions: how much engagement, where did
// people drop off, who bought, what did recovery harvest.
// ═══════════════════════════════════════════════════════════════

const PERIODS = [
  { key: '7', label: '٧ أيام', days: 7 },
  { key: '30', label: '٣٠ يوماً', days: 30 },
  { key: 'all', label: 'الكل', days: null },
];

const PRICE_INTENT_RE = /(شحال|بشحال|شقد|قديش|بكم\b|الثمن|السعر|سعر|اسعار|أسعار|تمن|prix)/i;
const RETURN_GAP_MS = 2 * 60 * 60 * 1000; // 2h silence then a return message

function digitsOf(v) {
  return String(v || '').replace(/[^0-9]/g, '');
}

function parsePrice(v) {
  const n = parseInt(String(v || '').replace(/[^0-9]/g, ''), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function fmtTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return '';
  return d.toLocaleDateString('ar-DZ') + ' ' + d.toLocaleTimeString('ar-DZ', { hour: '2-digit', minute: '2-digit' });
}

function matchCatalogProduct(orderProduct, products = []) {
  const q = String(orderProduct || '').trim().toLowerCase();
  if (!q) return null;
  return products.find(p => {
    const n = String(p?.name || '').trim().toLowerCase();
    return n && (q.includes(n) || n.includes(q));
  }) || null;
}

export default function AnalyticsTab({ allMessages = [], orders = [], leads = [], bot, onOpenChat }) {
  const [period, setPeriod] = useState('30');

  const stats = useMemo(() => {
    const days = PERIODS.find(p => p.key === period)?.days ?? null;
    const cutoff = days ? new Date(Date.now() - days * 86400000).toISOString() : null;
    const inPeriod = (iso) => iso && (!cutoff || iso >= cutoff);

    // ── Customer threads from customer-side messages ──
    const threads = {};
    let customerMsgs = 0;
    let botReplies = 0;
    for (const m of allMessages) {
      if (!inPeriod(m.createdAt)) continue;
      if (m.role === 'bot') { botReplies++; continue; }
      if (m.role !== 'user') continue; // 'owner' replies are the merchant, not engagement
      customerMsgs++;
      const id = m.telegramUserId || m.userId;
      if (!id) continue;
      if (!threads[id]) {
        threads[id] = { id, name: m.userName || 'زبون', msgs: [], firstAt: m.createdAt, lastAt: m.createdAt, priceIntent: false };
      }
      const t = threads[id];
      t.msgs.push({ content: m.content || '', createdAt: m.createdAt });
      if (m.userName) t.name = m.userName;
      if (m.createdAt < t.firstAt) t.firstAt = m.createdAt;
      if (m.createdAt > t.lastAt) { t.lastAt = m.createdAt; t.name = m.userName || t.name; }
      if (PRICE_INTENT_RE.test(m.content || '')) t.priceIntent = true;
    }

    // Return-after-silence detection (needs chronological order)
    const threadList = Object.values(threads);
    for (const t of threadList) {
      t.msgs.sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
      t.returns = 0;
      t.lastReturnAt = null;
      for (let i = 1; i < t.msgs.length; i++) {
        const gap = new Date(t.msgs[i].createdAt) - new Date(t.msgs[i - 1].createdAt);
        if (gap >= RETURN_GAP_MS) {
          t.returns++;
          t.lastReturnAt = t.msgs[i].createdAt;
        }
      }
      t.lastContent = (t.msgs[t.msgs.length - 1]?.content || '').slice(0, 70);
    }

    // ── Orders matched to threads (digits-normalized ids) ──
    const periodOrders = orders.filter(o => inPeriod(o.createdAt));
    const orderByThread = new Map(); // threadId -> orders[]
    const threadIdSet = new Set(threadList.map(t => digitsOf(t.id)));
    for (const o of periodOrders) {
      const oid = digitsOf(o.customerId);
      let tid = null;
      if (oid && threadIdSet.has(oid)) {
        tid = threadList.find(t => digitsOf(t.id) === oid)?.id;
      }
      if (!tid) {
        // unclaimed order — still counts in sales, shown without a thread link
        tid = `__order_${o.id || Math.random()}`;
      }
      if (!orderByThread.has(tid)) orderByThread.set(tid, []);
      orderByThread.get(tid).push(o);
    }

    for (const t of threadList) {
      const list = orderByThread.get(t.id) || [];
      t.orders = list;
      t.hasOrder = list.length > 0;
      t.hasDelivered = list.some(o => o.deliveryStatus === 'delivered');
    }

    // ── Funnel ──
    const asked = threadList;
    const askedPrice = asked.filter(t => t.priceIntent);
    const ordered = asked.filter(t => t.hasOrder);
    const delivered = asked.filter(t => t.hasDelivered);

    // ── Sales ──
    let deliveredValue = 0, pipelineValue = 0, priced = 0, unpriced = 0;
    const statusCounts = { accepted: 0, shipped: 0, delivered: 0, cancelled: 0 };
    const productCounts = {};
    for (const o of periodOrders) {
      const st = o.deliveryStatus || 'accepted';
      if (statusCounts[st] !== undefined) statusCounts[st]++;
      const cat = matchCatalogProduct(o.product, bot?.products);
      const price = parsePrice(o.price) ?? parsePrice(cat?.price) ?? parsePrice(cat?.oldPrice);
      const label = (o.product || '').trim() || 'بدون اسم';
      productCounts[label] = (productCounts[label] || 0) + 1;
      if (st === 'cancelled') continue;
      if (price) {
        priced++;
        if (st === 'delivered') deliveredValue += price;
        else pipelineValue += price;
      } else {
        unpriced++;
      }
    }
    const topProducts = Object.entries(productCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);

    // ── Recovery (returned after ≥2h silence) ──
    const returned = asked.filter(t => t.returns > 0);
    const returnedBought = returned.filter(t =>
      (orderByThread.get(t.id) || []).some(o => o.createdAt && t.lastReturnAt && o.createdAt >= t.lastReturnAt)
    );

    // ── Drop-off: asked but never ordered ──
    const noOrder = asked.filter(t => !t.hasOrder).sort((a, b) => (b.lastAt || '').localeCompare(a.lastAt || ''));

    const closingRate = asked.length ? Math.round((ordered.length / asked.length) * 100) : 0;
    const conv = (n) => n.toLocaleString('en-US');

    return { threadList, customerMsgs, botReplies, periodOrders, asked, askedPrice, ordered, delivered, statusCounts, deliveredValue, pipelineValue, priced, unpriced, topProducts, returned, returnedBought, noOrder, closingRate, conv };
  }, [allMessages, orders, bot, period]);

  const funnelStages = [
    { label: 'سألوا البوت', items: stats.asked, color: '#10b981', hint: 'زبائن أرسلوا رسالة واحدة على الأقل' },
    { label: 'سألوا عن السعر', items: stats.askedPrice, color: '#34d399', hint: 'كلامهم تضمن استفساراً عن السعر أو المنتج' },
    { label: 'طلبوا فعلاً', items: stats.ordered, color: '#f59e0b', hint: 'لديهم طلبية مسجلة في الفترة' },
    { label: 'وصلت طلبياتهم', items: stats.delivered, color: '#38bdf8', hint: 'طلبية واحدة على الأقل حُدّدت كمسلّمة' },
  ];
  const funnelMax = Math.max(1, ...funnelStages.map(s => s.items.length));

  const kpis = [
    { label: 'زبائن تفاعلوا', value: stats.conv(stats.asked.length), color: '#10b981' },
    { label: 'رسائل زبائن', value: stats.conv(stats.customerMsgs), color: '#34d399' },
    { label: 'ردود البوت', value: stats.conv(stats.botReplies), color: '#38bdf8' },
    { label: 'طلبيات', value: stats.conv(stats.periodOrders.length), color: '#f59e0b' },
    { label: 'نسبة الإغلاق', value: stats.closingRate + '%', color: '#a78bfa' },
    { label: 'عادوا بعد صمت', value: stats.conv(stats.returned.length), color: '#fb923c' },
  ];

  return (
    <div style={{ padding: '1.5rem 1.25rem', maxWidth: 1100, margin: '0 auto' }}>
      {/* Period switcher */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: '1.25rem' }}>
        <h2 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--text-primary)', fontWeight: 800 }}>تحليلات البوت</h2>
        <div style={{ display: 'flex', gap: 6 }}>
          {PERIODS.map(p => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={`btn btn-sm ${period === p.key ? 'btn-primary' : 'btn-secondary'}`}
              style={{ borderRadius: '999px', padding: '0.4rem 1rem', fontSize: '0.8rem' }}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {stats.asked.length === 0 && stats.periodOrders.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem 1rem', color: 'var(--text-secondary)' }}>
          
          <div style={{ fontWeight: 700, marginBottom: '0.4rem', color: 'var(--text-primary)' }}>لا توجد بيانات في هذه الفترة</div>
          <div style={{ fontSize: '0.85rem' }}>جرّب مدى أوسع — أو انتظر أول محادثة، والأرقام ستُبنى هنا تلقائياً.</div>
        </div>
      ) : (
        <>
          {/* KPI row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: '1.5rem' }}>
            {kpis.map(k => (
              <div key={k.label} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 16, padding: '0.9rem 1rem' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', fontWeight: 700, marginBottom: 4 }}>{k.label}</div>
                <div style={{ fontSize: '1.45rem', fontWeight: 900, color: k.color }}>{k.value}</div>
              </div>
            ))}
          </div>

          {/* Funnel */}
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 18, padding: '1.1rem 1.25rem', marginBottom: '1.25rem' }}>
            <div style={{ fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.9rem' }}>قمع البيع — أين توقفوا؟</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {funnelStages.map((s, i) => {
                const prev = i > 0 ? funnelStages[i - 1].items.length : null;
                const convPct = i > 0 && prev ? Math.round((s.items.length / prev) * 100) : null;
                return (
                  <div key={s.label}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4, flexWrap: 'wrap', gap: 6 }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-primary)' }}>{s.label}</span>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                        <b style={{ color: s.color, fontSize: '0.95rem' }}>{stats.conv(s.items.length)}</b>
                        {convPct !== null && <span> · {convPct}% من المرحلة السابقة</span>}
                      </span>
                    </div>
                    <div style={{ height: 12, background: 'var(--veil-1)', borderRadius: 999, overflow: 'hidden' }}>
                      <div style={{ width: `${Math.max(2, (s.items.length / funnelMax) * 100)}%`, height: '100%', borderRadius: 999, background: `linear-gradient(90deg, ${s.color}, ${s.color}99)` }} />
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', marginTop: 3 }}>{s.hint}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Sales */}
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 18, padding: '1.1rem 1.25rem', marginBottom: '1.25rem' }}>
            <div style={{ fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.9rem' }}>المبيعات (قيمة الطلبيات حسب أسعار الكتالوج)</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: '0.9rem' }}>
              <div style={{ padding: '0.8rem 1rem', borderRadius: 14, background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', fontWeight: 700 }}>قيمة المسلّمة</div>
                <div style={{ fontSize: '1.3rem', fontWeight: 900, color: '#10b981' }}>{stats.conv(stats.deliveredValue)} دج</div>
              </div>
              <div style={{ padding: '0.8rem 1rem', borderRadius: 14, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', fontWeight: 700 }}>في الطريق (قيد التوصيل)</div>
                <div style={{ fontSize: '1.3rem', fontWeight: 900, color: '#f59e0b' }}>{stats.conv(stats.pipelineValue)} دج</div>
              </div>
              <div style={{ padding: '0.8rem 1rem', borderRadius: 14, background: 'var(--veil-1)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', fontWeight: 700 }}>مسلّمة / مشحونة / ملغاة</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 900, color: 'var(--text-primary)' }}>
                  {stats.statusCounts.delivered} / {stats.statusCounts.shipped} / {stats.statusCounts.cancelled}
                </div>
              </div>
            </div>
            {stats.unpriced > 0 && (
              <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', marginBottom: '0.6rem' }}>
                ملاحظة: {stats.unpriced} طلبية لم يُحتسب ثمنها (لم يُطابق اسم منتجها مع الكتالوج).
              </div>
            )}
            {stats.topProducts.length > 0 && (
              <div>
                <div style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: 6 }}>الأكثر طلباً:</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {stats.topProducts.map(([name, count]) => (
                    <span key={name} style={{ fontSize: '0.75rem', padding: '0.3rem 0.7rem', borderRadius: 999, background: 'var(--veil-1)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', fontWeight: 700 }}>
                      {name} · {count}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Recovery harvest */}
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 18, padding: '1.1rem 1.25rem', marginBottom: '1.25rem' }}>
            <div style={{ fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.7rem' }}>حصاد الصمت — من عاد بعد الانقطاع؟</div>
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
              <span>عادوا بعد صمت ≥ ساعتين: <b style={{ color: '#fb923c' }}>{stats.conv(stats.returned.length)}</b></span>
              <span>منهم من طلب بعد عودته: <b style={{ color: '#10b981' }}>{stats.conv(stats.returnedBought.length)}</b></span>
              <span>نسبة الصيد: <b style={{ color: 'var(--text-primary)' }}>{stats.returned.length ? Math.round((stats.returnedBought.length / stats.returned.length) * 100) : 0}%</b></span>
            </div>
          </div>

          {/* Drop-off list */}
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 18, padding: '1.1rem 1.25rem' }}>
            <div style={{ fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.7rem' }}>
              سألوا ولم يطلبوا بعد ({stats.conv(stats.noOrder.length)}) — اصطادهم قبل أن يبرّدوا
            </div>
            {stats.noOrder.length === 0 ? (
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>كل من سأل في هذه الفترة أصبح له طلبية — أداء ممتاز</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {stats.noOrder.slice(0, 12).map(t => (
                  <div key={t.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', padding: '0.6rem 0.85rem', borderRadius: 12, background: 'var(--veil-1)', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontWeight: 800, fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                        {t.name}
                        {t.priceIntent && <span style={{ fontSize: '0.68rem', color: '#f59e0b', marginRight: 8, fontWeight: 800 }}>سأل عن السعر</span>}
                        {t.returns > 0 && <span style={{ fontSize: '0.68rem', color: '#38bdf8', marginRight: 8, fontWeight: 800 }}>عاد {t.returns} مرة</span>}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {t.lastContent || '—'} · {fmtTime(t.lastAt)} · {t.msgs.length} رسالة
                      </div>
                    </div>
                    <button
                      onClick={() => onOpenChat(t.id)}
                      className="btn btn-sm btn-primary"
                      style={{ borderRadius: 10, padding: '0.4rem 0.9rem', fontSize: '0.78rem', whiteSpace: 'nowrap' }}
                    >
                      افتح المحادثة
                    </button>
                  </div>
                ))}
                {stats.noOrder.length > 12 && (
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>و {stats.noOrder.length - 12} آخرون…</div>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
