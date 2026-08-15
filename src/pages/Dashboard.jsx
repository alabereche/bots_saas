import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { subscribeBots } from '../services/firebase';
import { useAuth } from '../context/AuthContext';

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [bots, setBots] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    const unsubscribe = subscribeBots(user.uid, (data) => {
      setBots(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const activeBots = bots.filter(b => b.isActive || b.status === 'connected');
  const totalMessages = bots.reduce((sum, b) => sum + (b.messagesCount || 0), 0);
  const totalOrders = bots.reduce((sum, b) => sum + (b.ordersCount || 0), 0);

  const businessTypeLabels = {
    ecommerce: 'متجر إلكتروني',
    support: 'خدمة عملاء',
    agency: 'شركة وخدمات',
    clinic: 'عيادة وصحة',
    booking: 'حجوزات ومواعيد',
    courses: 'دورات وتعليم',
    realestate: 'عقارات وأملاك',
    restaurant: 'مطعم ومقهى',
    handyman: 'صيانة وحرف',
    assistant: 'مساعد شخصي',
    custom: 'نشاط مخصص',
    shop: 'متجر ومبيعات',
  };

  const displayName = user?.displayName?.split(' ')[0] || user?.email?.split('@')[0] || 'مستخدم';

  return (
    <div className="dashboard-container">
      {/* Top Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#ffffff', marginBottom: '0.35rem' }}>
            لوحة التحكم
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem' }}>
            مرحباً {displayName}، تابع أداء بوتاتك والرسائل والطلبيات الواردة مباشرة
          </p>
        </div>

        <button 
          className="btn btn-primary" 
          onClick={() => navigate('/create-bot')}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          إنشاء بوت جديد
        </button>
      </div>

      {/* Stats Cards Grid (4 Solid Cards) */}
      <section className="stats-row">
        {/* Card 1: Total Bots */}
        <div className="stat-box">
          <div className="stat-box-icon stat-icon--purple">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="20" height="14" rx="2"/>
              <line x1="8" y1="21" x2="16" y2="21"/>
              <line x1="12" y1="17" x2="12" y2="21"/>
            </svg>
          </div>
          <div className="stat-box-content">
            <span className="stat-box-num">{bots.length}</span>
            <span className="stat-box-label">إجمالي البوتات</span>
          </div>
        </div>

        {/* Card 2: Active Connected Bots */}
        <div className="stat-box">
          <div className="stat-box-icon stat-icon--green">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
              <polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
          </div>
          <div className="stat-box-content">
            <span className="stat-box-num">{activeBots.length}</span>
            <span className="stat-box-label">بوتات متصلة ونشطة</span>
          </div>
        </div>

        {/* Card 3: Total Messages */}
        <div className="stat-box">
          <div className="stat-box-icon stat-icon--blue">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
          </div>
          <div className="stat-box-content">
            <span className="stat-box-num">{totalMessages}</span>
            <span className="stat-box-label">إجمالي الرسائل</span>
          </div>
        </div>

        {/* Card 4: Total Orders */}
        <div className="stat-box">
          <div className="stat-box-icon stat-icon--orange">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
              <line x1="3" y1="6" x2="21" y2="6"/>
              <path d="M16 10a4 4 0 0 1-8 0"/>
            </svg>
          </div>
          <div className="stat-box-content">
            <span className="stat-box-num">{totalOrders}</span>
            <span className="stat-box-label">الطلبيات المسجلة</span>
          </div>
        </div>
      </section>

      {/* Bots Grid Section */}
      <section style={{ marginTop: '2.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--color-primary)', display: 'inline-block' }} />
            البوتات الذكية ({bots.length})
          </h2>
        </div>

        {loading ? (
          <div style={{ minHeight: '30vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="spinner spinner-lg" />
          </div>
        ) : bots.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '3.5rem 1.5rem' }}>
            <div style={{
              width: '54px', height: '54px',
              borderRadius: 'var(--radius-md)',
              background: '#18243b',
              color: 'var(--color-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.25rem',
              border: '1px solid var(--border-default)'
            }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
              </svg>
            </div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#ffffff', marginBottom: '0.5rem' }}>
              لا توجد بوتات نشطة بعد
            </h3>
            <p style={{ color: 'var(--text-secondary)', maxWidth: '440px', fontSize: '0.92rem', margin: '0 auto 1.5rem', lineHeight: 1.7 }}>
              ابدأ الآن بإنشاء أول بوت لمشروعك ودعه يتولى الرد الفوري على عملائك عبر WhatsApp و Telegram وتسجيل طلبياتهم بدقة!
            </p>
            <button className="btn btn-primary" onClick={() => navigate('/create-bot')}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              إنشاء أول بوت الآن
            </button>
          </div>
        ) : (
          <div className="bot-cards-grid">
            {bots.map((bot) => {
              const isWhatsapp = bot.platform === 'whatsapp';
              const isOnline = bot.isActive || bot.status === 'connected';

              return (
                <div
                  key={bot.id}
                  className="bot-item-card"
                  onClick={() => navigate(`/bot/${bot.id}`)}
                >
                  <div className="bot-item-header">
                    <div className={`bot-platform-badge ${isWhatsapp ? 'is-whatsapp' : 'is-telegram'}`}>
                      {isWhatsapp ? (
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                        </svg>
                      ) : (
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
                        </svg>
                      )}
                    </div>

                    <div className="bot-item-titles">
                      <div className="bot-item-name">{bot.botName || bot.businessName}</div>
                      <div className="bot-item-cat">{businessTypeLabels[bot.businessType] || bot.businessType || 'نشاط تجاري'}</div>
                    </div>

                    <div className={`status-pill ${isOnline ? 'status--online' : 'status--waiting'}`}>
                      <span className="status-pill-dot" />
                      {isOnline ? 'متصل' : 'في الانتظار'}
                    </div>
                  </div>

                  <p className="bot-item-desc">
                    {bot.description || 'بوت ذكي متصل للرد التلقائي على الزبائن وحجز الطلبيات بدقة.'}
                  </p>

                  <div className="bot-item-footer">
                    <div className="bot-stat-badge">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                      </svg>
                      <span>{bot.messagesCount || 0} رسالة</span>
                    </div>

                    <div className="bot-stat-badge">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
                      </svg>
                      <span>{bot.ordersCount || 0} طلب</span>
                    </div>

                    <div className="bot-item-action">
                      <span>إدارة البوت</span>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="15 18 9 12 15 6"/>
                      </svg>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
