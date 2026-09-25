import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

export default function ActiveSessions() {
  const { currentCafe } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [ending, setEnding] = useState(null);

  const fetchSessions = useCallback(async () => {
    if (!currentCafe) return;
    try {
      const res = await api.get(`/cafes/${currentCafe._id}/sessions?status=ACTIVE`);
      setSessions(res.data.data.sessions);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [currentCafe]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  // Refresh every 30 seconds for updated durations/bills
  useEffect(() => {
    if (!currentCafe) return;
    const interval = setInterval(fetchSessions, 30000);
    return () => clearInterval(interval);
  }, [currentCafe, fetchSessions]);

  const handleEnd = async (sessionId) => {
    if (!window.confirm('End this session? The customer will be billed.')) return;

    setEnding(sessionId);
    setError('');
    try {
      await api.post(`/cafes/${currentCafe._id}/sessions/${sessionId}/end`);
      await fetchSessions();
    } catch (err) {
      setError(err.message);
    } finally {
      setEnding(null);
    }
  };

  const formatDuration = (minutes) => {
    if (!minutes && minutes !== 0) return '—';
    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hrs > 0) return `${hrs}h ${mins}m`;
    return `${mins}m`;
  };

  if (loading) return <div className="page-section-empty">Loading sessions...</div>;

  return (
    <div className="page-section">
      <div className="page-section-header">
        <div>
          <h2 className="page-section-title">Active Sessions</h2>
          <p className="page-section-subtitle">
            {sessions.length} active {sessions.length === 1 ? 'session' : 'sessions'}
          </p>
        </div>
      </div>

      {error && <div className="form-error" style={{ marginBottom: '1rem' }}>{error}</div>}

      {sessions.length === 0 ? (
        <div className="page-section-empty">
          No active sessions right now.
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Station</th>
                <th>Customer</th>
                <th>Duration</th>
                <th>Current Bill</th>
                <th>Started</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s._id}>
                  <td>
                    <span className="td-bold">{s.station?.name}</span>
                    {' '}
                    <span className="badge badge-type">{s.station?.type}</span>
                  </td>
                  <td>
                    <div className="td-bold">{s.customer?.name}</div>
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                      {s.customer?.phone || s.customer?.email}
                    </div>
                  </td>
                  <td className="td-bold">{formatDuration(s.elapsedMinutes)}</td>
                  <td className="td-bold">₹{s.currentBill || 0}</td>
                  <td>{s.startedAt ? new Date(s.startedAt).toLocaleTimeString() : '—'}</td>
                  <td className="td-actions">
                    <button
                      className="btn btn-ghost btn-sm"
                      style={{ color: 'var(--color-error)' }}
                      onClick={() => handleEnd(s._id)}
                      disabled={ending === s._id}
                    >
                      {ending === s._id ? 'Ending...' : 'End Session'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
