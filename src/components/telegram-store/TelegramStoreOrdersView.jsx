import React, { useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  Clock,
  Send,
  ExternalLink,
  Copy,
  Check,
  Search,
  MessageSquare,
  Image as ImageIcon,
  Sparkles,
  ShieldCheck,
  AlertCircle,
  Smartphone,
  Eye,
  RotateCcw,
} from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { auth } from '../../services/firebase';

const TELEGRAM_ENGINE_URL = import.meta.env.VITE_ENGINE_URL || 'https://tg.nosfir.online';

export default function TelegramStoreOrdersView({
  orders = [],
  bot,
  onUpdateDelivery,
  onOpenChat,
}) {
  const toast = useToast();

  const [filter, setFilter] = useState('all'); // 'all' | 'pending' | 'delivered' | 'cancelled'
  const [search, setSearch] = useState('');
  const [copiedCode, setCopiedCode] = useState(null);

  // Delivery Modal State
  const [deliveringOrder, setDeliveringOrder] = useState(null);
  const [credentialsText, setCredentialsText] = useState('');
  const [delivering, setDelivering] = useState(false);

  // Reject Modal State
  const [rejectingOrder, setRejectingOrder] = useState(null);
  const [rejectReason, setRejectReason] = useState('الوصل غير واضح أو المبلغ المحول غير مطابق، يرجى إعادة إرسال الوصل الصحيح.');
  const [rejecting, setRejecting] = useState(false);

  // Receipt Lightbox Modal
  const [viewingReceiptUrl, setViewingReceiptUrl] = useState(null);

  // Filter & Search logic
  const filteredOrders = orders.filter(order => {
    const status = order.deliveryStatus || order.status || 'pending';
    const isPending = status === 'pending' || status === 'pending_verification' || status === 'accepted' || status === 'new';
    const isDelivered = status === 'delivered' || status === 'confirmed';
    const isCancelled = status === 'cancelled' || status === 'rejected';

    if (filter === 'pending' && !isPending) return false;
    if (filter === 'delivered' && !isDelivered) return false;
    if (filter === 'cancelled' && !isCancelled) return false;

    if (search.trim()) {
      const q = search.toLowerCase().trim();
      const matchName = (order.customerName || '').toLowerCase().includes(q);
      const matchCode = (order.trackingCode || '').toLowerCase().includes(q);
      const matchProd = (order.product || '').toLowerCase().includes(q);
      const matchPhone = (order.phone || '').toLowerCase().includes(q);
      const matchNotes = (order.notes || '').toLowerCase().includes(q);
      if (!matchName && !matchCode && !matchProd && !matchPhone && !matchNotes) return false;
    }

    return true;
  });

  const pendingCount = orders.filter(o => {
    const s = o.deliveryStatus || o.status || 'pending';
    return s === 'pending' || s === 'pending_verification' || s === 'accepted' || s === 'new';
  }).length;

  const deliveredCount = orders.filter(o => {
    const s = o.deliveryStatus || o.status;
    return s === 'delivered' || s === 'confirmed';
  }).length;

  const cancelledCount = orders.filter(o => {
    const s = o.deliveryStatus || o.status;
    return s === 'cancelled' || s === 'rejected';
  }).length;

  const copyToClipboard = (text, id) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedCode(id);
    toast.success('تم النسخ إلى الحافظة');
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleConfirmDelivery = async (e) => {
    e.preventDefault();
    if (!credentialsText.trim()) {
      toast.error('يرجى كتابة بيانات الحساب أو كود التفعيل قبل الإرسال');
      return;
    }
    if (!deliveringOrder) return;

    setDelivering(true);
    try {
      const deliveryMessage =
        `🎉 *تهانينا! تم تأكيد طلبك بنجاح!*\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `📦 *المنتج:* ${deliveringOrder.product || 'منتج رقمي'}\n` +
        (deliveringOrder.trackingCode ? `🔖 *رقم الطلب:* #${deliveringOrder.trackingCode}\n` : '') +
        `━━━━━━━━━━━━━━━━━━\n\n` +
        `🔑 *بيانات الاستلام والتفعيل الخاصة بك:*\n` +
        `\`\`\`\n${credentialsText.trim()}\n\`\`\`\n\n` +
        `شكراً لثقتكم واختياركم لنا! نتمنى لكم تجربة ممتازة. ✨`;

      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`${TELEGRAM_ENGINE_URL}/api/reply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          botId: bot.id,
          customerId: deliveringOrder.customerId,
          telegramUserId: deliveringOrder.customerId,
          platform: 'telegram',
          message: deliveryMessage,
          system: true,
        }),
      });

      if (!res.ok) {
        console.warn('[Telegram Store] Reply API returned non-200, but updating Firestore order');
      }

      await onUpdateDelivery(deliveringOrder.id, {
        deliveryStatus: 'delivered',
        orderStatus: 'confirmed',
        deliveredCredentials: credentialsText.trim(),
        deliveredAt: new Date().toISOString(),
        note: 'تم الاعتماد وتسليم البيانات للزبون في تيليغرام',
      });

      toast.success('تم تسليم الطلب وإرسال البيانات للزبون في تيليغرام بنجاح!');
      setDeliveringOrder(null);
      setCredentialsText('');
    } catch (err) {
      toast.error('فشل التسليم: ' + err.message);
    } finally {
      setDelivering(false);
    }
  };

  const handleConfirmReject = async (e) => {
    e.preventDefault();
    if (!rejectReason.trim()) {
      toast.error('يرجى تحديد سبب الرفض');
      return;
    }
    if (!rejectingOrder) return;

    setRejecting(true);
    try {
      const rejectMessage =
        `⚠️ *تنبيه بخصوص طلبك* ${rejectingOrder.trackingCode ? `(#${rejectingOrder.trackingCode})` : ''}:\n\n` +
        `عذراً، لم نتمكن من اعتماد الوصل/الطلب للأسباب التالية:\n` +
        `« ${rejectReason.trim()} »\n\n` +
        `يرجى مراجعة بيانات التحويل وإعادة إرسال الوصل الصحيح، أو التواصل مع الدعم للمساعدة.`;

      const token = await auth.currentUser?.getIdToken();
      await fetch(`${TELEGRAM_ENGINE_URL}/api/reply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          botId: bot.id,
          customerId: rejectingOrder.customerId,
          telegramUserId: rejectingOrder.customerId,
          platform: 'telegram',
          message: rejectMessage,
          system: true,
        }),
      }).catch(() => {});

      await onUpdateDelivery(rejectingOrder.id, {
        deliveryStatus: 'cancelled',
        orderStatus: 'cancelled',
        rejectionReason: rejectReason.trim(),
        note: 'تم رفض الوصل وإخطار الزبون',
      });

      toast.success('تم رفض الطلب وإخطار الزبون على تيليغرام');
      setRejectingOrder(null);
    } catch (err) {
      toast.error('فشل الرفض: ' + err.message);
    } finally {
      setRejecting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', direction: 'rtl' }}>
      {/* ─── Top Stats Bar ─── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '12px',
      }}>
        <div style={{
          background: 'rgba(15, 23, 42, 0.65)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '14px',
          padding: '1rem',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '10px',
            background: 'rgba(14, 165, 233, 0.15)',
            color: '#38bdf8',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Smartphone size={20} />
          </div>
          <div>
            <div style={{ fontSize: '0.78rem', color: 'rgba(255, 255, 255, 0.55)', fontWeight: 600 }}>إجمالي الطلبيات</div>
            <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#ffffff' }}>{orders.length}</div>
          </div>
        </div>

        <div style={{
          background: 'rgba(15, 23, 42, 0.65)',
          border: pendingCount > 0 ? '1px solid rgba(245, 158, 11, 0.35)' : '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '14px',
          padding: '1rem',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '10px',
            background: 'rgba(245, 158, 11, 0.15)',
            color: '#fbbf24',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Clock size={20} />
          </div>
          <div>
            <div style={{ fontSize: '0.78rem', color: 'rgba(255, 255, 255, 0.55)', fontWeight: 600 }}>بانتظار مراجعة الوصل</div>
            <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#fbbf24' }}>{pendingCount}</div>
          </div>
        </div>

        <div style={{
          background: 'rgba(15, 23, 42, 0.65)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '14px',
          padding: '1rem',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '10px',
            background: 'rgba(16, 185, 129, 0.15)',
            color: '#34d399',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <CheckCircle2 size={20} />
          </div>
          <div>
            <div style={{ fontSize: '0.78rem', color: 'rgba(255, 255, 255, 0.55)', fontWeight: 600 }}>تم الاعتماد والتسليم</div>
            <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#34d399' }}>{deliveredCount}</div>
          </div>
        </div>

        <div style={{
          background: 'rgba(15, 23, 42, 0.65)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '14px',
          padding: '1rem',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '10px',
            background: 'rgba(239, 68, 68, 0.15)',
            color: '#f87171',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <XCircle size={20} />
          </div>
          <div>
            <div style={{ fontSize: '0.78rem', color: 'rgba(255, 255, 255, 0.55)', fontWeight: 600 }}>مرفوضة / ملغية</div>
            <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#f87171' }}>{cancelledCount}</div>
          </div>
        </div>
      </div>

      {/* ─── Filter & Search Bar ─── */}
      <div style={{
        background: 'rgba(15, 23, 42, 0.65)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '14px',
        padding: '0.75rem 1rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
      }}>
        {/* Filter Pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {[
            { key: 'all', label: 'الكل', count: orders.length },
            { key: 'pending', label: 'بانتظار المراجعة', count: pendingCount, highlight: pendingCount > 0 },
            { key: 'delivered', label: 'تم التسليم', count: deliveredCount },
            { key: 'cancelled', label: 'مرفوضة', count: cancelledCount },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              style={{
                background: filter === tab.key
                  ? (tab.highlight ? 'rgba(245, 158, 11, 0.25)' : 'rgba(14, 165, 233, 0.2)')
                  : 'rgba(255, 255, 255, 0.05)',
                color: filter === tab.key
                  ? (tab.highlight ? '#fbbf24' : '#38bdf8')
                  : 'rgba(255, 255, 255, 0.65)',
                border: filter === tab.key
                  ? (tab.highlight ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid rgba(56, 189, 248, 0.4)')
                  : '1px solid transparent',
                borderRadius: '8px',
                padding: '0.45rem 0.9rem',
                fontSize: '0.82rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.15s ease',
              }}
            >
              <span>{tab.label}</span>
              <span style={{
                background: 'rgba(0, 0, 0, 0.25)',
                padding: '2px 6px',
                borderRadius: '6px',
                fontSize: '0.74rem',
              }}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: 'rgba(0, 0, 0, 0.3)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '8px',
          padding: '0.4rem 0.75rem',
          minWidth: '260px',
        }}>
          <Search size={15} color="rgba(255, 255, 255, 0.4)" />
          <input
            type="text"
            placeholder="بحث بالاسم، كود التتبع، أو المنتج..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#ffffff',
              fontSize: '0.84rem',
              outline: 'none',
              width: '100%',
              direction: 'rtl',
            }}
          />
        </div>
      </div>

      {/* ─── Orders List ─── */}
      {filteredOrders.length === 0 ? (
        <div style={{
          background: 'rgba(15, 23, 42, 0.4)',
          border: '1px dashed rgba(255, 255, 255, 0.12)',
          borderRadius: '16px',
          padding: '3.5rem 1.5rem',
          textAlign: 'center',
          color: 'rgba(255, 255, 255, 0.5)',
        }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '16px',
            background: 'rgba(56, 189, 248, 0.1)',
            color: '#38bdf8',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1rem',
          }}>
            <Smartphone size={28} />
          </div>
          <h4 style={{ color: '#ffffff', fontSize: '1rem', fontWeight: 700, margin: '0 0 0.4rem 0' }}>
            لا توجد طلبيات مطابقة حالياً
          </h4>
          <p style={{ fontSize: '0.85rem', maxWidth: '420px', margin: '0 auto', lineHeight: '1.6' }}>
            عندما يقوم الزبائن بالضغط على منتجات المتجر في تيليغرام أو إرسال وصولات وإثباتات الدفع، ستظهر هنا فوراً للمراجعة والتسليم.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {filteredOrders.map(order => {
            const status = order.deliveryStatus || order.status || 'pending';
            const isPending = status === 'pending' || status === 'pending_verification' || status === 'accepted' || status === 'new';
            const isDelivered = status === 'delivered' || status === 'confirmed';
            const isCancelled = status === 'cancelled' || status === 'rejected';

            const receiptImg = order.receiptUrl || (typeof order.notes === 'string' && order.notes.includes('http') ? order.notes.match(/https?:\/\/[^\s]+/)?.[0] : null);

            return (
              <div
                key={order.id}
                style={{
                  background: isPending
                    ? 'rgba(15, 23, 42, 0.85)'
                    : 'rgba(15, 23, 42, 0.55)',
                  border: isPending
                    ? '1px solid rgba(245, 158, 11, 0.3)'
                    : isDelivered
                    ? '1px solid rgba(16, 185, 129, 0.25)'
                    : '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '16px',
                  padding: '1.25rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem',
                  boxShadow: isPending ? '0 8px 24px rgba(245, 158, 11, 0.08)' : 'none',
                  transition: 'all 0.2s',
                }}
              >
                {/* Header Row */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: '38px',
                      height: '38px',
                      borderRadius: '50%',
                      background: 'rgba(14, 165, 233, 0.15)',
                      border: '1px solid rgba(56, 189, 248, 0.3)',
                      color: '#38bdf8',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 800,
                      fontSize: '0.95rem',
                    }}>
                      {(order.customerName || 'ز').charAt(0)}
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: 800, fontSize: '0.95rem', color: '#ffffff' }}>
                          {order.customerName || 'زبون تيليغرام'}
                        </span>
                        {order.phone && (
                          <span style={{ fontSize: '0.78rem', color: '#38bdf8', fontFamily: 'monospace' }}>
                            {order.phone}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'rgba(255, 255, 255, 0.45)', marginTop: '2px' }}>
                        {order.createdAt ? new Date(order.createdAt).toLocaleString('ar-DZ') : 'قبل قليل'}
                      </div>
                    </div>
                  </div>

                  {/* Tracking Code & Status Badge */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {order.trackingCode && (
                      <button
                        onClick={() => copyToClipboard(order.trackingCode, order.id)}
                        style={{
                          background: 'rgba(0, 0, 0, 0.35)',
                          border: '1px solid rgba(255, 255, 255, 0.12)',
                          borderRadius: '8px',
                          padding: '4px 10px',
                          color: '#e2e8f0',
                          fontSize: '0.78rem',
                          fontFamily: 'monospace',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                        title="انقر لنسخ كود الطلب"
                      >
                        <span>#{order.trackingCode}</span>
                        {copiedCode === order.id ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                      </button>
                    )}

                    {isPending && (
                      <span style={{
                        background: 'rgba(245, 158, 11, 0.15)',
                        border: '1px solid rgba(245, 158, 11, 0.35)',
                        color: '#fbbf24',
                        padding: '4px 10px',
                        borderRadius: '20px',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                      }}>
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#fbbf24' }} />
                        بانتظار التحقق والتسليم
                      </span>
                    )}

                    {isDelivered && (
                      <span style={{
                        background: 'rgba(16, 185, 129, 0.15)',
                        border: '1px solid rgba(16, 185, 129, 0.35)',
                        color: '#34d399',
                        padding: '4px 10px',
                        borderRadius: '20px',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                      }}>
                        <CheckCircle2 size={13} />
                        تم الاعتماد والتسليم
                      </span>
                    )}

                    {isCancelled && (
                      <span style={{
                        background: 'rgba(239, 68, 68, 0.15)',
                        border: '1px solid rgba(239, 68, 68, 0.35)',
                        color: '#f87171',
                        padding: '4px 10px',
                        borderRadius: '20px',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                      }}>
                        <XCircle size={13} />
                        مرفوض / ملغي
                      </span>
                    )}
                  </div>
                </div>

                {/* Product & Price Details */}
                <div style={{
                  background: 'rgba(0, 0, 0, 0.25)',
                  borderRadius: '10px',
                  padding: '0.75rem 1rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '10px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.5)' }}>المنتج المطلوب:</span>
                    <strong style={{ color: '#ffffff', fontSize: '0.92rem' }}>{order.product || 'طلب متجر رقمي'}</strong>
                  </div>

                  {order.price && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.5)' }}>المبلغ:</span>
                      <strong style={{ color: '#38bdf8', fontSize: '1rem', fontWeight: 800 }}>
                        {order.price} {bot?.currency || 'دج'}
                      </strong>
                    </div>
                  )}
                </div>

                {/* ─── Payment Proof Area (صورة الوصل / المعرف) ─── */}
                {receiptImg ? (
                  <div style={{
                    background: 'rgba(14, 165, 233, 0.08)',
                    border: '1px solid rgba(56, 189, 248, 0.25)',
                    borderRadius: '12px',
                    padding: '0.85rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '12px',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div
                        onClick={() => setViewingReceiptUrl(receiptImg)}
                        style={{
                          width: '64px',
                          height: '64px',
                          borderRadius: '8px',
                          overflow: 'hidden',
                          border: '1px solid rgba(56, 189, 248, 0.4)',
                          cursor: 'pointer',
                          flexShrink: 0,
                          position: 'relative',
                        }}
                        title="انقر لتكبير الوصل"
                      >
                        <img
                          src={receiptImg}
                          alt="وصل الدفع"
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                        <div style={{
                          position: 'absolute',
                          inset: 0,
                          background: 'rgba(0,0,0,0.3)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#ffffff',
                        }}>
                          <Eye size={16} />
                        </div>
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <ImageIcon size={15} />
                          <span>إثبات الدفع (صورة وصل التحويل)</span>
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.65)', marginTop: '2px' }}>
                          أرسل الزبون صورة الإيصال للتحقق من العملية
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => setViewingReceiptUrl(receiptImg)}
                      style={{
                        background: 'rgba(56, 189, 248, 0.2)',
                        border: '1px solid rgba(56, 189, 248, 0.4)',
                        color: '#38bdf8',
                        borderRadius: '8px',
                        padding: '0.45rem 0.9rem',
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <Eye size={14} />
                      معاينة الوصل بالكامل ↗
                    </button>
                  </div>
                ) : (
                  <div style={{
                    fontSize: '0.8rem',
                    color: 'rgba(255, 255, 255, 0.55)',
                    background: 'rgba(0, 0, 0, 0.15)',
                    padding: '0.6rem 0.85rem',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}>
                    <AlertCircle size={14} color="#f59e0b" />
                    <span>{order.notes || 'بانتظار إرسال صورة وصل التحويل من طرف الزبون'}</span>
                  </div>
                )}

                {/* Delivered Credentials Box (if already delivered) */}
                {isDelivered && order.deliveredCredentials && (
                  <div style={{
                    background: 'rgba(16, 185, 129, 0.1)',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    borderRadius: '10px',
                    padding: '0.75rem 1rem',
                  }}>
                    <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#34d399', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <CheckCircle2 size={14} />
                      بيانات الحساب / الكود المسلّم للزبون:
                    </div>
                    <pre style={{
                      margin: 0,
                      background: 'rgba(0, 0, 0, 0.3)',
                      padding: '8px 10px',
                      borderRadius: '6px',
                      fontSize: '0.8rem',
                      color: '#e2e8f0',
                      fontFamily: 'monospace',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-all',
                    }}>
                      {order.deliveredCredentials}
                    </pre>
                  </div>
                )}

                {/* Rejection Note (if cancelled) */}
                {isCancelled && order.rejectionReason && (
                  <div style={{
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    borderRadius: '10px',
                    padding: '0.65rem 0.85rem',
                    color: '#f87171',
                    fontSize: '0.8rem',
                  }}>
                    <strong>سبب الرفض: </strong> {order.rejectionReason}
                  </div>
                )}

                {/* Action Buttons Row */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                  paddingTop: '0.85rem',
                  flexWrap: 'wrap',
                  gap: '8px',
                }}>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={() => onOpenChat(order.customerId)}
                      style={{
                        background: 'rgba(255, 255, 255, 0.08)',
                        border: '1px solid rgba(255, 255, 255, 0.12)',
                        color: '#e2e8f0',
                        borderRadius: '8px',
                        padding: '0.45rem 0.85rem',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <MessageSquare size={14} />
                      فتح المحادثة
                    </button>
                  </div>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    {isPending && (
                      <>
                        <button
                          onClick={() => setRejectingOrder(order)}
                          style={{
                            background: 'rgba(239, 68, 68, 0.15)',
                            border: '1px solid rgba(239, 68, 68, 0.35)',
                            color: '#f87171',
                            borderRadius: '8px',
                            padding: '0.5rem 1rem',
                            fontSize: '0.82rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                          }}
                        >
                          <XCircle size={15} />
                          رفض الوصل
                        </button>

                        <button
                          onClick={() => {
                            setDeliveringOrder(order);
                            setCredentialsText('');
                          }}
                          style={{
                            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                            border: 'none',
                            color: '#ffffff',
                            borderRadius: '8px',
                            padding: '0.5rem 1.25rem',
                            fontSize: '0.85rem',
                            fontWeight: 800,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            boxShadow: '0 4px 12px rgba(16, 185, 129, 0.35)',
                          }}
                        >
                          <CheckCircle2 size={16} />
                          اعتماد وتسليم الطلب
                        </button>
                      </>
                    )}

                    {isDelivered && (
                      <button
                        onClick={() => {
                          setDeliveringOrder(order);
                          setCredentialsText(order.deliveredCredentials || '');
                        }}
                        style={{
                          background: 'rgba(56, 189, 248, 0.12)',
                          border: '1px solid rgba(56, 189, 248, 0.3)',
                          color: '#38bdf8',
                          borderRadius: '8px',
                          padding: '0.45rem 0.85rem',
                          fontSize: '0.8rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        <RotateCcw size={13} />
                        إعادة إرسال البيانات
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ─── Modal 1: Deliver Order Dialog ─── */}
      {deliveringOrder && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '1rem',
        }}>
          <div style={{
            background: '#0b1329',
            border: '1px solid rgba(16, 185, 129, 0.4)',
            borderRadius: '18px',
            width: '100%',
            maxWidth: '520px',
            padding: '1.75rem',
            boxShadow: '0 25px 50px rgba(0, 0, 0, 0.5)',
            direction: 'rtl',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle2 size={22} color="#34d399" />
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#ffffff' }}>
                  اعتماد وتسليم الطلب للزبون
                </h3>
              </div>
              <button
                onClick={() => setDeliveringOrder(null)}
                style={{ background: 'transparent', border: 'none', color: 'rgba(255, 255, 255, 0.5)', cursor: 'pointer', fontSize: '1.2rem' }}
              >
                ✕
              </button>
            </div>

            <div style={{
              background: 'rgba(0, 0, 0, 0.3)',
              borderRadius: '10px',
              padding: '0.75rem',
              marginBottom: '1rem',
              fontSize: '0.82rem',
              color: 'rgba(255, 255, 255, 0.7)',
            }}>
              <div>الزبون: <strong style={{ color: '#ffffff' }}>{deliveringOrder.customerName}</strong></div>
              <div>المنتج: <strong style={{ color: '#38bdf8' }}>{deliveringOrder.product}</strong></div>
              {deliveringOrder.trackingCode && <div>رقم الطلب: <strong style={{ color: '#ffffff' }}>#{deliveringOrder.trackingCode}</strong></div>}
            </div>

            <form onSubmit={handleConfirmDelivery}>
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.4rem', color: '#e2e8f0' }}>
                  بيانات الحساب، الكود، أو رابط الاستلام: *
                </label>
                <textarea
                  rows="4"
                  required
                  placeholder="مثال:&#10;البريد: customer@example.com&#10;كلمة المرور: Pass#2026&#10;أو كود التفعيل: XXXX-YYYY-ZZZZ"
                  value={credentialsText}
                  onChange={(e) => setCredentialsText(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.75rem 1rem',
                    background: 'rgba(15, 23, 42, 0.8)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '10px',
                    color: '#ffffff',
                    fontSize: '0.88rem',
                    fontFamily: 'monospace',
                    outline: 'none',
                    boxSizing: 'border-box',
                    resize: 'vertical',
                  }}
                />
                <span style={{ fontSize: '0.72rem', color: 'rgba(255, 255, 255, 0.5)', marginTop: '4px', display: 'block' }}>
                  سيتم إرسال هذه البيانات فوراً إلى محادثة الزبون على تيليغرام مع رسالة شكر وتأكيد رسمي.
                </span>
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setDeliveringOrder(null)}
                  style={{
                    background: 'rgba(255, 255, 255, 0.08)',
                    color: '#e2e8f0',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '0.6rem 1.2rem',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  إلغاء
                </button>

                <button
                  type="submit"
                  disabled={delivering}
                  style={{
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '0.6rem 1.5rem',
                    fontSize: '0.88rem',
                    fontWeight: 800,
                    cursor: delivering ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 4px 14px rgba(16, 185, 129, 0.4)',
                  }}
                >
                  {delivering ? 'جاري الإرسال...' : (
                    <>
                      <Send size={15} />
                      <span>إرسال للزبون وتأكيد التسليم</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Modal 2: Reject Order Dialog ─── */}
      {rejectingOrder && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '1rem',
        }}>
          <div style={{
            background: '#0b1329',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            borderRadius: '18px',
            width: '100%',
            maxWidth: '500px',
            padding: '1.75rem',
            boxShadow: '0 25px 50px rgba(0, 0, 0, 0.5)',
            direction: 'rtl',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <XCircle size={22} color="#f87171" />
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#ffffff' }}>
                  رفض الوصل / إلغاء الطلب
                </h3>
              </div>
              <button
                onClick={() => setRejectingOrder(null)}
                style={{ background: 'transparent', border: 'none', color: 'rgba(255, 255, 255, 0.5)', cursor: 'pointer', fontSize: '1.2rem' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleConfirmReject}>
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.4rem', color: '#e2e8f0' }}>
                  سبب الرفض (سيتم إرساله للزبون في تيليغرام):
                </label>
                <textarea
                  rows="3"
                  required
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.75rem 1rem',
                    background: 'rgba(15, 23, 42, 0.8)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '10px',
                    color: '#ffffff',
                    fontSize: '0.88rem',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setRejectingOrder(null)}
                  style={{
                    background: 'rgba(255, 255, 255, 0.08)',
                    color: '#e2e8f0',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '0.6rem 1.2rem',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  تراجع
                </button>

                <button
                  type="submit"
                  disabled={rejecting}
                  style={{
                    background: 'rgba(239, 68, 68, 0.9)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '0.6rem 1.4rem',
                    fontSize: '0.88rem',
                    fontWeight: 800,
                    cursor: rejecting ? 'not-allowed' : 'pointer',
                  }}
                >
                  {rejecting ? 'جاري الرفض...' : 'تأكيد الرفض وإبلاغ الزبون'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Modal 3: Receipt Lightbox ─── */}
      {viewingReceiptUrl && (
        <div
          onClick={() => setViewingReceiptUrl(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.88)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '1.5rem',
            cursor: 'zoom-out',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'relative',
              maxWidth: '90vw',
              maxHeight: '90vh',
              borderRadius: '16px',
              overflow: 'hidden',
              boxShadow: '0 25px 60px rgba(0, 0, 0, 0.8)',
              background: '#0b1329',
              border: '1px solid rgba(56, 189, 248, 0.4)',
            }}
          >
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.75rem 1rem',
              background: 'rgba(15, 23, 42, 0.9)',
              borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            }}>
              <span style={{ color: '#38bdf8', fontWeight: 700, fontSize: '0.88rem' }}>
                معاينة وصل الدفع بالحجم الكامل
              </span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <a
                  href={viewingReceiptUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    background: 'rgba(56, 189, 248, 0.2)',
                    color: '#38bdf8',
                    textDecoration: 'none',
                    padding: '4px 10px',
                    borderRadius: '6px',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                  }}
                >
                  فتح الرابط الأصلي ↗
                </a>
                <button
                  onClick={() => setViewingReceiptUrl(null)}
                  style={{
                    background: 'rgba(255, 255, 255, 0.1)',
                    border: 'none',
                    color: '#ffffff',
                    borderRadius: '6px',
                    padding: '4px 10px',
                    cursor: 'pointer',
                  }}
                >
                  إغلاق ✕
                </button>
              </div>
            </div>

            <img
              src={viewingReceiptUrl}
              alt="صورة الوصل"
              style={{
                maxWidth: '85vw',
                maxHeight: '80vh',
                objectFit: 'contain',
                display: 'block',
                margin: '0 auto',
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
