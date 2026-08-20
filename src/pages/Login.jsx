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
    <div className="login-page-wrapper">
      <ModernBackground />
      <div className="login-hero-container">
        
        {/* ─── Left Column: Animated Journey Showcase ─── */}
        <div className="login-showcase-col">
          <div className="showcase-badge">
            <span className="badge-pulse" />
            <span>نظام أتمتة التجارة والخدمات بالذكاء الاصطناعي</span>
          </div>

          <h2 className="showcase-title">
            من فكرة المتجر إلى <span className="highlight-emerald">مبيعات آلية 24/7</span> في 4 خطوات
          </h2>
          
          <p className="showcase-desc">
            شاهد كيف يعمل النظام: إعداد في دقيقة، ربط فوري عبر QR، رد ذكي بالدارجة، وتسجيل تلقائي للطلبيات في لوحة التحكم.
          </p>

          {/* Interactive 4-Step Journey Carousel */}
          <ShowcaseJourney />
        </div>

        {/* ─── Right Column: Luxury High-Contrast Login Card ─── */}
        <div className="login-form-col">
          <div className="login-card">
            
            {/* Logo & Brand */}
            <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
              <div className="brand-icon-box" style={{ width: '56px', height: '56px', borderRadius: '18px', margin: '0 auto 1rem', background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(6, 182, 212, 0.1) 100%)', border: '1px solid rgba(52, 211, 153, 0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 24px rgba(16, 185, 129, 0.25)' }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="9" stroke="url(#auraRingGradLogin)" strokeWidth="1.8" strokeDasharray="2.5 2.5"/>
                  <path d="M12 4.5L14.2 9.8L19.5 12L14.2 14.2L12 19.5L9.8 14.2L4.5 12L9.8 9.8L12 4.5Z" fill="url(#auraSparkGradLogin)"/>
                  <defs>
                    <linearGradient id="auraRingGradLogin" x1="0" y1="0" x2="24" y2="24">
                      <stop offset="0%" stopColor="#34d399"/>
                      <stop offset="100%" stopColor="#06b6d4"/>
                    </linearGradient>
                    <linearGradient id="auraSparkGradLogin" x1="4" y1="4" x2="20" y2="20">
                      <stop offset="0%" stopColor="#6ee7b7"/>
                      <stop offset="100%" stopColor="#10b981"/>
                    </linearGradient>
                  </defs>
                </svg>
              </div>
              <h1 style={{ fontSize: '1.85rem', fontWeight: 800, marginBottom: '0.35rem', color: '#ffffff' }}>
                Aura<span style={{ color: '#10b981' }}>Bot</span>
              </h1>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                سجّل دخولك للبدء في إدارة وأتمتة بوتاتك
              </p>
            </div>

            {/* 1-Click Google Login Button */}
            <div style={{ marginBottom: '1.5rem' }}>
              <button
                type="button"
                className="google-login-btn"
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
                <span>تسجيل الدخول باستخدام Google</span>
              </button>
            </div>

            {/* Platform Feature List */}
            <div className="login-perks-box">
              <div className="perk-item">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2.2">
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                </svg>
                <span>دخول فوري بنقرة واحدة بدون كلمات مرور</span>
              </div>
              <div className="perk-item">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2.2">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
                <span>ربط سريع ومباشر مع WhatsApp وتيليغرام</span>
              </div>
              <div className="perk-item">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fb923c" strokeWidth="2.2">
                  <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/>
                </svg>
                <span>تسجيل وتأكيد الطلبيات تلقائياً 24/7</span>
              </div>
            </div>

            {/* Trust Footer */}
            <div style={{ textAlign: 'center', marginTop: '1.25rem', fontSize: '0.78rem', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              <span>اتصال مشفر وآمن 100% بنظام Google Firebase</span>
            </div>
          </div>
        </div>

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
