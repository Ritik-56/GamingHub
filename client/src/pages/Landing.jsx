import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { publicApi as api } from '../services/api';

export default function Landing() {
  const navigate = useNavigate();
  const [cafes, setCafes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const debounceTimer = useRef(null);

  const fetchCafes = useCallback(async (q = '') => {
    try {
      setLoading(true);
      const params = q ? `?search=${encodeURIComponent(q)}` : '';
      const res = await api.get(`/cafes/public${params}`);
      setCafes(res.data.data.cafes || []);
    } catch {
      setCafes([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCafes();
  }, [fetchCafes]);

  const handleSearch = (e) => {
    const val = e.target.value;
    setSearch(val);
    clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      setDebouncedSearch(val);
    }, 400);
  };

  useEffect(() => {
    fetchCafes(debouncedSearch);
  }, [debouncedSearch, fetchCafes]);

  return (
    <div className="landing-page">
      {/* Header */}
      <header className="landing-header">
        <div className="landing-header-inner">
          <div className="auth-brand">
            <div className="auth-brand-icon">🎮</div>
            <span className="auth-brand-text">Gaming Hub</span>
          </div>
          <div className="landing-header-actions">
            <button
              className="btn btn-ghost btn-sm"
              id="landing-customer-login"
              onClick={() => navigate('/login', { state: { mode: 'customer' } })}
            >
              Customer Login
            </button>
            <button
              className="btn btn-primary btn-sm"
              id="landing-owner-login"
              onClick={() => navigate('/login', { state: { mode: 'owner' } })}
            >
              Owner Login
            </button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="landing-hero">
        <div className="landing-hero-inner">
          <div className="landing-hero-badge">
            <span className="status-dot online" />
            The Gaming Café Platform
          </div>
          <h1 className="landing-title">
            Find Your <span className="landing-title-accent">Gaming Café</span>
          </h1>
          <p className="landing-subtitle">
            Discover gaming cafés near you, book a station and play — all in one place.
          </p>

          {/* Search */}
          <div className="landing-search-wrap">
            <span className="landing-search-icon">🔍</span>
            <input
              id="landing-search"
              className="landing-search-input"
              type="text"
              placeholder="Search by café name or location..."
              value={search}
              onChange={handleSearch}
              autoComplete="off"
            />
          </div>

          {/* Owner CTA */}
          <div className="landing-cta-row">
            <span className="landing-cta-text">Own a gaming café?</span>
            <button
              className="btn btn-accent"
              id="landing-register-cafe"
              onClick={() => navigate('/login', { state: { mode: 'owner', register: true } })}
            >
              Register Your Café →
            </button>
          </div>
        </div>
      </section>

      {/* Café Listing */}
      <section className="landing-cafes">
        <div className="landing-cafes-inner">
          <div className="landing-cafes-header">
            <h2>
              {search ? `Results for "${search}"` : 'All Gaming Cafés'}
            </h2>
            {!loading && (
              <span className="landing-cafes-count">{cafes.length} café{cafes.length !== 1 ? 's' : ''}</span>
            )}
          </div>

          {loading ? (
            <div className="landing-cafes-loading">
              <div className="landing-loading-spinner" />
              Loading cafés...
            </div>
          ) : cafes.length === 0 ? (
            <div className="landing-cafes-empty">
              <div className="landing-empty-icon">🎮</div>
              <p>{search ? 'No cafés match your search.' : 'No cafés registered yet. Be the first!'}</p>
              <button
                className="btn btn-primary"
                onClick={() => navigate('/login', { state: { mode: 'owner', register: true } })}
              >
                Register Your Café
              </button>
            </div>
          ) : (
            <div className="landing-cafe-grid">
              {cafes.map((cafe) => (
                <CafeCard key={cafe._id} cafe={cafe} onVisit={() => navigate(`/cafe/${cafe.slug}`)} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="landing-footer-inner">
          <div className="auth-brand">
            <div className="auth-brand-icon">🎮</div>
            <span className="auth-brand-text">Gaming Hub</span>
          </div>
          <p className="landing-footer-text">The platform for gaming café owners and players.</p>
          <div className="landing-footer-links">
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/login', { state: { mode: 'owner' } })}>
              Owner Portal
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/login', { state: { mode: 'customer' } })}>
              Customer Login
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}

function CafeCard({ cafe, onVisit }) {
  const typeIcons = { PS5: '🎮', Xbox: '🕹️', PC: '💻' };

  return (
    <div className="landing-cafe-card card" id={`cafe-card-${cafe.slug}`}>
      <div className="landing-cafe-card-header">
        <div className="landing-cafe-card-icon">🎮</div>
        <div className="landing-cafe-card-meta">
          <h3 className="landing-cafe-card-name">{cafe.name}</h3>
          {cafe.address && (
            <span className="landing-cafe-card-location">
              📍 {cafe.address}
            </span>
          )}
        </div>
      </div>

      {(cafe.stationTypes?.length > 0) && (
        <div className="landing-cafe-card-types">
          {cafe.stationTypes.map((t) => (
            <span key={t} className="badge badge-type">
              {typeIcons[t] || '🎯'} {t}
            </span>
          ))}
        </div>
      )}

      <div className="landing-cafe-card-footer">
        <div className="landing-cafe-card-price">
          <span className="landing-cafe-price-label">From</span>
          <span className="landing-cafe-price-value">
            {cafe.currency || '₹'}{cafe.pricePerHour}/hr
          </span>
        </div>
        <button
          className="btn btn-primary btn-sm"
          onClick={onVisit}
        >
          View Café →
        </button>
      </div>
    </div>
  );
}
