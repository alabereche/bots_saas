import { Link } from 'react-router-dom';
import ModernBackground from '../components/ModernBackground';

export default function PrivacyPolicy() {
  return (
    <div className="landing-page-root" style={{ minHeight: '100vh', padding: '4rem 1.5rem', direction: 'rtl' }}>
      <ModernBackground />
      <div style={{ maxWidth: '850px', margin: '0 auto', background: 'rgba(14, 21, 38, 0.9)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '20px', padding: '2.5rem', position: 'relative', zIndex: 10, backdropFilter: 'blur(10px)' }}>
        
        <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: '#10b981', textDecoration: 'none', marginBottom: '1.5rem', fontWeight: 600, fontSize: '0.9rem' }}>
          ← العودة للرئيسية
        </Link>

        <h1 style={{ fontSize: '2rem', color: '#ffffff', marginBottom: '1rem', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '1rem' }}>
          سياسة الخصوصية — منصة AuraBot
        </h1>
        
        <p style={{ color: '#94a3b8', fontSize: '0.95rem', lineHeight: '1.8' }}>
          تاريخ آخر تحديث: 22 أغسطس 2026
        </p>

        <div style={{ marginTop: '2rem', color: '#cbd5e1', fontSize: '0.95rem', lineHeight: '1.9' }}>
          <h2 style={{ color: '#ffffff', fontSize: '1.25rem', marginTop: '1.5rem', marginBottom: '0.5rem' }}>1. جمع المعلومات واستخدامها</h2>
          <p>
            تلتزم منصة AuraBot بحماية خصوصية مستخدميها وعملائهم. عند ربط حسابات التواصل الاجتماعي (Facebook و Instagram و WhatsApp و Telegram)، نقوم بالوصول حصرياً إلى المعرفات والرسائل المصرح بها لتمكين الرد التلقائي عبر الذكاء الاصطناعي وإدارة الطلبيات بناءً على طلب صاحب المتجر.
          </p>

          <h2 style={{ color: '#ffffff', fontSize: '1.25rem', marginTop: '1.5rem', marginBottom: '0.5rem' }}>2. أمان وتشفير البيانات</h2>
          <p>
            جميع الرموز الأمنية (Tokens) والمفاتيح يتم تشفيرها وفق أعلى معايير التشفير (AES-256-GCM) ولا يتم مشاركتها أو بيعها لأي طرف ثالث.
          </p>

          <h2 style={{ color: '#ffffff', fontSize: '1.25rem', marginTop: '1.5rem', marginBottom: '0.5rem' }}>3. صلاحيات Meta (Facebook & Instagram)</h2>
          <p>
            تُستخدم الصلاحيات المطلوبة من Meta (مثل `pages_messaging` و `instagram_manage_messages`) فقط لاستقبال استفسارات الزبائن وإرسال الردود التلقائية وصور المنتجات المسجلة في كتالوج المتجر.
          </p>

          <h2 style={{ color: '#ffffff', fontSize: '1.25rem', marginTop: '1.5rem', marginBottom: '0.5rem' }}>4. حذف البيانات</h2>
          <p>
            يمكن لأي مستخدم حذف بيانات حسابه وقطع اتصال البوت في أي وقت عبر لوحة التحكم، وسيتم مسح التوكنات والبيانات فوراً من الخوادم.
          </p>

          <h2 style={{ color: '#ffffff', fontSize: '1.25rem', marginTop: '1.5rem', marginBottom: '0.5rem' }}>5. التواصل معنا</h2>
          <p>
            لأي استفسار بشأن الخصوصية، يرجى التواصل عبر: <a href="mailto:support@nosfir.online" style={{ color: '#10b981' }}>support@nosfir.online</a>
          </p>
        </div>
      </div>
    </div>
  );
}
