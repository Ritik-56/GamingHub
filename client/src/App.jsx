import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import MainLayout from './layouts/MainLayout';
import Landing from './pages/Landing';
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

// ---------------------------------------------------------------------------
// GuestRoute — blocks /login when the user for the RELEVANT scope is already
// authenticated. Customers go back to '/', admins go to '/dashboard' or '/setup'.
// ---------------------------------------------------------------------------
function GuestRoute({ children }) {
  const { isAdminAuthenticated, isCustomerAuthenticated, loading, cafes } = useAuth();

  if (loading) return <div className="page-loader">Loading...</div>;

  // Check the mode from URL state would require useLocation here, but
  // we can't know it at this level. Instead we redirect if EITHER scope is
  // authenticated — the Login page itself handles the right destination.
  // Priority: if admin is logged in, send to dashboard. If only customer is
  // logged in, let them through to login (they may want to switch scope).
  if (isAdminAuthenticated) {
    if (cafes && cafes.length > 0) return <Navigate to="/dashboard" replace />;
    return <Navigate to="/setup" replace />;
  }

  return children;
}

// ---------------------------------------------------------------------------
// AdminRoute — requires admin/staff authentication.
// A customer who is NOT admin gets bounced to '/'.
// ---------------------------------------------------------------------------
function AdminRoute({ children }) {
  const { isAdminAuthenticated, loading } = useAuth();
  if (loading) return <div className="page-loader">Loading...</div>;
  if (!isAdminAuthenticated) return <Navigate to="/login?mode=owner" replace />;
  return children;
}

// ---------------------------------------------------------------------------
// RequireCafe — admin must have at least one café.
// ---------------------------------------------------------------------------
function RequireCafe({ children }) {
  const { hasCafe, loading, isAdminAuthenticated } = useAuth();
  if (loading) return <div className="page-loader">Loading...</div>;
  if (!isAdminAuthenticated) return <Navigate to="/login?mode=owner" replace />;
  if (!hasCafe) return <Navigate to="/setup" replace />;
  return children;
}

// ---------------------------------------------------------------------------
// SetupRoute — only reachable by admin with NO café yet.
// ---------------------------------------------------------------------------
function SetupRoute({ children }) {
  const { hasCafe, loading, isAdminAuthenticated } = useAuth();
  if (loading) return <div className="page-loader">Loading...</div>;
  if (!isAdminAuthenticated) return <Navigate to="/login?mode=owner" replace />;
  if (hasCafe) return <Navigate to="/dashboard" replace />;
  return children;
}

function AppRoutes() {
  return (
    <Routes>
      {/* Public global landing page — never requires auth */}
      <Route path="/" element={<Landing />} />

      {/* Customer café entry — public slug route, never auto-logs-in */}
      <Route path="/cafe/:slug" element={<CafeEntry />} />

      {/* Auth — single login/register page, scope determined by state.mode */}
      <Route
        path="/login"
        element={
          <GuestRoute>
            <Login />
          </GuestRoute>
        }
      />

      {/* Café setup (owner, no café yet) */}
      <Route
        path="/setup"
        element={
          <SetupRoute>
            <CafeSetup />
          </SetupRoute>
        }
      />

      {/* Admin dashboard — all under /dashboard — admin auth required */}
      <Route
        path="/dashboard"
        element={
          <RequireCafe>
            <MainLayout />
          </RequireCafe>
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

      {/* Catch-all fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
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
