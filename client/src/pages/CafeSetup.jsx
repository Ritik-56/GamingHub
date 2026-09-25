import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

export default function CafeSetup() {
  const [form, setForm] = useState({
    name: '',
    address: '',
    phone: '',
    email: '',
    pricePerHour: '100',
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { fetchCafes } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      await api.post('/cafes', {
        ...form,
        pricePerHour: parseFloat(form.pricePerHour) || 100,
      });
      await fetchCafes();
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-container" style={{ maxWidth: '480px' }}>
        <div className="auth-header">
          <div className="auth-brand">
            <div className="auth-brand-icon">🎮</div>
            <span className="auth-brand-text">Gaming Hub</span>
          </div>
          <h1>Set Up Your Café</h1>
          <p>Configure your gaming café to get started</p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="cafe-name">Café Name</label>
            <input
              id="cafe-name"
              className="form-input"
              type="text"
              name="name"
              placeholder="e.g. GameZone Arena"
              value={form.name}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="cafe-address">Address</label>
            <input
              id="cafe-address"
              className="form-input"
              type="text"
              name="address"
              placeholder="Full address"
              value={form.address}
              onChange={handleChange}
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="cafe-phone">Phone</label>
              <input
                id="cafe-phone"
                className="form-input"
                type="tel"
                name="phone"
                placeholder="+91 9876543210"
                value={form.phone}
                onChange={handleChange}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="cafe-email">Contact Email</label>
              <input
                id="cafe-email"
                className="form-input"
                type="email"
                name="email"
                placeholder="cafe@example.com"
                value={form.email}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="cafe-price">Default Price (₹/hour)</label>
            <input
              id="cafe-price"
              className="form-input"
              type="number"
              name="pricePerHour"
              min="0"
              step="10"
              value={form.pricePerHour}
              onChange={handleChange}
            />
          </div>

          {error && <div className="form-error">{error}</div>}

          <button
            type="submit"
            className="btn btn-primary auth-submit"
            disabled={submitting}
          >
            {submitting ? 'Creating Café...' : 'Create Café'}
          </button>
        </form>
      </div>
    </div>
  );
}
