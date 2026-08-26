import { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { db } from '../services/firebase';
import { 
  doc, 
  getDoc, 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  serverTimestamp 
} from 'firebase/firestore';

const I18N = {
  ar: {
    online: 'متصل الآن',
    placeholder: 'اكتب استفسارك أو طلبك هنا...',
    send: 'إرسال',
    typing: 'جاري الكتابة...',
    welcomeDefault: 'مرحباً بك! كيف يمكنني مساعدتك اليوم؟',
    poweredBy: 'مدعوم بواسطة AuraBot',
    resetChat: 'بدء محادثة جديدة',
    productPrice: 'السعر',
    currencyDefault: 'دج',
  },
  fr: {
    online: 'En ligne',
    placeholder: 'Écrivez votre message ici...',
    send: 'Envoyer',
    typing: 'En train d\'écrire...',
    welcomeDefault: 'Bonjour ! Comment puis-je vous aider aujourd\'hui ?',
    poweredBy: 'Propulsé par AuraBot',
    resetChat: 'Nouvelle conversation',
    productPrice: 'Prix',
    currencyDefault: 'DA',
  },
  en: {
    online: 'Online',
    placeholder: 'Type your message here...',
    send: 'Send',
    typing: 'Typing...',
    welcomeDefault: 'Hello! How can I assist you today?',
    poweredBy: 'Powered by AuraBot',
    resetChat: 'New conversation',
    productPrice: 'Price',
    currencyDefault: 'DZD',
  },
};

export default function PublicChat() {
  const { botId } = useParams();
  const [searchParams] = useSearchParams();
  const isEmbedded = searchParams.get('embedded') === 'true';
  const customGreeting = searchParams.get('greeting');

  const [bot, setBot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [lang, setLang] = useState('ar'); // 'ar', 'fr', 'en'
  const chatEndRef = useRef(null);

  // Generate or retrieve visitor session ID
  const [sessionId] = useState(() => {
    const key = `aurabot_visitor_${botId}`;
    let saved = localStorage.getItem(key);
    if (!saved) {
      saved = 'web_' + Math.random().toString(36).substring(2, 10) + '_' + Date.now().toString(36);
      localStorage.setItem(key, saved);
    }
    return saved;
  });

  const t = I18N[lang] || I18N.ar;

  // Load Bot metadata from Firestore
  useEffect(() => {
    if (!botId) return;
    async function loadBot() {
      try {
        const docRef = doc(db, 'bots', botId);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const data = { id: snap.id, ...snap.data() };
          setBot(data);
          // Set language preference if bot specifies French/English
          if (data.language === 'french') setLang('fr');
          if (data.language === 'english') setLang('en');
        } else {
          setError('لم يتم العثور على هذا البوت');
        }
      } catch (err) {
        console.error('[PublicChat] Error fetching bot:', err);
        setError('تعذر تحميل بيانات الشات');
      } finally {
        setLoading(false);
      }
    }
    loadBot();
  }, [botId]);

  // Real-time Firestore sync for visitor's conversation
  useEffect(() => {
    if (!botId || !sessionId) return;

    const q = query(
      collection(db, 'conversations'),
      where('botId', '==', botId),
      where('telegramUserId', '==', sessionId),
      orderBy('createdAt', 'asc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const msgs = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }));
        setMessages(msgs);
      },
      (err) => {
        console.warn('[PublicChat] Firestore sync listener note:', err.message);
      }
    );

    return () => unsubscribe();
  }, [botId, sessionId]);

  // Auto-scroll on new message
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isSending]);

  const handleSendMessage = async (e, directText) => {
    if (e) e.preventDefault();
    const text = (directText !== undefined ? directText : inputText).trim();
    if (!text || isSending || !bot) return;

    setInputText('');
    setIsSending(true);

    const clientTs = new Date().toISOString();

    // Optimistic local update
    const optimisticMsg = {
      id: 'temp_' + Date.now(),
      role: 'user',
      content: text,
      createdAt: clientTs,
    };
    setMessages((prev) => [...prev, optimisticMsg]);

    try {
      // 1. Save user message to Firestore
      await addDoc(collection(db, 'conversations'), {
        botId,
        platform: 'web',
        userId: bot.userId || '',
        telegramUserId: sessionId,
        customerId: sessionId,
        userName: 'زائر الموقع',
        content: text,
        role: 'user',
        createdAt: clientTs,
        timestamp: serverTimestamp(),
      });

      // 2. Call WhatsApp Engine API to handle LLM response & business logic
      const engineUrl = import.meta.env.VITE_WHATSAPP_ENGINE_URL || 'https://wa.nosfir.online';
      const res = await fetch(`${engineUrl}/api/widget/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          botId,
          sessionId,
          userName: 'زائر الموقع',
          message: text,
          lang,
        }),
      });

      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data.reply) {
          // If not already in messages from Firestore, add bot reply optimistically
          setMessages((prev) => {
            const hasIt = prev.some((m) => m.content === data.reply);
            if (hasIt) return prev;
            return [
              ...prev,
              {
                id: 'bot_' + Date.now(),
                role: 'bot',
                content: data.reply,
                createdAt: new Date().toISOString(),
              },
            ];
          });
        }
      }
    } catch (err) {
      console.error('[PublicChat] Send message error:', err);
    } finally {
      setIsSending(false);
    }
  };

  const handleResetChat = () => {
    const key = `aurabot_visitor_${botId}`;
    const newSession = 'web_' + Math.random().toString(36).substring(2, 10) + '_' + Date.now().toString(36);
    localStorage.setItem(key, newSession);
    window.location.reload();
  };

  if (loading) {
    return (
      <div className="public-chat-loading">
        <div className="public-chat-spinner" />
      </div>
    );
  }

  if (error || !bot) {
    return (
      <div className="public-chat-error">
        <p>{error || 'عذراً، الشات غير متاح حالياً'}</p>
      </div>
    );
  }

  const welcomeText = customGreeting || bot.webWidgetGreeting || bot.customGreeting || t.welcomeDefault;

  const quickPrompts = [
    { label: 'استعراض المنتجات والأسعار', text: 'ما هي المنتجات أو الخدمات المتوفرة لديكم وأسعارها؟' },
    { label: 'طريقة الطلب والتوصيل', text: 'كيف يتم الطلب وما هي خيارات وأسعار التوصيل؟' },
    { label: 'تتبع حالة طلبيتي', text: 'أريد تتبع ومعرفة حالة طلبيتي' },
  ];

  return (
    <div className={`public-chat-page ${isEmbedded ? 'is-embedded' : ''}`}>
      <div className={`public-chat-wrapper ${isEmbedded ? 'embedded' : ''}`} dir={lang === 'ar' ? 'rtl' : 'ltr'}>
        {/* Header */}
        <header className="public-chat-header">
          <div className="public-chat-header-info">
            <div className="public-chat-avatar">
              <span>{(bot.botName || bot.businessName || 'A').trim().charAt(0)}</span>
              <span className="public-chat-online-badge" />
            </div>
            <div>
              <div className="public-chat-title">{bot.botName || bot.businessName}</div>
              <div className="public-chat-status">
                <span className="online-dot" />
                <span>{t.online}</span>
                <span className="status-separator">•</span>
                <span className="status-subtitle">مساعد الذكاء الاصطناعي</span>
              </div>
            </div>
          </div>

          <div className="public-chat-header-actions">
            {/* Language Switcher */}
            <div className="public-chat-lang-group">
              <button
                type="button"
                className={`public-chat-lang-btn ${lang === 'ar' ? 'active' : ''}`}
                onClick={() => setLang('ar')}
              >
                ع
              </button>
              <button
                type="button"
                className={`public-chat-lang-btn ${lang === 'fr' ? 'active' : ''}`}
                onClick={() => setLang('fr')}
              >
                FR
              </button>
              <button
                type="button"
                className={`public-chat-lang-btn ${lang === 'en' ? 'active' : ''}`}
                onClick={() => setLang('en')}
              >
                EN
              </button>
            </div>

            {/* Reset Conversation Button */}
            <button
              type="button"
              className="public-chat-action-btn"
              title={t.resetChat}
              onClick={handleResetChat}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
                <path d="M21 3v5h-5"/>
                <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
                <path d="M8 16H3v5"/>
              </svg>
            </button>
          </div>
        </header>

        {/* Messages Feed */}
        <div className="public-chat-messages">
          {/* Welcome Card & Quick Actions */}
          <div className="public-chat-welcome-hero">
            <div className="hero-avatar">
              <span>{(bot.botName || bot.businessName || 'A').trim().charAt(0)}</span>
            </div>
            <h3 className="hero-title">مرحباً بك في {bot.botName || bot.businessName}</h3>
            <p className="hero-desc">{welcomeText}</p>
          </div>

          {/* Quick Suggestion Pills if conversation is just starting */}
          {messages.length === 0 && (
            <div className="public-chat-quick-actions">
              <div className="quick-actions-title">اقتراحات سريعة للبدء:</div>
              <div className="quick-actions-list">
                {quickPrompts.map((q, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className="quick-action-pill"
                    onClick={() => handleSendMessage(null, q.text)}
                    disabled={isSending}
                  >
                    <span>{q.label}</span>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" style={{ transform: lang === 'ar' ? 'rotate(180deg)' : 'none' }}>
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Conversation History */}
          {messages.map((m) => {
            const isUser = m.role === 'user';
            return (
              <div
                key={m.id}
                className={`public-chat-msg ${isUser ? 'public-chat-msg-user' : 'public-chat-msg-bot'}`}
              >
                <div className="public-chat-bubble">
                  <div className="bubble-text">{m.content}</div>
                  <div className="public-chat-time">
                    {m.createdAt ? new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                  </div>
                </div>
              </div>
            );
          })}

          {isSending && (
            <div className="public-chat-msg public-chat-msg-bot">
              <div className="public-chat-bubble public-chat-typing">
                <span />
                <span />
                <span />
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Input Box & Footer */}
        <div className="public-chat-footer-wrapper">
          <form className="public-chat-input-container" onSubmit={(e) => handleSendMessage(e)}>
            <input
              type="text"
              className="public-chat-input"
              placeholder={t.placeholder}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              disabled={isSending}
            />
            <button
              type="submit"
              className="public-chat-send-btn"
              disabled={!inputText.trim() || isSending}
              aria-label={t.send}
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: lang === 'ar' ? 'rotate(180deg)' : 'none' }}>
                <line x1="22" y1="2" x2="11" y2="13"/>
                <polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
            </button>
          </form>

          <div className="public-chat-footer">
            <span>{t.poweredBy} • دردشة فورية بالذكاء الاصطناعي</span>
          </div>
        </div>
      </div>
    </div>
  );
}
