import { useState, useEffect } from 'react';
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
  
  // WhatsApp States
  const [waStatus, setWaStatus] = useState(bot?.whatsappStatus || 'not_initialized');
  const [qrDataUrl, setQrDataUrl] = useState(null);
  const [pairingCode, setPairingCode] = useState(null);
  const [pairingExpiresAt, setPairingExpiresAt] = useState(null);
  const [timeLeft, setTimeLeft] = useState(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [waConnecting, setWaConnecting] = useState(false);
  const [showWaModal, setShowWaModal] = useState(false);
  const [connectTab, setConnectTab] = useState('phone'); // 'phone' | 'qr'
  
  // Phone inputs for pairing
  const initialCountry = getCountryByCode(bot?.country || 'DZ');
  const [selectedCountryCode, setSelectedCountryCode] = useState(initialCountry.code);
  const [phoneNumberInput, setPhoneNumberInput] = useState('');

  // Telegram States
  const [tgToken, setTgToken] = useState(bot?.telegramToken || '');
  const [tgSaving, setTgSaving] = useState(false);
  const [showTgModal, setShowTgModal] = useState(false);

  // WhatsApp Polling (QR & Pairing Code & Status)
  useEffect(() => {
    if (waStatus !== 'waiting_scan' && waStatus !== 'initializing') return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${WHATSAPP_ENGINE_URL}/api/whatsapp/${bot.id}/qr`, { headers: await engineHeaders(false) });
        if (res.ok) {
          const data = await res.json();
          if (data.status) setWaStatus(data.status);
          if (data.qrDataUrl) {
            setQrDataUrl(data.qrDataUrl);
            setWaStatus('waiting_scan');
          }
          if (data.pairingCode) {
            setPairingCode(data.pairingCode);
            setPairingExpiresAt(data.pairingCodeExpiresAt || Date.now() + 120000);
            setWaStatus('waiting_scan');
          }
          if (data.status === 'connected' || data.status === 'authenticated') {
            setWaStatus('connected');
            setQrDataUrl(null);
            setPairingCode(null);
            setShowWaModal(false);
            clearInterval(interval);
            if (onUpdateBot) {
              await onUpdateBot({ whatsappStatus: 'connected', whatsappEnabled: true }).catch(() => {});
            }
            toast.success('تم ربط حساب واتساب بنجاح!');
          }
        }
      } catch (err) {
        console.warn('WhatsApp status poll error:', err.message);
      }
    }, 2500);
    return () => clearInterval(interval);
  }, [waStatus, bot.id]);

  // Countdown timer for pairing code (120s TTL)
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
      }
    };
    updateTimer();
    const timer = setInterval(updateTimer, 1000);
    return () => clearInterval(timer);
  }, [pairingExpiresAt]);

  // Handle WhatsApp Connect (QR or Phone Pairing)
  const handleWaConnect = async (mode = connectTab) => {
    setWaConnecting(true);
    setQrDataUrl(null);
    setPairingCode(null);
    setCopiedCode(false);
    setShowWaModal(true);
    setWaStatus('initializing');

    let fullInternationalPhone = null;

    if (mode === 'phone') {
      const country = getCountryByCode(selectedCountryCode);
      const cleanInput = phoneNumberInput.trim().replace(/\D/g, '');
      if (!cleanInput) {
        toast.error('يرجى إدخال رقم الهاتف المرتبط بحساب واتساب');
        setWaConnecting(false);
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
        setWaConnecting(false);
        return;
      }
    }

    try {
      const res = await fetch(`${WHATSAPP_ENGINE_URL}/api/whatsapp/create`, {
        method: 'POST',
        headers: await engineHeaders(),
        body: JSON.stringify({
          botId: bot.id,
          phoneNumber: fullInternationalPhone,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        toast.error(data.error || 'تعذر تشغيل محرك واتساب');
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
      await fetch(`${WHATSAPP_ENGINE_URL}/api/whatsapp/${bot.id}/stop`, { method: 'POST', headers: await engineHeaders(false) });
      setWaStatus('disconnected');
      setQrDataUrl(null);
      setPairingCode(null);
      await onUpdateBot({ whatsappStatus: 'disconnected' });
      toast.success('تم فصل اتصال واتساب وتطهير الجلسة بنجاح');
    } catch {
      toast.error('فشل قطع الاتصال');
    }
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
  const isTgConnected = !!bot?.telegramToken && bot?.telegramEnabled !== false;
  const connectedCount = [isWaConnected, isTgConnected].filter(Boolean).length;
  const selectedCountry = getCountryByCode(selectedCountryCode);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      
      {/* Header Hub Card */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '8px' }}>
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
        
        {/* 1. WhatsApp Card */}
        <div className={`channel-card channel-card--whatsapp ${isWaConnected ? 'is-connected' : ''}`} style={{ background: 'rgba(14, 21, 38, 0.7)', border: isWaConnected ? '1px solid rgba(37, 211, 102, 0.4)' : '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '20px', padding: '1.5rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div className="channel-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div className="channel-card-brand" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'rgba(37, 211, 102, 0.15)', color: '#25d366', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(37, 211, 102, 0.3)' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
                  </svg>
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '1.05rem', color: '#ffffff' }}>واتساب (WhatsApp)</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>ربط مباشر وسريع عبر كود الهاتف أو الـ QR</div>
                </div>
              </div>

              <span className={`channel-status-pill ${isWaConnected ? 'channel-status-pill--online' : 'channel-status-pill--offline'}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: isWaConnected ? '#10b981' : '#94a3b8' }} />
                <span>{isWaConnected ? 'متصل' : 'غير متصل'}</span>
              </span>
            </div>

            <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', marginBottom: '1.5rem', lineHeight: 1.6 }}>
              ربط رقم المتجر مباشرة لإرسال صور المنتجات، الإجابة التلقائية على الزبائن، وتسجيل طلبيات التوصيل للـ 58 ولاية تلقائياً.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '8px', paddingTop: '1rem', borderTop: '1px solid rgba(255, 255, 255, 0.06)' }}>
            {isWaConnected ? (
              <>
                <button className="btn btn-secondary btn-sm" onClick={() => setShowWaModal(true)} style={{ flex: 1, padding: '0.65rem' }}>
                  حالة الاتصال
                </button>
                <button className="btn btn-secondary btn-sm" onClick={handleWaDisconnect} style={{ color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.25)' }}>
                  فصل
                </button>
              </>
            ) : (
              <button className="btn btn-primary" onClick={() => setShowWaModal(true)} style={{ width: '100%', background: 'linear-gradient(135deg, #25d366 0%, #128c7e 100%)', borderColor: 'transparent', padding: '0.75rem', fontWeight: 800, color: '#ffffff', gap: '8px' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
                <span>ربط رقم واتساب (كود الهاتف / QR)</span>
              </button>
            )}
          </div>
        </div>

        {/* 2. Telegram Card */}
        <div className={`channel-card channel-card--telegram ${isTgConnected ? 'is-connected' : ''}`} style={{ background: 'rgba(14, 21, 38, 0.7)', border: isTgConnected ? '1px solid rgba(14, 165, 233, 0.4)' : '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '20px', padding: '1.5rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
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
                  <div style={{ fontWeight: 800, fontSize: '1.05rem', color: '#ffffff' }}>تيليغرام (Telegram Bot)</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>ربط فوري عبر BotFather Token</div>
                </div>
              </div>

              <span className={`channel-status-pill ${isTgConnected ? 'channel-status-pill--online' : 'channel-status-pill--offline'}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: isTgConnected ? '#10b981' : '#94a3b8' }} />
                <span>{isTgConnected ? 'متصل' : 'غير متصل'}</span>
              </span>
            </div>

            <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', marginBottom: '1.5rem', lineHeight: 1.6 }}>
              رد ذكي فائق السرعة على استفسارات المشتركين والزبائن وقنوات تيليغرام مع إرسال صور المواصفات وتأكيد الطلبيات فوراً.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '8px', paddingTop: '1rem', borderTop: '1px solid rgba(255, 255, 255, 0.06)' }}>
            {isTgConnected ? (
              <>
                <button className="btn btn-secondary btn-sm" onClick={() => setShowTgModal(true)} style={{ flex: 1, padding: '0.65rem' }}>
                  تعديل الـ Token
                </button>
                <button className="btn btn-secondary btn-sm" onClick={handleTgDisconnect} style={{ color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.25)' }}>
                  فصل
                </button>
              </>
            ) : (
              <button className="btn btn-primary" onClick={() => setShowTgModal(true)} style={{ width: '100%', background: 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)', borderColor: 'transparent', padding: '0.75rem', fontWeight: 800, color: '#ffffff', gap: '8px' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
                <span>إدخال Bot Token تيليغرام</span>
              </button>
            )}
          </div>
        </div>

      </div>

      {/* ─── Modern WhatsApp Connection Modal (Pairing Code & QR) ─── */}
      {showWaModal && (
        <div className="modal-overlay" onClick={() => !waConnecting && setShowWaModal(false)} style={{ backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', background: 'rgba(3, 7, 18, 0.85)' }}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{
            maxWidth: '490px',
            width: '92%',
            textAlign: 'center',
            padding: '2rem 1.75rem',
            boxSizing: 'border-box',
            background: 'linear-gradient(180deg, #0f172a 0%, #090d16 100%)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: '24px',
            boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.9), 0 0 35px rgba(37, 211, 102, 0.12)',
            position: 'relative'
          }}>
            
            {/* Top Close Button */}
            <button
              onClick={() => !waConnecting && setShowWaModal(false)}
              style={{
                position: 'absolute',
                top: '18px',
                left: '18px',
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: '#94a3b8',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)'; e.currentTarget.style.color = '#ef4444'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)'; e.currentTarget.style.color = '#94a3b8'; }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>

            {/* Glowing Brand Icon Badge */}
            <div style={{
              width: '52px',
              height: '52px',
              borderRadius: '16px',
              background: 'linear-gradient(135deg, rgba(37, 211, 102, 0.2) 0%, rgba(18, 140, 126, 0.1) 100%)',
              border: '1px solid rgba(37, 211, 102, 0.4)',
              color: '#25d366',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1rem',
              boxShadow: '0 0 24px rgba(37, 211, 102, 0.25)'
            }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
              </svg>
            </div>

            <h3 style={{ margin: '0 0 6px', fontSize: '1.35rem', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.02em' }}>
              ربط حساب واتساب
            </h3>
            <p style={{ color: '#94a3b8', fontSize: '0.86rem', margin: '0 0 1.5rem', lineHeight: 1.5 }}>
              اختر الطريقة المفضلة لربط متجرك بالذكاء الاصطناعي فوراً
            </p>

            {/* Mode Switch Tabs (Luxury Segmented Control) */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              background: 'rgba(15, 23, 42, 0.8)',
              padding: '5px',
              borderRadius: '14px',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              marginBottom: '1.5rem',
              gap: '6px'
            }}>
              <button
                type="button"
                onClick={() => { setConnectTab('phone'); setQrDataUrl(null); }}
                style={{
                  padding: '10px 14px',
                  borderRadius: '10px',
                  border: connectTab === 'phone' ? '1px solid rgba(37, 211, 102, 0.35)' : '1px solid transparent',
                  background: connectTab === 'phone' ? 'linear-gradient(135deg, rgba(37, 211, 102, 0.18) 0%, rgba(18, 140, 126, 0.1) 100%)' : 'transparent',
                  color: connectTab === 'phone' ? '#34d399' : '#94a3b8',
                  fontWeight: connectTab === 'phone' ? 800 : 600,
                  fontSize: '0.88rem',
                  cursor: 'pointer',
                  transition: 'all 0.25s ease',
                  boxShadow: connectTab === 'phone' ? '0 4px 14px rgba(37, 211, 102, 0.15)' : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><path d="M12 18h.01"/></svg>
                <span>كود الهاتف السريع</span>
              </button>
              <button
                type="button"
                onClick={() => { setConnectTab('qr'); setPairingCode(null); }}
                style={{
                  padding: '10px 14px',
                  borderRadius: '10px',
                  border: connectTab === 'qr' ? '1px solid rgba(37, 211, 102, 0.35)' : '1px solid transparent',
                  background: connectTab === 'qr' ? 'linear-gradient(135deg, rgba(37, 211, 102, 0.18) 0%, rgba(18, 140, 126, 0.1) 100%)' : 'transparent',
                  color: connectTab === 'qr' ? '#34d399' : '#94a3b8',
                  fontWeight: connectTab === 'qr' ? 800 : 600,
                  fontSize: '0.88rem',
                  cursor: 'pointer',
                  transition: 'all 0.25s ease',
                  boxShadow: connectTab === 'qr' ? '0 4px 14px rgba(37, 211, 102, 0.15)' : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
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
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: '18px',
                      padding: '1.4rem',
                      marginBottom: '1.25rem',
                      textAlign: 'right',
                      boxSizing: 'border-box'
                    }}>
                      <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 700, color: '#e2e8f0', marginBottom: '10px' }}>
                        رقم هاتف واتساب الخاص بمتجرك:
                      </label>

                      {/* Luxury Phone Input Bar */}
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: '125px 1fr',
                        direction: 'ltr',
                        background: '#060911',
                        border: '1.5px solid rgba(255, 255, 255, 0.14)',
                        borderRadius: '14px',
                        overflow: 'hidden',
                        boxSizing: 'border-box',
                        width: '100%',
                        boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.6)',
                        transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
                      }}>
                        {/* Country Selector Column */}
                        <div style={{
                          position: 'relative',
                          display: 'flex',
                          alignItems: 'center',
                          background: 'rgba(255, 255, 255, 0.04)',
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
                              color: '#ffffff',
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
                              <option key={c.code} value={c.code} style={{ background: '#0f172a', color: '#ffffff' }}>
                                {c.flag} {c.dialCode}
                              </option>
                            ))}
                          </select>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ position: 'absolute', right: '8px', pointerEvents: 'none', color: '#94a3b8' }}>
                            <polyline points="6 9 12 15 18 9"/>
                          </svg>
                        </div>

                        {/* Phone Input Column */}
                        <input
                          type="tel"
                          placeholder={selectedCountry.phonePlaceholder || '0672 00 00 00'}
                          value={phoneNumberInput}
                          onChange={e => setPhoneNumberInput(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '12px 14px',
                            background: 'transparent',
                            border: 'none',
                            color: '#ffffff',
                            fontSize: '1.1rem',
                            fontWeight: 700,
                            letterSpacing: '2px',
                            outline: 'none',
                            fontFamily: 'monospace',
                            boxSizing: 'border-box'
                          }}
                        />
                      </div>

                      {/* Info Pill */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        marginTop: '10px',
                        fontSize: '0.78rem',
                        color: '#93c5fd',
                        background: 'rgba(59, 130, 246, 0.08)',
                        border: '1px solid rgba(59, 130, 246, 0.2)',
                        padding: '8px 12px',
                        borderRadius: '10px',
                        lineHeight: 1.4
                      }}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                        <span>سيتم توليد كود ربط رسمي مكون من 8 خانات لتأكيده على هاتفك فوراً.</span>
                      </div>
                    </div>

                    {waConnecting || (waStatus === 'initializing' && !pairingCode) ? (
                      <div style={{ padding: '2rem 0', textAlign: 'center' }}>
                        <div className="spinner spinner-lg" style={{ margin: '0 auto 1rem', borderColor: '#25d366', borderTopColor: 'transparent' }} />
                        <div style={{ fontWeight: 800, color: '#ffffff', fontSize: '1rem', marginBottom: '4px' }}>
                          جاري تهيئة الاتصال وتوليد كود الربط...
                        </div>
                        <p style={{ fontSize: '0.82rem', color: '#94a3b8' }}>
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
                          color: '#ffffff',
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
                      border: '1.5px dashed rgba(37, 211, 102, 0.5)',
                      borderRadius: '20px',
                      padding: '1.75rem 1.25rem',
                      marginBottom: '1.25rem',
                      boxShadow: '0 0 30px rgba(37, 211, 102, 0.15)'
                    }}>
                      <div style={{ fontSize: '0.84rem', color: '#34d399', fontWeight: 800, marginBottom: '10px' }}>
                        كود الربط الخاص بحسابك (8 خانات)
                      </div>

                      <div style={{
                        fontSize: '2.2rem',
                        fontWeight: 900,
                        letterSpacing: '5px',
                        color: '#ffffff',
                        fontFamily: 'monospace',
                        padding: '10px 20px',
                        background: 'rgba(0, 0, 0, 0.5)',
                        borderRadius: '12px',
                        display: 'inline-block',
                        userSelect: 'all',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)'
                      }}>
                        {pairingCode}
                      </div>

                      <div style={{ marginTop: '14px', display: 'flex', justifyContent: 'center', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          onClick={copyPairingCodeToClipboard}
                          style={{
                            background: copiedCode ? '#10b981' : 'rgba(255, 255, 255, 0.1)',
                            border: '1px solid rgba(255, 255, 255, 0.15)',
                            color: '#ffffff',
                            fontWeight: 700,
                            padding: '8px 18px',
                            borderRadius: '10px',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            transition: 'all 0.2s ease'
                          }}
                        >
                          {copiedCode ? (
                            <>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                              <span>تم النسخ</span>
                            </>
                          ) : (
                            <>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
                              <span>نسخ الكود</span>
                            </>
                          )}
                        </button>

                        {timeLeft !== null && (
                          <span style={{
                            fontSize: '0.8rem',
                            color: timeLeft < 30 ? '#ef4444' : '#94a3b8',
                            background: 'rgba(0, 0, 0, 0.3)',
                            padding: '6px 12px',
                            borderRadius: '8px',
                            border: '1px solid rgba(255, 255, 255, 0.08)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px'
                          }}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                            <span>ينتهي خلال {timeLeft} ثانية</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Step-by-Step Instructions */}
                    <div style={{
                      textAlign: 'right',
                      background: 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid rgba(255, 255, 255, 0.06)',
                      borderRadius: '14px',
                      padding: '1.1rem',
                      fontSize: '0.84rem',
                      lineHeight: 1.6,
                      color: '#cbd5e1',
                      marginBottom: '1rem'
                    }}>
                      <div style={{ fontWeight: 800, color: '#38bdf8', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                        <span>خطوات التأكيد السريعة على هاتفك:</span>
                      </div>
                      <div style={{ marginBottom: '4px' }}>1. افتح تطبيق واتساب ➔ اضغط <strong>الإعدادات (أو النقاط الثلاث)</strong>.</div>
                      <div style={{ marginBottom: '4px' }}>2. اختر <strong>الأجهزة المرتبطة (Linked Devices)</strong> ➔ اضغط <strong>ربط جهاز</strong>.</div>
                      <div style={{ marginBottom: '4px' }}>3. اختر بالأسفل <strong>«الربط باستخدام رقم الهاتف»</strong>.</div>
                      <div>4. اكتب هذا الكود المكون من 8 خانات، وسيتصل البوت فوراً!</div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: QR Code Mode */}
            {connectTab === 'qr' && (
              <div>
                <p style={{ color: '#94a3b8', fontSize: '0.86rem', marginBottom: '1.25rem', lineHeight: 1.5 }}>
                  افتح تطبيق واتساب ➔ الإعدادات ➔ <strong>الأجهزة المرتبطة</strong> ➔ <strong>ربط جهاز</strong> ➔ وجّه الكاميرا للشاشة
                </p>

                {qrDataUrl ? (
                  <div style={{
                    background: '#ffffff',
                    borderRadius: '20px',
                    display: 'inline-block',
                    padding: '1rem',
                    boxShadow: '0 12px 35px rgba(0, 0, 0, 0.6), 0 0 25px rgba(37, 211, 102, 0.2)',
                    marginBottom: '1rem'
                  }}>
                    <img src={qrDataUrl} alt="WhatsApp QR Code" style={{ width: '220px', height: '220px', display: 'block', borderRadius: '8px' }} />
                  </div>
                ) : (
                  <div style={{ padding: '2rem 0' }}>
                    {waConnecting ? (
                      <>
                        <div className="spinner spinner-lg" style={{ margin: '0 auto 1rem', borderColor: '#25d366', borderTopColor: 'transparent' }} />
                        <p style={{ fontSize: '0.85rem', color: '#94a3b8' }}>جاري توليد رمز الـ QR من محرك واتساب...</p>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleWaConnect('qr')}
                        style={{
                          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                          border: 'none',
                          padding: '0.9rem 1.8rem',
                          fontWeight: 800,
                          fontSize: '0.95rem',
                          color: '#ffffff',
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
                    )}
                  </div>
                )}
              </div>
            )}

            <div style={{ marginTop: '1.25rem' }}>
              <button
                type="button"
                onClick={() => setShowWaModal(false)}
                style={{
                  background: 'transparent',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  color: '#94a3b8',
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
