import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { subscribeBots, createBot, updateBot } from '../services/firebase';
import TelegramStoreStudio, { STORE_TEMPLATES, serializeStoreRowsForFirestore } from '../components/telegram-store/TelegramStoreStudio';
import BotLoader from '../components/BotLoader';
import { Store, Sparkles, Headphones, Gamepad2, Plus, ArrowUpRight, CheckCircle2, Smartphone, Zap } from 'lucide-react';

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
    <div style={{ maxWidth: '1440px', margin: '0 auto', padding: '1.5rem', color: '#f1f5f9' }}>
      {/* ─── Page Header ─── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem',
        marginBottom: '1.75rem',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        paddingBottom: '1.25rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '46px',
            height: '46px',
            borderRadius: '14px',
            background: 'linear-gradient(135deg, rgba(14, 165, 233, 0.25) 0%, rgba(56, 189, 248, 0.1) 100%)',
            border: '1px solid rgba(56, 189, 248, 0.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#38bdf8',
          }}>
            <Store size={24} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h1 style={{ fontSize: '1.6rem', fontWeight: 800, margin: 0, color: '#ffffff' }}>
                استوديو متجر تيليغرام
              </h1>
              <span style={{
                background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                color: '#ffffff',
                fontSize: '0.72rem',
                fontWeight: 800,
                padding: '2px 8px',
                borderRadius: '8px',
                letterSpacing: '0.5px',
                boxShadow: '0 2px 8px rgba(2, 132, 199, 0.4)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3px',
              }}>
                <Sparkles size={10} />
                PRO
              </span>
            </div>
            <p style={{ margin: '3px 0 0', fontSize: '0.88rem', color: 'rgba(255, 255, 255, 0.6)' }}>
              صمّم متجر أزرار تفاعلي مستقل، مع قناة اللوغز المباشرة والاشتراك الإجباري ومحاكي حي فوري
            </p>
          </div>
        </div>

        {/* Header Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {stores.length > 1 && (
            <select
              value={selectedStoreId || ''}
              onChange={(e) => setSelectedStoreId(e.target.value)}
              style={{
                background: 'rgba(15, 23, 42, 0.8)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                color: '#ffffff',
                borderRadius: '10px',
                padding: '0.55rem 1rem',
                fontSize: '0.88rem',
                fontWeight: 600,
                outline: 'none',
              }}
            >
              {stores.map(s => (
                <option key={s.id} value={s.id} style={{ background: '#0f172a' }}>
                  {s.botName || s.businessName} (@{s.telegramUsername || 'bot'})
                </option>
              ))}
            </select>
          )}

          <button
            onClick={() => setShowCreateModal(true)}
            style={{
              background: 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)',
              color: '#ffffff',
              border: 'none',
              borderRadius: '10px',
              padding: '0.6rem 1.2rem',
              fontWeight: 700,
              fontSize: '0.88rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 4px 14px rgba(14, 165, 233, 0.35)',
            }}
          >
            <span style={{ fontSize: '1.1rem' }}>+</span>
            إنشاء متجر جديد
          </button>
        </div>
      </div>

      {/* ─── Zero Stores: Welcome Empty State ─── */}
      {stores.length === 0 ? (
        <div style={{
          background: 'rgba(15, 23, 42, 0.65)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '20px',
          padding: '3rem 2rem',
          textAlign: 'center',
          maxWidth: '680px',
          margin: '2rem auto',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)',
        }}>
          <div style={{
            width: '80px',
            height: '80px',
            borderRadius: '24px',
            background: 'linear-gradient(135deg, rgba(14, 165, 233, 0.2) 0%, rgba(56, 189, 248, 0.05) 100%)',
            border: '1px solid rgba(56, 189, 248, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1.5rem',
            color: '#38bdf8',
          }}>
            <Smartphone size={38} />
          </div>

          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.75rem', color: '#ffffff' }}>
            أهلاً بك في استوديو متاجر تيليغرام الرقمية!
          </h2>
          <p style={{ color: 'rgba(255, 255, 255, 0.65)', fontSize: '0.95rem', lineHeight: '1.7', marginBottom: '2rem' }}>
            لم تقم بإنشاء أي متجر تيليغرام بعد. ابدأ الآن بربط بوت تيليغرام الخاص بك في أقل من دقيقة، وتحكم في قوائم الأزرار، طرق الدفع (BaridiMob / CCP)، وقناة اللوغز المباشرة.
          </p>

          <button
            onClick={() => setShowCreateModal(true)}
            style={{
              background: 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)',
              color: '#ffffff',
              border: 'none',
              borderRadius: '12px',
              padding: '0.85rem 2rem',
              fontWeight: 800,
              fontSize: '1rem',
              cursor: 'pointer',
              boxShadow: '0 6px 20px rgba(14, 165, 233, 0.4)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <Plus size={18} />
            إنشاء متجري الأول الآن
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

      {/* ─── Create Store Modal ─── */}
      {showCreateModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '1rem',
        }}>
          <div style={{
            background: '#0b1329',
            border: '1px solid rgba(56, 189, 248, 0.3)',
            borderRadius: '20px',
            width: '100%',
            maxWidth: '540px',
            padding: '2rem',
            boxShadow: '0 25px 50px rgba(0, 0, 0, 0.5)',
            direction: 'rtl',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Store size={22} color="#38bdf8" />
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: '#ffffff' }}>
                  إنشاء متجر تيليغرام جديد
                </h3>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'rgba(255, 255, 255, 0.5)',
                  fontSize: '1.4rem',
                  cursor: 'pointer',
                }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateStore}>
              {/* Field 1: Store Name */}
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 700, marginBottom: '0.4rem', color: '#e2e8f0' }}>
                  اسم المتجر / النشاط *
                </label>
                <input
                  type="text"
                  placeholder="مثال: متجر الاشتراكات الرقمية، أو شحن الألعاب"
                  value={newStoreName}
                  onChange={(e) => setNewStoreName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.75rem 1rem',
                    background: 'rgba(15, 23, 42, 0.8)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '10px',
                    color: '#ffffff',
                    fontSize: '0.92rem',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                  required
                />
              </div>

              {/* Field 2: BotFather Token */}
              <div style={{ marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                  <label style={{ fontSize: '0.88rem', fontWeight: 700, color: '#e2e8f0' }}>
                    توكن البوت (Telegram Bot Token) *
                  </label>
                  <a
                    href="https://t.me/BotFather"
                    target="_blank"
                    rel="noreferrer"
                    style={{ fontSize: '0.78rem', color: '#38bdf8', textDecoration: 'none', fontWeight: 600 }}
                  >
                    استخرج التوكن من @BotFather ↗
                  </a>
                </div>
                <input
                  type="text"
                  placeholder="1234567890:ABCdefGhIJKlmNoPQRsTUVwxyZ..."
                  value={newStoreToken}
                  onChange={(e) => setNewStoreToken(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.75rem 1rem',
                    background: 'rgba(15, 23, 42, 0.8)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '10px',
                    color: '#ffffff',
                    fontSize: '0.92rem',
                    outline: 'none',
                    fontFamily: 'monospace',
                    direction: 'ltr',
                    textAlign: 'left',
                    boxSizing: 'border-box',
                  }}
                  required
                />
              </div>

              {/* Field 3: Template Selector */}
              <div style={{ marginBottom: '1.75rem' }}>
                <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 700, marginBottom: '0.5rem', color: '#e2e8f0' }}>
                  اختر القالب المبدئي للمتجر:
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div
                    onClick={() => setSelectedTemplateKey('subscriptions')}
                    style={{
                      border: selectedTemplateKey === 'subscriptions' ? '2px solid #0ea5e9' : '1px solid rgba(255, 255, 255, 0.1)',
                      background: selectedTemplateKey === 'subscriptions' ? 'rgba(14, 165, 233, 0.15)' : 'rgba(15, 23, 42, 0.6)',
                      borderRadius: '12px',
                      padding: '0.85rem',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px', color: '#38bdf8' }}>
                      <Headphones size={20} />
                      <Sparkles size={16} />
                    </div>
                    <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#ffffff' }}>اشتراكات وتطبيقات</div>
                    <div style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.6)', marginTop: '2px' }}>
                      Gemini, Spotify, Duolingo, Netflix
                    </div>
                  </div>

                  <div
                    onClick={() => setSelectedTemplateKey('gaming')}
                    style={{
                      border: selectedTemplateKey === 'gaming' ? '2px solid #0ea5e9' : '1px solid rgba(255, 255, 255, 0.1)',
                      background: selectedTemplateKey === 'gaming' ? 'rgba(14, 165, 233, 0.15)' : 'rgba(15, 23, 42, 0.6)',
                      borderRadius: '12px',
                      padding: '0.85rem',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px', color: '#38bdf8' }}>
                      <Gamepad2 size={20} />
                      <Zap size={16} />
                    </div>
                    <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#ffffff' }}>شحن ألعاب وبطاقات</div>
                    <div style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.6)', marginTop: '2px' }}>
                      Free Fire, PUBG, بطاقات شحن
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  style={{
                    background: 'rgba(255, 255, 255, 0.08)',
                    color: '#e2e8f0',
                    border: 'none',
                    borderRadius: '10px',
                    padding: '0.7rem 1.4rem',
                    fontSize: '0.88rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  إلغاء
                </button>

                <button
                  type="submit"
                  disabled={creating}
                  style={{
                    background: 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '10px',
                    padding: '0.7rem 1.75rem',
                    fontSize: '0.92rem',
                    fontWeight: 700,
                    cursor: creating ? 'not-allowed' : 'pointer',
                    boxShadow: '0 4px 15px rgba(14, 165, 233, 0.35)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  {creating ? 'جاري الإنشاء...' : (
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
