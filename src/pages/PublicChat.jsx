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

  const handleSendMessage = async (e) => {
    if (e) e.preventDefault();
    const text = inputText.trim();
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
      const engineUrl = 'https://chat.aurabot.site';
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

      if (!res.ok) {
        throw new Error(`Engine response status: ${res.status}`);
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

  const welcomeText = customGreeting || bot.customGreeting || bot.description || t.welcomeDefault;

  return (
    <div className={`public-chat-wrapper ${isEmbedded ? 'embedded' : ''}`} dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="public-chat-header">
        <div className="public-chat-header-info">
          <div className="public-chat-avatar">
            <span>{(bot.botName || bot.businessName || 'A').trim().charAt(0)}</span>
            <span className="public-chat-online-badge" />
          </div>
          <div>
            <div className="public-chat-title">{bot.botName || bot.businessName}</div>
            <div className="public-chat-status">{t.online}</div>
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
      </div>

      {/* Messages Feed */}
      <div className="public-chat-messages">
        {/* Initial Bot Greeting */}
        <div className="public-chat-msg public-chat-msg-bot">
          <div className="public-chat-bubble">{welcomeText}</div>
        </div>

        {messages.map((m) => {
          const isUser = m.role === 'user';
          return (
            <div
              key={m.id}
              className={`public-chat-msg ${isUser ? 'public-chat-msg-user' : 'public-chat-msg-bot'}`}
            >
              <div className="public-chat-bubble">
                <div style={{ whiteSpace: 'pre-wrap' }}>{m.content}</div>
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

      {/* Input Box */}
      <form className="public-chat-input-container" onSubmit={handleSendMessage}>
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
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: lang === 'ar' ? 'rotate(180deg)' : 'none' }}>
            <line x1="22" y1="2" x2="11" y2="13"/>
            <polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
        </button>
      </form>

      {/* Footer Branding */}
      <div className="public-chat-footer">
        <span>{t.poweredBy}</span>
      </div>
    </div>
  );
}
