import { Link } from 'react-router-dom';
import ModernBackground from '../components/ModernBackground';

export default function TermsOfService() {
  return (
    <div className="landing-page-root" style={{ minHeight: '100vh', padding: '4rem 1.5rem', direction: 'rtl' }}>
      <ModernBackground />
      <div style={{ maxWidth: '850px', margin: '0 auto', background: 'rgba(14, 21, 38, 0.9)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '20px', padding: '2.5rem', position: 'relative', zIndex: 10, backdropFilter: 'blur(10px)' }}>
        
        <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: '#10b981', textDecoration: 'none', marginBottom: '1.5rem', fontWeight: 600, fontSize: '0.9rem' }}>
          ← العودة للرئيسية
        </Link>

        <h1 style={{ fontSize: '2rem', color: '#ffffff', marginBottom: '1rem', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '1rem' }}>
          شروط الاستخدام — منصة AuraBot
        </h1>
        
        <p style={{ color: '#94a3b8', fontSize: '0.95rem', lineHeight: '1.8' }}>
          تاريخ آخر تحديث: 22 أغسطس 2026
        </p>

        <div style={{ marginTop: '2rem', color: '#cbd5e1', fontSize: '0.95rem', lineHeight: '1.9' }}>
          <h2 style={{ color: '#ffffff', fontSize: '1.25rem', marginTop: '1.5rem', marginBottom: '0.5rem' }}>1. قبول الشروط</h2>
          <p>
            باستخدامك لمنصة AuraBot، فإنك توافق على الالتزام بشروط الخدمة هذه وجميع القوانين واللوائح المعمول بها وسياسات منصات التواصل الاجتماعي المرتبطة.
          </p>

          <h2 style={{ color: '#ffffff', fontSize: '1.25rem', marginTop: '1.5rem', marginBottom: '0.5rem' }}>2. الاستخدام المصرح به</h2>
          <p>
            يُحظر استخدام المنصة في إرسال الرسائل المزعجة (Spam) أو أي محتوى مخالف للقوانين أو انتهاك شروط استخدام منصة Meta (Facebook & Instagram) أو Telegram أو WhatsApp.
          </p>

          <h2 style={{ color: '#ffffff', fontSize: '1.25rem', marginTop: '1.5rem', marginBottom: '0.5rem' }}>3. حدود المسؤولية</h2>
          <p>
            تُقدم الخدمة للمساعدة في أتمتة التجارة والردود، ويكون المشترك مسؤولاً عن صحة محتوى المنتجات والأسعار المقدمة في الكتالوج.
          </p>
        </div>
      </div>
    </div>
  );
}
