import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { adminApi as api } from '../services/api';

export default function SessionRequests() {
  const { currentCafe } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [processing, setProcessing] = useState(null);

  const [editCounts, setEditCounts] = useState({});

  const getControllerCount = (sessionId, defaultCount = 1) => editCounts[sessionId] ?? (defaultCount || 1);
  const handleCountChange = (sessionId, delta, currentCount) => {
    setEditCounts((prev) => {
      const curr = prev[sessionId] ?? (currentCount || 1);
      const next = Math.max(1, Math.min(4, curr + delta));
      return { ...prev, [sessionId]: next };
    });
  };

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
      const session = sessions.find((s) => s._id === sessionId);
      const controllerCount = editCounts[sessionId] ?? (session?.controllersRequested || 1);
      await api.post(`/cafes/${currentCafe._id}/sessions/${sessionId}/approve`, {
        controllerCount,
      });
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
                <th>Controllers</th>
                <th>Requested</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => {
                const count = getControllerCount(s._id, s.controllersRequested);
                return (
                  <tr key={s._id}>
                    <td>
                      <div className="td-bold">{s.customer?.name || s.customerName || 'Customer'}</div>
                      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                        {s.customer?.phone || s.customerPhone || s.customer?.email || '—'}
                      </div>
                    </td>
                    <td>
                      <span className="td-bold">{s.station?.name}</span>
                      {' '}
                      <span className="badge badge-type">{s.station?.type}</span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <button
                          type="button"
                          className="stepper-btn"
                          style={{ width: '22px', height: '22px', fontSize: '12px' }}
                          onClick={() => handleCountChange(s._id, -1, s.controllersRequested)}
                          disabled={count <= 1 || processing === s._id}
                          title="Decrease controller count"
                        >
                          −
                        </button>
                        <span style={{ fontWeight: 'bold', minWidth: '16px', textAlign: 'center' }}>
                          {count}
                        </span>
                        <button
                          type="button"
                          className="stepper-btn"
                          style={{ width: '22px', height: '22px', fontSize: '12px' }}
                          onClick={() => handleCountChange(s._id, 1, s.controllersRequested)}
                          disabled={count >= 4 || processing === s._id}
                          title="Increase controller count"
                        >
                          +
                        </button>
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                        ₹{count * 100}/hr
                      </div>
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
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
