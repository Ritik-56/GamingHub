import { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const NAV_ITEMS = [
  { to: '/dashboard',          icon: '📊', label: 'Dashboard', end: true },
  { to: '/dashboard/stations', icon: '🖥️', label: 'Stations'  },
  { to: '/dashboard/requests', icon: '📋', label: 'Requests'  },
  { to: '/dashboard/sessions', icon: '⏱️', label: 'Sessions'  },
  { to: '/dashboard/payments', icon: '💰', label: 'Payments'  },
];

const SEC_NAV_ITEMS = [
  { to: '/dashboard/staff',    icon: '👥', label: 'Staff'    },
  { to: '/dashboard/settings', icon: '⚙️', label: 'Settings' },
];

export default function MainLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, logout, currentCafe, cafes, selectCafe, currentRole } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout('admin');
    navigate('/');
  };

  const close = () => setSidebarOpen(false);

  return (
    <div className="app-layout">
      {/* Mobile overlay */}
      <div
        className={`sidebar-overlay ${sidebarOpen ? 'open' : ''}`}
        onClick={close}
      />

      {/* ── Sidebar ── */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        {/* Brand */}
        <div className="sidebar-brand">
          <div
            className="sidebar-brand-icon"
            style={{ cursor: 'pointer' }}
            onClick={() => { navigate('/dashboard'); close(); }}
            title="Dashboard home"
          >
            🎮
          </div>
          <span
            className="sidebar-brand-text"
            style={{ cursor: 'pointer' }}
            onClick={() => { navigate('/dashboard'); close(); }}
          >
            Gaming Hub
          </span>
        </div>

        {/* Café selector (multi-café) */}
        {cafes && cafes.length > 1 && (
          <div className="sidebar-cafe-select">
            <select
              className="form-input form-select"
              value={currentCafe?._id || ''}
              onChange={(e) => selectCafe(e.target.value)}
            >
              {cafes.map((c) => (
                <option key={c.cafe._id} value={c.cafe._id}>
                  {c.cafe.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Primary nav */}
        <nav className="sidebar-nav">
          {NAV_ITEMS.map(({ to, icon, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
              onClick={close}
            >
              <span className="sidebar-link-icon">{icon}</span>
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-separator" />

        {/* Secondary nav */}
        <nav className="sidebar-nav sidebar-nav-secondary">
          {SEC_NAV_ITEMS.map(({ to, icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
              onClick={close}
            >
              <span className="sidebar-link-icon">{icon}</span>
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="sidebar-user-avatar">
              {user?.name?.charAt(0).toUpperCase()}
            </div>
            <div className="sidebar-user-info">
              <span className="sidebar-user-name">{user?.name}</span>
              <span className="sidebar-user-email">{user?.email}</span>
            </div>
          </div>
          <button className="btn btn-ghost sidebar-logout" onClick={handleLogout}>
            Sign Out
          </button>
        </div>
      </aside>

      {/* ── Main area ── */}
      <div className="main-content">
        <header className="header">
          <button
            className="mobile-menu-toggle"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label="Toggle menu"
          >
            ☰
          </button>

          <div className="header-title">
            {currentCafe?.name || 'Gaming Hub'}
          </div>

          <div className="header-actions">
            {currentRole && (
              <span
                className="badge badge-accent"
                style={{ textTransform: 'capitalize' }}
              >
                {currentRole}
              </span>
            )}
            <span className="header-user-name">{user?.name}</span>
          </div>
        </header>

        <main className="page-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
