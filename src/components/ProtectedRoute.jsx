import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import BotLoader from './BotLoader';

export default function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <BotLoader fullscreen />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
