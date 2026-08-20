import { useNavigate } from 'react-router-dom';

export default function Billing() {
  const navigate = useNavigate();

  return (
    <div className="page-container" style={{ maxWidth: '780px', margin: '0 auto', paddingBottom: '3rem' }}>
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#ffffff', marginBottom: '0.4rem' }}>
          الاشتراكات والخطط
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem' }}>
          إدارة وتوسيع بوتاتك الذكية على واتساب وتيليغرام بكل سهولة
        </p>
      </div>

      {/* Free Tier Solid Card */}
      <div className="card" style={{ padding: '2rem', textAlign: 'center', marginBottom: '1.5rem' }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          background: 'var(--color-primary-subtle)',
          color: 'var(--color-primary-light)',
          padding: '4px 14px',
          borderRadius: 'var(--radius-full)',
          fontSize: '0.82rem',
          fontWeight: 700,
          border: '1px solid var(--color-primary)',
          marginBottom: '1.25rem'
        }}>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--color-primary)' }} />
          متاح مجاناً 100% لفترة الإطلاق
        </div>

        <div style={{
          width: '64px', height: '64px',
          margin: '0 auto 1.25rem',
          background: '#18243b',
          color: 'var(--color-primary)',
          borderRadius: 'var(--radius-lg)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '1px solid var(--border-default)'
        }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
          </svg>
        </div>

        <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#ffffff', marginBottom: '0.75rem' }}>
          تمتع بجميع ميزات المنصة مجاناً
        </h2>
        
        <p style={{ fontSize: '0.92rem', color: 'var(--text-secondary)', lineHeight: 1.7, maxWidth: '540px', margin: '0 auto 1.5rem' }}>
          نحن في مرحلة الإطلاق المفتوح. يمكنك إنشاء عدد غير محدود من البوتات وربطها بـ WhatsApp و Telegram مجاناً مع أحدث نماذج الذكاء الاصطناعي السريعة.
        </p>

        <button className="btn btn-primary btn-lg" onClick={() => navigate('/create-bot')}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          إنشاء بوت جديد الآن
        </button>
      </div>

      {/* FAQ Section */}
      <div style={{ marginTop: '2rem' }}>
        <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#ffffff', marginBottom: '1rem' }}>
          الأسئلة الشائعة
        </h3>
        
        <div className="faq-box">
          <div className="faq-q">هل أحتاج إلى خبرة برمجية لاستخدام المنصة؟</div>
          <div className="faq-a">
            لا إطلاقاً! AuraBot مصممة لتكون سهلة وبسيطة. املأ بيانات نشاطك التجاري وسنقوم بتوليد بوت ذكي يتحدث باسمك ويسجل الطلبات في دقائق.
          </div>
        </div>

        <div className="faq-box">
          <div className="faq-q">كيف يتم استقبال وتسجيل طلبيات الزبائن؟</div>
          <div className="faq-a">
            يقوم الذكاء الاصطناعي بالتعرف على نية الشراء تلقائياً واستخراج اسم الزبون، هاتفه، عنوانه والمنتج، ويسجلها فوراً في جدول الطلبيات بلوحة التحكم.
          </div>
        </div>

        <div className="faq-box">
          <div className="faq-q">هل يمكنني ربط واتساب وتيليغرام في نفس الوقت؟</div>
          <div className="faq-a">
            نعم، يمكنك إنشاء بوت لكل قناة بشكل مستقل والتحكم في الرسائل والإحصائيات من نفس الحساب.
          </div>
        </div>
      </div>
    </div>
  );
}
