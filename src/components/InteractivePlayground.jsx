import { useState, useRef, useEffect } from 'react';

const NICHES = [
  {
    id: 'tech',
    name: 'الإلكترونيات والأجهزة',
    productName: 'ساعة ذكية Ultra Smartwatch مع 3 أحزمة',
    productPrice: '7,300 دج',
    productImg: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500&auto=format&fit=crop&q=80',
    initialBot: 'مرحباً بك في متجر Batna Tech! تفضل كيف يمكنني مساعدتك اليوم؟ يمكنك السؤال عن الأسعار، المواصفات، أو طلب أي منتج فوراً.',
    quickPrompts: [
      'أريد رؤية صور ومواصفات الساعة الذكية',
      'كم تكلفة التوصيل لولاية باتنة؟',
      'نعم أؤكد طلبي: علاء الدين، 0777777777، راس العيون باتنة',
    ]
  },
  {
    id: 'retail',
    name: 'الملابس والأزياء',
    productName: 'حذاء رياضي كلاسيك أسود مريح',
    productPrice: '4,800 دج',
    productImg: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=500&auto=format&fit=crop&q=80',
    initialBot: 'أهلاً بك في متجر Elegant Fashion! نوفر أرقى الأزياء والأحذية مع التوصيل لـ 58 ولاية. اسألني عن المقاسات والألوان المتوفرة.',
    quickPrompts: [
      'هل متوفر مقاس 42 في اللون الأسود؟',
      'شحال التوصيل لولاية سطيف؟',
      'سجل طلبيتي: كريم زروقي، 0661234567، العلمة سطيف',
    ]
  },
  {
    id: 'cosmetics',
    name: 'العطور ومستحضرات التجميل',
    productName: 'عطر Imperial Oud الفاخر 100 مل',
    productPrice: '8,500 دج',
    productImg: 'https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?w=500&auto=format&fit=crop&q=80',
    initialBot: 'مرحباً بك في عالم العطور الفاخرة! روائح أصلية وثابتة مع الدفع عند الاستلام. كيف يمكنني خدمتك؟',
    quickPrompts: [
      'كم مدة ثبات عطر Imperial Oud؟',
      'هل الدفع عند الاستلام متاح؟',
      'أريد طلب قارورة: أمين بلقاسم، 0550987654، وهران',
    ]
  },
];

export default function InteractivePlayground() {
  const [currentNicheId, setCurrentNicheId] = useState('tech');
  const niche = NICHES.find(n => n.id === currentNicheId) || NICHES[0];

  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: 'bot',
      text: niche.initialBot,
      time: '14:20',
      hasProduct: false,
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [liveOrder, setLiveOrder] = useState(null);
  const [revenueTotal, setRevenueTotal] = useState(0);
  const chatBodyRef = useRef(null);

  useEffect(() => {
    if (chatBodyRef.current) {
      chatBodyRef.current.scrollTo({
        top: chatBodyRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [messages, isTyping, liveOrder]);

  const handleNicheChange = (newId) => {
    setCurrentNicheId(newId);
    const target = NICHES.find(n => n.id === newId) || NICHES[0];
    setLiveOrder(null);
    setMessages([
      {
        id: Date.now(),
        sender: 'bot',
        text: target.initialBot,
        time: new Date().toLocaleTimeString('ar-DZ', { hour: '2-digit', minute: '2-digit' }),
        hasProduct: false,
      },
    ]);
  };

  const handleSend = (customText) => {
    const text = (customText || inputText).trim();
    if (!text) return;

    const userMsg = {
      id: Date.now(),
      sender: 'user',
      text,
      time: new Date().toLocaleTimeString('ar-DZ', { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setIsTyping(true);

    setTimeout(() => {
      let botMsg = '';
      let showProductCard = false;
      let orderCreated = null;
      const lower = text.toLowerCase();

      if (lower.includes('صور') || lower.includes('مواصفات') || lower.includes('ساعة') || lower.includes('حذاء') || lower.includes('عطر')) {
        showProductCard = true;
        botMsg = `هاوليك المنتج الأصلي مع كامل المواصفات:\n\n• ${niche.productName}\n• السعر: ${niche.productPrice}\n• الضمان: أصلي 100% مع إمكانية الفحص قبل الدفع.\n\nهل ترغب في تسجيل الطلبية الآن؟`;
      } else if (lower.includes('توصيل') || lower.includes('شحال') || lower.includes('ولاية') || lower.includes('سطيف') || lower.includes('باتنة')) {
        botMsg = `التوصيل متوفر وسريع لجميع ولايات الوطن (58 ولاية).\n• التوصيل للمنزل: 500 دج\n• التوصيل لمكتب الاستلام (Stop Desk): 350 دج\n• المدة: من 24 إلى 48 ساعة فقط والدفع عند الاستلام.`;
      } else if (lower.includes('نعم') || lower.includes('أؤكد') || lower.includes('سجل') || lower.includes('طلب') || lower.includes('علاء') || lower.includes('كريم') || lower.includes('أمين')) {
        botMsg = `تم تأكيد طلبيتك بنجاح يا عميلنا المحترم!\n\n📋 ملخص الطلبية المؤكدة:\n• المنتج: ${niche.productName}\n• السعر الإجمالي: ${niche.productPrice}\n• رقم الهاتف: 0777777777\n• جهة التوصيل: العنوان المحدد في طلبيتك\n\nسيتواصل معك فريق التوصيل قريباً لتسليم الطرد. شكراً لثقتك بنا!`;
        orderCreated = {
          id: `ORD-${Math.floor(1000 + Math.random() * 9000)}`,
          customerName: lower.includes('علاء') ? 'علاء الدين' : lower.includes('كريم') ? 'كريم زروقي' : 'أمين بلقاسم',
          product: niche.productName,
          price: niche.productPrice,
          wilaya: lower.includes('باتنة') ? 'باتنة (05)' : lower.includes('سطيف') ? 'سطيف (19)' : 'وهران (31)',
          status: 'مؤكد آلياً',
          time: 'الآن',
        };
        setRevenueTotal(prev => prev + parseInt(niche.productPrice.replace(/\D/g, '') || 5000, 10));
      } else {
        botMsg = `أهلاً بك! نوفر لك تجربة تسوق سهلة وسريعة مع خدمة التوصيل السريع والدفع عند الاستلام. كيف يمكنني خدمتك؟`;
      }

      setMessages(prev => [
        ...prev,
        {
          id: Date.now() + 1,
          sender: 'bot',
          text: botMsg,
          time: new Date().toLocaleTimeString('ar-DZ', { hour: '2-digit', minute: '2-digit' }),
          hasProduct: showProductCard,
          productData: showProductCard ? { name: niche.productName, price: niche.productPrice, img: niche.productImg } : null,
        },
      ]);

      if (orderCreated) {
        setLiveOrder(orderCreated);
      }

      setIsTyping(false);
    }, 600);
  };

  const simulateArrivalReceipt = () => {
    if (!liveOrder) return;
    const arrivalText = `طلبيتك وصلت وهي جاهزة للاستلام!\n\nعزيزي/عزيزتي ${liveOrder.customerName}،\nيسعدنا إبلاغك بأن طلبيتك الخاصة بـ (${liveOrder.product}) قد وصلت إلى (${liveOrder.wilaya}) وباتت جاهزة للاستلام.\n\n📋 تفاصيل الاستلام:\n• المبلغ المطلوب: ${liveOrder.price}\n• الموقع: مكتب التوصيل المعتمد\n\nيرجى التقدم للاستلام، ونسعد دائماً بخدمتك!`;

    setMessages(prev => [
      ...prev,
      {
        id: Date.now(),
        sender: 'bot',
        text: arrivalText,
        time: new Date().toLocaleTimeString('ar-DZ', { hour: '2-digit', minute: '2-digit' }),
        isSystemReceipt: true,
      },
    ]);
  };

  return (
    <div className="terminal-playground-root">
      {/* Niche Switcher Bar */}
      <div className="terminal-niche-bar">
        <div className="niche-selector-group">
          <span className="niche-group-label">اختر قطاع التجارة:</span>
          <div className="niche-tabs">
            {NICHES.map(n => (
              <button
                key={n.id}
                type="button"
                className={`niche-tab-btn ${currentNicheId === n.id ? 'active' : ''}`}
                onClick={() => handleNicheChange(n.id)}
              >
                {n.name}
              </button>
            ))}
          </div>
        </div>

        <div className="terminal-status-chip">
          <span className="live-status-dot" />
          <span className="live-status-text">خوارزمية الذكاء الاصطناعي متصلة (0.8 ثانية)</span>
        </div>
      </div>

      {/* Dual Screen Terminal Wrapper */}
      <div className="terminal-dual-layout">
        {/* ─── Left Pane: Simulated Chat Interface (WhatsApp/Telegram) ─── */}
        <div className="terminal-chat-pane">
          <div className="terminal-pane-header">
            <div className="pane-title-with-badge">
              <div className="chat-avatar-icon">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
              </div>
              <div>
                <div className="pane-heading">واجهة الزبون التفاعلية (Telegram / WhatsApp)</div>
                <div className="pane-subheading">معالجة اللهجة المحلية واستخراج الطلبيات</div>
              </div>
            </div>

            <button
              type="button"
              className="pane-reset-btn"
              onClick={() => {
                setMessages([{ id: 1, sender: 'bot', text: niche.initialBot, time: '14:20', hasProduct: false }]);
                setLiveOrder(null);
              }}
              title="إعادة التعيين"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M3 21v-5h5"/></svg>
              <span>إعادة البدء</span>
            </button>
          </div>

          <div className="terminal-chat-body" ref={chatBodyRef}>
            {messages.map(msg => (
              <div key={msg.id} className={`terminal-msg-row ${msg.sender === 'user' ? 'user-msg' : 'bot-msg'}`}>
                <div className="terminal-bubble">
                  {/* Product Card attachment if any */}
                  {msg.hasProduct && msg.productData && (
                    <div className="terminal-product-card">
                      <div className="terminal-product-img-box">
                        <img src={msg.productData.img} alt={msg.productData.name} />
                        <span className="terminal-webp-tag">WebP فائقة السرعة</span>
                      </div>
                      <div className="terminal-product-info">
                        <div className="terminal-product-name">{msg.productData.name}</div>
                        <div className="terminal-product-price">{msg.productData.price}</div>
                      </div>
                    </div>
                  )}

                  <div className="terminal-bubble-text">{msg.text}</div>
                  <div className="terminal-bubble-meta">
                    <span>{msg.sender === 'bot' ? 'BotForge AI' : 'الزبون'}</span>
                    <span>{msg.time}</span>
                  </div>
                </div>
              </div>
            ))}

            {isTyping && (
              <div className="terminal-msg-row bot-msg">
                <div className="terminal-bubble typing-bubble">
                  <span className="dot-flashing" />
                  <span className="dot-flashing" />
                  <span className="dot-flashing" />
                </div>
              </div>
            )}
          </div>

          {/* Preset Prompts Bar */}
          <div className="terminal-prompts-bar">
            <span className="prompts-bar-title">جرّب أحد النماذج:</span>
            <div className="prompts-pills">
              {niche.quickPrompts.map((q, idx) => (
                <button
                  key={idx}
                  type="button"
                  className="prompt-pill-btn"
                  onClick={() => handleSend(q)}
                  disabled={isTyping}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          {/* Chat Input Bar */}
          <form
            className="terminal-input-bar"
            onSubmit={e => {
              e.preventDefault();
              handleSend();
            }}
          >
            <input
              type="text"
              className="terminal-text-input"
              placeholder="اكتب رسالة باللهجة الدارجة أو العربية..."
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              disabled={isTyping}
            />
            <button type="submit" className="terminal-submit-btn" disabled={!inputText.trim() || isTyping}>
              <span>إرسال</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            </button>
          </form>
        </div>

        {/* ─── Right Pane: Merchant Live Command Dashboard ─── */}
        <div className="terminal-dashboard-pane">
          <div className="terminal-pane-header">
            <div className="pane-title-with-badge">
              <div className="dash-avatar-icon">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
                </svg>
              </div>
              <div>
                <div className="pane-heading">لوحة تحكم التاجر الفورية</div>
                <div className="pane-subheading">استقبال وأرشفة الطلبيات في قاعدة البيانات</div>
              </div>
            </div>
            <span className="live-sync-badge">مزامنة فورية</span>
          </div>

          <div className="terminal-dash-content">
            {/* Live Metrics Grid */}
            <div className="dash-metric-cards-grid">
              <div className="dash-metric-box">
                <span className="dash-metric-label">المبيعات المستخلصة اليوم</span>
                <span className="dash-metric-val emerald-val">
                  {revenueTotal > 0 ? `${revenueTotal.toLocaleString()} دج` : '0 دج'}
                </span>
              </div>
              <div className="dash-metric-box">
                <span className="dash-metric-label">سرعة الاستجابة للزبائن</span>
                <span className="dash-metric-val">0.8 ثانية</span>
              </div>
            </div>

            {/* Live Extracted Order Card */}
            <div className="dash-order-section">
              <div className="dash-section-header">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                <span>الطلبيات المسجلة حديثاً (مستخرجة آلياً)</span>
              </div>

              {liveOrder ? (
                <div className="dash-active-order-card">
                  <div className="dash-order-top-row">
                    <div className="dash-order-id-block">
                      <span className="order-id-tag">{liveOrder.id}</span>
                      <span className="order-name-text">{liveOrder.customerName}</span>
                    </div>
                    <span className="dash-order-status-badge">{liveOrder.status}</span>
                  </div>

                  <div className="dash-order-details-grid">
                    <div className="dash-order-field">
                      <span className="field-lbl">المنتج</span>
                      <span className="field-val">{liveOrder.product}</span>
                    </div>
                    <div className="dash-order-field">
                      <span className="field-lbl">المبلغ الإجمالي</span>
                      <span className="field-val price-val">{liveOrder.price}</span>
                    </div>
                    <div className="dash-order-field">
                      <span className="field-lbl">ولاية التوصيل</span>
                      <span className="field-val">{liveOrder.wilaya}</span>
                    </div>
                    <div className="dash-order-field">
                      <span className="field-lbl">قناة الشراء</span>
                      <span className="field-val">تيليغرام / واتساب</span>
                    </div>
                  </div>

                  <div className="dash-order-action-bar">
                    <button
                      type="button"
                      className="dash-action-arrival-btn"
                      onClick={simulateArrivalReceipt}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                      <span>محاكاة إرسال: "وصلت الطلبية جاهزة للاستلام"</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="dash-empty-order-state">
                  <div className="empty-scan-ring">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                  </div>
                  <div className="empty-state-title">بانتظار تأكيد الزبون للطلبية...</div>
                  <div className="empty-state-desc">
                    اضغط على زر <strong>"نعم أؤكد طلبي..."</strong> في محادثة الزبون على اليسار لترى كيف يستخرج الذكاء الاصطناعي بيانات الطلبية ويسجلها في ثانية واحدة!
                  </div>
                </div>
              )}
            </div>

            {/* Architecture Highlights */}
            <div className="dash-tech-specs-box">
              <div className="tech-spec-item">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2.2"><polyline points="20 6 9 17 4 12"/></svg>
                <span>ضغط تلقائي للصور بصيغة WebP لتسريع التحميل وحفظ مساحة السيرفر</span>
              </div>
              <div className="tech-spec-item">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2.2"><polyline points="20 6 9 17 4 12"/></svg>
                <span>خوادم VPS مخصصة مع نظام Zero-Trust للأمان والتحقق من الهوية</span>
              </div>
              <div className="tech-spec-item">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2.2"><polyline points="20 6 9 17 4 12"/></svg>
                <span>تحويل فوري بين الرد الذكي والتدخل البشري اليدوي (Human Takeover)</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
