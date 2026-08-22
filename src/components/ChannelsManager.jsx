import { useState, useEffect } from 'react';
import { useToast } from '../context/ToastContext';
import { auth } from '../services/firebase';

const WHATSAPP_ENGINE_URL = import.meta.env.VITE_WHATSAPP_ENGINE_URL || 'https://wa.nosfir.online';
const TELEGRAM_ENGINE_URL = import.meta.env.VITE_ENGINE_URL || 'https://tg.nosfir.online';

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
  const [waConnecting, setWaConnecting] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);

  // Telegram States
  const [tgToken, setTgToken] = useState(bot?.telegramToken || '');
  const [tgSaving, setTgSaving] = useState(false);
  const [showTgModal, setShowTgModal] = useState(false);

  // WhatsApp QR Polling
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
          if (data.status === 'connected') {
            setQrDataUrl(null);
            setShowQrModal(false);
            clearInterval(interval);
            toast.success('تم ربط واتساب بنجاح!');
          }
        }
      } catch (err) {
        console.warn('QR poll error:', err.message);
      }
    }, 2500);
    return () => clearInterval(interval);
  }, [waStatus, bot.id]);

  // Handle WhatsApp Connect
  const handleWaConnect = async () => {
    setWaConnecting(true);
    setShowQrModal(true);
    setWaStatus('initializing');
    try {
      const res = await fetch(`${WHATSAPP_ENGINE_URL}/api/whatsapp/create`, {
        method: 'POST',
        headers: await engineHeaders(),
        body: JSON.stringify({ botId: bot.id }),
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
      await onUpdateBot({ whatsappStatus: 'disconnected' });
      toast.success('تم فصل اتصال واتساب');
    } catch {
      toast.error('فشل قطع الاتصال');
    }
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      
      {/* Header Hub Card */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#ffffff', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="2" width="20" height="8" rx="2" ry="2"/>
                <rect x="2" y="14" width="20" height="8" rx="2" ry="2"/>
                <line x1="6" y1="6" x2="6.01" y2="6"/>
                <line x1="6" y1="18" x2="6.01" y2="18"/>
              </svg>
              مركز قنوات الربط والتواصل المباشر (WhatsApp & Telegram Hub)
            </h3>
            <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', margin: '4px 0 0 0', lineHeight: 1.5 }}>
              اربط متجرك بأقوى قنوات التجارة الإلكترونية. يعمل الذكاء الاصطناعي وكتالوج المنتجات المصور واستخراج الطلبيات تلقائياً 24/7.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.03)', padding: '6px 12px', borderRadius: 'var(--radius-full)', border: '1px solid var(--border-default)' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: connectedCount > 0 ? '#10b981' : '#64748b' }} />
              <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#ffffff' }}>
                {connectedCount} من 2 قنوات نشطة
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Channels Matrix Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>

        {/* 1. WhatsApp Card */}
        <div className={`channel-card channel-card--whatsapp ${isWaConnected ? 'is-connected' : ''}`} style={{ background: 'rgba(14, 21, 38, 0.7)', border: isWaConnected ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '20px', padding: '1.5rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div className="channel-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div className="channel-card-brand" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'rgba(37, 211, 102, 0.15)', color: '#25d366', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(37, 211, 102, 0.3)' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
                  </svg>
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '1.05rem', color: '#ffffff' }}>واتساب (WhatsApp Web)</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>ربط الحساب عبر مسح QR Code فوري</div>
                </div>
              </div>

              <span className={`channel-status-pill ${isWaConnected ? 'channel-status-pill--online' : waStatus === 'waiting_scan' ? 'channel-status-pill--waiting' : 'channel-status-pill--offline'}`}>
                {isWaConnected ? '🟢 متصل' : waStatus === 'waiting_scan' ? '🟡 بانتظار المسح' : '⚪ غير متصل'}
              </span>
            </div>

            <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', marginBottom: '1.5rem', lineHeight: 1.6 }}>
              القناة رقم #1 للمبيعات في الجزائر والوطن العربي: استقبل وأكد طلبيات الزبائن وأرسل ألبومات الصور والتوصيل لـ 58 ولاية آلياً 24/7.
            </p>
          </div>

          <div style={{ paddingTop: '1rem', borderTop: '1px solid rgba(255, 255, 255, 0.06)' }}>
            {isWaConnected ? (
              <button className="btn btn-secondary btn-sm" onClick={handleWaDisconnect} style={{ width: '100%', padding: '0.65rem' }}>
                فصل اتصال واتساب
              </button>
            ) : (
              <button className="btn btn-primary" onClick={handleWaConnect} disabled={waConnecting} style={{ width: '100%', background: 'linear-gradient(135deg, #25d366 0%, #128c7e 100%)', borderColor: 'transparent', padding: '0.75rem', fontWeight: 800, color: '#ffffff', gap: '8px' }}>
                {waConnecting ? <span className="spinner" /> : (
                  <>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/></svg>
                    <span>ربط واتساب عبر مسح QR Code</span>
                  </>
                )}
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

              <span className={`channel-status-pill ${isTgConnected ? 'channel-status-pill--online' : 'channel-status-pill--offline'}`}>
                {isTgConnected ? '🟢 متصل' : '⚪ غير متصل'}
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

      {/* ─── WhatsApp QR Modal ─── */}
      {showQrModal && (
        <div className="modal-overlay" onClick={() => setShowQrModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '440px', textAlign: 'center' }}>
            <h3 className="modal-title" style={{ marginBottom: '0.5rem' }}>مسح رمز الاستجابة السريعة (QR Code)</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.25rem', lineHeight: 1.5 }}>
              افتح تطبيق واتساب على هاتفك ➔ اضغط على النقاط الثلاث / الإعدادات ➔ <strong>الأجهزة المرتبطة</strong> ➔ <strong>ربط جهاز</strong>
            </p>

            {qrDataUrl ? (
              <div style={{ background: '#ffffff', borderRadius: 'var(--radius-lg)', display: 'inline-block', padding: '1rem', boxShadow: '0 8px 30px rgba(0,0,0,0.5)', marginBottom: '1rem' }}>
                <img src={qrDataUrl} alt="WhatsApp QR Code" style={{ width: '220px', height: '220px', display: 'block' }} />
              </div>
            ) : (
              <div style={{ padding: '3rem 0' }}>
                <div className="spinner spinner-lg" style={{ margin: '0 auto 1rem' }} />
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>جاري توليد رمز الـ QR من محرك واتساب...</p>
              </div>
            )}

            <div className="modal-footer" style={{ justifyContent: 'center' }}>
              <button className="btn btn-secondary" onClick={() => setShowQrModal(false)}>إغلاق</button>
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
