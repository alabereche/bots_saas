import { useNavigate } from 'react-router-dom';

export default function Billing() {
  const navigate = useNavigate();

  return (
    <div className="page-container" style={{ maxWidth: '800px', margin: '0 auto' }}>
      <div className="page-header" style={{ textAlign: 'center', marginBottom: 'var(--space-8)' }}>
        <h1 className="page-title">الاشتراكات والخطط</h1>
        <p className="page-subtitle">كل ما تحتاجه لإدارة بوتاتك باحترافية</p>
      </div>

      {/* Premium Free Tier Announcement Card */}
      <div className="premium-card" style={{ position: 'relative', overflow: 'hidden', padding: 'var(--space-8)', textAlign: 'center', background: 'linear-gradient(145deg, rgba(139, 92, 246, 0.08) 0%, rgba(139, 92, 246, 0.02) 100%)', borderColor: 'rgba(139, 92, 246, 0.2)' }}>
        
        {/* Decorative ambient glow */}
        <div style={{ position: 'absolute', top: '-50px', left: '50%', transform: 'translateX(-50%)', width: '200px', height: '200px', background: 'var(--accent-glow-strong)', filter: 'blur(80px)', opacity: 0.5, pointerEvents: 'none' }} />

        {/* Badge */}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'rgba(52, 211, 153, 0.1)', color: '#34d399', padding: '6px 16px', borderRadius: '100px', fontSize: '0.875rem', fontWeight: 600, border: '1px solid rgba(52, 211, 153, 0.2)', marginBottom: 'var(--space-6)' }}>
          <span style={{ display: 'block', width: '8px', height: '8px', borderRadius: '50%', background: '#34d399', boxShadow: '0 0 10px #34d399' }} />
          مجاني 100% حالياً
        </div>

        <div className="premium-icon" style={{ width: '80px', height: '80px', margin: '0 auto var(--space-6)', background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.2), rgba(139, 92, 246, 0.05))', color: 'var(--accent-color)', borderRadius: '24px' }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
        </div>

        <h2 style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: 'var(--space-4)', letterSpacing: '-0.02em' }}>المنصة مجانية بالكامل</h2>
        
        <p style={{ fontSize: '1.125rem', color: 'var(--text-secondary)', lineHeight: 1.8, maxWidth: '600px', margin: '0 auto var(--space-8)' }}>
          نحن حالياً في المرحلة المفتوحة. يمكنك الاستمتاع بإنشاء البوتات وتخصيص تجربة الذكاء الاصطناعي الخاص بك <strong>مجاناً في فترة التجربة الحالية</strong>.
          <br /><br />
          سيتم إدراج خطط الاشتراك الرسمية قريباً جداً.
        </p>

        <button className="btn btn-primary btn-lg" onClick={() => navigate('/bots/create')} style={{ padding: '0 32px', height: '52px', fontSize: '1.0625rem' }}>
          ابدأ بإنشاء بوتك الآن
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </button>
      </div>

      {/* FAQ Section */}
      <div className="premium-card" style={{ marginTop: 'var(--space-8)' }}>
        <div className="premium-card-header" style={{ paddingBottom: 'var(--space-2)' }}>
          <h3 className="premium-title">أسئلة شائعة</h3>
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <FaqItem
            q="هل أحتاج إلى خبرة برمجية لاستخدام المنصة؟"
            a="لا إطلاقاً! ساس مُصممة لتكون سهلة الاستخدام للجميع، ما عليك سوى ملء نموذج بسيط وسنقوم بخلق بوت ذكي يتحدث نيابة عن نشاطك التجاري بدقائق."
            hasBorder={true}
          />
          <FaqItem
            q="كيف يتم حساب تكلفة رسائل الذكاء الاصطناعي؟"
            a="نظامنا مدعوم بأحدث النماذج اللغوية المتطورة، وهو متاح حالياً للتجربة بشكل مجاني بالكامل. المنصة لا تفرض عليك أي رسوم إضافية."
            hasBorder={true}
          />
          <FaqItem
            q="ماذا سيحدث بعد إطلاق خطط الاشتراك؟"
            a="سنستمر في تقديم باقة مجانية دائمة للمستخدمين الأوائل، وسيتم توفير خطط متقدمة بأسعار تنافسية تلبي احتياجات المشاريع الكبرى."
            hasBorder={false}
          />
        </div>
      </div>
    </div>
  );
}

function FaqItem({ q, a, hasBorder }) {
  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      padding: 'var(--space-5) var(--space-6)',
      borderBottom: hasBorder ? '1px solid rgba(255, 255, 255, 0.06)' : 'none'
    }}>
      <h4 style={{ fontSize: '1.0625rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 'var(--space-2)' }}>{q}</h4>
      <p style={{ fontSize: '0.9375rem', color: 'var(--text-secondary)', lineHeight: 1.7, margin: 0 }}>{a}</p>
    </div>
  );
}
