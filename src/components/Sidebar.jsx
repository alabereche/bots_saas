import { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [collapsed, setCollapsed] = useState(() => {
    return localStorage.getItem('botforge_sidebar_collapsed') === 'true';
  });

  useEffect(() => {
    const layout = document.querySelector('.app-layout');
    if (layout) {
      if (collapsed) {
        layout.classList.add('sidebar-collapsed');
      } else {
        layout.classList.remove('sidebar-collapsed');
      }
    }
    localStorage.setItem('botforge_sidebar_collapsed', collapsed);
  }, [collapsed]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const navSections = [
    {
      title: 'الرئيسية',
      items: [
        {
          to: '/dashboard',
          label: 'الرئيسية',
          desktopLabel: 'لوحة التحكم',
          icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" rx="1.5"/>
              <rect x="14" y="3" width="7" height="7" rx="1.5"/>
              <rect x="3" y="14" width="7" height="7" rx="1.5"/>
              <rect x="14" y="14" width="7" height="7" rx="1.5"/>
            </svg>
          ),
        },
        {
          to: '/create-bot',
          label: 'إنشاء بوت',
          desktopLabel: 'إنشاء بوت جديد',
          badge: 'جديد',
          icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9"/>
              <line x1="12" y1="8" x2="12" y2="16"/>
              <line x1="8" y1="12" x2="16" y2="12"/>
            </svg>
          ),
        },
      ],
    },
    {
      title: 'الإدارة والفوترة',
      items: [
        {
          to: '/billing',
          label: 'الاشتراكات',
          desktopLabel: 'الاشتراكات والخطط',
          icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="5" width="20" height="14" rx="2"/>
              <line x1="2" y1="10" x2="22" y2="10"/>
            </svg>
          ),
        },
      ],
    },
  ];

  const displayName = user?.displayName || user?.email?.split('@')[0] || 'مستخدم';
  const displayLetter = (displayName.charAt(0) || 'U').toUpperCase();
  const userPhoto = user?.photoURL || user?.providerData?.[0]?.photoURL;

  // Flatten items for mobile bottom nav
  const mobileNavItems = navSections.flatMap(s => s.items);

  return (
    <>
      {/* ─── Desktop Sidebar (Hidden on Mobile) ─── */}
      <aside className="desktop-sidebar">
        {/* Brand Header */}
        <div className="sidebar-brand">
          <div 
            className="sidebar-brand-content"
            onClick={collapsed ? () => setCollapsed(false) : undefined}
            style={{ cursor: collapsed ? 'pointer' : 'default' }}
            title={collapsed ? 'انقر لتوسيع القائمة' : undefined}
          >
            <div className="sidebar-logo">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="9" stroke="url(#auraRingGrad)" strokeWidth="1.8" strokeDasharray="2.5 2.5"/>
                <path d="M12 4.5L14.2 9.8L19.5 12L14.2 14.2L12 19.5L9.8 14.2L4.5 12L9.8 9.8L12 4.5Z" fill="url(#auraSparkGrad)"/>
                <defs>
                  <linearGradient id="auraRingGrad" x1="0" y1="0" x2="24" y2="24">
                    <stop offset="0%" stopColor="#34d399"/>
                    <stop offset="100%" stopColor="#06b6d4"/>
                  </linearGradient>
                  <linearGradient id="auraSparkGrad" x1="4" y1="4" x2="20" y2="20">
                    <stop offset="0%" stopColor="#6ee7b7"/>
                    <stop offset="100%" stopColor="#10b981"/>
                  </linearGradient>
                </defs>
              </svg>
            </div>
            <div className="sidebar-brand-text">
              <span className="sidebar-brand-name">
                Aura<span style={{ color: '#10b981' }}>Bot</span>
              </span>
              <span className="sidebar-brand-desc">منصة البوتات الذكية</span>
            </div>
          </div>

          <button 
            type="button"
            className="sidebar-collapse-btn" 
            onClick={() => setCollapsed(prev => !prev)}
            title={collapsed ? 'توسيع القائمة' : 'طي القائمة'}
          >
            <svg 
              width="15" 
              height="15" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2.2" 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              style={{ 
                transform: collapsed ? 'rotate(180deg)' : 'rotate(0deg)', 
                transition: 'transform 0.22s ease' 
              }}
            >
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </button>
        </div>

        {/* Navigation */}
        <nav className="sidebar-nav">
          {navSections.map((sec, sIdx) => (
            <div key={sIdx} style={{ marginBottom: '6px' }}>
              <div className="sidebar-section-title">{sec.title}</div>
              {sec.items.map(item => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/dashboard'}
                  title={collapsed ? item.desktopLabel : undefined}
                  className={({ isActive }) => `sidebar-link ${isActive ? 'sidebar-link--active' : ''}`}
                >
                  <div className="sidebar-link-icon">{item.icon}</div>
                  <span className="sidebar-link-label">{item.desktopLabel}</span>
                  {item.badge && <span className="sidebar-link-badge">{item.badge}</span>}
                </NavLink>
              ))}
            </div>
          ))}

          {/* Ultra-Light AI Status Strip at Bottom of Nav */}
          <div style={{ marginTop: 'auto', paddingTop: '8px' }}>
            <div className="sidebar-status-strip">
              <div className="sidebar-status-info">
                <span className="sidebar-status-dot" />
                <span>محرك AI: متصل</span>
              </div>
              <div className="sidebar-channel-dots" title="قنوات الربط: Messenger, Instagram, WhatsApp, Telegram">
                <span className="sidebar-channel-dot fb" />
                <span className="sidebar-channel-dot ig" />
                <span className="sidebar-channel-dot wa" />
                <span className="sidebar-channel-dot tg" />
              </div>
            </div>
          </div>
        </nav>

        {/* User Footer */}
        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="sidebar-user-avatar" style={{ overflow: 'hidden' }}>
              {userPhoto ? (
                <img 
                  src={userPhoto} 
                  alt={displayName} 
                  referrerPolicy="no-referrer" 
                  style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }}
                />
              ) : displayLetter}
            </div>
            <div className="sidebar-user-info">
              <span className="sidebar-user-name" title={displayName}>{displayName}</span>
              <span className="sidebar-user-email" title={user?.email || ''}>{user?.email || ''}</span>
            </div>
          </div>
          <button 
            onClick={handleLogout} 
            className="sidebar-logout" 
            title="تسجيل الخروج"
            type="button"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
          </button>
        </div>
      </aside>

      {/* ─── Mobile Top Header (Visible Only on Mobile) ─── */}
      <header className="mobile-top-bar">
        <div className="mobile-top-brand">
          <div className="sidebar-logo" style={{ width: '32px', height: '32px' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="9" stroke="url(#auraRingGradMob)" strokeWidth="1.8" strokeDasharray="2.5 2.5"/>
              <path d="M12 4.5L14.2 9.8L19.5 12L14.2 14.2L12 19.5L9.8 14.2L4.5 12L9.8 9.8L12 4.5Z" fill="url(#auraSparkGradMob)"/>
              <defs>
                <linearGradient id="auraRingGradMob" x1="0" y1="0" x2="24" y2="24">
                  <stop offset="0%" stopColor="#34d399"/>
                  <stop offset="100%" stopColor="#06b6d4"/>
                </linearGradient>
                <linearGradient id="auraSparkGradMob" x1="4" y1="4" x2="20" y2="20">
                  <stop offset="0%" stopColor="#6ee7b7"/>
                  <stop offset="100%" stopColor="#10b981"/>
                </linearGradient>
              </defs>
            </svg>
          </div>
          <span className="sidebar-brand-name" style={{ fontSize: '1.05rem' }}>
            Aura<span style={{ color: '#10b981' }}>Bot</span>
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div className="sidebar-user-avatar" style={{ width: '30px', height: '30px', fontSize: '0.75rem', overflow: 'hidden' }}>
            {userPhoto ? (
              <img 
                src={userPhoto} 
                alt={displayName} 
                referrerPolicy="no-referrer" 
                style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }}
              />
            ) : displayLetter}
          </div>
          <button 
            onClick={handleLogout} 
            className="sidebar-logout" 
            style={{ width: '28px', height: '28px' }}
            title="تسجيل الخروج"
            type="button"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
          </button>
        </div>
      </header>

      {/* ─── Mobile Bottom Navigation (Visible Only on Mobile) ─── */}
      <nav className="mobile-bottom-nav">
        {mobileNavItems.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/dashboard'}
            className={({ isActive }) => `mobile-nav-item ${isActive ? 'mobile-nav-item--active' : ''}`}
          >
            <div className="mobile-nav-icon">{item.icon}</div>
            <span className="mobile-nav-label">{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </>
  );
}
