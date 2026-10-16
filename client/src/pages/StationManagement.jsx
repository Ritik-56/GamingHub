import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../context/AuthContext';
import { adminApi as api } from '../services/api';

export default function StationManagement() {
  const { currentCafe } = useAuth();
  const [stations, setStations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Add/edit station form
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ name: '', type: 'PS5', pricePerHour: '' });
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  // Manual session creation state (Walk-in customer)
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [selectedStationId, setSelectedStationId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [controllersCount, setControllersCount] = useState(1);
  const [sessionError, setSessionError] = useState('');
  const [startingSession, setStartingSession] = useState(false);

  const fetchStations = useCallback(async () => {
    if (!currentCafe) return;
    try {
      const res = await api.get(`/cafes/${currentCafe._id}/stations`);
      setStations(res.data.data.stations);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [currentCafe]);

  useEffect(() => {
    fetchStations();
  }, [fetchStations]);

  const openAdd = () => {
    setEditingId(null);
    setForm({ name: '', type: 'PS5', pricePerHour: '' });
    setFormError('');
    setShowForm(true);
  };

  const openEdit = (station) => {
    setEditingId(station._id);
    setForm({
      name: station.name,
      type: station.type,
      pricePerHour: station.pricePerHour ?? '',
    });
    setFormError('');
    setShowForm(true);
  };

  const openStartSession = (station = null) => {
    const availableStations = stations.filter((s) => s.status === 'AVAILABLE' && s.isActive);
    const stationIdToSelect = station ? station._id : (availableStations[0]?._id || '');

    setSelectedStationId(stationIdToSelect);
    setCustomerName('');
    setCustomerPhone('');
    setControllersCount(1);
    setSessionError('');
    setShowSessionModal(true);
  };

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setFormError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setFormError('');

    try {
      const payload = {
        name: form.name,
        type: form.type,
        pricePerHour: form.pricePerHour ? parseFloat(form.pricePerHour) : null,
      };

      if (editingId) {
        await api.put(`/cafes/${currentCafe._id}/stations/${editingId}`, payload);
      } else {
        await api.post(`/cafes/${currentCafe._id}/stations`, payload);
      }

      setShowForm(false);
      await fetchStations();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleStartSessionSubmit = async (e) => {
    e.preventDefault();
    if (!selectedStationId) {
      setSessionError('Please select a station.');
      return;
    }
    if (!customerName.trim()) {
      setSessionError('Please enter customer name.');
      return;
    }
    if (!customerPhone.trim()) {
      setSessionError('Please enter customer phone number.');
      return;
    }

    setStartingSession(true);
    setSessionError('');

    try {
      const res = await api.post(`/cafes/${currentCafe._id}/sessions/manual`, {
        stationId: selectedStationId,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        controllersRequested: parseInt(controllersCount, 10),
      });

      const startedStationName = res.data.data.session?.station?.name || 'Station';
      setSuccessMsg(`Session started successfully for ${customerName.trim()} on ${startedStationName}! Station is now OCCUPIED.`);
      setTimeout(() => setSuccessMsg(''), 6000);

      setShowSessionModal(false);
      await fetchStations();
    } catch (err) {
      setSessionError(err.message);
    } finally {
      setStartingSession(false);
    }
  };

  const toggleStatus = async (station) => {
    const newStatus = station.status === 'MAINTENANCE' ? 'AVAILABLE' : 'MAINTENANCE';
    try {
      await api.patch(`/cafes/${currentCafe._id}/stations/${station._id}/status`, { status: newStatus });
      await fetchStations();
    } catch (err) {
      setError(err.message);
    }
  };

  const toggleActive = async (station) => {
    try {
      await api.put(`/cafes/${currentCafe._id}/stations/${station._id}`, { isActive: !station.isActive });
      await fetchStations();
    } catch (err) {
      setError(err.message);
    }
  };

  const statusClass = (status) => {
    const map = {
      AVAILABLE: 'status--available',
      REQUESTED: 'status--requested',
      OCCUPIED: 'status--occupied',
      PAYMENT_PENDING: 'status--payment',
      MAINTENANCE: 'status--maintenance',
    };
    return map[status] || '';
  };

  const availableStations = stations.filter((s) => s.status === 'AVAILABLE' && s.isActive);
  const selectedStationObj = stations.find((s) => s._id === selectedStationId);

  if (loading) return <div className="page-section-empty">Loading stations...</div>;

  return (
    <div className="page-section">
      <div className="page-section-header">
        <div>
          <h2 className="page-section-title">Stations</h2>
          <p className="page-section-subtitle">
            {stations.length} total stations • {availableStations.length} available
          </p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          {availableStations.length > 0 && (
            <button className="btn btn-primary" onClick={() => openStartSession()}>
              + Create Session
            </button>
          )}
          <button className="btn btn-ghost" onClick={openAdd}>
            + Add Station
          </button>
        </div>
      </div>

      {error && <div className="form-error" style={{ marginBottom: 'var(--space-4)' }}>{error}</div>}
      {successMsg && (
        <div className="card" style={{ padding: 'var(--space-3) var(--space-4)', marginBottom: 'var(--space-4)', borderColor: 'var(--color-success)', color: 'var(--color-success)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <span>✓</span> {successMsg}
        </div>
      )}

      {/* Add / Edit Station Modal */}
      {showForm && createPortal(
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">{editingId ? 'Edit Station' : 'Add Station'}</h3>
            <form className="modal-form" onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label" htmlFor="station-name">Station Name</label>
                <input
                  id="station-name"
                  className="form-input"
                  name="name"
                  placeholder="e.g. PS-01"
                  value={form.name}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="station-type">Type</label>
                <select
                  id="station-type"
                  className="form-input"
                  name="type"
                  value={form.type}
                  onChange={handleChange}
                >
                  {(currentCafe?.stationTypes || ['PS5', 'Xbox', 'PC']).map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="station-price">
                  Price (₹/hr) <span className="form-optional">blank = café default</span>
                </label>
                <input
                  id="station-price"
                  className="form-input"
                  name="pricePerHour"
                  type="number"
                  min="0"
                  step="10"
                  placeholder={`${currentCafe?.pricePerHour || 100}`}
                  value={form.pricePerHour}
                  onChange={handleChange}
                />
              </div>

              {formError && <div className="form-error">{formError}</div>}

              <div className="modal-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving...' : (editingId ? 'Update' : 'Add Station')}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Manual Session Creation Modal (Walk-in Customer) */}
      {showSessionModal && createPortal(
        <div className="modal-overlay" onClick={() => setShowSessionModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Create Gaming Session</h3>
            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-4)' }}>
              Start an active session for a walk-in counter customer.
            </p>

            <form className="modal-form" onSubmit={handleStartSessionSubmit}>
              {/* Customer Name */}
              <div className="form-group">
                <label className="form-label" htmlFor="manual-customer-name">Customer Name</label>
                <input
                  id="manual-customer-name"
                  className="form-input"
                  type="text"
                  placeholder="e.g. Rahul Sharma"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  required
                />
              </div>

              {/* Customer Phone */}
              <div className="form-group">
                <label className="form-label" htmlFor="manual-customer-phone">Customer Phone</label>
                <input
                  id="manual-customer-phone"
                  className="form-input"
                  type="tel"
                  placeholder="e.g. 9876543210"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  required
                />
              </div>

              {/* Station Selection */}
              <div className="form-group">
                <label className="form-label" htmlFor="manual-station">Select Station</label>
                <select
                  id="manual-station"
                  className="form-input"
                  value={selectedStationId}
                  onChange={(e) => setSelectedStationId(e.target.value)}
                  required
                >
                  {availableStations.length === 0 ? (
                    <option value="" disabled>No available stations</option>
                  ) : (
                    availableStations.map((s) => (
                      <option key={s._id} value={s._id}>
                        {s.name} ({s.type}) — ₹{s.effectivePrice}/hr
                      </option>
                    ))
                  )}
                </select>
              </div>

              {/* Controller Count Selection */}
              <div className="form-group">
                <label className="form-label" htmlFor="manual-controllers">
                  Number of Controllers <span className="form-optional">₹100/hr per controller</span>
                </label>
                <select
                  id="manual-controllers"
                  className="form-input"
                  value={controllersCount}
                  onChange={(e) => setControllersCount(Number(e.target.value))}
                >
                  <option value={1}>1 Controller (₹100/hr)</option>
                  <option value={2}>2 Controllers (₹200/hr)</option>
                  <option value={3}>3 Controllers (₹300/hr)</option>
                  <option value={4}>4 Controllers (₹400/hr)</option>
                </select>
              </div>

              {/* Pricing & Rate Summary */}
              {selectedStationObj && (
                <div
                  className="card"
                  style={{
                    padding: 'var(--space-3)',
                    background: 'var(--color-surface-hover)',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: 'var(--font-size-sm)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-1)' }}>
                    <span style={{ color: 'var(--color-text-muted)' }}>Station Rate:</span>
                    <span className="td-bold">₹{selectedStationObj.effectivePrice}/hr</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-1)' }}>
                    <span style={{ color: 'var(--color-text-muted)' }}>Controller Rate:</span>
                    <span className="td-bold">₹{controllersCount * 100}/hr ({controllersCount} × ₹100/hr)</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--color-border)', paddingTop: 'var(--space-1)', marginTop: 'var(--space-1)' }}>
                    <span style={{ color: 'var(--color-text-muted)' }}>Initial State:</span>
                    <span className="badge status--occupied">ACTIVE immediately</span>
                  </div>
                </div>
              )}

              {sessionError && <div className="form-error">{sessionError}</div>}

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setShowSessionModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={startingSession || availableStations.length === 0 || !customerName.trim() || !customerPhone.trim()}
                >
                  {startingSession ? 'Starting...' : 'Start Session'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {stations.length === 0 ? (
        <div className="page-section-empty">
          No stations yet. Add your first gaming station to get started.
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Price/hr</th>
                <th>Status</th>
                <th>Active</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {stations.map((s) => (
                <tr key={s._id} className={!s.isActive ? 'row-disabled' : ''}>
                  <td className="td-bold">{s.name}</td>
                  <td>
                    <span className="badge badge-type">{s.type}</span>
                  </td>
                  <td>₹{s.effectivePrice}</td>
                  <td>
                    <span className={`badge ${statusClass(s.status)}`}>
                      {s.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td>
                    <button
                      className={`toggle-btn ${s.isActive ? 'toggle-on' : 'toggle-off'}`}
                      onClick={() => toggleActive(s)}
                      title={s.isActive ? 'Disable station' : 'Enable station'}
                    >
                      {s.isActive ? 'On' : 'Off'}
                    </button>
                  </td>
                  <td className="td-actions">
                    {s.status === 'AVAILABLE' && s.isActive && (
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => openStartSession(s)}
                        title="Start manual session for a walk-in customer"
                      >
                        Start Session
                      </button>
                    )}
                    <button className="btn btn-ghost btn-sm" onClick={() => openEdit(s)}>
                      Edit
                    </button>
                    {['AVAILABLE', 'MAINTENANCE'].includes(s.status) && (
                      <button className="btn btn-ghost btn-sm" onClick={() => toggleStatus(s)}>
                        {s.status === 'MAINTENANCE' ? 'Set Available' : 'Maintenance'}
                      </button>
                    )}
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

