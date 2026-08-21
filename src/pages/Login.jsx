import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { COUNTRIES } from '../data/countries';
import ShowcaseJourney from '../components/ShowcaseJourney';
import ModernBackground from '../components/ModernBackground';

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

  const handleGoBack = () => {
    if (window.history.state && window.history.state.idx > 0) {
      navigate(-1);
    } else {
      navigate('/');
    }
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
    <div className="login-shell">
      <ModernBackground />

      {/* Ambient aurora orbs for cinematic depth */}
      <div className="login-atmosphere" aria-hidden="true">
        <div className="atmosphere-orb orb-emerald-main" />
        <div className="atmosphere-orb orb-sky-side" />
      </div>

      {/* Floating back button (RTL arrow points right) */}
      <button
        type="button"
        className="back-fab reveal-up"
        style={{ '--d': '0s' }}
        onClick={handleGoBack}
        aria-label="الرجوع للصفحة السابقة"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="5" y1="12" x2="19" y2="12"/>
          <polyline points="12 5 19 12 12 19"/>
        </svg>
        <span>رجوع</span>
      </button>

      <div className="login-stage">

        {/* ─── Story / Showcase Side ─── */}
        <section className="login-showcase">
          <div className="sc-badge reveal-up" style={{ '--d': '0.05s' }}>
            <span className="badge-pulse" />
            <span>نظام أتمتة التجارة بالذكاء الاصطناعي</span>
          </div>

          <h1 className="sc-title reveal-up" style={{ '--d': '0.12s' }}>
            من فكرة المتجر إلى <span className="highlight-emerald">مبيعات آلية 24/7</span> في 4 خطوات
          </h1>

          <p className="sc-desc reveal-up" style={{ '--d': '0.2s' }}>
            شاهد كيف يعمل النظام: إعداد في دقيقة، ربط فوري عبر QR، رد ذكي بالدارجة، وتسجيل تلقائي للطلبيات في لوحة التحكم.
          </p>

          <div className="reveal-up" style={{ '--d': '0.28s', width: '100%', display: 'flex', justifyContent: 'center' }}>
            <div style={{ width: '100%', maxWidth: '640px' }}>
              <ShowcaseJourney />
            </div>
          </div>

          <div className="sc-proof-row reveal-up" style={{ '--d': '0.36s' }}>
            <div className="proof-chip">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
              </svg>
              <span>رد خلال 0.8 ثانية</span>
            </div>
            <div className="proof-chip">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              <span>تشفير كامل عبر Firebase</span>
            </div>
            <div className="proof-chip">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
              </svg>
              <span>تغطية 58 ولاية</span>
            </div>
          </div>
        </section>

        {/* ─── Login Card with Rotating Aurora Frame ─── */}
        <aside className="login-panel">
          <div className="login-card-v2 reveal-up" style={{ '--d': '0.08s' }}>
            <div className="card-spin-frame" aria-hidden="true" />

            <div className="login-card-body">
              <div className="brand-mark reveal-up" style={{ '--d': '0.18s' }}>
                <svg width="34" height="34" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="9" stroke="url(#auraLoginRing)" strokeWidth="1.8" strokeDasharray="2.5 2.5"/>
                  <path d="M12 4.5L14.2 9.8L19.5 12L14.2 14.2L12 19.5L9.8 14.2L4.5 12L9.8 9.8L12 4.5Z" fill="url(#auraLoginSpark)"/>
                  <defs>
                    <linearGradient id="auraLoginRing" x1="0" y1="0" x2="24" y2="24">
                      <stop offset="0%" stopColor="#34d399"/>
                      <stop offset="100%" stopColor="#06b6d4"/>
                    </linearGradient>
                    <linearGradient id="auraLoginSpark" x1="4" y1="4" x2="20" y2="20">
                      <stop offset="0%" stopColor="#6ee7b7"/>
                      <stop offset="100%" stopColor="#10b981"/>
                    </linearGradient>
                  </defs>
                </svg>
              </div>

              <h2 className="brand-name reveal-up" style={{ '--d': '0.26s' }}>
                مرحباً بك في Aura<em>Bot</em>
              </h2>
              <p className="brand-tagline reveal-up" style={{ '--d': '0.32s' }}>
                سجّل دخولك لإدارة بوتاتك ومتابعة مبيعاتك لحظة بلحظة
              </p>

              <div className="reveal-up" style={{ '--d': '0.4s', width: '100%' }}>
                <button
                  type="button"
                  className="google-btn"
                  onClick={handleGoogleLogin}
                  disabled={googleLoading}
                >
                  {googleLoading ? (
                    <span className="spinner" />
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24">
                      <path fill="#EA4335" d="M12 5c1.7 0 3 .7 3.9 1.5l2.9-2.9C17 1.9 14.7 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.4 9 5 12 5z"/>
                      <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.6h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.9z"/>
                      <path fill="#FBBC05" d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.3s.2-1.6.4-2.3L1.9 7.3C.7 9.7 0 12.3 0 15.1s.7 5.4 1.9 7.8l3.7-3c-.2-.7-.4-1.5-.4-2.3z"/>
                      <path fill="#34A853" d="M12 23.5c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.4-6.4-5.2L1.9 16.5C3.7 20.2 7.5 23.5 12 23.5z"/>
                    </svg>
                  )}
                  <span>{googleLoading ? 'جاري تسجيل الدخول...' : 'تسجيل الدخول باستخدام Google'}</span>
                </button>
              </div>

              <div className="google-hint reveal-up" style={{ '--d': '0.46s' }}>
                بدون كلمات مرور • نقرة واحدة فقط
              </div>

              <div className="perks-list reveal-up" style={{ '--d': '0.52s' }}>
                <div className="perk-item-v2">
                  <div className="perk-icon-chip tone-emerald">
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                    </svg>
                  </div>
                  <span>دخول فوري بنقرة واحدة وبدون أي خطوات معقدة</span>
                </div>
                <div className="perk-item-v2">
                  <div className="perk-icon-chip tone-sky">
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                    </svg>
                  </div>
                  <span>ربط سريع ومباشر مع WhatsApp وتيليغرام</span>
                </div>
                <div className="perk-item-v2">
                  <div className="perk-icon-chip tone-amber">
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                      <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/>
                    </svg>
                  </div>
                  <span>تسجيل وتأكيد الطلبيات تلقائياً على مدار الساعة</span>
                </div>
              </div>

              <div className="trust-strip reveal-up" style={{ '--d': '0.6s' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
                <span>اتصال مشفر وآمن 100% بنظام Google Firebase</span>
              </div>
            </div>
          </div>
        </aside>

      </div>

      {/* Country Selection Modal */}
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
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '0.25rem', color: '#ffffff' }}>أكمل إعداد حسابك</h3>
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
