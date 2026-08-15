import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import InteractivePlayground from '../components/InteractivePlayground';
import ModernBackground from '../components/ModernBackground';

export default function Landing() {
  const { isAuthenticated } = useAuth();

  return (
    <div className="landing-page-root">
      {/* Ambient backdrop */}
      <ModernBackground />

      {/* ─── Minimalist Top Navigation ─── */}
      <header className="landing-navbar-wrapper">
        <nav className="landing-navbar">
          <Link to="/" className="landing-logo">
            <div className="landing-logo-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                <path d="M2 17l10 5 10-5"/>
                <path d="M2 12l10 5 10-5"/>
              </svg>
            </div>
            <span className="landing-logo-text">BotForge</span>
          </Link>

          <div className="landing-nav-links">
            <a href="#interactive-demo" className="nav-link">المعاينة الحية</a>
            <a href="#how-it-works" className="nav-link">آلية العمل</a>
            <a href="#features" className="nav-link">المواصفات</a>
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
              <span>منظومة الذكاء الاصطناعي لأتمتة خدمة العملاء والتجارة</span>
            </div>

            <h1 className="hero-title">
              أتمتة ذكية لخدمة العملاء <br className="desktop-break" />
              عبر <span className="highlight-text-emerald">واتساب وتيليغرام على مدار الساعة</span>
            </h1>

            <p className="hero-subtitle">
              روبوت متطور يفهم اللهجة المحلية بدقة، يقدم استجابة فورية خلال أقل من ثانية، ويسجل بيانات الطلبيات آلياً في قاعدة بياناتك دون انقطاع.
            </p>

            <div className="hero-cta-group">
              <Link to="/login" className="hero-btn-primary">
                <span>بدء الاستخدام مجاناً</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
                </svg>
              </Link>
              <a href="#interactive-demo" className="hero-btn-secondary">
                <span>المعاينة التفاعلية</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </a>
            </div>

            {/* Metrics Row */}
            <div className="hero-metrics-row">
              <div className="metric-chip">
                <div className="metric-num">+50,000</div>
                <div className="metric-label">محادثة مؤتمتة شهرياً</div>
              </div>
              <div className="metric-chip">
                <div className="metric-num highlight-emerald">0.8 ثانية</div>
                <div className="metric-label">متوسط سرعة الاستجابة</div>
              </div>
              <div className="metric-chip">
                <div className="metric-num">58 ولاية</div>
                <div className="metric-label">تغطية شبكة التوصيل</div>
              </div>
              <div className="metric-chip">
                <div className="metric-num highlight-emerald">99.9%</div>
                <div className="metric-label">جاهزية واستقرار الخوادم</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Interactive Playground Section ─── */}
      <section className="landing-section playground-section" id="interactive-demo">
        <div className="landing-container">
          <div className="section-header-center">
            <div className="section-pill">بيئة التجربة الحية</div>
            <h2 className="section-title">
              اختبر سرعة ودقة الاستجابة <span className="highlight-text-emerald">في الوقت الفعلي</span>
            </h2>
            <p className="section-subtitle">
              تفاعل مع المحاكي واكتشف كيفية معالجة الاستفسارات وتأكيد الطلبيات تلقائياً.
            </p>
          </div>

          <InteractivePlayground />
        </div>
      </section>

      {/* ─── How It Works (3 Steps) ─── */}
      <section className="landing-section" id="how-it-works">
        <div className="landing-container">
          <div className="section-header-center">
            <div className="section-pill">آلية التشغيل</div>
            <h2 className="section-title">
              ثلاث خطوات لبدء <span className="highlight-text-emerald">الأتمتة الكاملة</span>
            </h2>
            <p className="section-subtitle">
              إعداد فوري وسلس دون الحاجة لأي متطلبات تقنية معقدة.
            </p>
          </div>

          <div className="how-it-works-grid">
            <div className="step-card">
              <div className="step-number-badge">01</div>
              <div className="step-icon-box">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
                </svg>
              </div>
              <h3 className="step-title">تهيئة معلومات النشاط</h3>
              <p className="step-desc">
                حدد طبيعة نشاطك، قائمة المنتجات، جداول الأسعار، وسياسة التوصيل المعتمدة.
              </p>
            </div>

            <div className="step-card">
              <div className="step-number-badge">02</div>
              <div className="step-icon-box">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
                  <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
                </svg>
              </div>
              <h3 className="step-title">ربط الحساب عبر رمز QR</h3>
              <p className="step-desc">
                امسح الرمز المباشر لربط واتساب أو تيليغرام بخوادم المنصة خلال ثوانٍ معدودة.
              </p>
            </div>

            <div className="step-card">
              <div className="step-number-badge">03</div>
              <div className="step-icon-box">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </div>
              <h3 className="step-title">معالجة وتأكيد الطلبيات</h3>
              <p className="step-desc">
                يباشر البوت خدمة العملاء واستقبال الطلبات وتنسيقها داخل لوحة التحكم المركزية.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Bento Grid Features ─── */}
      <section className="landing-section" id="features">
        <div className="landing-container">
          <div className="section-header-center">
            <div className="section-pill">القدرات التقنية</div>
            <h2 className="section-title">
              حلول مصممة لتلبية متطلبات <span className="highlight-text-emerald">التجارة الحديثة</span>
            </h2>
            <p className="section-subtitle">
              أدوات متكاملة لإدارة المحادثات ورفع كفاءة التحويلات التجارية.
            </p>
          </div>

          <div className="features-bento-grid">
            <div className="bento-card">
              <div className="bento-icon-box">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
              </div>
              <h3 className="bento-title">فهم اللهجات والسياق المحلي</h3>
              <p className="bento-desc">
                معالجة لغوية متقدمة تفهم التعبيرات المحلية، مصطلحات التسوق، وأسماء الولايات والبلديات بدقة.
              </p>
            </div>

            <div className="bento-card">
              <div className="bento-icon-box">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/>
                </svg>
              </div>
              <h3 className="bento-title">استخراج منظم لبيانات الطلبيات</h3>
              <p className="bento-desc">
                استخلاص الاسم، رقم الهاتف، العنوان، والمنتجات المطلوبة وترتيبها في جداول قابلة للتصدير.
              </p>
            </div>

            <div className="bento-card">
              <div className="bento-icon-box">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                </svg>
              </div>
              <h3 className="bento-title">استجابة سريعة وتوافر 24/7</h3>
              <p className="bento-desc">
                خدمة الزبائن في أوقات الذروة وخارج ساعات العمل الرسمية لضمان عدم ضياع أي فرصة بيع.
              </p>
            </div>

            <div className="bento-card">
              <div className="bento-icon-box">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7.5" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/>
                </svg>
              </div>
              <h3 className="bento-title">التحكم والتدخل المباشر</h3>
              <p className="bento-desc">
                إمكانية استلام المحادثة يدوياً في أي لحظة مع إيقاف مؤقت للبوت وإعادة تفعيله بنقرة واحدة.
              </p>
            </div>

            <div className="bento-card">
              <div className="bento-icon-box">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
                </svg>
              </div>
              <h3 className="bento-title">مؤشرات الأداء والتحليلات</h3>
              <p className="bento-desc">
                رصد دقيق لحجم المحادثات، عدد الطلبيات المؤكدة، ومعدلات التحويل عبر لوحة التحكم.
              </p>
            </div>

            <div className="bento-card">
              <div className="bento-icon-box">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
              </div>
              <h3 className="bento-title">بنية تحتية مشفرة ومحمية</h3>
              <p className="bento-desc">
                حماية شاملة لكافة البيانات والمعاملات بالاعتماد على خوادم Google Cloud و Firebase الآمنة.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Pricing Section (Coming Soon) ─── */}
      <section className="landing-section" id="pricing">
        <div className="landing-container">
          <div className="section-header-center">
            <div className="section-pill">الخطط والاشتراكات</div>
            <h2 className="section-title">
              خطط وباقات الأسعار <span className="highlight-text-emerald">تتوفر قريباً</span>
            </h2>
            <p className="section-subtitle">
              المنصة حالياً في مرحلة الإطلاق التجريبي — جميع الميزات والخدمات متاحة مجاناً 100% لجميع المستخدمين المسجلين!
            </p>
          </div>

          <div className="pricing-cards-grid">
            {/* Starter */}
            <div className="pricing-card">
              <div className="pricing-header">
                <div className="plan-badge-soon">مجاني أثناء الإطلاق</div>
                <h3 className="plan-name">الخطة الأساسية</h3>
                <div className="plan-price">
                  <span className="price-num coming-soon-text">Coming Soon</span>
                </div>
                <p className="plan-desc">لتجربة النظام واختبار الاستجابة الآلية.</p>
              </div>
              <div className="plan-features">
                <div className="p-feat">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                  <span>بوت واحد (WhatsApp أو Telegram)</span>
                </div>
                <div className="p-feat">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                  <span>رسائل واستفسارات غير محدودة</span>
                </div>
                <div className="p-feat">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                  <span>تسجيل الطلبيات الأساسي</span>
                </div>
                <div className="p-feat">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                  <span>الدعم الفني المباشر</span>
                </div>
              </div>
              <Link to="/login" className="plan-btn primary">بدء الاستخدام مجاناً</Link>
            </div>

            {/* Pro (Featured) */}
            <div className="pricing-card featured">
              <div className="popular-badge">Coming Soon — قريباً</div>
              <div className="pricing-header">
                <div className="plan-badge-soon highlight">الأكثر طلباً</div>
                <h3 className="plan-name">الخطة الاحترافية</h3>
                <div className="plan-price">
                  <span className="price-num coming-soon-text">Coming Soon</span>
                </div>
                <p className="plan-desc">للمتاجر والشركات المتنامية لزيادة حجم المبيعات.</p>
              </div>
              <div className="plan-features">
                <div className="p-feat">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                  <span>حتى 3 قنوات اتصال متزامنة</span>
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
                  <span>خاصية التدخل المباشر (Takeover)</span>
                </div>
                <div className="p-feat">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                  <span>أولوية الدعم الفني المباشر</span>
                </div>
              </div>
              <Link to="/login" className="plan-btn primary">بدء الاستخدام مجاناً</Link>
            </div>

            {/* Enterprise */}
            <div className="pricing-card">
              <div className="pricing-header">
                <div className="plan-badge-soon">للشركات والمؤسسات</div>
                <h3 className="plan-name">خطة الشركات</h3>
                <div className="plan-price">
                  <span className="price-num coming-soon-text">Coming Soon</span>
                </div>
                <p className="plan-desc">للعمليات المؤسسية ذات التدفق العالي.</p>
              </div>
              <div className="plan-features">
                <div className="p-feat">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                  <span>عدد غير محدود من القنوات والبوتات</span>
                </div>
                <div className="p-feat">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                  <span>خوادم مخصصة عالية السرعة</span>
                </div>
                <div className="p-feat">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                  <span>تكامل برمجيات مخصصة مع نظامك</span>
                </div>
                <div className="p-feat">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                  <span>مدير حساب مخصص على مدار الساعة</span>
                </div>
              </div>
              <Link to="/login" className="plan-btn outline">طلب استشارة مجانية</Link>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Final CTA ─── */}
      <section className="landing-section cta-banner-section">
        <div className="landing-container">
          <div className="cta-banner-box">
            <h2 className="cta-banner-title">
              جاهز لأتمتة خدمة عملائك ورفع كفاءة مبيعاتك؟
            </h2>
            <p className="cta-banner-subtitle">
              ابدأ الآن وأنشئ أول بوت ذكي لمتجرك في دقائق معدودة.
            </p>
            <div style={{ marginTop: '1.75rem' }}>
              <Link to="/login" className="hero-btn-primary">
                <span>إنشاء البوت الأول مجاناً</span>
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
                <div className="landing-logo-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                    <path d="M2 17l10 5 10-5"/>
                    <path d="M2 12l10 5 10-5"/>
                  </svg>
                </div>
                <span className="landing-logo-text">BotForge</span>
              </div>
              <p className="footer-tagline">
                منصة أتمتة خدمة العملاء وإدارة طلبات التجارة الإلكترونية بالذكاء الاصطناعي.
              </p>
            </div>

            <div className="footer-links">
              <a href="#interactive-demo">المعاينة الحية</a>
              <a href="#how-it-works">آلية العمل</a>
              <a href="#features">المواصفات</a>
              <a href="#pricing">الاشتراكات</a>
              <Link to="/login">تسجيل الدخول</Link>
            </div>
          </div>

          <div className="footer-bottom">
            <span>© {new Date().getFullYear()} BotForge. جميع الحقوق محفوظة.</span>
            <span>البنية التحتية المؤمنة لأنشطة التجارة الرقمية</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
