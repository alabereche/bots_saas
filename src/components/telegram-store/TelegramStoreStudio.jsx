import React, { useState, useEffect } from 'react';
import TelegramPhoneMockup from './TelegramPhoneMockup';
import StoreIcon, { STORE_ICON_OPTIONS, stripEmojis } from './StoreIcons';
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
  ExternalLink,
  Save,
  Image,
  MessageSquare,
  HelpCircle,
  Check,
  Headphones,
  Gamepad2,
  Smartphone,
} from 'lucide-react';

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
  const [rows, setRows] = useState(() => {
    const parsed = parseStoreRows(initialStore);
    return (parsed && parsed.length > 0) ? parsed : STORE_TEMPLATES.subscriptions.rows;
  });

  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('buttons'); // 'buttons' | 'channels' | 'settings'
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
      <div style={{
        background: 'var(--bg-card, #111110)',
        border: '1px solid var(--border-default, rgba(230, 227, 211, 0.14))',
        borderRadius: 'var(--radius-lg, 22px)',
        padding: '1.25rem 1.5rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem',
        boxShadow: 'var(--shadow-card)',
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
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: '3px 0 0' }}>
              صمّم متجر أزرار حقيقي لتيليغرام مع اشتراك إجباري وقناة بث لوغز تلقائية.
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Main Toggle */}
          <label style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            cursor: 'pointer',
            padding: '0.45rem 0.9rem',
            borderRadius: '999px',
            background: enabled ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255,255,255,0.05)',
            border: enabled ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(255,255,255,0.1)',
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
      <div className="tg-studio-mobile-switch">
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
          <div style={{
            display: 'flex',
            gap: '8px',
            background: 'var(--bg-card, #111110)',
            padding: '6px',
            borderRadius: 'var(--radius-md, 16px)',
            border: '1px solid var(--border-default)',
            overflowX: 'auto',
            scrollbarWidth: 'none',
          }}>
            <button
              onClick={() => setActiveTab('buttons')}
              style={{
                flex: 1,
                padding: '8px 14px',
                borderRadius: '10px',
                border: 'none',
                background: activeTab === 'buttons' ? 'var(--color-primary-subtle, rgba(16, 185, 129, 0.15))' : 'transparent',
                color: activeTab === 'buttons' ? '#34d399' : 'var(--text-secondary)',
                fontWeight: activeTab === 'buttons' ? 700 : 500,
                fontSize: '0.85rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                transition: 'all 0.2s',
              }}
            >
              <SlidersHorizontal size={15} />
              <span>شبكة الأزرار التفاعلية</span>
            </button>

            <button
              onClick={() => setActiveTab('channels')}
              style={{
                flex: 1,
                padding: '8px 14px',
                borderRadius: '10px',
                border: 'none',
                background: activeTab === 'channels' ? 'rgba(14, 165, 233, 0.15)' : 'transparent',
                color: activeTab === 'channels' ? '#38bdf8' : 'var(--text-secondary)',
                fontWeight: activeTab === 'channels' ? 700 : 500,
                fontSize: '0.85rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                transition: 'all 0.2s',
              }}
            >
              <Megaphone size={15} />
              <span>قناة اللوغز والاشتراك الإجباري</span>
            </button>

            <button
              onClick={() => setActiveTab('settings')}
              style={{
                flex: 1,
                padding: '8px 14px',
                borderRadius: '10px',
                border: 'none',
                background: activeTab === 'settings' ? 'rgba(245, 158, 11, 0.15)' : 'transparent',
                color: activeTab === 'settings' ? '#fbbf24' : 'var(--text-secondary)',
                fontWeight: activeTab === 'settings' ? 700 : 500,
                fontSize: '0.85rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                transition: 'all 0.2s',
              }}
            >
              <Settings size={15} />
              <span>البانر والمحفظة والقوانين</span>
            </button>
          </div>

          {/* TAB 1: Buttons Grid Builder */}
          {activeTab === 'buttons' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Preset Templates Strip */}
              <div style={{
                background: 'var(--bg-card, #111110)',
                border: '1px solid var(--border-default)',
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
                          onClick={() => addButtonToRow(rIdx)}
                          title="إضافة زر إضافي بجانب هذا الصف (حد أقصى 3)"
                          style={{
                            background: 'rgba(14, 165, 233, 0.1)',
                            border: '1px solid rgba(14, 165, 233, 0.25)',
                            borderRadius: '6px',
                            color: '#38bdf8',
                            cursor: 'pointer',
                            padding: '3px 8px',
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
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {row.map((btn, bIdx) => (
                        <div
                          key={btn.id || bIdx}
                          style={{
                            flex: 1,
                            minWidth: '130px',
                            background: 'rgba(24, 36, 59, 0.45)',
                            border: '1px solid rgba(14, 165, 233, 0.2)',
                            borderRadius: '10px',
                            padding: '10px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '8px',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: '24px',
                              height: '24px',
                              borderRadius: '6px',
                              background: 'rgba(14, 165, 233, 0.15)',
                              color: '#38bdf8',
                              flexShrink: 0,
                            }}>
                              <StoreIcon icon={btn.icon} size={14} />
                            </span>
                            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                {stripEmojis(btn.text)}
                              </div>
                              <div style={{
                                fontSize: '0.7rem',
                                color: '#0ea5e9',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '3px',
                                marginTop: '2px',
                              }}>
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

                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <button
                              onClick={() => openEditModal(rIdx, bIdx)}
                              style={{
                                background: 'rgba(255,255,255,0.08)',
                                border: 'none',
                                borderRadius: '6px',
                                color: 'var(--text-primary)',
                                padding: '4px 8px',
                                fontSize: '0.75rem',
                                cursor: 'pointer',
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
                                onClick={() => removeButtonFromRow(rIdx, bIdx)}
                                style={{
                                  background: 'transparent',
                                  border: 'none',
                                  color: '#fb7185',
                                  cursor: 'pointer',
                                  fontSize: '0.8rem',
                                }}
                              >
                                ✕
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
              <div style={{
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(14, 165, 233, 0.2)',
                borderRadius: '12px',
                padding: '14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#38bdf8' }}>
                    1. قناة الاشتراك الإجباري (Force Subscribe)
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={forceSubscribeEnabled}
                      onChange={(e) => setForceSubscribeEnabled(e.target.checked)}
                      style={{ accentColor: '#0ea5e9' }}
                    />
                    تفعيل الشرط
                  </label>
                </div>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: 0 }}>
                  لن يفتح المتجر للزبون حتى ينضم لهذه القناة أولاً ويتحقق البوت من اشتراكه.
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>@</span>
                  <input
                    type="text"
                    placeholder="اسم_القناة (مثال: my_store_channel)"
                    value={forceSubscribeChannel}
                    onChange={(e) => setForceSubscribeChannel(e.target.value)}
                    style={{
                      flex: 1,
                      background: 'var(--bg-app)',
                      border: '1px solid var(--border-default)',
                      borderRadius: '8px',
                      padding: '8px 12px',
                      color: 'var(--text-primary)',
                      fontSize: '0.85rem',
                      direction: 'ltr',
                    }}
                  />
                </div>
                <div style={{ fontSize: '0.72rem', color: '#f59e0b', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                  <HelpCircle size={13} />
                  <span>ملاحظة: يجب إضافة البوت كـ Administrator في قناتك ليتمكن من فحص اشتراك الأعضاء.</span>
                </div>
              </div>

              {/* Logs Channel */}
              <div style={{
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(16, 185, 129, 0.2)',
                borderRadius: '12px',
                padding: '14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#34d399' }}>
                  2. قناة بث اللوغز والمبيعات الحية (Live Logs Channel)
                </label>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: 0 }}>
                  قناة بث للقراءة فقط ينشر فيها البوت تلقائياً: *"تم شراء Spotify Premium | تم التسليم بنجاح"*.
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>@</span>
                  <input
                    type="text"
                    placeholder="اسم_قناة_اللوغز (مثال: my_store_logs)"
                    value={logsChannelId}
                    onChange={(e) => setLogsChannelId(e.target.value)}
                    style={{
                      flex: 1,
                      background: 'var(--bg-app)',
                      border: '1px solid var(--border-default)',
                      borderRadius: '8px',
                      padding: '8px 12px',
                      color: 'var(--text-primary)',
                      fontSize: '0.85rem',
                      direction: 'ltr',
                    }}
                  />
                </div>
                <div style={{ fontSize: '0.72rem', color: '#34d399', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                  <CheckCircle2 size={13} color="#34d399" />
                  <span>ينشر البوت العمليات بشكل مجهول الهوية لحماية خصوصية زبائنك وبناء ثقة هائلة للجدد!</span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Banner, Wallet & Rules */}
          {activeTab === 'settings' && (
            <div style={{
              background: 'var(--bg-card, #111110)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-md, 16px)',
              padding: '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.25rem',
            }}>
              {/* Banner Image URL */}
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '5px' }}>
                  <Image size={15} />
                  <span>صورة بانر المتجر (تظهر في رأس قائمة الأزرار)</span>
                </label>
                <input
                  type="text"
                  placeholder="https://... رابط صورة عريض عالي الدقة"
                  value={bannerUrl}
                  onChange={(e) => setBannerUrl(e.target.value)}
                  style={{
                    width: '100%',
                    background: 'var(--bg-app)',
                    border: '1px solid var(--border-default)',
                    borderRadius: '8px',
                    padding: '8px 12px',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem',
                    direction: 'ltr',
                  }}
                />
              </div>

              {/* Welcome Greeting */}
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '5px' }}>
                  <MessageSquare size={15} />
                  <span>رسالة الترحيب الأولى للمتجر</span>
                </label>
                <textarea
                  rows="3"
                  value={welcomeMessage}
                  onChange={(e) => setWelcomeMessage(e.target.value)}
                  style={{
                    width: '100%',
                    background: 'var(--bg-app)',
                    border: '1px solid var(--border-default)',
                    borderRadius: '8px',
                    padding: '8px 12px',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem',
                    lineHeight: 1.6,
                  }}
                />
              </div>

              {/* Wallet Info */}
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', fontWeight: 700, color: '#38bdf8', marginBottom: '5px' }}>
                  <CreditCard size={15} color="#38bdf8" />
                  <span>معلومات شحن المحفظة والحسابات البنكية (BaridiMob / CCP)</span>
                </label>
                <textarea
                  rows="3"
                  value={walletInfo}
                  onChange={(e) => setWalletInfo(e.target.value)}
                  style={{
                    width: '100%',
                    background: 'var(--bg-app)',
                    border: '1px solid var(--border-default)',
                    borderRadius: '8px',
                    padding: '8px 12px',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem',
                    lineHeight: 1.6,
                  }}
                />
              </div>

              {/* Rules Text */}
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', fontWeight: 700, color: '#f59e0b', marginBottom: '5px' }}>
                  <FileText size={15} color="#f59e0b" />
                  <span>شروط وضمان المتجر</span>
                </label>
                <textarea
                  rows="3"
                  value={rulesText}
                  onChange={(e) => setRulesText(e.target.value)}
                  style={{
                    width: '100%',
                    background: 'var(--bg-app)',
                    border: '1px solid var(--border-default)',
                    borderRadius: '8px',
                    padding: '8px 12px',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem',
                    lineHeight: 1.6,
                  }}
                />
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
            products={bot?.products || []}
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

            {/* Quick SVG Icon Picker */}
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                أيقونة الزر (SVG Vector Icon):
              </label>
              <div style={{
                display: 'flex',
                gap: '6px',
                flexWrap: 'wrap',
                maxHeight: '130px',
                overflowY: 'auto',
                padding: '6px',
                background: 'rgba(0,0,0,0.25)',
                borderRadius: '10px',
                border: '1px solid rgba(255,255,255,0.06)',
              }}>
                <button
                  type="button"
                  onClick={() => setBtnFormData({ ...btnFormData, icon: '' })}
                  title="بدون أيقونة"
                  style={{
                    background: !btnFormData.icon ? 'rgba(16, 185, 129, 0.25)' : 'rgba(255,255,255,0.06)',
                    border: !btnFormData.icon ? '1px solid #10b981' : '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                    fontSize: '0.75rem',
                    padding: '6px 10px',
                    color: !btnFormData.icon ? '#34d399' : 'var(--text-secondary)',
                    cursor: 'pointer',
                  }}
                >
                  بدون أيقونة
                </button>
                {STORE_ICON_OPTIONS.map(({ id, label, Icon }) => {
                  const isSelected = btnFormData.icon === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setBtnFormData({ ...btnFormData, icon: id })}
                      title={label}
                      style={{
                        background: isSelected ? 'rgba(14, 165, 233, 0.3)' : 'rgba(255,255,255,0.05)',
                        border: isSelected ? '1px solid #0ea5e9' : '1px solid rgba(255,255,255,0.08)',
                        borderRadius: '8px',
                        padding: '7px 10px',
                        color: isSelected ? '#38bdf8' : '#e2e8f0',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '5px',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <Icon size={16} />
                    </button>
                  );
                })}
              </div>
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
                style={{
                  width: '100%',
                  background: 'var(--bg-app)',
                  border: '1px solid var(--border-default)',
                  borderRadius: '8px',
                  padding: '8px 12px',
                  color: 'var(--text-primary)',
                  fontSize: '0.85rem',
                }}
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
                style={{
                  width: '100%',
                  background: 'var(--bg-app)',
                  border: '1px solid var(--border-default)',
                  borderRadius: '8px',
                  padding: '8px 12px',
                  color: 'var(--text-primary)',
                  fontSize: '0.85rem',
                }}
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
                    style={{
                      width: '100%',
                      background: 'var(--bg-app)',
                      border: '1px solid var(--border-default)',
                      borderRadius: '8px',
                      padding: '8px 10px',
                      color: 'var(--text-primary)',
                      fontSize: '0.85rem',
                    }}
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
                  style={{
                    width: '100%',
                    background: 'var(--bg-app)',
                    border: '1px solid var(--border-default)',
                    borderRadius: '8px',
                    padding: '8px 10px',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem',
                    direction: 'ltr',
                  }}
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
