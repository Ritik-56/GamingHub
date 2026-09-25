import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

export default function Home() {
  const { currentCafe, currentRole } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [recentSessions, setRecentSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchDashboard = useCallback(async () => {
    if (!currentCafe) return;
    try {
      // Fetch all dashboard data in parallel
      const [sessionsRes, paymentStatsRes, stationsRes, requestsRes] = await Promise.all([
        api.get(`/cafes/${currentCafe._id}/sessions?status=ACTIVE`),
        api.get(`/cafes/${currentCafe._id}/payments/stats`).catch(() => ({ data: { data: {} } })),
        api.get(`/cafes/${currentCafe._id}/stations`),
        api.get(`/cafes/${currentCafe._id}/sessions?status=REQUESTED`),
      ]);

      const activeSessions = sessionsRes.data.data.sessions || [];
      const paymentStats = paymentStatsRes.data.data || {};
      const stations = stationsRes.data.data.stations || [];
      const pendingRequests = requestsRes.data.data.sessions || [];

      const totalStations = stations.length;
      const availableStations = stations.filter((s) => s.status === 'AVAILABLE').length;
      const occupiedStations = stations.filter((s) => s.status === 'OCCUPIED').length;
      const maintenanceStations = stations.filter((s) => s.status === 'MAINTENANCE').length;

      setStats({
        activeSessionCount: activeSessions.length,
        pendingRequestCount: pendingRequests.length,
        pendingPaymentCount: paymentStats.pendingCount || 0,
        pendingPaymentTotal: paymentStats.pendingTotal || 0,
        todayRevenue: paymentStats.todayRevenue || 0,
        todayPaidCount: paymentStats.todayPaidCount || 0,
        totalStations,
        availableStations,
        occupiedStations,
        maintenanceStations,
      });

      setRecentSessions(activeSessions.slice(0, 5));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [currentCafe]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    if (!currentCafe) return;
    const interval = setInterval(fetchDashboard, 30000);
    return () => clearInterval(interval);
  }, [currentCafe, fetchDashboard]);

  const formatDuration = (minutes) => {
    if (!minutes && minutes !== 0) return '—';
    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hrs > 0) return `${hrs}h ${mins}m`;
    return `${mins}m`;
  };

  if (loading) return <div className="page-section-empty">Loading dashboard...</div>;

  return (
    <div>
      {/* Hero Section */}
      <section className="home-hero">
        <div className="home-hero-badge">
          <span className={`status-dot online`} />
          {currentCafe?.name || 'Gaming Hub'}
        </div>
        <h1>Dashboard</h1>
        <p>
          Real-time overview of your gaming café operations.
        </p>
      </section>

      {error && <div className="form-error" style={{ margin: '0 var(--space-6) var(--space-4)' }}>{error}</div>}

      {/* Quick Action Cards */}
      <div className="home-stats">
        <div
          className="card stat-card stat-card-clickable"
          style={{ '--delay': '100ms', '--glow-color': 'var(--color-warning)' }}
          onClick={() => navigate('/requests')}
        >
          <div className="stat-card-header">
            <span className="stat-card-label">Pending Requests</span>
            <span className="stat-card-icon">📋</span>
          </div>
          <div className="stat-card-value">
            {stats?.pendingRequestCount || 0}
          </div>
          <div className="stat-card-detail">
            <span className={`status-dot ${stats?.pendingRequestCount > 0 ? 'warning' : 'online'}`} />
            {stats?.pendingRequestCount > 0 ? 'Needs attention' : 'All clear'}
          </div>
        </div>

        <div
          className="card stat-card stat-card-clickable"
          style={{ '--delay': '200ms', '--glow-color': 'var(--color-cyan)' }}
          onClick={() => navigate('/sessions')}
        >
          <div className="stat-card-header">
            <span className="stat-card-label">Active Sessions</span>
            <span className="stat-card-icon">⏱️</span>
          </div>
          <div className="stat-card-value">
            {stats?.activeSessionCount || 0}
          </div>
          <div className="stat-card-detail">
            <span className="status-dot online" />
            {stats?.occupiedStations || 0} of {stats?.totalStations || 0} stations in use
          </div>
        </div>

        <div
          className="card stat-card stat-card-clickable"
          style={{ '--delay': '300ms', '--glow-color': 'var(--color-error)' }}
          onClick={() => navigate('/payments')}
        >
          <div className="stat-card-header">
            <span className="stat-card-label">Payment Pending</span>
            <span className="stat-card-icon">💰</span>
          </div>
          <div className="stat-card-value">
            {stats?.pendingPaymentCount || 0}
          </div>
          <div className="stat-card-detail">
            {stats?.pendingPaymentTotal > 0
              ? `₹${stats.pendingPaymentTotal} to collect`
              : 'No pending payments'}
          </div>
        </div>

        <div
          className="card stat-card"
          style={{ '--delay': '400ms', '--glow-color': 'var(--color-success)' }}
        >
          <div className="stat-card-header">
            <span className="stat-card-label">Today's Revenue</span>
            <span className="stat-card-icon">📊</span>
          </div>
          <div className="stat-card-value">
            ₹{stats?.todayRevenue || 0}
          </div>
          <div className="stat-card-detail">
            <span className="status-dot online" />
            {stats?.todayPaidCount || 0} sessions completed today
          </div>
        </div>
      </div>

      {/* Station Utilization + Active Sessions */}
      <div className="dashboard-grid">
        {/* Station Status */}
        <div className="card dashboard-card">
          <div className="dashboard-card-header">
            <h3>Station Overview</h3>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/stations')}>
              View All →
            </button>
          </div>
          <div className="station-stats-grid">
            <div className="station-stat">
              <div className="station-stat-value station-stat-available">{stats?.availableStations || 0}</div>
              <div className="station-stat-label">Available</div>
            </div>
            <div className="station-stat">
              <div className="station-stat-value station-stat-occupied">{stats?.occupiedStations || 0}</div>
              <div className="station-stat-label">Occupied</div>
            </div>
            <div className="station-stat">
              <div className="station-stat-value station-stat-maintenance">{stats?.maintenanceStations || 0}</div>
              <div className="station-stat-label">Maintenance</div>
            </div>
            <div className="station-stat">
              <div className="station-stat-value">{stats?.totalStations || 0}</div>
              <div className="station-stat-label">Total</div>
            </div>
          </div>
          {stats?.totalStations > 0 && (
            <div className="station-utilization-bar">
              <div
                className="utilization-segment utilization-occupied"
                style={{ width: `${(stats.occupiedStations / stats.totalStations) * 100}%` }}
                title={`${stats.occupiedStations} occupied`}
              />
              <div
                className="utilization-segment utilization-maintenance"
                style={{ width: `${(stats.maintenanceStations / stats.totalStations) * 100}%` }}
                title={`${stats.maintenanceStations} maintenance`}
              />
            </div>
          )}
        </div>

        {/* Active Sessions Preview */}
        <div className="card dashboard-card">
          <div className="dashboard-card-header">
            <h3>Active Sessions</h3>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/sessions')}>
              View All →
            </button>
          </div>
          {recentSessions.length === 0 ? (
            <div className="dashboard-card-empty">No active sessions right now.</div>
          ) : (
            <div className="dashboard-session-list">
              {recentSessions.map((s) => (
                <div key={s._id} className="dashboard-session-item">
                  <div className="dashboard-session-station">
                    <span className="td-bold">{s.station?.name}</span>
                    <span className="badge badge-type">{s.station?.type}</span>
                  </div>
                  <div className="dashboard-session-customer">{s.customer?.name}</div>
                  <div className="dashboard-session-meta">
                    <span>{formatDuration(s.elapsedMinutes)}</span>
                    <span className="td-bold">₹{s.currentBill || 0}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Café Info Bar */}
      <div className="cafe-info-bar">
        <div className="cafe-info-item">
          <span className="cafe-info-label">Café</span>
          <span className="cafe-info-value">{currentCafe?.name}</span>
        </div>
        <div className="cafe-info-item">
          <span className="cafe-info-label">Role</span>
          <span className="cafe-info-value">{currentRole}</span>
        </div>
        <div className="cafe-info-item">
          <span className="cafe-info-label">Rate</span>
          <span className="cafe-info-value">{currentCafe?.currency || '₹'}{currentCafe?.pricePerHour}/hr</span>
        </div>
        {currentCafe?.slug && (
          <div className="cafe-info-item">
            <span className="cafe-info-label">Customer Link</span>
            <span className="cafe-info-value cafe-info-link">/cafe/{currentCafe.slug}</span>
          </div>
        )}
      </div>
    </div>
  );
}
