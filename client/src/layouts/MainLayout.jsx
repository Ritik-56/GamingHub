import { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function MainLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, logout, currentCafe, cafes, selectCafe } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout('admin'); // Explicitly scope: do not touch customer session
    navigate('/');
  };

  return (
    <div className="app-layout">
      <div
        className={`sidebar-overlay ${sidebarOpen ? 'open' : ''}`}
        onClick={() => setSidebarOpen(false)}
      />

      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <div
            className="sidebar-brand-icon"
            style={{ cursor: 'pointer' }}
            onClick={() => navigate('/')}
            title="Back to homepage"
          >
            🎮
          </div>
          <span
            className="sidebar-brand-text"
            style={{ cursor: 'pointer' }}
            onClick={() => navigate('/')}
          >
            Gaming Hub
          </span>
        </div>

        {/* Café selector if multiple cafés */}
        {cafes && cafes.length > 1 && (
          <div className="sidebar-cafe-select">
            <select
              className="form-input"
              value={currentCafe?._id || ''}
              onChange={(e) => selectCafe(e.target.value)}
              style={{ fontSize: 'var(--font-size-sm)', padding: '0.4rem 0.6rem' }}
            >
              {cafes.map((c) => (
                <option key={c.cafe._id} value={c.cafe._id}>
                  {c.cafe.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <nav className="sidebar-nav">
          <NavLink
            to="/dashboard"
            end
            className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            onClick={() => setSidebarOpen(false)}
          >
            <span className="sidebar-link-icon">📊</span>
            Dashboard
          </NavLink>
          <NavLink
            to="/dashboard/stations"
            className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            onClick={() => setSidebarOpen(false)}
          >
            <span className="sidebar-link-icon">🖥️</span>
            Stations
          </NavLink>
          <NavLink
            to="/dashboard/requests"
            className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            onClick={() => setSidebarOpen(false)}
          >
            <span className="sidebar-link-icon">📋</span>
            Requests
          </NavLink>
          <NavLink
            to="/dashboard/sessions"
            className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            onClick={() => setSidebarOpen(false)}
          >
            <span className="sidebar-link-icon">⏱️</span>
            Active Sessions
          </NavLink>
          <NavLink
            to="/dashboard/payments"
            className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            onClick={() => setSidebarOpen(false)}
          >
            <span className="sidebar-link-icon">💰</span>
            Payments
          </NavLink>
        </nav>

        <div className="sidebar-separator" />

        <nav className="sidebar-nav sidebar-nav-secondary">
          <NavLink
            to="/dashboard/staff"
            className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            onClick={() => setSidebarOpen(false)}
          >
            <span className="sidebar-link-icon">👥</span>
            Staff
          </NavLink>
          <NavLink
            to="/dashboard/settings"
            className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            onClick={() => setSidebarOpen(false)}
          >
            <span className="sidebar-link-icon">⚙️</span>
            Settings
          </NavLink>
        </nav>

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
            Logout
          </button>
        </div>
      </aside>

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
