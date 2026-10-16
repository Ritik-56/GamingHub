import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const location = useLocation();
  const locationState = location.state || {};

  // Determine context: customer flow vs owner/admin flow.
  // Also supports ?mode=owner in the URL (used by AdminRoute redirect).
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

      let result;
      if (isRegister) {
        result = await register(form.name, form.email, form.phone, form.password, scope);
      } else {
        result = await login(form.email, form.password, scope);
      }

      if (isCustomerContext) {
        // Customer: always return to the global landing page (or explicitly
        // provided `from` destination if it is a café page).
        const dest = locationState.from?.startsWith('/cafe/')
          ? locationState.from
          : '/';
        navigate(dest, { replace: true });
      } else {
        // Owner / admin: the login() call already awaited fetchCafes() so
        // we read the cafes from the result value rather than stale React state.
        // We rely on the route guards (RequireCafe / SetupRoute) to decide the
        // exact destination — just navigate to /dashboard and let them handle it.
        navigate('/dashboard', { replace: true });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const contextLabel = isCustomerContext ? 'Customer' : 'Owner / Staff';
  const contextIcon = isCustomerContext ? '🎮' : '🏪';

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-header">
          <div className="auth-brand">
            <div
              className="auth-brand-icon"
              style={{ cursor: 'pointer' }}
              onClick={() => navigate('/')}
              title="Back to homepage"
            >
              🎮
            </div>
            <span
              className="auth-brand-text"
              style={{ cursor: 'pointer' }}
              onClick={() => navigate('/')}
            >
              Gaming Hub
            </span>
          </div>
          <div className="auth-context-badge" style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.25rem 0.75rem',
            background: 'var(--color-bg-card)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-full)',
            fontSize: 'var(--font-size-xs)',
            color: 'var(--color-text-secondary)',
            marginBottom: 'var(--space-4)',
          }}>
            {contextIcon} {contextLabel}
          </div>
          <h1>{isRegister ? 'Create Account' : 'Welcome Back'}</h1>
          <p>{isRegister ? 'Set up your account to get started' : 'Sign in to your account'}</p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          {isRegister && (
            <div className="form-group">
              <label className="form-label" htmlFor="auth-name">Name</label>
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
            <label className="form-label" htmlFor="auth-email">Email</label>
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

          {error && <div className="form-error">{error}</div>}

          <button
            type="submit"
            className="btn btn-primary auth-submit"
            id="auth-submit-btn"
            disabled={submitting}
          >
            {submitting
              ? (isRegister ? 'Creating Account...' : 'Signing In...')
              : (isRegister ? 'Create Account' : 'Sign In')}
          </button>
        </form>

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

        <div style={{ textAlign: 'center', marginTop: 'var(--space-4)' }}>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => navigate('/')}
          >
            ← Back to Cafés
          </button>
          {/* Switch context */}
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            style={{ marginLeft: 'var(--space-2)' }}
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
  );
}
