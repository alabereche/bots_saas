import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import ProtectedRoute from './components/ProtectedRoute';
import Sidebar from './components/Sidebar';
import AmbientBackground from './components/AmbientBackground';
import BotLoader from './components/BotLoader';
import NotificationBell from './components/NotificationBell';

// Lazy-loaded routes for optimal bundle code-splitting
const Landing = lazy(() => import('./pages/Landing'));
const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const CreateBot = lazy(() => import('./pages/CreateBot'));
const BotDetail = lazy(() => import('./pages/BotDetail'));
const Billing = lazy(() => import('./pages/Billing'));
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'));
const TermsOfService = lazy(() => import('./pages/TermsOfService'));

function PageLoader() {
  return <BotLoader />;
}

function AppLayout() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <BotLoader fullscreen />;
  }

  return (
    <div style={{ position: 'relative', zIndex: 5, minHeight: '100vh' }}>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Public Landing Page & Legal */}
          <Route path="/" element={<Landing />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/terms" element={<TermsOfService />} />

          {/* Public Auth Routes */}
          <Route 
            path="/login" 
            element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Login />} 
          />
          <Route path="/register" element={<Navigate to="/login" replace />} />
          <Route path="/forgot-password" element={<Navigate to="/login" replace />} />

          {/* Protected App Routes */}
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <div className="app-layout">
                  <AmbientBackground />
                  <Sidebar />
                  <main className="app-main">
                    {/* Desktop bell — pinned to the content header's far corner */}
                    <div className="desktop-topbar">
                      <NotificationBell variant="desktop" />
                    </div>
                    <Suspense fallback={<PageLoader />}>
                      <Routes>
                        <Route path="/dashboard" element={<Dashboard />} />
                        <Route path="/create-bot" element={<CreateBot />} />
                        <Route path="/bot/:id" element={<BotDetail />} />
                        <Route path="/billing" element={<Billing />} />
                        <Route path="*" element={<Navigate to="/dashboard" replace />} />
                      </Routes>
                    </Suspense>
                  </main>
                </div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </Suspense>
    </div>
  );
}

export default function App() {
  // Fade out the pre-JS boot loader from index.html — runs only after
  // React has committed its first paint, so there is never a blank flash.
  // The splash is also held for a minimum duration so the entrance
  // sequence (bubble draw → typing dots → wordmark) is actually seen
  // even when the bundle parses instantly from cache.
  useEffect(() => {
    const boot = document.getElementById('boot-loader');
    if (!boot) return undefined;
    const MIN_SPLASH_MS = 2600;
    const wait = Math.max(0, MIN_SPLASH_MS - performance.now());
    let fadeTimer;
    const holdTimer = setTimeout(() => {
      boot.classList.add('boot-done');
      fadeTimer = setTimeout(() => boot.remove(), 500);
    }, wait);
    return () => {
      clearTimeout(holdTimer);
      clearTimeout(fadeTimer);
    };
  }, []);

  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <AppLayout />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
