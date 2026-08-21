import { useEffect } from 'react';

export default function MetaCallback() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');
    const error = params.get('error') || params.get('error_description');

    if (window.opener) {
      if (code) {
        window.opener.postMessage({ type: 'META_AUTH_CODE', code, state }, window.location.origin);
      } else if (error) {
        window.opener.postMessage({ type: 'META_AUTH_ERROR', error }, window.location.origin);
      }
    }
  }, []);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      background: '#060913',
      color: '#fff',
      fontFamily: 'sans-serif',
      textAlign: 'center',
      padding: '2rem'
    }}>
      <div style={{
        width: '40px',
        height: '40px',
        border: '3px solid rgba(16, 185, 129, 0.2)',
        borderTopColor: '#10b981',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite',
        marginBottom: '1rem'
      }} />
      <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#10b981' }}>جاري إكمال الربط مع فيسبوك...</h3>
      <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginTop: '0.5rem' }}>يمكنك إغلاق هذه النافذة إذا لم تُغلق تلقائياً.</p>
    </div>
  );
}
