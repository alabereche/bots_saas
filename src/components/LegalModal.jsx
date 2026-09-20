import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// SVG Icons (pure inline, zero external dependencies)
function IconClose() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function IconShield() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function IconDocument() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  );
}

function IconLock() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function IconSparkle() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z" />
    </svg>
  );
}

function IconBulb() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="9" y1="18" x2="15" y2="18" />
      <line x1="10" y1="22" x2="14" y2="22" />
      <path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14" />
    </svg>
  );
}

function IconCheckCircle() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

export default function LegalModal({ isOpen, initialTab = 'terms', onClose }) {
  const [activeTab, setActiveTab] = useState(initialTab);

  // Sync initialTab when modal opens
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  // Handle Escape key and body scroll lock
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="lp2-modal-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-labelledby="legal-modal-title"
        >
          <motion.div
            className="lp2-modal-container"
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 14 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              type="button"
              className="lp2-modal-close"
              onClick={onClose}
              aria-label="إغلاق النافذة"
            >
              <IconClose />
            </button>

            {/* Header */}
            <div className="lp2-modal-header">
              <div className="lp2-modal-badge">
                <IconShield />
              </div>
              <h2 id="legal-modal-title" className="lp2-modal-title">
                {activeTab === 'terms' ? 'شروط الاستخدام والخدمة' : 'سياسة الخصوصية وحماية البيانات'}
              </h2>
              <p className="lp2-modal-sub">
                منصة AuraBot — شراكة تقنية مبنية على الشفافية والأمان والاحترافية
              </p>

              {/* Segmented Control Tabs */}
              <div className="lp2-modal-tabs">
                <button
                  type="button"
                  className={`lp2-modal-tab ${activeTab === 'terms' ? 'is-active' : ''}`}
                  onClick={() => setActiveTab('terms')}
                >
                  <IconDocument />
                  <span>شروط الاستخدام</span>
                </button>
                <button
                  type="button"
                  className={`lp2-modal-tab ${activeTab === 'privacy' ? 'is-active' : ''}`}
                  onClick={() => setActiveTab('privacy')}
                >
                  <IconLock />
                  <span>سياسة الخصوصية</span>
                </button>
              </div>
            </div>

            {/* Scrollable Body */}
            <div className="lp2-modal-body">
              {activeTab === 'terms' ? <TermsContent /> : <PrivacyContent />}
            </div>

            {/* Footer */}
            <div className="lp2-modal-footer">
              <span>تاريخ التحديث: سبتمبر 2026</span>
              <button
                type="button"
                className="lp2-modal-ok-btn"
                onClick={onClose}
              >
                فهمت وموافق
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── Content: Terms of Service ───
function TermsContent() {
  return (
    <>
      <div className="lp2-legal-section">
        <div className="lp2-legal-heading">
          <span className="lp2-legal-icon"><IconSparkle /></span>
          <span>1. ما هي منصة AuraBot؟ (مجال الخدمة الشامل)</span>
        </div>
        <p className="lp2-legal-text">
          منصة AuraBot هي حل برمجي سحابي متطور (SaaS) مخصص لدعم وأتمتة مختلف الأنشطة التجارية والخدمية (المتاجر الإلكترونية، العيادات والمراكز الصحية، المكاتب المهنية والاستشارية، المطاعم والمقاهي، وكالات العقارات والخدمات، والشركات). تهدف المنصة إلى تولي خدمة العملاء 24/7 عبر واتساب وتيليغرام بواسطة الذكاء الاصطناعي، بما في ذلك: الرد الفوري على الاستفسارات، حجز المواعيد والاستشارات، عرض قوائم الخدمات وكتالوج المنتجات بالصور، وتأكيد وتتبع الطلبيات والحجوزات آلياً.
        </p>
      </div>

      <div className="lp2-legal-section is-highlight">
        <div className="lp2-legal-heading">
          <span className="lp2-legal-icon"><IconBulb /></span>
          <span>2. أفضل الممارسات لربط واتساب (نصيحة ذهبية لشركائنا)</span>
        </div>
        <div className="lp2-legal-text">
          <p>
            • يتم ربط رقم واتساب عبر تقنية الربط الرقمي المباشر (كود الهاتف أو مسح الـ QR)، وتخضع أرقام واتساب لسياسات الاستخدام المعتادة لدى شركة WhatsApp لمكافحة المراسلات غير المرغوبة.
          </p>
          <p>
            • <strong>نصيحة عمل ذكية واحترافية:</strong> نوصي جميع أصحاب المشاريع والخدمات دائماً بتخصيص شريحة/رقم هاتف تجاري مستقل خاص بنشاط العمل أو العيادة أو المتجر وتفعيل البوت عليه. هذه الخطوة تمنحك فصلاً تاماً بين مراسلاتك الشخصية وأعمالك، وتتيح لك إدارة تواصلك مع العملاء بأريحية ومرونة وأمان كامل دون أي قلق على رقمك الشخصي حتى في أندر الحالات التقنية.
          </p>
        </div>
      </div>

      <div className="lp2-legal-section">
        <div className="lp2-legal-heading">
          <span className="lp2-legal-icon"><IconCheckCircle /></span>
          <span>3. دقة الردود والذكاء الاصطناعي (Gemini)</span>
        </div>
        <p className="lp2-legal-text">
          يعتمد محرك البوت على الذكاء الاصطناعي لفهم اللهجة الدارجة والتفاعل بأسلوب مهني لبق وفق التعليمات، قوائم الخدمات، أو كتالوج السلع التي تضبطها في لوحة التحكم. صاحب النشاط هو المرجع الأول لتحديد وتحديث تفاصيل خدماته، مواعيد عمله، أو أسعار عروضه لضمان دقة المعلومات المقدمة لعملائه.
        </p>
      </div>

      <div className="lp2-legal-section">
        <div className="lp2-legal-heading">
          <span className="lp2-legal-icon"><IconShield /></span>
          <span>4. الاستخدام الأخلاقي والمسؤول</span>
        </div>
        <p className="lp2-legal-text">
          صُممت AuraBot لتطوير جودة التواصل وخدمة العملاء والمراجعين الحقيقيين. يُحظر تماماً استخدام المنصة في إرسال الرسائل العشوائية المزعجة (Spam) لأرقام لم تبدِ اهتماماً مسبقاً، أو استغلال البوت في الترويج للمحتويات والأنشطة المخالفة للقانون، وذلك حفاظاً على استقرار أرقامكم وسلامة خوادم المنصة لجميع المشتركين.
        </p>
      </div>

      <div className="lp2-legal-section">
        <div className="lp2-legal-heading">
          <span className="lp2-legal-icon"><IconDocument /></span>
          <span>5. الاشتراكات والدفع والتفعيل</span>
        </div>
        <p className="lp2-legal-text">
          توفر المنصة باقة مجانية للبدء وتجربة كفاءة البوت في نشاطك، وباقة احترافية (1500 دج شهرياً) تفتح مزايا متقدمة (القناتين معاً، مزامنة Google Sheets، ربط الخدمات اللوجستية والشحن للـ 58 ولاية للمتاجر). يتم تفعيل الاشتراكات يدوياً وبسرعة عبر التحويل الميسّر (بريدي موب أو البطاقة الذهبية) وتستمر الصلاحية لكامل الفترة المشتراة.
        </p>
      </div>
    </>
  );
}

// ─── Content: Privacy Policy ───
function PrivacyContent() {
  return (
    <>
      <div className="lp2-legal-section is-highlight">
        <div className="lp2-legal-heading">
          <span className="lp2-legal-icon"><IconShield /></span>
          <span>1. أمانتك وسرية بياناتك (مبدؤنا الأساسي)</span>
        </div>
        <p className="lp2-legal-text">
          نحن في AuraBot نعتبر بيانات نشاطك، وملفات خدماتك، وأرقام عملائك ومراجعيك أمانة مقدسة ومسؤولية نحرص عليها بأعلى المعايير. نلتزم التزاماً قاطعاً بعدم بيع، أو تأجير، أو مشاركة أي معلومة تخص نشاطك أو عملاءك لأي طرف ثالث نهائياً.
        </p>
      </div>

      <div className="lp2-legal-section">
        <div className="lp2-legal-heading">
          <span className="lp2-legal-icon"><IconDocument /></span>
          <span>2. ما هي البيانات التي نتعامل معها؟</span>
        </div>
        <div className="lp2-legal-text">
          <p>
            • <strong>بيانات النشاط والخدمات:</strong> تفاصيل الخدمات، مواعيد العمل، كتالوج المنتجات، الأسعار، والإرشادات المخصصة التي تضعها ليعرضها البوت بدقة.
          </p>
          <p>
            • <strong>بيانات العملاء والحجوزات والطلبات:</strong> (الاسم، رقم الهاتف، تفاصيل الموعد أو نوع الخدمة، والعنوان والولاية للشحنات) المتبادلة داخل المحادثات لغرض تنظيم جدول المواعيد، تسجيل الطلبات، أو المتابعة الفنية.
          </p>
          <p>
            • <strong>جلسات الربط الآمنة:</strong> يتم حفظ مفاتيح الاتصال مشفرة محلياً على السيرفر لتمكين البوت من أداء واجبه وإرسال الردود المعتمدة فقط.
          </p>
        </div>
      </div>

      <div className="lp2-legal-section">
        <div className="lp2-legal-heading">
          <span className="lp2-legal-icon"><IconLock /></span>
          <span>3. معالجة الذكاء الاصطناعي الآمنة</span>
        </div>
        <p className="lp2-legal-text">
          تُمرر نصوص المحادثات إلى واجهة الذكاء الاصطناعي (Google Gemini) بأمان رقمي مشفر بهدف وحيد ومحدد: صياغة الرد المناسب بالدارجة وتثبيت الموعد أو الطلب، دون حفظها أو استغلالها لتدريب خارجي.
        </p>
      </div>

      <div className="lp2-legal-section">
        <div className="lp2-legal-heading">
          <span className="lp2-legal-icon"><IconCheckCircle /></span>
          <span>4. تحكم كامل وحرية مطلقة لصاحب النشاط</span>
        </div>
        <p className="lp2-legal-text">
          أنت صاحب القرار دائماً: يمكنك فصل اتصال واتساب أو تيليغرام بضغطة زر واحدة في أي لحظة من لوحة التحكم، وتستطيع مسح جلساتك وسجلاتك بالكامل، أو تعديل البيانات وطلب حذف حسابك نهائياً متى شئت.
        </p>
      </div>

      <div className="lp2-legal-section">
        <div className="lp2-legal-heading">
          <span className="lp2-legal-icon"><IconSparkle /></span>
          <span>5. التواصل المباشر مع الدعم</span>
        </div>
        <p className="lp2-legal-text">
          لأي استفسار تقني أو تنظيمي حول حسابك وبياناتك، فريقنا متاح دائماً عبر حساب الدعم المباشر على تيليغرام (@Dev_pythree) أو عبر واتساب لمساعدتك ومرافقة نجاح أعمالك خطوة بخطوة.
        </p>
      </div>
    </>
  );
}
