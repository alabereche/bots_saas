import { useState, useEffect } from 'react';
import { useToast } from '../context/ToastContext';
import { auth } from '../services/firebase';

const WHATSAPP_ENGINE_URL = import.meta.env.VITE_WHATSAPP_ENGINE_URL || 'http://162.62.233.152:3001';
const TELEGRAM_ENGINE_URL = import.meta.env.VITE_ENGINE_URL || 'http://162.62.233.152:3002';

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

  // Facebook States
  const [fbPageId, setFbPageId] = useState(bot?.facebookPageId || '');
  const [fbPageToken, setFbPageToken] = useState(bot?.facebookPageToken || '');
  const [fbSaving, setFbSaving] = useState(false);
  const [showFbModal, setShowFbModal] = useState(false);

  // Instagram States
  const [igUserId, setIgUserId] = useState(bot?.instagramUserId || '');
  const [igToken, setIgToken] = useState(bot?.instagramToken || '');
  const [igSaving, setIgSaving] = useState(false);
  const [showIgModal, setShowIgModal] = useState(false);

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

  // Handle Facebook Save
  const handleFbSave = async (e) => {
    e.preventDefault();
    setFbSaving(true);
    try {
      await onUpdateBot({
        facebookPageId: fbPageId.trim(),
        facebookPageToken: fbPageToken.trim(),
        facebookEnabled: !!fbPageToken.trim(),
      });
      setShowFbModal(false);
      toast.success('تم تحديث إعدادات قناة فيسبوك مسنجر');
    } catch (err) {
      toast.error('فشل حفظ إعدادات فيسبوك: ' + err.message);
    } finally {
      setFbSaving(false);
    }
  };

  // Handle Instagram Save
  const handleIgSave = async (e) => {
    e.preventDefault();
    setIgSaving(true);
    try {
      await onUpdateBot({
        instagramUserId: igUserId.trim(),
        instagramToken: igToken.trim(),
        instagramEnabled: !!igToken.trim(),
      });
      setShowIgModal(false);
      toast.success('تم تحديث إعدادات قناة إنستغرام');
    } catch (err) {
      toast.error('فشل حفظ إعدادات إنستغرام: ' + err.message);
    } finally {
      setIgSaving(false);
    }
  };

  const isWaConnected = waStatus === 'connected' || bot?.whatsappStatus === 'connected';
  const isTgConnected = !!bot?.telegramToken;
  const isFbConnected = !!bot?.facebookPageToken;
  const isIgConnected = !!bot?.instagramToken;

  const connectedCount = [isWaConnected, isTgConnected, isFbConnected, isIgConnected].filter(Boolean).length;

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
              مركز قنوات الربط والتواصل الموحد (Omnichannel Channels Hub)
            </h3>
            <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', margin: '4px 0 0 0', lineHeight: 1.5 }}>
              اربط متجرك بجميع منصات التواصل الاجتماعي. يعمل الذكاء الاصطناعي وكتالوج المنتجات والطلبيات عبر جميع القنوات بشكل موحد وتلقائي.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.03)', padding: '6px 12px', borderRadius: 'var(--radius-full)', border: '1px solid var(--border-default)' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: connectedCount > 0 ? '#10b981' : '#64748b' }} />
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#ffffff' }}>
              {connectedCount} من 4 قنوات نشطة
            </span>
          </div>
        </div>
      </div>

      {/* Channels Matrix Grid */}
      <div className="channels-matrix-grid">

        {/* 1. WhatsApp Card */}
        <div className={`channel-card channel-card--whatsapp ${isWaConnected ? 'is-connected' : ''}`}>
          <div>
            <div className="channel-card-header">
              <div className="channel-card-brand">
                <div className="channel-icon-badge channel-icon-badge--whatsapp">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
                  </svg>
                </div>
                <div>
                  <div className="channel-card-title">واتساب (WhatsApp)</div>
                  <div className="channel-card-desc">ربط الحساب عبر مسح QR Code</div>
                </div>
              </div>

              <span className={`channel-status-pill ${isWaConnected ? 'channel-status-pill--online' : waStatus === 'waiting_scan' ? 'channel-status-pill--waiting' : 'channel-status-pill--offline'}`}>
                {isWaConnected ? 'متصل' : waStatus === 'waiting_scan' ? 'انتظار المسح' : 'غير متصل'}
              </span>
            </div>

            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1.25rem', lineHeight: 1.5 }}>
              استقبل وأكد طلبيات زبائن واتساب وأرسل إشعارات الشحن تلقائياً 24/7.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '8px', paddingTop: '0.5rem', borderTop: '1px solid var(--border-subtle)' }}>
            {isWaConnected ? (
              <button className="btn btn-secondary btn-sm" onClick={handleWaDisconnect} style={{ width: '100%' }}>
                فصل الاتصال
              </button>
            ) : (
              <button className="btn btn-primary btn-sm" onClick={handleWaConnect} disabled={waConnecting} style={{ width: '100%', background: '#16a34a', borderColor: '#16a34a' }}>
                {waConnecting ? <span className="spinner" /> : 'ربط عبر QR Code'}
              </button>
            )}
          </div>
        </div>

        {/* 2. Telegram Card */}
        <div className={`channel-card channel-card--telegram ${isTgConnected ? 'is-connected' : ''}`}>
          <div>
            <div className="channel-card-header">
              <div className="channel-card-brand">
                <div className="channel-icon-badge channel-icon-badge--telegram">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13"/>
                    <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                  </svg>
                </div>
                <div>
                  <div className="channel-card-title">تيليغرام (Telegram)</div>
                  <div className="channel-card-desc">ربط البوت عبر BotFather Token</div>
                </div>
              </div>

              <span className={`channel-status-pill ${isTgConnected ? 'channel-status-pill--online' : 'channel-status-pill--offline'}`}>
                {isTgConnected ? 'متصل' : 'غير متصل'}
              </span>
            </div>

            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1.25rem', lineHeight: 1.5 }}>
              رد فوري على استفسارات المشتركين وقنوات ومجموعات التيليغرام.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '8px', paddingTop: '0.5rem', borderTop: '1px solid var(--border-subtle)' }}>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowTgModal(true)} style={{ width: '100%' }}>
              {isTgConnected ? 'تعديل الإعدادات' : 'إدخال Token تيليغرام'}
            </button>
          </div>
        </div>

        {/* 3. Facebook Messenger Card */}
        <div className={`channel-card channel-card--messenger ${isFbConnected ? 'is-connected' : ''}`}>
          <div>
            <div className="channel-card-header">
              <div className="channel-card-brand">
                <div className="channel-icon-badge channel-icon-badge--messenger">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
                    <polyline points="8 13 11 9 13 13 16 10"/>
                  </svg>
                </div>
                <div>
                  <div className="channel-card-title">فيسبوك مسنجر (Messenger)</div>
                  <div className="channel-card-desc">ربط رسائل صفحة فيسبوك</div>
                </div>
              </div>

              <span className={`channel-status-pill ${isFbConnected ? 'channel-status-pill--online' : 'channel-status-pill--offline'}`}>
                {isFbConnected ? 'متصل' : 'قريباً / إعداد'}
              </span>
            </div>

            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1.25rem', lineHeight: 1.5 }}>
              الرد التلقائي على رسائل صفحة الفيسبوك وتحويل المعلقين إلى زبائن.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '8px', paddingTop: '0.5rem', borderTop: '1px solid var(--border-subtle)' }}>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowFbModal(true)} style={{ width: '100%' }}>
              {isFbConnected ? 'تعديل الإعدادات' : 'ربط صفحة فيسبوك'}
            </button>
          </div>
        </div>

        {/* 4. Instagram Direct Card */}
        <div className={`channel-card channel-card--instagram ${isIgConnected ? 'is-connected' : ''}`}>
          <div>
            <div className="channel-card-header">
              <div className="channel-card-brand">
                <div className="channel-icon-badge channel-icon-badge--instagram">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
                    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
                    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
                  </svg>
                </div>
                <div>
                  <div className="channel-card-title">إنستغرام (Instagram Direct)</div>
                  <div className="channel-card-desc">الرد على الرسائل الخاصة DMs</div>
                </div>
              </div>

              <span className={`channel-status-pill ${isIgConnected ? 'channel-status-pill--online' : 'channel-status-pill--offline'}`}>
                {isIgConnected ? 'متصل' : 'قريباً / إعداد'}
              </span>
            </div>

            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1.25rem', lineHeight: 1.5 }}>
              تحويل المتابعين واستفسارات الـ Stories و DMs إلى مبيعات مسجلة في ثوانٍ.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '8px', paddingTop: '0.5rem', borderTop: '1px solid var(--border-subtle)' }}>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowIgModal(true)} style={{ width: '100%' }}>
              {isIgConnected ? 'تعديل الإعدادات' : 'ربط حساب إنستغرام'}
            </button>
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

      {/* ─── Facebook Config Modal ─── */}
      {showFbModal && (
        <div className="modal-overlay" onClick={() => !fbSaving && setShowFbModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <h3 className="modal-title">إعداد قناة فيسبوك مسنجر (Facebook Page)</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.25rem', lineHeight: 1.5 }}>
              أدخل معرف الصفحة و Page Access Token من بوابة Meta for Developers.
            </p>

            <form onSubmit={handleFbSave}>
              <div className="form-group">
                <label className="form-label">Page ID</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="مثال: 109876543210123"
                  value={fbPageId}
                  onChange={e => setFbPageId(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Page Access Token</label>
                <input
                  type="password"
                  className="form-input"
                  placeholder="EAA..."
                  value={fbPageToken}
                  onChange={e => setFbPageToken(e.target.value)}
                />
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowFbModal(false)} disabled={fbSaving}>إلغاء</button>
                <button type="submit" className="btn btn-primary" disabled={fbSaving}>
                  {fbSaving ? <span className="spinner" /> : 'حفظ الإعدادات'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Instagram Config Modal ─── */}
      {showIgModal && (
        <div className="modal-overlay" onClick={() => !igSaving && setShowIgModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <h3 className="modal-title">إعداد قناة إنستغرام (Instagram Direct)</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.25rem', lineHeight: 1.5 }}>
              أدخل معرف حساب إنستغرام الاحترافي و Access Token.
            </p>

            <form onSubmit={handleIgSave}>
              <div className="form-group">
                <label className="form-label">Instagram Business User ID</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="مثال: 17841400000000000"
                  value={igUserId}
                  onChange={e => setIgUserId(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Access Token</label>
                <input
                  type="password"
                  className="form-input"
                  placeholder="IGQ..."
                  value={igToken}
                  onChange={e => setIgToken(e.target.value)}
                />
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowIgModal(false)} disabled={igSaving}>إلغاء</button>
                <button type="submit" className="btn btn-primary" disabled={igSaving}>
                  {igSaving ? <span className="spinner" /> : 'حفظ الإعدادات'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
