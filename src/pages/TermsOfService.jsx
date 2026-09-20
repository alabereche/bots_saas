import { Link } from 'react-router-dom';
import ModernBackground from '../components/ModernBackground';

export default function TermsOfService() {
  return (
    <div className="landing-page-root" style={{ minHeight: '100vh', padding: '4rem 1.5rem', direction: 'rtl', fontFamily: "'Almarai', 'Tajawal', sans-serif" }}>
      <ModernBackground />
      <div style={{ maxWidth: '850px', margin: '0 auto', background: 'rgba(17, 17, 16, 0.92)', border: '1px solid var(--border-default, rgba(255, 255, 255, 0.08))', borderRadius: '24px', padding: '2.5rem', position: 'relative', zIndex: 10, backdropFilter: 'blur(12px)', boxShadow: '0 20px 50px rgba(0,0,0,0.6)' }}>
        
        <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: '#10b981', textDecoration: 'none', marginBottom: '1.5rem', fontWeight: 700, fontSize: '0.9rem' }}>
          ← العودة للرئيسية
        </Link>

        <h1 style={{ fontSize: '2rem', color: 'var(--text-primary, #fff)', marginBottom: '0.5rem', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '1rem', fontWeight: 800 }}>
          شروط الاستخدام والخدمة — منصة AuraBot
        </h1>
        
        <p style={{ color: 'var(--text-secondary, #94a3b8)', fontSize: '0.88rem', lineHeight: '1.8', marginBottom: '2rem' }}>
          تاريخ آخر تحديث: سبتمبر 2026
        </p>

        <div style={{ color: 'var(--text-secondary, #cbd5e1)', fontSize: '0.94rem', lineHeight: '1.9', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '1.25rem 1.5rem', borderRadius: '16px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
            <h2 style={{ color: '#fff', fontSize: '1.15rem', marginBottom: '0.5rem', fontWeight: 700 }}>1. ما هي منصة AuraBot؟ (مجال الخدمة الشامل)</h2>
            <p>
              منصة AuraBot هي حل برمجي سحابي متطور (SaaS) مخصص لدعم وأتمتة مختلف الأنشطة التجارية والخدمية (المتاجر الإلكترونية، العيادات والمراكز الصحية، المكاتب المهنية والاستشارية، المطاعم والمقاهي، وكالات العقارات والخدمات، والشركات). تهدف المنصة إلى تولي خدمة العملاء 24/7 عبر واتساب وتيليغرام بواسطة الذكاء الاصطناعي، بما في ذلك: الرد الفوري على الاستفسارات، حجز المواعيد والاستشارات، عرض قوائم الخدمات وكتالوج المنتجات بالصور، وتأكيد وتتبع الطلبيات والحجوزات آلياً.
            </p>
          </div>

          <div style={{ background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.06) 0%, rgba(16, 185, 129, 0.01) 100%)', padding: '1.25rem 1.5rem', borderRadius: '16px', border: '1px solid rgba(16, 185, 129, 0.28)' }}>
            <h2 style={{ color: '#34d399', fontSize: '1.15rem', marginBottom: '0.5rem', fontWeight: 700 }}>2. أفضل الممارسات لربط واتساب (نصيحة ذهبية لشركائنا)</h2>
            <p style={{ marginBottom: '0.6rem' }}>
              • يتم ربط رقم واتساب عبر تقنية الربط الرقمي المباشر (كود الهاتف أو مسح الـ QR)، وتخضع أرقام واتساب لسياسات الاستخدام المعتادة لدى شركة WhatsApp لمكافحة المراسلات غير المرغوبة.
            </p>
            <p>
              • <strong>نصيحة عمل ذكية واحترافية:</strong> نوصي جميع أصحاب المشاريع والخدمات دائماً بتخصيص شريحة/رقم هاتف تجاري مستقل خاص بنشاط العمل أو العيادة أو المتجر وتفعيل البوت عليه. هذه الخطوة تمنحك فصلاً تاماً بين مراسلاتك الشخصية وأعمالك، وتتيح لك إدارة تواصلك مع العملاء بأريحية ومرونة وأمان كامل دون أي قلق على رقمك الشخصي حتى في أندر الحالات التقنية.
            </p>
          </div>

          <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '1.25rem 1.5rem', borderRadius: '16px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
            <h2 style={{ color: '#fff', fontSize: '1.15rem', marginBottom: '0.5rem', fontWeight: 700 }}>3. دقة الردود والذكاء الاصطناعي (Gemini)</h2>
            <p>
              يعتمد محرك البوت على الذكاء الاصطناعي لفهم اللهجة الدارجة والتفاعل بأسلوب مهني لبق وفق التعليمات، قوائم الخدمات، أو كتالوج السلع التي تضبطها في لوحة التحكم. صاحب النشاط هو المرجع الأول لتحديد وتحديث تفاصيل خدماته، مواعيد عمله، أو أسعار عروضه لضمان دقة المعلومات المقدمة لعملائه.
            </p>
          </div>

          <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '1.25rem 1.5rem', borderRadius: '16px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
            <h2 style={{ color: '#fff', fontSize: '1.15rem', marginBottom: '0.5rem', fontWeight: 700 }}>4. الاستخدام الأخلاقي والمسؤول</h2>
            <p>
              صُممت AuraBot لتطوير جودة التواصل وخدمة العملاء والمراجعين الحقيقيين. يُحظر تماماً استخدام المنصة في إرسال الرسائل العشوائية المزعجة (Spam) لأرقام لم تبدِ اهتماماً مسبقاً، أو استغلال البوت في الترويج للمحتويات والأنشطة المخالفة للقانون، وذلك حفاظاً على استقرار أرقامكم وسلامة خوادم المنصة لجميع المشتركين.
            </p>
          </div>

          <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '1.25rem 1.5rem', borderRadius: '16px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
            <h2 style={{ color: '#fff', fontSize: '1.15rem', marginBottom: '0.5rem', fontWeight: 700 }}>5. الاشتراكات والدفع والتفعيل</h2>
            <p>
              توفر المنصة باقة مجانية للبدء وتجربة كفاءة البوت في نشاطك، وباقة احترافية (1500 دج شهرياً) تفتح مزايا متقدمة (القناتين معاً، مزامنة Google Sheets، ربط الخدمات اللوجستية والشحن للـ 58 ولاية للمتاجر). يتم تفعيل الاشتراكات يدوياً وبسرعة عبر التحويل الميسّر (بريدي موب أو البطاقة الذهبية) وتستمر الصلاحية لكامل الفترة المشتراة.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
