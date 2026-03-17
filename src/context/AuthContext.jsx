import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { 
  isAuthenticated, getSavedUser, saveUser, 
  getProfile, logout as nexLogout, refreshSession
} from '../services/nexcloud';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(getSavedUser());
  const [loading, setLoading] = useState(true);

  // Try to restore session on mount
  useEffect(() => {
    async function init() {
      if (isAuthenticated()) {
        try {
          const res = await getProfile();
          setUser(res.user);
          saveUser(res.user);
        } catch {
          // Token might be expired, try refresh
          try {
            await refreshSession();
            const res = await getProfile();
            setUser(res.user);
            saveUser(res.user);
          } catch {
            // Refresh failed, clear session
            await nexLogout();
            setUser(null);
          }
        }
      }
      setLoading(false);
    }
    init();
  }, []);

  const setAuthUser = useCallback((userData) => {
    setUser(userData);
    saveUser(userData);
  }, []);

  const handleLogout = useCallback(async () => {
    await nexLogout();
    setUser(null);
  }, []);

  const value = {
    user,
    loading,
    isAuthenticated: !!user && isAuthenticated(),
    setAuthUser,
    logout: handleLogout,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
