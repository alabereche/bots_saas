import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../context/AuthContext';

export default function AdminOverview() {
  const { user } = useAuth();

  const [bots, setBots] = useState([]);
  const [usersMap, setUsersMap] = useState({});
  const [usersCount, setUsersCount] = useState(0);
  const [ordersCount, setOrdersCount] = useState(0);
  const [hotLeadsCount, setHotLeadsCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState(null);

  // Filters and UI state
  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // all, connected, disconnected, whatsapp, telegram

  // Subscribe to collections in real time
  useEffect(() => {
    let unsubs = [];
    setLoading(true);

    try {
      // 1. Bots
      const unsubBots = onSnapshot(collection(db, 'bots'), (snap) => {
        const list = [];
        snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
        setBots(list);
      }, (err) => {
        console.error('Admin bots snapshot error:', err);
      });
      unsubs.push(unsubBots);

      // 2. Users
      const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
        const uMap = {};
        snap.forEach((d) => {
          uMap[d.id] = { id: d.id, ...d.data() };
        });
        setUsersMap(uMap);
        setUsersCount(snap.size);
      }, (err) => {
        console.error('Admin users snapshot error:', err);
      });
      unsubs.push(unsubUsers);

      // 3. Orders
      const unsubOrders = onSnapshot(collection(db, 'orders'), (snap) => {
        setOrdersCount(snap.size);
      }, (err) => {
        console.error('Admin orders snapshot error:', err);
      });
      unsubs.push(unsubOrders);

      // 4. Leads (Hot leads)
      const unsubLeads = onSnapshot(collection(db, 'leads'), (snap) => {
        let hotCount = 0;
        snap.forEach((d) => {
          const data = d.data();
          if (data.leadStatus === 'hot') {
            hotCount++;
          }
        });
        setHotLeadsCount(hotCount);
        setLoading(false);
      }, (err) => {
        console.error('Admin leads snapshot error:', err);
        setLoading(false);
      });
      unsubs.push(unsubLeads);

    } catch (e) {
      console.error('Failed to attach admin listeners:', e);
      setLoading(false);
    }

    return () => {
      unsubs.forEach((u) => {
        if (typeof u === 'function') u();
      });
    };
  }, []);

  // Copy bot ID handler
  const handleCopyId = (id) => {
    navigator.clipboard.writeText(id).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  // KPI Calculations
  const connectedBotsCount = useMemo(() => {
    return bots.filter((b) => b.whatsappStatus === 'connected' || Boolean(b.telegramToken)).length;
  }, [bots]);

  // Filtered bots list
  const filteredBots = useMemo(() => {
    return bots.filter((b) => {
      const isConnected = b.whatsappStatus === 'connected' || Boolean(b.telegramToken);
      const isWhatsApp = Boolean(b.whatsappStatus !== undefined || b.platform === 'whatsapp' || b.phone);
      const isTelegram = Boolean(b.telegramToken || b.platform === 'telegram');

      if (statusFilter === 'connected' && !isConnected) return false;
      if (statusFilter === 'disconnected' && isConnected) return false;
      if (statusFilter === 'whatsapp' && !isWhatsApp) return false;
      if (statusFilter === 'telegram' && !isTelegram) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const ownerEmail = usersMap[b.userId]?.email?.toLowerCase() || '';
        const botName = (b.name || '').toLowerCase();
        const botId = (b.id || '').toLowerCase();
        return botName.includes(q) || botId.includes(q) || ownerEmail.includes(q);
      }

      return true;
    });
  }, [bots, usersMap, statusFilter, searchQuery]);

  const adminName = user?.displayName || user?.email?.split('@')[0] || 'المشرف العام';

  return (
    <div className="admin-page-container" dir="rtl">
      {/* ─── Top Header (HeroUI Style) ─── */}
      <div className="admin-header-bar">
        <div className="admin-profile-meta">
          <div className="admin-avatar-gradient">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <div>
            <div className="admin-title-row">
              <h1 className="admin-main-heading">لوحة الإدارة العليا</h1>
              <span className="admin-badge-super">المسؤول الرئيسي</span>
            </div>
            <p className="admin-subtitle">مرحباً {adminName} — إشراف ومراقبة مباشرة لجميع عمليات ومحركات المنصة</p>
          </div>
        </div>

        <div className="admin-header-actions">
          <div className="admin-live-pulse-badge">
            <span className="admin-pulse-dot"></span>
            <span>بث حي مباشر</span>
          </div>

          <Link to="/dashboard" className="admin-back-btn">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
            <span>لوحة التحكم الرئيسية</span>
          </Link>
        </div>
      </div>

      {/* ─── HeroUI Navigation Pills Bar ─── */}
      <div className="admin-tabs-row">
        <div className="admin-nav-tabs">
          <button
            type="button"
            className={`admin-tab-btn ${activeTab === 'all' ? 'admin-tab-btn--active' : ''}`}
            onClick={() => setActiveTab('all')}
          >
            نظرة عامة شاملة
          </button>
          <button
            type="button"
            className={`admin-tab-btn ${activeTab === 'bots' ? 'admin-tab-btn--active' : ''}`}
            onClick={() => setActiveTab('bots')}
          >
            البوتات ({bots.length})
          </button>
          <button
            type="button"
            className={`admin-tab-btn ${activeTab === 'merchants' ? 'admin-tab-btn--active' : ''}`}
            onClick={() => setActiveTab('merchants')}
          >
            التجار ({usersCount})
          </button>
        </div>

        <div className="admin-tabs-extra">
          <span className="admin-time-chip">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            تحديث فوري تلقائي
          </span>
        </div>
      </div>

      {/* ─── 4 KPI Metrics Grid (HeroUI Style) ─── */}
      <div className="admin-kpi-grid">
        {/* Card 1: Users */}
        <div className="admin-kpi-card">
          <div className="admin-kpi-head">
            <span className="admin-kpi-label">تجار مسجلون</span>
            <span className="admin-kpi-trend admin-kpi-trend--emerald">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="19" x2="12" y2="5" />
                <polyline points="5 12 12 5 19 12" />
              </svg>
              موثق
            </span>
          </div>
          <div className="admin-kpi-val">{usersCount}</div>
          <div className="admin-kpi-foot">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            <span>حسابات التجار على المنصة</span>
          </div>
        </div>

        {/* Card 2: Bots */}
        <div className="admin-kpi-card">
          <div className="admin-kpi-head">
            <span className="admin-kpi-label">بوتات متصلة / الإجمالي</span>
            <span className="admin-kpi-trend admin-kpi-trend--emerald">
              <span className="admin-kpi-dot-live"></span>
              نشط الآن
            </span>
          </div>
          <div className="admin-kpi-val">
            {connectedBotsCount} <span className="admin-kpi-val-sub">/ {bots.length}</span>
          </div>
          <div className="admin-kpi-foot">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
              <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
              <line x1="6" y1="6" x2="6.01" y2="6" />
              <line x1="6" y1="18" x2="6.01" y2="18" />
            </svg>
            <span>واتساب & تيليغرام</span>
          </div>
        </div>

        {/* Card 3: Orders */}
        <div className="admin-kpi-card">
          <div className="admin-kpi-head">
            <span className="admin-kpi-label">إجمالي الطلبيات</span>
            <span className="admin-kpi-trend admin-kpi-trend--cyan">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="19" x2="12" y2="5" />
                <polyline points="5 12 12 5 19 12" />
              </svg>
              مباشر
            </span>
          </div>
          <div className="admin-kpi-val">{ordersCount}</div>
          <div className="admin-kpi-foot">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="9" cy="21" r="1" />
              <circle cx="20" cy="21" r="1" />
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
            </svg>
            <span>مبيعات محققة عبر البوتات</span>
          </div>
        </div>

        {/* Card 4: Hot Leads */}
        <div className="admin-kpi-card">
          <div className="admin-kpi-head">
            <span className="admin-kpi-label">عملاء ساخنون (Hot Leads)</span>
            <span className="admin-kpi-trend admin-kpi-trend--amber">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
              أولوية عالية
            </span>
          </div>
          <div className="admin-kpi-val">{hotLeadsCount}</div>
          <div className="admin-kpi-foot">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
            </svg>
            <span>عملاء جاهزون للإغلاق المالي</span>
          </div>
        </div>
      </div>

      {/* ─── HeroUI Table Section: All Bots ─── */}
      <div className="admin-table-panel">
        <div className="admin-panel-toolbar">
          <div className="admin-toolbar-title-wrap">
            <h2 className="admin-panel-title">جدول مراقبة البوتات والمحركات</h2>
            <span className="admin-badge-count">{filteredBots.length}</span>
          </div>

          <div className="admin-toolbar-controls">
            {/* Filter Pills */}
            <div className="admin-filter-pill-group">
              <button
                type="button"
                className={`admin-filter-chip ${statusFilter === 'all' ? 'admin-filter-chip--active' : ''}`}
                onClick={() => setStatusFilter('all')}
              >
                الكل
              </button>
              <button
                type="button"
                className={`admin-filter-chip ${statusFilter === 'connected' ? 'admin-filter-chip--active' : ''}`}
                onClick={() => setStatusFilter('connected')}
              >
                المتصلة
              </button>
              <button
                type="button"
                className={`admin-filter-chip ${statusFilter === 'disconnected' ? 'admin-filter-chip--active' : ''}`}
                onClick={() => setStatusFilter('disconnected')}
              >
                غير المتصلة
              </button>
              <button
                type="button"
                className={`admin-filter-chip ${statusFilter === 'whatsapp' ? 'admin-filter-chip--active' : ''}`}
                onClick={() => setStatusFilter('whatsapp')}
              >
                واتساب
              </button>
              <button
                type="button"
                className={`admin-filter-chip ${statusFilter === 'telegram' ? 'admin-filter-chip--active' : ''}`}
                onClick={() => setStatusFilter('telegram')}
              >
                تيليغرام
              </button>
            </div>

            {/* Search Input */}
            <div className="admin-search-wrapper">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="admin-search-icon">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                className="admin-search-input"
                placeholder="بحث باسم البوت، البريد، أو المعرف..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  type="button"
                  className="admin-search-clear"
                  onClick={() => setSearchQuery('')}
                  title="مسح البحث"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Table Content */}
        {loading ? (
          <div className="admin-loading-state">
            <div className="admin-loading-spinner"></div>
            <span>جاري تحميل بيانات المنصة المباشرة...</span>
          </div>
        ) : filteredBots.length === 0 ? (
          <div className="admin-empty-state">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <line x1="9" y1="9" x2="15" y2="15" />
              <line x1="15" y1="9" x2="9" y2="15" />
            </svg>
            <p>لا توجد بوتات تطابق شروط التصفية أو البحث الحالية</p>
          </div>
        ) : (
          <div className="admin-table-scroll">
            <table className="admin-data-table">
              <thead>
                <tr>
                  <th>معرف البوت</th>
                  <th>اسم البوت</th>
                  <th>المنصة</th>
                  <th>المالك (التاجر)</th>
                  <th>حالة الاتصال</th>
                  <th>إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filteredBots.map((bot, idx) => {
                  const owner = usersMap[bot.userId];
                  const ownerEmail = owner?.email || bot.userId || 'غير معروف';
                  const isConnected = bot.whatsappStatus === 'connected' || Boolean(bot.telegramToken);
                  const isWhatsApp = Boolean(bot.whatsappStatus !== undefined || bot.platform === 'whatsapp' || bot.phone);
                  const isTelegram = Boolean(bot.telegramToken || bot.platform === 'telegram');

                  // Gradient color generator for avatars
                  const gradientHues = [
                    'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                    'linear-gradient(135deg, #10b981, #06b6d4)',
                    'linear-gradient(135deg, #f59e0b, #ef4444)',
                    'linear-gradient(135deg, #ec4899, #8b5cf6)',
                    'linear-gradient(135deg, #6366f1, #3b82f6)',
                  ];
                  const avatarGrad = gradientHues[idx % gradientHues.length];
                  const botInitial = (bot.name || 'B').trim().charAt(0).toUpperCase();

                  return (
                    <tr key={bot.id} className="admin-table-row">
                      {/* Column 1: Bot ID with Copy */}
                      <td className="admin-col-id">
                        <div className="admin-id-wrap">
                          <span className="admin-id-code">#{bot.id.slice(0, 8)}</span>
                          <button
                            type="button"
                            className="admin-id-copy-btn"
                            title="نسخ المعرف كاملاً"
                            onClick={() => handleCopyId(bot.id)}
                          >
                            {copiedId === bot.id ? (
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            ) : (
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                              </svg>
                            )}
                          </button>
                        </div>
                      </td>

                      {/* Column 2: Bot Name & Avatar */}
                      <td className="admin-col-name">
                        <div className="admin-user-cell">
                          <div
                            className="admin-table-avatar"
                            style={{
                              background: avatarGrad,
                              width: '40px',
                              height: '40px',
                              minWidth: '40px',
                              maxWidth: '40px',
                              borderRadius: '50%',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                              color: 'var(--text-primary)',
                              fontWeight: 800,
                              fontSize: '1rem',
                              boxShadow: '0 2px 10px rgba(0,0,0,0.35)',
                            }}
                          >
                            {botInitial}
                          </div>
                          <div className="admin-table-name-meta">
                            <span className="admin-bot-title">{bot.name || 'بوت بدون اسم'}</span>
                            <span className="admin-bot-desc" title={bot.description || ''}>
                              {bot.description
                                ? (bot.description.length > 45 ? bot.description.slice(0, 45) + '...' : bot.description)
                                : 'بوت محادثة ذكي'}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Column 3: Platform */}
                      <td className="admin-col-platform">
                        <div className="admin-platform-tags">
                          {isWhatsApp && (
                            <span className="admin-tag-platform admin-tag-wa" title="قناة واتساب">
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                              </svg>
                              WhatsApp
                            </span>
                          )}
                          {isTelegram && (
                            <span className="admin-tag-platform admin-tag-tg" title="قناة تيليغرام">
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="22" y1="2" x2="11" y2="13" />
                                <polygon points="22 2 15 22 11 13 2 9 22 2" />
                              </svg>
                              Telegram
                            </span>
                          )}
                          {!isWhatsApp && !isTelegram && (
                            <span className="admin-tag-platform admin-tag-generic">
                              غير محدد
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Column 4: Owner (Merchant) */}
                      <td className="admin-col-owner">
                        <div className="admin-owner-info">
                          <span className="admin-owner-email" title={ownerEmail}>{ownerEmail}</span>
                          <span className="admin-owner-plan">
                            {owner?.plan === 'pro' ? 'خطة Pro' : owner?.plan === 'enterprise' ? 'خطة Enterprise' : 'خطة Free'}
                          </span>
                        </div>
                      </td>

                      {/* Column 5: Status */}
                      <td className="admin-col-status">
                        {isConnected ? (
                          <span className="admin-status-chip admin-status-chip--online">
                            <span className="admin-status-dot-pulse"></span>
                            متصل
                          </span>
                        ) : (
                          <span className="admin-status-chip admin-status-chip--offline">
                            <span className="admin-status-dot-muted"></span>
                            غير متصل
                          </span>
                        )}
                      </td>

                      {/* Column 6: Actions */}
                      <td className="admin-col-actions">
                        <Link
                          to={`/bot/${bot.id}`}
                          className="admin-action-link-btn"
                          title="عرض تفاصيل البوت"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                          <span>معاينة</span>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
