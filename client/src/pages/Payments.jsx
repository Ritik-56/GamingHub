import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../context/AuthContext';
import { adminApi as api } from '../services/api';

export default function Payments() {
  const { currentCafe } = useAuth();
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [processing, setProcessing] = useState(null);
  const [view, setView] = useState('PENDING'); // PENDING | TODAY | HISTORY
  const [selectedDate, setSelectedDate] = useState(getTodayStr());
  const [exporting, setExporting] = useState(false);

  // Manual payment state
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualCustomerName, setManualCustomerName] = useState('');
  const [manualCustomerPhone, setManualCustomerPhone] = useState('');
  const [manualAmount, setManualAmount] = useState('');
  const [manualStationId, setManualStationId] = useState('');
  const [manualPaymentMethod, setManualPaymentMethod] = useState('CASH');
  const [manualNotes, setManualNotes] = useState('');
  const [manualSubmitting, setManualSubmitting] = useState(false);
  const [manualError, setManualError] = useState('');
  const [stations, setStations] = useState([]);
  const [successMsg, setSuccessMsg] = useState('');

  // Fetch stations for optional station assignment in manual payment
  useEffect(() => {
    if (!currentCafe) return;
    api.get(`/cafes/${currentCafe._id}/stations`)
      .then((res) => setStations(res.data.data.stations || []))
      .catch(() => {});
  }, [currentCafe]);

  // Summary stats for records view
  const totalAmount = Math.round(payments.reduce((sum, p) => sum + (p.amount || 0), 0) * 100) / 100;

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

  const handleManualPaymentSubmit = async (e) => {
    e.preventDefault();
    if (!manualCustomerName.trim() || !manualCustomerPhone.trim()) {
      setManualError('Customer name and phone number are required');
      return;
    }
    const numAmount = parseFloat(manualAmount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setManualError('Please enter a valid amount greater than ₹0');
      return;
    }

    setManualSubmitting(true);
    setManualError('');
    try {
      await api.post(`/cafes/${currentCafe._id}/payments/manual`, {
        customerName: manualCustomerName.trim(),
        customerPhone: manualCustomerPhone.trim(),
        amount: numAmount,
        stationId: manualStationId || undefined,
        paymentMethod: manualPaymentMethod,
        notes: manualNotes.trim() || undefined,
      });

      setSuccessMsg(`Payment of ₹${numAmount.toFixed(2)} for ${manualCustomerName.trim()} recorded successfully!`);
      setTimeout(() => setSuccessMsg(''), 6000);

      setShowManualModal(false);
      setManualCustomerName('');
      setManualCustomerPhone('');
      setManualAmount('');
      setManualStationId('');
      setManualPaymentMethod('CASH');
      setManualNotes('');

      // Switch to TODAY view to immediately display the newly recorded paid record
      setView('TODAY');
      await fetchPayments();
    } catch (err) {
      setManualError(err.message);
    } finally {
      setManualSubmitting(false);
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
          <button
            className="btn btn-primary btn-sm"
            onClick={() => {
              setManualError('');
              setShowManualModal(true);
            }}
            id="btn-record-payment"
            title="Record counter or walk-in payment manually"
          >
            + Record Payment
          </button>
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

      {successMsg && (
        <div className="form-success" style={{ marginBottom: '1rem' }}>
          {successMsg}
        </div>
      )}

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
                    <span className="td-bold">{p.session?.station?.name || p.station?.name || 'Counter'}</span>
                    {' '}
                    {(p.session?.station?.type || p.station?.type) && (
                      <span className="badge badge-type">{p.session?.station?.type || p.station?.type}</span>
                    )}
                  </td>
                  <td>
                    <div className="td-bold">{p.customer?.name || p.customerName || 'Walk-in'}</div>
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                      {p.customer?.phone || p.customer?.email || p.customerPhone || '—'}
                    </div>
                  </td>
                  <td>{p.session ? formatDuration(p.session?.startedAt, p.session?.endedAt) : (p.notes || 'Manual Entry')}</td>
                  <td className="td-bold">₹{typeof p.amount === 'number' ? p.amount.toFixed(2) : p.amount}</td>
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
              <span className="records-summary-value records-summary-amount">₹{totalAmount.toFixed(2)}</span>
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
                  const controllerCount = session?.controllersRequested ?? '—';
                  const controllerCharge = session?.controllerCharge != null ? session.controllerCharge : (session ? 0 : '—');
                  const sessionCharge = session?.sessionCharge != null ? session.sessionCharge : p.amount;

                  return (
                    <tr key={p._id}>
                      <td style={{ color: 'var(--color-text-muted)' }}>{i + 1}</td>
                      <td>
                        <div className="td-bold">{p.customer?.name || p.customerName || session?.customerName || 'Walk-in'}</div>
                        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                          {p.customer?.phone || p.customer?.email || p.customerPhone || session?.customerPhone || '—'}
                        </div>
                      </td>
                      <td>
                        <span className="td-bold">{session?.station?.name || p.station?.name || 'Counter'}</span>
                        {' '}
                        {(session?.station?.type || p.station?.type) && (
                          <span className="badge badge-type">{session?.station?.type || p.station?.type}</span>
                        )}
                      </td>
                      <td>{formatDate(p.paidAt || p.createdAt)}</td>
                      <td>{session ? formatDuration(session?.startedAt, session?.endedAt) : (p.notes ? `Manual (${p.notes})` : 'Manual Entry')}</td>
                      <td>₹{typeof sessionCharge === 'number' ? sessionCharge.toFixed(2) : sessionCharge}</td>
                      <td>{controllerCount}</td>
                      <td>{typeof controllerCharge === 'number' ? `₹${controllerCharge.toFixed(2)}` : controllerCharge}</td>
                      <td className="td-bold">₹{typeof p.amount === 'number' ? p.amount.toFixed(2) : p.amount}</td>
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

      {/* Manual Payment Entry Modal */}
      {showManualModal && createPortal(
        <div className="modal-overlay" onClick={() => !manualSubmitting && setShowManualModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Record Payment</h3>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setShowManualModal(false)}
                disabled={manualSubmitting}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleManualPaymentSubmit} className="modal-body">
              <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-4)' }}>
                Record a direct counter payment for a walk-in or registered customer.
              </p>

              {/* Customer Name */}
              <div className="form-group">
                <label className="form-label" htmlFor="manual-pay-name">
                  Customer Name <span style={{ color: 'var(--color-error)' }}>*</span>
                </label>
                <input
                  id="manual-pay-name"
                  type="text"
                  className="form-input"
                  placeholder="e.g. Rahul Sharma"
                  value={manualCustomerName}
                  onChange={(e) => setManualCustomerName(e.target.value)}
                  disabled={manualSubmitting}
                  autoFocus
                  required
                />
              </div>

              {/* Customer Phone */}
              <div className="form-group">
                <label className="form-label" htmlFor="manual-pay-phone">
                  Phone Number <span style={{ color: 'var(--color-error)' }}>*</span>
                </label>
                <input
                  id="manual-pay-phone"
                  type="tel"
                  className="form-input"
                  placeholder="e.g. 9876543210"
                  value={manualCustomerPhone}
                  onChange={(e) => setManualCustomerPhone(e.target.value)}
                  disabled={manualSubmitting}
                  required
                />
              </div>

              {/* Amount */}
              <div className="form-group">
                <label className="form-label" htmlFor="manual-pay-amount">
                  Payment Amount (₹) <span style={{ color: 'var(--color-error)' }}>*</span>
                </label>
                <input
                  id="manual-pay-amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  className="form-input"
                  placeholder="e.g. 250"
                  value={manualAmount}
                  onChange={(e) => setManualAmount(e.target.value)}
                  disabled={manualSubmitting}
                  required
                />
              </div>

              {/* Payment Method & Station in 2-column grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="manual-pay-method">
                    Payment Method
                  </label>
                  <select
                    id="manual-pay-method"
                    className="form-input"
                    value={manualPaymentMethod}
                    onChange={(e) => setManualPaymentMethod(e.target.value)}
                    disabled={manualSubmitting}
                  >
                    <option value="CASH">Cash</option>
                    <option value="UPI">UPI</option>
                    <option value="CARD">Card</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="manual-pay-station">
                    Station <span className="form-optional">(Optional)</span>
                  </label>
                  <select
                    id="manual-pay-station"
                    className="form-input"
                    value={manualStationId}
                    onChange={(e) => setManualStationId(e.target.value)}
                    disabled={manualSubmitting}
                  >
                    <option value="">Counter / None</option>
                    {stations.map((st) => (
                      <option key={st._id} value={st._id}>
                        {st.name} ({st.type})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Notes */}
              <div className="form-group">
                <label className="form-label" htmlFor="manual-pay-notes">
                  Notes / Description <span className="form-optional">(Optional)</span>
                </label>
                <input
                  id="manual-pay-notes"
                  type="text"
                  className="form-input"
                  placeholder="e.g. Counter walk-in session, extra time"
                  value={manualNotes}
                  onChange={(e) => setManualNotes(e.target.value)}
                  disabled={manualSubmitting}
                />
              </div>

              {manualError && <div className="form-error">{manualError}</div>}

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setShowManualModal(false)}
                  disabled={manualSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={manualSubmitting || !manualCustomerName.trim() || !manualCustomerPhone.trim() || !manualAmount}
                >
                  {manualSubmitting ? 'Recording...' : 'Record Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
