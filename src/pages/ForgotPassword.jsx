import { useState } from 'react';
import { Link } from 'react-router-dom';
import { auth } from '../services/firebase';
import { sendPasswordResetEmail } from 'firebase/auth';
import { useToast } from '../context/ToastContext';

export default function ForgotPassword() {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);

  const handleSendResetEmail = async (e) => {
    e.preventDefault();
    if (!email) {
      toast.error('يرجى إدخال البريد الإلكتروني');
      return;
    }
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setSent(true);
      toast.success('تم إرسال رابط استعادة كلمة المرور إلى بريدك الإلكتروني');
    } catch (err) {
      let msg = 'حدث خطأ أثناء إرسال الرابط';
      if (err.code === 'auth/user-not-found') {
        msg = 'البريد الإلكتروني غير مسجل';
      } else if (err.code === 'auth/invalid-email') {
        msg = 'البريد الإلكتروني غير صحيح';
      }
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-layout">
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
          {!sent ? (
            <>
              <div style={{ marginBottom: 'var(--space-6)', textAlign: 'center' }}>
                <h2 style={{ fontSize: '1.25rem', marginBottom: 'var(--space-2)' }}>نسيت كلمة المرور؟</h2>
                <p style={{ color: 'var(--text-tertiary)', fontSize: '0.875rem' }}>
                  أدخل بريدك الإلكتروني وسنرسل لك رابطاً آمناً لتعيين كلمة مرور جديدة
                </p>
              </div>

              <form onSubmit={handleSendResetEmail}>
                <div className="form-group" style={{ marginBottom: 'var(--space-5)' }}>
                  <label className="form-label">البريد الإلكتروني</label>
                  <input 
                    type="email" 
                    className="form-input" 
                    placeholder="example@email.com" 
                    value={email} 
                    onChange={e => setEmail(e.target.value)} 
                    dir="ltr"
                    disabled={loading}
                    autoComplete="email"
                  />
                </div>
                
                <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '0.875rem' }} disabled={loading}>
                  {loading ? <span className="spinner" /> : null}
                  إرسال رابط الاستعادة
                </button>
              </form>
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: 'var(--space-4) 0' }}>
              <div style={{
                width: '64px', height: '64px', borderRadius: '50%',
                background: 'rgba(34, 197, 94, 0.1)', color: '#22c55e',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto var(--space-4)'
              }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                  <polyline points="22 4 12 14.01 9 11.01"/>
                </svg>
              </div>
              <h2 style={{ fontSize: '1.25rem', marginBottom: 'var(--space-2)' }}>تم إرسال الرابط!</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: '1.7', marginBottom: 'var(--space-6)' }}>
                تفقد صندوق الوارد أو البريد غير الهام (Spam) للبريد <strong>{email}</strong> واتبع التعليمات لتعيين كلمة مرور جديدة.
              </p>
              <Link to="/login" className="btn btn-primary" style={{ width: '100%', padding: '0.875rem' }}>
                العودة لتسجيل الدخول
              </Link>
            </div>
          )}
        </div>

        <div style={{ textAlign: 'center', marginTop: 'var(--space-6)', paddingTop: 'var(--space-6)', borderTop: '1px solid var(--border-subtle)', color: 'var(--text-tertiary)', fontSize: '0.875rem' }}>
          تذكرت كلمة المرور؟{' '}
          <Link to="/login" style={{ fontWeight: 600 }}>تسجيل الدخول</Link>
        </div>
      </div>
    </div>
  );
}
