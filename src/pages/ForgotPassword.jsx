import { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { forgotPassword, resetPassword } from '../services/nexcloud';
import { useToast } from '../context/ToastContext';

export default function ForgotPassword() {
  const toast = useToast();
  const [step, setStep] = useState('email'); // email | reset
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [newPassword, setNewPassword] = useState('');
  const otpRefs = useRef([]);

  const handleSendCode = async (e) => {
    e.preventDefault();
    if (!email) { toast.error('يرجى ادخال البريد الالكتروني'); return; }
    setLoading(true);
    try {
      const res = await forgotPassword(email);
      setResetToken(res.resetToken);
      setStep('reset');
      toast.success('تم ارسال رمز التحقق الى تيليغرام');
    } catch (err) {
      toast.error(err.message || 'خطأ في ارسال الرمز');
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
    if (value && index < 5) otpRefs.current[index + 1]?.focus();
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) otpRefs.current[index - 1]?.focus();
  };

  const handleReset = async (e) => {
    e.preventDefault();
    const code = otp.join('');
    if (code.length !== 6) { toast.error('يرجى ادخال الرمز كاملا'); return; }
    if (!newPassword || newPassword.length < 8) { toast.error('كلمة المرور يجب أن تكون 8 أحرف على الأقل'); return; }
    setLoading(true);
    try {
      await resetPassword(resetToken, code, newPassword);
      toast.success('تم تغيير كلمة المرور بنجاح');
      window.location.href = '/login';
    } catch (err) {
      toast.error(err.message || 'خطأ في تغيير كلمة المرور');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-layout" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: 'var(--space-6)' }}>
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
            استعادة كلمة المرور
          </p>
        </div>

        <div>
          {step === 'email' ? (
            <>
              <div style={{ marginBottom: 'var(--space-6)', textAlign: 'center' }}>
                <h2 style={{ fontSize: '1.25rem', marginBottom: 'var(--space-2)' }}>نسيت كلمة المرور؟</h2>
                <p style={{ color: 'var(--text-tertiary)', fontSize: '0.875rem' }}>ادخل بريدك الالكتروني وسنرسل لك رمز التحقق عبر تيليغرام</p>
              </div>
              <form onSubmit={handleSendCode}>
                <div className="form-group" style={{ marginBottom: 'var(--space-5)' }}>
                  <label className="form-label" style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: 'var(--space-2)', color: 'var(--text-secondary)' }}>البريد الالكتروني</label>
                  <input 
                    type="email" 
                    className="form-input" 
                    placeholder="example@email.com" 
                    value={email} 
                    onChange={(e) => setEmail(e.target.value)} 
                    dir="ltr" 
                    disabled={loading}
                    style={{ 
                      width: '100%', padding: '0.875rem 1rem', 
                      background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-subtle)', 
                      borderRadius: 'var(--radius-lg)', color: 'var(--text-primary)', 
                      transition: 'all var(--trans-fast)' 
                    }}
                  />
                </div>
                <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '0.875rem', fontSize: '1rem', fontWeight: '600' }} disabled={loading}>
                  {loading ? <span className="spinner" /> : null}
                  ارسال رمز التحقق
                </button>
              </form>
            </>
          ) : (
            <>
              <div style={{ marginBottom: 'var(--space-6)', textAlign: 'center' }}>
                <h2 style={{ fontSize: '1.25rem', marginBottom: 'var(--space-2)' }}>اعادة تعيين كلمة المرور</h2>
                <p style={{ color: 'var(--text-tertiary)', fontSize: '0.875rem' }}>ادخل الرمز وكلمة المرور الجديدة</p>
              </div>
              <form onSubmit={handleReset}>
                <div style={{ marginBottom: 'var(--space-5)' }}>
                  <label className="form-label" style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: 'var(--space-2)', color: 'var(--text-secondary)' }}>رمز التحقق (OTP)</label>
                  <div className="otp-container" style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'center' }} dir="ltr">
                    {otp.map((digit, i) => (
                      <input 
                        key={i} 
                        ref={el => otpRefs.current[i] = el} 
                        type="text" 
                        inputMode="numeric" 
                        value={digit} 
                        onChange={(e) => handleOtpChange(i, e.target.value)} 
                        onKeyDown={(e) => handleOtpKeyDown(i, e)} 
                        maxLength={1} 
                        disabled={loading} 
                        autoFocus={i === 0}
                        style={{
                          width: '48px', height: '56px',
                          textAlign: 'center', fontSize: '1.5rem', fontWeight: '700',
                          background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-subtle)',
                          borderRadius: 'var(--radius-lg)', color: 'var(--text-primary)',
                          transition: 'all var(--trans-fast)'
                        }}
                      />
                    ))}
                  </div>
                </div>
                
                <div className="form-group" style={{ marginBottom: 'var(--space-6)' }}>
                  <label className="form-label" style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: 'var(--space-2)', color: 'var(--text-secondary)' }}>كلمة المرور الجديدة</label>
                  <input 
                    type="password" 
                    className="form-input" 
                    placeholder="********" 
                    value={newPassword} 
                    onChange={(e) => setNewPassword(e.target.value)} 
                    dir="ltr" 
                    disabled={loading}
                    style={{ 
                      width: '100%', padding: '0.875rem 1rem', 
                      background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-subtle)', 
                      borderRadius: 'var(--radius-lg)', color: 'var(--text-primary)', 
                      transition: 'all var(--trans-fast)' 
                    }}
                  />
                </div>
                
                <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '0.875rem', fontSize: '1rem', fontWeight: '600' }} disabled={loading}>
                  {loading ? <span className="spinner" /> : null}
                  تغيير كلمة المرور
                </button>
              </form>
            </>
          )}
        </div>
        
        <div style={{ marginTop: 'var(--space-6)', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-tertiary)', fontSize: '0.875rem' }}>
            <Link to="/login" style={{ color: 'var(--accent-color)', textDecoration: 'none', fontWeight: '500' }}>العودة لتسجيل الدخول</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
