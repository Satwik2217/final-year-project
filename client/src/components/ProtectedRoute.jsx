// Protected route wrapper — redirects unauthenticated users to login.
import { Navigate } from 'react-router-dom';

export default function ProtectedRoute({ children }) {
  const token = localStorage.getItem('neurowell_token');
  if (!token) return <Navigate to="/login" replace />;
  return children;
}
