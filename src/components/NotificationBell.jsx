import { useState, useEffect, useRef } from 'react';
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
// dropdown feed. Rendered in both the desktop sidebar and the mobile top bar.
export default function NotificationBell({ variant = 'desktop' }) {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return undefined;
    // Single where() equality keeps this index-free; sorted client-side
    const q = query(collection(db, 'notifications'), where('userId', '==', uid), limit(25));
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => (b.createdIso || '').localeCompare(a.createdIso || ''));
      setItems(list);
    }, () => {});
    return unsub;
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const onDocClick = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
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

  const openItem = (n) => {
    if (!n.read) updateDoc(doc(db, 'notifications', n.id), { read: true }).catch(() => {});
    setOpen(false);
    if (n.botId) navigate(`/bot/${n.botId}`);
  };

  return (
    <div className={`notif-bell notif-bell--${variant}`} ref={wrapRef}>
      <button
        type="button"
        className="notif-bell-btn"
        onClick={() => setOpen(o => !o)}
        title="الإشعارات"
        aria-label="الإشعارات"
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
        {unread > 0 && <span className="notif-badge">{unread > 9 ? '9+' : unread}</span>}
      </button>

      {open && (
        <div className="notif-panel">
          <div className="notif-panel-head">
            <span className="notif-panel-title">الإشعارات</span>
            {unread > 0 && (
              <button type="button" className="notif-mark-read" onClick={markAllRead}>
                تحديد الكل كمقروء
              </button>
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
      )}
    </div>
  );
}
