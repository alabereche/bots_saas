import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import ProtectedRoute from './components/ProtectedRoute';
import Sidebar from './components/Sidebar';
import AmbientBackground from './components/AmbientBackground';
import BotLoader from './components/BotLoader';

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
  // React has committed its first paint, so there is never a blank flash
  useEffect(() => {
    const boot = document.getElementById('boot-loader');
    if (!boot) return undefined;
    boot.classList.add('boot-done');
    const t = setTimeout(() => boot.remove(), 500);
    return () => clearTimeout(t);
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
