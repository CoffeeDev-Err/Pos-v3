import { useMemo, useState } from 'react';
import '../styles/users.css';
import { getErrorMessage } from '../utils/errors';

const ROLE_INFO = {
  superadmin: { label: 'Super Admin', color: 'danger', icon: 'bi-shield-fill-check' },
  admin:       { label: 'Admin',       color: 'warning', icon: 'bi-person-badge-fill' },
  cashier:     { label: 'Cashier',     color: 'success', icon: 'bi-cash-coin' },
};

const EMPTY_USER = { name: '', username: '', password: '', currentPassword: '', role: 'cashier', active: true };

export default function Users({ users, currentUser, auditLogs, onCreateUser, onUpdateUser, onUpdateUserStatus, onDeleteUser }) {
  const [showModal, setShowModal] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [form, setForm] = useState(EMPTY_USER);
  const [showPass, setShowPass] = useState(false);
  const [activeTab, setActiveTab] = useState('users');
  const [toggleId, setToggleId] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [openLogUsers, setOpenLogUsers] = useState({});
  const isEditingSelf = editUser?.id === currentUser?.id;

  const groupedLogs = useMemo(() => {
    const grouped = new Map();
    (auditLogs || []).slice().reverse().forEach(log => {
      const name = log.user || 'Unknown';
      if (!grouped.has(name)) grouped.set(name, []);
      grouped.get(name).push(log);
    });
    return Array.from(grouped.entries());
  }, [auditLogs]);

  const openAdd = () => { setForm(EMPTY_USER); setEditUser(null); setShowModal(true); setShowPass(true); setError(''); };
  const openEdit = (u) => {
    setForm({
      name: u.name || '',
      username: u.username || '',
      role: u.role || 'cashier',
      active: u.active !== false,
      password: '',
      currentPassword: '',
    });
    setEditUser(u);
    setShowModal(true);
    setShowPass(false);
    setError('');
  };

  const handleSave = async () => {
    if (!form.name || !form.username || (!editUser && !form.password)) return;
    if (editUser && form.password && !form.currentPassword) {
      setError('Current password is required to set a new password.');
      return;
    }
    setSaving(true);
    setError('');

    try {
      if (editUser) {
        const payload = { ...form };
        if (!payload.password) {
          delete payload.password;
          delete payload.currentPassword;
        }
        await onUpdateUser(editUser.id, payload);
      } else {
        await onCreateUser(form);
      }
      setShowModal(false);
    } catch (err) {
      setError(getErrorMessage(err, { fallback: 'An error occurred while saving the user. Please try again.' }));
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (id) => {
    setSaving(true);
    setError('');
    try {
      const target = users.find(u => u.id === id);
      await onUpdateUserStatus(id, { active: !target?.active });
      setToggleId(null);
    } catch (err) {
      setError(getErrorMessage(err, { fallback: 'An error occurred while updating the user. Please try again.' }));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    setSaving(true);
    setError('');
    try {
      const target = users.find(u => u.id === id);
      await onDeleteUser(id, target?.name);
      setDeleteId(null);
    } catch (err) {
      setError(getErrorMessage(err, { fallback: 'An error occurred while deleting the user. Please try again.' }));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      {/* Tabs */}
      <div className="d-flex gap-2 mb-4">
        <button className={`breakdown-tab ${activeTab === 'users' ? 'active' : ''}`} onClick={() => setActiveTab('users')}>
          <i className="bi bi-people"></i>User Management
        </button>
        <button className={`breakdown-tab ${activeTab === 'logs' ? 'active' : ''}`} onClick={() => setActiveTab('logs')}>
          <i className="bi bi-journal-text"></i>Audit Logs
        </button>
      </div>

      {error && (
        <div className="alert alert-danger py-2 small mb-3">
          <i className="bi bi-exclamation-circle me-1"></i>{error}
        </div>
      )}

      {activeTab === 'users' && (
        <>
          <div className="d-flex justify-content-between align-items-center mb-3">
            <div>
              <span className="me-3 small text-muted"><i className="bi bi-people me-1"></i>{users.length} total users</span>
              <span className="small text-muted"><i className="bi bi-circle-fill text-success me-1" style={{ fontSize: '0.6rem' }}></i>{users.filter(u => u.active).length} active</span>
            </div>
            <button className="btn btn-dark" onClick={openAdd}>
              <i className="bi bi-person-plus me-2"></i>Add User
            </button>
          </div>

          <div className="row g-3 mb-4">
            {Object.entries(ROLE_INFO).map(([role, info]) => {
              const count = users.filter(u => u.role === role).length;
              return (
                <div className="col-4" key={role}>
                  <div className={`card text-center py-3 border-${info.color} border`}>
                    <i className={`bi ${info.icon} fs-3 text-${info.color}`}></i>
                    <div className="fw-bold fs-5 mt-1">{count}</div>
                    <div className="small text-muted">{info.label}</div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="card card-custom">
            <div className="card-header-custom"><i className="bi bi-people me-2"></i>All Users</div>
            <div className="table-responsive table-scroll-panel table-scroll-panel--page">
              <table className="table table-hover mb-0 align-middle">
                <thead className="table-light">
                  <tr>
                    <th>Name</th>
                    <th>Username</th>
                    <th>Role</th>
                    <th className="text-center">Status</th>
                    <th>Created</th>
                    <th className="text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => {
                    const ri = ROLE_INFO[u.role] || { label: u.role || 'Unknown', color: 'secondary', icon: 'bi-person' };
                    const isSelf = u.id === currentUser.id;
                    return (
                      <tr key={u.id} className={isSelf ? 'users-self-row' : ''}>
                        <td>
                          <div className="d-flex align-items-center gap-2">
                            <div className="user-avatar-sm">{(u.name || '?').charAt(0)}</div>
                            <div>
                              <div className="fw-semibold small">{u.name}</div>
                              {isSelf && <span className="badge bg-light text-dark border" style={{ fontSize: '0.65rem' }}>You</span>}
                            </div>
                          </div>
                        </td>
                        <td><code className="small">{u.username}</code></td>
                        <td>
                          <span className={`badge bg-${ri.color}${ri.color === 'warning' ? ' text-dark' : ''}`}>
                            <i className={`bi ${ri.icon} me-1`}></i>{ri.label}
                          </span>
                        </td>
                        <td className="text-center">
                          <span className={`badge ${u.active ? 'bg-success' : 'bg-secondary'}`}>
                            {u.active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="text-muted small">{u.createdAt}</td>
                        <td className="text-center">
                          <div className="d-flex gap-1 justify-content-center">
                            <button
                              className="btn btn-outline-secondary btn-sm"
                              onClick={() => openEdit(u)}
                              title="Edit"
                              aria-label={`Edit ${u.name}`}
                            >
                              <i className="bi bi-pencil"></i>
                            </button>
                            <button
                              className={`btn btn-sm ${u.active ? 'btn-outline-warning' : 'btn-outline-success'}`}
                              onClick={() => setToggleId(u.id)}
                              disabled={isSelf}
                              title={u.active ? 'Deactivate' : 'Activate'}
                              aria-label={`${u.active ? 'Deactivate' : 'Activate'} ${u.name}`}
                            >
                              <i className={`bi ${u.active ? 'bi-person-x' : 'bi-person-check'}`}></i>
                            </button>
                            <button
                              className="btn btn-sm btn-outline-danger"
                              onClick={() => setDeleteId(u.id)}
                              disabled={isSelf}
                              title="Delete user"
                              aria-label={`Delete ${u.name}`}
                            >
                              <i className="bi bi-trash"></i>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {activeTab === 'logs' && (
        <div className="card card-custom">
          <div className="card-header-custom"><i className="bi bi-journal-text me-2"></i>Activity Audit Log</div>
          <div className="activity-accordion">
            {groupedLogs.length > 0 ? (
              groupedLogs.map(([name, logs]) => {
                const isOpen = Boolean(openLogUsers[name]);
                return (
                  <div key={name} className="activity-accordion-item">
                    <button
                      type="button"
                      className="activity-accordion-trigger"
                      onClick={() => setOpenLogUsers(prev => ({ ...prev, [name]: !prev[name] }))}
                      aria-expanded={isOpen}
                    >
                      <span className="d-flex align-items-center gap-2 min-w-0">
                        <i className={`bi ${isOpen ? 'bi-chevron-down' : 'bi-chevron-right'} flex-shrink-0`}></i>
                        <span className="text-truncate">{name}</span>
                      </span>
                      <span className="badge bg-light text-dark border flex-shrink-0">{logs.length}</span>
                    </button>
                    {isOpen && (
                      <div className="activity-accordion-body">
                        <ul className="list-group list-group-flush">
                          {logs.map(log => (
                            <li key={log.id} className="list-group-item py-2">
                              <div className="d-flex justify-content-between align-items-start gap-2">
                                <div className="min-w-0">
                                  <div className="fw-semibold text-truncate">{log.action}</div>
                                  <div className="text-muted activity-meta">#{log.id} • {log.timestamp}</div>
                                </div>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="activity-empty text-muted small">No audit logs yet.</div>
            )}
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="modal fade show d-block" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title"><i className="bi bi-person-plus me-2"></i>{editUser ? 'Edit User' : 'Add New User'}</h5>
                <button className="btn-close" onClick={() => setShowModal(false)} aria-label="Close"></button>
              </div>
              <div className="modal-body">
                {error && (
                  <div className="alert alert-danger py-2 small">
                    <i className="bi bi-exclamation-circle me-1"></i>{error}
                  </div>
                )}
                <div className="row g-3">
                  <div className="col-12">
                    <label className="form-label fw-semibold">Full Name *</label>
                    <input className="form-control" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Cashier Name" />
                  </div>
                  <div className="col-6">
                    <label className="form-label fw-semibold">Username *</label>
                    <input className="form-control" value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} placeholder="e.g. cashier1" />
                  </div>
                  <div className="col-6">
                    <label className="form-label fw-semibold">Role *</label>
                    <select
                      className="form-select"
                      value={form.role}
                      onChange={e => setForm({ ...form, role: e.target.value })}
                      disabled={isEditingSelf}
                    >
                      <option value="cashier">Cashier</option>
                      <option value="admin">Admin</option>
                      <option value="superadmin">Super Admin</option>
                    </select>
                    {isEditingSelf && (
                      <div className="text-muted small mt-1">
                        <i className="bi bi-info-circle me-1"></i>Your own role cannot be changed here.
                      </div>
                    )}
                  </div>
                  <div className="col-12">
                    <label className="form-label fw-semibold">{editUser ? 'New Password (leave blank to keep)' : 'Password *'}</label>
                    <div className="input-group">
                      <input type={showPass ? 'text' : 'password'} className="form-control" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder={editUser ? 'Leave blank to keep current' : 'Enter password'} />
                      <button
                        type="button"
                        className="btn btn-outline-secondary"
                        onClick={() => setShowPass(!showPass)}
                        aria-label={showPass ? 'Hide password' : 'Show password'}
                      >
                        <i className={`bi ${showPass ? 'bi-eye-slash' : 'bi-eye'}`}></i>
                      </button>
                    </div>
                  </div>
                  {editUser && form.password && (
                    <div className="col-12">
                      <label className="form-label fw-semibold">Current Password <span className="text-muted fw-normal small">(required to apply new password)</span></label>
                      <input type="password" className="form-control" value={form.currentPassword} onChange={e => setForm({ ...form, currentPassword: e.target.value })} placeholder="Enter current password" />
                      <div className="text-muted small mt-1"><i className="bi bi-info-circle me-1"></i>Enter the user&apos;s existing password to authorize the change.</div>
                    </div>
                  )}
                  <div className="col-12">
                    <div className="form-check form-switch">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        checked={form.active}
                        onChange={e => setForm({ ...form, active: e.target.checked })}
                        id="activeCheck"
                        disabled={isEditingSelf}
                      />
                      <label className="form-check-label" htmlFor="activeCheck">Account Active</label>
                    </div>
                    {isEditingSelf && (
                      <div className="text-muted small mt-1">
                        <i className="bi bi-info-circle me-1"></i>Your own account cannot be deactivated.
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-outline-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button className="btn btn-dark" onClick={handleSave} disabled={saving || !form.name || !form.username || (!editUser && !form.password)}>
                  {saving
                    ? <><span className="spinner-border spinner-border-sm me-2"></span>Saving...</>
                    : <><i className="bi bi-check2 me-2"></i>Save User</>
                  }
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteId && (
        <div className="modal fade show d-block" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered modal-sm">
            <div className="modal-content">
              <div className="modal-body text-center py-4">
                <i className="bi bi-trash-fill text-danger fs-1 d-block mb-3"></i>
                <h5>Delete user?</h5>
                <p className="text-muted small">This cannot be undone. The user will be permanently removed.</p>
              </div>
              <div className="modal-footer justify-content-center gap-2">
                <button className="btn btn-outline-secondary" onClick={() => setDeleteId(null)}>Cancel</button>
                <button className="btn btn-danger" onClick={() => handleDelete(deleteId)} disabled={saving}>Delete</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toggle Confirm */}
      {toggleId && (
        <div className="modal fade show d-block" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered modal-sm">
            <div className="modal-content">
              <div className="modal-body text-center py-4">
                {users.find(u => u.id === toggleId)?.active
                  ? <><i className="bi bi-person-x-fill text-warning fs-1 d-block mb-3"></i><h5>Deactivate user?</h5><p className="text-muted small">They won't be able to log in.</p></>
                  : <><i className="bi bi-person-check-fill text-success fs-1 d-block mb-3"></i><h5>Activate user?</h5><p className="text-muted small">They will be able to log in again.</p></>
                }
              </div>
              <div className="modal-footer justify-content-center gap-2">
                <button className="btn btn-outline-secondary" onClick={() => setToggleId(null)}>Cancel</button>
                <button className="btn btn-dark" onClick={() => handleToggle(toggleId)} disabled={saving}>Confirm</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
