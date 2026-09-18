import { useState, useEffect, useRef, Fragment } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../context/ToastContext';
import { auth } from '../services/firebase';
import { COUNTRIES, getCountryByCode } from '../data/countries';

const WHATSAPP_ENGINE_URL = import.meta.env.VITE_WHATSAPP_ENGINE_URL || 'https://wa.nosfir.online';

async function engineHeaders(json = true) {
  const token = await auth.currentUser?.getIdToken();
  const headers = { Authorization: `Bearer ${token || ''}` };
  if (json) headers['Content-Type'] = 'application/json';
  return headers;
}

export default function ChannelsManager({ bot, onUpdateBot }) {
  const toast = useToast();
  const navigate = useNavigate();
  
  // WhatsApp States
  const [waStatus, setWaStatus] = useState(bot?.whatsappStatus || 'not_initialized');
  // Engine self-update (owner-only): the engine returns 403 for merchant
  // accounts, so the button simply never renders for them
  const [engineUpdate, setEngineUpdate] = useState(null); // {installed, latest}
  const [engineUpdating, setEngineUpdating] = useState(false);
  const [engineUpdateDone, setEngineUpdateDone] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState(null);
  const [pairingCode, setPairingCode] = useState(null);
  const [pairingExpiresAt, setPairingExpiresAt] = useState(null);
  const [timeLeft, setTimeLeft] = useState(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [pairingTtlSeconds, setPairingTtlSeconds] = useState(null);
  const [waConnecting, setWaConnecting] = useState(false);
  const [waCanceling, setWaCanceling] = useState(false);
  const [showWaModal, setShowWaModal] = useState(false);
  const [connectTab, setConnectTab] = useState('phone'); // 'phone' | 'qr'
  const pollDeadlineRef = useRef(0);
  const expiryNotifiedRef = useRef(false);
  const lastQrRef = useRef(null);
  const lastPairingRef = useRef(null);
  // Auto-following the engine's actual mode (QR vs phone code) stops as soon
  // as the user manually picks a tab — never fight them afterwards.
  const userPickedTabRef = useRef(false);

  // Plan-aware channel gating (free = one channel per bot)
  const [planLimits, setPlanLimits] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${WHATSAPP_ENGINE_URL}/api/billing/plan`, { headers: await engineHeaders(false) });
        if (res.ok && !cancelled) setPlanLimits((await res.json()).limits || null);
      } catch { /* gating stays server-side even if this fails */ }
    })();
    return () => { cancelled = true; };
  }, []);
  
  // Phone inputs for pairing
  const initialCountry = getCountryByCode(bot?.country || 'DZ');
  const [selectedCountryCode, setSelectedCountryCode] = useState(initialCountry.code);
  const [phoneNumberInput, setPhoneNumberInput] = useState('');

  // Telegram States
  const [tgToken, setTgToken] = useState(bot?.telegramToken || '');
  const [tgSaving, setTgSaving] = useState(false);
  const [showTgModal, setShowTgModal] = useState(false);

  // Adopt a pairing code + its TTL window (shared by probe & polling).
  // A regenerated code restarts the TTL — keeping the old expiry would
  // instantly expire a brand-new code.
  const adoptPairing = (code, expiresAt) => {
    const isNew = lastPairingRef.current !== code;
    lastPairingRef.current = code;
    setPairingCode(code);
    if (isNew) {
      const exp = expiresAt || Date.now() + 180000;
      setPairingExpiresAt(exp);
      setPairingTtlSeconds(Math.max(1, Math.round((exp - Date.now()) / 1000)));
      expiryNotifiedRef.current = false;
    }
  };

  // Probe once whenever the modal opens: if the engine still holds a live
  // session (leftover QR / still booting / already connected), adopt it
  // immediately instead of showing a blank form that only "works" after
  // closing and reopening the window.
  useEffect(() => {
    if (!showWaModal) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${WHATSAPP_ENGINE_URL}/api/whatsapp/${bot.id}/qr`, { headers: await engineHeaders(false) });
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (cancelled) return;

        if (data.status === 'connected' || data.status === 'authenticated') {
          setWaStatus('connected');
          setQrDataUrl(null);
          setPairingCode(null);
          setPairingExpiresAt(null);
          if (onUpdateBot) onUpdateBot({ whatsappStatus: 'connected', whatsappEnabled: true }).catch(() => {});
        } else if (data.qrDataUrl) {
          setConnectTab('qr');
          setQrDataUrl(data.qrDataUrl);
          setWaStatus('waiting_scan');
        } else if (data.pairingCode) {
          setConnectTab('phone');
          adoptPairing(data.pairingCode, data.pairingCodeExpiresAt);
          setWaStatus('waiting_scan');
        } else if (data.status === 'initializing') {
          setWaStatus(prev => (['initializing', 'waiting_scan'].includes(prev) ? prev : 'initializing'));
        }
      } catch { /* engine unreachable — keep current view */ }
    })();
    return () => { cancelled = true; };
  }, [showWaModal, bot.id]);

  // Live polling while linking — first tick is immediate (no dead 2.5s gap),
  // and a hard deadline stops abandoned sessions from polling forever.
  useEffect(() => {
    if (waStatus !== 'waiting_scan' && waStatus !== 'initializing') return;
    let stopped = false;
    pollDeadlineRef.current = Date.now() + 5 * 60 * 1000;

    const tick = async () => {
      if (stopped) return;
      if (Date.now() > pollDeadlineRef.current) {
        stopped = true;
        handleWaCancel(true);
        toast.warning('انتهت مهلة انتظار الربط — تم إيقاف المحاولة، حاول من جديد');
        return;
      }
      try {
        const res = await fetch(`${WHATSAPP_ENGINE_URL}/api/whatsapp/${bot.id}/qr`, { headers: await engineHeaders(false) });
        if (!res.ok || stopped) return;
        const data = await res.json();
        if (stopped) return;

        if (data.qrDataUrl) {
          if (lastQrRef.current !== data.qrDataUrl) {
            lastQrRef.current = data.qrDataUrl;
            pollDeadlineRef.current = Date.now() + 5 * 60 * 1000; // fresh code = fresh scan window
          }
          setQrDataUrl(data.qrDataUrl);
          setWaStatus('waiting_scan');
          if (!userPickedTabRef.current) setConnectTab(prev => (prev === 'phone' ? 'qr' : prev));
        }
        if (data.pairingCode) {
          if (lastPairingRef.current !== data.pairingCode) {
            pollDeadlineRef.current = Date.now() + 5 * 60 * 1000;
          }
          adoptPairing(data.pairingCode, data.pairingCodeExpiresAt);
          setWaStatus('waiting_scan');
          if (!userPickedTabRef.current) setConnectTab(prev => (prev === 'qr' ? 'phone' : prev));
        }
        if (data.status === 'connected' || data.status === 'authenticated') {
          stopped = true;
          setWaStatus('connected');
          setQrDataUrl(null);
          setPairingCode(null);
          setPairingExpiresAt(null);
          setShowWaModal(false);
          if (onUpdateBot) onUpdateBot({ whatsappStatus: 'connected', whatsappEnabled: true }).catch(() => {});
          toast.success('تم ربط حساب واتساب بنجاح!');
        }
      } catch (err) {
        console.warn('WhatsApp status poll error:', err.message);
      }
    };

    tick();
    const interval = setInterval(tick, 2500);
    return () => { stopped = true; clearInterval(interval); };
  }, [waStatus, bot.id]);

  // Countdown timer for the pairing code TTL (engine issues 180s codes)
  useEffect(() => {
    if (!pairingExpiresAt) {
      setTimeLeft(null);
      return;
    }
    const updateTimer = () => {
      const remaining = Math.max(0, Math.floor((pairingExpiresAt - Date.now()) / 1000));
      setTimeLeft(remaining);
      if (remaining <= 0) {
        setPairingCode(null);
        setPairingExpiresAt(null);
        setPairingTtlSeconds(null);
        if (!expiryNotifiedRef.current) {
          expiryNotifiedRef.current = true;
          toast.warning('انتهت صلاحية كود الربط — اضغط «توليد كود الربط السريع» للحصول على كود جديد');
        }
      }
    };
    updateTimer();
    const timer = setInterval(updateTimer, 1000);
    return () => clearInterval(timer);
  }, [pairingExpiresAt]);

  // Handle WhatsApp Connect (QR or Phone Pairing)
  const handleWaConnect = async (mode = connectTab) => {
    let fullInternationalPhone = null;

    if (mode === 'phone') {
      const country = getCountryByCode(selectedCountryCode);
      const cleanInput = phoneNumberInput.trim().replace(/\D/g, '');
      if (!cleanInput) {
        toast.error('يرجى إدخال رقم الهاتف المرتبط بحساب واتساب');
        return;
      }

      // Auto normalize: If Algerian 0672... remove leading 0 and prepend 213
      const dialDigits = country.dialCode.replace(/\D/g, '');
      if (cleanInput.startsWith('0')) {
        fullInternationalPhone = dialDigits + cleanInput.slice(1);
      } else if (cleanInput.startsWith(dialDigits)) {
        fullInternationalPhone = cleanInput;
      } else {
        fullInternationalPhone = dialDigits + cleanInput;
      }

      if (fullInternationalPhone.length < 9) {
        toast.error('رقم الهاتف قصير جداً وغير صحيح');
        return;
      }
    }

    setWaConnecting(true);
    setQrDataUrl(null);
    setPairingCode(null);
    setPairingExpiresAt(null);
    setPairingTtlSeconds(null);
    setTimeLeft(null);
    setCopiedCode(false);
    lastQrRef.current = null;
    lastPairingRef.current = null;
    setShowWaModal(true);
    setConnectTab(mode === 'phone' ? 'phone' : 'qr');
    userPickedTabRef.current = false;
    setWaStatus('initializing');

    try {
      const res = await fetch(`${WHATSAPP_ENGINE_URL}/api/whatsapp/create`, {
        method: 'POST',
        headers: await engineHeaders(),
        body: JSON.stringify({
          botId: bot.id,
          phoneNumber: fullInternationalPhone,
        }),
      });
      let data = null;
      try { data = await res.json(); } catch { /* non-JSON body — e.g. Cloudflare 524 timeout page */ }
      if (!res.ok || !data || data.error) {
        toast.error(
          data?.error ||
          (res.status === 504 || res.status === 524
            ? 'المحرك استغرق وقتاً أطول من المسموح — انتظر دقيقة ثم أعد المحاولة'
            : 'تعذر تشغيل محرك واتساب — تأكد من عمله على الخادم')
        );
        setWaStatus('error');
      } else if (data.status === 'error') {
        toast.error('فشلت تهيئة محرك واتساب بعد عدة محاولات — راجع سجلات الخادم (pm2 logs)');
        setWaStatus('error');
      } else {
        setWaStatus(data.status || 'initializing');
      }
    } catch (err) {
      toast.error(`تعذر الاتصال بمحرك واتساب (${err.message})`);
      setWaStatus('error');
    } finally {
      setWaConnecting(false);
    }
  };

  const handleWaDisconnect = async () => {
    try {
      await fetch(`${WHATSAPP_ENGINE_URL}/api/whatsapp/${bot.id}/stop`, { method: 'POST', headers: await engineHeaders(false) }).catch(() => {});
    } catch { /* best effort */ }
    setWaStatus('disconnected');
    setQrDataUrl(null);
    setPairingCode(null);
    try {
      await onUpdateBot({ whatsappStatus: 'disconnected', isActive: false });
      toast.success('تم فصل اتصال واتساب وتطهير الجلسة بنجاح');
    } catch (e) {
      toast.error('فشل تحديث الحالة: ' + e.message);
    }
  };

  // Cancel a pending link attempt: destroys the engine session so the QR /
  // pairing code stops existing, clears local state and hides everything.
  const handleWaCancel = async (silent = false) => {
    setWaCanceling(true);
    try {
      await fetch(`${WHATSAPP_ENGINE_URL}/api/whatsapp/${bot.id}/stop`, { method: 'POST', headers: await engineHeaders(false) });
    } catch { /* session may already be gone */ }
    setQrDataUrl(null);
    setPairingCode(null);
    setPairingExpiresAt(null);
    setPairingTtlSeconds(null);
    setTimeLeft(null);
    setCopiedCode(false);
    lastQrRef.current = null;
    lastPairingRef.current = null;
    setWaStatus('not_initialized');
    setWaCanceling(false);
    setShowWaModal(false);
    if (onUpdateBot) onUpdateBot({ whatsappStatus: 'disconnected' }).catch(() => {});
    if (!silent) toast.success('تم إلغاء محاولة الربط وإخفاء الرمز');
  };

  const copyPairingCodeToClipboard = () => {
    if (!pairingCode) return;
    navigator.clipboard.writeText(pairingCode);
    setCopiedCode(true);
    toast.success('تم نسخ كود الربط إلى الحافظة!');
    setTimeout(() => setCopiedCode(false), 3000);
  };

  // Handle Telegram Save
  const handleTgSave = async (e) => {
    e.preventDefault();
    if (!tgToken.trim()) {
      toast.error('يرجى إدخال Bot Token الخاص بتيليغرام');
      return;
    }
    setTgSaving(true);
    try {
      await onUpdateBot({
        telegramToken: tgToken.trim(),
        telegramEnabled: true,
        platform: 'telegram',
      });
      setShowTgModal(false);
      toast.success('تم حفظ وتفعيل قناة تيليغرام بنجاح');
    } catch (err) {
      toast.error('فشل حفظ قناة تيليغرام: ' + err.message);
    } finally {
      setTgSaving(false);
    }
  };

  const handleTgDisconnect = async () => {
    try {
      await onUpdateBot({
        telegramToken: '',
        telegramEnabled: false,
      });
      setTgToken('');
      toast.success('تم فصل اتصال تيليغرام');
    } catch (err) {
      toast.error('فشل فصل تيليغرام: ' + err.message);
    }
  };

  const isWaConnected = waStatus === 'connected' || bot?.whatsappStatus === 'connected';
  // The engine is self-healing: a transient disconnect auto-revives on the
  // saved session — shown as its own state, not "disconnected"
  const isWaReconnecting = waStatus === 'reconnecting' || bot?.whatsappStatus === 'reconnecting';
  const isTgConnected = !!bot?.telegramToken && bot?.telegramEnabled !== false;

  // ─── Engine self-update: silent probe on mount; renders only for the
  // platform owner (merchants get 403 → button hidden) ───
  const checkEngineUpdate = async () => {
    try {
      const res = await fetch(`${WHATSAPP_ENGINE_URL}/api/engine/check-update`, { headers: await engineHeaders(false) });
      if (res.status === 403) return;
      const data = await res.json();
      if (data.updateAvailable) setEngineUpdate({ installed: data.installed, latest: data.latest });
      else setEngineUpdate(null);
    } catch { /* engine unreachable */ }
  };

  useEffect(() => {
    checkEngineUpdate();
  }, []);

  const handleEngineUpdate = async () => {
    if (engineUpdating) return;
    setEngineUpdating(true);
    try {
      const res = await fetch(`${WHATSAPP_ENGINE_URL}/api/engine/self-update`, {
        method: 'POST',
        headers: { ...(await engineHeaders(false)), 'Content-Type': 'application/json' },
        body: '{}',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) {
        alert(data.error || 'فشل التحديث — راجع سجلات المحرك');
        setEngineUpdating(false);
        return;
      }
      // The engine exits and PM2 revives it on the new libraries — wait for /health
      await new Promise(r => setTimeout(r, 2000));
      for (let i = 0; i < 40; i++) {
        try {
          const h = await fetch(`${WHATSAPP_ENGINE_URL}/health`);
          if (h.ok) break;
        } catch { /* still restarting */ }
        await new Promise(r => setTimeout(r, 3000));
      }
      setEngineUpdateDone(true);
      setEngineUpdate(null);
      setTimeout(() => setEngineUpdateDone(false), 15000);
    } catch {
      alert('فشل الاتصال بالمحرك أثناء التحديث');
    } finally {
      setEngineUpdating(false);
      checkEngineUpdate();
    }
  };

  // Respect the channels chosen at creation. Bots created before channel
  // selection existed (no field / empty) default to both — nothing breaks.
  const enabledChannels = Array.isArray(bot?.enabledChannels) && bot.enabledChannels.length > 0
    ? bot.enabledChannels
    : ['whatsapp', 'telegram'];
  const addableChannels = ['whatsapp', 'telegram'].filter(c => !enabledChannels.includes(c));

  // Adds a channel to an existing bot — no re-creation, nothing lost
  const handleAddChannel = async (ch) => {
    if (planLimits && planLimits.channelsPerBot === 1 && enabledChannels.length >= 1) {
      toast.warning('القناة الثانية متاحة في الباقة الاحترافية — رقّ من صفحة الاشتراكات');
      navigate('/billing');
      return;
    }
    try {
      const patch = { enabledChannels: [...enabledChannels, ch] };
      if (ch === 'whatsapp') { patch.whatsappEnabled = true; patch.whatsappStatus = 'not_initialized'; }
      if (ch === 'telegram') patch.telegramEnabled = true;
      await onUpdateBot(patch);
      toast.success(ch === 'whatsapp' ? 'تمت إضافة قناة واتساب — اربطها الآن' : 'تمت إضافة قناة تيليغرام — اربطها الآن');
    } catch (err) {
      toast.error('فشل إضافة القناة: ' + err.message);
    }
  };

  const connectedCount = [isWaConnected, isTgConnected].filter(Boolean).length;
  // Free plans run ONE channel per bot — the second channel card shows the
  // lock with an upgrade path (the engines refuse it server-side too).
  const channelLocked = !!(planLimits && planLimits.channelsPerBot === 1 && enabledChannels.length >= 1);
  const selectedCountry = getCountryByCode(selectedCountryCode);
  const waLinking = waStatus === 'waiting_scan' || waStatus === 'initializing';
  const ttlPercent = pairingTtlSeconds ? Math.max(0, Math.min(100, ((timeLeft || 0) / pairingTtlSeconds) * 100)) : 100;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      
      {/* Header Hub Card */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>قنوات التواصل النشطة</span>
              <span style={{ fontSize: '0.78rem', background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', padding: '2px 8px', borderRadius: '20px', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
                {connectedCount} من 2 متصلة
              </span>
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              اربط حسابات متجرك على واتساب وتيليغرام ليعمل الذكاء الاصطناعي على استقبال الزبائن والبيع آلياً 24/7.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <span style={{ fontSize: '0.8rem', color: '#10b981', background: 'rgba(16, 185, 129, 0.1)', padding: '6px 12px', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.25)', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', boxShadow: '0 0 8px #10b981' }} />
              محرك الذكاء الاصطناعي نشط
            </span>
          </div>
        </div>
      </div>

      {/* Grid of 2 Channels */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
        
        {/* 1. WhatsApp Card — shown only if enabled for this bot */}
        {enabledChannels.includes('whatsapp') && (
        <div className={`channel-card channel-card--whatsapp ${isWaConnected ? 'is-connected' : ''}`} style={{ background: 'rgba(17, 17, 16, 0.72)', border: isWaConnected ? '1px solid rgba(37, 211, 102, 0.4)' : '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '20px', padding: '1.5rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div className="channel-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div className="channel-card-brand" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'rgba(37, 211, 102, 0.15)', color: '#25d366', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(37, 211, 102, 0.3)' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
                  </svg>
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--text-primary)' }}>واتساب (WhatsApp)</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>ربط مباشر وسريع عبر كود الهاتف أو الـ QR</div>
                </div>
              </div>

              <span className={`channel-status-pill ${isWaConnected ? 'channel-status-pill--online' : 'channel-status-pill--offline'}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <span className={`channel-dot ${isWaConnected ? 'channel-dot--online' : isWaReconnecting ? 'channel-dot--reconnecting' : 'channel-dot--offline'}`} />
                <span>{isWaConnected ? 'متصل' : isWaReconnecting ? 'إعادة اتصال تلقائي…' : 'غير متصل'}</span>
              </span>
            </div>

            <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', marginBottom: '1.5rem', lineHeight: 1.6 }}>
              {isWaConnected
                ? 'البوت يعمل الآن على واتساب ويرد على زبائنك ويسجل طلبياتهم تلقائياً 24/7.'
                : 'ربط رقم المتجر مباشرة لإرسال صور المنتجات، الإجابة التلقائية على الزبائن، وتسجيل طلبيات التوصيل للـ 58 ولاية تلقائياً.'}
            </p>

            {engineUpdate && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', padding: '0.85rem 1rem', borderRadius: '14px', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.35)', marginBottom: '1rem' }}>
                <div style={{ fontSize: '0.82rem', color: '#fbbf24', fontWeight: 700 }}>
                  تحديث محرك واتساب متوفر ({engineUpdate.installed} → {engineUpdate.latest}) — يُوصى به لتجنّب كسر الربط
                </div>
                <button
                  onClick={handleEngineUpdate}
                  disabled={engineUpdating}
                  style={{ background: engineUpdating ? 'rgba(245,158,11,0.3)' : '#f59e0b', color: '#111', border: 'none', borderRadius: '10px', padding: '0.55rem 1.1rem', fontWeight: 800, fontSize: '0.82rem', cursor: engineUpdating ? 'wait' : 'pointer', whiteSpace: 'nowrap' }}
                >
                  {engineUpdating ? 'جاري التحديث (دقيقة تقريباً)…' : 'تحديث الآن'}
                </button>
              </div>
            )}
            {engineUpdateDone && (
              <div style={{ padding: '0.7rem 1rem', borderRadius: '14px', background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.4)', marginBottom: '1rem', fontSize: '0.82rem', color: '#10b981', fontWeight: 700 }}>
                تم تحديث المحرك وإعادة تشغيله — البوتات تعود اتصالها تلقائياً خلال دقيقة
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: '8px', paddingTop: '1rem', borderTop: '1px solid rgba(255, 255, 255, 0.06)' }}>
            {isWaConnected ? (
              <>
                <button className="btn btn-secondary btn-sm" onClick={() => setShowWaModal(true)} style={{ flex: 1, padding: '0.65rem' }}>
                  حالة الاتصال
                </button>
                <button className="btn btn-secondary btn-sm" onClick={handleWaDisconnect} style={{ flex: 1, color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.25)' }}>
                  فصل
                </button>
              </>
            ) : (
              <button className="btn btn-primary" onClick={() => setShowWaModal(true)} style={{ width: '100%', background: 'linear-gradient(135deg, #25d366 0%, #128c7e 100%)', borderColor: 'transparent', padding: '0.75rem', fontWeight: 800, color: 'var(--text-on-fill)', gap: '8px' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
                <span>ربط رقم واتساب (كود الهاتف / QR)</span>
              </button>
            )}
          </div>
        </div>
        )}

        {/* 2. Telegram Card — shown only if enabled for this bot */}
        {enabledChannels.includes('telegram') && (
        <div className={`channel-card channel-card--telegram ${isTgConnected ? 'is-connected' : ''}`} style={{ background: 'rgba(17, 17, 16, 0.72)', border: isTgConnected ? '1px solid rgba(14, 165, 233, 0.4)' : '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '20px', padding: '1.5rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div className="channel-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div className="channel-card-brand" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'rgba(14, 165, 233, 0.15)', color: '#0ea5e9', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(14, 165, 233, 0.3)' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13"/>
                    <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                  </svg>
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--text-primary)' }}>تيليغرام (Telegram Bot)</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>ربط فوري عبر BotFather Token</div>
                </div>
              </div>

              <span className={`channel-status-pill ${isTgConnected ? 'channel-status-pill--online' : 'channel-status-pill--offline'}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <span className={`channel-dot ${isTgConnected ? 'channel-dot--online' : 'channel-dot--offline'}`} />
                <span>{isTgConnected ? 'متصل' : 'غير متصل'}</span>
              </span>
            </div>

            <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', marginBottom: '1.5rem', lineHeight: 1.6 }}>
              {isTgConnected
                ? 'البوت يعمل الآن على تيليغرام ويرد على المشتركين فوراً مع إرسال صور المواصفات وتأكيد الطلبيات.'
                : 'رد ذكي فائق السرعة على استفسارات المشتركين والزبائن وقنوات تيليغرام مع إرسال صور المواصفات وتأكيد الطلبيات فوراً.'}
            </p>
          </div>

          <div style={{ display: 'flex', gap: '8px', paddingTop: '1rem', borderTop: '1px solid rgba(255, 255, 255, 0.06)' }}>
            {isTgConnected ? (
              <>
                <button className="btn btn-secondary btn-sm" onClick={() => setShowTgModal(true)} style={{ flex: 1, padding: '0.65rem' }}>
                  تعديل الـ Token
                </button>
                <button className="btn btn-secondary btn-sm" onClick={handleTgDisconnect} style={{ flex: 1, color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.25)' }}>
                  فصل
                </button>
              </>
            ) : (
              <button className="btn btn-primary" onClick={() => setShowTgModal(true)} style={{ width: '100%', background: 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)', borderColor: 'transparent', padding: '0.75rem', fontWeight: 800, color: 'var(--text-on-fill)', gap: '8px' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
                <span>إدخال Bot Token تيليغرام</span>
              </button>
            )}
          </div>
        </div>
        )}

        {/* Add-channel cards — grow the bot later without re-creating it */}
        {addableChannels.map(ch => {
          const isWa = ch === 'whatsapp';
          return (
            <div key={ch} style={{
              background: channelLocked ? 'rgba(16, 185, 129, 0.04)' : 'rgba(255, 255, 255, 0.015)',
              border: channelLocked ? '1.5px dashed rgba(16, 185, 129, 0.45)' : '1.5px dashed rgba(255, 255, 255, 0.18)',
              borderRadius: '20px',
              padding: '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: '1rem',
              textAlign: 'center',
            }}>
              <div>
                <div style={{
                  width: '44px', height: '44px', borderRadius: '12px', margin: '0 auto 0.8rem',
                  background: isWa ? 'rgba(37, 211, 102, 0.08)' : 'rgba(14, 165, 233, 0.08)',
                  border: `1px dashed ${isWa ? 'rgba(37, 211, 102, 0.4)' : 'rgba(14, 165, 233, 0.4)'}`,
                  color: isWa ? '#25d366' : '#26a5e4',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
                </div>
                <div style={{ fontWeight: 800, fontSize: '1.02rem', color: 'var(--text-primary)', marginBottom: '4px' }}>
                  {channelLocked ? 'قناة ' + (isWa ? 'واتساب' : 'تيليغرام') + ' — مقفلة' : 'إضافة قناة ' + (isWa ? 'واتساب' : 'تيليغرام') + ' لهذا البوت'}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
                  {channelLocked
                    ? 'باقتك تعمل بقناة واحدة لكل بوت. القناة الثانية تفتح مع الباقة الاحترافية — نفس البوت، العقل نفسه، بلا فقدان أي شيء.'
                    : 'نمِّ بوتك: أضف هذه القناة في أي وقت — نفس العقل الذكي نفسه، بدون إعادة إنشاء وبدون فقدان محادثاتك وطلبياتك.'}
                </div>
              </div>
              {channelLocked ? (
                <button
                  className="btn btn-primary"
                  onClick={() => navigate('/billing')}
                  style={{ width: '100%', padding: '0.75rem', fontWeight: 800, gap: '8px' }}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>
                  افتحها مع الاحترافية
                </button>
              ) : (
              <button
                className="btn btn-secondary"
                onClick={() => handleAddChannel(ch)}
                style={{ width: '100%', padding: '0.75rem', fontWeight: 800, gap: '8px', border: `1.5px dashed ${isWa ? 'rgba(37, 211, 102, 0.45)' : 'rgba(14, 165, 233, 0.45)'}`, color: isWa ? '#25d366' : '#26a5e4', background: 'transparent' }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
                إضافة القناة
              </button>
              )}
            </div>
          );
        })}

      </div>

      {/* ─── Modern WhatsApp Connection Modal (Pairing Code & QR) ─── */}
      {showWaModal && (
        <div className="modal-overlay" onClick={() => setShowWaModal(false)} style={{ backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', background: 'rgba(3, 7, 18, 0.85)' }}>
          <div className="modal wa-modal" onClick={e => e.stopPropagation()}>

            {/* Top Close Button */}
            <button
              className="wa-modal-close"
              onClick={() => setShowWaModal(false)}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)'; e.currentTarget.style.color = '#ef4444'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)'; e.currentTarget.style.color = '#94a3b8'; }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>

            {/* Glowing Brand Icon Badge */}
            <div className="wa-modal-badge">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
              </svg>
            </div>

            <h3 className="wa-modal-title">
              ربط حساب واتساب
            </h3>
            <p className="wa-modal-sub">
              اختر الطريقة المفضلة لربط متجرك بالذكاء الاصطناعي فوراً
            </p>

            {/* Mode Switch Tabs (Luxury Segmented Control) */}
            <div className="wa-tabs">
              <button
                type="button"
                className={`wa-tab${connectTab === 'phone' ? ' wa-tab--active' : ''}`}
                onClick={() => { userPickedTabRef.current = true; setConnectTab('phone'); }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><path d="M12 18h.01"/></svg>
                <span>كود الهاتف</span>
              </button>
              <button
                type="button"
                className={`wa-tab${connectTab === 'qr' ? ' wa-tab--active' : ''}`}
                onClick={() => { userPickedTabRef.current = true; setConnectTab('qr'); }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="14" x="2" y="3" rx="2"/><line x1="8" x2="16" y1="21" y2="21"/><line x1="12" x2="12" y1="17" y2="21"/></svg>
                <span>مسح الـ QR</span>
              </button>
            </div>

            {/* TAB 1: Phone Pairing Code Mode */}
            {connectTab === 'phone' && (
              <div>
                {!pairingCode ? (
                  <div>
                    <div style={{
                      background: 'linear-gradient(145deg, rgba(255, 255, 255, 0.03) 0%, rgba(255, 255, 255, 0.01) 100%)',
                      border: '1px solid var(--border-default)',
                      borderRadius: '18px',
                      padding: '1.4rem',
                      marginBottom: '1.25rem',
                      textAlign: 'right',
                      boxSizing: 'border-box'
                    }}>
                      <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '10px' }}>
                        رقم هاتف واتساب الخاص بمتجرك:
                      </label>

                      {/* Luxury Phone Input Bar */}
                      <div className="wa-phone-bar">
                        {/* Country Selector Column */}
                        <div style={{
                          position: 'relative',
                          display: 'flex',
                          alignItems: 'center',
                          background: 'var(--veil-1)',
                          borderRight: '1px solid rgba(255, 255, 255, 0.1)'
                        }}>
                          <select
                            value={selectedCountryCode}
                            onChange={e => setSelectedCountryCode(e.target.value)}
                            style={{
                              width: '100%',
                              padding: '12px 10px 12px 12px',
                              background: 'transparent',
                              border: 'none',
                              color: 'var(--text-primary)',
                              fontSize: '0.9rem',
                              fontWeight: 800,
                              cursor: 'pointer',
                              outline: 'none',
                              appearance: 'none',
                              paddingRight: '24px',
                              boxSizing: 'border-box'
                            }}
                          >
                            {COUNTRIES.map(c => (
                              <option key={c.code} value={c.code} style={{ background: 'var(--bg-card)', color: 'var(--text-primary)' }}>
                                {c.flag} {c.dialCode}
                              </option>
                            ))}
                          </select>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ position: 'absolute', right: '8px', pointerEvents: 'none', color: 'var(--text-secondary)' }}>
                            <polyline points="6 9 12 15 18 9"/>
                          </svg>
                        </div>

                        {/* Phone Input Column */}
                        <input
                          type="tel"
                          className="wa-phone-input"
                          placeholder={selectedCountry.phonePlaceholder || '0672 00 00 00'}
                          value={phoneNumberInput}
                          onChange={e => setPhoneNumberInput(e.target.value)}
                        />
                      </div>

                      {/* Info Pill */}
                      <div className="wa-info-pill">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                        <span>سيتم توليد كود ربط مكون من 8 خانات لتأكيده على هاتفك فوراً.</span>
                      </div>
                    </div>

                    {waConnecting || (waStatus === 'initializing' && !pairingCode) ? (
                      <div style={{ padding: '1.25rem 0', textAlign: 'center' }}>
                        <div className="spinner spinner-lg" style={{ margin: '0 auto 1rem', borderColor: '#25d366', borderTopColor: 'transparent' }} />
                        <div style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '1rem', marginBottom: '4px' }}>
                          جاري تهيئة الاتصال وتوليد كود الربط...
                        </div>
                        <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                          ثوانٍ معدودة وسيظهر كود الربط لتأكيده في تطبيق واتساب.
                        </p>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleWaConnect('phone')}
                        disabled={waConnecting}
                        style={{
                          width: '100%',
                          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                          border: 'none',
                          padding: '1rem',
                          fontWeight: 800,
                          fontSize: '1rem',
                          color: 'var(--text-primary)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '8px',
                          borderRadius: '14px',
                          cursor: 'pointer',
                          boxShadow: '0 10px 28px -6px rgba(16, 185, 129, 0.4)',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                        <span>توليد كود الربط السريع</span>
                      </button>
                    )}
                  </div>
                ) : (
                  <div>
                    {/* Pairing Code Display Box */}
                    <div style={{
                      background: 'linear-gradient(145deg, rgba(37, 211, 102, 0.12) 0%, rgba(18, 140, 126, 0.04) 100%)',
                      border: '1.5px solid rgba(37, 211, 102, 0.45)',
                      borderRadius: '20px',
                      padding: '1.5rem 1.25rem',
                      marginBottom: '1.25rem',
                      boxShadow: '0 0 30px rgba(37, 211, 102, 0.15)'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '14px' }}>
                        <span style={{ fontSize: '0.84rem', color: '#34d399', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><path d="M12 18h.01"/></svg>
                          كود الربط (8 خانات)
                        </span>
                        {timeLeft !== null && (
                          <span className={`wa-ttl-pill${timeLeft < 30 ? ' is-low' : ''}`} style={{
                            fontSize: '0.78rem',
                            fontWeight: 800,
                            padding: '4px 10px',
                            borderRadius: '8px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px'
                          }}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                            <span>ينتهي خلال {timeLeft} ثانية</span>
                          </span>
                        )}
                      </div>

                      {/* Digit tiles — one tile per character, grouped 4+4 */}
                      <div className="wa-pair-row">
                        {String(pairingCode).split('').map((ch, i) => (
                          <Fragment key={i}>
                            {i === 4 && <span className="wa-pair-sep">–</span>}
                            <span className="wa-pair-digit">{ch}</span>
                          </Fragment>
                        ))}
                      </div>

                      {/* TTL progress bar */}
                      {timeLeft !== null && (
                        <div className="wa-ttl-bar">
                          <div
                            className="wa-ttl-fill"
                            style={{
                              width: `${ttlPercent}%`,
                              background: timeLeft < 30 ? 'linear-gradient(90deg, #f87171, #ef4444)' : undefined,
                            }}
                          />
                        </div>
                      )}

                      <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'center' }}>
                        <button
                          type="button"
                          onClick={copyPairingCodeToClipboard}
                          className="wa-copy-btn"
                          style={{
                            background: copiedCode ? '#10b981' : 'linear-gradient(135deg, rgba(37, 211, 102, 0.25) 0%, rgba(16, 185, 129, 0.2) 100%)',
                            border: copiedCode ? '1px solid transparent' : '1px solid rgba(37, 211, 102, 0.45)',
                            color: copiedCode ? '#ffffff' : '#34d399',
                            fontWeight: 800,
                            fontSize: '0.88rem',
                            padding: '9px 22px',
                            borderRadius: '10px',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '7px',
                            transition: 'all 0.2s ease'
                          }}
                        >
                          {copiedCode ? (
                            <>
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                              <span>تم النسخ!</span>
                            </>
                          ) : (
                            <>
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
                              <span>نسخ الكود</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Step-by-Step Instructions */}
                    <div className="wa-steps">
                      <div style={{ fontWeight: 800, color: '#38bdf8', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                        <span>خطوات التأكيد على هاتفك:</span>
                      </div>
                      <div style={{ marginBottom: '4px' }}>1. افتح واتساب ➔ <strong>الإعدادات</strong> (أو النقاط الثلاث).</div>
                      <div style={{ marginBottom: '4px' }}>2. <strong>الأجهزة المرتبطة</strong> ➔ <strong>ربط جهاز</strong>.</div>
                      <div style={{ marginBottom: '4px' }}>3. اختر بالأسفل <strong>«الربط باستخدام رقم الهاتف»</strong>.</div>
                      <div>4. اكتب هذا الكود المكوّن من 8 خانات وسيتصل البوت فوراً!</div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: QR Code Mode */}
            {connectTab === 'qr' && (
              <div>
                <p className="wa-qr-hint">
                  افتح واتساب ➔ <strong>الأجهزة المرتبطة</strong> ➔ <strong>ربط جهاز</strong> ➔ وجّه الكاميرا للشاشة
                </p>

                {qrDataUrl ? (
                  <div>
                    <div className="wa-qr-frame">
                      <img src={qrDataUrl} alt="WhatsApp QR Code" className="wa-qr-img" />
                    </div>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', margin: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/></svg>
                      <span>يتجدد الرمز تلقائياً — إن انتهت صلاحيته انتظر لحظات</span>
                    </p>
                  </div>
                ) : waConnecting || waStatus === 'initializing' ? (
                  <div style={{ padding: '1.25rem 0' }}>
                    <div className="spinner spinner-lg" style={{ margin: '0 auto 1rem', borderColor: '#25d366', borderTopColor: 'transparent' }} />
                    <p style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px' }}>جاري تهيئة محرك واتساب وتوليد رمز الـ QR...</p>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>قد تستغرق العملية حتى دقيقة في المرة الأولى — سيظهر الرمز هنا تلقائياً.</p>
                  </div>
                ) : (
                  <div style={{ padding: waStatus === 'error' ? '0.75rem 0' : '1.25rem 0' }}>
                    {waStatus === 'error' && (
                      <p style={{ fontSize: '0.84rem', color: '#f87171', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: '10px', padding: '10px 14px', margin: '0 0 1rem' }}>
                        تعذر توليد الرمز — تأكد من عمل المحرك ثم أعد المحاولة.
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={() => handleWaConnect('qr')}
                      style={{
                        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                        border: 'none',
                        padding: '0.9rem 1.8rem',
                        fontWeight: 800,
                        fontSize: '0.95rem',
                        color: 'var(--text-primary)',
                        borderRadius: '14px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        cursor: 'pointer',
                        boxShadow: '0 8px 24px rgba(16, 185, 129, 0.35)'
                      }}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/></svg>
                      <span>توليد كود الـ QR الآن</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            <div style={{ marginTop: '1.1rem', display: 'flex', gap: '8px', justifyContent: 'center' }}>
              {waLinking && (
                <button
                  type="button"
                  className="wa-cancel-btn"
                  onClick={handleWaCancel}
                  disabled={waCanceling}
                  style={{ flex: 1 }}
                >
                  {waCanceling ? (
                    <span className="spinner" style={{ width: '14px', height: '14px', borderWidth: '2px' }} />
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  )}
                  <span>{waCanceling ? 'جاري الإلغاء...' : 'إلغاء الربط وإخفاء الرمز'}</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowWaModal(false)}
                style={{
                  flex: waLinking ? 1 : '0 0 auto',
                  background: 'transparent',
                  border: '1px solid var(--border-default)',
                  color: 'var(--text-secondary)',
                  padding: '8px 24px',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  fontSize: '0.88rem',
                  fontWeight: 600,
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.25)'; e.currentTarget.style.color = '#ffffff'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)'; e.currentTarget.style.color = '#94a3b8'; }}
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Telegram Config Modal ─── */}
      {showTgModal && (
        <div className="modal-overlay" onClick={() => !tgSaving && setShowTgModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <h3 className="modal-title">إعداد قناة تيليغرام (Telegram Bot)</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.25rem', lineHeight: 1.5 }}>
              احصل على الـ Token الخاص بالبوت من حساب <strong>@BotFather</strong> داخل تطبيق تيليغرام.
            </p>

            <form onSubmit={handleTgSave}>
              <div className="form-group">
                <label className="form-label">Telegram Bot Token</label>
                <input
                  type="password"
                  className="form-input"
                  placeholder="مثال: 1234567890:ABCdefGhIJKlmNoPQRsTUVwxyZ"
                  value={tgToken}
                  onChange={e => setTgToken(e.target.value)}
                  required
                />
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowTgModal(false)} disabled={tgSaving}>إلغاء</button>
                <button type="submit" className="btn btn-primary" disabled={tgSaving}>
                  {tgSaving ? <span className="spinner" /> : 'حفظ وتفعيل'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
