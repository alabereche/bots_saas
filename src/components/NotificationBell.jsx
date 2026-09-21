import { useState, useEffect, useRef, useLayoutEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../services/firebase';
import { collection, query, where, limit, onSnapshot, updateDoc, writeBatch, doc } from 'firebase/firestore';

function timeAgo(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'الآن';
  if (m < 60) return `قبل ${m} دقيقة`;
  const h = Math.floor(m / 60);
  if (h < 24) return `قبل ${h} ساعة`;
  const d = Math.floor(h / 24);
  return `قبل ${d} يوم`;
}

const BoxIcon = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>
  </svg>
);

const AlertIcon = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
  </svg>
);

// Merchant notification bell — realtime Firestore listener, unread badge,
// dropdown feed. Mobile renders inline under the top bar; desktop renders
// through a portal anchored to the button, so the floating card (overflow
// contexts) can never clip it.
export default function NotificationBell({ variant = 'desktop' }) {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null); // { top, right, width } for the desktop portal
  const wrapRef = useRef(null);
  const btnRef = useRef(null);
  const panelRef = useRef(null);
  const navigate = useNavigate();

  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return undefined;
    const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
    // Single where() equality keeps this index-free; sorted and pruned client-side
    const q = query(collection(db, 'notifications'), where('userId', '==', uid), limit(50));
    const unsub = onSnapshot(q, (snap) => {
      const now = Date.now();
      const freshList = [];
      const expiredDocs = [];

      snap.docs.forEach(d => {
        const data = d.data();
        const createdTime = data.createdIso
          ? new Date(data.createdIso).getTime()
          : (data.createdAt?.toMillis ? data.createdAt.toMillis() : 0);

        if (createdTime && (now - createdTime > TWENTY_FOUR_HOURS_MS)) {
          expiredDocs.push(d);
        } else {
          freshList.push({ id: d.id, ...data });
        }
      });

      freshList.sort((a, b) => (b.createdIso || '').localeCompare(a.createdIso || ''));
      setItems(freshList);

      // Auto-purge notifications older than 24 hours silently in the background
      if (expiredDocs.length > 0) {
        const batch = writeBatch(db);
        expiredDocs.forEach(d => batch.delete(doc(db, 'notifications', d.id)));
        batch.commit().catch(() => {});
      }
    }, () => {});
    return unsub;
  }, []);

  const updatePos = useCallback(() => {
    const btn = btnRef.current;
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    setPos({
      top: r.bottom + 8,
      right: Math.max(8, window.innerWidth - r.right),
      width: Math.min(340, window.innerWidth - 24),
    });
  }, []);

  useLayoutEffect(() => {
    if (!open || variant !== 'desktop') return undefined;
    updatePos();
    window.addEventListener('resize', updatePos);
    window.addEventListener('scroll', updatePos, true);
    return () => {
      window.removeEventListener('resize', updatePos);
      window.removeEventListener('scroll', updatePos, true);
    };
  }, [open, variant, updatePos]);

  useEffect(() => {
    if (!open) return undefined;
    const onDocClick = (e) => {
      if (
        wrapRef.current && !wrapRef.current.contains(e.target) &&
        (!panelRef.current || !panelRef.current.contains(e.target))
      ) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  const unread = items.filter(n => !n.read).length;

  const markAllRead = async () => {
    const unreadDocs = items.filter(n => !n.read);
    if (!unreadDocs.length) return;
    try {
      const batch = writeBatch(db);
      unreadDocs.forEach(n => batch.update(doc(db, 'notifications', n.id), { read: true }));
      await batch.commit();
    } catch { /* best effort */ }
  };

  const clearAllNotifications = async () => {
    if (!items.length || clearing) return;
    setClearing(true);
    try {
      const batch = writeBatch(db);
      items.forEach(n => batch.delete(doc(db, 'notifications', n.id)));
      await batch.commit();
      setItems([]);
    } catch (err) {
      console.error('Failed to clear notifications:', err);
    } finally {
      setClearing(false);
    }
  };

  const openItem = (n) => {
    if (!n.read) updateDoc(doc(db, 'notifications', n.id), { read: true }).catch(() => {});
    setOpen(false);
    if (n.botId) navigate(`/bot/${n.botId}`);
  };

  const panel = (
    <div
      className={`notif-panel${variant === 'desktop' ? ' notif-panel--floating' : ''}`}
      ref={panelRef}
      style={variant === 'desktop' && pos ? { top: pos.top, right: pos.right, width: pos.width, left: 'auto' } : undefined}
    >
      <div className="notif-panel-head">
        <span className="notif-panel-title">الإشعارات</span>
        {items.length > 0 && (
          <div className="notif-panel-actions">
            {unread > 0 && (
              <button type="button" className="notif-mark-read" onClick={markAllRead}>
                تحديد الكل كمقروء
              </button>
            )}
            <button
              type="button"
              className="notif-clear-all"
              onClick={clearAllNotifications}
              disabled={clearing}
              title="حذف جميع الإشعارات"
            >
              مسح الكل
            </button>
          </div>
        )}
      </div>

      <div className="notif-list">
        {items.length === 0 ? (
          <div className="notif-empty">
            لا إشعارات بعد — الطلبيات الجديدة والتنبيهات المهمة ستظهر هنا فوراً.
          </div>
        ) : items.map(n => (
          <button
            type="button"
            key={n.id}
            className={`notif-item${n.read ? '' : ' notif-item--unread'}`}
            onClick={() => openItem(n)}
          >
            <span className={`notif-item-icon notif-item-icon--${n.type === 'order' ? 'order' : 'system'}`}>
              {n.type === 'order' ? BoxIcon : AlertIcon}
            </span>
            <span className="notif-item-body">
              <span className="notif-item-title">{n.title}</span>
              {n.body && <span className="notif-item-desc">{n.body}</span>}
              <span className="notif-item-time">{timeAgo(n.createdIso)}</span>
            </span>
            {!n.read && <span className="notif-item-dot" />}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className={`notif-bell notif-bell--${variant}`} ref={wrapRef}>
      <button
        type="button"
        className="notif-bell-btn"
        ref={btnRef}
        onClick={() => setOpen(o => !o)}
        title="الإشعارات"
        aria-label="الإشعارات"
        aria-expanded={open}
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
        {variant === 'desktop' && <span className="notif-label">الإشعارات</span>}
        {unread > 0 && <span className="notif-badge">{unread > 9 ? '9+' : unread}</span>}
      </button>

      {open && (variant === 'desktop' ? createPortal(panel, document.body) : panel)}
    </div>
  );
}
