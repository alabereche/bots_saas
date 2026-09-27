import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { subscribeBots, createBot, updateBot } from '../services/firebase';
import TelegramStoreStudio, { STORE_TEMPLATES, serializeStoreRowsForFirestore } from '../components/telegram-store/TelegramStoreStudio';
import BotLoader from '../components/BotLoader';
import { Store, Sparkles, Headphones, Gamepad2, Plus, ArrowUpRight, Smartphone, Zap } from 'lucide-react';

const ENGINE_URL = import.meta.env.VITE_WHATSAPP_ENGINE_URL || 'https://wa.nosfir.online';

export default function TelegramStorePage() {
  const { user } = useAuth();
  const toast = useToast();

  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedStoreId, setSelectedStoreId] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // New store form
  const [newStoreName, setNewStoreName] = useState('');
  const [newStoreToken, setNewStoreToken] = useState('');
  const [selectedTemplateKey, setSelectedTemplateKey] = useState('subscriptions');
  const [creating, setCreating] = useState(false);

  // Pro Plan check
  const [planData, setPlanData] = useState(null);
  useEffect(() => {
    (async () => {
      try {
        const token = await user?.getIdToken();
        if (token) {
          const res = await fetch(`${ENGINE_URL}/api/billing/plan`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) setPlanData(await res.json());
        }
      } catch { /* offline fallback */ }
    })();
  }, [user]);

  const isPro = planData ? (planData.plan === 'pro' || planData.isTrial) : true;

  // Subscribe to user bots filtered by telegram_store
  useEffect(() => {
    if (!user) return;
    setLoading(true);
    const unsubscribe = subscribeBots(user.uid, (allBots) => {
      const storeBots = (allBots || []).filter(
        b => b.businessType === 'telegram_store' || b.telegramStore?.enabled === true
      );
      setStores(storeBots);
      setLoading(false);

      // Auto-select first store if none selected
      setSelectedStoreId(prev => {
        if (prev && storeBots.some(s => s.id === prev)) return prev;
        return storeBots.length > 0 ? storeBots[0].id : null;
      });
    });

    return () => unsubscribe();
  }, [user]);

  const handleCreateStore = async (e) => {
    e.preventDefault();
    if (!newStoreName.trim()) {
      toast.error('يرجى كتابة اسم المتجر');
      return;
    }
    if (!newStoreToken.trim()) {
      toast.error('يرجى إدخال توكن البوت من BotFather');
      return;
    }

    setCreating(true);
    try {
      const templateData = STORE_TEMPLATES[selectedTemplateKey] || STORE_TEMPLATES.subscriptions;
      const { rowsJson } = serializeStoreRowsForFirestore(templateData.rows);

      const storePayload = {
        userId: user.uid,
        botName: newStoreName.trim(),
        businessName: newStoreName.trim(),
        businessType: 'telegram_store',
        platform: 'telegram',
        channels: ['telegram'],
        telegramEnabled: true,
        telegramToken: newStoreToken.trim(),
        whatsappEnabled: false,
        isActive: true,
        responseStyle: 'concise',
        customInstructions: 'هذا البوت متجر تيليغرام تفاعلي رسمي. أجب باختصار شديد ووجه الزبائن دائماً لاستخدام أزرار المتجر للشراء والدفع.',
        features: {
          catalog: true,
          orders: true,
          orderTracking: true,
          delivery: false,
          notifications: true,
          bookings: false,
          webhooks: true,
        },
        telegramStore: {
          enabled: true,
          bannerUrl: templateData.bannerUrl,
          welcomeMessage: templateData.welcomeMessage,
          walletInfo: templateData.walletInfo,
          rulesText: templateData.rulesText,
          forceSubscribeEnabled: false,
          forceSubscribeChannel: '',
          logsChannelId: '',
          rowsJson,
        },
      };

      const created = await createBot(storePayload);
      toast.success('تم إنشاء متجر تيليغرام بنجاح!');
      setSelectedStoreId(created.id);
      setShowCreateModal(false);
      setNewStoreName('');
      setNewStoreToken('');
    } catch (err) {
      toast.error(err.message || 'حدث خطأ أثناء إنشاء المتجر');
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return <BotLoader />;
  }

  const activeStore = stores.find(s => s.id === selectedStoreId) || stores[0];

  return (
    <div className="tg-store-page-container">
      {/* ─── Page Header ─── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem',
        marginBottom: '1.25rem',
        borderBottom: '1px solid var(--border-subtle)',
        paddingBottom: '1rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '46px',
            height: '46px',
            borderRadius: '14px',
            background: 'var(--veil-1)',
            border: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--color-primary)',
          }}>
            <Store size={24} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h1 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                استوديو متجر تيليغرام
              </h1>
              <span style={{
                background: 'rgba(16, 185, 129, 0.15)',
                color: 'var(--color-primary)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                fontSize: '0.72rem',
                fontWeight: 800,
                padding: '2px 8px',
                borderRadius: '6px',
                letterSpacing: '0.5px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3px',
              }}>
                <Sparkles size={10} />
                PRO
              </span>
            </div>
            <p className="tg-hide-mobile" style={{ margin: '3px 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              صمّم متجر أزرار تفاعلي مستقل، مع قناة اللوغز المباشرة والاشتراك الإجباري ومحاكي حي فوري
            </p>
          </div>
        </div>

        {/* Header Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {stores.length > 1 && (
            <select
              value={selectedStoreId || ''}
              onChange={(e) => setSelectedStoreId(e.target.value)}
              className="form-select"
              style={{
                borderRadius: '10px',
                padding: '0.55rem 1rem',
                fontSize: '0.85rem',
                fontWeight: 600,
                width: 'auto',
                minWidth: '200px',
              }}
            >
              {stores.map(s => (
                <option key={s.id} value={s.id}>
                  {s.botName || s.businessName} (@{s.telegramUsername || 'bot'})
                </option>
              ))}
            </select>
          )}

          {activeStore && (
            <Link
              to={`/bot/${activeStore.id}`}
              className="btn btn-secondary"
              style={{
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontWeight: 700,
                padding: '0.6rem 1.1rem',
              }}
            >
              <span>إدارة الطلبات والمحادثات</span>
              <ArrowUpRight size={15} />
            </Link>
          )}

          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="btn btn-primary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontWeight: 700,
              padding: '0.6rem 1.2rem',
            }}
          >
            <Plus size={16} />
            <span>إنشاء متجر جديد</span>
          </button>
        </div>
      </div>

      {/* ─── Zero Stores: Welcome Empty State ─── */}
      {stores.length === 0 ? (
        <div className="card" style={{
          textAlign: 'center',
          maxWidth: '680px',
          margin: '2rem auto',
          padding: '3rem 2rem',
        }}>
          <div style={{
            width: '80px',
            height: '80px',
            borderRadius: '24px',
            background: 'var(--veil-1)',
            border: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1.5rem',
            color: 'var(--color-primary)',
          }}>
            <Smartphone size={38} />
          </div>

          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '0.75rem', color: 'var(--text-primary)' }}>
            أهلاً بك في استوديو متاجر تيليغرام الرقمية!
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', lineHeight: '1.7', marginBottom: '2rem' }}>
            لم تقم بإنشاء أي متجر تيليغرام بعد. ابدأ الآن بربط بوت تيليغرام الخاص بك في أقل من دقيقة، وتحكم في قوائم الأزرار، طرق الدفع (BaridiMob / CCP)، وقناة اللوغز المباشرة.
          </p>

          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="btn btn-primary"
            style={{
              padding: '0.85rem 2rem',
              fontWeight: 800,
              fontSize: '0.95rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <Plus size={18} />
            <span>إنشاء متجري الأول الآن</span>
          </button>
        </div>
      ) : (
        /* ─── Active Store Visual Studio ─── */
        activeStore && (
          <div>
            <TelegramStoreStudio
              bot={activeStore}
              onUpdateBot={async (data) => {
                await updateBot(activeStore.id, data);
                setStores(prev => prev.map(s => s.id === activeStore.id ? { ...s, ...data } : s));
              }}
              isPro={isPro}
            />
          </div>
        )
      )}

      {/* ─── Create Store Modal (Unified Modal Design) ─── */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => !creating && setShowCreateModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '540px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Store size={22} color="var(--color-primary)" />
                <h3 className="modal-title" style={{ margin: 0 }}>
                  إنشاء متجر تيليغرام جديد
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-tertiary)',
                  fontSize: '1.3rem',
                  cursor: 'pointer',
                }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateStore}>
              {/* Field 1: Store Name */}
              <div className="form-group" style={{ marginBottom: '1.1rem' }}>
                <label className="form-label">
                  اسم المتجر / النشاط *
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="مثال: متجر الاشتراكات الرقمية، أو شحن الألعاب"
                  value={newStoreName}
                  onChange={(e) => setNewStoreName(e.target.value)}
                  required
                />
              </div>

              {/* Field 2: BotFather Token */}
              <div className="form-group" style={{ marginBottom: '1.1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                  <label className="form-label" style={{ margin: 0 }}>
                    توكن البوت (Telegram Bot Token) *
                  </label>
                  <a
                    href="https://t.me/BotFather"
                    target="_blank"
                    rel="noreferrer"
                    style={{ fontSize: '0.78rem', color: 'var(--color-primary)', textDecoration: 'none', fontWeight: 600 }}
                  >
                    استخرج التوكن من @BotFather ↗
                  </a>
                </div>
                <input
                  type="text"
                  className="form-input"
                  placeholder="1234567890:ABCdefGhIJKlmNoPQRsTUVwxyZ..."
                  value={newStoreToken}
                  onChange={(e) => setNewStoreToken(e.target.value)}
                  dir="ltr"
                  style={{ fontFamily: 'monospace' }}
                  required
                />
              </div>

              {/* Field 3: Template Selector */}
              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label className="form-label">
                  اختر القالب المبدئي للمتجر:
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div
                    onClick={() => setSelectedTemplateKey('subscriptions')}
                    style={{
                      border: selectedTemplateKey === 'subscriptions' ? '2px solid var(--color-primary)' : '1px solid var(--border-subtle)',
                      background: selectedTemplateKey === 'subscriptions' ? 'var(--veil-2)' : 'var(--veil-1)',
                      borderRadius: '12px',
                      padding: '0.85rem',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px', color: 'var(--color-primary)' }}>
                      <Headphones size={20} />
                      <Sparkles size={16} />
                    </div>
                    <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-primary)' }}>اشتراكات وتطبيقات</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                      Gemini, Spotify, Duolingo, Netflix
                    </div>
                  </div>

                  <div
                    onClick={() => setSelectedTemplateKey('gaming')}
                    style={{
                      border: selectedTemplateKey === 'gaming' ? '2px solid var(--color-primary)' : '1px solid var(--border-subtle)',
                      background: selectedTemplateKey === 'gaming' ? 'var(--veil-2)' : 'var(--veil-1)',
                      borderRadius: '12px',
                      padding: '0.85rem',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px', color: 'var(--color-primary)' }}>
                      <Gamepad2 size={20} />
                      <Zap size={16} />
                    </div>
                    <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-primary)' }}>شحن ألعاب وبطاقات</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                      Free Fire, PUBG, بطاقات شحن
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowCreateModal(false)}
                >
                  إلغاء
                </button>

                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={creating}
                  style={{ gap: '8px' }}
                >
                  {creating ? (
                    'جاري الإنشاء...'
                  ) : (
                    <>
                      <Store size={16} />
                      <span>إنشاء المتجر وفتح الاستوديو</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
