import { useState, useRef, useEffect } from 'react';

const STORE_NICHES = [
  { 
    id: 'retail', 
    name: 'الملابس والأزياء',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M20.38 3.46L16 2a4 4 0 01-8 0L3.62 3.46a2 2 0 00-1.34 2.23l.58 3.47a1 1 0 00.99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 002-2V10h2.15a1 1 0 00.99-.84l.58-3.47a2 2 0 00-1.34-2.23z"/>
      </svg>
    )
  },
  { 
    id: 'tech', 
    name: 'الإلكترونيات والأجهزة',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
        <line x1="8" y1="21" x2="16" y2="21"/>
        <line x1="12" y1="17" x2="12" y2="21"/>
      </svg>
    )
  },
  { 
    id: 'cosmetics', 
    name: 'العطور ومستحضرات التجميل',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
      </svg>
    )
  },
];

const PRESET_PROMPTS = [
  'هل متوفر مقاس 42 في اللون الأسود؟',
  'كم تكلفة التوصيل إلى ولاية سطيف؟',
  'أريد تأكيد طلبية باسم كريم زروقي في باتنة',
  'ما هي خيارات الدفع المتاحة؟',
];

export default function InteractivePlayground() {
  const [currentNiche, setCurrentNiche] = useState('retail');
  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: 'bot',
      text: 'مرحباً بك. أنا المساعد الذكي لخدمة العملاء. يمكنك الاستفسار عن المنتجات، تكلفة التوصيل للولايات، أو تقديم طلبية تجريبية.',
      time: '10:40',
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [capturedOrder, setCapturedOrder] = useState(null);
  const chatBodyRef = useRef(null);

  useEffect(() => {
    if (chatBodyRef.current) {
      chatBodyRef.current.scrollTo({
        top: chatBodyRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [messages, isTyping, capturedOrder]);

  const handleSend = (textToSend) => {
    const query = (textToSend || inputText).trim();
    if (!query) return;

    const userMsg = {
      id: Date.now(),
      sender: 'user',
      text: query,
      time: new Date().toLocaleTimeString('ar-DZ', { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setIsTyping(true);

    setTimeout(() => {
      let botResponse = '';
      let orderData = null;
      const lower = query.toLowerCase();

      if (lower.includes('طلب') || lower.includes('سجل') || lower.includes('حجز') || lower.includes('كريم') || lower.includes('باتنة') || lower.includes('تأكيد')) {
        botResponse = 'تم تسجيل طلبك وتأكيده بنجاح في النظام. سيتم شحن الطلبية إلى عنوانك والتوصيل خلال 24 إلى 48 ساعة مع الدفع عند الاستلام.';
        orderData = {
          clientName: 'كريم زروقي',
          wilaya: 'باتنة (05)',
          product: currentNiche === 'retail' ? 'حذاء رياضي كلاسيك أسود - مقاس 42' : currentNiche === 'tech' ? 'ساعة ذكية SmartWatch Ultra' : 'عطر فاخر 100 مل',
          price: currentNiche === 'retail' ? '4,500 دج' : currentNiche === 'tech' ? '6,800 دج' : '9,200 دج',
          status: 'مؤكدة آلياً',
        };
      } else if (lower.includes('توصيل') || lower.includes('سطيف') || lower.includes('ولاية') || lower.includes('شحن') || lower.includes('تكلفة')) {
        botResponse = 'خدمة التوصيل متوفرة لجميع الولايات الـ 58. التوصيل إلى ولاية سطيف هو 400 دج ويستغرق من 24 إلى 48 ساعة كحد أقصى مع الدفع عند الاستلام.';
      } else if (lower.includes('دفع') || lower.includes('كاش') || lower.includes('ccp') || lower.includes('خيارات') || lower.includes('طرق')) {
        botResponse = 'نوفر خيار الدفع نقداً عند استلام الطلبية، بالإضافة إلى إمكانية التحويل عبر تطبيق BaridiMob أو الحساب البريدي CCP.';
      } else if (lower.includes('مقاس') || lower.includes('سعر') || lower.includes('متوفر') || lower.includes('لون') || lower.includes('أسود')) {
        botResponse = 'نعم، المنتج متوفر في المخزون بالمقاس واللون المطلوب مع ضمان الجودة والاستبدال. السعر الحالي 4,500 دج.';
      } else {
        botResponse = 'أهلاً بك. المنتجات متوفرة مع خدمة التوصيل لكافة الولايات. تفضل بتحديد طلبك أو استفسارك وسأجيبك فوراً.';
      }

      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          sender: 'bot',
          text: botResponse,
          time: new Date().toLocaleTimeString('ar-DZ', { hour: '2-digit', minute: '2-digit' }),
        },
      ]);

      if (orderData) {
        setCapturedOrder(orderData);
      }

      setIsTyping(false);
    }, 600);
  };

  const handleNicheChange = (nicheId) => {
    setCurrentNiche(nicheId);
    setCapturedOrder(null);
    const chosen = STORE_NICHES.find((n) => n.id === nicheId);
    setMessages([
      {
        id: Date.now(),
        sender: 'bot',
        text: `تم تحديث نموذج الرد لقطاع: ${chosen.name}. يمكنك الآن تجربة الأسئلة المتخصصة في هذا المجال.`,
        time: '10:40',
      },
    ]);
  };

  return (
    <div className="playground-container" id="interactive-demo">
      {/* ─── Niche Selector ─── */}
      <div className="playground-niches">
        <span className="niche-label">تخصيص النشاط التجاري:</span>
        <div className="niche-pills">
          {STORE_NICHES.map((niche) => (
            <button
              key={niche.id}
              type="button"
              className={`niche-btn ${currentNiche === niche.id ? 'active' : ''}`}
              onClick={() => handleNicheChange(niche.id)}
            >
              {niche.icon}
              <span>{niche.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ─── Sleek Terminal / Chat Window ─── */}
      <div className="playground-window">
        <div className="playground-window-header">
          <div className="window-dots">
            <span className="dot red" />
            <span className="dot yellow" />
            <span className="dot green" />
          </div>
          <div className="playground-bot-status">
            <div className="bot-avatar-mini">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <rect x="3" y="3" width="18" height="18" rx="4"/>
                <circle cx="8.5" cy="8.5" r="1.5"/>
                <circle cx="15.5" cy="8.5" r="1.5"/>
                <path d="M9 14h6"/>
              </svg>
            </div>
            <div>
              <div className="bot-name">BotForge Engine Preview</div>
              <div className="bot-meta">
                <span className="live-pulse" />
                <span>الرد الفوري (0.8 ثانية)</span>
              </div>
            </div>
          </div>
          <button 
            type="button" 
            className="reset-chat-btn" 
            onClick={() => {
              setMessages([
                {
                  id: 1,
                  sender: 'bot',
                  text: 'مرحباً بك مجدداً. يمكنك كتابة أي استفسار لتجربة البوت.',
                  time: '10:40',
                },
              ]);
              setCapturedOrder(null);
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
              <path d="M21 3v5h-5"/>
              <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
              <path d="M3 21v-5h5"/>
            </svg>
            <span>إعادة التعيين</span>
          </button>
        </div>

        {/* Chat History */}
        <div className="playground-chat-body" ref={chatBodyRef}>
          {messages.map((msg) => (
            <div key={msg.id} className={`pg-bubble-row ${msg.sender === 'user' ? 'user-row' : 'bot-row'}`}>
              <div className={`pg-avatar ${msg.sender === 'user' ? 'user-av' : 'bot-av'}`}>
                {msg.sender === 'user' ? (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                  </svg>
                ) : (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <rect x="3" y="3" width="18" height="18" rx="4"/>
                    <circle cx="8.5" cy="8.5" r="1.5"/>
                    <circle cx="15.5" cy="8.5" r="1.5"/>
                    <path d="M9 14h6"/>
                  </svg>
                )}
              </div>
              <div className={`pg-bubble ${msg.sender === 'user' ? 'user-bubble' : 'bot-bubble'}`}>
                <div className="pg-bubble-header">
                  <span>{msg.sender === 'user' ? 'العميل' : 'المساعد الذكي'}</span>
                  {msg.sender === 'bot' && <span className="speed-tag">0.8s</span>}
                </div>
                <div className="pg-bubble-text">{msg.text}</div>
                <div className="pg-bubble-time">{msg.time}</div>
              </div>
            </div>
          ))}

          {/* Typing Indicator */}
          {isTyping && (
            <div className="pg-bubble-row bot-row anim-fade-in">
              <div className="pg-avatar bot-av">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <rect x="3" y="3" width="18" height="18" rx="4"/>
                  <circle cx="8.5" cy="8.5" r="1.5"/>
                  <circle cx="15.5" cy="8.5" r="1.5"/>
                </svg>
              </div>
              <div className="pg-bubble bot-bubble typing-bubble">
                <div className="typing-dots">
                  <span />
                  <span />
                  <span />
                </div>
              </div>
            </div>
          )}

          {/* Captured Order Card */}
          {capturedOrder && (
            <div className="pg-captured-order-card anim-pop-in">
              <div className="order-card-header">
                <div className="order-header-badge">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                  <span>استخراج وتأكيد الطلبية آلياً</span>
                </div>
                <span className="order-confirmed-pill">{capturedOrder.status}</span>
              </div>

              <div className="order-card-details">
                <div className="order-detail-item">
                  <span className="detail-label">العميل</span>
                  <span className="detail-val">{capturedOrder.clientName}</span>
                </div>
                <div className="order-detail-item">
                  <span className="detail-label">الولاية</span>
                  <span className="detail-val">{capturedOrder.wilaya}</span>
                </div>
                <div className="order-detail-item">
                  <span className="detail-label">المنتج</span>
                  <span className="detail-val">{capturedOrder.product}</span>
                </div>
                <div className="order-detail-item">
                  <span className="detail-label">المجموع</span>
                  <span className="detail-val price">{capturedOrder.price}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Quick Prompts */}
        <div className="playground-quick-prompts">
          <span className="quick-title">نماذج استفسارات:</span>
          <div className="quick-chips">
            {PRESET_PROMPTS.map((prompt, idx) => (
              <button
                key={idx}
                type="button"
                className="quick-chip-btn"
                onClick={() => handleSend(prompt)}
                disabled={isTyping}
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>

        {/* Input Bar */}
        <form
          className="playground-input-form"
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
        >
          <input
            type="text"
            className="pg-input"
            placeholder="اكتب استفساراً لاختبار الرد الذكي..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            disabled={isTyping}
          />
          <button type="submit" className="pg-send-btn" disabled={!inputText.trim() || isTyping}>
            <span>إرسال</span>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <line x1="22" y1="2" x2="11" y2="13"/>
              <polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          </button>
        </form>
      </div>
    </div>
  );
}
