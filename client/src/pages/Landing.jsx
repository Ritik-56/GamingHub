import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { publicApi as api } from '../services/api';
import heroImg from '../assets/hero-arena.jpg';
import cafeCoverImg from '../assets/cafe-cover.jpg';

export default function Landing() {
  const navigate = useNavigate();

  const [cafes, setCafes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [location, setLocation] = useState('');
  const debounceTimer = useRef(null);

  const locations = Array.from(
    new Set(
      cafes
        .map((c) => (c.address || '').split(',').pop().trim())
        .filter(Boolean)
    )
  ).slice(0, 7);

  const shown = location
    ? cafes.filter((c) =>
        (c.address || '').toLowerCase().includes(location.toLowerCase())
      )
    : cafes;

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

  useEffect(() => { fetchCafes(); }, [fetchCafes]);

  const handleSearch = (e) => {
    const val = e.target.value;
    setSearch(val);
    setLocation('');
    clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => setDebouncedSearch(val), 400);
  };

  useEffect(() => { fetchCafes(debouncedSearch); }, [debouncedSearch, fetchCafes]);
  useEffect(() => () => clearTimeout(debounceTimer.current), []);

  const scrollToSection = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="landing-page">

      {/* ── Navbar ── */}
      <header className="landing-header">
        <div className="landing-header-inner">
          {/* Brand */}
          <div className="auth-brand" style={{ cursor: 'pointer' }} onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <div className="auth-brand-icon">🎮</div>
            <span className="auth-brand-text">Gaming Hub</span>
          </div>

          {/* Center nav links */}
          <nav className="landing-nav-links">
            <button className="landing-nav-link" onClick={() => scrollToSection('cafes-section')}>
              Cafés
            </button>
            <button className="landing-nav-link" onClick={() => scrollToSection('how-it-works')}>
              How it Works
            </button>
            <button className="landing-nav-link" onClick={() => navigate('/login', { state: { mode: 'owner' } })}>
              For Owners
            </button>
          </nav>

          {/* Auth buttons */}
          <div className="landing-header-actions">
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => navigate('/login', { state: { mode: 'customer' } })}
            >
              Customer Login
            </button>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => navigate('/login', { state: { mode: 'owner' } })}
            >
              Owner Login
            </button>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="landing-hero">
        <img
          className="landing-hero-img"
          src={heroImg}
          alt="Gaming café arena"
          width={1920}
          height={1088}
        />
        <div className="landing-hero-scrim" />

        <div className="landing-hero-inner">
          {/* Badge */}
          <div className="landing-hero-badge">
            <span className="status-dot online" />
            The Gaming Café Platform
          </div>

          {/* Title */}
          <h1 className="landing-title">
            Find Your
            <span className="landing-title-accent">Gaming Café</span>
          </h1>

          <p className="landing-subtitle">
            Discover gaming cafés near you, book a station
            and play — all in one place.
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

          {/* Location chips */}
          {locations.length > 0 && (
            <div className="landing-location-chips">
              <button
                className={`chip ${!location ? 'active' : ''}`}
                onClick={() => setLocation('')}
              >
                All Locations
              </button>
              {locations.map((l) => (
                <button
                  key={l}
                  className={`chip ${location === l ? 'active' : ''}`}
                  onClick={() => setLocation(l)}
                >
                  📍 {l}
                </button>
              ))}
            </div>
          )}

          {/* CTA row */}
          <div className="landing-cta-row">
            <button
              className="btn btn-ghost"
              onClick={() =>
                navigate('/login', { state: { mode: 'customer', register: true } })
              }
            >
              Join as a Player
            </button>
            <button
              className="btn btn-primary"
              id="landing-register-cafe"
              onClick={() =>
                navigate('/login', { state: { mode: 'owner', register: true } })
              }
            >
              Register Your Café →
            </button>
          </div>
        </div>
      </section>

      {/* ── How it Works ── */}
      <section id="how-it-works" style={{
        padding: 'var(--space-16) var(--space-8)',
        background: 'var(--color-bg-secondary)',
        borderTop: '1px solid var(--color-border)',
        borderBottom: '1px solid var(--color-border)',
      }}>
        <div style={{ maxWidth: 'var(--max-content-w)', margin: '0 auto' }}>
          <span className="section-eyebrow">Simple Steps</span>
          <h2 style={{
            fontSize: 'var(--font-size-3xl)',
            fontWeight: 'var(--font-weight-bold)',
            marginBottom: 'var(--space-10)',
            letterSpacing: '-0.02em',
          }}>
            How it Works
          </h2>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 'var(--space-6)',
          }}>
            {[
              { icon: '🔍', step: '01', title: 'Find a Café', desc: 'Browse all gaming cafés near you. Filter by location and game type.' },
              { icon: '🎮', step: '02', title: 'Pick a Station', desc: 'Choose from PS5, Xbox, or PC stations. See real-time availability.' },
              { icon: '⏱️', step: '03', title: 'Start Playing', desc: 'Your session starts instantly. Live timer tracks your usage.' },
              { icon: '💳', step: '04', title: 'Pay & Go', desc: 'Pay only for what you use. Transparent per-hour billing.' },
            ].map((item) => (
              <div key={item.step} style={{
                background: 'var(--color-bg-card)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-lg)',
                padding: 'var(--space-6)',
              }}>
                <div style={{
                  fontSize: 'var(--font-size-xs)',
                  fontWeight: 'var(--font-weight-bold)',
                  color: 'var(--color-accent)',
                  letterSpacing: '0.08em',
                  marginBottom: 'var(--space-3)',
                }}>
                  STEP {item.step}
                </div>
                <div style={{ fontSize: '2rem', marginBottom: 'var(--space-3)' }}>{item.icon}</div>
                <h3 style={{
                  fontSize: 'var(--font-size-lg)',
                  fontWeight: 'var(--font-weight-bold)',
                  marginBottom: 'var(--space-2)',
                }}>
                  {item.title}
                </h3>
                <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', lineHeight: 'var(--line-height-relaxed)' }}>
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Café Listing ── */}
      <section id="cafes-section" className="landing-cafes">
        <div className="landing-cafes-inner">
          <span className="section-eyebrow">Discover</span>

          <div className="landing-cafes-header">
            <h2>
              {search ? `Results for "${search}"` : 'All Gaming Cafés'}
            </h2>
            {!loading && (
              <span className="landing-cafes-count">
                {shown.length} café{shown.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          {loading ? (
            <div className="landing-cafes-loading">
              <div className="landing-loading-spinner" />
              Loading cafés...
            </div>
          ) : shown.length === 0 ? (
            <div className="landing-cafes-empty">
              <div className="landing-empty-icon">🎮</div>
              <p>
                {search
                  ? `No cafés match "${search}". Try a different search.`
                  : 'No cafés registered yet. Be the first!'}
              </p>
              <button
                className="btn btn-primary"
                onClick={() =>
                  navigate('/login', { state: { mode: 'owner', register: true } })
                }
              >
                Register Your Café
              </button>
            </div>
          ) : (
            <div className="landing-cafe-grid">
              {shown.map((cafe) => (
                <CafeCard
                  key={cafe._id}
                  cafe={cafe}
                  coverImg={cafeCoverImg}
                  onVisit={() => navigate(`/cafe/${cafe.slug}`)}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="landing-footer">
        <div className="landing-footer-inner">
          <div>
            <div className="auth-brand" style={{ marginBottom: 'var(--space-2)' }}>
              <div className="auth-brand-icon">🎮</div>
              <span className="auth-brand-text">Gaming Hub</span>
            </div>
            <p className="landing-footer-text">
              The platform for gaming café owners and players.
            </p>
          </div>

          <div className="landing-footer-links">
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => navigate('/login', { state: { mode: 'owner' } })}
            >
              Owner Portal
            </button>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => navigate('/login', { state: { mode: 'customer' } })}
            >
              Customer Login
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ── Café Card ── */
function CafeCard({ cafe, coverImg, onVisit }) {
  const typeIcons = { PS5: '🎮', Xbox: '🕹️', PC: '💻' };

  return (
    <div
      className="landing-cafe-card"
      id={`cafe-card-${cafe.slug}`}
    >
      {/* Thumbnail */}
      <div className="landing-cafe-card-thumbnail">
        <img src={coverImg} alt={cafe.name} />
        <div className="landing-cafe-card-thumbnail-overlay" />
      </div>

      {/* Body */}
      <div className="landing-cafe-card-body">
        <div>
          <h3 className="landing-cafe-card-name">{cafe.name}</h3>
          {cafe.address && (
            <div className="landing-cafe-card-location">
              📍 {cafe.address}
            </div>
          )}
        </div>

        {cafe.stationTypes?.length > 0 && (
          <div className="landing-cafe-card-types">
            {cafe.stationTypes.map((t) => (
              <span key={t} className="badge badge-type">
                {typeIcons[t] || '🎯'} {t}
              </span>
            ))}
          </div>
        )}

        <div className="landing-cafe-card-footer">
          <div>
            <span className="landing-cafe-price-label">From</span>
            <span className="landing-cafe-price-value">
              {cafe.currency || '₹'}{cafe.pricePerHour}/hr
            </span>
          </div>
          <button className="btn btn-primary btn-sm" onClick={onVisit}>
            View Café →
          </button>
        </div>
      </div>
    </div>
  );
}
