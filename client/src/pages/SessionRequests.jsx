import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

export default function SessionRequests() {
  const { currentCafe } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [processing, setProcessing] = useState(null);

  const fetchSessions = useCallback(async () => {
    if (!currentCafe) return;
    try {
      const res = await api.get(`/cafes/${currentCafe._id}/sessions?status=REQUESTED`);
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

  // Poll for new requests
  useEffect(() => {
    if (!currentCafe) return;
    const interval = setInterval(fetchSessions, 10000);
    return () => clearInterval(interval);
  }, [currentCafe, fetchSessions]);

  const handleApprove = async (sessionId) => {
    setProcessing(sessionId);
    setError('');
    try {
      await api.post(`/cafes/${currentCafe._id}/sessions/${sessionId}/approve`);
      await fetchSessions();
    } catch (err) {
      setError(err.message);
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (sessionId) => {
    setProcessing(sessionId);
    setError('');
    try {
      await api.post(`/cafes/${currentCafe._id}/sessions/${sessionId}/reject`);
      await fetchSessions();
    } catch (err) {
      setError(err.message);
    } finally {
      setProcessing(null);
    }
  };

  const timeSince = (dateStr) => {
    const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (seconds < 60) return 'Just now';
    const mins = Math.floor(seconds / 60);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    return `${hrs}h ${mins % 60}m ago`;
  };

  if (loading) return <div className="page-section-empty">Loading requests...</div>;

  return (
    <div className="page-section">
      <div className="page-section-header">
        <div>
          <h2 className="page-section-title">Session Requests</h2>
          <p className="page-section-subtitle">
            {sessions.length} pending {sessions.length === 1 ? 'request' : 'requests'}
          </p>
        </div>
      </div>

      {error && <div className="form-error" style={{ marginBottom: '1rem' }}>{error}</div>}

      {sessions.length === 0 ? (
        <div className="page-section-empty">
          No pending session requests right now.
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Station</th>
                <th>Requested</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s._id}>
                  <td>
                    <div className="td-bold">{s.customer?.name}</div>
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                      {s.customer?.phone || s.customer?.email}
                    </div>
                  </td>
                  <td>
                    <span className="td-bold">{s.station?.name}</span>
                    {' '}
                    <span className="badge badge-type">{s.station?.type}</span>
                  </td>
                  <td>{timeSince(s.requestedAt)}</td>
                  <td className="td-actions">
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => handleApprove(s._id)}
                      disabled={processing === s._id}
                    >
                      {processing === s._id ? '...' : 'Approve'}
                    </button>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => handleReject(s._id)}
                      disabled={processing === s._id}
                    >
                      Reject
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
