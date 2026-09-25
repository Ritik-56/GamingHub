import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

export default function StaffManagement() {
  const { currentCafe, currentRole } = useAuth();
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Add form
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', role: 'STAFF' });
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(null);

  const isOwnerOrManager = ['OWNER', 'MANAGER'].includes(currentRole);

  const fetchStaff = useCallback(async () => {
    if (!currentCafe) return;
    try {
      const res = await api.get(`/cafes/${currentCafe._id}/staff`);
      setStaff(res.data.data.staff);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [currentCafe]);

  useEffect(() => {
    fetchStaff();
  }, [fetchStaff]);

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setFormError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setFormError('');

    try {
      await api.post(`/cafes/${currentCafe._id}/staff`, form);
      setShowForm(false);
      setForm({ name: '', email: '', phone: '', password: '', role: 'STAFF' });
      await fetchStaff();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (membershipId, name) => {
    if (!window.confirm(`Remove ${name} from staff?`)) return;

    setRemoving(membershipId);
    setError('');
    try {
      await api.delete(`/cafes/${currentCafe._id}/staff/${membershipId}`);
      await fetchStaff();
    } catch (err) {
      setError(err.message);
    } finally {
      setRemoving(null);
    }
  };

  const roleColor = (role) => {
    const map = {
      OWNER: 'status--occupied',
      MANAGER: 'status--requested',
      STAFF: 'status--available',
    };
    return map[role] || '';
  };

  if (loading) return <div className="page-section-empty">Loading staff...</div>;

  return (
    <div className="page-section">
      <div className="page-section-header">
        <div>
          <h2 className="page-section-title">Staff Management</h2>
          <p className="page-section-subtitle">{staff.length} team members</p>
        </div>
        {isOwnerOrManager && (
          <button className="btn btn-primary" onClick={() => setShowForm(true)}>
            + Add Staff
          </button>
        )}
      </div>

      {error && <div className="form-error" style={{ marginBottom: '1rem' }}>{error}</div>}

      {/* Add Staff Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Add Staff Member</h3>
            <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-4)' }}>
              Creates a user account and adds them as staff to this café.
            </p>
            <form className="modal-form" onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label" htmlFor="staff-name">Name</label>
                <input
                  id="staff-name"
                  className="form-input"
                  name="name"
                  placeholder="Staff member name"
                  value={form.name}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="staff-email">Email</label>
                <input
                  id="staff-email"
                  className="form-input"
                  type="email"
                  name="email"
                  placeholder="staff@example.com"
                  value={form.email}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label" htmlFor="staff-phone">Phone <span className="form-optional">(optional)</span></label>
                  <input
                    id="staff-phone"
                    className="form-input"
                    type="tel"
                    name="phone"
                    placeholder="+91 9876543210"
                    value={form.phone}
                    onChange={handleChange}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="staff-role">Role</label>
                  <select
                    id="staff-role"
                    className="form-input"
                    name="role"
                    value={form.role}
                    onChange={handleChange}
                  >
                    <option value="STAFF">Staff</option>
                    {currentRole === 'OWNER' && <option value="MANAGER">Manager</option>}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="staff-password">Temporary Password</label>
                <input
                  id="staff-password"
                  className="form-input"
                  type="text"
                  name="password"
                  placeholder="Min 6 characters"
                  value={form.password}
                  onChange={handleChange}
                  required
                  minLength={6}
                />
                <span className="form-optional" style={{ display: 'block', marginTop: 'var(--space-1)' }}>
                  Share this password with the staff member. They'll use it to log in.
                </span>
              </div>

              {formError && <div className="form-error">{formError}</div>}

              <div className="modal-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Adding...' : 'Add Staff'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Staff Table */}
      {staff.length === 0 ? (
        <div className="page-section-empty">
          No staff members yet. Add your first team member.
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Role</th>
                <th>Joined</th>
                {isOwnerOrManager && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {staff.map((s) => (
                <tr key={s.membershipId}>
                  <td className="td-bold">{s.name}</td>
                  <td>{s.email}</td>
                  <td>{s.phone || '—'}</td>
                  <td>
                    <span className={`badge ${roleColor(s.role)}`}>
                      {s.role}
                    </span>
                  </td>
                  <td>{new Date(s.joinedAt).toLocaleDateString()}</td>
                  {isOwnerOrManager && (
                    <td className="td-actions">
                      {s.role !== 'OWNER' && (
                        <button
                          className="btn btn-ghost btn-sm"
                          style={{ color: 'var(--color-error)' }}
                          onClick={() => handleRemove(s.membershipId, s.name)}
                          disabled={removing === s.membershipId}
                        >
                          {removing === s.membershipId ? 'Removing...' : 'Remove'}
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
