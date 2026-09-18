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
  { key: 'bots', free: 'بوت واحد — واتساب أو تلغرام', pro: '5 واتساب + 8 تلغرام' },
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
  const [activationOk, setActivationOk] = useState(false);
  const [actUser, setActUser] = useState(null);      // { uid, email, displayName, plan }
  const [userQuery, setUserQuery] = useState('');
  const [usersList, setUsersList] = useState([]);
  const [actPlan, setActPlan] = useState('pro');
  const [actMonths, setActMonths] = useState('1');
  const [activating, setActivating] = useState(false);
  const [copiedUid, setCopiedUid] = useState(false);

  const loadPlan = async () => {
    try {
      const res = await fetch(`${ENGINE_URL}/api/billing/plan`, { headers: await engineHeaders(false) });
      if (res.ok) setPlanData(await res.json());
    } catch { /* engine unreachable — page still renders statically */ }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await loadPlan();
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  // Owner's directory for the activation panel
  useEffect(() => {
    if (!planData?.isAdmin) return;
    (async () => {
      try {
        const res = await fetch(`${ENGINE_URL}/api/billing/users`, { headers: await engineHeaders(false) });
        if (res.ok) setUsersList((await res.json()).users || []);
      } catch { /* list optional */ }
    })();
  }, [planData?.isAdmin]);

  const plan = planData?.plan || 'free';
  const limits = planData?.limits || null;
  const totalToday = (planData?.usage || []).reduce((s, u) => s + (u.messagesToday || 0), 0);

  const filteredUsers = userQuery.trim()
    ? usersList.filter(u =>
        (u.email || '').toLowerCase().includes(userQuery.toLowerCase()) ||
        (u.displayName || '').includes(userQuery))
    : usersList.slice(0, 8);

  const copyUid = async () => {
    try {
      await navigator.clipboard.writeText(planData?.uid || '');
      setCopiedUid(true);
      setTimeout(() => setCopiedUid(false), 1600);
    } catch { /* clipboard denied */ }
  };

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
    if (!actUser?.uid) {
      setActivationMsg('اختر مستخدماً من القائمة أولاً');
      setActivationOk(false);
      return;
    }
    setActivating(true);
    setActivationMsg('');
    setActivationOk(false);
    try {
      const res = await fetch(`${ENGINE_URL}/api/billing/activate`, {
        method: 'POST',
        headers: await engineHeaders(),
        body: JSON.stringify({ uid: actUser.uid, plan: actPlan, months: actPlan === 'pro' ? Number(actMonths) || 0 : 0 }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setActivationOk(true);
        setActivationMsg(`تم: ${actUser.email || actUser.uid} أصبح على باقة ${actPlan === 'pro' ? 'الاحترافية' : 'المجانية'}`);
        await loadPlan(); // live refresh — the badges move immediately
      } else {
        setActivationMsg(data.error || 'فشل التفعيل');
      }
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
              {totalToday} من {limits.dailyMessages}
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.9rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
              تفعيل يدوي — للمالك فقط
            </h3>
            <button
              type="button"
              onClick={copyUid}
              title="نسخ معرفك الشخصي"
              style={{
                background: 'var(--bg-cell)', border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-full)', color: 'var(--text-secondary)',
                fontSize: '0.72rem', padding: '4px 12px', cursor: 'pointer', direction: 'ltr',
              }}
            >
              {copiedUid ? 'تم النسخ' : `uid: ${(planData?.uid || '').slice(0, 12)}...`}
            </button>
          </div>

          <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <div style={{ flex: '1 1 300px', position: 'relative' }}>
              <input
                className="form-input"
                placeholder="ابحث بإيميل أو اسم التاجر..."
                value={userQuery}
                onChange={e => { setUserQuery(e.target.value); setActUser(null); }}
                style={{ width: '100%' }}
              />
              {userQuery.trim() && !actUser && (
                <div style={{
                  position: 'absolute', top: 'calc(100% + 4px)', right: 0, left: 0,
                  background: 'var(--bg-cell)', border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-md, 10px)', zIndex: 20,
                  maxHeight: '220px', overflowY: 'auto',
                  boxShadow: '0 14px 40px -12px rgba(0,0,0,0.5)',
                }}>
                  {filteredUsers.length === 0 && (
                    <div style={{ padding: '0.6rem 0.9rem', fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
                      لا نتائج مطابقة
                    </div>
                  )}
                  {filteredUsers.map(u => (
                    <button
                      key={u.uid}
                      type="button"
                      onClick={() => { setActUser(u); setUserQuery(u.email || u.displayName || u.uid); }}
                      style={{
                        display: 'block', width: '100%', textAlign: 'right',
                        padding: '0.55rem 0.9rem', background: 'transparent', border: 'none',
                        borderBottom: '1px solid var(--border-subtle)', cursor: 'pointer',
                        color: 'var(--text-primary)', fontSize: '0.85rem',
                      }}
                    >
                      <span style={{ fontWeight: 700 }}>{u.email || u.uid}</span>
                      {u.displayName && <span style={{ color: 'var(--text-secondary)' }}> — {u.displayName}</span>}
                      <span style={{
                        marginRight: '8px', fontSize: '0.7rem', fontWeight: 800,
                        color: u.plan === 'pro' ? 'var(--color-primary-light)' : 'var(--text-secondary)',
                      }}>
                        {u.plan === 'pro' ? 'احترافية' : 'مجانية'}
                      </span>
                    </button>
                  ))}
                </div>
              )}
              {actUser && (
                <p style={{ margin: '0.4rem 0 0', fontSize: '0.78rem', color: 'var(--color-primary-light)', direction: 'ltr', textAlign: 'left' }}>
                  {actUser.email || actUser.uid}
                </p>
              )}
            </div>
            <div style={{ display: 'flex', gap: '0', borderRadius: 'var(--radius-md, 10px)', border: '1px solid var(--border-default)', overflow: 'hidden' }}>
              {[['pro', 'احترافية'], ['free', 'مجانية']].map(([val, label]) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setActPlan(val)}
                  style={{
                    padding: '0.55rem 1rem', fontSize: '0.84rem', fontWeight: 700,
                    border: 'none', cursor: 'pointer',
                    background: actPlan === val ? 'var(--color-primary)' : 'var(--bg-cell)',
                    color: actPlan === val ? '#05130d' : 'var(--text-secondary)',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            {actPlan === 'pro' && (
              <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                {[['1', 'شهر'], ['3', '3 أشهر'], ['6', '6 أشهر'], ['12', 'سنة'], ['0', 'بلا انتهاء']].map(([val, label]) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setActMonths(val)}
                    style={{
                      padding: '0.5rem 0.85rem', fontSize: '0.8rem', fontWeight: 700,
                      borderRadius: 'var(--radius-full)', cursor: 'pointer',
                      border: actMonths === val ? '1px solid var(--color-primary)' : '1px solid var(--border-default)',
                      background: actMonths === val ? 'rgba(16, 185, 129, 0.14)' : 'var(--bg-cell)',
                      color: actMonths === val ? 'var(--color-primary-light)' : 'var(--text-secondary)',
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
            <button className="btn btn-primary" onClick={activate} disabled={activating || !actUser}>
              {activating ? 'جارٍ...' : 'تفعيل'}
            </button>
          </div>
          {activationMsg && (
            <p style={{
              margin: '0.8rem 0 0', fontSize: '0.86rem', fontWeight: activationOk ? 800 : 400,
              color: activationOk ? 'var(--color-primary-light)' : '#ef4444',
              background: activationOk ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)',
              border: `1px solid ${activationOk ? 'rgba(16, 185, 129, 0.35)' : 'rgba(239, 68, 68, 0.35)'}`,
              borderRadius: 'var(--radius-md, 10px)', padding: '0.55rem 0.9rem',
            }}>
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
