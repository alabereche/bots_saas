import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { auth } from '../services/firebase';

export default function AdminRoute({ children }) {
  const [state, setState] = useState({ checking: true, ok: false });
  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (user) => {
      if (!user) { setState({ checking: false, ok: false }); return; }
      try {
        const token = await user.getIdTokenResult();
        setState({ checking: false, ok: token.claims.admin === true });
      } catch { setState({ checking: false, ok: false }); }
    });
    return unsub;
  }, []);
  if (state.checking) return null;
  if (!state.ok) return <Navigate to="/dashboard" replace />;
  return children;
}
