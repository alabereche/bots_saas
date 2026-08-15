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
    // Realtime subscription to user's bots
    const unsubscribe = subscribeBots(user.uid, (data) => {
      setBots(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const activeBots = bots.filter(b => b.isActive);
  const totalMessages = bots.reduce((sum, b) => sum + (b.messagesCount || 0), 0);

  const businessTypeLabels = {
    restaurant: 'مطعم',
    shop: 'متجر',
    clinic: 'عيادة',
    salon: 'صالون',
    delivery: 'توصيل',
    education: 'تعليم',
    other: 'اخرى',
  };

  return (
    <div className="page-container animate-enter">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-4)', marginBottom: 'var(--space-8)' }}>
        <div>
          <h1 style={{ fontSize: '2.25rem', fontWeight: 800, marginBottom: 'var(--space-2)', letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
            مرحباً، <span className="text-gradient">{user?.displayName?.split(' ')[0] || user?.email?.split('@')[0] || 'مستخدم'}</span>
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', lineHeight: 1.6 }}>أدر بوتاتك الذكية وتابع الإحصائيات الحية من هنا</p>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/create-bot')} style={{ gap: 'var(--space-2)', padding: '0.875rem 1.5rem', fontWeight: 600, boxShadow: '0 8px 25px var(--accent-glow)' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
          انشاء بوت جديد
        </button>
      </div>

      {/* Stats Grid */}
      <div className="stats-grid animate-enter" style={{ animationDelay: '100ms' }}>
        <div className="stat-card">
          <div className="stat-icon violet">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
          </div>
          <div>
            <div className="stat-value">{bots.length}</div>
            <div className="stat-label">إجمالي البوتات</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          </div>
          <div>
            <div className="stat-value">{activeBots.length}</div>
            <div className="stat-label">بوتات نشطة</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon blue">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          </div>
          <div>
            <div className="stat-value">{totalMessages}</div>
            <div className="stat-label">إجمالي الرسائل</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-6)', paddingRight: 'var(--space-2)' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent-color)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          بوتاتي الذكية
        </h2>
      </div>

      {loading ? (
        <div style={{ minHeight: '30vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="spinner" style={{ width: '2.5rem', height: '2.5rem', color: 'var(--accent-color)', borderWidth: '3px' }} />
        </div>
      ) : bots.length === 0 ? (
        <div className="card animate-enter" style={{ 
          textAlign: 'center', 
          padding: 'var(--space-12) var(--space-6)', 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          animationDelay: '200ms',
          background: 'var(--bg-surface-glass)',
          backdropFilter: 'blur(16px)',
          border: '1px dashed var(--border-strong)',
          boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.02)'
        }}>
          <div style={{ 
            width: '80px', height: '80px', 
            borderRadius: '50%', 
            background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(168, 85, 247, 0.1))', 
            display: 'flex', alignItems: 'center', justifyContent: 'center', 
            marginBottom: 'var(--space-6)', 
            color: 'var(--accent-color)',
            boxShadow: '0 8px 32px var(--accent-glow)'
          }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
              <line x1="8" y1="21" x2="16" y2="21"/>
              <line x1="12" y1="17" x2="12" y2="21"/>
            </svg>
          </div>
          <h3 style={{ fontSize: '1.5rem', marginBottom: 'var(--space-2)', fontWeight: 800 }}>لا توجد بوتات بعد</h3>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-8)', maxWidth: '400px', lineHeight: 1.6 }}>
            ابدأ بإنشاء أول بوت ذكي لمشروعك وقم بربطه بـ Telegram أو WhatsApp لتسهيل الردود الآلية على عملائك.
          </p>
          <button className="btn btn-primary" onClick={() => navigate('/create-bot')} style={{ padding: '0.875rem 2rem', fontSize: '1rem', fontWeight: 700, boxShadow: '0 8px 25px var(--accent-glow-strong)' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
            انشاء أول بوت
          </button>
        </div>
      ) : (
        <div className="bot-grid animate-enter" style={{ animationDelay: '200ms' }}>
          {bots.map((bot, i) => (
            <div
              key={bot.id}
              className="bot-card"
              onClick={() => navigate(`/bot/${bot.id}`)}
              style={{ animationDelay: `${250 + (i * 100)}ms`, animationFillMode: 'both' }}
            >
              <div className="bot-card-header">
                <div className="bot-card-info">
                  <div className="bot-card-avatar">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
                  </div>
                  <div>
                    <div className="bot-card-name">{bot.botName || bot.businessName}</div>
                    <div className="bot-card-type">{businessTypeLabels[bot.businessType] || bot.businessType}</div>
                  </div>
                </div>
                <span className={`badge ${bot.isActive ? 'badge-success' : 'badge-error'}`} style={{ gap: '6px' }}>
                  <span className="badge-dot" />
                  {bot.isActive ? 'نشط' : 'متوقف'}
                </span>
              </div>
              <p className="bot-card-desc" style={{ padding: '0 4px' }}>{bot.description || 'لا يوجد وصف مضاف لهذا البوت بعد.'}</p>
              <div className="bot-card-footer">
                <div className="bot-card-meta">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                  <span>{bot.messagesCount || 0} رسالة</span>
                </div>
                <div className="bot-card-meta">
                  <span>{bot.currency || 'دج'}</span>
                  <span>•</span>
                  <span>{bot.platform === 'whatsapp' ? 'واتساب' : 'تيليغرام'}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
