import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { customerApi, publicApi } from '../services/api';
import cafeCoverImg from '../assets/cafe-cover.jpg';

export default function CafeEntry() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { isCustomerAuthenticated, customerUser, loading: authLoading } = useAuth();
  const isAuthenticated = isCustomerAuthenticated;
  const user = customerUser;

  const [cafe, setCafe] = useState(null);
  const [stations, setStations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [requesting, setRequesting] = useState(null);
  const [mySession, setMySession] = useState(null);
  const [joined, setJoined] = useState(false);
  const [stationControllers, setStationControllers] = useState({});

  const getControllerCount = (stationId) => stationControllers[stationId] || 1;
  const handleControllerChange = (stationId, delta) => {
    setStationControllers((prev) => {
      const current = prev[stationId] || 1;
      const next = Math.max(1, Math.min(4, current + delta));
      return { ...prev, [stationId]: next };
    });
  };

  const fetchCafe = useCallback(async () => {
    try {
      const res = await publicApi.get(`/cafes/slug/${slug}`);
      setCafe(res.data.data.cafe);
      setStations(res.data.data.stations || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  const joinAndFetchSession = useCallback(async () => {
    if (!isCustomerAuthenticated || !cafe) return;
    try {
      await customerApi.post(`/cafes/slug/${slug}/join`);
      setJoined(true);
      const sessionRes = await customerApi.get(`/cafes/${cafe._id}/sessions/my`);
      setMySession(sessionRes.data.data.session);
    } catch (err) {
      console.error('Join/session check failed:', err.message);
    }
  }, [isCustomerAuthenticated, cafe, slug]);

  useEffect(() => { fetchCafe(); }, [fetchCafe]);

  useEffect(() => {
    if (isCustomerAuthenticated && cafe && !joined) joinAndFetchSession();
  }, [isCustomerAuthenticated, cafe, joined, joinAndFetchSession]);

  useEffect(() => {
    if (!cafe) return;
    const interval = setInterval(fetchCafe, 15000);
    return () => clearInterval(interval);
  }, [cafe, fetchCafe]);

  useEffect(() => {
    if (!mySession || !cafe) return;
    const interval = setInterval(async () => {
      try {
        const res = await customerApi.get(`/cafes/${cafe._id}/sessions/my`);
        setMySession(res.data.data.session);
        fetchCafe();
      } catch { /* ignore */ }
    }, 10000);
    return () => clearInterval(interval);
  }, [mySession, cafe, fetchCafe]);

  const handleRequest = async (stationId) => {
    if (!isCustomerAuthenticated) {
      navigate('/login', { state: { mode: 'customer', from: `/cafe/${slug}` } });
      return;
    }
    setRequesting(stationId);
    setError('');
    try {
      const controllerCount = getControllerCount(stationId);
      const res = await customerApi.post(`/cafes/${cafe._id}/sessions/request`, {
        stationId,
        controllerCount,
      });
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

  const statusCardClass = (status) => {
    const map = {
      AVAILABLE: 'available',
      REQUESTED: 'occupied',
      OCCUPIED: 'occupied',
      PAYMENT_PENDING: 'occupied',
      MAINTENANCE: 'maintenance',
    };
    return map[status] || '';
  };

  const statusBadgeClass = (status) => {
    const map = {
      AVAILABLE: 'status-available',
      REQUESTED: 'status-occupied',
      OCCUPIED: 'status-occupied',
      PAYMENT_PENDING: 'status-occupied',
      MAINTENANCE: 'status-maintenance',
    };
    return map[status] || '';
  };

  /* ── Loading ── */
  if (loading || authLoading) {
    return (
      <div className="cafe-entry-page">
        <div className="page-loader">
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
            <div className="spinner" />
            <span>Loading café…</span>
          </div>
        </div>
      </div>
    );
  }

  /* ── Error ── */
  if (error && !cafe) {
    return (
      <div className="cafe-entry-page">
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', gap: '1rem', textAlign: 'center', padding: '2rem' }}>
          <div style={{ fontSize: '3rem' }}>😕</div>
          <h2 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)' }}>Café Not Found</h2>
          <p style={{ color: 'var(--color-text-muted)' }}>{error}</p>
          <button className="btn btn-primary" onClick={() => navigate('/')}>← Back to All Cafés</button>
        </div>
      </div>
    );
  }

  /* ── Active / Waiting / Payment session view ── */
  if (mySession) {
    return (
      <div className="cafe-entry-page">
        <EntryNav cafe={cafe} user={user} slug={slug} />
        <EntryHero cafe={cafe} />
        <div className="cafe-entry-content" style={{ gridTemplateColumns: '1fr', maxWidth: '600px' }}>
          <CustomerSession
            session={mySession}
            cafe={cafe}
            onSessionEnd={() => { setMySession(null); fetchCafe(); }}
          />
        </div>
      </div>
    );
  }

  /* ── Station browser ── */
  const availableCount = stations.filter((s) => s.status === 'AVAILABLE').length;
  const typeIcons = { PS5: '🎮', Xbox: '🕹️', PC: '💻' };

  return (
    <div className="cafe-entry-page">
      {/* Nav */}
      <EntryNav cafe={cafe} user={user} slug={slug} />

      {/* Hero */}
      <EntryHero cafe={cafe} />

      {/* Content */}
      <div className="cafe-entry-content">
        {/* ── Station grid ── */}
        <div className="cafe-entry-main">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-5)', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
            <h2 className="cafe-section-title">🖥️ Select a Station</h2>
            <span className="landing-cafes-count">
              {availableCount} of {stations.length} available
            </span>
          </div>

          {error && <div className="form-error" style={{ marginBottom: 'var(--space-5)' }}>⚠ {error}</div>}

          {stations.length === 0 ? (
            <div className="page-section-empty">
              <div className="page-section-empty-icon">🖥️</div>
              No stations configured for this café yet.
            </div>
          ) : (
            <div className="station-grid">
              {stations.map((station) => (
                <div
                  key={station._id}
                  className={`station-card ${statusCardClass(station.status)}`}
                >
                  {/* Header */}
                  <div className="station-card-header">
                    <div>
                      <div className="station-card-name">{station.name}</div>
                      <div className="station-card-type">
                        {typeIcons[station.type] || '🎯'} {station.type}
                      </div>
                    </div>
                    <span className={`station-status-badge ${statusBadgeClass(station.status)}`}>
                      {statusLabel(station.status)}
                    </span>
                  </div>

                  {/* Price */}
                  <div className="station-card-price">
                    {station.currency || '₹'}{station.effectivePrice}/hr
                  </div>

                  {/* Controller stepper + request button (available only) */}
                  {station.status === 'AVAILABLE' && (
                    <>
                      <div className="station-controller-row">
                        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>Controllers:</span>
                        <button
                          type="button"
                          className="stepper-btn"
                          onClick={() => handleControllerChange(station._id, -1)}
                          disabled={getControllerCount(station._id) <= 1 || requesting === station._id}
                        >−</button>
                        <span className="stepper-value">{getControllerCount(station._id)}</span>
                        <button
                          type="button"
                          className="stepper-btn"
                          onClick={() => handleControllerChange(station._id, 1)}
                          disabled={getControllerCount(station._id) >= 4 || requesting === station._id}
                        >+</button>
                        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginLeft: 'auto' }}>
                          ₹{getControllerCount(station._id) * 100}/hr
                        </span>
                      </div>

                      <button
                        className="btn btn-primary btn-block"
                        onClick={() => handleRequest(station._id)}
                        disabled={requesting === station._id || !!mySession}
                      >
                        {requesting === station._id ? 'Requesting…' : 'Request Session'}
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Sidebar ── */}
        <div className="cafe-entry-sidebar">
          {!isAuthenticated ? (
            <div className="cafe-login-prompt">
              <div className="cafe-login-prompt-icon">🎮</div>
              <h3>Sign in to Play</h3>
              <p>Create a free account or sign in to request a station and start your session.</p>
              <button
                className="btn btn-primary btn-block"
                onClick={() => navigate('/login', { state: { mode: 'customer', from: `/cafe/${slug}` } })}
              >
                Sign In / Register
              </button>
              <button
                className="btn btn-ghost btn-sm btn-block"
                style={{ marginTop: 'var(--space-2)' }}
                onClick={() => navigate('/')}
              >
                ← All Cafés
              </button>
            </div>
          ) : (
            <div className="session-card">
              <div className="session-card-title">
                <span className="status-dot online" />
                Your Session
              </div>
              <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)', padding: 'var(--space-6) 0' }}>
                No active session yet.
                <br />Pick a station and request one!
              </div>
            </div>
          )}

          {/* Café info card */}
          {cafe && (
            <div className="session-card" style={{ marginTop: 'var(--space-4)' }}>
              <div className="session-card-title">ℹ️ About this Café</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', fontSize: 'var(--font-size-sm)' }}>
                {cafe.address && (
                  <div style={{ color: 'var(--color-text-muted)' }}>📍 {cafe.address}</div>
                )}
                {cafe.phone && (
                  <div style={{ color: 'var(--color-text-muted)' }}>📞 {cafe.phone}</div>
                )}
                <div>
                  <span style={{ color: 'var(--color-text-muted)' }}>Base rate: </span>
                  <strong>{cafe.currency || '₹'}{cafe.pricePerHour}/hr</strong>
                </div>
                {cafe.stationTypes?.length > 0 && (
                  <div style={{ display: 'flex', gap: 'var(--space-1)', flexWrap: 'wrap' }}>
                    {cafe.stationTypes.map((t) => (
                      <span key={t} className="badge badge-type">{typeIcons[t] || '🎯'} {t}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Entry Nav ── */
function EntryNav({ cafe, user, slug }) {
  const navigate = useNavigate();
  const { logout, isCustomerAuthenticated } = useAuth();

  return (
    <nav className="cafe-entry-nav">
      <div className="cafe-entry-nav-brand">
        <div
          className="auth-brand"
          style={{ cursor: 'pointer' }}
          onClick={() => navigate('/')}
        >
          <div className="auth-brand-icon" style={{ width: '28px', height: '28px', fontSize: '0.9rem' }}>🎮</div>
          <span className="auth-brand-text" style={{ fontSize: 'var(--font-size-base)' }}>Gaming Hub</span>
        </div>
        {cafe?.name && (
          <>
            <span style={{ color: 'var(--color-border)', margin: '0 var(--space-2)' }}>›</span>
            <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', fontWeight: 'var(--font-weight-medium)' }}>
              {cafe.name}
            </span>
          </>
        )}
      </div>
      <div className="cafe-entry-nav-actions">
        {isCustomerAuthenticated ? (
          <>
            <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>{user?.name}</span>
            <button className="btn btn-ghost btn-sm" onClick={() => logout('customer')}>Sign Out</button>
          </>
        ) : (
          <button
            className="btn btn-primary btn-sm"
            onClick={() => navigate('/login', { state: { mode: 'customer', from: `/cafe/${slug}` } })}
          >
            Sign In
          </button>
        )}
      </div>
    </nav>
  );
}

/* ── Entry Hero ── */
function EntryHero({ cafe }) {
  const typeIcons = { PS5: '🎮', Xbox: '🕹️', PC: '💻' };
  return (
    <div className="cafe-entry-hero">
      <img src={cafeCoverImg} alt={cafe?.name || 'Gaming café'} />
      <div className="cafe-entry-hero-overlay">
        <div className="cafe-entry-hero-info">
          <h1 className="cafe-entry-hero-name">{cafe?.name}</h1>
          <div className="cafe-entry-hero-meta">
            {cafe?.address && (
              <span className="cafe-entry-hero-location">📍 {cafe.address}</span>
            )}
            {cafe?.pricePerHour && (
              <span className="cafe-entry-hero-price">
                From {cafe.currency || '₹'}{cafe.pricePerHour}/hr
              </span>
            )}
            {cafe?.stationTypes?.length > 0 && cafe.stationTypes.map((t) => (
              <span key={t} className="badge badge-type">
                {typeIcons[t] || '🎯'} {t}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Customer Session ── */
function CustomerSession({ session, cafe, onSessionEnd }) {
  const [elapsed, setElapsed] = useState(0);

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
    const hrs  = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    if (hrs > 0) return `${hrs}:${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`;
    return `${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`;
  };

  const ctrlCount     = session.controllersRequested || session.controllerCount || 1;
  const ctrlRate      = ctrlCount * 100;
  const elapsedMins   = elapsed / 60;
  const liveEstimated = Math.round(((100 * ctrlCount * elapsedMins) / 60) * 100) / 100;
  const currentBill   = session.status === 'ACTIVE'
    ? (session.currentBill != null ? session.currentBill : liveEstimated)
    : (session.finalAmount || session.currentBill || 0);

  /* REQUESTED */
  if (session.status === 'REQUESTED') {
    return (
      <div className="session-card" style={{ maxWidth: '480px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', padding: 'var(--space-8) 0' }}>
          <div style={{ fontSize: '3rem', marginBottom: 'var(--space-4)' }}>⏳</div>
          <h2 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', marginBottom: 'var(--space-3)' }}>
            Waiting for Approval
          </h2>
          <p style={{ color: 'var(--color-text-muted)', marginBottom: 'var(--space-6)' }}>
            Your request for <strong style={{ color: 'var(--color-text-primary)' }}>{session.station?.name}</strong> is being reviewed by staff.
          </p>
        </div>
        <div className="session-details">
          <div className="session-detail-row">
            <span>Station</span>
            <span>{session.station?.name} ({session.station?.type})</span>
          </div>
          <div className="session-detail-row">
            <span>Controllers</span>
            <span>{ctrlCount} (₹{ctrlRate}/hr)</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', justifyContent: 'center', marginTop: 'var(--space-5)', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
          <span className="status-dot warning" />
          Pending staff confirmation
        </div>
      </div>
    );
  }

  /* ACTIVE */
  if (session.status === 'ACTIVE') {
    return (
      <div className="session-card" style={{ maxWidth: '480px', margin: '0 auto' }}>
        <div className="session-card-title">
          <span className="status-dot online" /> Session Active
        </div>
        <div className="session-timer">
          <div className="session-timer-value">{formatTime(elapsed)}</div>
          <div className="session-timer-label">Time Elapsed</div>
        </div>
        <div className="session-bill">
          <span className="session-bill-label">Current Bill</span>
          <span className="session-bill-value">
            {cafe?.currency || '₹'}{typeof currentBill === 'number' ? currentBill.toFixed(2) : currentBill}
          </span>
        </div>
        <div className="session-details">
          <div className="session-detail-row">
            <span>Station</span>
            <span>{session.station?.name} ({session.station?.type})</span>
          </div>
          <div className="session-detail-row">
            <span>Controllers</span>
            <span>{ctrlCount}</span>
          </div>
          <div className="session-detail-row">
            <span>Rate</span>
            <span>₹{ctrlRate}/hr</span>
          </div>
          <div className="session-detail-row">
            <span>Started</span>
            <span>{new Date(session.startedAt).toLocaleTimeString()}</span>
          </div>
        </div>
        <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', textAlign: 'center' }}>
          To end your session, ask the staff at the counter.
        </p>
      </div>
    );
  }

  /* PAYMENT_PENDING */
  if (session.status === 'PAYMENT_PENDING') {
    const durationLabel = (() => {
      if (!session.startedAt || !session.endedAt) return '—';
      const ms   = new Date(session.endedAt) - new Date(session.startedAt);
      const mins = Math.floor(ms / 60000);
      const hrs  = Math.floor(mins / 60);
      return hrs > 0 ? `${hrs}h ${mins % 60}m` : `${mins}m`;
    })();

    return (
      <div className="session-card" style={{ maxWidth: '480px', margin: '0 auto' }}>
        <div className="session-card-title">💳 Payment Due</div>
        <div className="session-bill">
          <span className="session-bill-label">Total Amount</span>
          <span className="session-bill-value">
            {cafe?.currency || '₹'}{typeof session.finalAmount === 'number' ? session.finalAmount.toFixed(2) : session.finalAmount}
          </span>
        </div>
        <div className="session-details">
          <div className="session-detail-row"><span>Station</span><span>{session.station?.name} ({session.station?.type})</span></div>
          <div className="session-detail-row"><span>Controllers</span><span>{ctrlCount}</span></div>
          <div className="session-detail-row"><span>Duration</span><span>{durationLabel}</span></div>
          <div className="session-detail-row"><span>Rate</span><span>₹{ctrlRate}/hr</span></div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', justifyContent: 'center', marginTop: 'var(--space-4)', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
          <span className="status-dot warning" />
          Please pay at the counter
        </div>
      </div>
    );
  }

  /* COMPLETED */
  return (
    <div className="session-card" style={{ maxWidth: '480px', margin: '0 auto', textAlign: 'center' }}>
      <div style={{ fontSize: '3rem', marginBottom: 'var(--space-4)' }}>✅</div>
      <h2 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', marginBottom: 'var(--space-3)' }}>
        Session Complete
      </h2>
      <div className="session-bill">
        <span className="session-bill-label">Total Paid</span>
        <span className="session-bill-value">{cafe?.currency || '₹'}{session.finalAmount}</span>
      </div>
      <p style={{ color: 'var(--color-text-muted)', margin: 'var(--space-5) 0', fontSize: 'var(--font-size-sm)' }}>
        Thank you for gaming with us! 🎮
      </p>
      <button className="btn btn-primary btn-block" onClick={onSessionEnd}>
        Done
      </button>
    </div>
  );
}
