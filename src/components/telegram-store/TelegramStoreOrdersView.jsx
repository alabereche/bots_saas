import React, { useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  Clock,
  Send,
  ExternalLink,
  Copy,
  Check,
  MessageSquare,
  Image as ImageIcon,
  RotateCcw,
  Eye,
} from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { auth } from '../../services/firebase';

const TELEGRAM_ENGINE_URL = import.meta.env.VITE_ENGINE_URL || 'https://tg.nosfir.online';

function formatTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now - d;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'الآن';
  if (diffMin < 60) return `${diffMin} د`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH} س`;
  return d.toLocaleDateString('ar-DZ');
}

export default function TelegramStoreOrdersView({
  orders = [],
  bot,
  onUpdateDelivery,
  onOpenChat,
  onClearOrders,
}) {
  const toast = useToast();

  const [filter, setFilter] = useState('all'); // 'all' | 'accepted' | 'delivered' | 'cancelled'
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

  // Normalize order status
  const getNormalizedStatus = (order) => {
    const s = order.deliveryStatus || order.status || 'pending';
    if (s === 'delivered' || s === 'confirmed') return 'delivered';
    if (s === 'cancelled' || s === 'rejected') return 'cancelled';
    return 'accepted'; // pending / new / accepted
  };

  // Counts
  const counts = { all: orders.length, accepted: 0, delivered: 0, cancelled: 0 };
  orders.forEach(o => {
    const st = getNormalizedStatus(o);
    if (counts[st] !== undefined) counts[st]++;
  });

  // Filter & Search logic
  const filteredOrders = orders.filter(order => {
    const st = getNormalizedStatus(order);
    if (filter !== 'all' && st !== filter) return false;

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
        console.warn('[Telegram Store] Reply API returned non-200, updating Firestore order anyway');
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
    if (!rejectingOrder) return;

    setRejecting(true);
    try {
      const rejectMessage =
        `⚠️ *إشعار بخصوص طلبك (${rejectingOrder.product || 'طلب متجر رقمي'})*\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `نعتذر، لم نتمكن من اعتماد الطلب للأسباب التالية:\n` +
        `*${rejectReason.trim()}*\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `يرجى التواصل معنا أو إعادة إرسال الوصل الصحيح لإتمام طلبك في أقرب وقت. شكراً لتفهمك!`;

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
      });

      await onUpdateDelivery(rejectingOrder.id, {
        deliveryStatus: 'cancelled',
        orderStatus: 'cancelled',
        rejectionReason: rejectReason.trim(),
        rejectedAt: new Date().toISOString(),
        note: `تم الرفض: ${rejectReason.trim()}`,
      });

      toast.success('تم رفض الطلب وإشعار الزبون في تيليغرام');
      setRejectingOrder(null);
    } catch (err) {
      toast.error('فشل رفض الطلب: ' + err.message);
    } finally {
      setRejecting(false);
    }
  };

  return (
    <div className="card">
      {/* ─── Header Row ─── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.1rem', flexWrap: 'wrap', gap: '8px' }}>
        <div>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            الطلبيات والإثباتات ({orders.length})
          </h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>
            مراجعة وصولات الدفع وتأكيد تسليم البيانات والأكواد للمشتركين فوراً.
          </p>
        </div>
        {orders.length > 0 && onClearOrders && (
          <button
            className="btn btn-danger btn-sm"
            onClick={onClearOrders}
          >
            مسح كل السجلات
          </button>
        )}
      </div>

      {orders.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-tertiary)' }}>
          <div style={{
            width: '52px',
            height: '52px',
            borderRadius: '50%',
            background: 'var(--veil-1)',
            border: '1px solid var(--border-subtle)',
            color: 'var(--color-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 0.85rem'
          }}>
            <Clock size={24} />
          </div>
          <p style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
            لا توجد طلبيات مسجلة بعد
          </p>
          <p style={{ fontSize: '0.85rem', maxWidth: '420px', margin: '0 auto' }}>
            عندما يقوم الزبائن بالطلب من متجر تيليغرام وإرسال وصولات وإثباتات الدفع، ستظهر هنا فوراً للمراجعة والتسليم.
          </p>
        </div>
      ) : (
        <>
          {/* ─── Orders Toolbar (Matches System 1 Design 100%) ─── */}
          <div className="orders-toolbar">
            <div className="ochips" role="tablist" aria-label="فلترة الطلبيات بالحالة">
              <button
                type="button"
                className={`ochip${filter === 'all' ? ' is-on' : ''}`}
                onClick={() => setFilter('all')}
              >
                الكل
                <span className="ocount">{counts.all}</span>
              </button>

              <button
                type="button"
                className={`ochip${filter === 'accepted' ? ' is-on' : ''}`}
                data-k="accepted"
                onClick={() => setFilter('accepted')}
              >
                <span className="odot" />
                بانتظار المراجعة
                <span className="ocount">{counts.accepted}</span>
              </button>

              <button
                type="button"
                className={`ochip${filter === 'delivered' ? ' is-on' : ''}`}
                data-k="delivered"
                onClick={() => setFilter('delivered')}
              >
                <span className="odot" />
                تم التسليم
                <span className="ocount">{counts.delivered}</span>
              </button>

              <button
                type="button"
                className={`ochip${filter === 'cancelled' ? ' is-on' : ''}`}
                data-k="cancelled"
                onClick={() => setFilter('cancelled')}
              >
                <span className="odot" />
                مرفوضة
                <span className="ocount">{counts.cancelled}</span>
              </button>
            </div>

            <div className="osearch">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                placeholder="ابحث بالاسم، الهاتف، كود التتبع أو المنتج…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                aria-label="بحث في الطلبيات"
              />
            </div>
          </div>

          {/* ─── Orders List using .ocard native design ─── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {filteredOrders.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '1.5rem 1rem', color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>
                لا توجد طلبيات مطابقة لهذا الفلتر أو البحث.
              </div>
            ) : (
              filteredOrders.map(order => {
                const statusKey = getNormalizedStatus(order);
                const isPending = statusKey === 'accepted';
                const isDelivered = statusKey === 'delivered';
                const isCancelled = statusKey === 'cancelled';
                const initial = (order.customerName || 'ز').charAt(0);
                const receiptImg = order.receiptUrl || (typeof order.notes === 'string' && order.notes.includes('http') ? order.notes.match(/https?:\/\/[^\s]+/)?.[0] : null);

                return (
                  <div key={order.id} className="ocard" data-status={statusKey}>
                    {/* Head */}
                    <div className="ocard-head">
                      <div className="ocard-id">
                        <span className="ocard-avatar">{initial}</span>
                        <div>
                          <strong>{order.customerName || 'زبون تيليغرام'}</strong>
                          {order.phone && <span className="ocard-phone" dir="ltr">{order.phone}</span>}
                        </div>
                      </div>

                      <div className="ocard-meta">
                        {order.trackingCode && (
                          <button
                            className="tracking-code-pill"
                            onClick={() => copyToClipboard(order.trackingCode, order.id)}
                            title="انقر لنسخ كود الطلب"
                          >
                            <span>#{order.trackingCode}</span>
                            {copiedCode === order.id ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                          </button>
                        )}
                        <span className="otime">{formatTime(order.createdAt)}</span>
                      </div>
                    </div>

                    {/* Line */}
                    <div className="ocard-line">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                        <span className="oproduct">
                          {order.product || 'طلب متجر رقمي'}
                          {order.price ? <span className="oprice"> · {order.price} {bot?.currency || 'دج'}</span> : null}
                        </span>

                        {isPending && (
                          <span style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--st-accepted)', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                            <Clock size={13} />
                            بانتظار مراجعة الوصل والتسليم
                          </span>
                        )}
                        {isDelivered && (
                          <span style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--st-delivered)', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                            <CheckCircle2 size={13} />
                            تم الاعتماد والتسليم
                          </span>
                        )}
                        {isCancelled && (
                          <span style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--st-cancelled)', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                            <XCircle size={13} />
                            مرفوض / ملغي
                          </span>
                        )}
                      </div>

                      {/* Receipt Preview Row */}
                      {receiptImg && (
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '8px',
                          padding: '0.45rem 0.75rem',
                          borderRadius: '10px',
                          background: 'var(--veil-1)',
                          border: '1px solid var(--border-subtle)',
                          marginTop: '0.35rem',
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                            <ImageIcon size={15} color="var(--color-primary)" />
                            <span>وصل التحويل / إثبات الدفع متوفر</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              style={{ padding: '0.25rem 0.65rem', fontSize: '0.75rem', height: 'auto', gap: '4px' }}
                              onClick={() => setViewingReceiptUrl(receiptImg)}
                            >
                              <Eye size={13} />
                              <span>عرض الوصل</span>
                            </button>
                            <a
                              href={receiptImg}
                              target="_blank"
                              rel="noreferrer"
                              className="btn btn-secondary btn-sm"
                              style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', height: 'auto' }}
                              title="فتح الرابط الأصلي"
                            >
                              <ExternalLink size={12} />
                            </a>
                          </div>
                        </div>
                      )}

                      {/* Notes (if text) */}
                      {order.notes && !order.notes.startsWith('http') && (
                        <span className="osummary">
                          {order.notes}
                        </span>
                      )}

                      {/* Delivered credentials info if delivered */}
                      {isDelivered && order.deliveredCredentials && (
                        <div style={{
                          marginTop: '0.35rem',
                          padding: '0.5rem 0.75rem',
                          borderRadius: '10px',
                          background: 'var(--veil-1)',
                          border: '1px solid var(--border-subtle)',
                          fontSize: '0.78rem',
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                            <span style={{ color: 'var(--text-secondary)', fontWeight: 700 }}>بيانات الحساب / الكود المسلّم:</span>
                            <button
                              type="button"
                              onClick={() => copyToClipboard(order.deliveredCredentials, 'creds-' + order.id)}
                              className="tracking-code-pill"
                              style={{ padding: '2px 8px', fontSize: '0.72rem' }}
                            >
                              {copiedCode === 'creds-' + order.id ? <Check size={11} /> : <Copy size={11} />}
                              <span>{copiedCode === 'creds-' + order.id ? 'تم النسخ' : 'نسخ'}</span>
                            </button>
                          </div>
                          <code style={{ color: 'var(--color-primary-light)', fontFamily: 'monospace', display: 'block', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                            {order.deliveredCredentials}
                          </code>
                        </div>
                      )}

                      {/* Rejection Note */}
                      {isCancelled && order.rejectionReason && (
                        <div style={{
                          marginTop: '0.35rem',
                          padding: '0.45rem 0.75rem',
                          borderRadius: '8px',
                          background: 'var(--st-cancelled-soft)',
                          border: '1px solid rgba(248, 113, 113, 0.3)',
                          color: 'var(--st-cancelled)',
                          fontSize: '0.78rem',
                        }}>
                          <strong>سبب الرفض: </strong>{order.rejectionReason}
                        </div>
                      )}
                    </div>

                    {/* Bottom Actions Row */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', paddingTop: '0.4rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        {isPending && (
                          <>
                            <button
                              type="button"
                              className="btn btn-primary btn-sm"
                              onClick={() => { setDeliveringOrder(order); setCredentialsText(''); }}
                              style={{ gap: '6px' }}
                            >
                              <CheckCircle2 size={14} />
                              <span>اعتماد وتسليم الطلب</span>
                            </button>
                            <button
                              type="button"
                              className="btn btn-danger btn-sm"
                              onClick={() => {
                                setRejectingOrder(order);
                                setRejectReason('الوصل غير واضح أو المبلغ المحول غير مطابق، يرجى إعادة إرسال الوصل الصحيح.');
                              }}
                              style={{ gap: '6px' }}
                            >
                              <XCircle size={14} />
                              <span>رفض الوصل</span>
                            </button>
                          </>
                        )}
                        {isDelivered && (
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => {
                              setDeliveringOrder(order);
                              setCredentialsText(order.deliveredCredentials || '');
                            }}
                            style={{ gap: '6px' }}
                          >
                            <RotateCcw size={13} />
                            <span>تعديل أو إعادة إرسال البيانات</span>
                          </button>
                        )}
                      </div>

                      {onOpenChat && order.customerId && (
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => onOpenChat(order.customerId)}
                          style={{ gap: '6px' }}
                        >
                          <MessageSquare size={13} />
                          <span>فتح المحادثة</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}

      {/* ─── Modal 1: Deliver Order Dialog (Unified Modal Design) ─── */}
      {deliveringOrder && (
        <div className="modal-overlay" onClick={() => !delivering && setDeliveringOrder(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '520px' }}>
            <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckCircle2 size={20} color="var(--st-delivered)" />
              <span>اعتماد وتسليم الطلب للزبون</span>
            </h3>

            <div style={{
              background: 'var(--veil-1)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '10px',
              padding: '0.75rem',
              marginBottom: '1rem',
              fontSize: '0.82rem',
              color: 'var(--text-secondary)',
            }}>
              <div>الزبون: <strong style={{ color: 'var(--text-primary)' }}>{deliveringOrder.customerName || 'زبون تيليغرام'}</strong></div>
              <div>المنتج: <strong style={{ color: 'var(--color-primary)' }}>{deliveringOrder.product}</strong></div>
              {deliveringOrder.trackingCode && <div>رقم الطلب: <strong style={{ color: 'var(--text-primary)' }}>#{deliveringOrder.trackingCode}</strong></div>}
            </div>

            <form onSubmit={handleConfirmDelivery}>
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label">
                  بيانات الحساب، الكود، أو رابط الاستلام: *
                </label>
                <textarea
                  className="form-input"
                  rows="4"
                  required
                  placeholder="مثال:&#10;البريد: customer@example.com&#10;كلمة المرور: Pass#2026&#10;أو كود التفعيل: XXXX-YYYY-ZZZZ"
                  value={credentialsText}
                  onChange={(e) => setCredentialsText(e.target.value)}
                  style={{
                    fontFamily: 'monospace',
                    resize: 'vertical',
                    minHeight: '90px',
                  }}
                />
                <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', marginTop: '4px', display: 'block' }}>
                  سيتم إرسال هذه البيانات فوراً إلى محادثة الزبون على تيليغرام مع رسالة شكر وتأكيد رسمي.
                </span>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setDeliveringOrder(null)}
                  disabled={delivering}
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={delivering}
                  style={{ gap: '6px' }}
                >
                  {delivering ? (
                    'جاري الإرسال…'
                  ) : (
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

      {/* ─── Modal 2: Reject Order Dialog (Unified Modal Design) ─── */}
      {rejectingOrder && (
        <div className="modal-overlay" onClick={() => !rejecting && setRejectingOrder(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--st-cancelled)' }}>
              <XCircle size={20} color="var(--st-cancelled)" />
              <span>رفض الوصل / إلغاء الطلب</span>
            </h3>

            <form onSubmit={handleConfirmReject}>
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label">
                  سبب الرفض (سيتم إرساله للزبون في تيليغرام):
                </label>
                <textarea
                  className="form-input"
                  rows="3"
                  required
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  style={{ resize: 'vertical' }}
                />
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setRejectingOrder(null)}
                  disabled={rejecting}
                >
                  تراجع
                </button>
                <button
                  type="submit"
                  className="btn btn-danger"
                  disabled={rejecting}
                >
                  {rejecting ? 'جاري الرفض…' : 'تأكيد الرفض وإبلاغ الزبون'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Modal 3: Receipt Lightbox (Unified Modal Overlay) ─── */}
      {viewingReceiptUrl && (
        <div className="modal-overlay" onClick={() => setViewingReceiptUrl(null)} style={{ backdropFilter: 'blur(8px)', zIndex: 10000 }}>
          <div
            className="modal"
            onClick={e => e.stopPropagation()}
            style={{
              maxWidth: '90vw',
              maxHeight: '92vh',
              padding: '1rem',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                معاينة وصل التحويل / إثبات الدفع
              </h4>
              <div style={{ display: 'flex', gap: '8px' }}>
                <a
                  href={viewingReceiptUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-secondary btn-sm"
                  style={{ gap: '4px' }}
                >
                  <ExternalLink size={12} />
                  <span>فتح الرابط</span>
                </a>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setViewingReceiptUrl(null)}
                >
                  إغلاق ✕
                </button>
              </div>
            </div>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'var(--bg-inset)',
              borderRadius: '12px',
              padding: '0.5rem',
              overflow: 'auto',
              maxHeight: '78vh',
            }}>
              <img
                src={viewingReceiptUrl}
                alt="وصل الدفع"
                style={{
                  maxWidth: '100%',
                  maxHeight: '75vh',
                  objectFit: 'contain',
                  borderRadius: '8px',
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
