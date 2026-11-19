import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { customerApi } from '../services/api';

function fmt(minutes) {
  if (minutes == null) return '—';
  const h = Math.floor(minutes / 60), m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function CustomerDashboard() {
  const navigate = useNavigate();
  const { customerUser, isCustomerAuthenticated, loading: authLoading, logout } = useAuth();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('history'); // history | rewards

  useEffect(() => {
    if (authLoading) return;
    if (!isCustomerAuthenticated) { navigate('/login?mode=customer', { replace: true }); return; }
    customerApi.get('/rewards/dashboard')
      .then((res) => setData(res.data.data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [authLoading, isCustomerAuthenticated, navigate]);

  if (authLoading || loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-bg-primary)' }}>
      <div className="spinner" />
    </div>
  );

  const { stats, history, rewards } = data || { stats: {}, history: [], rewards: [] };
  const initials = customerUser?.name?.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?';
  const totalHours = stats.totalMinutes ? (stats.totalMinutes / 60).toFixed(1) : '0';

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg-primary)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-family)' }}>

      {/* ── Topbar ── */}
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: 'var(--space-4) var(--space-6)',
        borderBottom: '1px solid var(--color-border)',
        background: 'var(--color-bg-secondary)',
        position: 'sticky', top: 0, zIndex: 10,
      }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/')}>
          🎮 Gaming Hub
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>{customerUser?.email}</span>
          <button className="btn btn-ghost btn-sm" onClick={() => { logout('customer'); navigate('/'); }}>
            Sign Out
          </button>
        </div>
      </header>

      <div style={{ maxWidth: '900px', margin: '0 auto', padding: 'var(--space-8) var(--space-4)' }}>

        {error && <div className="form-error" style={{ marginBottom: 'var(--space-6)' }}>{error}</div>}

        {/* ── Profile Ring Card ── */}
        <div style={{
          background: 'var(--color-bg-card)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-xl, 16px)',
          padding: 'var(--space-8)',
          marginBottom: 'var(--space-6)',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-8)',
          flexWrap: 'wrap',
        }}>
          {/* Avatar ring */}
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <svg width="96" height="96" viewBox="0 0 96 96" style={{ transform: 'rotate(-90deg)' }}>
              <circle cx="48" cy="48" r="42" fill="none" stroke="var(--color-border)" strokeWidth="6" />
              <circle
                cx="48" cy="48" r="42"
                fill="none"
                stroke="var(--color-accent)"
                strokeWidth="6"
                strokeDasharray={`${2 * Math.PI * 42}`}
                strokeDashoffset={`${2 * Math.PI * 42 * (1 - Math.min((stats.totalSessions || 0) / 20, 1))}`}
                strokeLinecap="round"
              />
            </svg>
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 'var(--font-size-xl)',
              fontWeight: 'var(--font-weight-bold)',
              color: 'var(--color-accent)',
              background: 'var(--color-bg-card)',
              borderRadius: '50%',
              margin: '8px',
            }}>
              {initials}
            </div>
          </div>

          {/* Name + email */}
          <div style={{ flex: '1 1 180px' }}>
            <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', marginBottom: 'var(--space-1)' }}>
              {customerUser?.name}
            </div>
            <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>{customerUser?.email}</div>
            {customerUser?.phone && (
              <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>{customerUser.phone}</div>
            )}
          </div>

          {/* Stats pills */}
          <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
            {[
              { label: 'Sessions', value: stats.totalSessions ?? 0, icon: '🎮' },
              { label: 'Hours', value: totalHours, icon: '⏱️' },
              { label: 'Points', value: stats.totalPoints ?? 0, icon: '🏆' },
            ].map((s) => (
              <div key={s.label} style={{
                background: 'var(--color-bg-tertiary)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-lg, 12px)',
                padding: 'var(--space-4) var(--space-5)',
                textAlign: 'center',
                minWidth: '90px',
              }}>
                <div style={{ fontSize: '1.4rem', marginBottom: 'var(--space-1)' }}>{s.icon}</div>
                <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-accent)' }}>{s.value}</div>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: 'var(--space-1)' }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Tabs ── */}
        <div className="tab-group" style={{ marginBottom: 'var(--space-6)' }}>
          <button className={`tab-btn ${tab === 'history' ? 'tab-active' : ''}`} onClick={() => setTab('history')}>
            Gaming History
          </button>
          <button className={`tab-btn ${tab === 'rewards' ? 'tab-active' : ''}`} onClick={() => setTab('rewards')}>
            Reward Points {stats.totalPoints > 0 && <span className="badge badge-accent" style={{ marginLeft: 'var(--space-2)' }}>{stats.totalPoints}</span>}
          </button>
        </div>

        {/* ── Gaming History ── */}
        {tab === 'history' && (
          history.length === 0 ? (
            <div className="page-section-empty">
              <div style={{ fontSize: '2rem', marginBottom: 'var(--space-3)' }}>🎮</div>
              <p>No gaming sessions yet. Visit a café to start playing!</p>
              <button className="btn btn-primary" onClick={() => navigate('/')}>Browse Cafés</button>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Café</th>
                    <th>Date</th>
                    <th>Duration</th>
                    <th>Controllers</th>
                    <th>Amount Paid</th>
                    <th>Points</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((h, i) => (
                    <tr key={h.paymentId}>
                      <td style={{ color: 'var(--color-text-muted)' }}>{i + 1}</td>
                      <td className="td-bold">{h.cafe?.name || '—'}</td>
                      <td>{fmtDate(h.date)}</td>
                      <td>{fmt(h.durationMinutes)}</td>
                      <td>{h.controllers ?? '—'}</td>
                      <td className="td-bold">₹{typeof h.amountPaid === 'number' ? h.amountPaid.toFixed(2) : h.amountPaid}</td>
                      <td>
                        {h.pointsEarned > 0
                          ? <span className="badge badge-accent">+{h.pointsEarned} pts</span>
                          : <span style={{ color: 'var(--color-text-muted)' }}>—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}

        {/* ── Reward Points ── */}
        {tab === 'rewards' && (
          <>
            <div style={{
              background: 'var(--color-accent-subtle)',
              border: '1px solid var(--color-accent-glow)',
              borderRadius: 'var(--radius-lg, 12px)',
              padding: 'var(--space-5) var(--space-6)',
              marginBottom: 'var(--space-6)',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-4)',
            }}>
              <span style={{ fontSize: '2rem' }}>🏆</span>
              <div>
                <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-accent)' }}>
                  {stats.totalPoints ?? 0} Points
                </div>
                <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>Total reward points earned</div>
              </div>
            </div>

            {rewards.length === 0 ? (
              <div className="page-section-empty">
                <div style={{ fontSize: '2rem', marginBottom: 'var(--space-3)' }}>🏆</div>
                <p>No reward points yet. Complete sessions to earn points!</p>
              </div>
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Café</th>
                      <th>Points</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rewards.map((r, i) => (
                      <tr key={r._id}>
                        <td style={{ color: 'var(--color-text-muted)' }}>{i + 1}</td>
                        <td className="td-bold">{r.cafe?.name || '—'}</td>
                        <td><span className="badge badge-accent">+{r.points} pts</span></td>
                        <td>{fmtDate(r.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

      </div>
    </div>
  );
}

