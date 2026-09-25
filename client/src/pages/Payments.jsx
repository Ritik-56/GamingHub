import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

export default function Payments() {
  const { currentCafe } = useAuth();
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [processing, setProcessing] = useState(null);
  const [view, setView] = useState('PENDING'); // PENDING | PAID

  const fetchPayments = useCallback(async () => {
    if (!currentCafe) return;
    try {
      const res = await api.get(`/cafes/${currentCafe._id}/payments?status=${view}`);
      setPayments(res.data.data.payments);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [currentCafe, view]);

  useEffect(() => {
    setLoading(true);
    fetchPayments();
  }, [fetchPayments]);

  // Poll for new pending payments
  useEffect(() => {
    if (!currentCafe || view !== 'PENDING') return;
    const interval = setInterval(fetchPayments, 15000);
    return () => clearInterval(interval);
  }, [currentCafe, view, fetchPayments]);

  const handleMarkPaid = async (paymentId) => {
    if (!window.confirm('Mark this payment as paid?')) return;

    setProcessing(paymentId);
    setError('');
    try {
      await api.post(`/cafes/${currentCafe._id}/payments/${paymentId}/markPaid`);
      await fetchPayments();
    } catch (err) {
      setError(err.message);
    } finally {
      setProcessing(null);
    }
  };

  const formatDuration = (startedAt, endedAt) => {
    if (!startedAt || !endedAt) return '—';
    const ms = new Date(endedAt) - new Date(startedAt);
    const mins = Math.floor(ms / 60000);
    const hrs = Math.floor(mins / 60);
    const remainMins = mins % 60;
    if (hrs > 0) return `${hrs}h ${remainMins}m`;
    return `${remainMins}m`;
  };

  if (loading) return <div className="page-section-empty">Loading payments...</div>;

  return (
    <div className="page-section">
      <div className="page-section-header">
        <div>
          <h2 className="page-section-title">Payments</h2>
          <p className="page-section-subtitle">
            {payments.length} {view === 'PENDING' ? 'pending' : 'paid'} {payments.length === 1 ? 'payment' : 'payments'}
          </p>
        </div>
        <div className="tab-group">
          <button
            className={`tab-btn ${view === 'PENDING' ? 'tab-active' : ''}`}
            onClick={() => setView('PENDING')}
          >
            Pending
          </button>
          <button
            className={`tab-btn ${view === 'PAID' ? 'tab-active' : ''}`}
            onClick={() => setView('PAID')}
          >
            Paid
          </button>
        </div>
      </div>

      {error && <div className="form-error" style={{ marginBottom: '1rem' }}>{error}</div>}

      {payments.length === 0 ? (
        <div className="page-section-empty">
          {view === 'PENDING'
            ? 'No pending payments right now.'
            : 'No paid records found.'}
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Station</th>
                <th>Customer</th>
                <th>Duration</th>
                <th>Amount</th>
                {view === 'PAID' && <th>Paid At</th>}
                {view === 'PENDING' && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p._id}>
                  <td>
                    <span className="td-bold">{p.session?.station?.name}</span>
                    {' '}
                    <span className="badge badge-type">{p.session?.station?.type}</span>
                  </td>
                  <td>
                    <div className="td-bold">{p.customer?.name}</div>
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                      {p.customer?.phone || p.customer?.email}
                    </div>
                  </td>
                  <td>{formatDuration(p.session?.startedAt, p.session?.endedAt)}</td>
                  <td className="td-bold">₹{p.amount}</td>
                  {view === 'PAID' && (
                    <td>{p.paidAt ? new Date(p.paidAt).toLocaleTimeString() : '—'}</td>
                  )}
                  {view === 'PENDING' && (
                    <td className="td-actions">
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => handleMarkPaid(p._id)}
                        disabled={processing === p._id}
                      >
                        {processing === p._id ? 'Marking...' : 'Mark Paid'}
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
