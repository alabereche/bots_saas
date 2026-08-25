import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import InteractivePlayground from '../components/InteractivePlayground';
import ModernBackground from '../components/ModernBackground';
import '../landing-redesign.css';

/* ═══════════════════════════════════════════════════════════════
   AuraBot Landing — crafted SVG set (inline, lightweight)
   One consistent system: 24px grid, 1.7 stroke, rounded caps,
   emerald/cyan two-tone accents. No external icon requests.
   ═══════════════════════════════════════════════════════════════ */

const LogoMark = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="12" cy="12" r="9" stroke="url(#lgRing)" strokeWidth="1.6" strokeDasharray="2.4 2.6" />
    <path d="M12 4.6L14.1 9.9L19.4 12L14.1 14.1L12 19.4L9.9 14.1L4.6 12L9.9 9.9L12 4.6Z" fill="url(#lgSpark)" />
    <circle cx="18.4" cy="5.6" r="1.5" fill="#22d3ee" />
    <defs>
      <linearGradient id="lgRing" x1="0" y1="0" x2="24" y2="24">
        <stop offset="0%" stopColor="#34d399" />
        <stop offset="100%" stopColor="#22d3ee" />
      </linearGradient>
      <linearGradient id="lgSpark" x1="4" y1="4" x2="20" y2="20">
        <stop offset="0%" stopColor="#a7f3d0" />
        <stop offset="100%" stopColor="#10b981" />
      </linearGradient>
    </defs>
  </svg>
);

const IconWhatsApp = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91C21.95 6.45 17.5 2 12.04 2zm.01 1.67c4.56 0 8.24 3.69 8.24 8.24s-3.68 8.24-8.24 8.24c-1.48 0-2.93-.39-4.19-1.15l-.3-.17-3.12.82.83-3.04-.2-.31a8.26 8.26 0 0 1-1.26-4.38c0-4.56 3.69-8.25 8.24-8.25zm-3.53 4.43c-.16 0-.43.06-.66.31-.22.25-.87.85-.87 2.07 0 1.22.89 2.39 1 2.56.12.16 1.73 2.77 4.23 3.77 2.06.82 2.48.66 2.93.62.45-.04 1.44-.59 1.64-1.16.2-.57.2-1.05.14-1.16-.06-.1-.22-.16-.47-.28-.25-.12-1.44-.71-1.66-.79-.22-.08-.39-.12-.55.12-.16.25-.64.79-.79.95-.14.16-.29.18-.53.06-.25-.12-1.05-.39-2-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.02-.38.11-.51.11-.11.25-.29.37-.43.12-.14.16-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.55-1.34-.76-1.83-.2-.48-.4-.42-.55-.43h-.46z" />
  </svg>
);

const IconTelegram = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M21.94 4.35a1.5 1.5 0 0 0-1.9-1.02L2.9 9.02c-1.06.35-1.08 1.87-.03 2.26l4.36 1.6 1.67 5.34c.29.93 1.44 1.18 2.08.46l2.32-2.6 4.3 3.16c.75.55 1.82.14 2.02-.77l2.5-12.9c.11-.55.05-1.06-.18-1.22zM8.5 12.2l8.9-5.53c.2-.12.4.15.23.3l-7.3 6.63c-.26.24-.43.55-.49.9l-.27 1.94c-.04.26-.4.29-.48.04l-1.05-3.5c-.12-.4.05-.83.4-1.05l.06.07z" />
  </svg>
);

const IconDialect = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M21 14.5a2 2 0 0 1-2 2H8l-4.5 4v-14a2 2 0 0 1 2-2H19a2 2 0 0 1 2 2v8z" stroke="url(#icA)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M8.5 9.5h7M8.5 12.5h4.5" stroke="#8b98ad" strokeWidth="1.7" strokeLinecap="round" />
    <circle cx="17.2" cy="12.4" r="1.1" fill="#34d399" />
    <defs>
      <linearGradient id="icA" x1="3" y1="4" x2="21" y2="19">
        <stop offset="0%" stopColor="#34d399" />
        <stop offset="100%" stopColor="#22d3ee" />
      </linearGradient>
    </defs>
  </svg>
);

const IconCatalog = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <rect x="3" y="4" width="18" height="16" rx="2.5" stroke="url(#icB)" strokeWidth="1.7" />
    <circle cx="8.6" cy="9.4" r="1.6" fill="#34d399" />
    <path d="M3.5 16.5l4.2-4a1.6 1.6 0 0 1 2.2-.05L14 16.2m0 0l2.3-2.1a1.6 1.6 0 0 1 2.2.03L20.5 16" stroke="#8b98ad" strokeWidth="1.7" strokeLinecap="round" />
    <path d="M17.5 4.2l.55 1.35L19.4 6.1l-1.35.55-.55 1.35-.55-1.35-1.35-.55 1.35-.55.55-1.35z" fill="#22d3ee" />
    <defs>
      <linearGradient id="icB" x1="3" y1="4" x2="21" y2="20">
        <stop offset="0%" stopColor="#34d399" />
        <stop offset="100%" stopColor="#22d3ee" />
      </linearGradient>
    </defs>
  </svg>
);

const IconOrders = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M9 3.5h6a1.5 1.5 0 0 1 1.5 1.5v1h-9V5A1.5 1.5 0 0 1 9 3.5z" stroke="#8b98ad" strokeWidth="1.7" />
    <rect x="4.5" y="6" width="15" height="14.5" rx="2.2" stroke="url(#icC)" strokeWidth="1.7" />
    <path d="M8.5 12.2l2.4 2.4 4.6-4.8" stroke="#34d399" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    <defs>
      <linearGradient id="icC" x1="4" y1="6" x2="20" y2="21">
        <stop offset="0%" stopColor="#34d399" />
        <stop offset="100%" stopColor="#22d3ee" />
      </linearGradient>
    </defs>
  </svg>
);

const IconTakeover = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="8" cy="8" r="3.2" stroke="url(#icD)" strokeWidth="1.7" />
    <path d="M2.8 19.5a5.2 5.2 0 0 1 10.4 0" stroke="url(#icD)" strokeWidth="1.7" strokeLinecap="round" />
    <path d="M16.5 5.5l3.5 3-3.5 3" stroke="#34d399" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M20 14.5l-3.5 3 3.5 3" stroke="#22d3ee" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    <defs>
      <linearGradient id="icD" x1="2" y1="4" x2="14" y2="21">
        <stop offset="0%" stopColor="#34d399" />
        <stop offset="100%" stopColor="#22d3ee" />
      </linearGradient>
    </defs>
  </svg>
);

const IconBellPin = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M18 9.5a6 6 0 1 0-12 0c0 5-2.2 6.2-2.2 6.2h16.4S18 14.5 18 9.5z" stroke="url(#icE)" strokeWidth="1.7" strokeLinejoin="round" />
    <path d="M10 19a2.2 2.2 0 0 0 4 0" stroke="#8b98ad" strokeWidth="1.7" strokeLinecap="round" />
    <circle cx="18.5" cy="4.5" r="2" fill="#f59e0b" />
    <defs>
      <linearGradient id="icE" x1="3" y1="3" x2="20" y2="17">
        <stop offset="0%" stopColor="#34d399" />
        <stop offset="100%" stopColor="#22d3ee" />
      </linearGradient>
    </defs>
  </svg>
);

const IconShield = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M12 2.8l7.5 2.8v6.1c0 4.6-3.2 8.3-7.5 9.5-4.3-1.2-7.5-4.9-7.5-9.5V5.6L12 2.8z" stroke="url(#icF)" strokeWidth="1.7" strokeLinejoin="round" />
    <path d="M8.8 12l2.3 2.3 4.1-4.4" stroke="#34d399" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    <defs>
      <linearGradient id="icF" x1="4" y1="2" x2="20" y2="22">
        <stop offset="0%" stopColor="#34d399" />
        <stop offset="100%" stopColor="#22d3ee" />
      </linearGradient>
    </defs>
  </svg>
);

const IconCatalogPencil = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M11 4.5H5a2 2 0 0 0-2 2V19a2 2 0 0 0 2 2h12.5a2 2 0 0 0 2-2v-6" stroke="url(#stA)" strokeWidth="1.8" strokeLinecap="round" />
    <path d="M17.8 3.2a2 2 0 0 1 2.9 2.9L13 13.8l-3.8 1 1-3.8 7.6-7.8z" stroke="#34d399" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    <defs>
      <linearGradient id="stA" x1="3" y1="4" x2="20" y2="21">
        <stop offset="0%" stopColor="#34d399" />
        <stop offset="100%" stopColor="#22d3ee" />
      </linearGradient>
    </defs>
  </svg>
);

const IconQrLink = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <rect x="3.5" y="3.5" width="7" height="7" rx="1.6" stroke="url(#stB)" strokeWidth="1.8" />
    <rect x="13.5" y="3.5" width="7" height="7" rx="1.6" stroke="url(#stB)" strokeWidth="1.8" />
    <rect x="3.5" y="13.5" width="7" height="7" rx="1.6" stroke="url(#stB)" strokeWidth="1.8" />
    <path d="M13.5 14.5h3v3h-3zM17 17h3.5v3.5H17z" fill="#34d399" />
    <defs>
      <linearGradient id="stB" x1="3" y1="3" x2="21" y2="21">
        <stop offset="0%" stopColor="#34d399" />
        <stop offset="100%" stopColor="#22d3ee" />
      </linearGradient>
    </defs>
  </svg>
);

const IconRocketCheck = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="12" cy="12" r="9" stroke="url(#stC)" strokeWidth="1.8" />
    <path d="M8 12.4l2.7 2.7L16.2 9" stroke="#34d399" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <defs>
      <linearGradient id="stC" x1="3" y1="3" x2="21" y2="21">
        <stop offset="0%" stopColor="#34d399" />
        <stop offset="100%" stopColor="#22d3ee" />
      </linearGradient>
    </defs>
  </svg>
);

/* Product illustration inside the hero chat (geometric GPU card) */
const GpuIllustration = () => (
  <svg width="100%" height="86" viewBox="0 0 200 86" fill="none" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <rect width="200" height="86" fill="url(#gpuBg)" />
    <rect x="38" y="26" width="112" height="40" rx="6" fill="#101a2e" stroke="#2b3b58" strokeWidth="1.4" />
    <circle cx="62" cy="46" r="11" fill="url(#gpuFan)" stroke="#3d5175" strokeWidth="1.2" />
    <circle cx="62" cy="46" r="5" stroke="#4d648c" strokeWidth="1" />
    <path d="M62 38v16M54 46h16" stroke="#4d648c" strokeWidth="1" />
    <circle cx="92" cy="46" r="11" fill="url(#gpuFan)" stroke="#3d5175" strokeWidth="1.2" />
    <circle cx="92" cy="46" r="5" stroke="#4d648c" strokeWidth="1" />
    <path d="M92 38v16M84 46h16" stroke="#4d648c" strokeWidth="1" />
    <rect x="112" y="36" width="28" height="7" rx="2" fill="#10b981" opacity="0.85" />
    <rect x="112" y="47" width="18" height="4" rx="2" fill="#22d3ee" opacity="0.6" />
    <path d="M150 20l4-8 4 8-4 8-4-8z" fill="#34d399" opacity="0.9" />
    <circle cx="168" cy="62" r="2" fill="#22d3ee" />
    <circle cx="30" cy="16" r="1.6" fill="#34d399" opacity="0.7" />
    <defs>
      <linearGradient id="gpuBg" x1="0" y1="0" x2="200" y2="86">
        <stop offset="0%" stopColor="#0c1526" />
        <stop offset="100%" stopColor="#0a2233" />
      </linearGradient>
      <radialGradient id="gpuFan" cx="0.35" cy="0.35" r="1">
        <stop offset="0%" stopColor="#1c2c4a" />
        <stop offset="100%" stopColor="#0e1830" />
      </radialGradient>
    </defs>
  </svg>
);

export default function Landing() {
  const { isAuthenticated } = useAuth();
  const [dailyMessages, setDailyMessages] = useState(60);

  // ROI Calculator formula
  const hoursSavedPerDay = (dailyMessages * 2.5 / 60).toFixed(1);
  const extraMonthlyOrders = Math.round(dailyMessages * 30 * 0.08);

  return (
    <div className="landing-page-root">
      <ModernBackground />

      {/* ─── Navigation ─── */}
      <header className="landing-navbar-wrapper">
        <nav className="landing-navbar">
          <Link to="/" className="landing-logo">
            <div className="landing-logo-icon"><LogoMark size={22} /></div>
            <span className="landing-logo-text">Aura<span style={{ color: '#10b981' }}>Bot</span></span>
          </Link>

          <div className="landing-nav-links">
            <a href="#interactive-demo" className="nav-link">المعاينة الحية</a>
            <a href="#how-it-works" className="nav-link">آلية العمل</a>
            <a href="#features" className="nav-link">المواصفات</a>
            <a href="#roi-calculator" className="nav-link">حاسبة التوفير</a>
            <a href="#pricing" className="nav-link">الاشتراكات</a>
          </div>

          <div className="landing-nav-actions">
            {isAuthenticated ? (
              <Link to="/dashboard" className="landing-cta-btn">
                <span>لوحة التحكم</span>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
                </svg>
              </Link>
            ) : (
              <Link to="/login" className="landing-cta-btn">
                <span>دخول المنصة</span>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
                </svg>
              </Link>
            )}
          </div>
        </nav>
      </header>

      {/* ─── Hero: story on one side, the living phone on the other ─── */}
      <section className="landing-hero-section">
        <div className="landing-container hero-split">

          <div className="hero-content-block">
            <div className="hero-badge">
              <span className="hero-badge-dot" />
              <span>مساعد مبيعات ذكي يفهم دارجتك • WhatsApp & Telegram</span>
            </div>

            <h1 className="hero-title">
              متجرك يبيع ويرد على الزبائن <span className="highlight-text-emerald">حتى وأنت نايم</span>
            </h1>

            <p className="hero-subtitle">
              بوت يفهم اللهجة الجزائرية، يعرض صور منتجاتك بجودة عالية، يؤكد الطلبية ويسجلها في لوحة التحكم —
              كل هذا يصير وحده، أنت تدير المبيعات فقط.
            </p>

            <div className="hero-cta-group">
              <Link to="/login" className="hero-btn-primary">
                <span>ابدأ مجاناً الآن</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
                </svg>
              </Link>
              <a href="#interactive-demo" className="hero-btn-secondary">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
                <span>جرّب المحاكي الحي</span>
              </a>
            </div>

            <div className="hero-metrics-row">
              <div className="metric-chip">
                <div className="metric-num">+50,000</div>
                <div className="metric-label">محادثة شهرياً</div>
              </div>
              <div className="metric-chip">
                <div className="metric-num highlight-emerald">0.8 ث</div>
                <div className="metric-label">سرعة الرد</div>
              </div>
              <div className="metric-chip">
                <div className="metric-num">58</div>
                <div className="metric-label">ولاية توصيل</div>
              </div>
              <div className="metric-chip">
                <div className="metric-num highlight-emerald">24/7</div>
                <div className="metric-label">بدون توقف</div>
              </div>
            </div>

            <div className="hero-channels-row">
              <span className="channel-chip wa"><IconWhatsApp size={15} /> WhatsApp</span>
              <span className="channel-chip tg"><IconTelegram size={15} /> Telegram</span>
            </div>
          </div>

          {/* ─── Signature: the 2:47 AM living phone ─── */}
          <div className="hero-phone-wrap" aria-hidden="true">
            <div className="phone-glow" />
            <div className="hero-phone">
              <div className="phone-screen">
                <div className="wa-header">
                  <div className="wa-avatar"><LogoMark size={17} /></div>
                  <div className="wa-header-info">
                    <span className="wa-name">باتنة تك — المتجر</span>
                    <span className="wa-status">متصل • يرد فوراً</span>
                  </div>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#8b98ad" strokeWidth="1.8">
                    <circle cx="12" cy="5" r="1.4" fill="#8b98ad" /><circle cx="12" cy="12" r="1.4" fill="#8b98ad" /><circle cx="12" cy="19" r="1.4" fill="#8b98ad" />
                  </svg>
                </div>

                <div className="wa-body">
                  <div className="wa-day-chip">الليلة • 2:47 ص</div>

                  <div className="wa-msg wa-customer wa-seq-1">
                    سلام خويا، عندكم RTX 4060؟ شحال؟
                    <span className="wa-time">2:47 ص</span>
                  </div>

                  <div className="wa-typing wa-seq-2">
                    <span /><span /><span />
                  </div>

                  <div className="wa-msg wa-bot wa-seq-3">
                    <div className="wa-product-card">
                      <GpuIllustration />
                      <div className="wa-product-info">
                        <strong>كارت RTX 4060 8GB</strong>
                        <div className="wa-price-row">
                          <span className="wa-price">64,000 دج</span>
                          <span className="wa-webp-badge">WebP</span>
                        </div>
                      </div>
                    </div>
                    <div className="wa-bot-text">واه متوفر خويا! كيما راك، نحجزولك وحدة؟</div>
                    <span className="wa-time wa-time-bot">2:47 ص <b className="wa-ticks">✓✓</b></span>
                  </div>

                  <div className="wa-msg wa-customer wa-seq-4">
                    واه حبيت نكوموندي، ها رقمي 0X XX XX XX XX
                    <span className="wa-time">2:48 ص</span>
                  </div>

                  <div className="wa-order-chip wa-seq-5">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2.6">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    تم تأكيد الطلبية — <b>#DZ-K7M2X9</b>
                  </div>
                </div>
              </div>
            </div>

            <div className="float-chip chip-1">⚡ يرد في 0.8 ثانية</div>
            <div className="float-chip chip-2">📦 الطلبية تتسجل وحدتها</div>
            <div className="float-chip chip-3">🌙 يرد حتى في الليل</div>
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
              تفاعل مع المحاكي، وشاهد كيف تُستخرج الطلبية وتُسجل في لوحة التاجر فوراً وبدقة.
            </p>
          </div>

          <InteractivePlayground />
        </div>
      </section>

      {/* ─── How It Works ─── */}
      <section className="landing-section" id="how-it-works">
        <div className="landing-container">
          <div className="section-header-center">
            <div className="section-pill">آلية التشغيل</div>
            <h2 className="section-title">
              ثلاث خطوات لبدء <span className="highlight-text-emerald">الأتمتة الشاملة</span>
            </h2>
            <p className="section-subtitle">إعداد فوري دون أي خبرة برمجية.</p>
          </div>

          <div className="how-it-works-grid">
            <div className="step-card">
              <div className="step-number-badge">1</div>
              <div className="step-icon-box"><IconCatalogPencil /></div>
              <h3 className="step-title">جهّز كتالوجك</h3>
              <p className="step-desc">
                أدخل نشاطك وأسعارك وصور منتجاتك — تُضغط تلقائياً WebP خفيفة وسريعة.
              </p>
            </div>

            <div className="step-card">
              <div className="step-number-badge">2</div>
              <div className="step-icon-box"><IconQrLink /></div>
              <h3 className="step-title">اربط قنواتك</h3>
              <p className="step-desc">
                واتساب بمسح رمز QR، تيليغرام بالتوكن، فيسبوك بنقرة — والخوادم تشتغل فوراً.
              </p>
            </div>

            <div className="step-card">
              <div className="step-number-badge">3</div>
              <div className="step-icon-box"><IconRocketCheck /></div>
              <h3 className="step-title">استلم الطلبيات</h3>
              <p className="step-desc">
                البوت يجيب، يعرض الصور، يستخرج الاسم والهاتف والعنوان ويسجل الطلب لوحده.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Bento Features ─── */}
      <section className="landing-section" id="features">
        <div className="landing-container">
          <div className="section-header-center">
            <div className="section-pill">القدرات التقنية</div>
            <h2 className="section-title">
              بنية مصممة خصيصاً <span className="highlight-text-emerald">للتجارة المحلية</span>
            </h2>
            <p className="section-subtitle">
              أتمتة كاملة لخدمة الزبائن، الطلبيات، والتوصيل — بمستوى هندسي عالمي.
            </p>
          </div>

          <div className="features-bento-grid">
            <div className="bento-card bento-wide bento-dialect">
              <div className="bento-dialect-text">
                <div className="bento-icon-box"><IconDialect /></div>
                <h3 className="bento-title">يفهم دارجتك الجزائرية بدقة</h3>
                <p className="bento-desc">
                  "شحال"، "واه"، "كاين"، "حبيت نكوموندي" — يفهم المصطلحات الدارجة وأسماء الولايات،
                  ويرد بأسلوب تاجر محترف يبيع فعلاً.
                </p>
              </div>
              <div className="dialect-cloud" aria-hidden="true">
                <span className="dialect-chip dialect-chip--hot dc-1">شحال هادي؟</span>
                <span className="dialect-chip dc-2">واه</span>
                <span className="dialect-chip dc-3">كاين؟</span>
                <span className="dialect-chip dc-4">حبيت نكومندي</span>
                <span className="dialect-chip dc-5">صحا!</span>
                <span className="dialect-chip dc-6">برك</span>
              </div>
            </div>

            <div className="bento-card">
              <div className="bento-icon-box"><IconCatalog /></div>
              <h3 className="bento-title">كتالوج صور WebP فائق السرعة</h3>
              <p className="bento-desc">
                صورة رئيسية + 4 زوايا إضافية، ضغط تلقائي يوفر 85% من الحجم، وترسل للزبون كألبوم فوري.
              </p>
              <div className="format-badges">
                <span className="format-badge format-badge--hot">WebP</span>
                <span className="format-badge">JPG</span>
                <span className="format-badge">PNG</span>
                <span className="format-badge">+4 زوايا</span>
              </div>
            </div>

            <div className="bento-card">
              <div className="bento-icon-box"><IconOrders /></div>
              <h3 className="bento-title">استخراج الطلبيات آلياً</h3>
              <p className="bento-desc">
                الاسم، الهاتف، الولاية، الكمية — تتجمع في لوحة مركزية جاهزة لإدارة الشحن.
              </p>
            </div>

            <div className="bento-card">
              <div className="bento-icon-box"><IconTakeover /></div>
              <h3 className="bento-title">تدخل بشري بنقرة واحدة</h3>
              <p className="bento-desc">
                ادخل أي محادثة ورد بنفسك — البوت يصمت لتلك المحادثة حتى تعيده بنقرة.
              </p>
            </div>

            <div className="bento-card">
              <div className="bento-icon-box"><IconBellPin /></div>
              <h3 className="bento-title">إشعار "وصلت طلبيتك"</h3>
              <p className="bento-desc">
                نقرة واحدة يخبر الزبون أن طرده وصل مع المبلغ والعنوان — دون أن تكتب حرفاً.
              </p>
            </div>

            <div className="bento-card bento-strip">
              <div className="bento-icon-box"><IconShield /></div>
              <div className="bento-strip-text">
                <h3 className="bento-title">أمان Zero-Trust وعزل تام</h3>
                <p className="bento-desc">
                  تحقق مشفر بهوية Firebase، وكل تاجر معزول بالكامل عن الآخرين — بياناتك لك وحدك.
                </p>
              </div>
              <div className="bento-strip-mark"><IconShield /></div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── ROI Calculator ─── */}
      <section className="landing-section roi-calc-section" id="roi-calculator">
        <div className="landing-container">
          <div className="roi-calculator-box">
            <div className="roi-header">
              <div className="section-pill">حاسبة العائد</div>
              <h2 className="roi-title">
                كم ستكسب <span className="highlight-text-emerald">بأتمتة محادثاتك؟</span>
              </h2>
              <p className="roi-subtitle">حرّك المؤشر حسب رسائل متجرك اليومية.</p>
            </div>

            <div className="roi-interactive-grid">
              <div className="roi-slider-block">
                <div className="slider-label-row">
                  <span>رسائل الزبائن يومياً:</span>
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
                  <div className="res-lbl">وقت موفّر يومياً لفريقك</div>
                </div>
                <div className="roi-result-card">
                  <div className="res-num">+{extraMonthlyOrders} طلبية</div>
                  <div className="res-lbl">مبيعات إضافية شهرياً</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Pricing ─── */}
      <section className="landing-section" id="pricing">
        <div className="landing-container">
          <div className="section-header-center">
            <div className="section-pill">الخطط والاشتراكات</div>
            <h2 className="section-title">
              مجاني 100% خلال <span className="highlight-text-emerald">مرحلة الإطلاق</span>
            </h2>
            <p className="section-subtitle">
              كل الميزات الاحترافية متاحة مجاناً للتجار المسجلين الآن.
            </p>
          </div>

          <div className="pricing-cards-grid">
            <div className="pricing-card">
              <div className="pricing-header">
                <div className="plan-badge-soon">مجاني أثناء الإطلاق</div>
                <h3 className="plan-name">الأساسية</h3>
                <div className="plan-price">
                  <span className="price-num">0 دج</span>
                  <span className="price-period">/ للأبد</span>
                </div>
                <p className="plan-desc">لبدء الأتمتة واستقبال الاستفسارات وتأكيد المبيعات.</p>
              </div>
              <div className="plan-features">
                {[
                  'بوت متصل (WhatsApp أو Telegram)',
                  'رسائل واستفسارات غير محدودة',
                  'استخراج وتأكيد الطلبيات آلياً',
                  'لوحة تحكم مع التدخل البشري',
                ].map(f => (
                  <div className="p-feat" key={f}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                    <span>{f}</span>
                  </div>
                ))}
              </div>
              <Link to="/login" className="plan-btn primary">ابدأ مجاناً</Link>
            </div>

            <div className="pricing-card featured">
              <div className="popular-badge">الأكثر طلباً للتجار</div>
              <div className="pricing-header">
                <div className="plan-badge-soon highlight">مجاني خلال الإطلاق</div>
                <h3 className="plan-name">الاحترافية Pro</h3>
                <div className="plan-price">
                  <span className="price-num">0 دج</span>
                  <span className="price-period">/ الإطلاق</span>
                </div>
                <p className="plan-desc">للمتاجر التي تريد مضاعفة مبيعاتها دون تأخير.</p>
              </div>
              <div className="plan-features">
                {[
                  'قنوات متعددة (WhatsApp + Telegram + Meta)',
                  'كتالوج صور WebP تلقائي',
                  'إشعار "وصلت طلبيتك" بنقرة واحدة',
                  'فهم اللهجات وإدارة الحالات الحرجة',
                  'أولوية معالجة ودعم مباشر',
                ].map(f => (
                  <div className="p-feat" key={f}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                    <span>{f}</span>
                  </div>
                ))}
              </div>
              <Link to="/login" className="plan-btn primary">فعّل الاحترافية مجاناً</Link>
            </div>

            <div className="pricing-card">
              <div className="pricing-header">
                <div className="plan-badge-soon">للمؤسسات</div>
                <h3 className="plan-name">الشركات والوكالات</h3>
                <div className="plan-price">
                  <span className="price-num">مخصص</span>
                </div>
                <p className="plan-desc">للتدفق اليومي الهائل من المحادثات.</p>
              </div>
              <div className="plan-features">
                {[
                  'بوتات وقنوات غير محدودة',
                  'خوادم معالجة مخصصة',
                  'ربط ERP وإدارة مخزون',
                  'مدير حساب على مدار الساعة',
                ].map(f => (
                  <div className="p-feat" key={f}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                    <span>{f}</span>
                  </div>
                ))}
              </div>
              <Link to="/login" className="plan-btn outline">تواصل مع الدعم</Link>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Final CTA ─── */}
      <section className="landing-section cta-banner-section">
        <div className="landing-container">
          <div className="cta-banner-box">
            <h2 className="cta-banner-title">
              جاهز تخلي متجرك يبيع وأنت نايم؟
            </h2>
            <p className="cta-banner-subtitle">
              أنشئ أول بوت ذكي لمتجرك في أقل من دقيقتين — مجاناً تماماً.
            </p>
            <div style={{ marginTop: '2rem' }}>
              <Link to="/login" className="hero-btn-primary">
                <span>إنشاء البوت الأول الآن</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
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
                <div className="landing-logo-icon"><LogoMark size={18} /></div>
                <span className="landing-logo-text">Aura<span style={{ color: '#10b981' }}>Bot</span></span>
              </div>
              <p className="footer-tagline">
                المنصة الرائدة لأتمتة خدمة العملاء ومبيعات التجارة الإلكترونية بالذكاء الاصطناعي.
              </p>
              <div className="hero-channels-row footer-channels">
                <span className="channel-chip wa"><IconWhatsApp size={14} /> WhatsApp</span>
                <span className="channel-chip tg"><IconTelegram size={14} /> Telegram</span>
              </div>
            </div>

            <div className="footer-links">
              <a href="#interactive-demo">المعاينة الحية</a>
              <a href="#how-it-works">آلية العمل</a>
              <a href="#features">المواصفات</a>
              <a href="#roi-calculator">حاسبة التوفير</a>
              <a href="#pricing">الاشتراكات</a>
              <Link to="/login">تسجيل الدخول</Link>
            </div>
          </div>

          <div className="footer-bottom">
            <span>© {new Date().getFullYear()} AuraBot. جميع الحقوق محفوظة.</span>
            <span>بنية مشفرة ومصممة للتجارة الجزائرية الحديثة</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
