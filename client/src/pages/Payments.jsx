import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

export default function Payments() {
  const { currentCafe } = useAuth();
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [processing, setProcessing] = useState(null);
  const [view, setView] = useState('PENDING'); // PENDING | TODAY | HISTORY
  const [selectedDate, setSelectedDate] = useState(getTodayStr());
  const [exporting, setExporting] = useState(false);

  // Summary stats for records view
  const totalAmount = payments.reduce((sum, p) => sum + (p.amount || 0), 0);

  function getTodayStr() {
    const d = new Date();
    return d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
  }

  function getYesterdayStr() {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
  }

  function formatDateLabel(dateStr) {
    const today = getTodayStr();
    const yesterday = getYesterdayStr();
    if (dateStr === today) return 'Today';
    if (dateStr === yesterday) return 'Yesterday';
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-IN', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }

  const fetchPayments = useCallback(async () => {
    if (!currentCafe) return;
    try {
      let url = `/cafes/${currentCafe._id}/payments`;
      const params = new URLSearchParams();

      if (view === 'PENDING') {
        params.set('status', 'PENDING');
      } else if (view === 'TODAY') {
        params.set('status', 'PAID');
        params.set('date', getTodayStr());
      } else if (view === 'HISTORY') {
        params.set('status', 'PAID');
        params.set('date', selectedDate);
      }

      url += '?' + params.toString();
      const res = await api.get(url);
      setPayments(res.data.data.payments);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [currentCafe, view, selectedDate]);

  useEffect(() => {
    setLoading(true);
    setError('');
    fetchPayments();
  }, [fetchPayments]);

  // Poll for pending payments
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

  const handleExport = async () => {
    setExporting(true);
    setError('');
    try {
      const params = new URLSearchParams();
      params.set('status', 'PAID');

      if (view === 'TODAY') {
        params.set('date', getTodayStr());
      } else if (view === 'HISTORY') {
        params.set('date', selectedDate);
      } else {
        // From pending tab, export today's records
        params.set('date', getTodayStr());
      }

      const res = await api.get(
        `/cafes/${currentCafe._id}/payments/export?${params.toString()}`,
        { responseType: 'blob' }
      );

      // Trigger download
      const blob = new Blob([res.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;

      const dateLabel = view === 'HISTORY' ? selectedDate : getTodayStr();
      link.download = `payment_records_${dateLabel}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message || 'Failed to export');
    } finally {
      setExporting(false);
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

  const formatTime = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
    });
  };

  const switchView = (newView) => {
    setView(newView);
    if (newView === 'HISTORY') {
      // Default to today when switching to history
      setSelectedDate(getTodayStr());
    }
  };

  if (loading) return <div className="page-section-empty">Loading payments...</div>;

  return (
    <div className="page-section">
      <div className="page-section-header">
        <div>
          <h2 className="page-section-title">Payments</h2>
          <p className="page-section-subtitle">
            {view === 'PENDING' && `${payments.length} pending ${payments.length === 1 ? 'payment' : 'payments'}`}
            {view === 'TODAY' && `${payments.length} paid today — ₹${totalAmount}`}
            {view === 'HISTORY' && `${payments.length} records for ${formatDateLabel(selectedDate)} — ₹${totalAmount}`}
          </p>
        </div>
        <div className="page-section-actions">
          {(view === 'TODAY' || view === 'HISTORY') && (
            <button
              className="btn btn-ghost btn-sm"
              onClick={handleExport}
              disabled={exporting || payments.length === 0}
              title="Download Excel"
            >
              {exporting ? 'Exporting...' : '📥 Download Excel'}
            </button>
          )}
        </div>
      </div>

      {/* Tab navigation */}
      <div className="tab-group" style={{ marginBottom: 'var(--space-4)' }}>
        <button
          className={`tab-btn ${view === 'PENDING' ? 'tab-active' : ''}`}
          onClick={() => switchView('PENDING')}
        >
          Pending
        </button>
        <button
          className={`tab-btn ${view === 'TODAY' ? 'tab-active' : ''}`}
          onClick={() => switchView('TODAY')}
        >
          Today
        </button>
        <button
          className={`tab-btn ${view === 'HISTORY' ? 'tab-active' : ''}`}
          onClick={() => switchView('HISTORY')}
        >
          History
        </button>
      </div>

      {/* Date picker for History tab */}
      {view === 'HISTORY' && (
        <div className="history-date-controls">
          <div className="history-date-buttons">
            <button
              className={`btn btn-sm ${selectedDate === getTodayStr() ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setSelectedDate(getTodayStr())}
            >
              Today
            </button>
            <button
              className={`btn btn-sm ${selectedDate === getYesterdayStr() ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setSelectedDate(getYesterdayStr())}
            >
              Yesterday
            </button>
          </div>
          <input
            type="date"
            className="form-input history-date-input"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            max={getTodayStr()}
          />
        </div>
      )}

      {error && <div className="form-error" style={{ marginBottom: '1rem' }}>{error}</div>}

      {payments.length === 0 ? (
        <div className="page-section-empty">
          {view === 'PENDING' && 'No pending payments right now.'}
          {view === 'TODAY' && 'No paid records for today.'}
          {view === 'HISTORY' && `No records found for ${formatDateLabel(selectedDate)}.`}
        </div>
      ) : view === 'PENDING' ? (
        /* Pending payments — compact table with Mark Paid action */
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Station</th>
                <th>Customer</th>
                <th>Duration</th>
                <th>Amount</th>
                <th>Actions</th>
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
                  <td className="td-actions">
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => handleMarkPaid(p._id)}
                      disabled={processing === p._id}
                    >
                      {processing === p._id ? 'Marking...' : 'Mark Paid'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        /* Records view — expanded table with full details */
        <>
          {/* Summary bar */}
          <div className="records-summary">
            <div className="records-summary-item">
              <span className="records-summary-label">Records</span>
              <span className="records-summary-value">{payments.length}</span>
            </div>
            <div className="records-summary-item">
              <span className="records-summary-label">Total Revenue</span>
              <span className="records-summary-value records-summary-amount">₹{totalAmount}</span>
            </div>
          </div>

          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Customer</th>
                  <th>Station</th>
                  <th>Date</th>
                  <th>Duration</th>
                  <th>Session Charge</th>
                  <th>Controllers</th>
                  <th>Ctrl Charge</th>
                  <th>Total</th>
                  <th>Status</th>
                  <th>Paid At</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p, i) => {
                  const session = p.session;
                  const controllerCount = session?.controllersRequested ?? 0;
                  const controllerCharge = session?.controllerCharge ?? 0;
                  const sessionCharge = session?.sessionCharge ?? (p.amount - controllerCharge);

                  return (
                    <tr key={p._id}>
                      <td style={{ color: 'var(--color-text-muted)' }}>{i + 1}</td>
                      <td>
                        <div className="td-bold">{p.customer?.name}</div>
                        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                          {p.customer?.phone || p.customer?.email}
                        </div>
                      </td>
                      <td>
                        <span className="td-bold">{session?.station?.name}</span>
                        {' '}
                        <span className="badge badge-type">{session?.station?.type}</span>
                      </td>
                      <td>{formatDate(p.paidAt || p.createdAt)}</td>
                      <td>{formatDuration(session?.startedAt, session?.endedAt)}</td>
                      <td>₹{sessionCharge}</td>
                      <td>{controllerCount > 0 ? controllerCount : '—'}</td>
                      <td>{controllerCharge > 0 ? `₹${controllerCharge}` : '—'}</td>
                      <td className="td-bold">₹{p.amount}</td>
                      <td>
                        <span className={`badge ${p.status === 'PAID' ? 'status--available' : 'status--payment'}`}>
                          {p.status}
                        </span>
                      </td>
                      <td>{formatTime(p.paidAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
