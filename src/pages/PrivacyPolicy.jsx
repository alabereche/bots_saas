import { Link } from 'react-router-dom';
import ModernBackground from '../components/ModernBackground';

export default function PrivacyPolicy() {
  return (
    <div className="landing-page-root" style={{ minHeight: '100vh', padding: '4rem 1.5rem', direction: 'rtl', fontFamily: "'Almarai', 'Tajawal', sans-serif" }}>
      <ModernBackground />
      <div style={{ maxWidth: '850px', margin: '0 auto', background: 'rgba(17, 17, 16, 0.92)', border: '1px solid var(--border-default, rgba(255, 255, 255, 0.08))', borderRadius: '24px', padding: '2.5rem', position: 'relative', zIndex: 10, backdropFilter: 'blur(12px)', boxShadow: '0 20px 50px rgba(0,0,0,0.6)' }}>
        
        <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: '#10b981', textDecoration: 'none', marginBottom: '1.5rem', fontWeight: 700, fontSize: '0.9rem' }}>
          ← العودة للرئيسية
        </Link>

        <h1 style={{ fontSize: '2rem', color: 'var(--text-primary, #fff)', marginBottom: '0.5rem', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '1rem', fontWeight: 800 }}>
          سياسة الخصوصية وحماية البيانات — منصة AuraBot
        </h1>
        
        <p style={{ color: 'var(--text-secondary, #94a3b8)', fontSize: '0.88rem', lineHeight: '1.8', marginBottom: '2rem' }}>
          تاريخ آخر تحديث: سبتمبر 2026
        </p>

        <div style={{ color: 'var(--text-secondary, #cbd5e1)', fontSize: '0.94rem', lineHeight: '1.9', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div style={{ background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.06) 0%, rgba(16, 185, 129, 0.01) 100%)', padding: '1.25rem 1.5rem', borderRadius: '16px', border: '1px solid rgba(16, 185, 129, 0.28)' }}>
            <h2 style={{ color: '#34d399', fontSize: '1.15rem', marginBottom: '0.5rem', fontWeight: 700 }}>1. أمانتك وسرية بياناتك (مبدؤنا الأساسي)</h2>
            <p>
              نحن في AuraBot نعتبر بيانات نشاطك، وملفات خدماتك، وأرقام عملائك ومراجعيك أمانة مقدسة ومسؤولية نحرص عليها بأعلى المعايير. نلتزم التزاماً قاطعاً بعدم بيع، أو تأجير، أو مشاركة أي معلومة تخص نشاطك أو عملاءك لأي طرف ثالث نهائياً.
            </p>
          </div>

          <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '1.25rem 1.5rem', borderRadius: '16px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
            <h2 style={{ color: '#fff', fontSize: '1.15rem', marginBottom: '0.5rem', fontWeight: 700 }}>2. ما هي البيانات التي نتعامل معها؟</h2>
            <p style={{ marginBottom: '0.5rem' }}>
              • <strong>بيانات النشاط والخدمات:</strong> تفاصيل الخدمات، مواعيد العمل، كتالوج المنتجات، الأسعار، والإرشادات المخصصة التي تضعها ليعرضها البوت بدقة.
            </p>
            <p style={{ marginBottom: '0.5rem' }}>
              • <strong>بيانات العملاء والحجوزات والطلبات:</strong> (الاسم، رقم الهاتف، تفاصيل الموعد أو نوع الخدمة، والعنوان والولاية للشحنات) المتبادلة داخل المحادثات لغرض تنظيم جدول المواعيد، تسجيل الطلبات، أو المتابعة الفنية.
            </p>
            <p>
              • <strong>جلسات الربط الآمنة:</strong> يتم حفظ مفاتيح الاتصال مشفرة محلياً على السيرفر لتمكين البوت من أداء واجبه وإرسال الردود المعتمدة فقط.
            </p>
          </div>

          <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '1.25rem 1.5rem', borderRadius: '16px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
            <h2 style={{ color: '#fff', fontSize: '1.15rem', marginBottom: '0.5rem', fontWeight: 700 }}>3. معالجة الذكاء الاصطناعي الآمنة</h2>
            <p>
              تُمرر نصوص المحادثات إلى واجهة الذكاء الاصطناعي (Google Gemini) بأمان رقمي مشفر بهدف وحيد ومحدد: صياغة الرد المناسب بالدارجة وتثبيت الموعد أو الطلب، دون حفظها أو استغلالها لتدريب خارجي.
            </p>
          </div>

          <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '1.25rem 1.5rem', borderRadius: '16px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
            <h2 style={{ color: '#fff', fontSize: '1.15rem', marginBottom: '0.5rem', fontWeight: 700 }}>4. تحكم كامل وحرية مطلقة لصاحب النشاط</h2>
            <p>
              أنت صاحب القرار دائماً: يمكنك فصل اتصال واتساب أو تيليغرام بضغطة زر واحدة في أي لحظة من لوحة التحكم، وتستطيع مسح جلساتك وسجلاتك بالكامل، أو تعديل البيانات وطلب حذف حسابك نهائياً متى شئت.
            </p>
          </div>

          <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '1.25rem 1.5rem', borderRadius: '16px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
            <h2 style={{ color: '#fff', fontSize: '1.15rem', marginBottom: '0.5rem', fontWeight: 700 }}>5. التواصل المباشر مع الدعم</h2>
            <p>
              لأي استفسار تقني أو تنظيمي حول حسابك وبياناتك، فريقنا متاح دائماً عبر حساب الدعم المباشر على تيليغرام (@Dev_pythree) أو عبر واتساب لمساعدتك ومرافقة نجاح أعمالك خطوة بخطوة.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
