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

  // ─── Summary exports ───
  // CRITICAL: the funnel stages live in `funnelStages` (component scope),
  // NOT inside stats — referencing stats.funnel here threw and silently
  // killed the whole download. Stages are rebuilt from stats fields below.

  const esc = (s) => String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const stageDefs = [
    { label: 'سألوا البوت', count: stats.asked.length, color: '#10b981', items: stats.asked },
    { label: 'سألوا عن السعر', count: stats.askedPrice.length, color: '#34d399', items: stats.askedPrice },
    { label: 'طلبوا فعلاً', count: stats.ordered.length, color: '#f59e0b', items: stats.ordered },
    { label: 'وصلت طلبياتهم', count: stats.delivered.length, color: '#38bdf8', items: stats.delivered },
  ];
  const periodLabel = PERIODS.find(p => p.key === period)?.label || '';
  const generatedAt = new Date().toLocaleString('ar-DZ');
  const reportTitle = `تقرير تحليلات — ${bot?.botName || 'البوت'}`;

  const buildSummaryHtml = () => {
    const funnelMax = Math.max(1, ...stageDefs.map(s => s.count));
    const funnelHtml = stageDefs.map((s, i) => {
      const prev = i > 0 ? stageDefs[i - 1].count : null;
      const pct = i > 0 && prev ? Math.round((s.count / prev) * 100) : null;
      return `<div class="stage">
        <div class="stage-head"><span class="stage-label">${esc(s.label)}</span>
        <span class="stage-num"><b>${stats.conv(s.count)}</b>${pct !== null ? ` <span class="pct">· ${pct}% من السابق</span>` : ''}</span></div>
        <div class="bar"><div class="fill" style="width:${Math.max(2, (s.count / funnelMax) * 100)}%;background:linear-gradient(90deg,${s.color},${s.color}99)"></div></div>
      </div>`;
    }).join('');

    const kpiHtml = [
      ['زبائن تفاعلوا', stats.conv(stats.asked.length), '#10b981'],
      ['رسائل زبائن', stats.conv(stats.customerMsgs), '#34d399'],
      ['ردود البوت', stats.conv(stats.botReplies), '#38bdf8'],
      ['طلبيات', stats.conv(stats.periodOrders.length), '#f59e0b'],
      ['نسبة الإغلاق', stats.closingRate + '%', '#a78bfa'],
      ['عادوا بعد صمت', stats.conv(stats.returned.length), '#fb923c'],
    ].map(([l, v, c]) => `<div class="kpi"><div class="kpi-l">${esc(l)}</div><div class="kpi-v" style="color:${c}">${esc(v)}</div></div>`).join('');

    const productsHtml = stats.topProducts.length
      ? `<div class="chips">${stats.topProducts.map(([n, c]) => `<span class="chip">${esc(n)} · ${c}</span>`).join('')}</div>`
      : '<div class="muted">لا طلبيات في هذه الفترة</div>';

    const noOrderRows = stats.noOrder.slice(0, 30).map(t => `<tr>
      <td><b>${esc(t.name)}</b>${t.priceIntent ? ' <span class="tag">سأل عن السعر</span>' : ''}${t.returns > 0 ? ` <span class="tag tag-blue">عاد ${t.returns} مرة</span>` : ''}</td>
      <td>${esc(t.lastContent)}</td>
      <td>${t.msgs.length}</td>
      <td>${esc(fmtTime(t.lastAt))}</td>
    </tr>`).join('');

    return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8">
<title>${esc(reportTitle)}</title>
<link href="https://fonts.googleapis.com/css2?family=Almarai:wght@400;700;800&display=swap" rel="stylesheet">
<style>
  *{box-sizing:border-box}
  body{background:#0a0a09;color:#f3f0e8;font-family:'Almarai',system-ui,sans-serif;margin:0;padding:32px 16px}
  .wrap{max-width:860px;margin:0 auto}
  .brand{display:flex;align-items:center;gap:10px;margin-bottom:6px}
  .brand-dot{width:12px;height:12px;border-radius:50%;background:#10b981;box-shadow:0 0 12px rgba(16,185,129,.7)}
  .brand b{font-size:.95rem;letter-spacing:.5px}
  h1{font-size:1.5rem;margin:0 0 4px}
  .meta{color:#8a8778;font-size:.8rem;margin-bottom:26px}
  .card{background:#111110;border:1px solid rgba(255,255,255,.08);border-radius:18px;padding:20px 22px;margin-bottom:18px}
  .card h2{font-size:1rem;margin:0 0 14px}
  .kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;margin-bottom:18px}
  .kpi{background:#111110;border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:14px 16px}
  .kpi-l{font-size:.72rem;color:#8a8778;font-weight:700;margin-bottom:4px}
  .kpi-v{font-size:1.4rem;font-weight:900}
  .stage{margin-bottom:14px}
  .stage-head{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:5px}
  .stage-label{font-size:.86rem;font-weight:800}
  .stage-num b{font-size:.98rem}
  .pct{color:#8a8778;font-size:.76rem}
  .bar{height:12px;background:rgba(255,255,255,.04);border-radius:999px;overflow:hidden}
  .fill{height:100%;border-radius:999px}
  .grid3{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-bottom:14px}
  .sale{padding:12px 16px;border-radius:14px}
  .sale-l{font-size:.7rem;color:#8a8778;font-weight:700;margin-bottom:3px}
  .sale-v{font-size:1.25rem;font-weight:900}
  .sale-g{background:rgba(16,185,129,.1);border:1px solid rgba(16,185,129,.3)} .sale-g .sale-v{color:#10b981}
  .sale-o{background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.3)} .sale-o .sale-v{color:#f59e0b}
  .sale-n{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08)} .sale-n .sale-v{color:#f3f0e8;font-size:1rem;padding-top:6px}
  .chips{display:flex;flex-wrap:wrap;gap:6px}
  .chip{font-size:.75rem;padding:5px 12px;border-radius:999px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);font-weight:700}
  .line{font-size:.88rem;color:#b8b4a8;display:flex;gap:22px;flex-wrap:wrap}
  .line b{color:#f3f0e8}
  table{width:100%;border-collapse:collapse;font-size:.82rem}
  th{color:#8a8778;font-size:.72rem;text-align:right;padding:8px 10px;border-bottom:1px solid rgba(255,255,255,.1)}
  td{padding:9px 10px;border-bottom:1px solid rgba(255,255,255,.05);vertical-align:top}
  .tag{font-size:.66rem;color:#f59e0b;font-weight:800;margin-right:6px}
  .tag-blue{color:#38bdf8}
  .muted{color:#8a8778;font-size:.85rem}
  .foot{color:#8a8778;font-size:.72rem;text-align:center;margin-top:26px}
  .foot b{color:#10b981}
  @media print{ body{background:#fff;color:#111} .card,.kpi{background:#fafafa;border-color:#ddd} .kpi-l,.pct,.meta,.muted,th,.foot,.line{color:#555} .brand b,.foot b{color:#111} .sale-n .sale-v{color:#111} }
</style></head><body><div class="wrap">
  <div class="brand"><span class="brand-dot"></span><b>AuraBot Analytics</b></div>
  <h1>${esc(reportTitle)}</h1>
  <div class="meta">الفترة: ${esc(periodLabel)} · أُنشئ التقرير في ${esc(generatedAt)}</div>
  <div class="kpis">${kpiHtml}</div>
  <div class="card"><h2>قمع البيع — أين توقفوا؟</h2>${funnelHtml}</div>
  <div class="card"><h2>المبيعات (قيمة الطلبيات حسب أسعار الكتالوج)</h2>
    <div class="grid3">
      <div class="sale sale-g"><div class="sale-l">قيمة المسلّمة</div><div class="sale-v">${stats.conv(stats.deliveredValue)} دج</div></div>
      <div class="sale sale-o"><div class="sale-l">في الطريق (قيد التوصيل)</div><div class="sale-v">${stats.conv(stats.pipelineValue)} دج</div></div>
      <div class="sale sale-n" style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;text-align:center">
        <div><div class="sale-l">مسلّمة</div><div class="sale-v" style="color:#10b981;font-size:1.15rem;padding-top:2px">${stats.statusCounts.delivered}</div></div>
        <div style="border-right:1px solid rgba(255,255,255,.08);border-left:1px solid rgba(255,255,255,.08)"><div class="sale-l">مشحونة</div><div class="sale-v" style="color:#f59e0b;font-size:1.15rem;padding-top:2px">${stats.statusCounts.shipped}</div></div>
        <div><div class="sale-l">ملغاة</div><div class="sale-v" style="color:#ef4444;font-size:1.15rem;padding-top:2px">${stats.statusCounts.cancelled}</div></div>
      </div>
    </div>
    <div class="sale-l" style="margin-bottom:6px">الأكثر طلباً:</div>${productsHtml}
  </div>
  <div class="card"><h2>حصاد الصمت — من عاد بعد الانقطاع؟</h2>
    <div class="line"><span>عادوا بعد صمت ≥ ساعتين: <b>${stats.conv(stats.returned.length)}</b></span><span>منهم من طلب بعد عودته: <b>${stats.conv(stats.returnedBought.length)}</b></span><span>نسبة الصيد: <b>${stats.returned.length ? Math.round((stats.returnedBought.length / stats.returned.length) * 100) : 0}%</b></span></div>
  </div>
  <div class="card"><h2>سألوا ولم يطلبوا بعد (${stats.noOrder.length})</h2>
    ${stats.noOrder.length === 0 ? '<div class="muted">كل من سأل في هذه الفترة أصبح له طلبية — أداء ممتاز.</div>' :
    `<table><thead><tr><th>الزبون</th><th>آخر رسالة</th><th>رسائل</th><th>آخر نشاط</th></tr></thead><tbody>${noOrderRows}</tbody></table>`}
  </div>
  <div class="foot">أُنشئ هذا التقرير تلقائياً بواسطة <b>AuraBot</b> — بائعك الآلي الذي لا ينام</div>
</div></body></html>`;
  };

  const downloadFile = (content, filename, mime) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  };

  const stamp = `${period}-${new Date().toISOString().slice(0, 10)}`;
  const botSlug = String(bot?.botName || 'bot').replace(/[^\p{L}\p{N}]+/gu, '-').slice(0, 30);

  const downloadHtmlReport = () => {
    downloadFile(buildSummaryHtml(), `botforge-report-${botSlug}-${stamp}.html`, 'text/html;charset=utf-8;');
  };

  const downloadCsv = () => {
    const stages = stageDefs.map(s => [s.label, s.count]);
    const rows = [['القسم', 'البند', 'القيمة']];
    rows.push(['مؤشرات', 'زبائن تفاعلوا', stats.asked.length]);
    rows.push(['مؤشرات', 'رسائل زبائن', stats.customerMsgs]);
    rows.push(['مؤشرات', 'ردود البوت', stats.botReplies]);
    rows.push(['مؤشرات', 'طلبيات', stats.periodOrders.length]);
    rows.push(['مؤشرات', 'نسبة الإغلاق %', stats.closingRate]);
    stages.forEach(([label, count], i) => {
      rows.push(['قمع البيع', label, count]);
      if (i > 0 && stages[i - 1][1]) {
        rows.push(['قمع البيع', `${label} — نسبة التحويل %`, Math.round((count / stages[i - 1][1]) * 100)]);
      }
    });
    rows.push(['المبيعات', 'قيمة الطلبيات المسلّمة (دج)', stats.deliveredValue]);
    rows.push(['المبيعات', 'قيمة الطلبيات في الطريق (دج)', stats.pipelineValue]);
    rows.push(['المبيعات', 'مسلّمة', stats.statusCounts.delivered]);
    rows.push(['المبيعات', 'مشحونة', stats.statusCounts.shipped]);
    rows.push(['المبيعات', 'ملغاة', stats.statusCounts.cancelled]);
    stats.topProducts.forEach(([name, count]) => rows.push(['الأكثر طلباً', name, count]));
    rows.push(['حصاد الصمت', 'عادوا بعد صمت >= ساعتين', stats.returned.length]);
    rows.push(['حصاد الصمت', 'طلبوا بعد العودة', stats.returnedBought.length]);
    stats.noOrder.forEach(t => {
      rows.push(['سألوا ولم يطلبوا', `${t.name} (${t.id})`, `آخر رسالة: ${t.lastContent} | ${fmtTime(t.lastAt)} | ${t.msgs.length} رسالة`]);
    });

    const csv = '\uFEFF' + rows
      .map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))
      .join('\r\n');
    downloadFile(csv, `botforge-analytics-${botSlug}-${stamp}.csv`, 'text/csv;charset=utf-8;');
  };

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
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
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
          <button
            onClick={downloadHtmlReport}
            className="btn btn-sm btn-primary"
            style={{ borderRadius: '999px', padding: '0.4rem 1rem', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: 6 }}
            title="تحميل تقرير كامل أنيق — يفتح بالمتصفح ويُطبع PDF"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            تحميل الملخص
          </button>
          <button
            onClick={downloadCsv}
            className="btn btn-sm btn-secondary"
            style={{ borderRadius: '999px', padding: '0.4rem 0.9rem', fontSize: '0.78rem' }}
            title="تصدير البيانات الخام إلى CSV يفتح في Excel"
          >
            CSV
          </button>
        </div>
      </div>

      {stats.asked.length === 0 && stats.periodOrders.length === 0 ? (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 18, padding: '4rem 1.5rem', textAlign: 'center' }}>
          <div style={{ width: 64, height: 64, borderRadius: 18, background: 'var(--veil-1)', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="20" x2="18" y2="10"/>
              <line x1="12" y1="20" x2="12" y2="4"/>
              <line x1="6" y1="20" x2="6" y2="14"/>
            </svg>
          </div>
          <div style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '1.05rem', marginBottom: '0.4rem' }}>لا توجد بيانات في هذه الفترة</div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', maxWidth: 420, margin: '0 auto', lineHeight: 1.6 }}>
            جرّب مدى زمنياً أوسع — أو انتظر أول محادثة، والأرقام ستُبنى هنا تلقائياً مع كل تفاعل.
          </div>
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
              <div style={{ padding: '0.8rem 1rem', borderRadius: 14, background: 'var(--veil-1)', border: '1px solid var(--border-subtle)', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, textAlign: 'center' }}>
                <div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)', fontWeight: 700, marginBottom: 3 }}>مسلّمة</div>
                  <div style={{ fontSize: '1.15rem', fontWeight: 900, color: '#10b981' }}>{stats.statusCounts.delivered}</div>
                </div>
                <div style={{ borderRight: '1px solid var(--border-subtle)', borderLeft: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)', fontWeight: 700, marginBottom: 3 }}>مشحونة</div>
                  <div style={{ fontSize: '1.15rem', fontWeight: 900, color: '#f59e0b' }}>{stats.statusCounts.shipped}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)', fontWeight: 700, marginBottom: 3 }}>ملغاة</div>
                  <div style={{ fontSize: '1.15rem', fontWeight: 900, color: '#ef4444' }}>{stats.statusCounts.cancelled}</div>
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
