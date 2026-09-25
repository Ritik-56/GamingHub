import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

export default function StationManagement() {
  const { currentCafe } = useAuth();
  const [stations, setStations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Add/edit form
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ name: '', type: 'PS5', pricePerHour: '' });
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

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

  if (loading) return <div className="page-section-empty">Loading stations...</div>;

  return (
    <div className="page-section">
      <div className="page-section-header">
        <div>
          <h2 className="page-section-title">Stations</h2>
          <p className="page-section-subtitle">{stations.length} total stations</p>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>+ Add Station</button>
      </div>

      {error && <div className="form-error">{error}</div>}

      {showForm && (
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
        </div>
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
