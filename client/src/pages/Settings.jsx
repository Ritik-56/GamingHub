import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { adminApi as api } from '../services/api';
import LocationPicker from '../components/LocationPicker';

export default function Settings() {
  const { currentCafe, currentRole, fetchCafes } = useAuth();
  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    pricePerHour: '',
  });
  const [location, setLocation] = useState({ lat: null, lng: null, address: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);

  const isOwnerOrManager = ['OWNER', 'MANAGER'].includes(currentRole);

  useEffect(() => {
    if (currentCafe) {
      setForm({
        name: currentCafe.name || '',
        phone: currentCafe.phone || '',
        email: currentCafe.email || '',
        pricePerHour: currentCafe.pricePerHour?.toString() || '100',
      });
      // Restore existing location if set
      const coords = currentCafe.location?.coordinates;
      if (coords?.length === 2) {
        setLocation({
          lat: coords[1],
          lng: coords[0],
          address: currentCafe.address || '',
        });
      } else {
        setLocation({ lat: null, lng: null, address: currentCafe.address || '' });
      }
    }
  }, [currentCafe]);

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setError('');
    setSuccess('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const payload = {
        ...form,
        pricePerHour: parseFloat(form.pricePerHour) || 100,
        address: location.address || '',
      };
      if (location.lat && location.lng) {
        payload.location = { type: 'Point', coordinates: [location.lng, location.lat] };
      }
      await api.put(`/cafes/${currentCafe._id}`, payload);
      await fetchCafes();
      setSuccess('Settings saved successfully.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page-section">
      <div className="page-section-header">
        <div>
          <h2 className="page-section-title">Café Settings</h2>
          <p className="page-section-subtitle">
            Manage your café configuration
          </p>
        </div>
      </div>

      {!isOwnerOrManager ? (
        <div className="page-section-empty">
          Only owners and managers can edit café settings.
        </div>
      ) : (
        <div className="settings-form-wrap">
          <form className="settings-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label" htmlFor="settings-name">Café Name</label>
              <input
                id="settings-name"
                className="form-input"
                type="text"
                name="name"
                value={form.name}
                onChange={handleChange}
                required
              />
            </div>

            {/* Location Picker */}
            <LocationPicker
              value={location}
              onChange={setLocation}
              disabled={saving}
            />

            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="settings-phone">Phone</label>
                <input
                  id="settings-phone"
                  className="form-input"
                  type="tel"
                  name="phone"
                  value={form.phone}
                  onChange={handleChange}
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="settings-email">Contact Email</label>
                <input
                  id="settings-email"
                  className="form-input"
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="settings-price">Default Price (₹/hour)</label>
              <input
                id="settings-price"
                className="form-input"
                type="number"
                name="pricePerHour"
                min="0"
                step="10"
                value={form.pricePerHour}
                onChange={handleChange}
              />
            </div>

            <div className="settings-info-card">
              <div className="settings-info-row">
                <span className="settings-info-label">Customer Link</span>
                <code className="settings-info-code">/cafe/{currentCafe?.slug}</code>
              </div>
              <div className="settings-info-row">
                <span className="settings-info-label">Station Types</span>
                <span className="settings-info-value">
                  {(currentCafe?.stationTypes || []).join(', ')}
                </span>
              </div>
              <div className="settings-info-row">
                <span className="settings-info-label">Currency</span>
                <span className="settings-info-value">{currentCafe?.currency || '₹'}</span>
              </div>
            </div>

            {error && <div className="form-error">{error}</div>}
            {success && <div className="form-success">{success}</div>}

            <button
              type="submit"
              className="btn btn-primary"
              disabled={saving}
              style={{ marginTop: 'var(--space-4)' }}
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
