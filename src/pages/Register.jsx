import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { register, startRegistrationPolling, verifyRegistration } from '../services/nexcloud';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export default function Register() {
  const navigate = useNavigate();
  const { setAuthUser } = useAuth();
  const toast = useToast();

  const [step, setStep] = useState('form'); // form | telegram | otp
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otpToken, setOtpToken] = useState('');
  const [botUrl, setBotUrl] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const otpRefs = useRef([]);
  const pollingRef = useRef(null);

  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!name || !email || !password) {
      toast.error('يرجى ملء جميع الحقول');
      return;
    }
    if (password.length < 8) {
      toast.error('كلمة المرور يجب أن تكون 8 أحرف على الأقل');
      return;
    }
    if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
      toast.error('كلمة المرور يجب أن تحتوي على حرف كبير وصغير ورقم');
      return;
    }
    setLoading(true);
    try {
      const res = await register(name, email, password);
      setOtpToken(res.otpToken);
      setBotUrl(res.botUrl);
      setStep('telegram');

      pollingRef.current = startRegistrationPolling(
        res.otpToken,
        () => {
          setStep('otp');
          toast.success('تم ارسال رمز التحقق الى تيليغرام');
        },
        () => {
          toast.error('انتهت صلاحية الجلسة، يرجى المحاولة مرة اخرى');
          setStep('form');
        }
      );
    } catch (err) {
      toast.error(err.message || 'خطأ في التسجيل');
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
      const res = await verifyRegistration(otpToken, code);
      setAuthUser(res.user);
      toast.success('تم انشاء الحساب بنجاح!');
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
      {/* Ambient background is handled by CSS */}
      <div className="card animate-enter" style={{ maxWidth: '480px', width: '100%', padding: 'var(--space-8)' }}>
        
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
          {step === 'form' && (
            <div className="animate-enter">
              <h2 style={{ fontSize: '1.25rem', marginBottom: 'var(--space-1)', textAlign: 'center' }}>إنشاء حساب جديد</h2>
              <p style={{ color: 'var(--text-tertiary)', fontSize: '0.875rem', marginBottom: 'var(--space-6)', textAlign: 'center' }}>ابدأ بناء بوتاتك الذكية اليوم</p>
              
              <form onSubmit={handleRegister}>
                <div className="form-group">
                  <label className="form-label">الاسم الكامل</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="محمد أحمد"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={loading}
                  />
                </div>
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
                    disabled={loading}
                  />
                  <p className="form-helper" style={{ color: 'rgba(255,255,255,0.4)', marginTop: '6px' }}>8 أحرف على الأقل مع حرف كبير وصغير ورقم</p>
                </div>
                <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: 'var(--space-4)', padding: '1rem' }} disabled={loading}>
                  {loading ? <span className="spinner" /> : null}
                  متابعة التسجيل
                </button>
              </form>
            </div>
          )}

          {step === 'telegram' && (
            <div className="animate-enter" style={{ textAlign: 'center' }}>
              <div style={{
                width: '64px', height: '64px', borderRadius: '50%',
                background: 'rgba(40, 168, 233, 0.1)', color: '#28A8E9',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto var(--space-4)'
              }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
                </svg>
              </div>
              <h2 style={{ fontSize: '1.25rem', marginBottom: 'var(--space-2)' }}>تأكيد عبر تيليغرام</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: 'var(--space-6)', lineHeight: '1.6' }}>
                لضمان أمان حسابك، نحتاج لتأكيد هويتك عبر تيليغرام.<br />
                اضغط على الزر أدناه لفتح البوت الخاص بنا ثم اضغط <strong style={{ color: 'white' }}>"Start"</strong>
              </p>
              
              <a href={botUrl} target="_blank" rel="noopener noreferrer" className="btn btn-primary" style={{ width: '100%', background: 'linear-gradient(135deg, #28A8E9, #1C7DA6)', padding: '1rem' }}>
                فتح تيليغرام للتحقق
              </a>

              <div style={{ 
                marginTop: 'var(--space-8)', 
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-3)', 
                color: 'var(--text-tertiary)', fontSize: '0.875rem',
                background: 'rgba(255,255,255,0.03)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)'
              }}>
                <span className="spinner" style={{ color: 'var(--accent-color)', width: '1rem', height: '1rem', borderWidth: '2px' }} />
                <span>نحن في انتظار تأكيدك على تيليغرام...</span>
              </div>
            </div>
          )}

          {step === 'otp' && (
            <div className="animate-enter">
              <div style={{ textAlign: 'center', marginBottom: 'var(--space-6)' }}>
                <h2 style={{ fontSize: '1.25rem', marginBottom: 'var(--space-2)' }}>رمز التحقق الآمن</h2>
                <p style={{ color: 'var(--text-tertiary)', fontSize: '0.875rem' }}>
                  أدخل الرمز المكون من 6 أرقام الذي وصلنا لتونا على تيليغرام
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
                  تأكيد الحساب والبدء
                </button>
              </form>
            </div>
          )}
        </div>

        <div style={{ textAlign: 'center', marginTop: 'var(--space-6)', paddingTop: 'var(--space-6)', borderTop: '1px solid var(--border-subtle)', color: 'var(--text-tertiary)', fontSize: '0.875rem' }}>
          لديك حساب بالفعل؟{' '}
          <Link to="/login" style={{ fontWeight: 600 }}>تسجيل الدخول</Link>
        </div>
      </div>
    </div>
  );
}
