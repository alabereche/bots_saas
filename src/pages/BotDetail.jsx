import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getDoc, updateDoc, deleteDoc, getDocs } from '../services/nexcloud';
import { useToast } from '../context/ToastContext';

export default function BotDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [bot, setBot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [conversations, setConversations] = useState([]);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedConv, setSelectedConv] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const businessTypeLabels = {
    restaurant: 'مطعم', shop: 'متجر', clinic: 'عيادة',
    salon: 'صالون', delivery: 'توصيل', education: 'تعليم', other: 'اخرى',
  };

  const responseStyleLabels = { formal: 'رسمي', friendly: 'ودود', concise: 'مختصر' };
  const languageLabels = { arabic_formal: 'عربي فصيح', arabic_algerian: 'دارجة جزائرية', auto: 'تلقائي' };

  const loadConversations = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const res = await getDocs('conversations', { botId: id });
      const sorted = (res.documents?.map(d => ({ id: d.id, ...d.data })) || [])
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setConversations(sorted);
    } catch { /* ignore */ }
    setRefreshing(false);
  }, [id]);

  useEffect(() => {
    async function loadBot() {
      try {
        const res = await getDoc('bots', id);
        setBot({ id: res.document.id, ...res.document.data });
      } catch (e) {
        toast.error('تعذر تحميل بيانات البوت');
        navigate('/dashboard');
      } finally {
        setLoading(false);
      }
    }
    loadBot();
    loadConversations(true);
  }, [id, loadConversations]);

  // Auto-refresh conversations every 15 seconds
  useEffect(() => {
    const interval = setInterval(() => loadConversations(true), 15000);
    return () => clearInterval(interval);
  }, [loadConversations]);

  const toggleActive = async () => {
    try {
      await updateDoc('bots', id, { isActive: !bot.isActive });
      setBot(prev => ({ ...prev, isActive: !prev.isActive }));
      toast.success(bot.isActive ? 'تم ايقاف البوت' : 'تم تشغيل البوت');
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleDelete = async () => {
    try {
      await deleteDoc('bots', id);
      toast.success('تم حذف البوت');
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.message);
    }
  };

  if (loading) {
    return (
      <div className="page-loader">
        <div className="spinner spinner-lg" style={{ color: 'var(--accent-primary)' }} />
      </div>
    );
  }

  if (!bot) return null;

  return (
    <div className="page-container animate-enter">
      <button className="btn btn-secondary" onClick={() => navigate('/dashboard')} style={{ marginBottom: 'var(--space-6)', padding: '0.5rem 1rem', fontSize: '0.875rem' }}>
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        العودة للوحة التحكم
      </button>

      {/* Header */}
      <div className="detail-header">
        <div className="detail-info">
          <div className="detail-avatar">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
          </div>
          <div>
            <h1 className="page-title" style={{ marginBottom: 'var(--space-1)' }}>{bot.botName || bot.businessName}</h1>
            <div className="detail-meta">
              <span className={`badge ${bot.isActive ? 'badge-success' : 'badge-error'}`}>
                <span className="badge-dot" />
                {bot.isActive ? 'نشط' : 'متوقف'}
              </span>
              <span className="badge badge-accent">{businessTypeLabels[bot.businessType] || bot.businessType}</span>
            </div>
          </div>
        </div>
        <div className="detail-actions">
          <button className={`btn ${bot.isActive ? 'btn-secondary' : 'btn-primary'}`} onClick={toggleActive}>
            {bot.isActive ? (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                ايقاف
              </>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                تشغيل
              </>
            )}
          </button>
          <button className="btn btn-danger" onClick={() => setShowDeleteModal(true)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            حذف
          </button>
        </div>
      </div>

      {/* Detail Grid */}
      <div className="detail-grid">
        {/* Bot Info */}
        <div className="card">
          <h3 className="card-title" style={{ marginBottom: 'var(--space-5)' }}>معلومات المشروع</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <InfoRow label="اسم المشروع" value={bot.businessName} />
            <InfoRow label="اسم البوت" value={bot.botName} />
            <InfoRow label="نوع النشاط" value={businessTypeLabels[bot.businessType]} />
            <InfoRow label="الوصف" value={bot.description} />
            <InfoRow label="الخدمات" value={bot.services} />
            <InfoRow label="ساعات العمل" value={bot.workingHours} />
            <InfoRow label="الموقع" value={bot.location} />
            <InfoRow label="التواصل" value={bot.contact} />
          </div>
        </div>

        {/* Personality & Technical */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
          <div className="card">
            <h3 className="card-title" style={{ marginBottom: 'var(--space-5)' }}>شخصية البوت</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <InfoRow label="أسلوب الرد" value={responseStyleLabels[bot.responseStyle]} />
              <InfoRow label="اللغة" value={languageLabels[bot.language]} />
              {bot.customInstructions && <InfoRow label="تعليمات خاصة" value={bot.customInstructions} />}
            </div>
          </div>

          <div className="card">
            <h3 className="card-title" style={{ marginBottom: 'var(--space-5)' }}>الاعداد التقني</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <InfoRow label="نموذج AI" value={bot.aiModel?.split('/').pop()} />
              <InfoRow label="توكن البوت" value={bot.telegramToken ? '••••••' + bot.telegramToken.slice(-8) : '--'} mono />
              <InfoRow label="OpenRouter Key" value={bot.openrouterKey ? '••••••' + bot.openrouterKey.slice(-6) : '--'} mono />
              {bot.anthropicKey && <InfoRow label="Anthropic Key" value={'••••••' + bot.anthropicKey.slice(-6)} mono />}
              {bot.openaiKey && <InfoRow label="OpenAI Key" value={'••••••' + bot.openaiKey.slice(-6)} mono />}
              {bot.geminiKey && <InfoRow label="Gemini Key" value={'••••••' + bot.geminiKey.slice(-6)} mono />}
            </div>
          </div>
        </div>
      </div>

      {/* Conversations */}
      <div className="card" style={{ marginTop: 'var(--space-5)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-5)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <h3 className="card-title" style={{ margin: 0 }}>محادثات الزبائن</h3>
            <span className="badge badge-accent">{conversations.length}</span>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={() => loadConversations()} disabled={refreshing}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }}><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
            تحديث
          </button>
        </div>
        {conversations.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--text-tertiary)' }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto var(--space-3)', opacity: 0.5 }}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            <p style={{ fontSize: 'var(--text-base)', marginBottom: 'var(--space-2)' }}>لا توجد محادثات بعد</p>
            <p style={{ fontSize: 'var(--text-sm)' }}>عندما يراسل زبون البوت على تيليغرام، ستظهر المحادثات هنا تلقائياً</p>
          </div>
        ) : (
          <div className="conversation-list">
            {conversations.map((conv, i) => (
              <div key={conv.id} className="conversation-item" onClick={() => setSelectedConv(conv)} style={{ cursor: 'pointer', animationDelay: `${i * 50}ms`, animation: 'fadeInUp 0.3s ease-out both' }}>
                <div className="conversation-avatar">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                </div>
                <div className="conversation-content" style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-1)' }}>
                    <span style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>{conv.userName || 'زبون'}</span>
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', flexShrink: 0 }}>
                      {conv.createdAt ? formatTime(conv.createdAt) : '--'}
                    </span>
                  </div>
                  <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <span style={{ color: 'var(--accent-secondary)' }}>الزبون: </span>{conv.lastMessage || '...'}
                  </div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '2px' }}>
                    <span style={{ color: 'var(--accent-primary)' }}>البوت: </span>{conv.botReply || '...'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Telegram Link */}
      {bot.telegramToken && (
        <div className="card" style={{ marginTop: 'var(--space-5)', textAlign: 'center', padding: 'var(--space-8)' }}>
          <h3 className="card-title" style={{ marginBottom: 'var(--space-4)' }}>رابط البوت على تيليغرام</h3>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-5)', fontSize: 'var(--text-sm)' }}>
            شارك هذا الرابط مع عملائك ليتواصلوا مع البوت
          </p>
          <a href={`https://t.me/`} target="_blank" rel="noopener noreferrer" className="btn-telegram">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
            فتح البوت على تيليغرام
          </a>
        </div>
      )}

      {/* WhatsApp QR Code Connection */}
      {bot.whatsappEnabled && (
        <WhatsAppConnect botId={bot.id} botName={bot.botName} status={bot.whatsappStatus} />
      )}

      {/* Delete Modal */}
      {/* Conversation Detail Modal */}
      {selectedConv && (
        <div className="modal-overlay" onClick={() => setSelectedConv(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h3 className="modal-title">محادثة مع {selectedConv.userName || 'زبون'}</h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setSelectedConv(null)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', textAlign: 'center' }}>
                {selectedConv.createdAt ? new Date(selectedConv.createdAt).toLocaleString('ar') : ''}
              </div>
              {/* User message */}
              <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-start' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--surface-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                </div>
                <div style={{ background: 'var(--surface-tertiary)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-3) var(--space-4)', maxWidth: '85%' }}>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--accent-secondary)', fontWeight: 600, marginBottom: 'var(--space-1)' }}>{selectedConv.userName || 'زبون'}</div>
                  <div style={{ fontSize: 'var(--text-sm)', lineHeight: 'var(--leading-relaxed)', whiteSpace: 'pre-wrap' }}>{selectedConv.lastMessage}</div>
                </div>
              </div>
              {/* Bot reply */}
              <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-start', flexDirection: 'row-reverse' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
                </div>
                <div style={{ background: 'rgba(124, 93, 250, 0.1)', border: '1px solid rgba(124, 93, 250, 0.2)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-3) var(--space-4)', maxWidth: '85%' }}>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--accent-primary)', fontWeight: 600, marginBottom: 'var(--space-1)' }}>{bot.botName}</div>
                  <div style={{ fontSize: 'var(--text-sm)', lineHeight: 'var(--leading-relaxed)', whiteSpace: 'pre-wrap' }}>{selectedConv.botReply}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {showDeleteModal && (
        <div className="modal-overlay" onClick={() => setShowDeleteModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">حذف البوت</h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowDeleteModal(false)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div className="modal-body">
              <p style={{ color: 'var(--text-secondary)' }}>
                هل أنت متأكد من حذف البوت "{bot.botName}"؟ هذا الإجراء لا يمكن التراجع عنه.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-danger" onClick={handleDelete}>نعم، احذف</button>
              <button className="btn btn-secondary" onClick={() => setShowDeleteModal(false)}>الغاء</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function formatTime(dateStr) {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now - d;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'الآن';
  if (diffMin < 60) return `منذ ${diffMin} د`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `منذ ${diffH} س`;
  return d.toLocaleDateString('ar');
}

function InfoRow({ label, value, mono }) {
  return (
    <div style={{ display: 'flex', borderBottom: '1px solid var(--border-primary)', paddingBottom: 'var(--space-3)' }}>
      <span style={{ color: 'var(--text-tertiary)', fontSize: 'var(--text-sm)', minWidth: '120px', flexShrink: 0 }}>{label}</span>
      <span style={{ 
        fontSize: 'var(--text-sm)', 
        whiteSpace: 'pre-wrap', 
        wordBreak: 'break-word',
        fontFamily: mono ? 'var(--font-mono)' : 'inherit',
        direction: mono ? 'ltr' : 'inherit'
      }}>
        {value || '--'}
      </span>
    </div>
  );
}

const WA_ENGINE = import.meta.env.VITE_WA_ENGINE_URL || 'http://localhost:3001';
const WA_KEY = import.meta.env.VITE_API_KEY;

function WhatsAppConnect({ botId, botName, status: initialStatus }) {
  const [waStatus, setWaStatus] = useState(initialStatus || 'not_initialized');
  const [qrDataUrl, setQrDataUrl] = useState(null);
  const [connecting, setConnecting] = useState(false);

  // Poll for QR / status when waiting
  useEffect(() => {
    if (waStatus !== 'waiting_scan' && waStatus !== 'initializing') return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${WA_ENGINE}/api/whatsapp/${botId}/qr`, {
          headers: { 'x-api-key': WA_KEY },
        });
        const data = await res.json();
        setWaStatus(data.status);
        if (data.qrDataUrl) setQrDataUrl(data.qrDataUrl);
        if (data.status === 'connected') {
          setQrDataUrl(null);
          clearInterval(interval);
        }
      } catch {}
    }, 3000);

    return () => clearInterval(interval);
  }, [waStatus, botId]);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const res = await fetch(`${WA_ENGINE}/api/whatsapp/create`, {
        method: 'POST',
        headers: { 'x-api-key': WA_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ botId }),
      });
      const data = await res.json();
      if (data.success) {
        setWaStatus('initializing');
      }
    } catch (err) {
      console.error('WhatsApp connect error:', err);
    }
    setConnecting(false);
  };

  const handleDisconnect = async () => {
    try {
      await fetch(`${WA_ENGINE}/api/whatsapp/${botId}/stop`, {
        method: 'POST',
        headers: { 'x-api-key': WA_KEY },
      });
      setWaStatus('disconnected');
      setQrDataUrl(null);
    } catch {}
  };

  const statusConfig = {
    not_initialized: { label: 'غير متصل', color: 'var(--text-tertiary)', bg: 'var(--surface-tertiary)' },
    initializing: { label: 'جاري التهيئة...', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)' },
    waiting_scan: { label: 'في انتظار المسح', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)' },
    connected: { label: 'متصل', color: '#25D366', bg: 'rgba(37, 211, 102, 0.1)' },
    disconnected: { label: 'غير متصل', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)' },
    error: { label: 'خطأ', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)' },
  };

  const st = statusConfig[waStatus] || statusConfig.not_initialized;

  return (
    <div className="card" style={{ marginTop: 'var(--space-5)', textAlign: 'center', padding: 'var(--space-6)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="#25D366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
        <h3 className="card-title" style={{ margin: 0 }}>ربط واتساب</h3>
      </div>

      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)', padding: 'var(--space-2) var(--space-4)', borderRadius: 'var(--radius-full)', background: st.bg, marginBottom: 'var(--space-5)' }}>
        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: st.color, animation: waStatus === 'connected' ? 'none' : (waStatus === 'waiting_scan' || waStatus === 'initializing' ? 'pulse 2s infinite' : 'none') }} />
        <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: st.color }}>{st.label}</span>
      </div>

      {waStatus === 'not_initialized' || waStatus === 'disconnected' || waStatus === 'error' ? (
        <div>
          <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-4)' }}>
            اضغط لبدء ربط واتساب ثم امسح QR Code من هاتفك
          </p>
          <button className="btn btn-primary" onClick={handleConnect} disabled={connecting} style={{ background: '#25D366', borderColor: '#25D366' }}>
            {connecting ? <span className="spinner" /> : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
            )}
            ربط واتساب
          </button>
        </div>
      ) : waStatus === 'waiting_scan' && qrDataUrl ? (
        <div>
          <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-4)' }}>
            امسح هذا الكود بتطبيق واتساب على هاتفك
          </p>
          <div style={{ background: '#fff', borderRadius: 'var(--radius-lg)', display: 'inline-block', padding: 'var(--space-4)' }}>
            <img src={qrDataUrl} alt="WhatsApp QR Code" style={{ width: '250px', height: '250px' }} />
          </div>
          <p style={{ color: 'var(--text-tertiary)', fontSize: 'var(--text-xs)', marginTop: 'var(--space-3)' }}>
            افتح واتساب &rarr; الأجهزة المرتبطة &rarr; ربط جهاز
          </p>
        </div>
      ) : waStatus === 'initializing' ? (
        <div>
          <div className="spinner spinner-lg" style={{ color: '#25D366', margin: '0 auto var(--space-3)' }} />
          <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>جاري تهيئة الاتصال...</p>
        </div>
      ) : waStatus === 'connected' ? (
        <div>
          <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(37, 211, 102, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto var(--space-3)' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#25D366" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <p style={{ color: '#25D366', fontWeight: 600, marginBottom: 'var(--space-2)' }}>واتساب متصل بنجاح</p>
          <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-4)' }}>
            البوت يرد تلقائياً على رسائل واتساب الآن
          </p>
          <button className="btn btn-secondary btn-sm" onClick={handleDisconnect}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            فصل الاتصال
          </button>
        </div>
      ) : null}
    </div>
  );
}
