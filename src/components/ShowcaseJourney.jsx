import { useState, useEffect } from 'react';

const STEPS = [
  {
    id: 'create',
    title: '1. تخصيص البوت',
    subtitle: 'حدد اسم متجرك واللهجة وطريقة الرد',
  },
  {
    id: 'connect',
    title: '2. ربط QR فوري',
    subtitle: 'امسح الرمز لربط رقم واتساب في ثوانٍ',
  },
  {
    id: 'chat',
    title: '3. الرد الآلي الذكي',
    subtitle: 'استجابة فورية للزبائن باللهجة الجزائرية',
  },
  {
    id: 'orders',
    title: '4. حجز الطلبيات',
    subtitle: 'استخراج وتأكيد الطلبيات تلقائياً',
  },
];

export default function ShowcaseJourney() {
  const [activeStep, setActiveStep] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (isPaused) return;
    const interval = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % STEPS.length);
    }, 4500);
    return () => clearInterval(interval);
  }, [isPaused]);

  return (
    <div 
      className="journey-showcase-wrapper"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* ─── Top Interactive Step Navigation Tabs ─── */}
      <div className="journey-tabs-nav">
        {STEPS.map((step, index) => {
          const isActive = index === activeStep;
          return (
            <button
              key={step.id}
              type="button"
              className={`journey-tab-btn ${isActive ? 'active' : ''}`}
              onClick={() => setActiveStep(index)}
            >
              <div className="tab-btn-title">{step.title}</div>
              {isActive && (
                <div className="tab-progress-bar">
                  <div className="tab-progress-fill" key={activeStep} />
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* ─── Animated Journey Content Window ─── */}
      <div className="journey-screen-card">
        {/* Window Top Bar */}
        <div className="journey-screen-header">
          <div className="screen-dots">
            <span className="dot red" />
            <span className="dot yellow" />
            <span className="dot green" />
          </div>
          <div className="screen-step-label">
            <span className="pulse-indicator" />
            <span>{STEPS[activeStep].subtitle}</span>
          </div>
        </div>

        {/* Step Views */}
        <div className="journey-screen-body">
          {/* ──── STEP 0: Create & Customize Bot ──── */}
          {activeStep === 0 && (
            <div className="journey-view anim-fade-in">
              <div className="mock-form-header">
                <div className="mock-avatar-box">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="18" height="18" rx="4"/>
                    <circle cx="8.5" cy="8.5" r="1.5"/>
                    <circle cx="15.5" cy="8.5" r="1.5"/>
                    <path d="M9 14h6"/>
                  </svg>
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#ffffff' }}>إعداد بوت المتجر الجديد</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>الذكاء الاصطناعي جاهز للتهيئة في دقيقة</div>
                </div>
              </div>

              <div className="mock-field-grid">
                <div className="mock-field">
                  <span className="mock-label">اسم البوت / المتجر</span>
                  <div className="mock-input-val">متجر الأناقة سبور 👟</div>
                </div>
                <div className="mock-field">
                  <span className="mock-label">نشاط التجارة</span>
                  <div className="mock-input-val">أحذية وملابس رياضية</div>
                </div>
              </div>

              <div className="mock-field" style={{ marginTop: '8px' }}>
                <span className="mock-label">توجيهات الذكاء الاصطناعي واللهجة</span>
                <div className="mock-prompt-val">
                  "أنت بائع محترف وودود في متجر الأناقة. تجيب بالدارجة الجزائرية المحترمة، وتطلب من الزبون الاسم، العنوان ورقم الهاتف لتأكيد الطلبية..."
                </div>
              </div>

              <div className="mock-action-bar">
                <div className="mock-status-tag">⚡ تم تدريب النموذج</div>
                <div className="mock-save-btn">حفظ وتفعيل البوت ✓</div>
              </div>
            </div>
          )}

          {/* ──── STEP 1: Scan QR Code & Connect ──── */}
          {activeStep === 1 && (
            <div className="journey-view anim-fade-in">
              <div className="qr-screen-layout">
                {/* QR Code Box */}
                <div className="mock-qr-container">
                  <div className="qr-laser-scanner" />
                  <svg width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mock-qr-svg">
                    <rect x="2" y="2" width="8" height="8" rx="1" />
                    <rect x="4" y="4" width="4" height="4" fill="currentColor" />
                    <rect x="14" y="2" width="8" height="8" rx="1" />
                    <rect x="16" y="4" width="4" height="4" fill="currentColor" />
                    <rect x="2" y="14" width="8" height="8" rx="1" />
                    <rect x="4" y="16" width="4" height="4" fill="currentColor" />
                    <rect x="14" y="14" width="3" height="3" fill="currentColor" />
                    <rect x="19" y="14" width="3" height="3" fill="currentColor" />
                    <rect x="14" y="19" width="8" height="3" fill="currentColor" />
                  </svg>
                </div>

                {/* Connection Status Details */}
                <div className="qr-details-col">
                  <div className="conn-badge success">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                    <span>تم الربط مع WhatsApp بنجاح</span>
                  </div>

                  <div className="conn-meta-item">
                    <span className="conn-meta-label">الرقم المتصل:</span>
                    <span className="conn-meta-value" style={{ direction: 'ltr' }}>+213 555 12 34 56</span>
                  </div>

                  <div className="conn-meta-item">
                    <span className="conn-meta-label">محرك التشغيل:</span>
                    <span className="conn-meta-value">Baileys Multi-Device (سريع)</span>
                  </div>

                  <div className="conn-meta-item">
                    <span className="conn-meta-label">حالة البوت:</span>
                    <span className="conn-meta-value highlight-green">🟢 متصل 24/7 ويستقبل الرسائل</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ──── STEP 2: Live Intelligent AI Chat ──── */}
          {activeStep === 2 && (
            <div className="journey-view anim-fade-in">
              <div className="mock-chat-thread">
                {/* Customer Message */}
                <div className="mock-chat-bubble customer">
                  <div className="bubble-header">
                    <span>زبون جديد • WhatsApp</span>
                    <span>10:42 ص</span>
                  </div>
                  <div className="bubble-text">سلام عليكم، كاين حذاء نايك مقاس 42 في الأسود؟ والتوصيل لباتنة كاين؟</div>
                </div>

                {/* Bot Response */}
                <div className="mock-chat-bubble bot">
                  <div className="bubble-header">
                    <span style={{ color: '#34d399', fontWeight: 700 }}>AuraBot AI</span>
                    <span className="speed-pill">⚡ 0.8 ثانية</span>
                  </div>
                  <div className="bubble-text">
                    وعليكم السلام مرحباً بك! نعم متوفر حذاء نايك أسود مقاس 42 بسعر 4,500 دج 👟، والتوصيل لولاية باتنة متوفر بـ 400 دج مع الدفع عند الاستلام.
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#6ee7b7', marginTop: '4px' }}>
                    حاب نسجلك الطلبية درك خويا؟
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ──── STEP 3: Automated Orders in Dashboard ──── */}
          {activeStep === 3 && (
            <div className="journey-view anim-fade-in">
              <div className="orders-summary-bar">
                <div className="orders-stat-chip">
                  <span className="stat-label">طلبيات اليوم المحجوزة</span>
                  <span className="stat-num">18 طلبية آلياً</span>
                </div>
                <div className="orders-stat-chip">
                  <span className="stat-label">إجمالي المبيعات</span>
                  <span className="stat-num highlight-green">89,500 دج</span>
                </div>
              </div>

              <div className="mock-orders-list">
                {/* Order Item 1 */}
                <div className="mock-order-row">
                  <div className="order-check-icon">✓</div>
                  <div style={{ flex: 1 }}>
                    <div className="order-client-name">كريم زروقي • ولاية باتنة</div>
                    <div className="order-product-name">حذاء نايك مقاس 42 (أسود)</div>
                  </div>
                  <div className="order-price-tag">4,900 دج</div>
                  <div className="order-status-badge">مؤكدة آلياً</div>
                </div>

                {/* Order Item 2 */}
                <div className="mock-order-row">
                  <div className="order-check-icon">✓</div>
                  <div style={{ flex: 1 }}>
                    <div className="order-client-name">سارة بوزيد • ولاية وهران</div>
                    <div className="order-product-name">طقم رياضي نسائي (M)</div>
                  </div>
                  <div className="order-price-tag">6,200 دج</div>
                  <div className="order-status-badge">مؤكدة آلياً</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
