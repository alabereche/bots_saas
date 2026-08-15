import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  auth,
  loginWithGoogle,
  loginWithEmail,
  registerWithEmail,
  logoutUser,
  getUserProfile,
  updateUserProfile,
} from '../services/firebase';
import { onAuthStateChanged } from 'firebase/auth';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // Sync auth state with Firebase
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        try {
          const profile = await getUserProfile(firebaseUser.uid);
          setUserProfile(profile);
        } catch (err) {
          console.error('Error fetching user profile:', err);
        }
      } else {
        setUser(null);
        setUserProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const refreshProfile = useCallback(async () => {
    if (auth.currentUser) {
      const profile = await getUserProfile(auth.currentUser.uid);
      setUserProfile(profile);
      return profile;
    }
    return null;
  }, []);

  const updateProfileData = useCallback(async (data) => {
    if (auth.currentUser) {
      await updateUserProfile(auth.currentUser.uid, data);
      await refreshProfile();
    }
  }, [refreshProfile]);

  const handleLogout = useCallback(async () => {
    await logoutUser();
    setUser(null);
    setUserProfile(null);
  }, []);

  const value = {
    user,
    userProfile,
    loading,
    isAuthenticated: !!user,
    loginWithGoogle,
    loginWithEmail,
    registerWithEmail,
    updateProfileData,
    refreshProfile,
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
