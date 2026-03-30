import { useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { login, verifyLogin } from '../services/nexcloud';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export default function Login() {
  const navigate = useNavigate();
  const { setAuthUser } = useAuth();
  const toast = useToast();

  const [step, setStep] = useState('credentials'); // credentials | otp | unverified
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginToken, setLoginToken] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const otpRefs = useRef([]);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('يرجى ملء جميع الحقول');
      return;
    }
    setLoading(true);
    try {
      const res = await login(email, password);
      setLoginToken(res.loginToken);
      setStep('otp');
      toast.success('تم ارسال رمز التحقق الى تيليغرام');
    } catch (err) {
      const msg = err.message || '';
      if (msg.includes('not verified') || msg.includes('Account not verified')) {
        setStep('unverified');
      } else {
        toast.error(msg || 'خطأ في تسجيل الدخول');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (index, value) => {
    if (value.length > 1) value = value[value.length - 1];
    if (value && !/^\d$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    if (value && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e) => {
    const paste = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (paste.length === 6) {
      setOtp(paste.split(''));
      otpRefs.current[5]?.focus();
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    const code = otp.join('');
    if (code.length !== 6) {
      toast.error('يرجى ادخال الرمز المكون من 6 ارقام');
      return;
    }
    setLoading(true);
    try {
      const res = await verifyLogin(loginToken, code);
      setAuthUser(res.user);
      toast.success('تم تسجيل الدخول بنجاح');
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.message || 'رمز التحقق غير صحيح');
      setOtp(['', '', '', '', '', '']);
      otpRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-layout" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: 'var(--space-6)' }}>
      {/* Decorative ambient background is handled by body::before/after in CSS */}
      
      <div className="card animate-enter" style={{ maxWidth: '440px', width: '100%', padding: 'var(--space-8)' }}>
        <div style={{ textAlign: 'center', marginBottom: 'var(--space-8)' }}>
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
          <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', lineHeight: '1.6' }}>
            انشئ بوت ذكي لمشروعك في دقائق معدودة وابدأ في خدمة عملائك آلياً
          </p>
        </div>

        <div>
          {step === 'credentials' ? (
            <div className="animate-enter">
              <h2 style={{ fontSize: '1.25rem', marginBottom: 'var(--space-1)', textAlign: 'center' }}>تسجيل الدخول</h2>
              <p style={{ color: 'var(--text-tertiary)', fontSize: '0.875rem', marginBottom: 'var(--space-6)', textAlign: 'center' }}>مرحبا بعودتك! ادخل بيانات الحساب للمتابعة</p>
              
              <form onSubmit={handleLogin}>
                <div className="form-group">
                  <label className="form-label">البريد الالكتروني</label>
                  <input
                    type="email"
                    className="form-input"
                    placeholder="example@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    dir="ltr"
                    disabled={loading}
                    autoComplete="email"
                  />
                </div>
                <div className="form-group">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
                    <label className="form-label" style={{ margin: 0 }}>كلمة المرور</label>
                    <Link to="/forgot-password" style={{ fontSize: '0.8125rem', fontWeight: 500 }}>
                      نسيت كلمة المرور؟
                    </Link>
                  </div>
                  <input
                    type="password"
                    className="form-input"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    dir="ltr"
                    disabled={loading}
                    autoComplete="current-password"
                  />
                </div>
                
                <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: 'var(--space-4)', padding: '1rem' }} disabled={loading}>
                  {loading ? <span className="spinner" /> : null}
                  تسجيل الدخول
                </button>
              </form>
            </div>
          ) : (
            <div className="animate-enter">
              <div style={{ textAlign: 'center', marginBottom: 'var(--space-6)' }}>
                <h2 style={{ fontSize: '1.25rem', marginBottom: 'var(--space-2)' }}>رمز التحقق الآمن</h2>
                <p style={{ color: 'var(--text-tertiary)', fontSize: '0.875rem' }}>
                  أدخل الرمز المكون من 6 أرقام المرسل إلى حسابك على تيليغرام
                </p>
              </div>
              
              <form onSubmit={handleVerify}>
                <div className="otp-container" onPaste={handleOtpPaste}>
                  {otp.map((digit, i) => (
                    <input
                      key={i}
                      ref={el => otpRefs.current[i] = el}
                      type="text"
                      inputMode="numeric"
                      className="otp-input"
                      value={digit}
                      onChange={(e) => handleOtpChange(i, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(i, e)}
                      maxLength={1}
                      disabled={loading}
                      autoFocus={i === 0}
                    />
                  ))}
                </div>
                <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: 'var(--space-2)', padding: '1rem' }} disabled={loading}>
                  {loading ? <span className="spinner" /> : null}
                  تأكيد الرمز
                </button>
              </form>
              <button 
                className="btn btn-secondary" 
                style={{ width: '100%', marginTop: 'var(--space-3)' }}
                onClick={() => { setStep('credentials'); setOtp(['','','','','','']); }}
                disabled={loading}
              >
                العودة
              </button>
            </div>
          )}

          {step === 'unverified' && (
            <div className="animate-enter" style={{ textAlign: 'center' }}>
              <div style={{
                width: '64px', height: '64px', borderRadius: '50%',
                background: 'var(--color-warning-bg)', color: 'var(--color-warning)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto var(--space-4)',
                boxShadow: '0 0 24px hsla(38, 92%, 50%, 0.2)'
              }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/>
                  <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
              </div>
              <h2 style={{ fontSize: '1.25rem', marginBottom: 'var(--space-2)' }}>الحساب غير مفعّل</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: 'var(--space-6)', lineHeight: '1.7' }}>
                لم يتم إكمال التحقق عبر تيليغرام أثناء التسجيل.<br/>
                يرجى إعادة التسجيل وإكمال خطوة التحقق لتفعيل حسابك.
              </p>
              <Link to="/register" className="btn btn-primary" style={{ width: '100%', padding: '1rem', textDecoration: 'none' }}>
                إعادة التسجيل وتفعيل الحساب
              </Link>
              <button 
                className="btn btn-secondary" 
                style={{ width: '100%', marginTop: 'var(--space-3)' }}
                onClick={() => setStep('credentials')}
              >
                العودة
              </button>
            </div>
          )}
        </div>

        <div style={{ textAlign: 'center', marginTop: 'var(--space-6)', paddingTop: 'var(--space-6)', borderTop: '1px solid var(--border-subtle)', color: 'var(--text-tertiary)', fontSize: '0.875rem' }}>
          ليس لديك حساب؟{' '}
          <Link to="/register" style={{ fontWeight: 600 }}>انشئ حساباً جديداً</Link>
        </div>
      </div>
    </div>
  );
}
