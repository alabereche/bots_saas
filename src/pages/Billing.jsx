import { useNavigate } from 'react-router-dom';

export default function Billing() {
  const navigate = useNavigate();

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">الاشتراكات</h1>
        <p className="page-subtitle">اختر الخطة المناسبة لمشروعك</p>
      </div>

      <div className="plan-grid">
        {/* Free Plan */}
        <div className="plan-card">
          <div className="plan-name">مجاني</div>
          <div className="plan-price">
            $0
            <span className="plan-price-period"> / شهر</span>
          </div>
          <p style={{ color: 'var(--text-tertiary)', fontSize: 'var(--text-sm)', marginTop: 'var(--space-2)' }}>
            ابدأ مجانا بدون التزام
          </p>
          <ul className="plan-features">
            <li>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              بوت واحد
            </li>
            <li>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              100 رسالة / يوم
            </li>
            <li>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              نماذج AI اساسية
            </li>
            <li>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              دعم عبر البريد
            </li>
          </ul>
          <button className="btn btn-secondary btn-lg" style={{ width: '100%' }} disabled>
            خطتك الحالية
          </button>
        </div>

        {/* Pro Plan */}
        <div className="plan-card featured">
          <div className="plan-name">احترافي</div>
          <div className="plan-price">
            $15
            <span className="plan-price-period"> / شهر</span>
          </div>
          <p style={{ color: 'var(--text-tertiary)', fontSize: 'var(--text-sm)', marginTop: 'var(--space-2)' }}>
            لأصحاب المشاريع الجادين
          </p>
          <ul className="plan-features">
            <li>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              بوتات غير محدودة
            </li>
            <li>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              رسائل غير محدودة
            </li>
            <li>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              جميع نماذج AI المتاحة
            </li>
            <li>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              احصائيات تفصيلية
            </li>
            <li>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              دعم أولوية
            </li>
            <li>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              تعليمات مخصصة متقدمة
            </li>
          </ul>
          <button className="btn btn-primary btn-lg" style={{ width: '100%' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
            الترقية الآن
          </button>
        </div>
      </div>

      {/* FAQ Section */}
      <div className="card" style={{ marginTop: 'var(--space-10)', maxWidth: '700px', marginRight: 'auto', marginLeft: 'auto' }}>
        <h3 className="card-title" style={{ marginBottom: 'var(--space-6)', textAlign: 'center' }}>اسئلة شائعة</h3>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          <FaqItem
            q="هل احتاج خبرة تقنية لاستخدام المنصة؟"
            a="لا! المنصة مصممة لتكون سهلة الاستخدام. فقط املأ معلومات مشروعك وسنتكفل بالباقي."
          />
          <FaqItem
            q="من يدفع تكاليف الذكاء الاصطناعي؟"
            a="أنت تستخدم مفتاح OpenRouter API الخاص بك. التكلفة تعتمد على الاستخدام وعادة تكون منخفضة جدا."
          />
          <FaqItem
            q="هل يمكنني التراجع عن الخطة الاحترافية؟"
            a="نعم! يمكنك الالغاء في أي وقت. ستظل الخطة فعالة حتى نهاية فترة الفوترة الحالية."
          />
          <FaqItem
            q="هل بياناتي آمنة؟"
            a="نعم. جميع المفاتيح والتوكنات مشفرة بتشفير AES-256. لا نسجل أي بيانات حساسة في السجلات."
          />
        </div>
      </div>
    </div>
  );
}

function FaqItem({ q, a }) {
  return (
    <div style={{ borderBottom: '1px solid var(--border-primary)', paddingBottom: 'var(--space-5)' }}>
      <h4 style={{ fontSize: 'var(--text-base)', fontWeight: 600, marginBottom: 'var(--space-2)' }}>{q}</h4>
      <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 'var(--leading-relaxed)' }}>{a}</p>
    </div>
  );
}
