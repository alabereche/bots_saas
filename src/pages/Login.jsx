import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { COUNTRIES } from '../data/countries';
import '../login-v2.css';

const DEMO_BOT_URL = 'https://t.me/Zcodybot';

/* ─── Bot-face logo mark (approved identity) ─── */
const BotMark = ({ size = 30 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <line x1="12" y1="4" x2="12" y2="7" stroke="#ffffff" strokeWidth="1.6" strokeLinecap="round"/>
    <circle cx="12" cy="3.4" r="1" fill="#ffffff"/>
    <rect x="4.5" y="7" width="15" height="12" rx="4" fill="#ffffff"/>
    <circle cx="9.4" cy="12.4" r="1.7" fill="#0b7d5e"/>
    <circle cx="14.6" cy="12.4" r="1.7" fill="#0b7d5e"/>
    <path d="M10.2 15.9c.7.6 2.9.6 3.6 0" stroke="#0b7d5e" strokeWidth="1.3" strokeLinecap="round"/>
  </svg>
);

export default function Login() {
  const navigate = useNavigate();
  const { loginWithGoogle, updateProfileData } = useAuth();
  const toast = useToast();

  const [googleLoading, setGoogleLoading] = useState(false);
  const [showCountryModal, setShowCountryModal] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState('DZ');
  const [phone, setPhone] = useState('');
  const [savingCountry, setSavingCountry] = useState(false);

  const countryObj = COUNTRIES.find(c => c.code === selectedCountry) || COUNTRIES[0];

  // "Back" from the login screen must be a deterministic exit: history.back()
  // usually lands on a protected page that instantly redirects here again,
  // which made the button look dead. Always exit to the landing page.
  const handleGoBack = () => {
    navigate('/', { replace: true });
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    try {
      const user = await loginWithGoogle();
      toast.success(`مرحباً بك ${user.displayName || ''}!`);
      navigate('/dashboard');
    } catch (err) {
      if (err.code !== 'auth/popup-closed-by-user') {
        toast.error(err.message || 'فشل تسجيل الدخول بحساب Google');
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleSaveCountry = async (e) => {
    e.preventDefault();
    setSavingCountry(true);
    try {
      await updateProfileData({
        country: selectedCountry,
        countryName: countryObj.name,
        currency: countryObj.currency,
        phoneCode: countryObj.dialCode,
        phone: phone.trim(),
        isOnboarded: true,
      });
      toast.success('تم حفظ بيانات الدولة بنجاح');
      navigate('/dashboard');
    } catch (err) {
      toast.error('فشل حفظ البيانات: ' + err.message);
    } finally {
      setSavingCountry(false);
    }
  };

  return (
    <div className="lg2-root">
      {/* Floating back button */}
      <button type="button" className="back-fab" onClick={handleGoBack} aria-label="الرجوع للصفحة السابقة">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="5" y1="12" x2="19" y2="12"/>
          <polyline points="12 5 19 12 12 19"/>
        </svg>
        <span>رجوع</span>
      </button>

      <div className="lg2-frame">
        {/* ─── Visual panel — the emerald story ─── */}
        <section className="lg2-visual">
          <div className="lg2-visual-noise" aria-hidden="true" />

          <span className="lg2-badge">
            <span className="lg2-badge-dot" />
            نظام أتمتة التجارة بالذكاء الاصطناعي
          </span>

          <h1 className="lg2-visual-title">
            متجرك يبيع ويرد على زبائنه
            <span className="lg2-visual-accent">
              {' '}حتى وأنت نايم.
              <svg className="lg2-squiggle" viewBox="0 0 220 12" fill="none" preserveAspectRatio="none" aria-hidden="true">
                <path d="M3 8.5C40 3.5 90 2.5 130 5c30 1.8 55 3.5 87 2" stroke="#04120c" strokeWidth="4" strokeLinecap="round" opacity="0.55"/>
              </svg>
            </span>
          </h1>

          <p className="lg2-visual-sub">
            مساعد مبيعات ذكي يفهم الدارجة، يعرض منتجاتك بالصور، يؤكد الطلبيات
            ويسجلها في لوحتك — وحده.
          </p>

          <div className="lg2-proof">
            <span className="lg2-proof-chip">⚡ رد خلال ثوانٍ</span>
            <span className="lg2-proof-chip">🔒 تشفير كامل عبر Firebase</span>
            <span className="lg2-proof-chip">📍 تغطية 58 ولاية</span>
          </div>

          <a className="lg2-demo-link" href={DEMO_BOT_URL} target="_blank" rel="noopener noreferrer">
            أو جرّب بوتاً حياً أولاً
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
            </svg>
          </a>
        </section>

        {/* ─── Form panel — the door ─── */}
        <aside className="lg2-formpanel">
          <div className="lg2-logo-row">
            <span className="lg2-logo-tile"><BotMark size={26} /></span>
            <span className="lg2-logo-name">Aura<span>Bot</span></span>
          </div>

          <h2 className="lg2-welcome">مرحباً بعودتك</h2>
          <p className="lg2-welcome-sub">سجّل دخولك لمتابعة بوتاتك ومبيعاتك لحظة بلحظة</p>

          <button type="button" className="lg2-google-btn" onClick={handleGoogleLogin} disabled={googleLoading}>
            {googleLoading ? (
              <span className="lg2-spin" />
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#EA4335" d="M12 5c1.7 0 3 .7 3.9 1.5l2.9-2.9C17 1.9 14.7 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.4 9 5 12 5z"/>
                <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.6h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.9z"/>
                <path fill="#FBBC05" d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.3s.2-1.6.4-2.3L1.9 7.3C.7 9.7 0 12.3 0 15.1s.7 5.4 1.9 7.8l3.7-3c-.2-.7-.4-1.5-.4-2.3z"/>
                <path fill="#34A853" d="M12 23.5c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.4-6.4-5.2L1.9 16.5C3.7 20.2 7.5 23.5 12 23.5z"/>
              </svg>
            )}
            <span>{googleLoading ? 'جاري تسجيل الدخول...' : 'المتابعة بحساب Google'}</span>
          </button>

          <p className="lg2-google-hint">بدون كلمات مرور • نقرة واحدة فقط</p>

          <div className="lg2-perks">
            <div className="lg2-perk">
              <span className="lg2-perk-ico">⚡</span>
              <span>دخول فوري بنقرة واحدة وبدون أي خطوات معقدة</span>
            </div>
            <div className="lg2-perk">
              <span className="lg2-perk-ico">💬</span>
              <span>ربط سريع ومباشر مع WhatsApp وتيليغرام</span>
            </div>
            <div className="lg2-perk">
              <span className="lg2-perk-ico">📦</span>
              <span>تسجيل وتأكيد الطلبيات تلقائياً على مدار الساعة</span>
            </div>
          </div>

          <div className="lg2-trust">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            <span>اتصال مشفر وآمن 100% بنظام Google Firebase</span>
          </div>
        </aside>
      </div>

      {/* Country Selection Modal (unchanged logic) */}
      {showCountryModal && (
        <div className="modal-overlay" onClick={() => !savingCountry && setShowCountryModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '440px' }}>
            <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
              <div style={{
                width: '44px', height: '44px', borderRadius: 'var(--radius-md)',
                background: 'var(--color-primary-subtle)', color: 'var(--color-primary-light)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 0.75rem'
              }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>
                </svg>
              </div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '0.25rem', color: 'var(--text-primary)' }}>أكمل إعداد حسابك</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>اختر دولتك لتخصيص العملة واللهجة المناسبة لنشاطك</p>
            </div>

            <form onSubmit={handleSaveCountry}>
              <div className="form-group">
                <label className="form-label">الدولة والعملة</label>
                <select className="form-select" value={selectedCountry} onChange={e => setSelectedCountry(e.target.value)}>
                  {COUNTRIES.map(c => (
                    <option key={c.code} value={c.code}>
                      {c.name} — العملة: {c.currency} ({c.currencyName})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">رقم الهاتف (اختياري)</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <div style={{
                    padding: '0.65rem 0.85rem',
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border-default)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--text-secondary)',
                    fontSize: '0.9rem',
                    direction: 'ltr',
                    display: 'flex',
                    alignItems: 'center'
                  }}>
                    {countryObj.dialCode}
                  </div>
                  <input
                    type="tel"
                    className="form-input"
                    placeholder="555 123 456"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    style={{ direction: 'ltr', textAlign: 'left', flex: 1 }}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={savingCountry}>
                  {savingCountry ? <span className="spinner" /> : 'حفظ ومتابعة للوحة التحكم'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
