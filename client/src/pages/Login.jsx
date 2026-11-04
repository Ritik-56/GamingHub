import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import heroImg from '../assets/hero-arena.jpg';

export default function Login() {
  const location = useLocation();
  const locationState = location.state || {};
  const searchParams = new URLSearchParams(location.search);
  const modeParam = searchParams.get('mode');

  const isCustomerContext =
    locationState.mode === 'customer' ||
    modeParam === 'customer' ||
    locationState.from?.startsWith('/cafe/');

  const [isRegister, setIsRegister] = useState(locationState.register === true);
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { login, register } = useAuth();
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
      const scope = isCustomerContext ? 'customer' : 'admin';
      if (isRegister) {
        await register(form.name, form.email, form.phone, form.password, scope);
      } else {
        await login(form.email, form.password, scope);
      }
      if (isCustomerContext) {
        const dest = locationState.from?.startsWith('/cafe/') ? locationState.from : '/';
        navigate(dest, { replace: true });
      } else {
        navigate('/dashboard', { replace: true });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const contextLabel = isCustomerContext ? 'Customer' : 'Owner / Staff';
  const contextIcon  = isCustomerContext ? '🎮' : '🏪';

  const photoQuote = isCustomerContext
    ? <>Book your station,<br /><span>start playing.</span></>
    : <>Manage your café,<br /><span>grow your business.</span></>;

  return (
    <div className="auth-page">
      {/* ── Left: photo panel ── */}
      <div className="auth-panel-photo">
        <img src={heroImg} alt="Gaming café" />
        <div className="auth-panel-photo-overlay">
          {/* Brand at top */}
          <div className="auth-panel-photo-brand">
            <div className="auth-brand-icon" style={{ cursor: 'pointer' }} onClick={() => navigate('/')}>
              🎮
            </div>
            <span className="auth-brand-text" style={{ cursor: 'pointer' }} onClick={() => navigate('/')}>
              Gaming Hub
            </span>
          </div>

          {/* Quote at bottom */}
          <div className="auth-panel-quote">{photoQuote}</div>
        </div>
      </div>

      {/* ── Right: form panel ── */}
      <div className="auth-panel-form">
        <div className="auth-container">
          {/* Mobile-only brand */}
          <div
            className="auth-brand"
            style={{ cursor: 'pointer', marginBottom: 'var(--space-8)', display: 'none' }}
            onClick={() => navigate('/')}
          >
            <div className="auth-brand-icon">🎮</div>
            <span className="auth-brand-text">Gaming Hub</span>
          </div>

          <div className="auth-header">
            {/* Context pill */}
            <div className="auth-context-pill">
              {contextIcon} {contextLabel}
            </div>

            <h1>{isRegister ? 'Create Account' : 'Welcome Back'}</h1>
            <p>
              {isRegister
                ? 'Set up your account to get started'
                : 'Sign in to continue to Gaming Hub'}
            </p>
          </div>

          <form className="auth-form" onSubmit={handleSubmit}>
            {isRegister && (
              <div className="form-group">
                <label className="form-label" htmlFor="auth-name">Full Name</label>
                <input
                  id="auth-name"
                  className="form-input"
                  type="text"
                  name="name"
                  placeholder="Your name"
                  value={form.name}
                  onChange={handleChange}
                  required
                  autoComplete="name"
                />
              </div>
            )}

            <div className="form-group">
              <label className="form-label" htmlFor="auth-email">Email Address</label>
              <input
                id="auth-email"
                className="form-input"
                type="email"
                name="email"
                placeholder="you@example.com"
                value={form.email}
                onChange={handleChange}
                required
                autoComplete="email"
              />
            </div>

            {isRegister && (
              <div className="form-group">
                <label className="form-label" htmlFor="auth-phone">
                  Phone <span className="form-optional">(optional)</span>
                </label>
                <input
                  id="auth-phone"
                  className="form-input"
                  type="tel"
                  name="phone"
                  placeholder="+91 9876543210"
                  value={form.phone}
                  onChange={handleChange}
                  autoComplete="tel"
                />
              </div>
            )}

            <div className="form-group">
              <label className="form-label" htmlFor="auth-password">Password</label>
              <input
                id="auth-password"
                className="form-input"
                type="password"
                name="password"
                placeholder={isRegister ? 'Min 6 characters' : 'Your password'}
                value={form.password}
                onChange={handleChange}
                required
                minLength={6}
                autoComplete={isRegister ? 'new-password' : 'current-password'}
              />
            </div>

            {error && <div className="form-error">⚠ {error}</div>}

            <button
              type="submit"
              className="btn btn-primary auth-submit"
              id="auth-submit-btn"
              disabled={submitting}
            >
              {submitting
                ? (isRegister ? 'Creating Account…' : 'Signing In…')
                : (isRegister ? 'Create Account' : 'Sign In')}
            </button>
          </form>

          {/* Toggle register/login */}
          <div className="auth-footer">
            <span className="auth-footer-text">
              {isRegister ? 'Already have an account?' : "Don't have an account?"}
            </span>
            <button
              type="button"
              className="auth-toggle"
              onClick={() => { setIsRegister(!isRegister); setError(''); }}
            >
              {isRegister ? 'Sign In' : 'Create Account'}
            </button>
          </div>

          {/* Back + switch context */}
          <div className="auth-back-link">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => navigate('/')}
            >
              ← Back to Cafés
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() =>
                navigate('/login', {
                  state: {
                    mode: isCustomerContext ? 'owner' : 'customer',
                    from: locationState.from,
                  },
                })
              }
            >
              {isCustomerContext ? '🏪 Owner Login' : '🎮 Customer Login'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
