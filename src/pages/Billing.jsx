import { useEffect, useState } from 'react';
import { auth } from '../services/firebase';
import { BILLING_CONTACT, PRICING } from '../config/billing';

const ENGINE_URL = import.meta.env.VITE_WHATSAPP_ENGINE_URL || 'https://wa.nosfir.online';

async function engineHeaders(json = true) {
  const token = await auth.currentUser?.getIdToken();
  const headers = { Authorization: `Bearer ${token || ''}` };
  if (json) headers['Content-Type'] = 'application/json';
  return headers;
}

const FEATURE_ROWS = [
  { key: 'bots', free: '1 واتساب + 3 تلغرام', pro: '5 واتساب + 10 تلغرام' },
  { key: 'channels', free: 'قناة واحدة لكل بوت', pro: 'واتساب وتلغرام معاً' },
  { key: 'dailyMessages', free: '50 رسالة يومياً', pro: '500 رسالة يومياً' },
  { key: 'products', free: '10 منتجات في الكتالوج', pro: '500 منتج' },
  { key: 'recovery', free: 'تذكير واحد للمتروك', pro: 'حتى 3 تذكيرات + نص مخصص' },
  { key: 'widget', free: 'نعم — مع شارة BotForge', pro: 'نعم — بلا شارة' },
  { key: 'sheets', free: false, pro: true, label: 'مزامنة Google Sheets' },
  { key: 'delivery', free: false, pro: true, label: 'ربط شركات التوصيل (يال الدين، ZR)' },
  { key: 'analytics', free: false, pro: true, label: 'التحليلات وتصدير التقارير' },
];

function Check() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function Cross() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary, #7a8596)" strokeWidth="2.2" strokeLinecap="round" style={{ flexShrink: 0, opacity: 0.6 }}>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function PlanCard({ pro, current, children }) {
  return (
    <div
      className="card"
      style={{
        flex: '1 1 320px',
        padding: '1.75rem',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        border: current
          ? '1.5px solid var(--color-primary)'
          : pro
            ? '1px solid rgba(16, 185, 129, 0.4)'
            : '1px solid var(--border-default)',
        boxShadow: pro && !current ? '0 0 0 1px rgba(16, 185, 129, 0.12), 0 12px 40px -18px rgba(16, 185, 129, 0.25)' : 'none',
      }}
    >
      {current && (
        <span style={{
          position: 'absolute', top: '-11px', right: '18px',
          background: 'var(--color-primary)', color: '#05130d',
          fontSize: '0.72rem', fontWeight: 800, padding: '3px 12px',
          borderRadius: 'var(--radius-full)', letterSpacing: '0.02em',
        }}>
          باقتك الحالية
        </span>
      )}
      {pro && !current && (
        <span style={{
          position: 'absolute', top: '-11px', right: '18px',
          background: 'var(--bg-cell)', color: 'var(--color-primary-light)',
          fontSize: '0.72rem', fontWeight: 800, padding: '3px 12px',
          borderRadius: 'var(--radius-full)', border: '1px solid rgba(16, 185, 129, 0.5)',
        }}>
          الأكثر قيمة
        </span>
      )}
      {children}
    </div>
  );
}

export default function Billing() {
  const [planData, setPlanData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activationMsg, setActivationMsg] = useState('');
  const [actUid, setActUid] = useState('');
  const [actPlan, setActPlan] = useState('pro');
  const [actMonths, setActMonths] = useState('1');
  const [activating, setActivating] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${ENGINE_URL}/api/billing/plan`, { headers: await engineHeaders(false) });
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) setPlanData(data);
        }
      } catch { /* engine unreachable — page still renders statically */ }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const plan = planData?.plan || 'free';
  const limits = planData?.limits || null;
  const totalToday = (planData?.usage || []).reduce((s, u) => s + (u.messagesToday || 0), 0);

  const subscribe = () => {
    const email = auth.currentUser?.email || '';
    const text = encodeURIComponent(
      `مرحباً، أريد الترقية إلى الباقة الاحترافية في BotForge.\nحسابي: ${email}`
    );
    window.open(`https://wa.me/${BILLING_CONTACT.whatsappNumber}?text=${text}`, '_blank');
  };

  const subscribeTg = () => {
    const email = auth.currentUser?.email || '';
    const text = encodeURIComponent(`مرحباً، أريد الترقية إلى الباقة الاحترافية في BotForge. حسابي: ${email}`);
    window.open(`https://t.me/${BILLING_CONTACT.telegramUsername}?text=${text}`, '_blank');
  };

  const activate = async () => {
    if (!actUid.trim()) {
      setActivationMsg('أدخل uid المستخدم أولاً');
      return;
    }
    setActivating(true);
    setActivationMsg('');
    try {
      const res = await fetch(`${ENGINE_URL}/api/billing/activate`, {
        method: 'POST',
        headers: await engineHeaders(),
        body: JSON.stringify({ uid: actUid.trim(), plan: actPlan, months: actPlan === 'pro' ? Number(actMonths) || 0 : 0 }),
      });
      const data = await res.json().catch(() => ({}));
      setActivationMsg(res.ok ? `تم: ${actUid.trim()} أصبح على ${actPlan}` : (data.error || 'فشل التفعيل'));
    } catch (e) {
      setActivationMsg('تعذر الاتصال بالمحرك: ' + e.message);
    } finally {
      setActivating(false);
    }
  };

  const usagePct = limits ? Math.min(100, Math.round((totalToday / limits.dailyMessages) * 100)) : 0;

  return (
    <div className="page-container" style={{ maxWidth: '900px', margin: '0 auto', paddingBottom: '3rem' }}>
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.4rem' }}>
          الاشتراكات والخطط
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem' }}>
          اختر ما يناسب حجم عملك — وارقِ متى كبرت
        </p>
      </div>

      {/* Usage meter */}
      {limits && (
        <div className="card" style={{ padding: '1.15rem 1.4rem', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
            <span style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              رسائل اليوم عبر بوتاتك
            </span>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
              {totalToday} / {limits.dailyMessages}
            </span>
          </div>
          <div style={{ height: '8px', borderRadius: 'var(--radius-full)', background: 'var(--bg-cell)', border: '1px solid var(--border-subtle)', overflow: 'hidden' }}>
            <div style={{
              height: '100%', width: `${usagePct}%`,
              background: usagePct >= 90 ? '#ef4444' : 'var(--color-primary)',
              borderRadius: 'var(--radius-full)',
              transition: 'width 0.4s ease',
            }} />
          </div>
          {planData?.planExpiresAt && plan === 'pro' && (
            <p style={{ margin: '0.6rem 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              اشتراكك الاحترافي ساري حتى {new Date(planData.planExpiresAt).toLocaleDateString('ar-DZ')}
            </p>
          )}
        </div>
      )}

      {/* Plans */}
      <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap', alignItems: 'stretch', marginTop: '0.75rem' }}>
        <PlanCard pro={false} current={plan === 'free'}>
          <div>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>المجانية</h2>
            <div style={{ marginTop: '0.35rem' }}>
              <span style={{ fontSize: '1.9rem', fontWeight: 800, color: 'var(--text-primary)' }}>0 دج</span>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginRight: '6px' }}>للأبد</span>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem', fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
            {FEATURE_ROWS.map(row => (
              <div key={row.key} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                {row.free ? <Check /> : <Cross />}
                <span>{row.label || row.free}</span>
              </div>
            ))}
          </div>
          <button className="btn btn-secondary btn-lg" disabled style={{ marginTop: 'auto', width: '100%' }}>
            {plan === 'free' ? 'باقتك الحالية' : 'الخطة المجانية'}
          </button>
        </PlanCard>

        <PlanCard pro current={plan === 'pro'}>
          <div>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--color-primary-light)', margin: 0 }}>الاحترافية</h2>
            <div style={{ marginTop: '0.35rem' }}>
              <span style={{ fontSize: '1.9rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                {PRICING.pro.amountDZD} دج
              </span>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginRight: '6px' }}>{PRICING.pro.period}</span>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem', fontSize: '0.88rem', color: 'var(--text-primary)' }}>
            {FEATURE_ROWS.map(row => (
              <div key={row.key} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                <Check />
                <span>{row.label || row.pro}</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
            {plan === 'pro' ? (
              <button className="btn btn-primary btn-lg" disabled style={{ width: '100%' }}>باقتك الحالية</button>
            ) : (
              <>
                <button className="btn btn-primary btn-lg" onClick={subscribe} style={{ width: '100%' }}>
                  اشترك الآن — عبر واتساب
                </button>
                <button className="btn btn-secondary" onClick={subscribeTg} style={{ width: '100%' }}>
                  أو عبر تلغرام
                </button>
              </>
            )}
          </div>
        </PlanCard>
      </div>

      <p style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.82rem', marginTop: '1.5rem', lineHeight: 1.7 }}>
        الدفع بتحويل بريدي موب أو الذهبية داخل المحادثة — يُفعَّل حسابك يدوياً بعد تأكيد التحويل مباشرة.
      </p>

      {/* Owner-only manual activation */}
      {planData?.isAdmin && (
        <div className="card" style={{ padding: '1.4rem', marginTop: '2rem', borderColor: 'rgba(16, 185, 129, 0.35)' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 0.9rem' }}>
            تفعيل يدوي — للمالك فقط
          </h3>
          <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              className="form-input"
              placeholder="uid المستخدم"
              value={actUid}
              onChange={e => setActUid(e.target.value)}
              style={{ flex: '1 1 260px', direction: 'ltr', fontSize: '0.85rem' }}
            />
            <select className="form-select" value={actPlan} onChange={e => setActPlan(e.target.value)} style={{ width: 'auto' }}>
              <option value="pro">احترافية</option>
              <option value="free">مجانية (إلغاء)</option>
            </select>
            {actPlan === 'pro' && (
              <select className="form-select" value={actMonths} onChange={e => setActMonths(e.target.value)} style={{ width: 'auto' }}>
                <option value="1">شهر</option>
                <option value="3">3 أشهر</option>
                <option value="6">6 أشهر</option>
                <option value="12">سنة</option>
                <option value="0">بلا انتهاء</option>
              </select>
            )}
            <button className="btn btn-primary" onClick={activate} disabled={activating}>
              {activating ? 'جارٍ...' : 'تفعيل'}
            </button>
          </div>
          {activationMsg && (
            <p style={{ margin: '0.7rem 0 0', fontSize: '0.84rem', color: activationMsg.startsWith('تم') ? 'var(--color-primary-light)' : '#ef4444' }}>
              {activationMsg}
            </p>
          )}
        </div>
      )}

      {loading && (
        <p style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
          جارٍ جلب حالة اشتراكك...
        </p>
      )}
    </div>
  );
}
