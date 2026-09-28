import React, { useState, useEffect } from 'react';
import TelegramPhoneMockup from './TelegramPhoneMockup';
import StoreIcon, { stripEmojis } from './StoreIcons';
import StoreIconPicker from './StoreIconPicker';
import { useToast } from '../../context/ToastContext';
import { useNavigate } from 'react-router-dom';
import {
  SlidersHorizontal,
  Megaphone,
  Settings,
  Sparkles,
  CheckCircle2,
  XCircle,
  Plus,
  ArrowUp,
  ArrowDown,
  Trash2,
  Pencil,
  X,
  ShoppingBag,
  Folder,
  CreditCard,
  FileText,
  LayoutGrid,
  Menu,
  Command,
  ExternalLink,
  Save,
  Image,
  MessageSquare,
  HelpCircle,
  Check,
  Headphones,
  Gamepad2,
  Smartphone,
  Clock,
  Coins,
  DollarSign,
} from 'lucide-react';

// Default dynamic payment methods
export const DEFAULT_PAYMENT_METHODS = [
  {
    id: 'binance',
    name: '🔸 الدفع عبر Binance',
    details: 'معرف الدفع (Binance Pay ID): 123456789\nأو تحويل USDT على شبكة BEP20:\n0x1234567890abcdef1234567890abcdef12345678',
    enabled: true,
  },
  {
    id: 'baridimob',
    name: '💳 بريدي موب (BaridiMob)',
    details: 'RIP: 00799999000123456789\nالاسم: MOHAMED ALGERIA',
    enabled: true,
  },
  {
    id: 'ccp',
    name: '📬 الحساب البريدي الجاري (CCP)',
    details: 'رقم الحساب: 1234567 مفتاح 89\nالاسم: محمد الجزائري',
    enabled: true,
  },
  {
    id: 'usdt',
    name: '₮ العملات الرقمية USDT (TRC20)',
    details: 'العنوان: TXYz1234567890abcdef1234567890abcdef\nالشبكة: TRC20 (Tron)',
    enabled: false,
  },
];

export function parsePaymentMethods(storeConfig) {
  if (!storeConfig) return DEFAULT_PAYMENT_METHODS;
  if (storeConfig.paymentMethodsJson) {
    try {
      const parsed = JSON.parse(storeConfig.paymentMethodsJson);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch { /* fallback */ }
  }
  if (Array.isArray(storeConfig.paymentMethods) && storeConfig.paymentMethods.length > 0) {
    return storeConfig.paymentMethods;
  }
  return DEFAULT_PAYMENT_METHODS;
}

// 1-Click Templates
export const STORE_TEMPLATES = {
  subscriptions: {
    name: 'متجر اشتراكات وتطبيقات رقمية',
    bannerUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80',
    welcomeMessage: 'مرحباً بك في متجر الاشتراكات الرقمية!\nاختر الخدمة أو الباقة لتأكيد اشتراكك فوراً وبأفضل الأسعار:',
    walletInfo: 'طرق الدفع والشحن المتوفرة:\n• بريدي موب (BaridiMob): 00799999000123456789\n• الحساب الجاري (CCP): 1234567 مفتاح 89\n\nملاحظة: بعد التحويل، أرسل صورة وصل الدفع هنا في المحادثة مباشرة ليتم التحقق والتسليم الفوري!',
    rulesText: 'شروط وضمان المتجر:\n1. جميع الحسابات أصلية ومضمونة طوال مدة الاشتراك.\n2. التسليم يتم تلقائياً وفورياً بعد مراجعة الوصل.\n3. الدعم الفني متوفر على مدار الساعة لحل أي مشكلة.',
    rows: [
      [
        { id: 'b_1', text: 'Gemini Advanced 18 Months - 1500 دج', icon: 'gem', action: 'product', productPrice: '1500' },
      ],
      [
        { id: 'b_2', text: 'Spotify Premium 3M - 800 دج', icon: 'headphones', action: 'product', productPrice: '800' },
      ],
      [
        { id: 'b_3', text: 'Duolingo Super 12M - 990 دج', icon: 'sparkles', action: 'product', productPrice: '990' },
      ],
      [
        { id: 'b_4', text: 'تصفح كل الخدمات', icon: 'shopping-bag', action: 'submenu', subButtons: [
          [
            { id: 'sub_1', text: 'ChatGPT Plus 1M - 2500 دج', icon: 'bot', action: 'product', productPrice: '2500' },
          ],
          [
            { id: 'sub_2', text: 'Netflix 4K Ultra - 1200 دج', icon: 'film', action: 'product', productPrice: '1200' },
          ],
        ]},
        { id: 'b_5', text: 'شحن الرصيد', icon: 'credit-card', action: 'wallet' },
      ],
      [
        { id: 'b_6', text: 'قناة الإثباتات واللوغز', icon: 'megaphone', action: 'url', url: 'https://t.me/' },
        { id: 'b_7', text: 'قوانين البيع والضمان', icon: 'file-text', action: 'rules' },
      ],
    ],
  },
  gaming: {
    name: 'متجر شحن ألعاب وبطاقات',
    bannerUrl: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=800&auto=format&fit=crop&q=80',
    welcomeMessage: 'مرحباً بك في متجر شحن الألعاب الرسمي!\nاختر لعبتك المفضلة لشحن الجواهر والشدات بأسرع وقت:',
    walletInfo: 'شحن الرصيد:\n• الدفع عبر BaridiMob أو فليكسي\n• يرجى إرسال ID الحساب بعد الدفع للشحن الفوري!',
    rulesText: '1. الشحن يتم عبر الـ ID الرسمي للحساب.\n2. مدة الشحن من دقيقة إلى 10 دقائق كحد أقصى.',
    rows: [
      [
        { id: 'g_1', text: 'شحن Free Fire (جواهر فورية)', icon: 'flame', action: 'submenu', subButtons: [
          [{ id: 'ff_1', text: '100+10 جوهرة - 250 دج', icon: 'gem', action: 'product', productPrice: '250' }],
          [{ id: 'ff_2', text: '520 جوهرة - 1100 دج', icon: 'gem', action: 'product', productPrice: '1100' }],
          [{ id: 'ff_3', text: 'بطاقة عضوية أسبوعية - 500 دج', icon: 'credit-card', action: 'product', productPrice: '500' }],
        ]},
      ],
      [
        { id: 'g_2', text: 'شحن PUBG Mobile (شدات UC)', icon: 'zap', action: 'submenu', subButtons: [
          [{ id: 'pb_1', text: '60 UC شدة - 220 دج', icon: 'zap', action: 'product', productPrice: '220' }],
          [{ id: 'pb_2', text: '325 UC شدة - 1050 دج', icon: 'zap', action: 'product', productPrice: '1050' }],
          [{ id: 'pb_3', text: '660 UC رويال باس - 2100 دج', icon: 'star', action: 'product', productPrice: '2100' }],
        ]},
      ],
      [
        { id: 'g_3', text: 'طرق الدفع والشحن', icon: 'credit-card', action: 'wallet' },
        { id: 'g_4', text: 'إثباتات الشحن المباشرة', icon: 'megaphone', action: 'url', url: 'https://t.me/' },
      ],
    ],
  },
};

// Helper to safely parse rows from Firestore without nested array issues
export function parseStoreRows(storeConfig) {
  if (!storeConfig) return [];
  if (storeConfig.rowsJson) {
    try {
      const parsed = JSON.parse(storeConfig.rowsJson);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch { /* fallback */ }
  }
  if (Array.isArray(storeConfig.rows)) {
    if (storeConfig.rows.length > 0 && Array.isArray(storeConfig.rows[0])) {
      return storeConfig.rows;
    }
  }
  return [];
}

// Helper to safely serialize rows for Firestore (Firestore strictly rejects nested arrays [[...]])
export function serializeStoreRowsForFirestore(rows) {
  const safeRows = Array.isArray(rows) ? rows : [];
  const rowsJson = JSON.stringify(safeRows);
  return { rowsJson };
}

export default function TelegramStoreStudio({ bot, onUpdateBot, isPro = true }) {
  const toast = useToast();
  const navigate = useNavigate();

  // Load existing store config or default
  const initialStore = bot?.telegramStore || {};
  const [enabled, setEnabled] = useState(initialStore.enabled ?? false);
  const [bannerUrl, setBannerUrl] = useState(initialStore.bannerUrl || STORE_TEMPLATES.subscriptions.bannerUrl);
  const [welcomeMessage, setWelcomeMessage] = useState(initialStore.welcomeMessage || STORE_TEMPLATES.subscriptions.welcomeMessage);
  const [forceSubscribeChannel, setForceSubscribeChannel] = useState(initialStore.forceSubscribeChannel || '');
  const [forceSubscribeEnabled, setForceSubscribeEnabled] = useState(initialStore.forceSubscribeEnabled ?? true);
  const [logsChannelId, setLogsChannelId] = useState(initialStore.logsChannelId || '');
  const [walletInfo, setWalletInfo] = useState(initialStore.walletInfo || STORE_TEMPLATES.subscriptions.walletInfo);
  const [rulesText, setRulesText] = useState(initialStore.rulesText || STORE_TEMPLATES.subscriptions.rulesText);
  const [paymentTimeoutMinutes, setPaymentTimeoutMinutes] = useState(initialStore.paymentTimeoutMinutes ?? 15);
  const [paymentMethods, setPaymentMethods] = useState(() => parsePaymentMethods(initialStore));
  const [bottomKeyboardEnabled, setBottomKeyboardEnabled] = useState(initialStore.bottomKeyboardEnabled ?? true);
  const [supportUsername, setSupportUsername] = useState(initialStore.supportUsername || '');
  const [bottomBtn1, setBottomBtn1] = useState(initialStore.bottomKeyboardRows?.[0]?.[0] || '🛍️ المنتجات');
  const [bottomBtn2, setBottomBtn2] = useState(initialStore.bottomKeyboardRows?.[0]?.[1] || '🚀 الرئيسية');
  const [bottomBtn3, setBottomBtn3] = useState(initialStore.bottomKeyboardRows?.[1]?.[0] || '💳 طرق الدفع');
  const [bottomBtn4, setBottomBtn4] = useState(initialStore.bottomKeyboardRows?.[1]?.[1] || '💬 الدعم');
  const [rows, setRows] = useState(() => {
    const parsed = parseStoreRows(initialStore);
    return (parsed && parsed.length > 0) ? parsed : STORE_TEMPLATES.subscriptions.rows;
  });

  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('buttons'); // 'buttons' | 'channels' | 'payments' | 'settings' | 'menu_nav'
  const [mobileView, setMobileView] = useState('editor'); // 'editor' | 'preview'

  // Modal State for Button Customization
  const [editingBtn, setEditingBtn] = useState(null); // { rIdx, bIdx, btn, isSubmenu, parentId }
  const [btnFormData, setBtnFormData] = useState({
    text: '',
    icon: '',
    action: 'product',
    productId: '',
    productPrice: '',
    url: '',
    customMessage: '',
  });

  // Sync state if bot changes
  useEffect(() => {
    if (bot?.telegramStore) {
      const s = bot.telegramStore;
      setEnabled(s.enabled ?? false);
      if (s.bannerUrl !== undefined) setBannerUrl(s.bannerUrl);
      if (s.welcomeMessage) setWelcomeMessage(s.welcomeMessage);
      if (s.forceSubscribeChannel !== undefined) setForceSubscribeChannel(s.forceSubscribeChannel);
      if (s.forceSubscribeEnabled !== undefined) setForceSubscribeEnabled(s.forceSubscribeEnabled);
      if (s.logsChannelId !== undefined) setLogsChannelId(s.logsChannelId);
      if (s.walletInfo) setWalletInfo(s.walletInfo);
      if (s.rulesText) setRulesText(s.rulesText);
      if (s.paymentTimeoutMinutes !== undefined) setPaymentTimeoutMinutes(s.paymentTimeoutMinutes);
      if (s.bottomKeyboardEnabled !== undefined) setBottomKeyboardEnabled(s.bottomKeyboardEnabled);
      if (s.supportUsername !== undefined) setSupportUsername(s.supportUsername);
      if (Array.isArray(s.bottomKeyboardRows) && s.bottomKeyboardRows.length > 0) {
        if (s.bottomKeyboardRows[0]?.[0]) setBottomBtn1(s.bottomKeyboardRows[0][0]);
        if (s.bottomKeyboardRows[0]?.[1]) setBottomBtn2(s.bottomKeyboardRows[0][1]);
        if (s.bottomKeyboardRows[1]?.[0]) setBottomBtn3(s.bottomKeyboardRows[1][0]);
        if (s.bottomKeyboardRows[1]?.[1]) setBottomBtn4(s.bottomKeyboardRows[1][1]);
      }
      const parsedMethods = parsePaymentMethods(s);
      if (parsedMethods && parsedMethods.length > 0) setPaymentMethods(parsedMethods);
      const parsed = parseStoreRows(s);
      if (parsed && parsed.length > 0) setRows(parsed);
    }
  }, [bot?.id]);

  // Apply a preset template
  const applyTemplate = (key) => {
    const tpl = STORE_TEMPLATES[key];
    if (!tpl) return;
    if (window.confirm(`هل أنت متأكد من تطبيق "${tpl.name}"؟ سيتم تحديث شبكة الأزرار والنصوص الحالية.`)) {
      setBannerUrl(tpl.bannerUrl);
      setWelcomeMessage(tpl.welcomeMessage);
      setWalletInfo(tpl.walletInfo);
      setRulesText(tpl.rulesText);
      setRows(tpl.rows);
      setEnabled(true);
      toast.success(`تم تطبيق ${tpl.name} بنجاح!`);
    }
  };

  // Row operations
  const addRow = (layout = 'single') => {
    const newId = `btn_${Date.now()}`;
    let newRow = [];
    if (layout === 'single') {
      newRow = [{ id: newId, text: 'باقة جديدة', icon: 'gem', action: 'product', productPrice: '1000' }];
    } else if (layout === 'double') {
      newRow = [
        { id: `${newId}_1`, text: 'الخدمة 1', icon: 'zap', action: 'product', productPrice: '500' },
        { id: `${newId}_2`, text: 'الخدمة 2', icon: 'flame', action: 'product', productPrice: '800' },
      ];
    } else if (layout === 'triple') {
      newRow = [
        { id: `${newId}_1`, text: 'خيار 1', icon: 'package', action: 'product', productPrice: '300' },
        { id: `${newId}_2`, text: 'خيار 2', icon: 'package', action: 'product', productPrice: '500' },
        { id: `${newId}_3`, text: 'خيار 3', icon: 'package', action: 'product', productPrice: '900' },
      ];
    }
    setRows([...rows, newRow]);
  };

  const deleteRow = (rIdx) => {
    const updated = rows.filter((_, idx) => idx !== rIdx);
    setRows(updated);
  };

  const moveRow = (rIdx, dir) => {
    if ((dir === -1 && rIdx === 0) || (dir === 1 && rIdx === rows.length - 1)) return;
    const targetIdx = rIdx + dir;
    const updated = [...rows];
    const temp = updated[rIdx];
    updated[rIdx] = updated[targetIdx];
    updated[targetIdx] = temp;
    setRows(updated);
  };

  const addButtonToRow = (rIdx) => {
    if (rows[rIdx].length >= 3) {
      toast.warning('الحد الأقصى لكل صف هو 3 أزرار للحفاظ على تنسيق التيليغرام.');
      return;
    }
    const newId = `btn_${Date.now()}`;
    const updated = [...rows];
    updated[rIdx].push({
      id: newId,
      text: 'زر جديد',
      icon: 'zap',
      action: 'product',
      productPrice: '500',
    });
    setRows(updated);
  };

  const removeButtonFromRow = (rIdx, bIdx) => {
    const updated = [...rows];
    updated[rIdx] = updated[rIdx].filter((_, idx) => idx !== bIdx);
    if (updated[rIdx].length === 0) {
      setRows(updated.filter((_, idx) => idx !== rIdx));
    } else {
      setRows(updated);
    }
  };

  // Open button edit modal
  const openEditModal = (rIdx, bIdx) => {
    const btn = rows[rIdx][bIdx];
    setEditingBtn({ rIdx, bIdx, btn });
    setBtnFormData({
      text: btn.text || '',
      icon: btn.icon || '',
      action: btn.action || 'product',
      productId: btn.productId || '',
      productPrice: btn.productPrice || '',
      url: btn.url || '',
      customMessage: btn.customMessage || '',
      subButtons: btn.subButtons || [],
    });
  };

  const saveButtonEdit = () => {
    if (!editingBtn) return;
    const { rIdx, bIdx } = editingBtn;
    const updated = [...rows];
    updated[rIdx][bIdx] = {
      ...updated[rIdx][bIdx],
      text: btnFormData.text.trim() || 'زر بدون اسم',
      icon: btnFormData.icon || '',
      action: btnFormData.action,
      productId: btnFormData.productId || '',
      productPrice: btnFormData.productPrice || '',
      url: btnFormData.url || '',
      customMessage: btnFormData.customMessage || '',
      subButtons: btnFormData.action === 'submenu' ? (btnFormData.subButtons || []) : undefined,
    };
    setRows(updated);
    setEditingBtn(null);
    toast.success('تم تحديث الزر بنجاح!');
  };

  // Payment methods operations
  const addPaymentMethod = () => {
    const newMethod = {
      id: `pm_${Date.now()}`,
      name: 'طريقة دفع جديدة',
      details: 'اكتب هنا تفاصيل الحساب، رقم المعرف، أو عنوان المحفظة والتعليمات...',
      enabled: true,
    };
    setPaymentMethods([...paymentMethods, newMethod]);
    toast.success('تمت إضافة طريقة دفع جديدة');
  };

  const updatePaymentMethod = (id, field, value) => {
    setPaymentMethods(paymentMethods.map(m => m.id === id ? { ...m, [field]: value } : m));
  };

  const removePaymentMethod = (id) => {
    if (paymentMethods.length <= 1) {
      toast.error('يجب أن تحتوي قائمة الدفع على طريقة واحدة على الأقل');
      return;
    }
    setPaymentMethods(paymentMethods.filter(m => m.id !== id));
  };

  const togglePaymentMethod = (id) => {
    setPaymentMethods(paymentMethods.map(m => m.id === id ? { ...m, enabled: !m.enabled } : m));
  };

  // Save the complete studio config to Firebase
  const handleSaveStore = async () => {
    setSaving(true);
    try {
      const { rowsJson } = serializeStoreRowsForFirestore(rows);
      const storePayload = {
        enabled,
        bannerUrl: bannerUrl.trim(),
        welcomeMessage: welcomeMessage.trim(),
        forceSubscribeChannel: forceSubscribeChannel.trim().replace(/^@/, ''),
        forceSubscribeEnabled: !!forceSubscribeEnabled,
        logsChannelId: logsChannelId.trim(),
        walletInfo: walletInfo.trim(),
        rulesText: rulesText.trim(),
        paymentTimeoutMinutes: Number(paymentTimeoutMinutes) || 15,
        paymentMethodsJson: JSON.stringify(paymentMethods),
        paymentMethods: paymentMethods.map(m => ({
          id: m.id || `pm_${Date.now()}`,
          name: (m.name || '').trim(),
          details: (m.details || '').trim(),
          enabled: !!m.enabled,
        })),
        bottomKeyboardEnabled: !!bottomKeyboardEnabled,
        supportUsername: supportUsername.trim().replace(/^@/, ''),
        bottomKeyboardRows: [
          [bottomBtn1.trim() || '🛍️ المنتجات', bottomBtn2.trim() || '🚀 الرئيسية'],
          [bottomBtn3.trim() || '💳 طرق الدفع', bottomBtn4.trim() || '💬 الدعم'],
        ],
        rowsJson,
        updatedAt: new Date().toISOString(),
      };

      if (onUpdateBot) {
        await onUpdateBot({
          telegramStore: storePayload,
          isActive: enabled,
          telegramEnabled: true,
          status: enabled ? 'active' : 'inactive',
        });
      }
      toast.success('تم حفظ إعدادات متجر تيليغرام بنجاح!');
    } catch (err) {
      console.error('Save telegram store error:', err);
      toast.error('حدث خطأ أثناء حفظ الإعدادات.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="tg-store-studio-container" style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '1.5rem',
      position: 'relative',
    }}>
      {/* ── Top Header & Actions ── */}
      <div className="tg-store-header-bar" style={{
        background: '#141722',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        borderRadius: 'var(--radius-lg, 22px)',
        padding: '1.25rem 1.5rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '46px',
            height: '46px',
            borderRadius: '14px',
            background: 'linear-gradient(135deg, rgba(14, 165, 233, 0.2) 0%, rgba(16, 185, 129, 0.2) 100%)',
            border: '1px solid rgba(14, 165, 233, 0.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#0ea5e9',
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="3" width="20" height="14" rx="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                استوديو متجر تيليغرام التفاعلي
              </h2>
              <span style={{
                background: 'linear-gradient(135deg, #10b981 0%, #0ea5e9 100%)',
                color: '#fff',
                fontSize: '0.72rem',
                fontWeight: 800,
                padding: '2px 8px',
                borderRadius: '999px',
                textTransform: 'uppercase',
                boxShadow: '0 2px 8px rgba(16,185,129,0.3)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3px',
              }}>
                <Sparkles size={10} />
                PRO
              </span>
            </div>
            <p className="tg-hide-mobile" style={{ color: '#94a3b8', fontSize: '0.85rem', margin: '3px 0 0' }}>
              صمّم متجر أزرار حقيقي لتيليغرام مع اشتراك إجباري وقناة بث لوغز تلقائية.
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="tg-store-header-actions" style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Main Toggle */}
          <label style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            cursor: 'pointer',
            padding: '0.45rem 0.9rem',
            borderRadius: '999px',
            background: enabled ? 'rgba(16, 185, 129, 0.15)' : '#1a1e29',
            border: enabled ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(255,255,255,0.12)',
            transition: 'all 0.2s',
          }}>
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              style={{ accentColor: '#10b981', cursor: 'pointer' }}
            />
            <span style={{
              fontSize: '0.82rem',
              fontWeight: 700,
              color: enabled ? '#34d399' : 'var(--text-muted)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
            }}>
              {enabled ? <CheckCircle2 size={13} color="#10b981" /> : <XCircle size={13} color="#94a3b8" />}
              <span>{enabled ? 'المتجر مفعّل' : 'المتجر معطّل'}</span>
            </span>
          </label>

          {/* Save Button */}
          <button
            onClick={handleSaveStore}
            disabled={saving}
            className="btn btn-primary"
            style={{
              borderRadius: '999px',
              padding: '0.55rem 1.4rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontWeight: 800,
            }}
          >
            {saving ? (
              <span className="spinner spinner-sm" />
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                <polyline points="17 21 17 13 7 13 7 21"/>
                <polyline points="7 3 7 8 15 8"/>
              </svg>
            )}
            حفظ المتجر
          </button>
        </div>
      </div>

      {/* ── Mobile View Toggle (Visible only on screens <= 1024px) ── */}
      <div className="tg-studio-mobile-switch" style={{
        background: '#141722',
        border: '1px solid rgba(255, 255, 255, 0.12)',
      }}>
        <button
          type="button"
          className={`tg-mobile-tab-btn ${mobileView === 'editor' ? 'is-active' : ''}`}
          onClick={() => setMobileView('editor')}
        >
          <SlidersHorizontal size={15} />
          <span>تخصيص المتجر والأزرار</span>
        </button>
        <button
          type="button"
          className={`tg-mobile-tab-btn ${mobileView === 'preview' ? 'is-active' : ''}`}
          onClick={() => setMobileView('preview')}
        >
          <Smartphone size={15} />
          <span>معاينة المحاكي الحي</span>
        </button>
      </div>

      {/* ── Main Studio Split Screen ── */}
      <div className="tg-studio-split-layout" data-mobile-view={mobileView}>
        {/* ── LEFT: Studio Controls & Grid Editor ── */}
        <div className="tg-studio-col-editor">
          {/* Sub-Tabs Nav */}
          <div className="tg-subtabs-nav">
            <button
              type="button"
              onClick={() => setActiveTab('buttons')}
              className={`tg-subtab-btn ${activeTab === 'buttons' ? 'is-active-buttons' : ''}`}
            >
              <SlidersHorizontal size={15} />
              <span>شبكة الأزرار</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('channels')}
              className={`tg-subtab-btn ${activeTab === 'channels' ? 'is-active-channels' : ''}`}
            >
              <Megaphone size={15} />
              <span>اللوغز والاشتراك</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('payments')}
              className={`tg-subtab-btn ${activeTab === 'payments' ? 'is-active-payments' : ''}`}
            >
              <CreditCard size={15} />
              <span>طرق الدفع والشحن</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('settings')}
              className={`tg-subtab-btn ${activeTab === 'settings' ? 'is-active-settings' : ''}`}
            >
              <Settings size={15} />
              <span>البانر والقوانين</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('menu_nav')}
              className={`tg-subtab-btn ${activeTab === 'menu_nav' ? 'is-active-menu' : ''}`}
            >
              <LayoutGrid size={15} />
              <span>قائمة Menu السفلية</span>
            </button>
          </div>

          {/* TAB 1: Buttons Grid Builder */}
          {activeTab === 'buttons' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Preset Templates Strip */}
              <div style={{
                background: '#141722',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: 'var(--radius-md, 16px)',
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '8px',
              }}>
                <div style={{ fontSize: '0.83rem', color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <Sparkles size={14} color="#38bdf8" />
                  <strong>قوالب جاهزة بضغطة زر:</strong>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => applyTemplate('subscriptions')}
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: '0.78rem', borderRadius: '8px', padding: '5px 10px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                  >
                    <Headphones size={13} />
                    <span>متجر اشتراكات رقمية</span>
                  </button>
                  <button
                    onClick={() => applyTemplate('gaming')}
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: '0.78rem', borderRadius: '8px', padding: '5px 10px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                  >
                    <Gamepad2 size={13} />
                    <span>متجر شحن ألعاب</span>
                  </button>
                </div>
              </div>

              {/* Rows List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {rows.map((row, rIdx) => (
                  <div
                    key={rIdx}
                    style={{
                      background: 'var(--bg-card, #111110)',
                      border: '1px solid var(--border-default)',
                      borderRadius: 'var(--radius-md, 16px)',
                      padding: '12px 14px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                      boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
                    }}
                  >
                    {/* Row Header controls */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      borderBottom: '1px solid rgba(255,255,255,0.06)',
                      paddingBottom: '8px',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{
                          background: 'rgba(255,255,255,0.07)',
                          color: 'var(--text-primary)',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: '6px',
                        }}>
                          الصف {rIdx + 1} ({row.length} {row.length === 1 ? 'زر' : 'أزرار'})
                        </span>
                      </div>

                      {/* Row actions */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <button
                          onClick={() => moveRow(rIdx, -1)}
                          disabled={rIdx === 0}
                          title="تحريك للأعلى"
                          style={{
                            background: 'transparent',
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '6px',
                            color: 'var(--text-secondary)',
                            cursor: rIdx === 0 ? 'not-allowed' : 'pointer',
                            padding: '4px 7px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <ArrowUp size={13} />
                        </button>
                        <button
                          onClick={() => moveRow(rIdx, 1)}
                          disabled={rIdx === rows.length - 1}
                          title="تحريك للأسفل"
                          style={{
                            background: 'transparent',
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '6px',
                            color: 'var(--text-secondary)',
                            cursor: rIdx === rows.length - 1 ? 'not-allowed' : 'pointer',
                            padding: '4px 7px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <ArrowDown size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => addButtonToRow(rIdx)}
                          title="إضافة زر إضافي بجانب هذا الصف (حد أقصى 3)"
                          style={{
                            background: 'rgba(16, 185, 129, 0.12)',
                            border: '1px solid rgba(16, 185, 129, 0.25)',
                            borderRadius: '6px',
                            color: '#34d399',
                            cursor: 'pointer',
                            padding: '4px 9px',
                            fontSize: '0.78rem',
                            fontWeight: 700,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <Plus size={12} />
                          <span>زر بجانبه</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteRow(rIdx)}
                          title="حذف هذا الصف بالكامل"
                          style={{
                            background: 'rgba(244, 63, 94, 0.1)',
                            border: '1px solid rgba(244, 63, 94, 0.25)',
                            borderRadius: '6px',
                            color: '#fb7185',
                            cursor: 'pointer',
                            padding: '4px 7px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>

                    {/* Row Buttons Grid */}
                    <div className="tg-row-buttons-grid">
                      {row.map((btn, bIdx) => (
                        <div
                          key={btn.id || bIdx}
                          className="tg-row-btn-card"
                          onClick={() => openEditModal(rIdx, bIdx)}
                          title="انقر لتعديل بيانات الزر"
                        >
                          <div className="tg-row-btn-main">
                            <span className="tg-row-btn-icon-wrapper">
                              <StoreIcon icon={btn.icon} size={15} />
                            </span>
                            <div className="tg-row-btn-text-group">
                              <div className="tg-row-btn-title">
                                {stripEmojis(btn.text)}
                              </div>
                              <div className="tg-row-btn-subtitle">
                                {btn.action === 'product' && (
                                  <>
                                    <ShoppingBag size={11} />
                                    <span>منتج • {btn.productPrice ? btn.productPrice + ' دج' : 'محدد'}</span>
                                  </>
                                )}
                                {btn.action === 'submenu' && (
                                  <>
                                    <Folder size={11} />
                                    <span>قائمة فرعية</span>
                                  </>
                                )}
                                {btn.action === 'wallet' && (
                                  <>
                                    <CreditCard size={11} />
                                    <span>شحن المحفظة</span>
                                  </>
                                )}
                                {btn.action === 'rules' && (
                                  <>
                                    <FileText size={11} />
                                    <span>شروط البيع</span>
                                  </>
                                )}
                                {btn.action === 'url' && (
                                  <>
                                    <ExternalLink size={11} />
                                    <span>رابط خارجي</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="tg-row-btn-actions" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => openEditModal(rIdx, bIdx)}
                              className="btn btn-secondary btn-sm"
                              style={{
                                padding: '4px 8px',
                                fontSize: '0.75rem',
                                borderRadius: '6px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                              }}
                            >
                              <Pencil size={11} />
                              <span>تعديل</span>
                            </button>
                            {row.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeButtonFromRow(rIdx, bIdx)}
                                className="tg-row-btn-delete"
                                title="حذف الزر من الصف"
                              >
                                <X size={14} />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Add New Row Buttons */}
              <div style={{
                background: 'var(--bg-card, #111110)',
                border: '1px dashed var(--border-default)',
                borderRadius: 'var(--radius-md, 16px)',
                padding: '16px',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '10px',
              }}>
                <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <Plus size={15} />
                  <span>إضافة صف أزرار جديد</span>
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
                  <button
                    onClick={() => addRow('single')}
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: '0.8rem', borderRadius: '8px' }}
                  >
                    زر كامل العرض (100%)
                  </button>
                  <button
                    onClick={() => addRow('double')}
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: '0.8rem', borderRadius: '8px' }}
                  >
                    زرين متجاورين (50% | 50%)
                  </button>
                  <button
                    onClick={() => addRow('triple')}
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: '0.8rem', borderRadius: '8px' }}
                  >
                    3 أزرار متجاورة (33%)
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Channels & Force Subscribe */}
          {activeTab === 'channels' && (
            <div style={{
              background: 'var(--bg-card, #111110)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-md, 16px)',
              padding: '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.25rem',
            }}>
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0, display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                  <Megaphone size={18} color="#38bdf8" />
                  <span>نظام الاشتراك الإجباري وقناة اللوغز (Proof & Growth Engine)</span>
                </h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', margin: '4px 0 0' }}>
                  اربط قناتك لإجبار المشترين الجدد على الانضمام، ونشر إثباتات المبيعات آلياً.
                </p>
              </div>

              {/* Force Subscribe Channel */}
              <div className="tg-field-card">
                <div className="tg-field-header">
                  <div className="tg-field-title-group">
                    <span className="tg-field-icon-badge tg-field-icon-badge--sky">
                      <Megaphone size={16} />
                    </span>
                    <div>
                      <h4 className="tg-field-title" style={{ color: '#38bdf8' }}>
                        1. قناة الاشتراك الإجباري (Force Subscribe)
                      </h4>
                      <p className="tg-field-hint">لن يفتح المتجر للزبون حتى ينضم لهذه القناة أولاً ويتحقق البوت من اشتراكه</p>
                    </div>
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', fontWeight: 700, color: forceSubscribeEnabled ? '#38bdf8' : 'var(--text-secondary)', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={forceSubscribeEnabled}
                      onChange={(e) => setForceSubscribeEnabled(e.target.checked)}
                      style={{ accentColor: '#0ea5e9' }}
                    />
                    تفعيل الشرط
                  </label>
                </div>

                <div className="tg-input-group">
                  <span className="tg-input-addon">@</span>
                  <input
                    type="text"
                    placeholder="اسم_القناة (مثال: my_store_channel)"
                    value={forceSubscribeChannel}
                    onChange={(e) => setForceSubscribeChannel(e.target.value)}
                    className="tg-input"
                    style={{ direction: 'ltr' }}
                  />
                </div>

                <div style={{ fontSize: '0.74rem', color: '#f59e0b', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                  <HelpCircle size={13} />
                  <span>ملاحظة: يجب إضافة البوت كـ Administrator في قناتك ليتمكن من فحص اشتراك الأعضاء.</span>
                </div>
              </div>

              {/* Logs Channel */}
              <div className="tg-field-card">
                <div className="tg-field-header">
                  <div className="tg-field-title-group">
                    <span className="tg-field-icon-badge tg-field-icon-badge--emerald">
                      <CheckCircle2 size={16} />
                    </span>
                    <div>
                      <h4 className="tg-field-title" style={{ color: '#34d399' }}>
                        2. قناة بث اللوغز والمبيعات الحية (Live Logs Channel)
                      </h4>
                      <p className="tg-field-hint">قناة بث للقراءة فقط ينشر فيها البوت تلقائياً إثباتات الشراء والتسليم لبناء الثقة</p>
                    </div>
                  </div>
                </div>

                <div className="tg-input-group">
                  <span className="tg-input-addon">@</span>
                  <input
                    type="text"
                    placeholder="اسم_قناة_اللوغز (مثال: my_store_logs)"
                    value={logsChannelId}
                    onChange={(e) => setLogsChannelId(e.target.value)}
                    className="tg-input"
                    style={{ direction: 'ltr' }}
                  />
                </div>

                <div style={{ fontSize: '0.74rem', color: '#34d399', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                  <CheckCircle2 size={13} color="#34d399" />
                  <span>ينشر البوت العمليات بشكل مجهول الهوية لحماية خصوصية زبائنك وبناء مصداقية عالية للمشترين الجدد!</span>
                </div>
              </div>
            </div>
          )}

          {/* TAB: Payment Methods & Timer Studio */}
          {activeTab === 'payments' && (
            <div style={{
              background: 'var(--bg-card, #111110)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-md, 16px)',
              padding: '1.25rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.25rem',
            }}>
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0, display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                  <CreditCard size={18} color="#c084fc" />
                  <span>طرق الدفع والشحن ومؤقت إغلاق الصفقات</span>
                </h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', margin: '4px 0 0' }}>
                  حدد بحرية تامة وسائل الدفع المقبولة في متجرك ومهلة المؤقت التنازلي لإتمام التحويل قبل إغلاق الطلب.
                </p>
              </div>

              {/* 1. Payment Countdown Timer */}
              <div className="tg-field-card">
                <div className="tg-field-header">
                  <div className="tg-field-title-group">
                    <span className="tg-field-icon-badge" style={{ background: 'rgba(168, 85, 247, 0.15)', color: '#c084fc' }}>
                      <Clock size={16} />
                    </span>
                    <div>
                      <h4 className="tg-field-title" style={{ color: '#c084fc' }}>
                        مؤقت مهلة الدفع التنازلي (بالدقائق)
                      </h4>
                      <p className="tg-field-hint">
                        المدة الزمنية الممنوحة للزبون لإتمام التحويل وإرسال الوصل أو معرف الدفع قبل غلق الصفقة تلقائياً
                      </p>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <input
                      type="number"
                      min="1"
                      max="180"
                      value={paymentTimeoutMinutes}
                      onChange={(e) => setPaymentTimeoutMinutes(Math.max(1, parseInt(e.target.value) || 15))}
                      className="tg-input"
                      style={{ width: '90px', textAlign: 'center', fontWeight: 700, fontSize: '1rem', color: '#c084fc' }}
                    />
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>دقيقة</span>
                  </div>

                  {/* Preset quick buttons */}
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {[5, 10, 15, 30, 45, 60].map(mins => (
                      <button
                        key={mins}
                        type="button"
                        onClick={() => setPaymentTimeoutMinutes(mins)}
                        className="btn btn-secondary btn-sm"
                        style={{
                          fontSize: '0.75rem',
                          padding: '4px 10px',
                          borderRadius: '8px',
                          borderColor: paymentTimeoutMinutes === mins ? '#c084fc' : undefined,
                          color: paymentTimeoutMinutes === mins ? '#c084fc' : undefined,
                          background: paymentTimeoutMinutes === mins ? 'rgba(168, 85, 247, 0.15)' : undefined,
                        }}
                      >
                        {mins} دقيقة
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ fontSize: '0.74rem', color: 'var(--text-tertiary)', display: 'inline-flex', alignItems: 'center', gap: '5px', marginTop: '6px' }}>
                  <HelpCircle size={13} color="#a855f7" />
                  <span>عند انتهاء الوقت تُغلق الصفقة ويُعرض للزبون زر «🔄 إعادة فتح الصفقة» إذا كان قد حوّل بالفعل.</span>
                </div>
              </div>

              {/* 2. Custom Payment Methods List */}
              <div className="tg-field-card">
                <div className="tg-field-header" style={{ marginBottom: '0.75rem' }}>
                  <div className="tg-field-title-group">
                    <span className="tg-field-icon-badge tg-field-icon-badge--emerald">
                      <CreditCard size={16} />
                    </span>
                    <div>
                      <h4 className="tg-field-title">
                        وسائل الدفع والشحن المتاحة ({paymentMethods.length})
                      </h4>
                      <p className="tg-field-hint">
                        تظهر كأزرار تفاعلية أنيقة عند اختيار الزبون للباقة أو المنتج لإتمام الشراء
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={addPaymentMethod}
                    className="btn btn-primary btn-sm"
                    style={{ gap: '5px', fontSize: '0.78rem', borderRadius: '8px' }}
                  >
                    <Plus size={14} />
                    <span>إضافة وسيلة دفع</span>
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {paymentMethods.map((method, idx) => (
                    <div key={method.id || idx} className="tg-payment-method-card">
                      {/* Top Header of Card */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: '220px' }}>
                          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-tertiary)', width: '20px' }}>
                            #{idx + 1}
                          </span>
                          <input
                            type="text"
                            value={method.name}
                            onChange={(e) => updatePaymentMethod(method.id, 'name', e.target.value)}
                            placeholder="اسم الزر في تيليغرام (مثال: 🔸 الدفع عبر Binance)"
                            className="tg-input"
                            style={{ flex: 1, fontWeight: 700, fontSize: '0.86rem' }}
                          />
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', fontWeight: 600, color: method.enabled ? '#34d399' : 'var(--text-muted)', cursor: 'pointer' }}>
                            <input
                              type="checkbox"
                              checked={method.enabled}
                              onChange={() => togglePaymentMethod(method.id)}
                              style={{ accentColor: '#10b981' }}
                            />
                            <span>{method.enabled ? 'مفعّلة' : 'معطّلة'}</span>
                          </label>

                          <button
                            type="button"
                            onClick={() => removePaymentMethod(method.id)}
                            style={{ background: 'transparent', border: 'none', color: '#f87171', cursor: 'pointer', padding: '4px' }}
                            title="حذف وسيلة الدفع"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>

                      {/* Instructions / Account details textarea */}
                      <div>
                        <label style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px', fontWeight: 600 }}>
                          بيانات الحساب / رقم المحفظة / التعليمات (تظهر للزبون عند النقر):
                        </label>
                        <textarea
                          rows="3"
                          value={method.details}
                          onChange={(e) => updatePaymentMethod(method.id, 'details', e.target.value)}
                          placeholder="مثال:&#10;معرف الدفع (Binance Pay ID): 123456789&#10;أو RIP: 00799999000123456789 (الاسم: ...)"
                          className="tg-textarea"
                          style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}
                        />
                      </div>

                      {/* Mini Live Preview Badge */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-tertiary)', borderTop: '1px solid var(--border-subtle)', paddingTop: '6px' }}>
                        <span>معاينة الزر كما يراه الزبون:</span>
                        <div style={{
                          background: 'rgba(255, 255, 255, 0.06)',
                          border: '1px solid rgba(255, 255, 255, 0.12)',
                          borderRadius: '6px',
                          padding: '3px 10px',
                          color: 'var(--text-primary)',
                          fontWeight: 700,
                        }}>
                          {method.name || 'زر بدون اسم'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: Banner, Wallet & Rules */}
          {activeTab === 'settings' && (
            <div style={{
              background: 'var(--bg-card, #111110)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-md, 16px)',
              padding: '1.25rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
            }}>
              {/* 1. Banner Image */}
              <div className="tg-field-card">
                <div className="tg-field-header">
                  <div className="tg-field-title-group">
                    <span className="tg-field-icon-badge tg-field-icon-badge--emerald">
                      <Image size={16} />
                    </span>
                    <div>
                      <h4 className="tg-field-title">صورة بانر المتجر (Store Banner)</h4>
                      <p className="tg-field-hint">رابط صورة عريض يظهر في رأس رسالة الترحيب أعلى شبكة الأزرار</p>
                    </div>
                  </div>
                </div>

                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <input
                    type="text"
                    placeholder="https://... رابط صورة عريض عالي الدقة"
                    value={bannerUrl}
                    onChange={(e) => setBannerUrl(e.target.value)}
                    className="tg-input"
                    style={{ direction: 'ltr', paddingLeft: bannerUrl ? '36px' : '14px' }}
                  />
                  {bannerUrl && (
                    <button
                      type="button"
                      onClick={() => setBannerUrl('')}
                      style={{
                        position: 'absolute',
                        left: '10px',
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        padding: '4px',
                        display: 'flex',
                        alignItems: 'center',
                      }}
                      title="مسح الرابط"
                    >
                      <X size={15} />
                    </button>
                  )}
                </div>

                {/* Live Banner Preview Box */}
                {bannerUrl && bannerUrl.startsWith('http') && (
                  <div className="tg-banner-preview-card">
                    <img
                      src={bannerUrl}
                      alt="Banner Preview"
                      className="tg-banner-preview-img"
                      onError={(e) => {
                        e.target.style.display = 'none';
                        const fallback = e.target.parentElement.querySelector('.tg-banner-error');
                        if (fallback) fallback.style.display = 'flex';
                      }}
                    />
                    <div
                      className="tg-banner-error"
                      style={{
                        display: 'none',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--text-muted)',
                        fontSize: '0.8rem',
                        gap: '6px',
                        width: '100%',
                        height: '100%',
                      }}
                    >
                      <HelpCircle size={15} color="#f59e0b" />
                      <span>تعذر تحميل الصورة من هذا الرابط</span>
                    </div>
                    <div className="tg-banner-badge">
                      <Sparkles size={11} color="#34d399" />
                      <span>معاينة البانر في تيليغرام</span>
                    </div>
                  </div>
                )}
              </div>

              {/* 2. Welcome Greeting */}
              <div className="tg-field-card">
                <div className="tg-field-header">
                  <div className="tg-field-title-group">
                    <span className="tg-field-icon-badge tg-field-icon-badge--emerald">
                      <MessageSquare size={16} />
                    </span>
                    <div>
                      <h4 className="tg-field-title">رسالة الترحيب الأولى للمتجر</h4>
                      <p className="tg-field-hint">الرسالة النصية التي يرسلها البوت تلقائياً للزبون مع أزرار المتجر فور فتح المحادثة</p>
                    </div>
                  </div>
                </div>

                <textarea
                  rows="4"
                  value={welcomeMessage}
                  onChange={(e) => setWelcomeMessage(e.target.value)}
                  placeholder="مرحباً بك في متجرنا الرقمي..."
                  className="tg-textarea"
                />
              </div>

              {/* 3. Wallet Info */}
              <div className="tg-field-card">
                <div className="tg-field-header">
                  <div className="tg-field-title-group">
                    <span className="tg-field-icon-badge tg-field-icon-badge--sky">
                      <CreditCard size={16} />
                    </span>
                    <div>
                      <h4 className="tg-field-title" style={{ color: '#38bdf8' }}>
                        معلومات شحن المحفظة والحسابات البنكية (BaridiMob / CCP)
                      </h4>
                      <p className="tg-field-hint">تظهر للزبون عند النقر على زر "شحن المحفظة" لإيداع الرصيد وإرسال إشعار الدفع</p>
                    </div>
                  </div>
                </div>

                <textarea
                  rows="4"
                  value={walletInfo}
                  onChange={(e) => setWalletInfo(e.target.value)}
                  placeholder="طرق الدفع والشحن المتوفرة:&#10;• بريدي موب (BaridiMob): 00799999...&#10;• CCP: 123456...&#10;بعد التحويل، أرسل صورة الوصل هنا مباشرة!"
                  className="tg-textarea"
                />
              </div>

              {/* 4. Rules Text */}
              <div className="tg-field-card">
                <div className="tg-field-header">
                  <div className="tg-field-title-group">
                    <span className="tg-field-icon-badge tg-field-icon-badge--amber">
                      <FileText size={16} />
                    </span>
                    <div>
                      <h4 className="tg-field-title" style={{ color: '#fbbf24' }}>
                        شروط وضمان المتجر
                      </h4>
                      <p className="tg-field-hint">القوانين والضمانات التي يقرؤها الزبون عند الضغط على زر "شروط البيع والضمان"</p>
                    </div>
                  </div>
                </div>

                <textarea
                  rows="4"
                  value={rulesText}
                  onChange={(e) => setRulesText(e.target.value)}
                  placeholder="شروط وضمان المتجر:&#10;1. جميع الاشتراكات أصلية ومضمونة طوال مدة الاشتراك.&#10;2. التسليم يتم تلقائياً وفورياً..."
                  className="tg-textarea"
                />
              </div>
            </div>
          )}

          {/* TAB 5: Native Menu & Bottom Keyboard Customizer */}
          {activeTab === 'menu_nav' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* 1. Master Toggle for Persistent Bottom Keyboard */}
              <div className="tg-field-card" style={{
                border: bottomKeyboardEnabled ? '1px solid rgba(16, 185, 129, 0.5)' : '1px solid rgba(255, 255, 255, 0.12)',
                background: bottomKeyboardEnabled ? '#0f241a' : '#141722',
                transition: 'all 0.25s ease',
              }}>
                <div className="tg-field-header" style={{ marginBottom: 0 }}>
                  <div className="tg-field-title-group">
                    <span className="tg-field-icon-badge tg-field-icon-badge--emerald">
                      <LayoutGrid size={18} />
                    </span>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <h4 className="tg-field-title" style={{ color: '#34d399', margin: 0 }}>
                          الأزرار السفلية الدائمة (Persistent Reply Keyboard)
                        </h4>
                        <span style={{
                          fontSize: '0.7rem',
                          padding: '2px 8px',
                          borderRadius: '999px',
                          fontWeight: 700,
                          background: bottomKeyboardEnabled ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.15)',
                          color: bottomKeyboardEnabled ? '#34d399' : '#f87171',
                          border: bottomKeyboardEnabled ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(239, 68, 68, 0.35)',
                        }}>
                          {bottomKeyboardEnabled ? 'مفعّلة ونشطة' : 'معطّلة'}
                        </span>
                      </div>
                      <p className="tg-field-hint" style={{ marginTop: '4px' }}>
                        أزرار مثبتة بشكل دائم فوق لوحة المفاتيح في تيليغرام تمنح زبائنك تجربة استخدام فائقة السلاسة دون الحاجة لكتابة أوامر أو إعادة تدوير الرسائل.
                      </p>
                    </div>
                  </div>

                  <label className="toggle-switch" style={{ position: 'relative', display: 'inline-block', width: '48px', height: '26px', flexShrink: 0 }}>
                    <input
                      type="checkbox"
                      checked={bottomKeyboardEnabled}
                      onChange={(e) => setBottomKeyboardEnabled(e.target.checked)}
                      style={{ opacity: 0, width: 0, height: 0 }}
                    />
                    <span style={{
                      position: 'absolute',
                      cursor: 'pointer',
                      top: 0, left: 0, right: 0, bottom: 0,
                      backgroundColor: bottomKeyboardEnabled ? '#10b981' : '#334155',
                      borderRadius: '34px',
                      transition: '0.3s',
                    }}>
                      <span style={{
                        position: 'absolute',
                        content: '""',
                        height: '20px',
                        width: '20px',
                        left: bottomKeyboardEnabled ? '24px' : '3px',
                        bottom: '3px',
                        backgroundColor: '#fff',
                        borderRadius: '50%',
                        transition: '0.3s',
                      }} />
                    </span>
                  </label>
                </div>
              </div>

              {/* 2. Bottom Keyboard Layout Customizer (2x2 Grid) */}
              <div className="tg-field-card">
                <div className="tg-field-header">
                  <div className="tg-field-title-group">
                    <span className="tg-field-icon-badge" style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8' }}>
                      <Menu size={16} />
                    </span>
                    <div>
                      <h4 className="tg-field-title" style={{ color: '#38bdf8' }}>
                        تخصيص نصوص الأزرار السفلية (شبكة 2×2)
                      </h4>
                      <p className="tg-field-hint">
                        عدّل نصوص وأيقونات الأزرار التي تظهر للزبون في الأسفل، أو استعد التسميات القياسية
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setBottomBtn1('🛍️ المنتجات');
                      setBottomBtn2('🚀 الرئيسية');
                      setBottomBtn3('💳 طرق الدفع');
                      setBottomBtn4('💬 الدعم');
                      toast.success('تمت استعادة التسميات القياسية للأزرار السفلية');
                    }}
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: '0.75rem', padding: '4px 10px', borderRadius: '8px' }}
                  >
                    استعادة الافتراضي
                  </button>
                </div>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: '12px',
                  background: '#0d1017',
                  padding: '14px',
                  borderRadius: '12px',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                }}>
                  {/* Row 1 - Btn 1 */}
                  <div>
                    <label style={{ fontSize: '0.8rem', color: '#f1f5f9', fontWeight: 700, display: 'block', marginBottom: '6px' }}>
                      الزر 1 (الصف الأول - اليمين):
                    </label>
                    <input
                      type="text"
                      value={bottomBtn1}
                      onChange={(e) => setBottomBtn1(e.target.value)}
                      placeholder="🛍️ المنتجات"
                      className="tg-input"
                      disabled={!bottomKeyboardEnabled}
                    />
                    <span style={{ fontSize: '0.73rem', color: '#94a3b8', display: 'block', marginTop: '4px', fontWeight: 500 }}>
                      يعرض قائمة المنتجات والكتالوج فوراً
                    </span>
                  </div>

                  {/* Row 1 - Btn 2 */}
                  <div>
                    <label style={{ fontSize: '0.8rem', color: '#f1f5f9', fontWeight: 700, display: 'block', marginBottom: '6px' }}>
                      الزر 2 (الصف الأول - اليسار):
                    </label>
                    <input
                      type="text"
                      value={bottomBtn2}
                      onChange={(e) => setBottomBtn2(e.target.value)}
                      placeholder="🚀 الرئيسية"
                      className="tg-input"
                      disabled={!bottomKeyboardEnabled}
                    />
                    <span style={{ fontSize: '0.73rem', color: '#94a3b8', display: 'block', marginTop: '4px', fontWeight: 500 }}>
                      يعيد فتح رسالة الترحيب والبانر الرئيسي
                    </span>
                  </div>

                  {/* Row 2 - Btn 3 */}
                  <div>
                    <label style={{ fontSize: '0.8rem', color: '#f1f5f9', fontWeight: 700, display: 'block', marginBottom: '6px' }}>
                      الزر 3 (الصف الثاني - اليمين):
                    </label>
                    <input
                      type="text"
                      value={bottomBtn3}
                      onChange={(e) => setBottomBtn3(e.target.value)}
                      placeholder="💳 طرق الدفع"
                      className="tg-input"
                      disabled={!bottomKeyboardEnabled}
                    />
                    <span style={{ fontSize: '0.73rem', color: '#94a3b8', display: 'block', marginTop: '4px', fontWeight: 500 }}>
                      يعرض الحسابات البنكية ومعلومات الشحن
                    </span>
                  </div>

                  {/* Row 2 - Btn 4 */}
                  <div>
                    <label style={{ fontSize: '0.8rem', color: '#f1f5f9', fontWeight: 700, display: 'block', marginBottom: '6px' }}>
                      الزر 4 (الصف الثاني - اليسار):
                    </label>
                    <input
                      type="text"
                      value={bottomBtn4}
                      onChange={(e) => setBottomBtn4(e.target.value)}
                      placeholder="💬 الدعم"
                      className="tg-input"
                      disabled={!bottomKeyboardEnabled}
                    />
                    <span style={{ fontSize: '0.73rem', color: '#94a3b8', display: 'block', marginTop: '4px', fontWeight: 500 }}>
                      يفتح خيارات المساعدة والتواصل المباشر
                    </span>
                  </div>
                </div>
              </div>

              {/* 3. Direct Support Username */}
              <div className="tg-field-card">
                <div className="tg-field-header">
                  <div className="tg-field-title-group">
                    <span className="tg-field-icon-badge" style={{ background: 'rgba(168, 85, 247, 0.15)', color: '#c084fc' }}>
                      <MessageSquare size={16} />
                    </span>
                    <div>
                      <h4 className="tg-field-title" style={{ color: '#c084fc' }}>
                        حساب الدعم الفني وخدمة العملاء (Support Username)
                      </h4>
                      <p className="tg-field-hint">
                        يُربط تلقائياً بزر الدعم السفلي وأمر <code style={{ color: '#38bdf8' }}>/support</code> ليتمكن الزبائن من محادثتك مباشرة بنقرة واحدة
                      </p>
                    </div>
                  </div>
                </div>

                <div style={{ position: 'relative' }}>
                  <span style={{
                    position: 'absolute',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    right: '12px',
                    color: '#94a3b8',
                    fontWeight: 700,
                  }}>@</span>
                  <input
                    type="text"
                    value={supportUsername}
                    onChange={(e) => setSupportUsername(e.target.value.replace(/^@/, ''))}
                    placeholder="مثال: store_support أو mohamed_admin"
                    className="tg-input"
                    style={{ paddingRight: '32px', direction: 'ltr', textAlign: 'right' }}
                  />
                </div>
                {supportUsername && (
                  <div style={{
                    marginTop: '8px',
                    fontSize: '0.75rem',
                    color: '#34d399',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                  }}>
                    <CheckCircle2 size={13} />
                    <span>رابط التواصل المباشر للزبائن: <a href={`https://t.me/${supportUsername.trim().replace(/^@/, '')}`} target="_blank" rel="noopener noreferrer" style={{ color: '#38bdf8', textDecoration: 'underline' }}>t.me/{supportUsername.trim().replace(/^@/, '')}</a></span>
                  </div>
                )}
              </div>

              {/* 4. Native Telegram Menu Commands Preview */}
              <div className="tg-field-card" style={{
                background: '#0c1524',
                border: '1px solid rgba(56, 189, 248, 0.35)',
              }}>
                <div className="tg-field-header">
                  <div className="tg-field-title-group">
                    <span className="tg-field-icon-badge" style={{ background: 'rgba(56, 189, 248, 0.2)', color: '#38bdf8' }}>
                      <Command size={16} />
                    </span>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <h4 className="tg-field-title" style={{ color: '#38bdf8', margin: 0 }}>
                          زر قائمة Menu الأزرق الرسمي (Official Telegram Commands)
                        </h4>
                        <span style={{
                          fontSize: '0.68rem',
                          background: 'rgba(56, 189, 248, 0.2)',
                          color: '#38bdf8',
                          padding: '2px 8px',
                          borderRadius: '6px',
                          fontWeight: 700,
                        }}>
                          مفعّل ومسجّل تلقائياً
                        </span>
                      </div>
                      <p className="tg-field-hint" style={{ marginTop: '4px' }}>
                        يقوم محرك البوت تلقائياً بتسجيل هذه الأوامر الرسمية عبر Telegram Bot API، لتظهر في زر "Menu" الأزرق الدائم أسفل يسار الشاشة:
                      </p>
                    </div>
                  </div>
                </div>

                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  marginTop: '6px',
                }}>
                  {[
                    { cmd: '/start', desc: '🚀 القائمة الرئيسية للمتجر وإعادة تشغيل الواجهة' },
                    { cmd: '/products', desc: '🛍️ تصفح كتالوج المنتجات والباقات الرقمية' },
                    { cmd: '/wallet', desc: '💳 طرق الدفع وشحن الرصيد الفوري' },
                    { cmd: '/support', desc: '💬 الدعم الفني وخدمة العملاء المباشرة' },
                    { cmd: '/rules', desc: '📜 شروط وضمان المتجر وسياسة الاسترجاع' },
                    { cmd: '/track', desc: '📦 تتبع حالة طلبك برقم التتبع' },
                  ].map((item, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '9px 14px',
                        background: '#152032',
                        border: '1px solid rgba(56, 189, 248, 0.18)',
                        borderRadius: '8px',
                        fontSize: '0.82rem',
                      }}
                    >
                      <code style={{
                        color: '#38bdf8',
                        fontWeight: 700,
                        direction: 'ltr',
                        background: 'rgba(56, 189, 248, 0.15)',
                        padding: '3px 8px',
                        borderRadius: '5px',
                      }}>
                        {item.cmd}
                      </code>
                      <span style={{ color: '#e2e8f0', fontSize: '0.8rem', fontWeight: 500 }}>
                        {item.desc}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── RIGHT: LIVE INTERACTIVE PHONE MOCKUP (Sticky) ── */}
        <div className="tg-studio-col-preview">
          <div style={{
            fontSize: '0.8rem',
            fontWeight: 700,
            color: 'var(--text-secondary)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
            محاكي التيليغرام التفاعلي (Live Simulator)
          </div>

          <TelegramPhoneMockup
            botName={bot?.botName}
            businessName={bot?.businessName}
            bannerUrl={bannerUrl}
            welcomeMessage={welcomeMessage}
            buttons={rows}
            forceSubscribeChannel={forceSubscribeEnabled ? forceSubscribeChannel : ''}
            walletInfo={walletInfo}
            rulesText={rulesText}
            paymentMethods={paymentMethods}
            paymentTimeoutMinutes={paymentTimeoutMinutes}
            products={bot?.products || []}
            bottomKeyboardEnabled={bottomKeyboardEnabled}
            bottomBtn1={bottomBtn1}
            bottomBtn2={bottomBtn2}
            bottomBtn3={bottomBtn3}
            bottomBtn4={bottomBtn4}
            supportUsername={supportUsername}
          />

          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textAlign: 'center', maxWidth: '280px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}>
            <Sparkles size={12} color="#38bdf8" />
            <span>جرب النقر على الأزرار داخل شاشة الهاتف لاختبار تجربة زبائنك الحقيقية!</span>
          </div>
        </div>
      </div>

      {/* ── MODAL: BUTTON CUSTOMIZER ── */}
      {editingBtn && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.75)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '1rem',
        }}>
          <div style={{
            background: 'var(--bg-card, #111110)',
            border: '1px solid var(--border-bright, rgba(230,227,211,0.28))',
            borderRadius: '20px',
            width: '100%',
            maxWidth: '460px',
            padding: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            boxShadow: '0 20px 50px rgba(0,0,0,0.8)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0, display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                <Settings size={18} color="#38bdf8" />
                <span>تخصيص الزر</span>
              </h3>
              <button
                onClick={() => setEditingBtn(null)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '1.2rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            {/* Ultra-Modern Brand & AI Icon Picker */}
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                شعار / أيقونة الزر (Official Vector Brands & AI):
              </label>
              <StoreIconPicker
                selectedIcon={btnFormData.icon}
                onSelectIcon={(newIcon) => setBtnFormData({ ...btnFormData, icon: newIcon })}
              />
            </div>

            {/* Button Text */}
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                نص الزر:
              </label>
              <input
                type="text"
                placeholder="مثال: Spotify Premium 3M - 800 دج"
                value={btnFormData.text}
                onChange={(e) => setBtnFormData({ ...btnFormData, text: e.target.value })}
                className="tg-input"
              />
            </div>

            {/* Button Action */}
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                نوع الإجراء عند الضغط:
              </label>
              <select
                value={btnFormData.action}
                onChange={(e) => setBtnFormData({ ...btnFormData, action: e.target.value })}
                className="tg-input"
              >
                <option value="product">عرض وشراء منتج / باقة</option>
                <option value="wallet">شحن الرصيد ومعلومات الدفع</option>
                <option value="rules">قوانين وشروط المتجر</option>
                <option value="submenu">فتح قائمة أزرار فرعية (Submenu)</option>
                <option value="url">رابط خارجي (قناة / موقع)</option>
              </select>
            </div>

            {/* Conditional fields based on action */}
            {btnFormData.action === 'product' && (
              <div style={{ display: 'flex', gap: '8px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '3px' }}>
                    السعر المقترح (دج):
                  </label>
                  <input
                    type="number"
                    placeholder="مثال: 1000"
                    value={btnFormData.productPrice}
                    onChange={(e) => setBtnFormData({ ...btnFormData, productPrice: e.target.value })}
                    className="tg-input"
                  />
                </div>
              </div>
            )}

            {btnFormData.action === 'url' && (
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '3px' }}>
                  الرابط الخارجي (URL):
                </label>
                <input
                  type="text"
                  placeholder="https://t.me/..."
                  value={btnFormData.url}
                  onChange={(e) => setBtnFormData({ ...btnFormData, url: e.target.value })}
                  className="tg-input"
                  style={{ direction: 'ltr' }}
                />
              </div>
            )}

            {/* Modal Actions */}
            <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
              <button
                onClick={saveButtonEdit}
                className="btn btn-primary"
                style={{
                  flex: 1,
                  borderRadius: '10px',
                  padding: '8px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                }}
              >
                <Check size={14} />
                <span>حفظ التعديل</span>
              </button>
              <button
                onClick={() => setEditingBtn(null)}
                className="btn btn-secondary"
                style={{ borderRadius: '10px', padding: '8px 14px' }}
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── PRO LOCK OVERLAY (If not on Pro plan and trial expired) ── */}
      {!isPro && (
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(5, 5, 5, 0.88)',
          backdropFilter: 'blur(10px)',
          borderRadius: 'var(--radius-lg, 22px)',
          zIndex: 80,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
          textAlign: 'center',
        }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '20px',
            background: 'linear-gradient(135deg, rgba(16,185,129,0.2) 0%, rgba(14,165,233,0.2) 100%)',
            border: '1px solid rgba(16, 185, 129, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '1rem',
            boxShadow: '0 8px 30px rgba(16,185,129,0.25)',
            color: '#10b981',
          }}>
            <Sparkles size={32} />
          </div>
          <h3 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
            ميزة الباقة الاحترافية (Pro Plan)
          </h3>
          <p style={{ color: 'var(--text-secondary)', maxWidth: '460px', fontSize: '0.92rem', lineHeight: 1.7, marginBottom: '1.5rem' }}>
            استوديو متجر تيليغرام التفاعلي مع محاكي الهاتف وقناة اللوغز ونظام الاشتراك الإجباري متاح حصرياً للمشتركين بـ <strong>1,000 دج شهرياً فقط</strong>.
          </p>
          <button
            onClick={() => navigate('/billing')}
            className="btn btn-primary"
            style={{
              borderRadius: '999px',
              padding: '0.75rem 2rem',
              fontSize: '0.92rem',
              fontWeight: 800,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Sparkles size={16} />
            <span>ترقية حسابك الآن إلى Pro</span>
          </button>
        </div>
      )}
    </div>
  );
}
