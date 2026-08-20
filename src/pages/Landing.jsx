import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import InteractivePlayground from '../components/InteractivePlayground';
import ModernBackground from '../components/ModernBackground';

export default function Landing() {
  const { isAuthenticated } = useAuth();
  const [dailyMessages, setDailyMessages] = useState(60);

  // ROI Calculator formula
  const hoursSavedPerDay = (dailyMessages * 2.5 / 60).toFixed(1);
  const extraMonthlyOrders = Math.round(dailyMessages * 30 * 0.08);

  return (
    <div className="landing-page-root">
      {/* Ambient background atmosphere */}
      <ModernBackground />

      {/* ─── Top Floating Glass Capsule Navigation ─── */}
      <header className="landing-navbar-wrapper">
        <nav className="landing-navbar">
          <Link to="/" className="landing-logo">
            <div className="landing-logo-icon" style={{ background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(6, 182, 212, 0.1) 100%)', border: '1px solid rgba(52, 211, 153, 0.35)', borderRadius: '12px', width: '38px', height: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 14px rgba(16, 185, 129, 0.25)' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="9" stroke="url(#auraRingGradNav)" strokeWidth="1.8" strokeDasharray="2.5 2.5"/>
                <path d="M12 4.5L14.2 9.8L19.5 12L14.2 14.2L12 19.5L9.8 14.2L4.5 12L9.8 9.8L12 4.5Z" fill="url(#auraSparkGradNav)"/>
                <defs>
                  <linearGradient id="auraRingGradNav" x1="0" y1="0" x2="24" y2="24">
                    <stop offset="0%" stopColor="#34d399"/>
                    <stop offset="100%" stopColor="#06b6d4"/>
                  </linearGradient>
                  <linearGradient id="auraSparkGradNav" x1="4" y1="4" x2="20" y2="20">
                    <stop offset="0%" stopColor="#6ee7b7"/>
                    <stop offset="100%" stopColor="#10b981"/>
                  </linearGradient>
                </defs>
              </svg>
            </div>
            <span className="landing-logo-text">Aura<span style={{ color: '#10b981' }}>Bot</span></span>
          </Link>

          <div className="landing-nav-links">
            <a href="#interactive-demo" className="nav-link">المعاينة الحية</a>
            <a href="#how-it-works" className="nav-link">آلية العمل</a>
            <a href="#features" className="nav-link">المواصفات التقنية</a>
            <a href="#roi-calculator" className="nav-link">حاسبة التوفير</a>
            <a href="#pricing" className="nav-link">الاشتراكات</a>
          </div>

          <div className="landing-nav-actions">
            {isAuthenticated ? (
              <Link to="/dashboard" className="landing-cta-btn">
                <span>لوحة التحكم</span>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
                </svg>
              </Link>
            ) : (
              <Link to="/login" className="landing-cta-btn">
                <span>دخول المنصة</span>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
                </svg>
              </Link>
            )}
          </div>
        </nav>
      </header>

      {/* ─── Hero Section ─── */}
      <section className="landing-hero-section">
        <div className="landing-container">
          <div className="hero-content-block">
            <div className="hero-badge">
              <span className="hero-badge-dot" />
              <span>الجيل القادم من الذكاء الاصطناعي التجاري • WhatsApp & Telegram</span>
            </div>

            <h1 className="hero-title">
              حوّل كل محادثة إلى <span className="highlight-text-emerald">مبيعات مؤكدة 24/7</span><br className="desktop-break" />
              دون الحاجة لفريق دعم يدوي
            </h1>

            <p className="hero-subtitle">
              أول منظومة ذكاء اصطناعي تفهم اللهجة الجزائرية والمحلية بدقة، ترسل صور المنتجات بجودة عالية وسرعة فائقة (WebP)، وتستخرج وتسجل الطلبيات آلياً في قاعدة بياناتك دون انقطاع.
            </p>

            <div className="hero-cta-group">
              <Link to="/login" className="hero-btn-primary">
                <span>بدء الاستخدام مجاناً</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
                </svg>
              </Link>
              <a href="#interactive-demo" className="hero-btn-secondary">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="5 3 19 12 5 21 5 3"/>
                </svg>
                <span>تجربة المحاكي التفاعلي</span>
              </a>
            </div>

            {/* Metrics Ribbon */}
            <div className="hero-metrics-row">
              <div className="metric-chip">
                <div className="metric-num">+50,000</div>
                <div className="metric-label">محادثة معالجة شهرياً</div>
              </div>
              <div className="metric-chip">
                <div className="metric-num highlight-emerald">0.8 ثانية</div>
                <div className="metric-label">متوسط سرعة الرد</div>
              </div>
              <div className="metric-chip">
                <div className="metric-num">58 ولاية</div>
                <div className="metric-label">تغطية شبكة التوصيل</div>
              </div>
              <div className="metric-chip">
                <div className="metric-num highlight-emerald">99.99%</div>
                <div className="metric-label">استقرار وجاهزية الخوادم</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Interactive Dual-Terminal Section ─── */}
      <section className="landing-section playground-section" id="interactive-demo">
        <div className="landing-container">
          <div className="section-header-center">
            <div className="section-pill">المعاينة الحية المتزامنة</div>
            <h2 className="section-title">
              شاهد كيف يعمل النظام <span className="highlight-text-emerald">بين الزبون ولوحة التحكم</span>
            </h2>
            <p className="section-subtitle">
              تفاعل مع المحاكي على اليسار، وشاهد كيف تُستخرج وتُسجل الطلبية في لوحة تحكم التاجر على اليمين فوراً وبدقة متناهية.
            </p>
          </div>

          <InteractivePlayground />
        </div>
      </section>

      {/* ─── How It Works (Sequential Architecture) ─── */}
      <section className="landing-section" id="how-it-works">
        <div className="landing-container">
          <div className="section-header-center">
            <div className="section-pill">آلية التشغيل</div>
            <h2 className="section-title">
              ثلاث خطوات لبدء <span className="highlight-text-emerald">الأتمتة الشاملة</span>
            </h2>
            <p className="section-subtitle">
              إعداد فوري وسهل دون الحاجة لأي خبرة برمجية.
            </p>
          </div>

          <div className="how-it-works-grid">
            <div className="step-card">
              <div className="step-number-badge">1</div>
              <div className="step-icon-box">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
              </div>
              <h3 className="step-title">تهيئة الكتالوج والأسعار</h3>
              <p className="step-desc">
                أدخل اسم نشاطك، أسعار المنتجات، وصورها ليتم ضغطها وتجهيزها تلقائياً بصيغة WebP خفيفة وفائقة السرعة.
              </p>
            </div>

            <div className="step-card">
              <div className="step-number-badge">2</div>
              <div className="step-icon-box">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
                  <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
                </svg>
              </div>
              <h3 className="step-title">ربط قنوات التواصل (QR / Token)</h3>
              <p className="step-desc">
                اربط حساب واتساب بمسح رمز QR أو تيليغرام عبر التوكن لتبدأ الخوادم بالعمل والمزامنة فوراً.
              </p>
            </div>

            <div className="step-card">
              <div className="step-number-badge">3</div>
              <div className="step-icon-box">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </div>
              <h3 className="step-title">استقبال وأرشفة الطلبيات</h3>
              <p className="step-desc">
                يقوم البوت بالإجابة عن الاستفسارات، إرسال صور المنتجات، واستخراج الاسم والهاتف والعنوان وتسجيل الطلب بالكامل.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Bento Grid Features ─── */}
      <section className="landing-section" id="features">
        <div className="landing-container">
          <div className="section-header-center">
            <div className="section-pill">القدرات التقنية الحصرية</div>
            <h2 className="section-title">
              بنية تحتية هندسية مصممة خصيصاً <span className="highlight-text-emerald">للتجارة المحلية</span>
            </h2>
            <p className="section-subtitle">
              أقوى منظومة لأتمتة خدمة الزبائن، التوصيل، وإدارة المحادثات الحساسة.
            </p>
          </div>

          <div className="features-bento-grid">
            {/* Featured Card 1: Local Dialect NLP */}
            <div className="bento-card bento-wide">
              <div className="bento-icon-box">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
              </div>
              <h3 className="bento-title">معالجة اللهجة الجزائرية والمحلية بدقة متناهية</h3>
              <p className="bento-desc">
                يفهم البوت المصطلحات الدارجة ("شحال"، "واه"، "كاين"، "حبيت نكوموندي")، وأسماء الولايات والبلديات، ويجيب بأسلوب تجاري راقٍ ومقنع يشبه تعامل خبير مبيعات محترف.
              </p>
            </div>

            {/* Featured Card 2: Visual Catalog */}
            <div className="bento-card">
              <div className="bento-icon-box">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
                </svg>
              </div>
              <h3 className="bento-title">كتالوج صور المنتجات الذكي (WebP)</h3>
              <p className="bento-desc">
                ضغط تلقائي للصور وتقليص حجمها بنسبة 85% لترسل للزبائن كألبوم أو صورة أساسية بسرعة البرق.
              </p>
            </div>

            {/* Featured Card 3: Automated Orders */}
            <div className="bento-card">
              <div className="bento-icon-box">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/>
                </svg>
              </div>
              <h3 className="bento-title">استخراج منظم لبيانات الطلبيات</h3>
              <p className="bento-desc">
                استخراج الاسم، رقم الهاتف، الولاية، والكمية وتجميعها في جدول مركزي قابل للتصدير وإدارة الشحن.
              </p>
            </div>

            {/* Featured Card 4: Human Takeover */}
            <div className="bento-card">
              <div className="bento-icon-box">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7.5" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/>
                </svg>
              </div>
              <h3 className="bento-title">التدخل البشري المباشر (Takeover)</h3>
              <p className="bento-desc">
                يمكنك الدخول إلى أي محادثة في لوحة التحكم والرد يدوياً بنقرة واحدة مع إيقاف البوت مؤقتاً لتلك المحادثة.
              </p>
            </div>

            {/* Featured Card 5: Arrival Notification */}
            <div className="bento-card">
              <div className="bento-icon-box">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
                </svg>
              </div>
              <h3 className="bento-title">إشعار وصول الطلبية والاستلام</h3>
              <p className="bento-desc">
                عند النقر على "وصلت الطلبية"، يرسل البوت إشعاراً فورياً للزبون بأن طرده جاهز للاستلام مع المبلغ والعنوان.
              </p>
            </div>

            {/* Featured Card 6: Zero-Trust Security */}
            <div className="bento-card">
              <div className="bento-icon-box">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
              </div>
              <h3 className="bento-title">أمان Zero-Trust وعزل البيانات</h3>
              <p className="bento-desc">
                تحقق مشفر بالكامل من الهوية عبر Firebase Auth، وعزل تام لملفات وسجلات كل تاجر عن الآخرين.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Interactive ROI Calculator ─── */}
      <section className="landing-section roi-calc-section" id="roi-calculator">
        <div className="landing-container">
          <div className="roi-calculator-box">
            <div className="roi-header">
              <div className="section-pill">حاسبة العائد والتوفير</div>
              <h2 className="roi-title">
                اكتشف كم من الوقت والمبيعات ستكسب <span className="highlight-text-emerald">بأتمتة محادثاتك</span>
              </h2>
              <p className="roi-subtitle">
                حرّك المؤشر بناءً على متوسط عدد الرسائل اليومية التي يتلقاها متجرك.
              </p>
            </div>

            <div className="roi-interactive-grid">
              <div className="roi-slider-block">
                <div className="slider-label-row">
                  <span>عدد رسائل الزبائن يومياً:</span>
                  <span className="slider-value-badge">{dailyMessages} رسالة/يوم</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="300"
                  step="5"
                  value={dailyMessages}
                  onChange={e => setDailyMessages(Number(e.target.value))}
                  className="roi-range-input"
                />
                <div className="slider-scale-row">
                  <span>10 رسائل</span>
                  <span>150 رسالة</span>
                  <span>300+ رسالة</span>
                </div>
              </div>

              <div className="roi-results-cards">
                <div className="roi-result-card">
                  <div className="res-num emerald-res">{hoursSavedPerDay} ساعة</div>
                  <div className="res-lbl">وقت عمل موفّر يومياً لفريقك</div>
                </div>
                <div className="roi-result-card">
                  <div className="res-num">+{extraMonthlyOrders} طلبية</div>
                  <div className="res-lbl">مبيعات إضافية مسترجعة شهرياً</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Pricing Section (Early Access Launch) ─── */}
      <section className="landing-section" id="pricing">
        <div className="landing-container">
          <div className="section-header-center">
            <div className="section-pill">الخطط والاشتراكات</div>
            <h2 className="section-title">
              مجاني 100% خلال <span className="highlight-text-emerald">مرحلة الإطلاق الأولي</span>
            </h2>
            <p className="section-subtitle">
              جميع الميزات الاحترافية، الربط اللامحدود، وكتالوج الصور متاحة مجاناً لكافة التجار المسجلين الآن!
            </p>
          </div>

          <div className="pricing-cards-grid">
            {/* Starter */}
            <div className="pricing-card">
              <div className="pricing-header">
                <div className="plan-badge-soon">مجاني أثناء الإطلاق</div>
                <h3 className="plan-name">الخطة الأساسية</h3>
                <div className="plan-price">
                  <span className="price-num">0 دج</span>
                  <span className="price-period">/ مدى الحياة</span>
                </div>
                <p className="plan-desc">لبدء تجربة الأتمتة واستقبال الاستفسارات وتأكيد المبيعات.</p>
              </div>
              <div className="plan-features">
                <div className="p-feat">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                  <span>بوت متصل (WhatsApp أو Telegram)</span>
                </div>
                <div className="p-feat">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                  <span>رسائل واستفسارات غير محدودة</span>
                </div>
                <div className="p-feat">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                  <span>استخراج وتأكيد الطلبيات آلياً</span>
                </div>
                <div className="p-feat">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                  <span>لوحة تحكم مركزية مع التدخل البشري</span>
                </div>
              </div>
              <Link to="/login" className="plan-btn primary">بدء الاستخدام مجاناً</Link>
            </div>

            {/* Pro (Featured) */}
            <div className="pricing-card featured">
              <div className="popular-badge">الأكثر طلباً للتجار</div>
              <div className="pricing-header">
                <div className="plan-badge-soon highlight">مجاني خلال الإطلاق</div>
                <h3 className="plan-name">الخطة الاحترافية (Pro)</h3>
                <div className="plan-price">
                  <span className="price-num">0 دج</span>
                  <span className="price-period">/ مرحلة الإطلاق</span>
                </div>
                <p className="plan-desc">للمتاجر والعلامات التجارية التي تسعى لمضاعفة مبيعاتها دون تأخير.</p>
              </div>
              <div className="plan-features">
                <div className="p-feat">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                  <span>قنوات متعددة متزامنة (WhatsApp + Telegram)</span>
                </div>
                <div className="p-feat">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                  <span>كتالوج صور المنتجات مع ضغط WebP التلقائي</span>
                </div>
                <div className="p-feat">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                  <span>إشعار "وصلت الطلبية جاهزة للاستلام" بنقرة واحدة</span>
                </div>
                <div className="p-feat">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                  <span>فهم اللهجات الدارجة وإدارة الحالات الحرجة</span>
                </div>
                <div className="p-feat">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                  <span>أولوية المعالجة والدعم الفني المباشر</span>
                </div>
              </div>
              <Link to="/login" className="plan-btn primary">تفعيل الباقة الاحترافية مجاناً</Link>
            </div>

            {/* Enterprise */}
            <div className="pricing-card">
              <div className="pricing-header">
                <div className="plan-badge-soon">للمؤسسات والشركات</div>
                <h3 className="plan-name">خطة الشركات والوكالات</h3>
                <div className="plan-price">
                  <span className="price-num">مخصص</span>
                </div>
                <p className="plan-desc">للشركات الكبرى ذات التدفق اليومي الهائل من المحادثات.</p>
              </div>
              <div className="plan-features">
                <div className="p-feat">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                  <span>عدد غير محدود من البوتات والقنوات</span>
                </div>
                <div className="p-feat">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                  <span>خوادم معالجة مخصصة عالية السرعة</span>
                </div>
                <div className="p-feat">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                  <span>ربط مخصص مع أنظمة ERP وإدارة المخزون</span>
                </div>
                <div className="p-feat">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                  <span>مدير حساب وتقني مخصص على مدار 24 ساعة</span>
                </div>
              </div>
              <Link to="/login" className="plan-btn outline">تواصل مع فريق الدعم</Link>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Final High-Impact CTA ─── */}
      <section className="landing-section cta-banner-section">
        <div className="landing-container">
          <div className="cta-banner-box">
            <h2 className="cta-banner-title">
              جاهز لأتمتة خدمة عملائك ومضاعفة مبيعاتك اليوم؟
            </h2>
            <p className="cta-banner-subtitle">
              انضم إلى مئات التجار وأنشئ أول بوت ذكي لمتجرك خلال أقل من دقيقتين مجاناً.
            </p>
            <div style={{ marginTop: '2rem' }}>
              <Link to="/login" className="hero-btn-primary">
                <span>إنشاء البوت الأول الآن مجاناً</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
                </svg>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="landing-footer">
        <div className="landing-container">
          <div className="footer-content">
            <div className="footer-brand">
              <div className="landing-logo">
                <div className="landing-logo-icon" style={{ background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(6, 182, 212, 0.1) 100%)', border: '1px solid rgba(52, 211, 153, 0.35)', borderRadius: '10px', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="9" stroke="url(#auraRingGradFoot)" strokeWidth="1.8" strokeDasharray="2.5 2.5"/>
                    <path d="M12 4.5L14.2 9.8L19.5 12L14.2 14.2L12 19.5L9.8 14.2L4.5 12L9.8 9.8L12 4.5Z" fill="url(#auraSparkGradFoot)"/>
                    <defs>
                      <linearGradient id="auraRingGradFoot" x1="0" y1="0" x2="24" y2="24">
                        <stop offset="0%" stopColor="#34d399"/>
                        <stop offset="100%" stopColor="#06b6d4"/>
                      </linearGradient>
                      <linearGradient id="auraSparkGradFoot" x1="4" y1="4" x2="20" y2="20">
                        <stop offset="0%" stopColor="#6ee7b7"/>
                        <stop offset="100%" stopColor="#10b981"/>
                      </linearGradient>
                    </defs>
                  </svg>
                </div>
                <span className="landing-logo-text">Aura<span style={{ color: '#10b981' }}>Bot</span></span>
              </div>
              <p className="footer-tagline">
                المنصة الرائدة لأتمتة خدمة العملاء وإدارة مبيعات التجارة الإلكترونية بالذكاء الاصطناعي.
              </p>
            </div>

            <div className="footer-links">
              <a href="#interactive-demo">المعاينة الحية</a>
              <a href="#how-it-works">آلية العمل</a>
              <a href="#features">المواصفات التقنية</a>
              <a href="#roi-calculator">حاسبة التوفير</a>
              <a href="#pricing">الاشتراكات</a>
              <Link to="/login">تسجيل الدخول</Link>
            </div>
          </div>

          <div className="footer-bottom">
            <span>© {new Date().getFullYear()} AuraBot. جميع الحقوق محفوظة.</span>
            <span>بنية تحتية مشفرة ومصممة للتجارة الحديثة</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
