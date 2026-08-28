import { createContext, useContext, useState, useCallback, useMemo, useRef } from 'react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  // Guards the whole app against toast floods: effects that list `toast`
  // in their deps (e.g. realtime subscriptions) can fire the same error
  // message in a tight loop — identical messages within 2.5s are dropped.
  const lastToastRef = useRef({ message: '', type: '', at: 0 });

  const addToast = useCallback((message, type = 'info', duration = 4000) => {
    const now = Date.now();
    const last = lastToastRef.current;
    if (last.message === message && last.type === type && now - last.at < 2500) {
      return;
    }
    lastToastRef.current = { message, type, at: now };
    const id = now + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, duration);
  }, []);

  const success = useCallback((msg) => addToast(msg, 'success'), [addToast]);
  const error = useCallback((msg) => addToast(msg, 'error'), [addToast]);
  const warning = useCallback((msg) => addToast(msg, 'warning'), [addToast]);
  const info = useCallback((msg) => addToast(msg, 'info'), [addToast]);

  // Stable identity across renders — a new object here would re-trigger
  // every effect in the app that depends on `toast` (the flood bug class)
  const value = useMemo(() => ({ success, error, warning, info }), [success, error, warning, info]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-container" style={{ position: 'fixed', bottom: '24px', left: '24px', zIndex: 99999, display: 'flex', flexDirection: 'column', gap: '8px', maxWidth: '400px', pointerEvents: 'none' }}>
        {toasts.map(t => (
          <div
            key={t.id}
            className={`toast toast-${t.type}`}
            style={{
              pointerEvents: 'auto',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '12px 18px',
              borderRadius: '12px',
              fontSize: '0.9rem',
              fontWeight: 600,
              color: '#ffffff',
              boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
              backdropFilter: 'blur(12px)',
              animation: 'fadeIn 0.25s ease-out forwards',
              background: 
                t.type === 'success' ? 'rgba(16, 185, 129, 0.95)' :
                t.type === 'error' ? 'rgba(239, 68, 68, 0.95)' :
                t.type === 'warning' ? 'rgba(245, 158, 11, 0.95)' : 'rgba(30, 41, 59, 0.95)',
              border: 
                t.type === 'success' ? '1px solid #10b981' :
                t.type === 'error' ? '1px solid #ef4444' :
                t.type === 'warning' ? '1px solid #f59e0b' : '1px solid #334155'
            }}
          >
            {t.type === 'success' && (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            )}
            {t.type === 'error' && (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
            )}
            {t.type === 'warning' && (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            )}
            {t.type === 'info' && (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
            )}
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
