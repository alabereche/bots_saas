import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { COUNTRIES } from '../data/countries';

export default function Register() {
  const navigate = useNavigate();
  const { loginWithGoogle, registerWithEmail } = useAuth();
  const toast = useToast();

  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedCountry, setSelectedCountry] = useState('DZ'); // Default: Algeria
  const [phone, setPhone] = useState('');

  const countryObj = COUNTRIES.find(c => c.code === selectedCountry) || COUNTRIES[0];

  const handleGoogleSignup = async () => {
    setGoogleLoading(true);
    try {
      const user = await loginWithGoogle();
      toast.success(`أهلاً بك ${user.displayName || ''}! تم إنشاء حسابك بنجاح`);
      navigate('/dashboard');
    } catch (err) {
      if (err.code !== 'auth/popup-closed-by-user') {
        toast.error(err.message || 'فشل التسجيل باستخدام Google');
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleEmailRegister = async (e) => {
    e.preventDefault();
    if (!name || !email || !password) {
      toast.error('يرجى ملء جميع الحقول المطلوبة');
      return;
    }
    if (password.length < 6) {
      toast.error('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
      return;
    }

    setLoading(true);
    try {
      await registerWithEmail(email, password, name, selectedCountry, phone);
      toast.success('تم إنشاء الحساب بنجاح!');
      navigate('/dashboard');
    } catch (err) {
      let msg = 'خطأ في إنشاء الحساب';
      if (err.code === 'auth/email-already-in-use') {
        msg = 'هذا البريد الإلكتروني مسجل مسبقاً، يرجى تسجيل الدخول';
      } else if (err.code === 'auth/invalid-email') {
        msg = 'البريد الإلكتروني غير صحيح';
      } else if (err.code === 'auth/weak-password') {
        msg = 'كلمة المرور ضعيفة جداً';
      }
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-layout">
      <div className="card animate-enter" style={{ maxWidth: '480px', width: '100%', padding: 'var(--space-8)' }}>
        
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 'var(--space-6)' }}>
          <div style={{ 
            width: '56px', height: '56px', 
            background: 'var(--accent-gradient)', 
            borderRadius: '16px', 
            display: 'flex', alignItems: 'center', justifyContent: 'center', 
            margin: '0 auto var(--space-4)',
            boxShadow: '0 8px 30px var(--accent-glow-strong)',
            color: 'white'
          }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z"/>
              <path d="M2 17l10 5 10-5"/>
              <path d="M2 12l10 5 10-5"/>
            </svg>
          </div>
          <h1 style={{ fontSize: '2rem', marginBottom: 'var(--space-2)' }}>
            Bot<span className="text-gradient">Forge</span>
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: '1.6' }}>
            انشئ بوت ذكي لمشروعك في دقائق وابدأ في أتمتة الردود والمبيعات
          </p>
        </div>

        <div>
          <h2 style={{ fontSize: '1.25rem', marginBottom: 'var(--space-1)', textAlign: 'center' }}>إنشاء حساب جديد</h2>
          <p style={{ color: 'var(--text-tertiary)', fontSize: '0.875rem', marginBottom: 'var(--space-6)', textAlign: 'center' }}>
            سجّل بنقرة واحدة وابدأ تجربة المنصة
          </p>

          {/* Google Sign-In Button */}
          <button
            type="button"
            className="btn"
            onClick={handleGoogleSignup}
            disabled={googleLoading || loading}
            style={{
              width: '100%',
              padding: '0.875rem 1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
              background: 'rgba(255, 255, 255, 0.07)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: 'var(--radius-lg)',
              color: 'white',
              fontSize: '1rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              marginBottom: 'var(--space-6)',
              boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.12)'; e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.07)'; e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)'; }}
          >
            {googleLoading ? (
              <span className="spinner" style={{ width: '1.25rem', height: '1.25rem' }} />
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24">
                <path fill="#EA4335" d="M12 5c1.7 0 3 .7 3.9 1.5l2.9-2.9C17 1.9 14.7 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.4 9 5 12 5z"/>
                <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.6h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.9z"/>
                <path fill="#FBBC05" d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.3s.2-1.6.4-2.3L1.9 7.3C.7 9.7 0 12.3 0 15.1s.7 5.4 1.9 7.8l3.7-3c-.2-.7-.4-1.5-.4-2.3z"/>
                <path fill="#34A853" d="M12 23.5c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.4-6.4-5.2L1.9 16.5C3.7 20.2 7.5 23.5 12 23.5z"/>
              </svg>
            )}
            <span>التسجيل السريع باستخدام Google</span>
          </button>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', margin: 'var(--space-6) 0', color: 'var(--text-tertiary)', fontSize: '0.8125rem' }}>
            <div style={{ flex: 1, height: '1px', background: 'var(--border-subtle)' }} />
            <span style={{ padding: '0 var(--space-3)' }}>أو التسجيل العادي بالبريد</span>
            <div style={{ flex: 1, height: '1px', background: 'var(--border-subtle)' }} />
          </div>

          {/* Form */}
          <form onSubmit={handleEmailRegister}>
            <div className="form-group">
              <label className="form-label">الاسم الكامل</label>
              <input
                type="text"
                className="form-input"
                placeholder="محمد أمين"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={loading || googleLoading}
              />
            </div>

            <div className="form-group">
              <label className="form-label">الدولة والعملة</label>
              <select
                className="form-select"
                value={selectedCountry}
                onChange={(e) => setSelectedCountry(e.target.value)}
                disabled={loading || googleLoading}
              >
                {COUNTRIES.map(c => (
                  <option key={c.code} value={c.code}>
                    {c.flag} {c.name} ({c.currency})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">البريد الإلكتروني</label>
              <input
                type="email"
                className="form-input"
                placeholder="example@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                dir="ltr"
                disabled={loading || googleLoading}
              />
            </div>

            <div className="form-group">
              <label className="form-label">كلمة المرور</label>
              <input
                type="password"
                className="form-input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                dir="ltr"
                disabled={loading || googleLoading}
              />
              <p className="form-helper" style={{ color: 'rgba(255,255,255,0.4)', marginTop: '4px' }}>6 أحرف أو أكثر</p>
            </div>

            <button 
              type="submit" 
              className="btn btn-primary" 
              style={{ width: '100%', marginTop: 'var(--space-4)', padding: '0.875rem' }} 
              disabled={loading || googleLoading}
            >
              {loading ? <span className="spinner" /> : null}
              إنشاء الحساب والبدء
            </button>
          </form>
        </div>

        <div style={{ textAlign: 'center', marginTop: 'var(--space-6)', paddingTop: 'var(--space-6)', borderTop: '1px solid var(--border-subtle)', color: 'var(--text-tertiary)', fontSize: '0.875rem' }}>
          لديك حساب بالفعل؟{' '}
          <Link to="/login" style={{ fontWeight: 600 }}>تسجيل الدخول</Link>
        </div>
      </div>
    </div>
  );
}
