import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

export default function CafeEntry() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated, user, loading: authLoading } = useAuth();

  const [cafe, setCafe] = useState(null);
  const [stations, setStations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [requesting, setRequesting] = useState(null);
  const [mySession, setMySession] = useState(null);
  const [joined, setJoined] = useState(false);

  // Fetch café info (public)
  const fetchCafe = useCallback(async () => {
    try {
      const res = await api.get(`/cafes/slug/${slug}`);
      setCafe(res.data.data.cafe);
      setStations(res.data.data.stations || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  // Join café and fetch session state
  const joinAndFetchSession = useCallback(async () => {
    if (!isAuthenticated || !cafe) return;
    try {
      await api.post(`/cafes/slug/${slug}/join`);
      setJoined(true);

      // Check if customer has an existing session
      const sessionRes = await api.get(`/cafes/${cafe._id}/sessions/my`);
      setMySession(sessionRes.data.data.session);
    } catch (err) {
      // Non-fatal — user can still browse
      console.error('Join/session check failed:', err.message);
    }
  }, [isAuthenticated, cafe, slug]);

  useEffect(() => {
    fetchCafe();
  }, [fetchCafe]);

  useEffect(() => {
    if (isAuthenticated && cafe && !joined) {
      joinAndFetchSession();
    }
  }, [isAuthenticated, cafe, joined, joinAndFetchSession]);

  // Refresh station data periodically
  useEffect(() => {
    if (!cafe) return;
    const interval = setInterval(fetchCafe, 15000);
    return () => clearInterval(interval);
  }, [cafe, fetchCafe]);

  // Refresh session data periodically when active
  useEffect(() => {
    if (!mySession || !cafe) return;
    const interval = setInterval(async () => {
      try {
        const res = await api.get(`/cafes/${cafe._id}/sessions/my`);
        setMySession(res.data.data.session);
        // Also refresh station data
        fetchCafe();
      } catch {
        // ignore
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [mySession, cafe, fetchCafe]);

  const handleRequest = async (stationId) => {
    if (!isAuthenticated) {
      navigate(`/login`, { state: { from: `/cafe/${slug}` } });
      return;
    }

    setRequesting(stationId);
    setError('');

    try {
      const res = await api.post(`/cafes/${cafe._id}/sessions/request`, { stationId });
      setMySession(res.data.data.session);
      await fetchCafe();
    } catch (err) {
      setError(err.message);
    } finally {
      setRequesting(null);
    }
  };

  const statusLabel = (status) => {
    const map = {
      AVAILABLE: 'Available',
      REQUESTED: 'Reserved',
      OCCUPIED: 'In Use',
      PAYMENT_PENDING: 'Finishing Up',
      MAINTENANCE: 'Unavailable',
    };
    return map[status] || status;
  };

  const statusClass = (status) => {
    const map = {
      AVAILABLE: 'station-available',
      REQUESTED: 'station-reserved',
      OCCUPIED: 'station-occupied',
      PAYMENT_PENDING: 'station-reserved',
      MAINTENANCE: 'station-maintenance',
    };
    return map[status] || '';
  };

  if (loading || authLoading) {
    return (
      <div className="customer-page">
        <div className="customer-loading">Loading café...</div>
      </div>
    );
  }

  if (error && !cafe) {
    return (
      <div className="customer-page">
        <div className="customer-error">
          <h2>Café Not Found</h2>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  // Active session view
  if (mySession) {
    return (
      <div className="customer-page">
        <CustomerHeader cafe={cafe} user={user} />
        <CustomerSession
          session={mySession}
          cafe={cafe}
          onSessionEnd={() => {
            setMySession(null);
            fetchCafe();
          }}
        />
      </div>
    );
  }

  return (
    <div className="customer-page">
      <CustomerHeader cafe={cafe} user={user} />

      <div className="customer-content">
        {error && <div className="form-error" style={{ marginBottom: '1rem' }}>{error}</div>}

        <div className="stations-header">
          <h2>Select a Station</h2>
          <p>{stations.filter((s) => s.status === 'AVAILABLE').length} of {stations.length} available</p>
        </div>

        <div className="station-grid">
          {stations.map((station) => (
            <div
              key={station._id}
              className={`station-card ${statusClass(station.status)}`}
            >
              <div className="station-card-top">
                <span className="station-card-name">{station.name}</span>
                <span className="station-card-type">{station.type}</span>
              </div>
              <div className="station-card-price">
                {station.currency}{station.effectivePrice}/hr
              </div>
              <div className="station-card-status">
                {statusLabel(station.status)}
              </div>
              {station.status === 'AVAILABLE' && (
                <button
                  className="btn btn-primary station-card-action"
                  onClick={() => handleRequest(station._id)}
                  disabled={requesting === station._id || !!mySession}
                >
                  {requesting === station._id ? 'Requesting...' : 'Request Session'}
                </button>
              )}
            </div>
          ))}
        </div>

        {stations.length === 0 && (
          <div className="customer-empty">No stations available at this café right now.</div>
        )}

        {!isAuthenticated && (
          <div className="customer-login-prompt">
            <p>Sign in to request a gaming session</p>
            <button
              className="btn btn-primary"
              onClick={() => navigate('/login', { state: { from: `/cafe/${slug}` } })}
            >
              Sign In
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function CustomerHeader({ cafe, user }) {
  const navigate = useNavigate();
  const { logout, isAuthenticated } = useAuth();

  return (
    <header className="customer-header">
      <div className="customer-header-cafe">
        <span className="customer-header-icon">🎮</span>
        <span className="customer-header-name">{cafe?.name}</span>
      </div>
      <div className="customer-header-actions">
        {isAuthenticated ? (
          <>
            <span className="customer-header-user">{user?.name}</span>
            <button className="btn btn-ghost btn-sm" onClick={logout}>Logout</button>
          </>
        ) : (
          <button
            className="btn btn-primary btn-sm"
            onClick={() => navigate('/login', { state: { from: window.location.pathname } })}
          >
            Sign In
          </button>
        )}
      </div>
    </header>
  );
}

function CustomerSession({ session, cafe, onSessionEnd }) {
  const [elapsed, setElapsed] = useState(0);

  // Local timer for display (server is source of truth for billing)
  useEffect(() => {
    if (session.status !== 'ACTIVE' || !session.startedAt) return;

    const updateElapsed = () => {
      const ms = Date.now() - new Date(session.startedAt).getTime();
      setElapsed(Math.floor(ms / 1000));
    };

    updateElapsed();
    const interval = setInterval(updateElapsed, 1000);
    return () => clearInterval(interval);
  }, [session.status, session.startedAt]);

  const formatTime = (totalSeconds) => {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    if (hrs > 0) {
      return `${hrs}h ${String(mins).padStart(2, '0')}m ${String(secs).padStart(2, '0')}s`;
    }
    return `${mins}m ${String(secs).padStart(2, '0')}s`;
  };

  const currentBill = session.status === 'ACTIVE' && session.pricePerHour
    ? Math.round((elapsed / 3600) * session.pricePerHour)
    : session.currentBill || 0;

  if (session.status === 'REQUESTED') {
    return (
      <div className="customer-content">
        <div className="session-status-card session-waiting">
          <div className="session-status-icon">⏳</div>
          <h2>Waiting for Approval</h2>
          <p>Your session request for <strong>{session.station?.name}</strong> is being reviewed by staff.</p>
          <div className="session-status-detail">
            <span>Station: {session.station?.name} ({session.station?.type})</span>
          </div>
          <div className="session-pulse-indicator">
            <span className="pulse-dot"></span>
            Pending staff confirmation
          </div>
        </div>
      </div>
    );
  }

  if (session.status === 'ACTIVE') {
    return (
      <div className="customer-content">
        <div className="session-status-card session-active">
          <div className="session-status-icon">🎮</div>
          <h2>Session Active</h2>
          <div className="session-timer">{formatTime(elapsed)}</div>
          <div className="session-bill">
            <span className="session-bill-label">Current Bill</span>
            <span className="session-bill-amount">{cafe?.currency || '₹'}{currentBill}</span>
          </div>
          <div className="session-details">
            <div className="session-detail-row">
              <span>Station</span>
              <span>{session.station?.name} ({session.station?.type})</span>
            </div>
            <div className="session-detail-row">
              <span>Rate</span>
              <span>{cafe?.currency || '₹'}{session.pricePerHour}/hr</span>
            </div>
            <div className="session-detail-row">
              <span>Started</span>
              <span>{new Date(session.startedAt).toLocaleTimeString()}</span>
            </div>
          </div>
          <p className="session-note">To end your session, please ask the staff at the counter.</p>
        </div>
      </div>
    );
  }

  // Completed/ended
  return (
    <div className="customer-content">
      <div className="session-status-card session-ended">
        <div className="session-status-icon">✅</div>
        <h2>Session Ended</h2>
        <div className="session-bill">
          <span className="session-bill-label">Total</span>
          <span className="session-bill-amount">{cafe?.currency || '₹'}{session.finalAmount}</span>
        </div>
        <p className="session-note">Please pay at the counter. Thank you!</p>
        <button className="btn btn-primary" onClick={onSessionEnd} style={{ marginTop: '1rem' }}>
          Done
        </button>
      </div>
    </div>
  );
}
