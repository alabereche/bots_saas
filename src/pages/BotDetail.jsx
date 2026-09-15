import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  subscribeBot,
  updateBot,
  deleteBot,
  subscribeConversations,
  clearBotMessages,
  subscribeOrders,
  subscribeLeads,
  updateLeadStatus,
  deleteLead,
  updateOrderStatus as fbUpdateOrderStatus,
  updateOrderDelivery,
  sanitizeBotFeatures,
  clearBotOrders,
} from '../services/firebase';
import { useToast } from '../context/ToastContext';
import { COUNTRIES } from '../data/countries';
import { BUSINESS_TYPES } from './CreateBot';
import { STATUS_ORDER, normalizeDeliveryStatus, voiceFor } from '../lib/deliveryStatus';
import { auth } from '../services/firebase';
import AnalyticsTab from '../components/AnalyticsTab';
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
  // Legacy bots predate the platform field — they are WhatsApp-era. Default
  // ANYTHING not explicitly telegram to the WhatsApp engine (matches the
  // `|| 'whatsapp'` convention used across the codebase). The old
  // `=== 'whatsapp' ? WA : TG` default sent undefined-platform bots'
  // takeover toggles to the TELEGRAM engine — the "bot never comes back"
  // bug: the OFF executed on the wrong engine, invisible in WA logs.
  return platform === 'telegram' ? TELEGRAM_ENGINE_URL : WHATSAPP_ENGINE_URL;
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
  const [leads, setLeads] = useState([]);
  const [activeTab, setActiveTab] = useState('chat'); // 'chat' | 'orders' | 'leads' | 'sheets' | 'catalog' | 'widget' | 'channels' | 'info'
  const [selectedUserId, setSelectedUserId] = useState(null);
  // Tabs strip scroll arrows: reveal hidden tabs on narrow screens
  const tabsRef = useRef(null);
  const [tabsNav, setTabsNav] = useState({ left: false, right: false });
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [takeoverMap, setTakeoverMap] = useState({});
  const chatEndRef = useRef(null);
  const replyInputRef = useRef(null);
  // Fires the 'bot missing' notice exactly once per bot id
  const missingBotHandledRef = useRef(false);

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

  // Orders v2 toolbar: lifecycle filter + search
  const [orderFilter, setOrderFilter] = useState('all');
  const [orderSearch, setOrderSearch] = useState('');

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
    missingBotHandledRef.current = false;
    setLoading(true);

    const unsubBot = subscribeBot(id, (botData) => {
      if (!botData) {
        // A deleted bot fires this on every (re)subscription — show the
        // notice exactly once, never in a loop
        if (!missingBotHandledRef.current) {
          missingBotHandledRef.current = true;
          toast.error('تعذر العثور على البوت أو تم حذفه');
          navigate('/dashboard');
        }
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

    const unsubLeads = subscribeLeads(id, (lds) => {
      setLeads(lds || []);
    });

    return () => {
      unsubBot();
      unsubMsgs();
      unsubOrders();
      unsubLeads();
    };
  }, [id, navigate, toast]);

  // Scroll to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [allMessages, selectedUserId]);

  // Load current manual-mode (takeover) state from the WhatsApp engine,
  // so the UI matches reality after a page reload — and KEEP it fresh on
  // a 30s poll: a stale map makes «إعادة تشغيل البوت» flip the wrong
  // direction and silently re-mute the AI
  useEffect(() => {
    if (!id || !bot || bot.platform !== 'whatsapp') return;
    let cancelled = false;
    const load = () => {
      engineHeaders(false)
        .then(headers => fetch(`${WHATSAPP_ENGINE_URL}/api/takeover/${id}`, { headers }))
        .then(res => (res.ok ? res.json() : null))
        .then(data => {
          if (!cancelled && data?.takeovers) setTakeoverMap(data.takeovers);
        })
        .catch(() => {});
    };
    load();
    const interval = setInterval(load, 30000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [id, bot?.platform]);

  // Group messages by customer and link to orders & channels
  const customerOrdersMap = {};
  (orders || []).forEach(o => {
    if (o.customerId) customerOrdersMap[String(o.customerId)] = o;
    if (o.phone) customerOrdersMap[String(o.phone)] = o;
  });

  // Orders v2: filtered/searchable list
  const visibleOrders = useMemo(() => {
    const q = orderSearch.toLowerCase().trim();
    return orders.filter(o => {
      if (orderFilter !== 'all' && normalizeDeliveryStatus(o.deliveryStatus) !== orderFilter) return false;
      if (!q) return true;
      return [o.customerName, o.phone, o.trackingCode, o.product, o.address]
        .some(v => String(v || '').toLowerCase().includes(q));
    });
  }, [orders, orderFilter, orderSearch]);

  const customerThreads = {};
  (allMessages || []).forEach(m => {
    if (!m) return;
    const uid = m.telegramUserId || m.customerId || m.userId || 'default';
    if (!customerThreads[uid]) {
      customerThreads[uid] = { 
        userId: uid, 
        userName: m.userName || 'مستخدم', 
        userAvatar: m.userAvatar || null,
        platform: m.platform || bot?.platform || 'whatsapp',
        messages: [], 
        lastTime: m.createdAt || new Date().toISOString()
      };
    }
    customerThreads[uid].messages.push(m);
    if (m.platform) customerThreads[uid].platform = m.platform;
    if (m.userAvatar) customerThreads[uid].userAvatar = m.userAvatar;
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
      // The realtime subscription will see the doc vanish and want to shout
      // "bot missing" — but this deletion is intentional, silence it
      missingBotHandledRef.current = true;
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

  // Tabs strip navigation arrows (RTL-aware): reveal hidden tabs at both ends
  const updateTabsNav = () => {
    const el = tabsRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    if (max <= 4) {
      setTabsNav(prev => (prev.left || prev.right ? { left: false, right: false } : prev));
      return;
    }
    const abs = Math.abs(el.scrollLeft);
    setTabsNav(prev => {
      const next = { left: abs < max - 2, right: abs > 2 };
      return (next.left === prev.left && next.right === prev.right) ? prev : next;
    });
  };

  const scrollTabs = (dir) => {
    tabsRef.current?.scrollBy({ left: dir * 260, behavior: 'smooth' });
  };

  useEffect(() => {
    updateTabsNav();
    window.addEventListener('resize', updateTabsNav);
    return () => window.removeEventListener('resize', updateTabsNav);
  }, []);

  const toggleTakeover = async (userId) => {
    // Same thread-aware engine as the manual reply — never trust bot.platform
    // alone (legacy bots have no field and must land on the WhatsApp engine)
    const targetEngine = engineUrlFor(selectedThread?.platform || bot?.platform || 'whatsapp');

    // TRUTH-SEEKING TOGGLE: the local map can be stale (another tab, a
    // manual reply from an old session) — asking the engine for the live
    // state before flipping makes the button always do what it says,
    // even when the label itself is out of date
    let current = !!takeoverMap[userId];
    try {
      const stateRes = await fetch(`${targetEngine}/api/takeover/${id}`, {
        headers: await engineHeaders(),
      });
      if (stateRes.ok) {
        const stateData = await stateRes.json().catch(() => ({}));
        current = !!stateData?.takeovers?.[userId];
      }
    } catch { /* fall back to local map */ }

    const newState = !current;
    try {
      const res = await fetch(`${targetEngine}/api/takeover`, {
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
            <h1 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.2rem' }}>
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

      {/* ─── Ultra-Sleek Glassmorphic Responsive Tabs Bar ─── */}
      <div className="tabs-wrap">
        <div className="tabs-container" ref={tabsRef} onScroll={updateTabsNav}>
        {[
          {
            key: 'chat',
            label: 'المحادثات',
            count: sortedCustomers.length,
            icon: (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
            ),
          },
          {
            key: 'orders',
            label: 'الطلبيات والتتبع',
            count: newOrdersCount,
            icon: (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
                <line x1="3" y1="6" x2="21" y2="6"/>
                <path d="M16 10a4 4 0 0 1-8 0"/>
              </svg>
            ),
          },
          {
            key: 'leads',
            label: 'العملاء المحتملين (CRM)',
            count: leads.length || null,
            icon: (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
            ),
          },
          {
            key: 'analytics',
            label: 'التحليلات',
            count: null,
            icon: (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="20" x2="18" y2="10"/>
                <line x1="12" y1="20" x2="12" y2="4"/>
                <line x1="6" y1="20" x2="6" y2="14"/>
              </svg>
            ),
          },
          {
            key: 'sheets',
            label: 'ربط Google Sheets',
            count: null,
            icon: (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2"/>
                <line x1="3" y1="9" x2="21" y2="9"/>
                <line x1="3" y1="15" x2="21" y2="15"/>
                <line x1="9" y1="3" x2="9" y2="21"/>
                <line x1="15" y1="3" x2="15" y2="21"/>
              </svg>
            ),
          },
          {
            key: 'catalog',
            label: 'الكتالوج والمنتجات',
            count: bot?.products?.length || null,
            icon: (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7"/>
                <rect x="14" y="3" width="7" height="7"/>
                <rect x="14" y="14" width="7" height="7"/>
                <rect x="3" y="14" width="7" height="7"/>
              </svg>
            ),
          },
          {
            key: 'widget',
            label: 'ودجت الموقع والتطبيقات',
            count: null,
            icon: (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
                <line x1="8" y1="21" x2="16" y2="21"/>
                <line x1="12" y1="17" x2="12" y2="21"/>
              </svg>
            ),
          },
          {
            key: 'channels',
            label: 'قنوات الربط',
            count: null,
            icon: (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
              </svg>
            ),
          },
          {
            key: 'info',
            label: 'الإعدادات والقدرات',
            count: null,
            icon: (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3"/>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
              </svg>
            ),
          },
        ].map(tab => (
          <button
            key={tab.key}
            className={`tab-btn ${activeTab === tab.key ? 'tab-btn--active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.icon}
            <span>{tab.label}</span>
            {tab.count > 0 && (
              <span className={`tab-count-badge ${tab.key === 'orders' ? 'badge--danger' : ''}`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
        </div>
        {tabsNav.left && (
          <>
            <div className="tabs-edge-fade tabs-edge-fade--left"><div className="tabs-edge-blur" /><div className="tabs-edge-veil" /></div>
            <button type="button" className="tabs-nav-btn tabs-nav-btn--left" onClick={() => scrollTabs(-1)} aria-label="تبويبات على اليسار">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
          </>
        )}
        {tabsNav.right && (
          <>
            <div className="tabs-edge-fade tabs-edge-fade--right"><div className="tabs-edge-blur" /><div className="tabs-edge-veil" /></div>
            <button type="button" className="tabs-nav-btn tabs-nav-btn--right" onClick={() => scrollTabs(1)} aria-label="تبويبات على اليمين">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          </>
        )}
      </div>

      {/* ─── Tab 1: Commerce-First Chat Layout ─── */}
      {activeTab === 'chat' && (
        <div className={`chat-layout ${selectedUserId ? 'has-selected-user' : ''}`}>
          {/* Customer Sidebar (Right) */}
          <div className="chat-sidebar">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.85rem 1rem', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-card)' }}>
              <h4 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
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
                {inboxSearch && (
                  <button
                    type="button"
                    className="inbox-search-clear"
                    onClick={() => setInboxSearch('')}
                    aria-label="مسح البحث"
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                )}
                <svg className="inbox-search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
              </div>

              <div className="inbox-filters-row">
                {[
                  { key: 'all', label: 'الكل', count: sortedCustomers.length },
                  { key: 'unread', label: 'غير مقروءة', count: sortedCustomers.filter(c => takeoverMap[c.userId] || c.messages[c.messages.length - 1]?.role === 'user').length },
                  { key: 'orders', label: 'طلبات', count: Object.keys(customerOrdersMap).length },
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
              <div className="inbox-empty">
                <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
                </svg>
                <p className="inbox-empty-title">لا توجد محادثات تطابق هذا الفلتر</p>
                <p className="inbox-empty-hint">جرّب «الكل» أو امسح خانة البحث.</p>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => { setInboxFilter('all'); setInboxSearch(''); }}
                >
                  عرض كل المحادثات
                </button>
              </div>
            ) : (
              <div style={{ overflowY: 'auto', flex: 1 }}>
                {filteredCustomers.map(c => {
                  const lastMsg = c.messages[c.messages.length - 1];
                  const isActive = c.userId === selectedUserId;
                  const isTakeover = takeoverMap[c.userId];
                  const isUnread = !isActive && (isTakeover || lastMsg?.role === 'user');
                  const activeOrder = customerOrdersMap[c.userId];
                  const platform = c.platform || bot?.platform || 'whatsapp';

                  return (
                    <div
                      key={c.userId}
                      className={`chat-contact ${isActive ? 'active' : ''} ${isUnread ? 'is-unread' : ''}`}
                      onClick={() => setSelectedUserId(c.userId)}
                    >
                      <div className="chat-avatar">
                        {c.userAvatar ? (
                          <img
                            src={c.userAvatar}
                            alt={c.userName}
                            className="chat-avatar-img"
                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                          />
                        ) : (
                          <span>{(c.userName || '؟').trim().charAt(0)}</span>
                        )}
                        <span className="chat-avatar-platform"><PlatformMiniIcon platform={platform} size={9} /></span>
                        {isTakeover && <span className="chat-avatar-manual" title="وضع الرد اليدوي مفعّل" />}
                      </div>

                      <div className="chat-contact-body">
                        <div className="chat-contact-top">
                          <span className="chat-contact-name">{c.userName}</span>
                          <span className="chat-contact-time">{formatTime(c.lastTime)}</span>
                        </div>

                        <div className="chat-contact-bottom">
                          <span className="chat-contact-preview">
                            {lastMsg?.role === 'owner' ? 'أنت: ' : lastMsg?.role === 'bot' ? 'البوت: ' : ''}{lastMsg?.content?.slice(0, 45) || '...'}
                          </span>
                          {activeOrder?.trackingCode && (
                            <span className="thread-order-tag">#{activeOrder.trackingCode}</span>
                          )}
                          {isUnread && <span className="chat-unread-dot" />}
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
                    <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--bg-cell)', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0, border: '1px solid var(--border-default)' }}>
                      {selectedThread?.userAvatar ? (
                        <img
                          src={selectedThread.userAvatar}
                          alt={selectedThread.userName}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          onError={(e) => { e.currentTarget.style.display = 'none'; }}
                        />
                      ) : (
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                      )}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>{selectedThread?.userName}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>
                        {selectedThread?.messages?.length || 0} رسالة
                        {takeoverMap[selectedUserId] && <span style={{ color: '#f59e0b', marginRight: '6px' }}> (الوضع اليدوي مفعل)</span>}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {takeoverMap[selectedUserId] ? (
                      <span className="chat-header-mode-badge manual">
                        <span className="manual-pulse-dot" />
                        <span>الوضع اليدوي مفعّل</span>
                      </span>
                    ) : (
                      <span className="chat-header-mode-badge bot">
                        <span className="bot-pulse-dot" />
                        <span>البوت يرد تلقائياً</span>
                      </span>
                    )}
                    <button
                      className={`btn btn-sm ${takeoverMap[selectedUserId] ? 'btn-secondary' : 'btn-primary'}`}
                      onClick={() => {
                        toggleTakeover(selectedUserId);
                        if (!takeoverMap[selectedUserId]) {
                          setTimeout(() => replyInputRef.current?.focus(), 150);
                        }
                      }}
                      style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}
                    >
                      {takeoverMap[selectedUserId] ? 'إعادة تشغيل البوت' : 'تولي الرد يدوياً'}
                    </button>
                  </div>
                </div>

                {/* Messages List */}
                <div className={`chat-messages-area ${(selectedThread?.platform || bot?.platform || 'whatsapp') === 'telegram' ? 'chat-canvas--tg' : 'chat-canvas--wa'}`}>
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

                {/* Reply Input Bar / Takeover Guard */}
                {!takeoverMap[selectedUserId] ? (
                  <div className="chat-takeover-locked-bar">
                    <div className="chat-takeover-locked-info">
                      <div className="chat-takeover-badge-bot">
                        <span className="bot-pulse-dot" />
                        <span>البوت نشط تلقائياً</span>
                      </div>
                      <span className="chat-takeover-locked-text">
                        الذكاء الاصطناعي يتولى الرد حالياً على هذا الزبون. لتفادي تداخل الرسائل، يرجى تفعيل الرد اليدوي للكتابة بنفسك.
                      </span>
                    </div>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm chat-takeover-activate-btn"
                      onClick={() => {
                        toggleTakeover(selectedUserId);
                        setTimeout(() => replyInputRef.current?.focus(), 150);
                      }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0"/><path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2"/><path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/></svg>
                      <span>تولي الرد يدوياً</span>
                    </button>
                  </div>
                ) : (
                  <div className="chat-input-area-wrapper">
                    <div className="chat-takeover-active-indicator">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span className="manual-pulse-dot" />
                        <span style={{ fontWeight: 700, color: '#f59e0b', fontSize: '0.78rem' }}>
                          أنت تتحدث مباشرة مع الزبون الآن (البوت متوقف عن هذه المحادثة)
                        </span>
                      </div>
                      <button
                        type="button"
                        className="chat-takeover-resume-link"
                        onClick={() => toggleTakeover(selectedUserId)}
                        title="إعادة تشغيل البوت للرد تلقائياً"
                      >
                        <span>إعادة تشغيل البوت</span>
                      </button>
                    </div>
                    <div className="chat-input-area">
                      <input
                        ref={replyInputRef}
                        type="text"
                        className="form-input"
                        placeholder="اكتب ردك المباشر هنا... (اضغط Enter للإرسال)"
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
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* ─── Tab 2: Orders Tab ─── */}
      {activeTab === 'orders' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.1rem', flexWrap: 'wrap', gap: '8px' }}>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                الطلبيات ({orders.length})
              </h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>
                انقر على الحالة لتحديثها فوراً — وسيصل الزبون إشعار تلقائي إن كان الجرس مفعّلاً.
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
              <p style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>لا توجد طلبيات مسجلة بعد</p>
              <p style={{ fontSize: '0.85rem' }}>يقوم البوت بتسجيل الطلبيات وتوليد كود التتبع (#DZ-XXXXXX) تلقائياً بمجرد تأكيد المشتري في المحادثة.</p>
            </div>
          ) : (
            <>
              <OrdersToolbar
                orders={orders}
                voice={voiceFor(bot.businessType)}
                filter={orderFilter}
                onFilter={setOrderFilter}
                search={orderSearch}
                onSearch={setOrderSearch}
              />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                {visibleOrders.map(order => (
                  <OrderDeliveryItem
                    key={order.id}
                    order={order}
                    bot={bot}
                    onUpdateDelivery={(orderId, payload) => updateOrderDelivery(bot.id, orderId, bot.platform || 'whatsapp', payload)}
                  />
                ))}
                {visibleOrders.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '1.5rem 1rem', color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>
                    لا توجد طلبيات مطابقة لهذا الفلتر أو البحث.
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* ─── Tab 2.5: Qualified Leads CRM Tab ─── */}
      {activeTab === 'leads' && (
        <LeadsTab
          bot={bot}
          leads={leads}
          onUpdateBot={async (data) => {
            await updateBot(id, data);
          }}
        />
      )}

      {activeTab === 'analytics' && (
        <AnalyticsTab
          allMessages={allMessages}
          orders={orders}
          leads={leads}
          bot={bot}
          onOpenChat={(uid) => { setSelectedUserId(uid); setActiveTab('chat'); }}
        />
      )}


      {/* ─── Tab 2.8: Google Sheets & Webhook Hub ─── */}
      {activeTab === 'sheets' && (
        <GoogleSheetsTab
          bot={bot}
          onUpdateBot={async (data) => {
            await updateBot(id, data);
          }}
        />
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

      {/* ─── Tab 4: Web & Mobile Widget Hub ─── */}
      {activeTab === 'widget' && (
        <WebWidgetTab
          bot={bot}
          onUpdateBot={async (data) => {
            await updateBot(id, data);
          }}
        />
      )}

      {/* ─── Tab 5: Channels Matrix Hub ─── */}
      {activeTab === 'channels' && (
        <ChannelsManager
          bot={bot}
          onUpdateBot={async (data) => {
            await updateBot(id, data);
          }}
        />
      )}

      {/* ─── Tab 6: Bot Info & Capabilities Tab ─── */}
      {activeTab === 'info' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Card 0: Order Behavior Mode (Merge vs Separate) */}
          <OrderBehaviorCard
            bot={bot}
            onUpdateBot={async (data) => {
              await updateBot(id, data);
            }}
          />

          {/* Card 0.2: Merchant Notifications Toggle */}
          <MerchantNotificationsCard
            bot={bot}
            onUpdateBot={async (data) => {
              await updateBot(id, data);
            }}
          />

          {/* Card 0.5: Abandoned Lead Recovery Settings */}
          <AbandonedRecoveryCard
            bot={bot}
            onUpdateBot={async (data) => {
              await updateBot(id, data);
            }}
          />

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
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
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
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
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
                    <label style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)', display: 'block', marginBottom: '2px' }}>
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

// Orders toolbar — status chips with live counts + search.
// The chips read the whole pipeline at a glance; tapping one
// jumps straight to that stage of the funnel.
function OrdersToolbar({ orders, voice, filter, onFilter, search, onSearch }) {
  const counts = { all: orders.length };
  STATUS_ORDER.forEach(k => { counts[k] = 0; });
  orders.forEach(o => { counts[normalizeDeliveryStatus(o.deliveryStatus)]++; });

  return (
    <div className="orders-toolbar">
      <div className="ochips" role="tablist" aria-label="فلترة الطلبيات بالحالة">
        <button
          type="button"
          className={`ochip${filter === 'all' ? ' is-on' : ''}`}
          onClick={() => onFilter('all')}
        >
          الكل
          <span className="ocount">{counts.all}</span>
        </button>
        {STATUS_ORDER.map(k => (
          <button
            key={k}
            type="button"
            className={`ochip${filter === k ? ' is-on' : ''}`}
            data-k={k}
            onClick={() => onFilter(k)}
          >
            <span className="odot" />
            {voice[k].label}
            <span className="ocount">{counts[k]}</span>
          </button>
        ))}
      </div>
      <div className="osearch">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          type="text"
          placeholder="ابحث بالاسم، الهاتف، كود التتبع أو المنتج…"
          value={search}
          onChange={e => onSearch(e.target.value)}
          aria-label="بحث في الطلبيات"
        />
      </div>
    </div>
  );
}

function DeliveryStatusIcon({ status, size = 13 }) {
  switch (normalizeDeliveryStatus(status)) {
    case 'accepted':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
          <rect x="9" y="3" width="6" height="4" rx="1" />
          <path d="m9 14 2 2 4-4" />
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
    case 'delivered':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
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

const STATUS_THEME = {
  accepted: { color: 'var(--st-accepted)', bg: 'var(--st-accepted-soft)', border: 'rgba(245, 158, 11, 0.5)' },
  shipped: { color: 'var(--st-shipped)', bg: 'var(--st-shipped-soft)', border: 'rgba(56, 189, 248, 0.5)' },
  delivered: { color: 'var(--st-delivered)', bg: 'var(--st-delivered-soft)', border: 'rgba(16, 185, 129, 0.5)' },
  cancelled: { color: 'var(--st-cancelled)', bg: 'var(--st-cancelled-soft)', border: 'rgba(248, 113, 113, 0.5)' },
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

// Orders v2 — read the card, tap a status segment, done.
// Provider/waybill/history live behind one collapsible row.
function OrderDeliveryItem({ order, bot, onUpdateDelivery }) {
  const voice = voiceFor(bot.businessType);
  const status = normalizeDeliveryStatus(order.deliveryStatus);
  const [notify, setNotify] = useState(true);
  const [busyStatus, setBusyStatus] = useState(null);
  const [openDetails, setOpenDetails] = useState(false);
  const [provider, setProvider] = useState(order.deliveryProvider || 'manual');
  const [trackingNumber, setTrackingNumber] = useState(order.deliveryTrackingNumber || '');
  const [savingDetails, setSavingDetails] = useState(false);
  const toast = useToast();

  const pickStatus = async (key) => {
    if (key === status || busyStatus) return;
    setBusyStatus(key);
    try {
      await onUpdateDelivery(order.id, {
        deliveryStatus: key,
        provider,
        trackingNumber,
        notifyCustomer: notify && !!order.customerId,
        note: `الحالة: ${voice[key].label}`,
      });
      toast.success(notify && order.customerId
        ? `تم التحديث إلى «${voice[key].label}» وأُرسل إشعار للزبون`
        : `تم التحديث إلى «${voice[key].label}»`);
    } catch (e) {
      toast.error('فشل تحديث الحالة: ' + e.message);
    } finally {
      setBusyStatus(null);
    }
  };

  const saveDetails = async () => {
    setSavingDetails(true);
    try {
      await onUpdateDelivery(order.id, {
        deliveryStatus: status,
        provider,
        trackingNumber,
        notifyCustomer: false,
        note: 'تحديث بيانات الشحن',
      });
      toast.success('تم حفظ بيانات الشحن');
    } catch (e) {
      toast.error('فشل حفظ بيانات الشحن: ' + e.message);
    } finally {
      setSavingDetails(false);
    }
  };

  const copyCode = (e) => {
    e.stopPropagation();
    if (order.trackingCode) {
      navigator.clipboard.writeText(order.trackingCode);
      toast.success(`تم نسخ كود التتبع #${order.trackingCode}`);
    }
  };

  const initial = (order.customerName || 'ز').charAt(0);
  const providerLabel = DELIVERY_PROVIDERS.find(p => p.key === provider)?.label || '';
  const hasHistory = Array.isArray(order.statusHistory) && order.statusHistory.length > 0;

  return (
    <div className="ocard" data-status={status}>
      <div className="ocard-head">
        <div className="ocard-id">
          <span className="ocard-avatar">{initial}</span>
          <div>
            <strong>{order.customerName || 'زبون'}</strong>
            {order.phone && <span className="ocard-phone" dir="ltr">{order.phone}</span>}
          </div>
        </div>
        <div className="ocard-meta">
          {order.trackingCode && (
            <button className="tracking-code-pill" onClick={copyCode} title="انقر لنسخ كود التتبع">
              <span>#{order.trackingCode}</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            </button>
          )}
          <span className="otime">{formatTime(order.createdAt)}</span>
        </div>
      </div>

      <div className="ocard-line">
        {order.product && (
          <span className="oproduct">
            {order.product}
            {order.price ? <span className="oprice"> · {order.price} {bot.currency || 'دج'}</span> : null}
          </span>
        )}
        {order.address && (
          <span className="oaddr">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
            {order.address}
          </span>
        )}
        {order.orderSummary && <span className="osummary">{order.orderSummary}</span>}
      </div>

      <div className="obar">
        <div className="osegs" role="group" aria-label="حالة الطلبية">
          {STATUS_ORDER.map(k => (
            <button
              key={k}
              type="button"
              className={`oseg${status === k ? ' is-on' : ''}`}
              data-k={k}
              onClick={() => pickStatus(k)}
              disabled={!!busyStatus}
              title={voice[k].customer}
            >
              {busyStatus === k ? <span className="oseg-spin" /> : <DeliveryStatusIcon status={k} />}
              <span>{voice[k].label}</span>
            </button>
          ))}
        </div>
        <button
          type="button"
          className={`obell${notify ? ' is-on' : ''}`}
          onClick={() => setNotify(n => !n)}
          title={notify ? 'الإشعار مفعّل: سيُرسل للزبون رسالة عند كل تغيير حالة' : 'الإشعار موقوف: التغييرات تُحفظ دون مراسلة الزبون'}
          aria-label="تبديل إشعار الزبون"
        >
          {notify ? (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
          ) : (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M13.73 21a2 2 0 0 1-3.46 0"/><path d="M18.63 13A17.89 17.89 0 0 1 18 8"/><path d="M6.26 6.26A5.86 5.86 0 0 0 6 8c0 7-3 9-3 9h14"/><path d="M18 8a6 6 0 0 0-9.33-5"/><line x1="1" y1="1" x2="23" y2="23"/>
            </svg>
          )}
        </button>
      </div>

      <button type="button" className={`omore${openDetails ? ' is-open' : ''}`} onClick={() => setOpenDetails(o => !o)}>
        تفاصيل الشحن{provider !== 'manual' ? ` · ${providerLabel}` : ''}
        {order.deliveryTrackingNumber ? ` · ${order.deliveryTrackingNumber}` : ''}
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
      </button>

      {openDetails && (
        <div className="odetails">
          <div className="odetails-grid">
            <div className="form-group">
              <label className="form-label">شركة التوصيل</label>
              <select className="form-select" value={provider} onChange={e => setProvider(e.target.value)}>
                {DELIVERY_PROVIDERS.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">رقم بوليصة الشحن</label>
              <input
                className="form-input"
                placeholder="مثال: YAL-98765432"
                value={trackingNumber}
                onChange={e => setTrackingNumber(e.target.value)}
              />
            </div>
            <button className="btn btn-primary btn-sm" onClick={saveDetails} disabled={savingDetails}>
              {savingDetails ? <span className="oseg-spin" /> : 'حفظ'}
            </button>
          </div>

          {hasHistory && (
            <div className="timeline-container">
              {[...order.statusHistory].reverse().map((step, idx) => {
                const stepKey = normalizeDeliveryStatus(step.deliveryStatus);
                const c = STATUS_THEME[stepKey];
                return (
                  <div key={idx} className="timeline-step">
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ color: c.color }}><DeliveryStatusIcon status={stepKey} size={14} /></span>
                      <span>{voice[stepKey].label}{step.provider && step.provider !== 'manual' ? ` (${step.provider})` : ''}</span>
                    </div>
                    {step.trackingNumber && (
                      <div style={{ fontSize: '0.74rem', color: 'var(--st-shipped)', marginTop: '2px' }}>بوليصة: {step.trackingNumber}</div>
                    )}
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                      {new Date(step.timestamp).toLocaleString('ar')}{step.note ? ` — ${step.note}` : ''}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function OrderBehaviorCard({ bot, onUpdateBot }) {
  const currentMode = bot?.orderMergeMode || 'merge'; // 'merge' (default) | 'separate'
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const handleSelect = async (mode) => {
    if (mode === currentMode) return;
    setSaving(true);
    try {
      await onUpdateBot({ orderMergeMode: mode });
      toast.success(mode === 'merge' ? 'تم تفعيل دمج وتحديث الطلبية السابقة (طرد واحد)' : 'تم تفعيل تسجيل كل منتج كطلبية مستقلة');
    } catch (e) {
      toast.error('فشل حفظ الإعداد: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card" style={{ borderColor: 'rgba(56, 189, 248, 0.25)', background: 'var(--bg-deep)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1rem' }}>
        <div style={{
          width: '42px', height: '42px', borderRadius: '12px', flexShrink: 0,
          background: 'rgba(56, 189, 248, 0.12)', border: '1px solid rgba(56, 189, 248, 0.3)',
          color: '#38bdf8', display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/><line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="13" y2="16"/></svg>
        </div>
        <div>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            سلوك الطلبات المتتالية لنفس العميل
            <span style={{ fontSize: '0.68rem', fontWeight: 800, padding: '2px 8px', borderRadius: '20px', background: 'rgba(56, 189, 248, 0.12)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.35)' }}>
              {currentMode === 'merge' ? 'دمج وتحديث (افتراضي)' : 'منفصل'}
            </span>
          </h3>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.55 }}>
            حدد كيف يتصرف الذكاء الاصطناعي عندما يطلب العميل منتجاً إضافياً أو يعدل طلبه في نفس المحادثة:
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '10px' }}>
        {/* Option 1: Merge (Default) */}
        <div
          onClick={() => !saving && handleSelect('merge')}
          style={{
            padding: '1rem',
            borderRadius: '12px',
            background: currentMode === 'merge' ? 'rgba(16, 185, 129, 0.08)' : 'var(--bg-deep)',
            border: `1.5px solid ${currentMode === 'merge' ? '#10b981' : 'rgba(255, 255, 255, 0.08)'}`,
            cursor: saving ? 'wait' : 'pointer',
            transition: 'all 0.2s ease',
            position: 'relative',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
            <strong style={{ color: currentMode === 'merge' ? '#34d399' : '#ffffff', fontSize: '0.92rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
              دمج وتحديث الطلبية السابقة (طرد واحد - موصى به)
            </strong>
            <span style={{
              width: '18px', height: '18px', borderRadius: '50%',
              border: `2px solid ${currentMode === 'merge' ? '#10b981' : 'rgba(255,255,255,0.2)'}`,
              background: currentMode === 'merge' ? '#10b981' : 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              {currentMode === 'merge' && <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#fff' }} />}
            </span>
          </div>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
            يتم دمج المنتجات في طرد واحد وتحديث نفس السطر في Google Sheets ولوحة التحكم دون تكرار أو رسوم شحن إضافية.
          </p>
        </div>

        {/* Option 2: Separate */}
        <div
          onClick={() => !saving && handleSelect('separate')}
          style={{
            padding: '1rem',
            borderRadius: '12px',
            background: currentMode === 'separate' ? 'rgba(56, 189, 248, 0.08)' : 'var(--bg-deep)',
            border: `1.5px solid ${currentMode === 'separate' ? '#38bdf8' : 'rgba(255, 255, 255, 0.08)'}`,
            cursor: saving ? 'wait' : 'pointer',
            transition: 'all 0.2s ease',
            position: 'relative',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
            <strong style={{ color: currentMode === 'separate' ? '#38bdf8' : '#ffffff', fontSize: '0.92rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
              تسجيل كل منتج كطلبية مستقلة
            </strong>
            <span style={{
              width: '18px', height: '18px', borderRadius: '50%',
              border: `2px solid ${currentMode === 'separate' ? '#38bdf8' : 'rgba(255,255,255,0.2)'}`,
              background: currentMode === 'separate' ? '#38bdf8' : 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              {currentMode === 'separate' && <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#fff' }} />}
            </span>
          </div>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
            يتم تسجيل المنتج الإضافي فقط بسعره المستقل في سطر جديد بكود تتبع منفصل (مناسب للمطاعم والخدمات المتقطعة).
          </p>
        </div>
      </div>
    </div>
  );
}

// Merchant alerts toggle — controls ALL merchant-facing notifications for
// this bot (in-app bell + WhatsApp self-message on new orders & disconnects).
// Default: ON (the field's absence means enabled).
function MerchantNotificationsCard({ bot, onUpdateBot }) {
  const enabled = bot?.notificationsEnabled !== false;
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const toggle = async () => {
    setSaving(true);
    try {
      await onUpdateBot({ notificationsEnabled: !enabled });
      toast.success(!enabled ? 'تم تفعيل تنبيهات التاجر' : 'تم كتم تنبيهات التاجر');
    } catch (e) {
      toast.error('فشل تحديث الإشعارات: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card" style={{ borderColor: enabled ? 'rgba(16, 185, 129, 0.25)' : undefined }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', flex: 1, minWidth: '240px' }}>
          <div style={{
            width: '42px', height: '42px', borderRadius: '12px', flexShrink: 0,
            background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.3)',
            color: '#34d399', display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
          </div>
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              تنبيهات التاجر
              <span style={{
                fontSize: '0.68rem', fontWeight: 800, padding: '2px 8px', borderRadius: '20px',
                background: enabled ? 'rgba(16, 185, 129, 0.12)' : 'rgba(148, 163, 184, 0.1)',
                color: enabled ? '#34d399' : '#94a3b8',
                border: `1px solid ${enabled ? 'rgba(16, 185, 129, 0.35)' : 'rgba(148, 163, 184, 0.25)'}`
              }}>
                {enabled ? 'مفعلة' : 'مكتومة'}
              </span>
            </h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.55 }}>
              إشعار فوري في اللوحة + رسالة واتساب لرقمك عند كل طلبية جديدة أو انقطاع اتصال — لهذا البوت تحديداً.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={toggle}
          disabled={saving}
          style={{
            width: '52px', height: '28px', borderRadius: '99px', flexShrink: 0,
            border: 'none', cursor: saving ? 'wait' : 'pointer', position: 'relative',
            background: enabled ? 'linear-gradient(135deg, #10b981, #059669)' : 'rgba(148, 163, 184, 0.25)',
            transition: 'background 0.25s ease',
          }}
          aria-label={enabled ? 'كتم التنبيهات' : 'تفعيل التنبيهات'}
        >
          <span style={{
            position: 'absolute', top: '3px',
            right: enabled ? '27px' : '3px',
            width: '22px', height: '22px', borderRadius: '50%',
            background: '#ffffff', boxShadow: '0 2px 6px rgba(0, 0, 0, 0.35)',
            transition: 'right 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
          }} />
        </button>
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
      key: 'webWidget',
      title: 'ودجت الشات للمواقع وتطبيقات فلاتر',
      desc: 'تمكين زوار موقعك أو متجرك أو مستخدمي تطبيقك من التحدث مع البوت مباشرة.',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
        </svg>
      )
    },
    {
      key: 'abandonedRecovery',
      title: 'استرجاع الزبائن والمحادثات المتروكة',
      desc: 'إرسال تذكير آلي ذكي للزبائن الذين توقفوا عن الرد قبل إتمام الطلب أو الحجز لرفع المبيعات.',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21.5 2v6h-6"/><path d="M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
        </svg>
      )
    },
  ];

  return (
    <div className="card">
      <div className="card-header-row" style={{ marginBottom: '0.65rem' }}>
        <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
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
    cancelled: { label: 'ملغي', bg: '#1c263c', color: 'var(--text-secondary)', border: '#26334d' },
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

function AbandonedRecoveryCard({ bot, onUpdateBot }) {
  const [enabled, setEnabled] = useState(bot?.features?.abandonedRecovery === true || bot?.abandonedRecoveryEnabled === true);
  const [delayHours, setDelayHours] = useState(bot?.abandonedRecoveryDelayHours || 2);
  const [message, setMessage] = useState(bot?.abandonedRecoveryMessage || '');
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const handleToggle = async () => {
    const nextState = !enabled;
    setEnabled(nextState);
    setSaving(true);
    try {
      await onUpdateBot({
        abandonedRecoveryEnabled: nextState,
        abandonedRecoveryDelayHours: Number(delayHours),
        abandonedRecoveryMessage: message,
        features: sanitizeBotFeatures({
          ...(bot?.features || {}),
          abandonedRecovery: nextState,
        }),
      });
      toast.success(nextState ? 'تم تفعيل نظام استرجاع الزبائن المتروكين' : 'تم تعطيل نظام استرجاع الزبائن');
    } catch (e) {
      toast.error('فشل حفظ الإعدادات: ' + e.message);
      setEnabled(!nextState);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSettings = async (e) => {
    e?.preventDefault();
    setSaving(true);
    try {
      await onUpdateBot({
        abandonedRecoveryEnabled: enabled,
        abandonedRecoveryDelayHours: Number(delayHours),
        abandonedRecoveryMessage: message,
        features: sanitizeBotFeatures({
          ...(bot?.features || {}),
          abandonedRecovery: enabled,
        }),
      });
      toast.success('تم حفظ إعدادات الاسترجاع بنجاح');
    } catch (e) {
      toast.error('فشل الحفظ: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card" style={{ border: enabled ? '1px solid rgba(245, 158, 11, 0.35)' : '1px solid var(--border-default)' }}>
      <div className="card-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21.5 2v6h-6"/><path d="M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
          </svg>
          استرجاع الزبائن والمحادثات المتروكة (Abandoned Recovery)
        </h3>

        <button
          type="button"
          className={`btn btn-sm ${enabled ? 'btn-primary' : 'btn-secondary'}`}
          onClick={handleToggle}
          disabled={saving}
          style={{ minWidth: '85px', fontSize: '0.78rem' }}
        >
          {enabled ? 'مفعل' : 'معطل'}
        </button>
      </div>

      <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1rem', lineHeight: 1.5 }}>
        عندما يبدأ الزبون محادثة ولا يكمل طلبه أو حجزه، يقوم النظام تلقائياً بإرسال رسالة تذكيرية واحدة لطيفة بعد مهلة تحددها لإعادة تنشيط الزبون.
      </p>

      {enabled && (
        <form onSubmit={handleSaveSettings} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', marginTop: '0.75rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '0.85rem' }}>
          <div className="form-group">
            <label className="form-label">مهلة إرسال التذكير بعد انقطاع الرد</label>
            <select
              className="form-select"
              value={delayHours}
              onChange={(e) => setDelayHours(Number(e.target.value))}
            >
              <option value="1">بعد 1 ساعة من آخر رسالة</option>
              <option value="2">بعد 2 ساعتان (موصى به)</option>
              <option value="4">بعد 4 ساعات</option>
              <option value="6">بعد 6 ساعات</option>
              <option value="12">بعد 12 ساعة</option>
              <option value="24">بعد 24 ساعة (يوم كامل)</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">نص رسالة التذكير المخصصة (اختياري)</label>
            <textarea
              className="form-textarea"
              rows="2"
              placeholder="مرحباً بك مجدداً، لاحظنا أنك كنت مهتماً بخدماتنا واستفسرت سابقاً. هل ما زلت بحاجة لأي استفسار أو ترغب في إتمام طلبك؟ نحن في خدمتك دائماً."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
              {saving ? 'جاري الحفظ...' : 'حفظ إعدادات التذكير'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function WebWidgetTab({ bot, onUpdateBot }) {
  const [copiedScript, setCopiedScript] = useState(false);
  const [whatsappNumber, setWhatsappNumber] = useState(bot?.whatsappNumber || bot?.phoneNumber || '');
  const [telegramUsername, setTelegramUsername] = useState(bot?.telegramUsername || bot?.botUsername || '');
  const [position, setPosition] = useState(bot?.webWidgetPosition || 'right');
  const [color, setColor] = useState(bot?.webWidgetColor || '#2563eb');
  const [greeting, setGreeting] = useState(bot?.webWidgetGreeting || 'تواصل معنا مباشرة عبر المنصة المفضلة لديك');
  const [defaultText, setDefaultText] = useState(bot?.webWidgetText || 'مرحباً، أود الاستفسار عن الخدمات والأسعار');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const isWidgetEnabled = bot?.features?.webWidget !== false && bot?.webWidgetEnabled !== false;
  const botDisplayName = bot?.botName || bot?.businessName || 'خدمة العملاء';

  // Build clean script tag
  const cleanWa = whatsappNumber.replace(/[^0-9]/g, '');
  const cleanTg = telegramUsername.replace(/^@/, '').trim();

  let scriptAttrs = [
    `src="https://aurabot.pages.dev/widget.js"`,
    `data-name="${botDisplayName}"`,
  ];
  if (cleanWa) scriptAttrs.push(`data-whatsapp="${cleanWa}"`);
  if (cleanTg) scriptAttrs.push(`data-telegram="${cleanTg}"`);
  if (color !== '#2563eb') scriptAttrs.push(`data-color="${color}"`);
  if (position !== 'right') scriptAttrs.push(`data-position="${position}"`);
  if (greeting) scriptAttrs.push(`data-greeting="${greeting}"`);
  if (defaultText) scriptAttrs.push(`data-text="${defaultText}"`);

  const scriptTag = `<script ${scriptAttrs.join(' ')}></script>`;

  const handleCopyScript = () => {
    navigator.clipboard.writeText(scriptTag);
    setCopiedScript(true);
    toast.success('تم نسخ كود الودجت بنجاح');
    setTimeout(() => setCopiedScript(false), 2500);
  };

  const handleSaveSettings = async (e) => {
    e?.preventDefault();
    setSaving(true);
    try {
      await onUpdateBot({
        whatsappNumber: cleanWa,
        telegramUsername: cleanTg,
        webWidgetPosition: position,
        webWidgetColor: color,
        webWidgetGreeting: greeting,
        webWidgetText: defaultText,
      });
      toast.success('تم حفظ إعدادات الودجت بنجاح');
    } catch (e) {
      toast.error('فشل حفظ الإعدادات: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleWidget = async () => {
    const nextState = !isWidgetEnabled;
    try {
      await onUpdateBot({
        webWidgetEnabled: nextState,
        features: sanitizeBotFeatures({
          ...(bot?.features || {}),
          webWidget: nextState,
        }),
      });
      toast.success(nextState ? 'تم تفعيل ودجت الموقع' : 'تم تعطيل ودجت الموقع');
    } catch (e) {
      toast.error('فشل تغيير الحالة: ' + e.message);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Header Banner Card */}
      <div className="card" style={{ background: 'linear-gradient(145deg, #131d33 0%, #0d1526 100%)', border: '1px solid var(--border-default)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '0.75rem' }}>
          <div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2.2">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
                <line x1="8" y1="21" x2="16" y2="21"/>
                <line x1="12" y1="17" x2="12" y2="21"/>
              </svg>
              ودجت الدردشة العائم للمواقع والمتاجر (Web Chat Launcher)
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '4px', margin: 0 }}>
              زر عائم ذكي ينبثق منه خيارات التواصل المباشر (واتساب أو تيليغرام أو كلاهما) لفتح التطبيق والرد الفوري عبر الذكاء الاصطناعي.
            </p>
          </div>

          <button
            type="button"
            className={`btn ${isWidgetEnabled ? 'btn-primary' : 'btn-secondary'}`}
            onClick={handleToggleWidget}
            style={{ minWidth: '100px' }}
          >
            {isWidgetEnabled ? 'الودجت مفعل' : 'الودجت معطل'}
          </button>
        </div>
      </div>

      {/* Integration Script Card */}
      <div className="card">
        <div className="card-header-row" style={{ marginBottom: '0.5rem' }}>
          <h4 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
            كود التضمين للمواقع والمتاجر (Shopify, YouCan, WordPress, WooCommerce, Custom HTML)
          </h4>
        </div>
        <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
          انسخ هذا السطر البرمجي والصقه في إعدادات متجرك أو موقعك (قبل إغلاق وسم body أو في قسم Custom JavaScript / Header):
        </p>
        <div style={{ background: 'var(--bg-app)', padding: '0.85rem 1.15rem', borderRadius: '10px', border: '1px solid var(--border-default)', fontFamily: 'monospace', fontSize: '0.82rem', color: '#38bdf8', wordBreak: 'break-all', direction: 'ltr', textAlign: 'left', marginBottom: '0.85rem' }}>
          {scriptTag}
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-primary btn-sm" onClick={handleCopyScript} style={{ flex: 1, minWidth: '200px' }}>
            {copiedScript ? 'تم نسخ الكود بنجاح' : 'نسخ كود الودجت بضغطة زر'}
          </button>
        </div>
      </div>

      {/* Widget Channels and Customization Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
        {/* Customizer Form */}
        <div className="card">
          <div className="card-header-row" style={{ marginBottom: '0.75rem' }}>
            <h4 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              قنوات التواصل ومظهر الودجت
            </h4>
          </div>

          <form onSubmit={handleSaveSettings} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <div className="form-group">
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#25D366' }} />
                رقم واتساب المحادثة (مع مفتاح الدولة، مثل 213XXXXXXXXX)
              </label>
              <input
                type="text"
                className="form-input"
                placeholder="213661234567"
                value={whatsappNumber}
                onChange={(e) => setWhatsappNumber(e.target.value)}
                style={{ direction: 'ltr', textAlign: 'left' }}
              />
              <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>
                اتركه فارغاً إذا كنت لا ترغب بإظهار زر واتساب في الموقع.
              </span>
            </div>

            <div className="form-group">
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#24A1DE' }} />
                اسم مستخدم بوت تيليغرام (Telegram Username بدون @)
              </label>
              <input
                type="text"
                className="form-input"
                placeholder="BatnaTechBot"
                value={telegramUsername}
                onChange={(e) => setTelegramUsername(e.target.value)}
                style={{ direction: 'ltr', textAlign: 'left' }}
              />
              <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>
                اتركه فارغاً إذا كنت لا ترغب بإظهار زر تيليغرام في الموقع.
              </span>
            </div>

            <div className="form-group">
              <label className="form-label">موقع الزر على الشاشة</label>
              <select className="form-select" value={position} onChange={(e) => setPosition(e.target.value)}>
                <option value="right">أسفل اليمين (موصى به للمواقع العربية)</option>
                <option value="left">أسفل اليسار</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">لون الزر العائم</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  style={{ width: '40px', height: '38px', borderRadius: '8px', border: '1px solid var(--border-default)', background: 'transparent', cursor: 'pointer' }}
                />
                <input
                  type="text"
                  className="form-input"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  style={{ direction: 'ltr', textAlign: 'left', flex: 1 }}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">عنوان الترحيب في النافذة</label>
              <input
                type="text"
                className="form-input"
                value={greeting}
                onChange={(e) => setGreeting(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">رسالة البداية التلقائية في واتساب</label>
              <input
                type="text"
                className="form-input"
                value={defaultText}
                onChange={(e) => setDefaultText(e.target.value)}
              />
            </div>

            <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
              {saving ? 'جاري الحفظ...' : 'حفظ إعدادات الودجت'}
            </button>
          </form>
        </div>

        {/* Live Interactive Preview Box */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="card-header-row" style={{ width: '100%', marginBottom: '0.85rem' }}>
            <h4 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }} />
              معاينة حية وتفاعلية للشاشات (Interactive Preview)
            </h4>
          </div>

          <div style={{
            flex: 1,
            minHeight: '380px',
            background: 'var(--bg-sidebar)',
            borderRadius: '16px',
            border: '1px solid var(--border-default)',
            position: 'relative',
            padding: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}>
            {/* Fake Store Mockup UI */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '10px', marginBottom: '16px' }}>
              <span style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--text-primary)' }}>{botDisplayName}</span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <span style={{ width: '30px', height: '8px', background: 'rgba(255, 255, 255, 0.1)', borderRadius: '4px' }} />
                <span style={{ width: '45px', height: '8px', background: 'rgba(255, 255, 255, 0.1)', borderRadius: '4px' }} />
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ width: '60%', height: '14px', background: 'rgba(255, 255, 255, 0.1)', borderRadius: '6px' }} />
              <div style={{ width: '85%', height: '10px', background: 'var(--veil-2)', borderRadius: '4px' }} />
              <div style={{ width: '75%', height: '10px', background: 'var(--veil-2)', borderRadius: '4px' }} />
            </div>

            {/* Simulated Popover Card */}
            {previewOpen && (
              <div style={{
                position: 'absolute',
                bottom: '80px',
                [position === 'left' ? 'left' : 'right']: '20px',
                width: '280px',
                background: 'var(--bg-card)',
                borderRadius: '16px',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                boxShadow: '0 12px 36px rgba(0, 0, 0, 0.5)',
                overflow: 'hidden',
                zIndex: 20,
                animation: 'chatMsgFadeIn 0.2s ease',
              }}>
                <div style={{ padding: '0.85rem 1rem', background: 'var(--bg-cell)', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: color, color: 'var(--text-primary)', fontWeight: 800, fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {botDisplayName.charAt(0)}
                    </div>
                    <div>
                      <div style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.1 }}>{botDisplayName}</div>
                      <div style={{ fontSize: '0.68rem', color: '#10b981', fontWeight: 600 }}>متصل الآن • نرد فوراً</div>
                    </div>
                  </div>
                  <button type="button" onClick={() => setPreviewOpen(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '2px' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </div>

                <div style={{ padding: '0.85rem 1rem', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>{greeting}</div>

                  {cleanWa && (
                    <a
                      href={`https://wa.me/${cleanWa}?text=${encodeURIComponent(defaultText)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.65rem 0.85rem',
                        background: 'linear-gradient(135deg, #25D366 0%, #128C7E 100%)',
                        borderRadius: '10px',
                        color: 'var(--text-on-fill)',
                        textDecoration: 'none',
                        fontWeight: 700,
                        fontSize: '0.8rem',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M20.52 3.48A11.93 11.93 0 0012.04 0C5.46 0 .1 5.36.1 11.94c0 2.1.55 4.15 1.6 5.96L0 24l6.26-1.64a11.87 11.87 0 005.78 1.48h.01c6.58 0 11.94-5.36 11.94-11.94 0-3.19-1.24-6.19-3.47-8.42zM12.05 21.84h-.01a9.87 9.87 0 01-5.03-1.38l-.36-.21-3.73.98.99-3.64-.24-.38a9.88 9.88 0 01-1.52-5.27c0-5.46 4.44-9.9 9.9-9.9 2.64 0 5.13 1.03 7 2.9a9.83 9.83 0 012.89 6.99c0 5.46-4.44 9.91-9.89 9.91zm5.43-7.41c-.3-.15-1.77-.87-2.04-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.14-.14.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.08c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.08 1.77-.72 2.02-1.42.25-.7.25-1.3.17-1.42-.07-.13-.27-.2-.57-.35z"/></svg>
                        <span>محادثة واتساب</span>
                      </div>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M15 18l-6-6 6-6"/></svg>
                    </a>
                  )}

                  {cleanTg && (
                    <a
                      href={`https://t.me/${cleanTg}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.65rem 0.85rem',
                        background: 'linear-gradient(135deg, #2AABEE 0%, #229ED9 100%)',
                        borderRadius: '10px',
                        color: 'var(--text-primary)',
                        textDecoration: 'none',
                        fontWeight: 700,
                        fontSize: '0.8rem',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.446 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.121l-6.871 4.326-2.962-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.832.932z"/></svg>
                        <span>محادثة تيليغرام</span>
                      </div>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M15 18l-6-6 6-6"/></svg>
                    </a>
                  )}

                  {!cleanWa && !cleanTg && (
                    <div style={{ fontSize: '0.72rem', color: '#f59e0b', textAlign: 'center', padding: '6px' }}>
                      يرجى إضافة رقم واتساب أو يوزرنيم تيليغرام لتظهر الأزرار
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Simulated Floating Launcher */}
            <button
              type="button"
              onClick={() => setPreviewOpen(!previewOpen)}
              style={{
                position: 'absolute',
                bottom: '16px',
                [position === 'left' ? 'left' : 'right']: '20px',
                width: '48px',
                height: '48px',
                borderRadius: '24px',
                background: color,
                color: 'var(--text-primary)',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 6px 20px rgba(0, 0, 0, 0.4)',
                zIndex: 25,
                transition: 'transform 0.15s ease',
              }}
            >
              {previewOpen ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              ) : (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Quick Setup Guides Accordion / Card */}
      <div className="card">
        <h4 style={{ fontSize: '0.98rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.85rem' }}>
          طريقة التثبيت على أشهر المنصات:
        </h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '10px' }}>
          <div style={{ background: 'var(--bg-app)', padding: '0.85rem', borderRadius: '10px', border: '1px solid var(--border-default)' }}>
            <strong style={{ color: '#34d399', display: 'block', marginBottom: '4px', fontSize: '0.85rem' }}>YouCan</strong>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
              الإعدادات (Settings) ← أونلاين (Online) ← أكواد CSS & JS ← الصق الكود في خانة أكواد JavaScript (Header أو Footer).
            </p>
          </div>
          <div style={{ background: 'var(--bg-app)', padding: '0.85rem', borderRadius: '10px', border: '1px solid var(--border-default)' }}>
            <strong style={{ color: '#10b981', display: 'block', marginBottom: '4px', fontSize: '0.85rem' }}>Shopify</strong>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
              Online Store ← Themes ← Edit code ← افتح ملف <code>theme.liquid</code> والصق الكود قبل <code>&lt;/body&gt;</code> مباشرة.
            </p>
          </div>
          <div style={{ background: 'var(--bg-app)', padding: '0.85rem', borderRadius: '10px', border: '1px solid var(--border-default)' }}>
            <strong style={{ color: '#a78bfa', display: 'block', marginBottom: '4px', fontSize: '0.85rem' }}>WordPress / WooCommerce</strong>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
              استخدم إضافة (WPCode أو Insert Headers and Footers) والصق الكود في قسم Footer Scripts.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Component: Qualified Leads & CRM Tab (Ultra-Clean & Responsive) ──
function LeadsTab({ bot, leads = [], orders = [], onUpdateBot, onOpenChat }) {
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [hotOnly, setHotOnly] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);
  const [selectedLead, setSelectedLead] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [convertedView, setConvertedView] = useState(false);

  // Conversion awareness: a lead whose phone matches a real order has
  // left the pipeline — shown only under the «محوّلين» chip
  const digitsOf = (v) => String(v || '').replace(/[^0-9]/g, '');
  const convertedIds = useMemo(() => {
    const set = new Set();
    for (const o of orders) {
      if (o.customerId) set.add(digitsOf(o.customerId));
      if (o.phone) set.add(digitsOf(o.phone));
    }
    return set;
  }, [orders]);
  const isConvertedLead = (lead) => convertedIds.has(digitsOf(lead.phone));
  const convertedCount = leads.filter(isConvertedLead).length;

  // Status mapping and colors
  // Reduced palette: emerald / neutral / amber / red only — no rainbow
  const STATUS_CONFIG = {
    new: { label: 'جديد', bg: 'rgba(16, 185, 129, 0.1)', color: '#34d399', border: 'rgba(16, 185, 129, 0.3)' },
    contacted: { label: 'تم التواصل', bg: 'rgba(148, 163, 184, 0.1)', color: 'var(--text-secondary)', border: 'rgba(148, 163, 184, 0.2)' },
    qualified: { label: 'مؤهل للشراء', bg: 'rgba(245, 158, 11, 0.1)', color: '#fbbf24', border: 'rgba(245, 158, 11, 0.3)' },
    closed: { label: 'تم التعاقد', bg: 'rgba(16, 185, 129, 0.16)', color: '#10b981', border: 'rgba(16, 185, 129, 0.4)' },
    lost: { label: 'ملغي', bg: 'rgba(239, 68, 68, 0.1)', color: '#f87171', border: 'rgba(239, 68, 68, 0.3)' },
  };

  const PRIORITY_CONFIG = {
    hot: { label: 'ساخن', hint: 'أولوية قصوى — تواصل فوراً', bg: 'rgba(239, 68, 68, 0.12)', color: '#f87171', border: 'rgba(239, 68, 68, 0.3)', dot: '#ef4444' },
    warm: { label: 'مهتم', hint: 'مهتم — يتابعه البوت', bg: 'rgba(245, 158, 11, 0.12)', color: '#fbbf24', border: 'rgba(245, 158, 11, 0.3)', dot: '#f59e0b' },
    cold: { label: 'استفسار', hint: 'استفسار عادي', bg: 'rgba(148, 163, 184, 0.1)', color: 'var(--text-secondary)', border: 'rgba(148, 163, 184, 0.2)', dot: '#94a3b8' },
  };

  const filteredLeads = leads.filter(lead => {
    const isConv = isConvertedLead(lead);
    if (convertedView) { if (!isConv) return false; }
    else if (isConv && !search.trim()) return false;
    if (hotOnly && lead.leadStatus !== 'hot') return false;
    if (statusFilter !== 'all' && (lead.status || 'new') !== statusFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      const matchName = (lead.customerName || lead.name || '').toLowerCase().includes(q);
      const matchPhone = (lead.phone || '').includes(q);
      const matchService = (lead.service || '').toLowerCase().includes(q);
      const matchCompany = (lead.company || '').toLowerCase().includes(q);
      const matchNotes = (lead.notes || '').toLowerCase().includes(q);
      if (!matchName && !matchPhone && !matchService && !matchCompany && !matchNotes) return false;
    }
    return true;
  });

  const hotCount = leads.filter(l => l.leadStatus === 'hot').length;
  const contactedCount = leads.filter(l => l.status === 'contacted' || l.status === 'closed' || l.status === 'qualified').length;

  const handleStatusChange = async (leadId, newStatus) => {
    setUpdatingId(leadId);
    try {
      await updateLeadStatus(leadId, newStatus);
      if (selectedLead && selectedLead.id === leadId) {
        setSelectedLead(prev => prev ? { ...prev, status: newStatus } : null);
      }
      toast.success('تم تحديث حالة العميل');
    } catch (err) {
      toast.error('فشل تحديث الحالة: ' + err.message);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDelete = async (leadId) => {
    try {
      await deleteLead(leadId);
      setSelectedLead(prev => (prev && prev.id === leadId) ? null : prev);
      setDeleteTarget(null);
      toast.success('تم حذف العميل');
    } catch (err) {
      toast.error('فشل حذف العميل: ' + err.message);
    }
  };

  const copyPhone = (phone) => {
    if (!phone) return;
    navigator.clipboard.writeText(phone);
    toast.success('تم نسخ رقم الهاتف');
  };

  const getCleanPhone = (phone) => (phone || '').replace(/[^\d+]/g, '');

  const getWhatsAppLink = (lead) => {
    const raw = getCleanPhone(lead.phone);
    if (!raw) return '#';
    const formatted = raw.startsWith('+') ? raw.slice(1) : (raw.startsWith('0') ? '213' + raw.slice(1) : raw);
    const msg = `مرحباً أستاذ ${lead.customerName || lead.name || ''}، نتواصل معك بخصوص طلبك (${lead.service || 'استشارتك'}).`;
    return `https://wa.me/${formatted}?text=${encodeURIComponent(msg)}`;
  };

  const exportCSV = () => {
    if (leads.length === 0) {
      toast.error('لا توجد بيانات لتصديرها');
      return;
    }
    // Excel/Sheets formula-injection guard: lead fields are customer-
    // controlled free text, and a value starting with = + - @ or a tab
    // would execute as a formula when the merchant opens the CSV.
    const csvSafe = (v) => {
      const s = String(v ?? '');
      const guarded = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
      return guarded.replace(/"/g, '""');
    };
    const headers = ['التاريخ', 'اسم العميل', 'رقم الهاتف', 'الشركة / النشاط', 'الخدمة المطلوبة', 'الميزانية', 'تصنيف الذكاء الاصطناعي', 'حالة المتابعة', 'الملاحظات', 'المنصة'];
    const rows = leads.map(l => [
      l.createdAt ? new Date(l.createdAt).toLocaleDateString('ar-DZ') : '-',
      `"${csvSafe(l.customerName || l.name || '')}"`,
      `"${csvSafe(l.phone || '')}"`,
      `"${csvSafe(l.company || '')}"`,
      `"${csvSafe(l.service || '')}"`,
      `"${csvSafe(l.budget || '')}"`,
      l.leadStatus === 'hot' ? 'ساخن' : (l.leadStatus === 'warm' ? 'مهتم' : 'استفسار'),
      STATUS_CONFIG[l.status || 'new']?.label || 'جديد',
      `"${csvSafe(l.notes || '')}"`,
      l.platform || 'telegram',
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `leads_${bot?.botName || 'bot'}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('تم تصدير ملف CSV بنجاح');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Responsive Styles Injection */}
      <style>{`
        .crm-desktop-view {
          display: block;
        }
        .crm-mobile-view {
          display: none;
        }
        @media (max-width: 960px) {
          .crm-desktop-view {
            display: none !important;
          }
          .crm-mobile-view {
            display: flex !important;
            flex-direction: column;
            gap: 12px;
          }
        }
        .crm-card-hover {
          transition: all 0.2s ease;
        }
        .crm-card-hover:hover {
          border-color: rgba(255, 255, 255, 0.15) !important;
          transform: translateY(-1px);
        }
        .crm-desktop-view tbody tr {
          transition: background 0.15s ease;
        }
        .crm-desktop-view tbody tr:hover {
          background: rgba(255, 255, 255, 0.028) !important;
        }
        .crm-desktop-view td, .crm-desktop-view th {
          vertical-align: middle;
        }
      `}</style>

      {/* Top Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
        {[
          {
            key: 'total', label: 'إجمالي العملاء', value: leads.length,
            color: '#10b981', bg: 'rgba(16, 185, 129, 0.12)', border: 'rgba(16, 185, 129, 0.28)',
            icon: <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
          },
          {
            key: 'hot', label: 'ساخنون — أولوية قصوى', value: hotCount,
            color: '#ef4444', bg: 'rgba(239, 68, 68, 0.12)', border: 'rgba(239, 68, 68, 0.3)',
            icon: <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 3z"/></svg>,
          },
          {
            key: 'contacted', label: 'تم التواصل والمتابعة', value: contactedCount,
            color: '#34d399', bg: 'rgba(59, 130, 246, 0.12)', border: 'rgba(59, 130, 246, 0.28)',
            icon: <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><polyline points="20 6 9 17 4 12"/></svg>,
          },
        ].map(card => (
          <div key={card.key} style={{
            background: 'var(--bg-deep)', padding: '1.05rem 1.15rem', borderRadius: '14px',
            border: `1px solid ${card.border}`,
            display: 'flex', alignItems: 'center', gap: '14px',
          }}>
            <div style={{
              width: '44px', height: '44px', borderRadius: '12px', flexShrink: 0,
              background: card.bg, border: `1px solid ${card.border}`, color: card.color,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {card.icon}
            </div>
            <div>
              <div style={{ fontSize: '1.55rem', fontWeight: 900, color: 'var(--text-primary)', lineHeight: 1.15 }}>
                {card.value}
              </div>
              <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                {card.label}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Clean Control & Filter Bar */}
      <div className="card" style={{ padding: '0.9rem 1.1rem', background: 'var(--bg-deep)', border: '1px solid var(--border-default)', borderRadius: '14px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
          {/* Segmented filter pills */}
          <div style={{ display: 'flex', background: 'var(--bg-inset)', border: '1px solid var(--border-default)', borderRadius: '10px', padding: '3px', gap: '3px' }}>
            <button
              type="button"
              onClick={() => setHotOnly(false)}
              style={{
                padding: '0.38rem 0.9rem',
                borderRadius: '8px',
                fontSize: '0.8rem',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.15s',
                border: 'none',
                background: !hotOnly ? 'rgba(16, 185, 129, 0.18)' : 'transparent',
                color: !hotOnly ? '#34d399' : 'var(--text-secondary)',
              }}
            >
              الكل ({leads.length})
            </button>
            <button
              type="button"
              onClick={() => setHotOnly(true)}
              style={{
                padding: '0.38rem 0.9rem',
                borderRadius: '8px',
                fontSize: '0.8rem',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.15s',
                border: 'none',
                background: hotOnly ? 'rgba(239, 68, 68, 0.18)' : 'transparent',
                color: hotOnly ? '#f87171' : 'var(--text-secondary)',
              }}
            >
              الساخنون ({hotCount})
            </button>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
            {[
              { key: 'all', label: 'الكل' },
              { key: 'new', label: 'جديد' },
              { key: 'contacted', label: 'تم التواصل' },
              { key: 'qualified', label: 'مؤهل' },
              { key: 'converted', label: `محوّلين (${convertedCount})` },
              { key: 'lost', label: 'ملغي' },
            ].map(chip => {
              const active = chip.key === 'converted' ? convertedView : (!convertedView && statusFilter === chip.key);
              return (
                <button
                  key={chip.key}
                  type="button"
                  onClick={() => {
                    if (chip.key === 'converted') { setConvertedView(v => !v); setStatusFilter('all'); }
                    else { setConvertedView(false); setStatusFilter(chip.key); }
                  }}
                  style={{
                    padding: '0.38rem 0.9rem',
                    borderRadius: '999px',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    border: active ? '1px solid rgba(16, 185, 129, 0.45)' : '1px solid var(--border-subtle)',
                    background: active ? 'rgba(16, 185, 129, 0.16)' : 'var(--bg-inset)',
                    color: active ? '#34d399' : 'var(--text-secondary)',
                  }}
                >
                  {chip.label}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={exportCSV}
            style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '0.4rem 0.85rem', borderRadius: '10px', minHeight: '38px', fontSize: '0.8rem' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            <span>Excel</span>
          </button>

          {/* Search — fills the remaining width, wraps to its own row on narrow screens */}
          <div style={{ position: 'relative', flex: '1 1 240px', minWidth: '220px' }}>
            <div style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)', pointerEvents: 'none' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            </div>
            <input
              type="text"
              className="form-input"
              placeholder="بحث بالاسم، الهاتف، أو الخدمة..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                paddingRight: '2.3rem',
                minHeight: '38px',
                fontSize: '0.86rem',
                background: 'var(--bg-inset)',
                borderRadius: '10px',
                border: '1px solid var(--border-default)',
              }}
            />
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {filteredLeads.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3.5rem 1.5rem', background: 'var(--bg-deep)', border: '1px solid var(--border-default)', borderRadius: '14px' }}>
          <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.25)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          </div>
          <p style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
            {search || statusFilter !== 'all' || hotOnly ? 'لا توجد نتائج مطابقة لفلتر البحث' : 'لا يوجد عملاء محتملين مسجلين بعد'}
          </p>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', maxWidth: '420px', margin: '0 auto', lineHeight: 1.6 }}>
            يقوم مساعد الذكاء الاصطناعي تلقائياً بالتعرف على العملاء المهتمين أثناء المحادثات واستخراج بياناتهم وخدماتهم المطلوبة وحفظها هنا.
          </p>
        </div>
      ) : (
        <>
          {/* DESKTOP TABLE VIEW (Screens >= 960px) */}
          <div className="crm-desktop-view card" style={{ padding: 0, overflow: 'hidden', background: 'var(--bg-deep)', border: '1px solid var(--border-default)', borderRadius: '14px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.86rem', textAlign: 'right' }}>
              <thead>
                <tr style={{ background: 'var(--bg-inset)', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '0.7rem 1rem', fontWeight: 800, fontSize: '0.76rem' }}>العميل</th>
                  <th style={{ padding: '0.7rem 1rem', fontWeight: 800, fontSize: '0.76rem' }}>الهاتف والتواصل</th>
                  <th style={{ padding: '0.7rem 1rem', fontWeight: 800, fontSize: '0.76rem' }}>الخدمة المطلوبة</th>
                  <th style={{ padding: '0.7rem 1rem', fontWeight: 800, fontSize: '0.76rem' }}>الميزانية</th>
                  <th style={{ padding: '0.7rem 1rem', fontWeight: 800, fontSize: '0.76rem' }}>التقييم</th>
                  <th style={{ padding: '0.7rem 1rem', fontWeight: 800, fontSize: '0.76rem' }}>حالة المتابعة</th>
                  <th style={{ padding: '0.7rem 1rem', fontWeight: 800, fontSize: '0.76rem' }}>التاريخ</th>
                  <th style={{ padding: '0.9rem 1.15rem', textAlign: 'center', fontWeight: 800, fontSize: '0.78rem' }}>إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filteredLeads.map((lead) => {
                  const statusConf = STATUS_CONFIG[lead.status || 'new'] || STATUS_CONFIG.new;
                  const prioConf = PRIORITY_CONFIG[lead.leadStatus] || PRIORITY_CONFIG.warm;
                  const cleanPhone = getCleanPhone(lead.phone);
                  const customerName = lead.customerName || lead.name || 'عميل';
                  const firstChar = customerName.trim().charAt(0).toUpperCase() || 'ع';
                  const isHot = lead.leadStatus === 'hot';

                  return (
                    <tr
                      key={lead.id}
                      style={{
                        borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                        transition: 'background 0.15s ease',
                        background: isHot ? 'rgba(239, 68, 68, 0.02)' : 'transparent',
                      }}
                    >
                      {/* Customer Name & Platform */}
                      <td style={{ padding: '0.7rem 1rem' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', whiteSpace: 'nowrap' }}>
                          <div style={{
                            width: '34px',
                            height: '34px',
                            borderRadius: '8px',
                            background: isHot ? 'rgba(239, 68, 68, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                            border: `1px solid ${isHot ? 'rgba(239, 68, 68, 0.3)' : 'var(--border-subtle)'}`,
                            color: isHot ? '#f87171' : '#60a5fa',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 800,
                            fontSize: '0.88rem',
                            flexShrink: 0,
                          }}>
                            {firstChar}
                          </div>
                          <div>
                            <div style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span>{customerName}</span>
                              <span style={{
                                fontSize: '0.66rem',
                                padding: '1px 5px',
                                borderRadius: '5px',
                                background: lead.platform === 'telegram' ? 'rgba(0, 136, 204, 0.15)' : 'rgba(34, 197, 94, 0.15)',
                                color: lead.platform === 'telegram' ? '#38bdf8' : '#4ade80',
                                border: `1px solid ${lead.platform === 'telegram' ? 'rgba(0, 136, 204, 0.3)' : 'rgba(34, 197, 94, 0.3)'}`,
                                fontWeight: 700,
                              }}>
                                {lead.platform === 'telegram' ? 'TG' : 'WA'}
                              </span>
                            </div>
                            {lead.company && (
                              <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                                {lead.company}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Phone & Contact Buttons */}
                      <td style={{ padding: '0.7rem 1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span
                            onClick={() => copyPhone(lead.phone)}
                            style={{
                              fontFamily: 'monospace',
                              color: 'var(--text-primary)',
                              fontWeight: 700,
                              fontSize: '0.84rem',
                              background: 'var(--veil-1)',
                              padding: '2px 6px',
                              borderRadius: '6px',
                              border: '1px solid rgba(59, 130, 246, 0.2)',
                              cursor: lead.phone ? 'pointer' : 'default',
                            }}
                            title="انقر لنسخ الرقم"
                          >
                            {lead.phone || '—'}
                          </span>
                          {cleanPhone && lead.platform !== 'telegram' && (
                            <div style={{ display: 'flex', gap: '4px' }}>
                              <a
                                href={getWhatsAppLink(lead)}
                                target="_blank"
                                rel="noreferrer"
                                title="مراسلة واتساب"
                                style={{
                                  width: '26px',
                                  height: '26px',
                                  borderRadius: '6px',
                                  background: 'rgba(34, 197, 94, 0.15)',
                                  color: '#22c55e',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  textDecoration: 'none',
                                  border: '1px solid rgba(34, 197, 94, 0.3)',
                                }}
                              >
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
                              </a>
                              <a
                                href={`tel:${cleanPhone}`}
                                title="اتصال مباشر"
                                style={{
                                  width: '26px',
                                  height: '26px',
                                  borderRadius: '6px',
                                  background: 'var(--veil-1)',
                                  color: 'var(--text-secondary)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  textDecoration: 'none',
                                  border: '1px solid var(--border-subtle)',
                                }}
                              >
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                              </a>
                                                            {lead.platform === 'telegram' && (
                                <button
                                  type="button"
                                  onClick={() => onOpenChat(lead.customerId)}
                                  title="افتح المحادثة في صندوق الرسائل"
                                  style={{
                                    width: '13px',
                                    height: '13px',
                                    borderRadius: '8px',
                                    background: 'rgba(56, 189, 248, 0.15)',
                                    color: '#38bdf8',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                    border: '1px solid rgba(56, 189, 248, 0.3)',
                                  }}
                                >
                                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Service & Notes */}
                      <td style={{ padding: '0.7rem 1rem', maxWidth: '280px' }}>
                        <div style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: '0.86rem' }}>
                          {lead.service || '—'}
                        </div>
                        {lead.notes && (
                          <div
                            style={{
                              fontSize: '0.74rem',
                              color: 'var(--text-secondary)',
                              marginTop: '3px',
                              background: 'var(--veil-1)',
                              padding: '2px 6px',
                              borderRadius: '5px',
                              display: 'inline-block',
                              maxWidth: '100%',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                            title={lead.notes}
                          >
                            {lead.notes}
                          </div>
                        )}
                      </td>

                      {/* Budget */}
                      <td style={{ padding: '0.7rem 1rem' }}>
                        {lead.budget ? (
                          <span style={{
                            display: 'inline-block',
                            padding: '2px 9px',
                            borderRadius: '8px',
                            background: 'rgba(16, 185, 129, 0.1)',
                            border: '1px solid rgba(16, 185, 129, 0.3)',
                            color: '#10b981',
                            fontWeight: 800,
                            fontSize: '0.8rem',
                            whiteSpace: 'nowrap',
                          }}>
                            {lead.budget} {bot?.currency || 'دج'}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-tertiary)' }}>—</span>
                        )}
                      </td>

                      {/* AI Evaluation */}
                      <td style={{ padding: '0.7rem 1rem' }}>
                        <span
                          title={prioConf.hint}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            padding: '3px 8px',
                            borderRadius: '16px',
                            fontSize: '0.74rem',
                            fontWeight: 800,
                            background: prioConf.bg,
                            color: prioConf.color,
                            border: `1px solid ${prioConf.border}`,
                          }}
                        >
                          <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: prioConf.dot }}></span>
                          <span>{prioConf.label}</span>
                        </span>
                      </td>

                      {/* Status Selector */}
                      <td style={{ padding: '0.7rem 1rem' }}>
                        <select
                          className="form-select"
                          value={lead.status || 'new'}
                          disabled={updatingId === lead.id}
                          onChange={(e) => handleStatusChange(lead.id, e.target.value)}
                          style={{
                            fontSize: '0.74rem',
                            padding: '3px 8px',
                            borderRadius: '8px',
                            background: statusConf.bg,
                            color: statusConf.color,
                            border: `1px solid ${statusConf.border}`,
                            fontWeight: 800,
                            cursor: updatingId === lead.id ? 'wait' : 'pointer',
                          }}
                        >
                          <option value="new" style={{ background: 'var(--bg-deep)', color: '#60a5fa' }}>جديد</option>
                          <option value="contacted" style={{ background: 'var(--bg-deep)', color: '#facc15' }}>تم التواصل</option>
                          <option value="qualified" style={{ background: 'var(--bg-deep)', color: '#c084fc' }}>مؤهل</option>
                          <option value="closed" style={{ background: 'var(--bg-deep)', color: '#4ade80' }}>تم التعاقد</option>
                          <option value="lost" style={{ background: 'var(--bg-deep)', color: '#f87171' }}>ملغي</option>
                        </select>
                      </td>

                      {/* Date */}
                      <td style={{ padding: '0.7rem 1rem', fontSize: '0.72rem', color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>
                        {lead.createdAt ? new Date(lead.createdAt).toLocaleDateString('ar-DZ') : '—'}
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '0.7rem 1rem', textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => setSelectedLead(lead)}
                            style={{ padding: '4px 8px', borderRadius: '7px', fontSize: '0.72rem', fontWeight: 700 }}
                            title="تفاصيل العميل"
                          >
                            تفاصيل
                          </button>

                          <button
                            type="button"
                            onClick={() => setDeleteTarget(lead)}
                            title="حذف"
                            style={{
                              width: '26px',
                              height: '26px',
                              borderRadius: '7px',
                              background: 'rgba(239, 68, 68, 0.1)',
                              border: '1px solid rgba(239, 68, 68, 0.3)',
                              color: '#f87171',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer',
                              transition: 'all 0.15s ease',
                            }}
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* MOBILE CARDS VIEW (Screens < 960px) */}
          <div className="crm-mobile-view">
            {filteredLeads.map((lead) => {
              const statusConf = STATUS_CONFIG[lead.status || 'new'] || STATUS_CONFIG.new;
              const prioConf = PRIORITY_CONFIG[lead.leadStatus] || PRIORITY_CONFIG.warm;
              const cleanPhone = getCleanPhone(lead.phone);
              const customerName = lead.customerName || lead.name || 'عميل';
              const firstChar = customerName.trim().charAt(0).toUpperCase() || 'ع';
              const isHot = lead.leadStatus === 'hot';

              return (
                <div
                  key={lead.id}
                  className="crm-card-hover"
                  style={{
                    background: 'var(--bg-deep)',
                    border: `1px solid ${isHot ? 'rgba(239, 68, 68, 0.25)' : 'rgba(255, 255, 255, 0.08)'}`,
                    borderRadius: '14px',
                    padding: '1.1rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                    textAlign: 'right',
                  }}
                >
                  {/* Card Header: Avatar, Name, Platform, Priority */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{
                        width: '38px',
                        height: '38px',
                        borderRadius: '10px',
                        background: isHot ? 'rgba(239, 68, 68, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                        border: `1px solid ${isHot ? 'rgba(239, 68, 68, 0.3)' : 'var(--border-subtle)'}`,
                        color: isHot ? '#f87171' : '#60a5fa',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 800,
                        fontSize: '0.95rem',
                        flexShrink: 0,
                      }}>
                        {firstChar}
                      </div>
                      <div>
                        <div style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span>{customerName}</span>
                          <span style={{
                            fontSize: '0.66rem',
                            padding: '1px 5px',
                            borderRadius: '4px',
                            background: lead.platform === 'telegram' ? 'rgba(0, 136, 204, 0.15)' : 'rgba(34, 197, 94, 0.15)',
                            color: lead.platform === 'telegram' ? '#38bdf8' : '#4ade80',
                            border: `1px solid ${lead.platform === 'telegram' ? 'rgba(0, 136, 204, 0.3)' : 'rgba(34, 197, 94, 0.3)'}`,
                            fontWeight: 700,
                          }}>
                            {lead.platform === 'telegram' ? 'Telegram' : 'WhatsApp'}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.74rem', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                          {lead.createdAt ? new Date(lead.createdAt).toLocaleDateString('ar-DZ') : '—'}
                          {lead.company && ` • ${lead.company}`}
                        </div>
                      </div>
                    </div>

                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        padding: '3px 8px',
                        borderRadius: '16px',
                        fontSize: '0.72rem',
                        fontWeight: 800,
                        background: prioConf.bg,
                        color: prioConf.color,
                        border: `1px solid ${prioConf.border}`,
                        flexShrink: 0,
                      }}
                    >
                      <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: prioConf.dot }}></span>
                      <span>{prioConf.label}</span>
                    </span>
                  </div>

                  {/* Service & Notes Box */}
                  <div style={{ background: 'var(--bg-inset)', padding: '0.75rem 0.9rem', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: lead.notes ? '4px' : '0' }}>
                      <span style={{ fontSize: '0.86rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                        {lead.service || 'استفسار عام'}
                      </span>
                      {lead.budget && (
                        <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#10b981' }}>
                          {lead.budget} {bot?.currency || 'دج'}
                        </span>
                      )}
                    </div>
                    {lead.notes && (
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                        {lead.notes}
                      </div>
                    )}
                  </div>

                  {/* Card Footer: Phone, WhatsApp, Status, Actions */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center', justifyContent: 'space-between', paddingTop: '4px' }}>
                    {/* Phone & Instant Contact */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span
                        onClick={() => copyPhone(lead.phone)}
                        style={{
                          fontFamily: 'monospace',
                          color: 'var(--text-primary)',
                          fontWeight: 700,
                          fontSize: '0.84rem',
                          background: 'var(--veil-1)',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          border: '1px solid rgba(59, 130, 246, 0.2)',
                          cursor: lead.phone ? 'pointer' : 'default',
                        }}
                        title="انقر للنسخ"
                      >
                        {lead.phone || '—'}
                      </span>

                      {cleanPhone && lead.platform !== 'telegram' && (
                        <>
                          <a
                            href={getWhatsAppLink(lead)}
                            target="_blank"
                            rel="noreferrer"
                            style={{
                              width: '30px',
                              height: '30px',
                              borderRadius: '8px',
                              background: 'rgba(34, 197, 94, 0.15)',
                              color: '#22c55e',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              textDecoration: 'none',
                              border: '1px solid rgba(34, 197, 94, 0.3)',
                            }}
                          >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
                          </a>
                          <a
                            href={`tel:${cleanPhone}`}
                            style={{
                              width: '30px',
                              height: '30px',
                              borderRadius: '8px',
                              background: 'var(--veil-1)',
                              color: 'var(--text-secondary)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              textDecoration: 'none',
                              border: '1px solid var(--border-subtle)',
                            }}
                          >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                          </a>
                                                    {lead.platform === 'telegram' && (
                            <button
                              type="button"
                              onClick={() => onOpenChat(lead.customerId)}
                              title="افتح المحادثة في صندوق الرسائل"
                              style={{
                                width: '15px',
                                height: '15px',
                                borderRadius: '8px',
                                background: 'rgba(56, 189, 248, 0.15)',
                                color: '#38bdf8',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                border: '1px solid rgba(56, 189, 248, 0.3)',
                              }}
                            >
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                            </button>
                          )}
                        </>
                      )}
                    </div>

                    {/* Status & Details */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <select
                        className="form-select"
                        value={lead.status || 'new'}
                        disabled={updatingId === lead.id}
                        onChange={(e) => handleStatusChange(lead.id, e.target.value)}
                        style={{
                          fontSize: '0.76rem',
                          padding: '4px 8px',
                          borderRadius: '8px',
                          background: statusConf.bg,
                          color: statusConf.color,
                          border: `1px solid ${statusConf.border}`,
                          fontWeight: 800,
                          cursor: 'pointer',
                          minHeight: '30px',
                        }}
                      >
                        <option value="new" style={{ background: 'var(--bg-deep)', color: '#60a5fa' }}>جديد</option>
                        <option value="contacted" style={{ background: 'var(--bg-deep)', color: '#facc15' }}>تم التواصل</option>
                        <option value="qualified" style={{ background: 'var(--bg-deep)', color: '#c084fc' }}>مؤهل</option>
                        <option value="closed" style={{ background: 'var(--bg-deep)', color: '#4ade80' }}>تعاقد</option>
                        <option value="lost" style={{ background: 'var(--bg-deep)', color: '#f87171' }}>ملغي</option>
                      </select>

                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => setSelectedLead(lead)}
                        style={{ padding: '4px 8px', borderRadius: '8px', fontSize: '0.76rem', fontWeight: 700 }}
                      >
                        تفاصيل
                      </button>

                      <button
                        type="button"
                        onClick={() => setDeleteTarget(lead)}
                        title="حذف"
                        style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '7px',
                          background: 'rgba(239, 68, 68, 0.1)',
                          border: '1px solid rgba(239, 68, 68, 0.3)',
                          color: '#f87171',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                        }}
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Selected Lead Details Modal */}
      {selectedLead && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.25rem',
          }}
          onClick={() => setSelectedLead(null)}
        >
          <div
            style={{
              background: 'var(--bg-deep)',
              border: '1px solid var(--border-bright)',
              borderRadius: '18px',
              maxWidth: '520px',
              width: '100%',
              padding: '1.5rem',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.6)',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.15rem',
              textAlign: 'right',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '0.85rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '10px',
                  background: 'rgba(16, 185, 129, 0.15)',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  color: '#10b981',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 900,
                  fontSize: '1rem',
                }}>
                  {(selectedLead.customerName || selectedLead.name || 'ع').charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    {selectedLead.customerName || selectedLead.name || 'عميل محتمل'}
                  </h3>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    {selectedLead.platform === 'telegram' ? 'Telegram' : 'WhatsApp'} • {selectedLead.createdAt ? new Date(selectedLead.createdAt).toLocaleString('ar-DZ') : ''}
                  </div>
                </div>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setSelectedLead(null)}
                style={{ borderRadius: '8px', color: 'var(--text-secondary)' }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            {/* Contact Actions Bar */}
            <div style={{ background: 'var(--bg-inset)', padding: '0.85rem 1rem', borderRadius: '10px', border: '1px solid var(--border-subtle)', display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: '2px' }}>رقم الهاتف</div>
                <div style={{ fontSize: '0.98rem', fontWeight: 800, color: '#34d399', fontFamily: 'monospace' }}>
                  {selectedLead.phone || 'غير محدد'}
                </div>
              </div>

              {selectedLead.phone && (
                <div style={{ display: 'flex', gap: '6px' }}>
                  <a
                    href={getWhatsAppLink(selectedLead)}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-success btn-sm"
                    style={{ display: 'flex', alignItems: 'center', gap: '5px', borderRadius: '6px', padding: '0.4rem 0.75rem', fontSize: '0.78rem' }}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
                    <span>واتساب</span>
                  </a>
                  <a
                    href={`tel:${getCleanPhone(selectedLead.phone)}`}
                    className="btn btn-secondary btn-sm"
                    style={{ display: 'flex', alignItems: 'center', gap: '5px', borderRadius: '6px', padding: '0.4rem 0.75rem', fontSize: '0.78rem' }}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                    <span>اتصال</span>
                  </a>
                </div>
              )}
            </div>

            {/* Service & Notes Details */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ background: 'var(--bg-inset)', padding: '0.85rem 1rem', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: '3px' }}>الخدمة أو الموعد المطلوب</div>
                <div style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  {selectedLead.service || 'غير محدد'}
                </div>
              </div>

              {selectedLead.notes && (
                <div style={{ background: 'var(--bg-inset)', padding: '0.85rem 1rem', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: '3px' }}>الملاحظات المستخرجة بالذكاء الاصطناعي</div>
                  <div style={{ fontSize: '0.84rem', color: 'var(--text-primary)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                    {selectedLead.notes}
                  </div>
                </div>
              )}

              {selectedLead.budget && (
                <div style={{ background: 'var(--bg-inset)', padding: '0.85rem 1rem', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: '3px' }}>الميزانية المقترحة</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#10b981' }}>
                    {selectedLead.budget} {bot?.currency || 'دج'}
                  </div>
                </div>
              )}
            </div>

            {/* Status Switcher in Modal */}
            <div>
              <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>تغيير حالة المتابعة:</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                {Object.entries(STATUS_CONFIG).map(([stKey, stVal]) => (
                  <button
                    key={stKey}
                    type="button"
                    onClick={() => handleStatusChange(selectedLead.id, stKey)}
                    style={{
                      padding: '5px 10px',
                      borderRadius: '6px',
                      fontSize: '0.74rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                      background: (selectedLead.status || 'new') === stKey ? stVal.bg : 'var(--bg-deep)',
                      color: (selectedLead.status || 'new') === stKey ? stVal.color : 'var(--text-secondary)',
                      border: `1px solid ${(selectedLead.status || 'new') === stKey ? stVal.border : 'rgba(255, 255, 255, 0.08)'}`,
                    }}
                  >
                    {stVal.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '0.85rem' }}>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => { setSelectedLead(null); setDeleteTarget(selectedLead); }}
                style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.78rem' }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                <span>حذف العميل</span>
              </button>

              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setSelectedLead(null)}
                style={{ borderRadius: '6px', fontSize: '0.78rem' }}
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="modal-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px', textAlign: 'center' }}>
            <div style={{
              width: '52px', height: '52px', borderRadius: '14px', margin: '0 auto 0.9rem',
              background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.35)',
              color: '#f87171', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
            </div>
            <h3 className="modal-title" style={{ marginBottom: '0.4rem' }}>حذف العميل نهائياً؟</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.84rem', lineHeight: 1.6, marginBottom: '1.15rem' }}>
              سيُحذف «{(deleteTarget.customerName || deleteTarget.name || 'عميل')}» وجميع بياناته من سجل العملاء — لا يمكن التراجع عن هذه الخطوة.
            </p>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setDeleteTarget(null)}>
                إلغاء
              </button>
              <button type="button" className="btn btn-danger" onClick={() => handleDelete(deleteTarget.id)}>
                حذف نهائي
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Component: Google Sheets & Webhook Hub Tab ───────────────
function GoogleSheetsTab({ bot, onUpdateBot }) {
  const toast = useToast();
  const [webhookUrl, setWebhookUrl] = useState(bot?.googleSheetsWebhookUrl || bot?.webhookUrl || '');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [copied, setCopied] = useState(false);

  const APPS_SCRIPT_CODE = `function doPost(e) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    var data = JSON.parse(e.postData.contents);
    
    // إنشاء عناوين الأعمدة تلقائياً إذا كان الجدول فارغاً
    if (sheet.getLastRow() === 0) {
      sheet.appendRow([
        "التاريخ والوقت",
        "النوع",
        "كود التتبع / المعرف",
        "اسم العميل",
        "الهاتف",
        "المنتج / الخدمة",
        "السعر / الميزانية",
        "العنوان / الشركة",
        "درجة الاهتمام / الملاحظات",
        "المنصة"
      ]);
      // تنسيق السطر الأول بلون مميز
      sheet.getRange(1, 1, 1, 10).setFontWeight("bold").setBackground("#1e293b").setFontColor("#ffffff");
    }
    
    var statusOrNotes = "-";
    if (data.event === "new_lead") {
      var prio = data.leadStatus === "hot" ? "ساخن (أولوية)" : (data.leadStatus === "warm" ? "مهتم" : "عادي");
      statusOrNotes = prio + (data.notes && data.notes !== "-" ? " — " + data.notes : "");
    } else if (data.notes && data.notes !== "-") {
      statusOrNotes = data.notes;
    }

    var tracking = data.trackingCode || data.leadId || data.orderId || "-";
    var row = [
      new Date().toLocaleString("ar-DZ", { timeZone: "Africa/Algiers" }),
      data.event === "new_order" ? (data.isUpdate ? "تعديل/دمج طلبية" : "طلبية شراء") : (data.event === "new_lead" ? "عميل محتمل (Lead)" : "اختبار مزامنة"),
      tracking,
      data.customerName || "-",
      data.phone || "-",
      data.product || data.service || "-",
      data.price || data.budget || "-",
      data.address || data.company || "-",
      statusOrNotes,
      data.platform || "whatsapp"
    ];
    
    // فحص ما إذا كان كود التتبع موجوداً مسبقاً لتحديث نفس السطر ومنع التكرار
    var updated = false;
    if (tracking !== "-" && sheet.getLastRow() > 1) {
      var dataRange = sheet.getRange(2, 3, sheet.getLastRow() - 1, 1).getValues();
      for (var i = 0; i < dataRange.length; i++) {
        if (String(dataRange[i][0]).trim().toUpperCase() === String(tracking).trim().toUpperCase()) {
          sheet.getRange(i + 2, 1, 1, 10).setValues([row]);
          updated = true;
          break;
        }
      }
    }

    if (!updated) {
      sheet.appendRow(row);
    }

    return ContentService.createTextOutput(JSON.stringify({ status: "success", updated: updated, rowAdded: !updated }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}`;

  const handleSave = async (e) => {
    e?.preventDefault();
    setSaving(true);
    try {
      await onUpdateBot({
        googleSheetsWebhookUrl: webhookUrl.trim(),
      });
      toast.success('تم حفظ رابط Google Sheets بنجاح');
    } catch (err) {
      toast.error('فشل الحفظ: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleTestSync = async () => {
    const url = webhookUrl.trim();
    if (!url) {
      toast.error('يرجى إدخال رابط Webhook أولاً');
      return;
    }

    setTesting(true);
    try {
      const headers = await engineHeaders(true);
      const endpoint = `${engineUrlFor(bot?.platform)}/api/sheets/test-sync`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          botId: bot.id,
          webhookUrl: url,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success('تم إرسال سطر تجريبي بنجاح! تفقد جدول Google Sheets الخاص بك');
      } else {
        throw new Error(data.error || 'فشل الاتصال بالرابط');
      }
    } catch (err) {
      toast.error('فشل الاختبار: ' + err.message);
    } finally {
      setTesting(false);
    }
  };

  const copyScript = () => {
    navigator.clipboard.writeText(APPS_SCRIPT_CODE);
    setCopied(true);
    toast.success('تم نسخ الكود البرمجي بنجاح');
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Header Banner */}
      <div className="card" style={{ padding: '1.5rem', background: 'var(--bg-deep)', border: '1px solid var(--border-default)' }}>
        <h3 style={{ fontSize: '1.18rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/></svg>
          <span>المزامنة التلقائية مع Google Sheets</span>
        </h3>
        <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', margin: '6px 0 0 0', lineHeight: 1.6 }}>
          اربط هذا البوت بجدول Google Sheets الخاص بك لتسجيل كل طلبية شراء جديدة وكل عميل محتمل (Lead) في شيت منظم بشكل لحظي ودون الحاجة لأي خدمات وسيطة مدفوعة.
        </p>
      </div>

      {/* Webhook Configuration Form */}
      <div className="card" style={{ padding: '1.5rem', background: 'var(--bg-deep)', border: '1px solid var(--border-default)' }}>
        <form onSubmit={handleSave}>
          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>
              رابط Google Apps Script Webhook URL
            </label>
            <input
              type="url"
              className="form-input"
              placeholder="https://script.google.com/macros/s/.../exec"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              style={{
                direction: 'ltr',
                textAlign: 'left',
                fontFamily: 'monospace',
                fontSize: '0.86rem',
                minHeight: '48px',
                background: 'var(--bg-inset)',
                borderRadius: '10px',
              }}
            />
            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '6px 0 0 0' }}>
              الرابط الذي تحصل عليه عند نشر السكريبت كـ Web App من داخل Google Sheets.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={saving}
              style={{ minHeight: '42px', padding: '0.5rem 1.25rem', borderRadius: '10px', fontWeight: 700 }}
            >
              {saving ? 'جارٍ الحفظ...' : 'حفظ الإعدادات'}
            </button>

            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleTestSync}
              disabled={testing || !webhookUrl.trim()}
              style={{ minHeight: '42px', padding: '0.5rem 1.25rem', borderRadius: '10px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              <span>{testing ? 'جارٍ إرسال الاختبار...' : 'إرسال اختبار فوري للجدول'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Code Snippet Box */}
      <div className="card" style={{ padding: '1.5rem', background: 'var(--bg-deep)', border: '1px solid var(--border-default)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div>
            <h4 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              الكود البرمجي الجاهز لـ Google Apps Script
            </h4>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
              انسخ هذا الكود والصقه داخل محرر السكريبت في Google Sheets (Extensions ← Apps Script).
            </p>
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={copyScript}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', borderRadius: '8px' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            <span>{copied ? 'تم النسخ!' : 'نسخ الكود'}</span>
          </button>
        </div>

        <pre
          style={{
            background: 'var(--bg-app)',
            border: '1px solid var(--border-default)',
            borderRadius: '10px',
            padding: '1rem',
            color: '#93c5fd',
            fontFamily: 'monospace',
            fontSize: '0.78rem',
            lineHeight: 1.6,
            maxHeight: '320px',
            overflowY: 'auto',
            direction: 'ltr',
            textAlign: 'left',
          }}
        >
          <code>{APPS_SCRIPT_CODE}</code>
        </pre>
      </div>

      {/* Step by Step Setup Instructions */}
      <div className="card" style={{ padding: '1.5rem', background: 'var(--bg-deep)', border: '1px solid var(--border-default)' }}>
        <h4 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 14 14"/></svg>
          <span>خطوات الربط في دقيقتين</span>
        </h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
          <div style={{ background: 'var(--bg-inset)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
            <strong style={{ color: '#34d399', display: 'block', marginBottom: '6px', fontSize: '0.88rem' }}>1. أنشئ الشيت</strong>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6 }}>
              افتح Google Sheets وأنشئ جدولاً جديداً بأي اسم تريده.
            </p>
          </div>
          <div style={{ background: 'var(--bg-inset)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
            <strong style={{ color: '#10b981', display: 'block', marginBottom: '6px', fontSize: '0.88rem' }}>2. افتح Apps Script</strong>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6 }}>
              من القائمة العلوية اضغط على <strong>الإضافات (Extensions)</strong> ثم <strong>Apps Script</strong>.
            </p>
          </div>
          <div style={{ background: 'var(--bg-inset)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
            <strong style={{ color: '#facc15', display: 'block', marginBottom: '6px', fontSize: '0.88rem' }}>3. الصق الكود</strong>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6 }}>
              امسح الكود الافتراضي والصق الكود الموجود في الأعلى واضغط حفظ.
            </p>
          </div>
          <div style={{ background: 'var(--bg-inset)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
            <strong style={{ color: '#c084fc', display: 'block', marginBottom: '6px', fontSize: '0.88rem' }}>4. نشر كتطبيق ويب</strong>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6 }}>
              اضغط <strong>Deploy</strong> ثم <strong>New deployment</strong> واختر <strong>Web app</strong>، واجعل من يملك الإذن: <strong>Anyone</strong>.
            </p>
          </div>
          <div style={{ background: 'var(--bg-inset)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
            <strong style={{ color: '#38bdf8', display: 'block', marginBottom: '6px', fontSize: '0.88rem' }}>5. الصق الرابط واختبر</strong>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6 }}>
              انسخ الرابط الناتج والصقه في الخانة أعلاه واضغط "إرسال اختبار فوري".
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
