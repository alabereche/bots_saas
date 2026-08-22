import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  subscribeBot,
  updateBot,
  deleteBot,
  subscribeConversations,
  clearBotMessages,
  subscribeOrders,
  updateOrderStatus as fbUpdateOrderStatus,
  updateOrderDelivery,
  sanitizeBotFeatures,
  clearBotOrders,
} from '../services/firebase';
import { useToast } from '../context/ToastContext';
import { COUNTRIES } from '../data/countries';
import { BUSINESS_TYPES } from './CreateBot';
import { auth } from '../services/firebase';
import ProductCatalogManager from '../components/ProductCatalogManager';
import ChannelsManager from '../components/ChannelsManager';

function PlatformMiniIcon({ platform, size = 11 }) {
  switch (platform) {
    case 'whatsapp':
      return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>;
    case 'telegram':
      return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>;
    default:
      return null;
  }
}

function platformLabel(p) {
  if (p === 'whatsapp') return 'WhatsApp';
  if (p === 'telegram') return 'Telegram';
  return 'محادثة';
}

// Engine endpoints served through the Cloudflare tunnel (HTTPS)
const WHATSAPP_ENGINE_URL = import.meta.env.VITE_WHATSAPP_ENGINE_URL || 'https://wa.nosfir.online';
const TELEGRAM_ENGINE_URL = import.meta.env.VITE_ENGINE_URL || 'https://tg.nosfir.online';

function engineUrlFor(platform) {
  return platform === 'whatsapp' ? WHATSAPP_ENGINE_URL : TELEGRAM_ENGINE_URL;
}

// Engines authenticate the signed-in dashboard user via their
// Firebase ID token — no shared secret ships in the client bundle
async function engineHeaders(json = true) {
  const token = await auth.currentUser?.getIdToken();
  const headers = { Authorization: `Bearer ${token || ''}` };
  if (json) headers['Content-Type'] = 'application/json';
  return headers;
}

const businessTypeLabels = {
  shop: 'متجر إلكتروني / تجارة',
  support: 'خدمة عملاء ودعم فني',
  agency: 'شركة / وكالة خدمات',
  booking: 'حجز مواعيد واستشارات',
  clinic: 'عيادة / مركز صحي',
  education: 'تعليم / دورات وتدريب',
  realestate: 'عقارات ومقاولات',
  restaurant: 'مطعم / كافيه',
  services: 'خدمات مهنية وحرفية',
  assistant: 'مساعد ذكي شخصي',
  custom: 'نشاط مخصص',
  delivery: 'خدمة توصيل',
  salon: 'صالون تجميل',
  other: 'نشاط عام',
};

const responseStyleLabels = { formal: 'رسمي', friendly: 'ودود', concise: 'مختصر' };
const languageLabels = { arabic_formal: 'عربي فصيح', arabic_algerian: 'دارجة جزائرية', auto: 'تلقائي' };

export default function BotDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [bot, setBot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [allMessages, setAllMessages] = useState([]);
  const [orders, setOrders] = useState([]);
  const [activeTab, setActiveTab] = useState('chat'); // 'chat' | 'orders' | 'info'
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [takeoverMap, setTakeoverMap] = useState({});
  const chatEndRef = useRef(null);

  // Modals state
  const [showEditModal, setShowEditModal] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showClearMessagesModal, setShowClearMessagesModal] = useState(false);
  const [showClearOrdersModal, setShowClearOrdersModal] = useState(false);
  const [clearing, setClearing] = useState(false);

  // Commerce-First Inbox Filters & Search
  const [inboxFilter, setInboxFilter] = useState('all'); // 'all' | 'unread' | 'orders' | 'customers'
  const [inboxSearch, setInboxSearch] = useState('');

  // Edit form state
  const [editData, setEditData] = useState({
    botName: '',
    businessName: '',
    businessType: 'shop',
    customType: '',
    country: 'DZ',
    currency: 'دج',
    description: '',
    services: '',
    customInstructions: '',
    responseStyle: 'friendly',
    language: 'arabic_algerian',
    telegramToken: '',
    workingHours: '',
    location: '',
    contact: '',
  });

  // Realtime Subscriptions
  useEffect(() => {
    if (!id) return;
    setLoading(true);

    const unsubBot = subscribeBot(id, (botData) => {
      if (!botData) {
        toast.error('تعذر العثور على البوت أو تم حذفه');
        navigate('/dashboard');
        return;
      }
      setBot(botData);
      setLoading(false);
    });

    const unsubMsgs = subscribeConversations(id, (msgs) => {
      setAllMessages(msgs || []);
    });

    const unsubOrders = subscribeOrders(id, (ords) => {
      setOrders(ords || []);
    });

    return () => {
      unsubBot();
      unsubMsgs();
      unsubOrders();
    };
  }, [id, navigate, toast]);

  // Scroll to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [allMessages, selectedUserId]);

  // Load current manual-mode (takeover) state from the WhatsApp engine,
  // so the UI matches reality after a page reload
  useEffect(() => {
    if (!id || !bot || bot.platform !== 'whatsapp') return;
    engineHeaders(false)
      .then(headers => fetch(`${WHATSAPP_ENGINE_URL}/api/takeover/${id}`, { headers }))
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (data?.takeovers) setTakeoverMap(data.takeovers);
      })
      .catch(() => {});
  }, [id, bot?.platform]);

  // Group messages by customer and link to orders & channels
  const customerOrdersMap = {};
  (orders || []).forEach(o => {
    if (o.customerId) customerOrdersMap[String(o.customerId)] = o;
    if (o.phone) customerOrdersMap[String(o.phone)] = o;
  });

  const customerThreads = {};
  (allMessages || []).forEach(m => {
    if (!m) return;
    const uid = m.telegramUserId || m.customerId || m.userId || 'default';
    if (!customerThreads[uid]) {
      customerThreads[uid] = { 
        userId: uid, 
        userName: m.userName || 'مستخدم', 
        platform: m.platform || bot?.platform || 'whatsapp',
        messages: [], 
        lastTime: m.createdAt || new Date().toISOString()
      };
    }
    customerThreads[uid].messages.push(m);
    if (m.platform) customerThreads[uid].platform = m.platform;
    if (new Date(m.createdAt) > new Date(customerThreads[uid].lastTime)) {
      customerThreads[uid].lastTime = m.createdAt;
      if (m.role === 'user' && m.userName) customerThreads[uid].userName = m.userName;
    }
  });

  const sortedCustomers = Object.values(customerThreads)
    .sort((a, b) => new Date(b.lastTime) - new Date(a.lastTime));

  const filteredCustomers = sortedCustomers.filter(c => {
    if (inboxSearch.trim()) {
      const q = inboxSearch.toLowerCase().trim();
      const matchName = (c.userName || '').toLowerCase().includes(q);
      const matchMsg = c.messages.some(m => (m.content || '').toLowerCase().includes(q));
      const order = customerOrdersMap[c.userId];
      const matchCode = order && (order.trackingCode || '').toLowerCase().includes(q);
      if (!matchName && !matchMsg && !matchCode) return false;
    }
    if (inboxFilter === 'orders') {
      return !!customerOrdersMap[c.userId];
    }
    if (inboxFilter === 'unread') {
      return !!takeoverMap[c.userId] || c.messages[c.messages.length - 1]?.role === 'user';
    }
    if (inboxFilter === 'customers') {
      return c.messages.length >= 3 || !!customerOrdersMap[c.userId];
    }
    return true;
  });

  const selectedThread = selectedUserId ? customerThreads[selectedUserId] : null;

  const defaultDeliveryMessage = (order, currentBot) => {
    const customerName = order.customerName || 'عميلنا العزيز';
    const productName = order.product || 'طلبيتكم';
    const price = order.price ? `${order.price} ${currentBot.currency || 'دج'}` : '';
    const address = order.address || '';
    const storeName = currentBot.businessName || 'متجرنا';

    if (currentBot.deliveryReceiptMessage && currentBot.deliveryReceiptMessage.trim()) {
      return currentBot.deliveryReceiptMessage
        .replace(/{name}/g, customerName)
        .replace(/{product}/g, productName)
        .replace(/{price}/g, price)
        .replace(/{address}/g, address)
        .replace(/{store}/g, storeName);
    }

    let text = `طلبيتك وصلت وهي جاهزة للاستلام!\n\n`;
    text += `عزيزي/عزيزتي ${customerName}،\n`;
    text += `يسعدنا إبلاغك بأن طلبيتك الخاصة بـ (${productName}) قد وصلت وباتت جاهزة للاستلام.\n\n`;
    text += `📋 تفاصيل الاستلام:\n`;
    text += `• الطلب / المنتج: ${productName}\n`;
    if (price) text += `• المبلغ المطلوب عند الاستلام: ${price}\n`;
    if (address) text += `• العنوان / جهة التسليم: ${address}\n`;
    text += `\nيرجى التقدم للاستلام، وإذا كان لديك أي استفسار يسعدنا دائماً تواصلك معنا!\n`;
    text += `شكراً لتعاملك وثقتك بـ "${storeName}".`;
    return text;
  };

  // Actions
  const toggleActive = async () => {
    if (!bot) return;
    try {
      await updateBot(id, { isActive: !bot.isActive });
      toast.success(bot.isActive ? 'تم إيقاف البوت' : 'تم تفعيل البوت');
    } catch (err) {
      toast.error('فشل تغيير حالة البوت: ' + err.message);
    }
  };

  const startEditing = () => {
    setEditData({
      botName: bot.botName || '',
      businessName: bot.businessName || '',
      businessType: bot.businessType || 'shop',
      customType: bot.customType || '',
      country: bot.country || 'DZ',
      currency: bot.currency || 'دج',
      description: bot.description || '',
      services: bot.services || '',
      customInstructions: bot.customInstructions || '',
      responseStyle: bot.responseStyle || 'friendly',
      language: bot.language || 'arabic_algerian',
      telegramToken: bot.telegramToken || '',
      workingHours: bot.workingHours || '',
      location: bot.location || '',
      contact: bot.contact || '',
      autoDeliveryReceipt: bot.autoDeliveryReceipt !== false,
      deliveryReceiptMessage: bot.deliveryReceiptMessage || '',
    });
    setShowEditModal(true);
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    setSavingEdit(true);
    try {
      const selectedCountryObj = COUNTRIES.find(c => c.code === editData.country) || COUNTRIES[0];
      await updateBot(id, {
        ...editData,
        countryName: selectedCountryObj.name,
        currency: selectedCountryObj.currency,
        phoneCode: selectedCountryObj.dialCode,
      });
      setShowEditModal(false);
      toast.success('تم حفظ التعديلات بنجاح');
    } catch (err) {
      toast.error('فشل حفظ التعديلات: ' + err.message);
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = async () => {
    try {
      await deleteBot(id);
      toast.success('تم حذف البوت بنجاح');
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleReply = async () => {
    if (!replyText.trim() || !selectedUserId || sending) return;
    setSending(true);
    try {
      const threadPlatform = selectedThread?.platform || bot?.platform || 'whatsapp';
      const engineUrl = threadPlatform === 'whatsapp' ? WHATSAPP_ENGINE_URL : TELEGRAM_ENGINE_URL;

      const res = await fetch(`${engineUrl}/api/reply`, {
        method: 'POST',
        headers: await engineHeaders(),
        body: JSON.stringify({
          botId: id,
          customerId: selectedUserId,
          telegramUserId: selectedUserId,
          platform: threadPlatform,
          message: replyText.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        setReplyText('');
        toast.success('تم إرسال الرد المباشر بنجاح للزبون');
        setTakeoverMap(prev => ({ ...prev, [selectedUserId]: true }));
      } else {
        toast.error(data.error || 'فشل الإرسال');
      }
    } catch {
      toast.error('خطأ في الاتصال بمحرك البوت');
    } finally {
      setSending(false);
    }
  };

  const toggleTakeover = async (userId) => {
    const newState = !takeoverMap[userId];
    try {
      const res = await fetch(`${engineUrlFor(bot?.platform)}/api/takeover`, {
        method: 'POST',
        headers: await engineHeaders(),
        body: JSON.stringify({ botId: id, telegramUserId: userId, enabled: newState }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'فشل تغيير الوضع');
      }
      setTakeoverMap(prev => ({ ...prev, [userId]: newState }));
      toast.success(newState ? 'تم تفعيل الوضع اليدوي' : 'تم تفعيل الرد التلقائي');
    } catch (err) {
      toast.error(err.message || 'فشل تغيير الوضع');
    }
  };

  const updateOrderStatus = async (order, status) => {
    try {
      const orderId = typeof order === 'object' ? order.id : order;
      await fbUpdateOrderStatus(orderId, status);

      if (status === 'delivered') {
        const currentOrder = typeof order === 'object' ? order : orders.find(o => o.id === orderId);
        if (bot?.autoDeliveryReceipt !== false && currentOrder?.customerId) {
          const receiptMsg = defaultDeliveryMessage(currentOrder, bot);
          try {
            const res = await fetch(`${engineUrlFor(bot?.platform)}/api/reply`, {
              method: 'POST',
              headers: await engineHeaders(),
              body: JSON.stringify({
                botId: id,
                telegramUserId: currentOrder.customerId,
                message: receiptMsg,
                system: true,
              }),
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok && data.success) {
              toast.success('تم تحديث الحالة وإرسال إشعار الإيصال للزبون في المحادثة');
            } else {
              toast.success('تم تحديث حالة الطلبية إلى مكتمل التوصيل');
            }
          } catch (netErr) {
            toast.success('تم تحديث حالة الطلبية إلى مكتمل التوصيل');
          }
        } else {
          toast.success('تم تحديث حالة الطلبية إلى مكتمل التوصيل');
        }
      } else {
        toast.success(status === 'confirmed' ? 'تم تأكيد الطلبية بنجاح' : 'تم تحديث حالة الطلبية');
      }
    } catch {
      toast.error('فشل التحديث');
    }
  };

  const clearMessages = async () => {
    setClearing(true);
    try {
      await clearBotMessages(id);
      setSelectedUserId(null);
      setShowClearMessagesModal(false);
      toast.success('تم مسح جميع الرسائل بنجاح');
    } catch {
      toast.error('فشل مسح الرسائل');
    } finally {
      setClearing(false);
    }
  };

  const clearOrders = async () => {
    setClearing(true);
    try {
      await clearBotOrders(id);
      setShowClearOrdersModal(false);
      toast.success('تم مسح جميع الطلبيات بنجاح');
    } catch {
      toast.error('فشل مسح الطلبيات');
    } finally {
      setClearing(false);
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="spinner spinner-lg" />
      </div>
    );
  }

  if (!bot) return null;

  const newOrdersCount = orders.filter(o => o.status === 'new').length;
  const currentActivityName = bot.customType || businessTypeLabels[bot.businessType] || bot.businessType || 'مشروع عام';
  const isWhatsapp = bot.platform === 'whatsapp';

  return (
    <div className="page-container">
      {/* Back button */}
      <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '1.25rem' }}>
        <button className="btn btn-secondary btn-sm" onClick={() => navigate('/dashboard')} style={{ gap: '6px' }}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          العودة للوحة التحكم
        </button>
      </div>

      {/* Header Solid Card */}
      <div className="card" style={{ padding: '1.25rem 1.5rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '46px', height: '46px',
            borderRadius: 'var(--radius-md)',
            background: isWhatsapp ? 'var(--color-whatsapp-bg)' : 'var(--color-telegram-bg)',
            color: isWhatsapp ? 'var(--color-whatsapp)' : '#38bdf8',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '1px solid var(--border-default)'
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
          </div>
          <div>
            <h1 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#ffffff', marginBottom: '0.2rem' }}>
              {bot.botName || bot.businessName}
            </h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span className={`status-pill ${bot.isActive ? 'status--online' : 'status--waiting'}`}>
                <span className="status-pill-dot" />
                {bot.isActive ? 'نشط' : 'متوقف'}
              </span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>•</span>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{currentActivityName}</span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>•</span>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>العملة: {bot.currency || 'دج'}</span>
            </div>
          </div>
        </div>

        <div className="bot-actions-row">
          <button className="btn btn-secondary btn-sm" onClick={startEditing}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            تعديل
          </button>
          <button className="btn btn-secondary btn-sm" onClick={toggleActive}>
            {bot.isActive ? (
              <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>إيقاف</>
            ) : (
              <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>تشغيل</>
            )}
          </button>
          <button className="btn btn-danger btn-sm" onClick={() => setShowDeleteModal(true)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            حذف
          </button>
        </div>
      </div>

      {/* Solid High-Contrast Tabs Bar (5 Grid Columns) */}
      <div className="tabs-container" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))' }}>
        {[
          { key: 'chat', label: 'المحادثات', count: sortedCustomers.length },
          { key: 'orders', label: 'الطلبيات والتتبع', count: newOrdersCount },
          { key: 'catalog', label: 'الكتالوج والمنتجات', count: bot?.products?.length || null },
          { key: 'channels', label: 'قنوات الربط', count: null },
          { key: 'info', label: 'الإعدادات والقدرات', count: null },
        ].map(tab => (
          <button
            key={tab.key}
            className={`tab-btn ${activeTab === tab.key ? 'tab-btn--active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            <span>{tab.label}</span>
            {tab.count > 0 && (
              <span className={`tab-count-badge ${tab.key === 'orders' ? 'badge--danger' : ''}`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ─── Tab 1: Commerce-First Chat Layout ─── */}
      {activeTab === 'chat' && (
        <div className={`chat-layout ${selectedUserId ? 'has-selected-user' : ''}`}>
          {/* Customer Sidebar (Right) */}
          <div className="chat-sidebar">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.85rem 1rem', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-card)' }}>
              <h4 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 800, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2.2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                المحادثات ({sortedCustomers.length})
              </h4>
              {allMessages.length > 0 && (
                <button
                  className="btn btn-danger btn-sm"
                  onClick={() => setShowClearMessagesModal(true)}
                  style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem', minHeight: 'auto' }}
                >
                  مسح السجل
                </button>
              )}
            </div>

            {/* Commerce-First Inbox Toolbar */}
            <div className="inbox-toolbar">
              <div className="inbox-search-box">
                <input
                  type="text"
                  className="inbox-search-input"
                  placeholder="بحث بالاسم أو المحادثة..."
                  value={inboxSearch}
                  onChange={e => setInboxSearch(e.target.value)}
                />
                <svg className="inbox-search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
              </div>

              <div className="inbox-filters-row">
                {[
                  { key: 'all', label: 'كل المحادثات', count: sortedCustomers.length },
                  { key: 'unread', label: 'غير مقروءة', count: sortedCustomers.filter(c => takeoverMap[c.userId] || c.messages[c.messages.length - 1]?.role === 'user').length },
                  { key: 'orders', label: 'طلبات 📦', count: Object.keys(customerOrdersMap).length },
                  { key: 'customers', label: 'عملاء', count: sortedCustomers.filter(c => c.messages.length >= 3).length },
                ].map(f => (
                  <button
                    key={f.key}
                    type="button"
                    className={`inbox-filter-btn ${inboxFilter === f.key ? 'is-active' : ''}`}
                    onClick={() => setInboxFilter(f.key)}
                  >
                    <span>{f.label}</span>
                    {f.count > 0 && <span className="inbox-count-badge">{f.count}</span>}
                  </button>
                ))}
              </div>
            </div>

            {filteredCustomers.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>
                <p style={{ fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>لا توجد محادثات تطابق هذا الفلتر</p>
                <p style={{ fontSize: '0.78rem' }}>جرب اختيار "كل المحادثات" أو إفراغ خانة البحث.</p>
              </div>
            ) : (
              <div style={{ overflowY: 'auto', flex: 1 }}>
                {filteredCustomers.map(c => {
                  const lastMsg = c.messages[c.messages.length - 1];
                  const isActive = c.userId === selectedUserId;
                  const isTakeover = takeoverMap[c.userId];
                  const activeOrder = customerOrdersMap[c.userId];
                  const platform = c.platform || bot?.platform || 'whatsapp';

                  return (
                    <div
                      key={c.userId}
                      className={`chat-contact ${isActive ? 'active' : ''}`}
                      onClick={() => setSelectedUserId(c.userId)}
                    >
                      <div style={{
                        width: '36px', height: '36px', borderRadius: '50%',
                        background: '#18243b', color: 'var(--color-primary)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0, border: '1px solid var(--border-default)',
                        position: 'relative'
                      }}>
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                        {isTakeover && (
                          <span style={{ position: 'absolute', bottom: '-2px', right: '-2px', width: '9px', height: '9px', borderRadius: '50%', background: '#f59e0b', border: '2px solid #141c2c' }} title="وضع يدوي" />
                        )}
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                          <span style={{ fontWeight: 700, fontSize: '0.88rem', color: '#ffffff' }}>{c.userName}</span>
                          {activeOrder?.trackingCode && (
                            <span className="thread-order-tag">#{activeOrder.trackingCode}</span>
                          )}
                        </div>

                        <div className="thread-meta-row">
                          <span className={`thread-channel-tag thread-channel-tag--${platform}`}>
                            <PlatformMiniIcon platform={platform} />
                            <span>{platformLabel(platform)} · {formatTime(c.lastTime)}</span>
                          </span>
                        </div>

                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '2px' }}>
                          {lastMsg?.role === 'owner' ? 'أنت: ' : lastMsg?.role === 'bot' ? 'البوت: ' : ''}{lastMsg?.content?.slice(0, 45) || '...'}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Main Chat Thread (Left) */}
          <div className="chat-thread-container">
            {!selectedUserId ? (
              <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)', padding: '2rem' }}>
                <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ opacity: 0.35, marginBottom: '0.75rem' }}>
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
                <p style={{ fontSize: '0.9rem' }}>اختر محادثة من القائمة لعرض تفاصيلها والرد يدوياً</p>
              </div>
            ) : (
              <>
                {/* Chat Header */}
                <div className="chat-thread-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                      className="btn btn-secondary btn-sm mobile-chat-back"
                      onClick={() => setSelectedUserId(null)}
                      style={{ padding: '0.25rem 0.5rem', minHeight: '30px' }}
                    >
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                      القائمة
                    </button>
                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#18243b', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#ffffff' }}>{selectedThread?.userName}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>
                        {selectedThread?.messages?.length || 0} رسالة
                        {takeoverMap[selectedUserId] && <span style={{ color: '#f59e0b', marginRight: '6px' }}> (الوضع اليدوي مفعل)</span>}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      className={`btn btn-sm ${takeoverMap[selectedUserId] ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => toggleTakeover(selectedUserId)}
                    >
                      {takeoverMap[selectedUserId] ? 'إعادة البوت' : 'تولي الرد يدوياً'}
                    </button>
                  </div>
                </div>

                {/* Messages List */}
                <div className="chat-messages-area">
                  {selectedThread?.messages?.map((msg, i) => (
                    <div key={msg.id || i} className={`chat-msg ${msg.role === 'user' ? 'chat-msg--user' : 'chat-msg--bot'}`}>
                      <div className="chat-bubble">
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', marginBottom: '3px', fontWeight: 600 }}>
                          {msg.role === 'user' ? (msg.userName || 'الزبون') : msg.role === 'owner' ? 'أنت' : bot.botName}
                        </div>
                        <div>{msg.content}</div>
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)', marginTop: '4px', textAlign: 'left' }}>
                          {formatTime(msg.createdAt)}
                        </div>
                      </div>
                    </div>
                  ))}
                  <div ref={chatEndRef} />
                </div>

                {/* Reply Input Bar */}
                <div className="chat-input-area">
                  <input
                    type="text"
                    className="form-input"
                    placeholder="اكتب ردك هنا..."
                    value={replyText}
                    onChange={e => setReplyText(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleReply()}
                    disabled={sending}
                    style={{ flex: 1 }}
                  />
                  <button className="btn btn-primary" onClick={handleReply} disabled={sending || !replyText.trim()}>
                    {sending ? <span className="spinner" /> : 'إرسال'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ─── Tab 2: Orders Tab ─── */}
      {activeTab === 'orders' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '8px' }}>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#ffffff', margin: 0 }}>
                الطلبيات والتتبع ({orders.length})
              </h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>
                إدارة حالات الشحن وتتبع الطرود وإرسال الإشعارات التلقائية للزبائن.
              </p>
            </div>
            {orders.length > 0 && (
              <button
                className="btn btn-danger btn-sm"
                onClick={() => setShowClearOrdersModal(true)}
              >
                مسح كل السجلات
              </button>
            )}
          </div>

          {orders.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-tertiary)' }}>
              <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: 'rgba(56, 189, 248, 0.08)', border: '1px solid rgba(56, 189, 248, 0.2)', color: '#38bdf8', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.85rem' }}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="16.5" y1="9.4" x2="7.5" y2="4.21" />
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                  <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                  <line x1="12" y1="22.08" x2="12" y2="12" />
                </svg>
              </div>
              <p style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>لا توجد طلبيات أو طرود مسجلة بعد</p>
              <p style={{ fontSize: '0.85rem' }}>يقوم البوت بتسجيل الطلبيات وتوليد كود التتبع (#DZ-XXXXXX) تلقائياً بمجرد تأكيد المشتري في المحادثة.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {orders.map(order => (
                <OrderDeliveryItem
                  key={order.id}
                  order={order}
                  bot={bot}
                  onUpdateDelivery={(orderId, payload) => updateOrderDelivery(bot.id, orderId, bot.platform || 'whatsapp', payload)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── Tab 3: Product Catalog Tab ─── */}
      {activeTab === 'catalog' && (
        <ProductCatalogManager
          bot={bot}
          onUpdateBot={async (data) => {
            await updateBot(id, data);
          }}
        />
      )}

      {/* ─── Tab 4: Channels Matrix Hub ─── */}
      {activeTab === 'channels' && (
        <ChannelsManager
          bot={bot}
          onUpdateBot={async (data) => {
            await updateBot(id, data);
          }}
        />
      )}

      {/* ─── Tab 5: Bot Info & Capabilities Tab ─── */}
      {activeTab === 'info' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Card 1: Modular Capabilities */}
          <BotCapabilitiesManager
            bot={bot}
            onUpdateBot={async (data) => {
              await updateBot(id, data);
            }}
          />

          {/* Card 2: Business Details */}
          <div className="card">
            <div className="card-header-row">
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#ffffff', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
                معلومات المشروع والنشاط
              </h3>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.65rem', marginBottom: '0.65rem' }}>
              <InfoRow label="اسم المشروع" value={bot.businessName} />
              <InfoRow label="اسم البوت" value={bot.botName} />
              <InfoRow label="نوع النشاط" value={currentActivityName} />
              <InfoRow label="الدولة والعملة" value={`${bot.countryName || 'الجزائر'} (${bot.currency || 'دج'})`} />
              <InfoRow label="إشعار وصول الطلبية والاستلام" value={bot.autoDeliveryReceipt !== false ? 'مفعل (إرسال إيصال تلقائي)' : 'معطل'} />
              {bot.workingHours && <InfoRow label="ساعات العمل" value={bot.workingHours} />}
              {bot.location && <InfoRow label="الموقع" value={bot.location} />}
              {bot.contact && <InfoRow label="التواصل" value={bot.contact} />}
            </div>

            {bot.description && (
              <div className="info-item">
                <span className="info-item-label">الوصف والنبذة</span>
                <p className="info-item-value">{bot.description}</p>
              </div>
            )}
            {bot.services && (
              <div className="info-item">
                <span className="info-item-label">الخدمات / المنتجات والأسعار</span>
                <p className="info-item-value">{bot.services}</p>
              </div>
            )}
          </div>

          {/* Card 3: AI Personality */}
          <div className="card">
            <div className="card-header-row">
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#ffffff', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2"><circle cx="12" cy="12" r="10"/><circle cx="9" cy="9" r="1"/><circle cx="15" cy="9" r="1"/><path d="M8 13a4 4 0 0 0 8 0"/></svg>
                شخصية ونظام الذكاء الاصطناعي
              </h3>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.65rem', marginBottom: '0.65rem' }}>
              <InfoRow label="أسلوب الرد" value={responseStyleLabels[bot.responseStyle]} />
              <InfoRow label="اللغة واللهجة" value={languageLabels[bot.language]} />
              <InfoRow label="إجمالي الرسائل" value={`${bot.messagesCount || 0} رسالة`} />
            </div>

            {bot.customInstructions && (
              <div className="info-item">
                <span className="info-item-label">تعليمات مخصصة</span>
                <p className="info-item-value">{bot.customInstructions}</p>
              </div>
            )}
          </div>

          {/* WhatsApp Connection box if whatsapp platform */}
          {isWhatsapp && (
            <WhatsAppConnect botId={bot.id} />
          )}
        </div>
      )}

      {/* ─── Edit Modal ─── */}
      {showEditModal && (
        <div className="modal-overlay" onClick={() => !savingEdit && setShowEditModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '640px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 className="modal-title">تعديل بيانات وإعدادات البوت</h3>

            <form onSubmit={handleSaveEdit}>
              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label">اسم البوت</label>
                  <input className="form-input" value={editData.botName} onChange={e => setEditData(p => ({ ...p, botName: e.target.value }))} required />
                </div>
                <div className="form-group">
                  <label className="form-label">اسم المشروع / الجهة</label>
                  <input className="form-input" value={editData.businessName} onChange={e => setEditData(p => ({ ...p, businessName: e.target.value }))} required />
                </div>
              </div>

              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label">الدولة والعملة</label>
                  <select 
                    className="form-select" 
                    value={editData.country} 
                    onChange={e => {
                      const cObj = COUNTRIES.find(c => c.code === e.target.value);
                      setEditData(p => ({ ...p, country: e.target.value, currency: cObj?.currency || 'دج' }));
                    }}
                  >
                    {COUNTRIES.map(c => (
                      <option key={c.code} value={c.code}>
                        {c.name} ({c.currency})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">نوع ومجال النشاط</label>
                  <select className="form-select" value={editData.businessType} onChange={e => setEditData(p => ({ ...p, businessType: e.target.value }))}>
                    {BUSINESS_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
              </div>

              {editData.businessType === 'custom' && (
                <div className="form-group">
                  <label className="form-label">تحديد نوع النشاط المخصص</label>
                  <input className="form-input" value={editData.customType} onChange={e => setEditData(p => ({ ...p, customType: e.target.value }))} />
                </div>
              )}

              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label">أسلوب الرد</label>
                  <select className="form-select" value={editData.responseStyle} onChange={e => setEditData(p => ({ ...p, responseStyle: e.target.value }))}>
                    <option value="formal">رسمي</option>
                    <option value="friendly">ودود</option>
                    <option value="concise">مختصر</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">اللغة واللهجة</label>
                  <select className="form-select" value={editData.language} onChange={e => setEditData(p => ({ ...p, language: e.target.value }))}>
                    <option value="arabic_algerian">دارجة جزائرية</option>
                    <option value="arabic_formal">عربي فصيح</option>
                    <option value="auto">تلقائي</option>
                  </select>
                </div>
              </div>

              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label">ساعات العمل / التوفر</label>
                  <input className="form-input" value={editData.workingHours} onChange={e => setEditData(p => ({ ...p, workingHours: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">الموقع أو المدينة</label>
                  <input className="form-input" value={editData.location} onChange={e => setEditData(p => ({ ...p, location: e.target.value }))} />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">بيانات التواصل</label>
                <input className="form-input" value={editData.contact} onChange={e => setEditData(p => ({ ...p, contact: e.target.value }))} />
              </div>

              {bot.telegramToken && (
                <div className="form-group">
                  <label className="form-label">توكن تيليغرام</label>
                  <input className="form-input" value={editData.telegramToken} onChange={e => setEditData(p => ({ ...p, telegramToken: e.target.value }))} style={{ direction: 'ltr', textAlign: 'left' }} />
                </div>
              )}

              <div className="form-group">
                <label className="form-label">نبذة ووصف النشاط</label>
                <textarea className="form-textarea" rows="2" value={editData.description} onChange={e => setEditData(p => ({ ...p, description: e.target.value }))} />
              </div>

              <div className="form-group">
                <label className="form-label">الخدمات / المنتجات والأسعار</label>
                <textarea className="form-textarea" rows="3" value={editData.services} onChange={e => setEditData(p => ({ ...p, services: e.target.value }))} />
              </div>

              <div className="form-group">
                <label className="form-label">تعليمات خاصة إضافية</label>
                <textarea className="form-textarea" rows="2" value={editData.customInstructions} onChange={e => setEditData(p => ({ ...p, customInstructions: e.target.value }))} />
              </div>

              {/* Delivery Receipt Notification Setting */}
              <div style={{
                background: 'rgba(52, 211, 153, 0.05)',
                border: '1px solid rgba(52, 211, 153, 0.25)',
                borderRadius: 'var(--radius-md)',
                padding: '1rem',
                marginBottom: '1.25rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: editData.autoDeliveryReceipt ? '0.75rem' : '0' }}>
                  <div>
                    <label style={{ fontWeight: 700, fontSize: '0.9rem', color: '#ffffff', display: 'block', marginBottom: '2px' }}>
                      إشعار وصول الطلبية والاستلام
                    </label>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                      عند الضغط على "وصلت الطلبية"، يتم إرسال إشعار فوري للزبون بأن طلبيته وصلت وجاهزة للاستلام مع العنوان والمبلغ المطلوب.
                    </span>
                  </div>
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={editData.autoDeliveryReceipt}
                      onChange={e => setEditData(p => ({ ...p, autoDeliveryReceipt: e.target.checked }))}
                    />
                    <span className="toggle-slider"></span>
                  </label>
                </div>

                {editData.autoDeliveryReceipt && (
                  <div className="form-group" style={{ marginBottom: 0, marginTop: '0.5rem' }}>
                    <label className="form-label" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      نص الرسالة المخصص (اختياري - يمكنك استخدام: {'{name}'}، {'{product}'}، {'{price}'}، {'{store}'})
                    </label>
                    <textarea
                      className="form-textarea"
                      rows="3"
                      placeholder="اتركه فارغاً لاستخدام نص الإيصال الافتراضي الأنيق..."
                      value={editData.deliveryReceiptMessage || ''}
                      onChange={e => setEditData(p => ({ ...p, deliveryReceiptMessage: e.target.value }))}
                    />
                  </div>
                )}
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowEditModal(false)} disabled={savingEdit}>إلغاء</button>
                <button type="submit" className="btn btn-primary" disabled={savingEdit}>
                  {savingEdit ? <span className="spinner" /> : 'حفظ التعديلات'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Clear Messages Modal ─── */}
      {showClearMessagesModal && (
        <div className="modal-overlay" onClick={() => !clearing && setShowClearMessagesModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3 className="modal-title">مسح جميع المحادثات</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.6 }}>
              هل أنت متأكد من رغبتك في مسح كافة المحادثات والرسائل المسجلة لهذا البوت؟
            </p>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowClearMessagesModal(false)} disabled={clearing}>تراجع</button>
              <button className="btn btn-danger" onClick={clearMessages} disabled={clearing}>
                {clearing ? <span className="spinner" /> : 'مسح كل الرسائل'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Clear Orders Modal ─── */}
      {showClearOrdersModal && (
        <div className="modal-overlay" onClick={() => !clearing && setShowClearOrdersModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3 className="modal-title">مسح جميع الطلبيات</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.6 }}>
              هل أنت متأكد من رغبتك في مسح كافة سجلات الطلبيات والحجوزات لهذا البوت؟
            </p>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowClearOrdersModal(false)} disabled={clearing}>تراجع</button>
              <button className="btn btn-danger" onClick={clearOrders} disabled={clearing}>
                {clearing ? <span className="spinner" /> : 'مسح كل السجلات'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Delete Bot Modal ─── */}
      {showDeleteModal && (
        <div className="modal-overlay" onClick={() => setShowDeleteModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3 className="modal-title">حذف البوت نهائياً</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.6 }}>
              هل أنت متأكد من حذف البوت <strong>"{bot.botName || bot.businessName}"</strong>؟ لا يمكن التراجع عن هذا الإجراء.
            </p>
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

// Sub-components
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

function DeliveryStatusIcon({ status, size = 13 }) {
  switch (status) {
    case 'pending':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      );
    case 'preparing':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="16.5" y1="9.4" x2="7.5" y2="4.21" />
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
          <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
          <line x1="12" y1="22.08" x2="12" y2="12" />
        </svg>
      );
    case 'shipped':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="1" y="3" width="15" height="13" />
          <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
          <circle cx="5.5" cy="18.5" r="2.5" />
          <circle cx="18.5" cy="18.5" r="2.5" />
        </svg>
      );
    case 'out_for_delivery':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="3 11 22 2 13 21 11 13 3 11" />
        </svg>
      );
    case 'delivered':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
      );
    case 'returned':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="1 4 1 10 7 10" />
          <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
        </svg>
      );
    case 'cancelled':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="15" y1="9" x2="9" y2="15" />
          <line x1="9" y1="9" x2="15" y2="15" />
        </svg>
      );
    default:
      return null;
  }
}

const DELIVERY_STATUSES = {
  pending: { label: 'قيد المراجعة والتأكيد', color: '#f59e0b', bg: '#33230a', border: '#543b12' },
  preparing: { label: 'قيد التجهيز والتغليف', color: '#38bdf8', bg: '#132b3d', border: '#1d4461' },
  shipped: { label: 'تم تسليم الطرد لشركة الشحن', color: '#818cf8', bg: '#1e1b4b', border: '#312e81' },
  out_for_delivery: { label: 'خرج للتوصيل (مع الموزع)', color: '#c084fc', bg: '#3b0764', border: '#581c87' },
  delivered: { label: 'تم التسليم بنجاح', color: '#34d399', bg: '#132d24', border: '#1c4b3c' },
  returned: { label: 'تم إرجاع الطرد', color: '#f87171', bg: '#33161a', border: '#541c22' },
  cancelled: { label: 'ملغى', color: '#94a3b8', bg: '#1c263c', border: '#26334d' },
};

const DELIVERY_PROVIDERS = [
  { key: 'manual', label: 'توصيل خاص بالمتجر' },
  { key: 'yalidine', label: 'Yalidine Express' },
  { key: 'zr_express', label: 'ZR Express' },
  { key: 'maystro', label: 'Maystro Delivery' },
  { key: 'kazitour', label: 'Kazi Tour' },
  { key: 'ecotrack', label: 'EcoTrack Delivery' },
  { key: 'other', label: 'شركة أخرى' },
];

function DeliveryStatusBadge({ status }) {
  const c = DELIVERY_STATUSES[status] || DELIVERY_STATUSES.pending;
  return (
    <span style={{ fontSize: '0.74rem', fontWeight: 700, background: c.bg, color: c.color, border: `1px solid ${c.border}`, padding: '2px 8px', borderRadius: 'var(--radius-full)', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
      <DeliveryStatusIcon status={status} size={13} />
      <span>{c.label}</span>
    </span>
  );
}

function OrderDeliveryItem({ order, bot, onUpdateDelivery }) {
  const [deliveryStatus, setDeliveryStatus] = useState(order.deliveryStatus || 'pending');
  const [provider, setProvider] = useState(order.deliveryProvider || 'manual');
  const [trackingNumber, setTrackingNumber] = useState(order.deliveryTrackingNumber || '');
  const [notifyCustomer, setNotifyCustomer] = useState(true);
  const [showTimeline, setShowTimeline] = useState(false);
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const handleSave = async () => {
    setSaving(true);
    try {
      await onUpdateDelivery(order.id, {
        deliveryStatus,
        provider,
        trackingNumber,
        notifyCustomer,
      });
      toast.success(notifyCustomer ? 'تم تحديث حالة الشحن وإرسال إشعار للزبون بنجاح' : 'تم حفظ حالة الشحن');
    } catch (e) {
      toast.error('فشل تحديث حالة الشحن: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const copyCode = (e) => {
    e.stopPropagation();
    if (order.trackingCode) {
      navigator.clipboard.writeText(order.trackingCode);
      toast.success(`تم نسخ كود التتبع #${order.trackingCode}`);
    }
  };

  return (
    <div className="order-card" style={{ padding: '1.25rem' }}>
      <div className="order-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '0.85rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 700, color: '#ffffff', fontSize: '0.98rem' }}>{order.customerName || 'زبون'}</span>
          {order.trackingCode && (
            <button className="tracking-code-pill" onClick={copyCode} title="انقر لنسخ كود التتبع">
              <span>#{order.trackingCode}</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            </button>
          )}
          <DeliveryStatusBadge status={order.deliveryStatus || 'pending'} />
        </div>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>{formatTime(order.createdAt)}</span>
      </div>

      <div className="order-card-body" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.65rem', marginBottom: '0.85rem' }}>
        {order.product && (
          <div className="order-field" style={{ color: '#ffffff', fontWeight: 600 }}>
            <span>المنتج: {order.product} {order.price ? `(${order.price} ${bot.currency || 'دج'})` : ''}</span>
          </div>
        )}
        {order.phone && (
          <div className="order-field">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
            <span dir="ltr">{order.phone}</span>
          </div>
        )}
        {order.address && (
          <div className="order-field" style={{ gridColumn: '1 / -1' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
            <span>{order.address}</span>
          </div>
        )}
        {order.orderSummary && (
          <div style={{ gridColumn: '1 / -1', fontSize: '0.8rem', color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.02)', padding: '0.4rem 0.6rem', borderRadius: 'var(--radius-sm)' }}>
            {order.orderSummary}
          </div>
        )}
      </div>

      {/* Delivery Management Controls */}
      <div className="delivery-control-box">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', fontWeight: 700, color: 'var(--color-primary)' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
            <span>إدارة حالة الشحن والتوصيل</span>
          </div>
          {Array.isArray(order.statusHistory) && order.statusHistory.length > 0 && (
            <button 
              type="button" 
              className="btn btn-secondary btn-sm" 
              style={{ fontSize: '0.72rem', padding: '2px 8px', display: 'flex', alignItems: 'center', gap: '4px' }}
              onClick={() => setShowTimeline(!showTimeline)}
            >
              <span>سجل المراحل ({order.statusHistory.length})</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: showTimeline ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease' }}><polyline points="6 9 12 15 18 9"/></svg>
            </button>
          )}
        </div>

        <div className="delivery-grid-fields">
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: '2px' }}>حالة الشحن</label>
            <select 
              className="form-select" 
              style={{ padding: '0.4rem 0.6rem', fontSize: '0.82rem' }}
              value={deliveryStatus}
              onChange={e => setDeliveryStatus(e.target.value)}
            >
              {Object.entries(DELIVERY_STATUSES).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: '2px' }}>شركة التوصيل</label>
            <select 
              className="form-select" 
              style={{ padding: '0.4rem 0.6rem', fontSize: '0.82rem' }}
              value={provider}
              onChange={e => setProvider(e.target.value)}
            >
              {DELIVERY_PROVIDERS.map(p => (
                <option key={p.key} value={p.key}>{p.label}</option>
              ))}
            </select>
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: '2px' }}>رقم بوليصة الشحن (Tracking No)</label>
            <input 
              className="form-input" 
              style={{ padding: '0.4rem 0.6rem', fontSize: '0.82rem' }}
              placeholder="مثال: YAL-98765432"
              value={trackingNumber}
              onChange={e => setTrackingNumber(e.target.value)}
            />
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', paddingTop: '4px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
            <input 
              type="checkbox" 
              checked={notifyCustomer} 
              onChange={e => setNotifyCustomer(e.target.checked)} 
              disabled={!order.customerId}
            />
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
              <span>إرسال إشعار فوري وتلقائي للزبون عبر {bot.platform === 'telegram' ? 'تيليغرام' : 'واتساب'}</span>
            </span>
          </label>

          <button 
            className="btn btn-primary btn-sm" 
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? <span className="spinner" /> : 'حفظ التحديث'}
          </button>
        </div>

        {/* Timeline View */}
        {showTimeline && Array.isArray(order.statusHistory) && (
          <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-subtle)' }}>
            <div className="timeline-container">
              {order.statusHistory.map((step, idx) => {
                const sConf = DELIVERY_STATUSES[step.deliveryStatus] || DELIVERY_STATUSES.pending;
                return (
                  <div key={idx} className="timeline-step">
                    <div style={{ fontWeight: 600, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <DeliveryStatusIcon status={step.deliveryStatus} size={14} />
                      <span>{sConf.label} {step.provider && step.provider !== 'manual' ? `(${step.provider})` : ''}</span>
                    </div>
                    {step.trackingNumber && (
                      <div style={{ fontSize: '0.74rem', color: '#38bdf8', marginTop: '2px' }}>بوليصة: {step.trackingNumber}</div>
                    )}
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', marginTop: '2px' }}>{new Date(step.timestamp).toLocaleString('ar')}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function BotCapabilitiesManager({ bot, onUpdateBot }) {
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  const features = sanitizeBotFeatures(bot?.features || {});

  const toggleFeature = async (key) => {
    setSaving(true);
    try {
      const updated = sanitizeBotFeatures({
        ...features,
        [key]: !features[key],
      });
      await onUpdateBot({ features: updated });
      toast.success('تم تحديث قدرات البوت بنجاح');
    } catch (e) {
      toast.error('فشل تحديث القدرات: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const capabilities = [
    {
      key: 'catalog',
      title: 'كتالوج المنتجات والخدمات',
      desc: 'إرسال صور ومواصفات السلع والتفاصيل للزبون مباشرة داخل المحادثة.',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/>
        </svg>
      )
    },
    {
      key: 'orders',
      title: 'استقبال وتسجيل الطلبيات',
      desc: 'استخراج وتأكيد بيانات المشتري (الاسم، الهاتف، العنوان) تلقائياً.',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/><line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="13" y2="16"/>
        </svg>
      )
    },
    {
      key: 'orderTracking',
      title: 'نظام التتبع المباشر (#DZ-XXXXXX)',
      desc: 'تمكين الزبائن من معرفة حالة طرودهم فوراً وبدون استهلاك للذكاء الاصطناعي (0 LLM Calls).',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
        </svg>
      ),
      req: 'orders'
    },
    {
      key: 'delivery',
      title: 'إدارة شركات الشحن والتوصيل',
      desc: 'التكامل مع شركات التوصيل (Yalidine, ZR Express...) وإرفاق أرقام البوالص.',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
        </svg>
      ),
      req: 'orders'
    },
    {
      key: 'notifications',
      title: 'إشعارات الشحن التلقائية',
      desc: 'إرسال إشعار فوري للزبون فور تغيير حالة الطرد في لوحة التحكم.',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
      ),
      req: 'orderTracking'
    },
    {
      key: 'bookings',
      title: 'حجز المواعيد والاستشارات',
      desc: 'تخصيص البوت لجدولة المواعيد للعيادات والمراكز والمكاتب المهنية.',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
      )
    },
  ];

  return (
    <div className="card">
      <div className="card-header-row" style={{ marginBottom: '0.65rem' }}>
        <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#ffffff', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
          قدرات وموديولات البوت (Modular Commerce)
        </h3>
      </div>
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.15rem', lineHeight: 1.5 }}>
        قم بتفعيل الموديولات التي يحتاجها نشاطك التجاري. يتم ضبط الترابط البرمجي بين القدرات تلقائياً.
      </p>

      <div className="capabilities-grid">
        {capabilities.map(cap => {
          const isActive = !!features[cap.key];
          const isReqMissing = cap.req && !features[cap.req];

          return (
            <div 
              key={cap.key} 
              className={`capability-card ${isActive ? 'is-active' : ''} ${isReqMissing ? 'is-disabled' : ''}`}
            >
              <div className="capability-info">
                <div className="capability-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ color: isActive ? 'var(--color-primary)' : 'var(--text-tertiary)' }}>{cap.icon}</span>
                  <span>{cap.title}</span>
                </div>
                <p className="capability-desc">{cap.desc}</p>
                {isReqMissing && (
                  <div style={{ fontSize: '0.72rem', color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                    <span>يتطلب تفعيل موديول "{cap.req === 'orders' ? 'استقبال الطلبيات' : 'نظام التتبع'}" أولاً</span>
                  </div>
                )}
              </div>

              <button
                type="button"
                className={`btn btn-sm ${isActive ? 'btn-primary' : 'btn-secondary'}`}
                style={{ minWidth: '80px', padding: '4px 10px', fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                disabled={saving || isReqMissing}
                onClick={() => toggleFeature(cap.key)}
              >
                {isActive ? (
                  <>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                    <span>مفعل</span>
                  </>
                ) : (
                  <>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'currentColor' }} />
                    <span>معطل</span>
                  </>
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function OrderStatusBadge({ status }) {
  const config = {
    new: { label: 'جديد', bg: '#33161a', color: '#ef4444', border: '#541c22' },
    confirmed: { label: 'مؤكد', bg: '#132b3d', color: '#38bdf8', border: '#1d4461' },
    delivered: { label: 'مكتمل', bg: '#132d24', color: '#34d399', border: '#1c4b3c' },
    cancelled: { label: 'ملغي', bg: '#1c263c', color: '#94a3b8', border: '#26334d' },
  };
  const c = config[status] || config.new;
  return (
    <span style={{ fontSize: '0.72rem', fontWeight: 700, background: c.bg, color: c.color, border: `1px solid ${c.border}`, padding: '2px 8px', borderRadius: 'var(--radius-full)' }}>
      {c.label}
    </span>
  );
}

function InfoRow({ label, value }) {
  if (!value) return null;
  return (
    <div className="info-item">
      <span className="info-item-label">{label}</span>
      <span className="info-item-value">{value}</span>
    </div>
  );
}

// WhatsApp Connect
function WhatsAppConnect({ botId }) {
  const [waStatus, setWaStatus] = useState('not_initialized');
  const [qrDataUrl, setQrDataUrl] = useState(null);
  const [connecting, setConnecting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (waStatus !== 'waiting_scan' && waStatus !== 'initializing') return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${WHATSAPP_ENGINE_URL}/api/whatsapp/${botId}/qr`, { headers: await engineHeaders(false) });
        if (res.ok) {
          const data = await res.json();
          if (data.status) setWaStatus(data.status);
          if (data.qrDataUrl) {
            setQrDataUrl(data.qrDataUrl);
            setWaStatus('waiting_scan');
          }
          if (data.status === 'connected') {
            setQrDataUrl(null);
            clearInterval(interval);
          }
        }
      } catch (err) {
        console.warn('QR poll error:', err.message);
      }
    }, 2500);
    return () => clearInterval(interval);
  }, [waStatus, botId]);

  const handleConnect = async () => {
    setConnecting(true);
    setErrorMsg('');
    setWaStatus('initializing');
    try {
      const res = await fetch(`${WHATSAPP_ENGINE_URL}/api/whatsapp/create`, {
        method: 'POST',
        headers: await engineHeaders(),
        body: JSON.stringify({ botId }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setErrorMsg(data.error || 'تعذر تشغيل محرك واتساب');
        setWaStatus('error');
      } else {
        setWaStatus(data.status || 'initializing');
      }
    } catch (err) {
      setErrorMsg(`تعذر الاتصال بالسيرفر (${err.message})`);
      setWaStatus('error');
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await fetch(`${WHATSAPP_ENGINE_URL}/api/whatsapp/${botId}/stop`, { method: 'POST', headers: await engineHeaders(false) });
      setWaStatus('disconnected');
      setQrDataUrl(null);
    } catch {}
  };

  return (
    <div className="card" style={{ textAlign: 'center', padding: '1.5rem' }}>
      <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#ffffff', marginBottom: '0.75rem' }}>ربط واتساب</h3>
      <div style={{ marginBottom: '1.25rem' }}>
        <span className={`status-pill ${waStatus === 'connected' ? 'status--online' : 'status--waiting'}`}>
          <span className="status-pill-dot" />
          {waStatus === 'connected' ? 'واتساب متصل' : waStatus === 'waiting_scan' ? 'في انتظار مسح الكود' : 'غير متصل'}
        </span>
      </div>

      {(waStatus === 'not_initialized' || waStatus === 'disconnected' || waStatus === 'error') && (
        <div>
          <button className="btn btn-primary" onClick={handleConnect} disabled={connecting} style={{ background: '#16a34a', borderColor: '#16a34a' }}>
            {connecting ? <span className="spinner" /> : 'ربط واتساب عبر QR Code'}
          </button>
          {errorMsg && <p style={{ color: 'var(--color-error)', fontSize: '0.82rem', marginTop: '0.5rem' }}>{errorMsg}</p>}
        </div>
      )}

      {waStatus === 'waiting_scan' && qrDataUrl && (
        <div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '0.75rem' }}>
            امسح هذا الرمز بتطبيق واتساب (الأجهزة المرتبطة ➔ ربط جهاز)
          </p>
          <div style={{ background: '#ffffff', borderRadius: 'var(--radius-md)', display: 'inline-block', padding: '0.75rem' }}>
            <img src={qrDataUrl} alt="QR Code" style={{ width: '220px', height: '220px', display: 'block' }} />
          </div>
        </div>
      )}

      {waStatus === 'initializing' && <div className="spinner spinner-lg" style={{ margin: '0 auto' }} />}

      {waStatus === 'connected' && (
        <div>
          <p style={{ color: 'var(--color-primary)', fontWeight: 600, marginBottom: '0.75rem', fontSize: '0.9rem' }}>واتساب متصل بنجاح</p>
          <button className="btn btn-secondary btn-sm" onClick={handleDisconnect}>فصل الاتصال</button>
        </div>
      )}
    </div>
  );
}
