import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getDoc, updateDoc, deleteDoc, getDocs } from '../services/nexcloud';
import { useToast } from '../context/ToastContext';

const ENGINE_URL = import.meta.env.VITE_ENGINE_URL || 'http://localhost:3002';

export default function BotDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [bot, setBot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [allMessages, setAllMessages] = useState([]);
  const [orders, setOrders] = useState([]);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showClearMessagesModal, setShowClearMessagesModal] = useState(false);
  const [showClearOrdersModal, setShowClearOrdersModal] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('chat'); // chat | orders | info
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [takeoverMap, setTakeoverMap] = useState({});
  const chatEndRef = useRef(null);

  const businessTypeLabels = {
    restaurant: 'مطعم', shop: 'متجر', clinic: 'عيادة',
    salon: 'صالون', delivery: 'توصيل', education: 'تعليم', other: 'اخرى',
  };
  const responseStyleLabels = { formal: 'رسمي', friendly: 'ودود', concise: 'مختصر' };
  const languageLabels = { arabic_formal: 'عربي فصيح', arabic_algerian: 'دارجة جزائرية', auto: 'تلقائي' };

  // Load all messages for this bot
  const loadMessages = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const res = await getDocs('conversations', { botId: id }, 1, 500);
      const msgs = (res.documents?.map(d => ({ id: d.id, ...d.data })) || [])
        .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      setAllMessages(msgs);
    } catch { /* ignore */ }
    setRefreshing(false);
  }, [id]);

  // Load orders
  const loadOrders = useCallback(async () => {
    try {
      const res = await getDocs('orders', { botId: id }, 1, 100);
      const sorted = (res.documents?.map(d => ({ id: d.id, ...d.data })) || [])
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setOrders(sorted);
    } catch { /* ignore */ }
  }, [id]);

  useEffect(() => {
    async function loadBot() {
      try {
        const res = await getDoc('bots', id);
        setBot({ id: res.document.id, ...res.document.data });
      } catch {
        toast.error('تعذر تحميل بيانات البوت');
        navigate('/dashboard');
      } finally {
        setLoading(false);
      }
    }
    loadBot();
    loadMessages(true);
    loadOrders();
  }, [id, loadMessages, loadOrders]);

  // Auto-refresh every 8 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      loadMessages(true);
      loadOrders();
    }, 8000);
    return () => clearInterval(interval);
  }, [loadMessages, loadOrders]);

  // Scroll to bottom when messages change
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [allMessages, selectedUserId]);

  // Group messages by telegramUserId
  const customerThreads = {};
  allMessages.forEach(m => {
    const uid = m.telegramUserId;
    if (!customerThreads[uid]) {
      customerThreads[uid] = { userId: uid, userName: m.userName, messages: [], lastTime: m.createdAt };
    }
    customerThreads[uid].messages.push(m);
    if (new Date(m.createdAt) > new Date(customerThreads[uid].lastTime)) {
      customerThreads[uid].lastTime = m.createdAt;
      if (m.role === 'user') customerThreads[uid].userName = m.userName;
    }
  });

  const sortedCustomers = Object.values(customerThreads)
    .sort((a, b) => new Date(b.lastTime) - new Date(a.lastTime));

  const selectedThread = selectedUserId ? customerThreads[selectedUserId] : null;

  // Send owner reply
  const handleReply = async () => {
    if (!replyText.trim() || !selectedUserId || sending) return;
    setSending(true);
    try {
      const res = await fetch(`${ENGINE_URL}/api/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          botId: id,
          telegramUserId: selectedUserId,
          message: replyText.trim(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setReplyText('');
        toast.success('تم ارسال الرد بنجاح');
        // Auto-enable takeover (backend does this too)
        setTakeoverMap(prev => ({ ...prev, [selectedUserId]: true }));
        // Optimistic update
        setAllMessages(prev => [...prev, {
          id: Date.now().toString(),
          botId: id,
          telegramUserId: selectedUserId,
          userName: 'المالك',
          content: replyText.trim(),
          role: 'owner',
          createdAt: new Date().toISOString(),
        }]);
      } else {
        toast.error(data.error || 'فشل الارسال');
      }
    } catch (err) {
      toast.error('خطأ في الاتصال بمحرك البوت');
    }
    setSending(false);
  };

  // Toggle human takeover
  const toggleTakeover = async (userId) => {
    const newState = !takeoverMap[userId];
    try {
      await fetch(`${ENGINE_URL}/api/takeover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ botId: id, telegramUserId: userId, enabled: newState }),
      });
      setTakeoverMap(prev => ({ ...prev, [userId]: newState }));
      toast.success(newState ? 'تم تفعيل الوضع اليدوي' : 'تم إعادة الوضع التلقائي');
    } catch {
      toast.error('فشل تغيير الوضع');
    }
  };

  // Update order status
  const updateOrderStatus = async (orderId, status) => {
    try {
      await fetch(`${ENGINE_URL}/api/orders/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, status }),
      });
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status } : o));
      toast.success('تم تحديث حالة الطلبية');
    } catch {
      toast.error('فشل التحديث');
    }
  };

  // Clear all messages for this bot
  const clearMessages = async () => {
    setClearing(true);
    try {
      const toDelete = allMessages.filter(m => m.botId === id);
      for (const msg of toDelete) {
        await deleteDoc('conversations', msg.id);
      }
      // Reset the message count on the bot document
      await updateDoc('bots', id, { messagesCount: 0 });
      setBot(prev => ({ ...prev, messagesCount: 0 }));
      
      setAllMessages([]);
      setSelectedUserId(null);
      setShowClearMessagesModal(false);
      toast.success(`تم مسح ${toDelete.length} رسالة`);
    } catch (err) {
      toast.error('فشل مسح الرسائل');
    }
    setClearing(false);
  };

  // Clear all orders for this bot
  const clearOrders = async () => {
    setClearing(true);
    try {
      for (const order of orders) {
        await deleteDoc('orders', order.id);
      }
      // Reset orders count if tracked (optional, but good practice)
      await updateDoc('bots', id, { ordersCount: 0 });
      
      setOrders([]);
      setShowClearOrdersModal(false);
      toast.success(`تم مسح ${orders.length} طلبية`);
    } catch (err) {
      toast.error('فشل مسح الطلبيات');
    }
    setClearing(false);
  };

  const toggleActive = async () => {
    try {
      await updateDoc('bots', id, { isActive: !bot.isActive });
      setBot(prev => ({ ...prev, isActive: !prev.isActive }));
      toast.success(bot.isActive ? 'تم ايقاف البوت' : 'تم تشغيل البوت');
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleDelete = async () => {
    try {
      await deleteDoc('bots', id);
      toast.success('تم حذف البوت');
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.message);
    }
  };

  if (loading) {
    return (
      <div className="page-loader">
        <div className="spinner spinner-lg" style={{ color: 'var(--accent-primary)' }} />
      </div>
    );
  }
  if (!bot) return null;

  const newOrdersCount = orders.filter(o => o.status === 'new').length;

  return (
    <div className="page-container animate-enter">
      <button className="btn btn-secondary" onClick={() => navigate('/dashboard')} style={{ marginBottom: 'var(--space-4)', padding: '0.5rem 1rem', fontSize: '0.875rem' }}>
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        العودة
      </button>

      {/* Header */}
      <div className="detail-header">
        <div className="detail-info">
          <div className="detail-avatar">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
          </div>
          <div>
            <h1 className="page-title" style={{ marginBottom: 'var(--space-1)' }}>{bot.botName || bot.businessName}</h1>
            <div className="detail-meta">
              <span className={`badge ${bot.isActive ? 'badge-success' : 'badge-error'}`}>
                <span className="badge-dot" />
                {bot.isActive ? 'نشط' : 'متوقف'}
              </span>
              <span className="badge badge-accent">{businessTypeLabels[bot.businessType] || bot.businessType}</span>
            </div>
          </div>
        </div>
        <div className="detail-actions">
          <button className={`btn ${bot.isActive ? 'btn-secondary' : 'btn-primary'}`} onClick={toggleActive}>
            {bot.isActive ? (
              <><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>ايقاف</>
            ) : (
              <><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>تشغيل</>
            )}
          </button>
          <button className="btn btn-danger" onClick={() => setShowDeleteModal(true)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            حذف
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="detail-tabs" style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-5)', marginTop: 'var(--space-4)' }}>
        {[
          { key: 'chat', label: 'المحادثات', count: sortedCustomers.length },
          { key: 'orders', label: 'الطلبيات', count: newOrdersCount },
          { key: 'info', label: 'معلومات البوت', count: null },
        ].map(tab => (
          <button
            key={tab.key}
            className={`btn ${activeTab === tab.key ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab(tab.key)}
            style={{ fontSize: '0.875rem', padding: '0.5rem 1.25rem', borderRadius: 'var(--radius-full)', position: 'relative' }}
          >
            {tab.label}
            {tab.count > 0 && (
              <span style={{
                background: tab.key === 'orders' ? '#ef4444' : 'var(--accent-primary)',
                color: '#fff', fontSize: '0.7rem', fontWeight: 700,
                borderRadius: '50%', width: '20px', height: '20px',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                marginRight: 'var(--space-2)',
              }}>{tab.count}</span>
            )}
          </button>
        ))}
        <button className="btn btn-secondary btn-sm" onClick={() => loadMessages()} disabled={refreshing} style={{ marginRight: 'auto', borderRadius: 'var(--radius-full)' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }}><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
          تحديث
        </button>
      </div>

      {/* Chat Tab */}
      {activeTab === 'chat' && (
        <div className="chat-layout">
          {/* Customer Sidebar */}
          <div className="chat-sidebar">
            <div className="chat-sidebar-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h4 style={{ margin: 0, fontSize: '0.9rem' }}>الزبائن ({sortedCustomers.length})</h4>
              {allMessages.length > 0 && (
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setShowClearMessagesModal(true)}
                  style={{ fontSize: '0.7rem', padding: '0.25rem 0.5rem', color: 'var(--color-error)' }}
                  title="مسح كل الرسائل"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                  مسح الكل
                </button>
              )}
            </div>
            {sortedCustomers.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 'var(--space-6)', color: 'var(--text-tertiary)', fontSize: 'var(--text-sm)' }}>
                لا توجد محادثات بعد
              </div>
            ) : (
              <div className="chat-customer-list">
                {sortedCustomers.map(c => {
                  const lastMsg = c.messages[c.messages.length - 1];
                  const isActive = c.userId === selectedUserId;
                  const isTakeover = takeoverMap[c.userId];
                  return (
                    <div key={c.userId} className={`chat-customer-item ${isActive ? 'active' : ''}`} onClick={() => setSelectedUserId(c.userId)}>
                      <div className="chat-customer-avatar">
                        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontWeight: 600, fontSize: '0.8125rem' }}>{c.userName || 'زبون'}</span>
                          <span style={{ fontSize: '0.6875rem', color: 'var(--text-tertiary)', flexShrink: 0 }}>{formatTime(c.lastTime)}</span>
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '2px' }}>
                          {lastMsg?.role === 'owner' ? 'انت: ' : lastMsg?.role === 'bot' ? 'البوت: ' : ''}{lastMsg?.content?.slice(0, 50) || '...'}
                        </div>
                      </div>
                      {isTakeover && (
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#f59e0b', flexShrink: 0 }} title="وضع يدوي" />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Chat Area */}
          <div className="chat-main">
            {!selectedUserId ? (
              <div className="chat-empty">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="1.5" style={{ opacity: 0.4 }}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                <p style={{ color: 'var(--text-tertiary)', marginTop: 'var(--space-3)' }}>اختر زبوناً من القائمة لعرض المحادثة</p>
              </div>
            ) : (
              <>
                {/* Chat Header */}
                <div className="chat-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                    <div className="chat-customer-avatar" style={{ width: '36px', height: '36px' }}>
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{selectedThread?.userName || 'زبون'}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>
                        {selectedThread?.messages?.length || 0} رسالة
                        {takeoverMap[selectedUserId] && <span style={{ color: '#f59e0b', marginRight: 'var(--space-2)' }}> -- وضع يدوي</span>}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                    <button
                      className={`btn btn-sm ${takeoverMap[selectedUserId] ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => toggleTakeover(selectedUserId)}
                      style={{ fontSize: '0.75rem', padding: '0.375rem 0.75rem', borderRadius: 'var(--radius-full)' }}
                      title={takeoverMap[selectedUserId] ? 'إعادة الرد التلقائي' : 'تولي الرد يدوياً'}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                      {takeoverMap[selectedUserId] ? 'ارجع للتلقائي' : 'رد يدوي'}
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setSelectedUserId(null)} style={{ padding: '0.375rem' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                  </div>
                </div>

                {/* Takeover Active Banner */}
                {takeoverMap[selectedUserId] && (
                  <div className="takeover-banner">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                      <span style={{ fontWeight: 600, fontSize: '0.8125rem' }}>الوضع اليدوي مفعل - البوت متوقف عن الرد لهذا الزبون</span>
                    </div>
                    <button
                      className="btn btn-sm"
                      onClick={() => toggleTakeover(selectedUserId)}
                      style={{
                        background: '#fff', color: '#92400e', border: 'none',
                        fontWeight: 700, fontSize: '0.8125rem', padding: '0.5rem 1.25rem',
                        borderRadius: 'var(--radius-full)', cursor: 'pointer',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
                      }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                      انهِ المحادثة وأعد البوت
                    </button>
                  </div>
                )}

                {/* Messages */}
                <div className="chat-messages">
                  {selectedThread?.messages?.map((msg, i) => (
                    <div key={msg.id || i} className={`chat-bubble-row ${msg.role === 'user' ? 'chat-row-user' : 'chat-row-bot'}`}>
                      <div className={`chat-bubble ${msg.role === 'user' ? 'chat-bubble-user' : msg.role === 'owner' ? 'chat-bubble-owner' : 'chat-bubble-bot'}`}>
                        <div className="chat-bubble-label">
                          {msg.role === 'user' ? (msg.userName || 'الزبون') : msg.role === 'owner' ? 'انت' : bot.botName}
                        </div>
                        <div className="chat-bubble-text">{msg.content}</div>
                        <div className="chat-bubble-time">{formatTime(msg.createdAt)}</div>
                      </div>
                    </div>
                  ))}
                  <div ref={chatEndRef} />
                </div>

                {/* Reply Input */}
                <div className="chat-input-bar">
                  <input
                    type="text"
                    className="form-input"
                    placeholder="اكتب ردك هنا..."
                    value={replyText}
                    onChange={e => setReplyText(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleReply()}
                    disabled={sending}
                    style={{ flex: 1, margin: 0, borderRadius: 'var(--radius-full)', padding: '0.625rem 1rem' }}
                  />
                  <button className="btn btn-primary" onClick={handleReply} disabled={sending || !replyText.trim()} style={{ borderRadius: 'var(--radius-full)', padding: '0.625rem 1.25rem' }}>
                    {sending ? <span className="spinner" /> : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                    )}
                    ارسال
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Orders Tab */}
      {activeTab === 'orders' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-5)' }}>
            <h3 className="card-title" style={{ margin: 0 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent-secondary)" strokeWidth="2"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
                الطلبيات ({orders.length})
              </span>
            </h3>
            {orders.length > 0 && (
              <button
                className="btn btn-sm btn-secondary"
                onClick={() => setShowClearOrdersModal(true)}
                style={{ fontSize: '0.75rem', color: 'var(--color-error)' }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                مسح كل الطلبيات
              </button>
            )}
          </div>
          {orders.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--text-tertiary)' }}>
              <p>لا توجد طلبيات بعد</p>
              <p style={{ fontSize: 'var(--text-sm)', marginTop: 'var(--space-2)' }}>ستظهر الطلبيات تلقائياً عندما يؤكد الزبائن طلباتهم مع عناوينهم وأرقام هواتفهم</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              {orders.map(order => (
                <div key={order.id} className="order-card">
                  <div className="order-card-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                      <OrderStatusBadge status={order.status} />
                      <span style={{ fontWeight: 600 }}>{order.customerName}</span>
                    </div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>{formatTime(order.createdAt)}</span>
                  </div>
                  <div className="order-card-body">
                    {order.phone && (
                      <div className="order-field">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                        <span dir="ltr">{order.phone}</span>
                      </div>
                    )}
                    {order.address && (
                      <div className="order-field">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                        <span>{order.address}</span>
                      </div>
                    )}
                    {order.orderSummary && (
                      <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', marginTop: 'var(--space-2)', lineHeight: 'var(--leading-relaxed)' }}>
                        {order.orderSummary}
                      </div>
                    )}
                  </div>
                  <div className="order-card-actions">
                    {order.status === 'new' && (
                      <>
                        <button className="btn btn-sm btn-primary" onClick={() => updateOrderStatus(order.id, 'confirmed')} style={{ fontSize: '0.75rem' }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                          تأكيد
                        </button>
                        <button className="btn btn-sm btn-secondary" onClick={() => updateOrderStatus(order.id, 'cancelled')} style={{ fontSize: '0.75rem' }}>الغاء</button>
                      </>
                    )}
                    {order.status === 'confirmed' && (
                      <button className="btn btn-sm btn-primary" onClick={() => updateOrderStatus(order.id, 'delivered')} style={{ fontSize: '0.75rem', background: '#25D366', borderColor: '#25D366' }}>
                        تم التوصيل
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Info Tab - Premium V3 Layout */}
      {activeTab === 'info' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          {/* Business Info Card */}
          <div className="premium-card">
            <div className="premium-card-header">
              <div className="premium-icon purple">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
              </div>
              <div>
                <h4 className="premium-title">معلومات المشروع</h4>
                <p className="premium-subtitle">التفاصيل الأساسية للنشاط التجاري</p>
              </div>
            </div>
            <div className="premium-card-content">
              <InfoRowV3 label="اسم المشروع" value={bot.businessName} />
              <InfoRowV3 label="اسم البوت" value={bot.botName} />
              <InfoRowV3 label="نوع النشاط" value={businessTypeLabels[bot.businessType]} />
              {bot.workingHours && <InfoRowV3 label="ساعات العمل" value={bot.workingHours} />}
              {bot.location && <InfoRowV3 label="الموقع" value={bot.location} />}
              {bot.contact && <InfoRowV3 label="التواصل" value={bot.contact} />}

              {bot.description && (
                <div className="premium-field-block">
                  <span className="premium-field-label">الوصف</span>
                  <div className="premium-field-text">{bot.description}</div>
                </div>
              )}
              {bot.services && (
                <div className="premium-field-block">
                  <span className="premium-field-label">الخدمات والأسعار</span>
                  <div className="premium-field-text">{bot.services}</div>
                </div>
              )}
            </div>
          </div>

          <div className="premium-grid-2">
            {/* Personality Card */}
            <div className="premium-card">
              <div className="premium-card-header">
                <div className="premium-icon emerald">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
                </div>
                <div>
                  <h4 className="premium-title">شخصية الذكاء الاصطناعي</h4>
                  <p className="premium-subtitle">أسلوب التحدث والتفاعل</p>
                </div>
              </div>
              <div className="premium-card-content">
                <InfoRowV3 label="أسلوب الرد" value={responseStyleLabels[bot.responseStyle]} />
                <InfoRowV3 label="اللغة" value={languageLabels[bot.language]} />
                {bot.customInstructions && (
                  <div className="premium-field-block">
                    <span className="premium-field-label">تعليمات خاصة</span>
                    <div className="premium-field-text">{bot.customInstructions}</div>
                  </div>
                )}
              </div>
            </div>

            {/* Technical Card */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
              <div className="premium-card">
                <div className="premium-card-header">
                  <div className="premium-icon blue">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-2.82.33v.28A2 2 0 0 1 10 21.54a2 2 0 0 1-1.09-2.6A1.65 1.65 0 0 0 9 17.18a1.65 1.65 0 0 0-1.82-.33 2 2 0 1 1-2.36-3.24 1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.28a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82 2 2 0 1 1 2.83-2.83 1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.28c.26.6.85 1 1.51 1a1.65 1.65 0 0 0 1.82-.33 2 2 0 1 1 2.83 2.83 1.65 1.65 0 0 0-.33 1.82V9c.26.6.85 1 1.51 1H21a2 2 0 1 1 0 4h-.28c-.66 0-1.25.4-1.51 1z"/></svg>
                  </div>
                  <div>
                    <h4 className="premium-title">الإعدادات التقنية</h4>
                    <p className="premium-subtitle">المحرك ومعدل الاستخدام</p>
                  </div>
                </div>
                <div className="premium-card-content">
                  <InfoRowV3 label="نظام الذكاء الاصطناعي" value="المحرك المتقدم الأساسي" />
                  <InfoRowV3 label="إصدار النموذج" value="الجيل الأحدث (V2)" />
                  <InfoRowV3 label="إجمالي الرسائل" value={String(bot.messagesCount || 0)} />
                </div>
              </div>

              {/* Telegram integration block */}
              {bot.telegramToken && (
                <div className="premium-card" style={{ background: 'linear-gradient(135deg, rgba(42, 171, 238, 0.05), rgba(42, 171, 238, 0.01))', borderColor: 'rgba(42, 171, 238, 0.2)' }}>
                  <div className="premium-card-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <div className="premium-icon" style={{ background: 'rgba(42, 171, 238, 0.15)', color: '#2AABEE' }}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
                      </div>
                      <div>
                        <h4 className="premium-title" style={{ fontSize: '1rem' }}>رابط تيليغرام</h4>
                        <p className="premium-subtitle" style={{ fontSize: '0.75rem' }}>البوت نشط وجاهز لاستقبال الرسائل</p>
                      </div>
                    </div>
                    <a href="https://t.me/" target="_blank" rel="noopener noreferrer" className="btn-telegram">
                      فتح البوت
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}


      {/* WhatsApp Connection */}
      {bot.whatsappEnabled && activeTab === 'info' && (
        <WhatsAppConnect botId={bot.id} botName={bot.botName} status={bot.whatsappStatus} />
      )}

      {/* Clear Messages Modal */}
      {showClearMessagesModal && (
        <div className="modal-overlay" onClick={() => !clearing && setShowClearMessagesModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-body" style={{ paddingBottom: 0 }}>
              <div className="modal-icon-container warning">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              </div>
              <h3 className="modal-title" style={{ marginBottom: '8px' }}>مسح جميع المحادثات</h3>
              <p>
                هل أنت متأكد من رغبتك في مسح <strong>جميع المحادثات والرسائل</strong> لهذا البوت؟
                <br /><br />
                سيتم تصفير عداد الرسائل في الداشبورد. هذا الإجراء سيحذف السجل بالكامل ولا يمكن التراجع عنه.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowClearMessagesModal(false)} disabled={clearing}>تراجع</button>
              <button className="btn btn-danger" onClick={clearMessages} disabled={clearing}>
                {clearing ? <span className="spinner" /> : 'مسح كل الرسائل'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear Orders Modal */}
      {showClearOrdersModal && (
        <div className="modal-overlay" onClick={() => !clearing && setShowClearOrdersModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-body" style={{ paddingBottom: 0 }}>
              <div className="modal-icon-container warning">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
              </div>
              <h3 className="modal-title" style={{ marginBottom: '8px' }}>مسح جميع الطلبيات</h3>
              <p>
                هل أنت متأكد من رغبتك في مسح <strong>جميع سجلات الطلبيات</strong> لهذا البوت المكتملة والمفتوحة بشكل نهائي؟
                <br /><br />
                هذا الإجراء لا يمكن التراجع عنه.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowClearOrdersModal(false)} disabled={clearing}>تراجع</button>
              <button className="btn btn-danger" onClick={clearOrders} disabled={clearing}>
                {clearing ? <span className="spinner" /> : 'مسح كل الطلبيات'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Bot Modal */}
      {showDeleteModal && (
        <div className="modal-overlay" onClick={() => setShowDeleteModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-body" style={{ paddingBottom: 0 }}>
              <div className="modal-icon-container danger">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
              </div>
              <h3 className="modal-title" style={{ marginBottom: '8px' }}>حذف البوت نهائياً</h3>
              <p>
                هل أنت متأكد من رغبتك في حذف البوت <strong>"{bot.botName}"</strong> مع كافة بياناته وسجل محادثاته بشكل دائم لا رجوع فيه؟
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowDeleteModal(false)}>تراجع</button>
              <button className="btn btn-danger" onClick={handleDelete}>نعم، احذف البوت</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────
function formatTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now - d;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'الآن';
  if (diffMin < 60) return `${diffMin} د`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH} س`;
  return d.toLocaleDateString('ar');
}

function OrderStatusBadge({ status }) {
  const config = {
    new: { label: 'جديد', bg: 'rgba(239,68,68,0.12)', color: '#ef4444' },
    confirmed: { label: 'مؤكد', bg: 'rgba(59,130,246,0.12)', color: '#3b82f6' },
    delivered: { label: 'تم التوصيل', bg: 'rgba(37,211,102,0.12)', color: '#25D366' },
    cancelled: { label: 'ملغي', bg: 'var(--surface-tertiary)', color: 'var(--text-tertiary)' },
  };
  const c = config[status] || config.new;
  return (
    <span style={{ fontSize: '0.6875rem', fontWeight: 700, background: c.bg, color: c.color, padding: '0.1875rem 0.625rem', borderRadius: 'var(--radius-full)' }}>
      {c.label}
    </span>
  );
}

function InfoRowV3({ label, value }) {
  if (!value) return null;
  return (
    <div className="premium-row">
      <span className="premium-row-label">{label}</span>
      <span className="premium-row-value">{value}</span>
    </div>
  );
}

// ─── WhatsApp Connect ─────────────────────────────────────────
const WA_ENGINE = import.meta.env.VITE_WA_ENGINE_URL || 'http://localhost:3001';
const WA_KEY = import.meta.env.VITE_API_KEY;

function WhatsAppConnect({ botId, botName, status: initialStatus }) {
  const [waStatus, setWaStatus] = useState(initialStatus || 'not_initialized');
  const [qrDataUrl, setQrDataUrl] = useState(null);
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    if (waStatus !== 'waiting_scan' && waStatus !== 'initializing') return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${WA_ENGINE}/api/whatsapp/${botId}/qr`, { headers: { 'x-api-key': WA_KEY } });
        const data = await res.json();
        setWaStatus(data.status);
        if (data.qrDataUrl) setQrDataUrl(data.qrDataUrl);
        if (data.status === 'connected') { setQrDataUrl(null); clearInterval(interval); }
      } catch {}
    }, 3000);
    return () => clearInterval(interval);
  }, [waStatus, botId]);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const res = await fetch(`${WA_ENGINE}/api/whatsapp/create`, {
        method: 'POST', headers: { 'x-api-key': WA_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ botId }),
      });
      const data = await res.json();
      if (data.success) setWaStatus('initializing');
    } catch {}
    setConnecting(false);
  };

  const handleDisconnect = async () => {
    try {
      await fetch(`${WA_ENGINE}/api/whatsapp/${botId}/stop`, { method: 'POST', headers: { 'x-api-key': WA_KEY } });
      setWaStatus('disconnected');
      setQrDataUrl(null);
    } catch {}
  };

  const st = {
    not_initialized: { label: 'غير متصل', color: 'var(--text-tertiary)', bg: 'var(--surface-tertiary)' },
    initializing: { label: 'جاري التهيئة...', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)' },
    waiting_scan: { label: 'في انتظار المسح', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)' },
    connected: { label: 'متصل', color: '#25D366', bg: 'rgba(37, 211, 102, 0.1)' },
    disconnected: { label: 'غير متصل', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)' },
    error: { label: 'خطأ', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)' },
  }[waStatus] || { label: 'غير متصل', color: 'var(--text-tertiary)', bg: 'var(--surface-tertiary)' };

  return (
    <div className="card" style={{ marginTop: 'var(--space-5)', textAlign: 'center', padding: 'var(--space-6)' }}>
      <h3 className="card-title" style={{ margin: '0 0 var(--space-4)' }}>ربط واتساب</h3>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)', padding: 'var(--space-2) var(--space-4)', borderRadius: 'var(--radius-full)', background: st.bg, marginBottom: 'var(--space-5)' }}>
        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: st.color }} />
        <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: st.color }}>{st.label}</span>
      </div>
      {(waStatus === 'not_initialized' || waStatus === 'disconnected' || waStatus === 'error') && (
        <div>
          <button className="btn btn-primary" onClick={handleConnect} disabled={connecting} style={{ background: '#25D366', borderColor: '#25D366' }}>
            {connecting ? <span className="spinner" /> : 'ربط واتساب'}
          </button>
        </div>
      )}
      {waStatus === 'waiting_scan' && qrDataUrl && (
        <div>
          <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-4)' }}>امسح هذا الكود بتطبيق واتساب</p>
          <div style={{ background: '#fff', borderRadius: 'var(--radius-lg)', display: 'inline-block', padding: 'var(--space-4)' }}>
            <img src={qrDataUrl} alt="QR Code" style={{ width: '250px', height: '250px' }} />
          </div>
        </div>
      )}
      {waStatus === 'initializing' && <div className="spinner spinner-lg" style={{ color: '#25D366', margin: '0 auto' }} />}
      {waStatus === 'connected' && (
        <div>
          <p style={{ color: '#25D366', fontWeight: 600, marginBottom: 'var(--space-3)' }}>واتساب متصل بنجاح</p>
          <button className="btn btn-secondary btn-sm" onClick={handleDisconnect}>فصل الاتصال</button>
        </div>
      )}
    </div>
  );
}
