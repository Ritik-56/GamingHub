import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import MainLayout from './layouts/MainLayout';
import Home from './pages/Home';
import Login from './pages/Login';
import CafeSetup from './pages/CafeSetup';
import StationManagement from './pages/StationManagement';
import SessionRequests from './pages/SessionRequests';
import ActiveSessions from './pages/ActiveSessions';
import Payments from './pages/Payments';
import Settings from './pages/Settings';
import StaffManagement from './pages/StaffManagement';
import CafeEntry from './pages/CafeEntry';

function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <div className="page-loader">Loading...</div>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return children;
}

function GuestRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <div className="page-loader">Loading...</div>;
  if (isAuthenticated) return <Navigate to="/" replace />;
  return children;
}

function RequireCafe({ children }) {
  const { hasCafe, loading } = useAuth();
  if (loading) return <div className="page-loader">Loading...</div>;
  if (!hasCafe) return <Navigate to="/setup" replace />;
  return children;
}

function SetupRoute({ children }) {
  const { hasCafe, loading } = useAuth();
  if (loading) return <div className="page-loader">Loading...</div>;
  if (hasCafe) return <Navigate to="/" replace />;
  return children;
}

function AppRoutes() {
  return (
    <Routes>
      {/* Customer café entry — minimal layout, outside staff dashboard */}
      <Route path="/cafe/:slug" element={<CafeEntry />} />

      <Route
        path="/login"
        element={
          <GuestRoute>
            <Login />
          </GuestRoute>
        }
      />
      <Route
        path="/setup"
        element={
          <ProtectedRoute>
            <SetupRoute>
              <CafeSetup />
            </SetupRoute>
          </ProtectedRoute>
        }
      />
      <Route
        element={
          <ProtectedRoute>
            <RequireCafe>
              <MainLayout />
            </RequireCafe>
          </ProtectedRoute>
        }
      >
        <Route index element={<Home />} />
        <Route path="stations" element={<StationManagement />} />
        <Route path="requests" element={<SessionRequests />} />
        <Route path="sessions" element={<ActiveSessions />} />
        <Route path="payments" element={<Payments />} />
        <Route path="settings" element={<Settings />} />
        <Route path="staff" element={<StaffManagement />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
