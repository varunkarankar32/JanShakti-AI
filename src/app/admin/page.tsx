'use client';

import { useEffect, useMemo, useState } from 'react';

type AdminUser = {
  id: number;
  name: string;
  email: string;
  phone?: string | null;
  state?: string | null;
  district?: string | null;
  role: string;
  is_active: boolean;
  created_at?: string | null;
  last_login_at?: string | null;
};

type AdminStats = {
  total_users: number;
  active_users: number;
  inactive_users: number;
  role_counts: Record<string, number>;
  recent_onboarded: AdminUser[];
};

type BulkParsedRow = {
  name: string;
  email: string;
  phone?: string;
  state: string;
  district: string;
  role: string;
  password: string;
};

const STATE_DISTRICT_MAP: Record<string, string[]> = {
  'Andhra Pradesh': ['Anantapur', 'Chittoor', 'East Godavari', 'Guntur', 'Krishna', 'Visakhapatnam'],
  'Bihar': ['Patna', 'Gaya', 'Muzaffarpur', 'Darbhanga', 'Bhagalpur', 'Purnia'],
  'Delhi': ['Central Delhi', 'East Delhi', 'New Delhi', 'North Delhi', 'South Delhi', 'West Delhi'],
  'Gujarat': ['Ahmedabad', 'Surat', 'Vadodara', 'Rajkot', 'Bhavnagar', 'Jamnagar'],
  'Karnataka': ['Bengaluru Urban', 'Mysuru', 'Belagavi', 'Mangaluru', 'Hubballi', 'Ballari'],
  'Maharashtra': ['Mumbai', 'Pune', 'Nagpur', 'Nashik', 'Thane', 'Aurangabad'],
  'Rajasthan': ['Jaipur', 'Jodhpur', 'Kota', 'Udaipur', 'Ajmer', 'Bikaner'],
  'Tamil Nadu': ['Chennai', 'Coimbatore', 'Madurai', 'Salem', 'Tiruchirappalli', 'Tirunelveli'],
  'Uttar Pradesh': ['Lucknow', 'Kanpur Nagar', 'Varanasi', 'Prayagraj', 'Agra', 'Gorakhpur'],
};

function safeGet(key: string): string {
  if (typeof window === 'undefined') return '';
  try {
    return window.localStorage.getItem(key) || '';
  } catch {
    return '';
  }
}

function safeSet(key: string, value: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Ignore storage errors.
  }
}

function safeRemove(key: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore storage errors.
  }
}

export default function AdminPortalPage() {
  const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8010';

  const [token, setToken] = useState('');
  const [adminUser, setAdminUser] = useState<{ id: number; name: string; email: string; role: string } | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [tab, setTab] = useState<'overview' | 'single' | 'bulk' | 'directory' | 'segmented'>('overview');
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState('');
  const [error, setError] = useState('');

  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newState, setNewState] = useState('');
  const [newDistrict, setNewDistrict] = useState('');
  const [newRole, setNewRole] = useState('authority');
  const [newPassword, setNewPassword] = useState('');

  const [bulkText, setBulkText] = useState('');

  const [resetPasswordById, setResetPasswordById] = useState<Record<number, string>>({});

  const headers = useMemo(
    () => ({ Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }),
    [token],
  );

  const logout = () => {
    setToken('');
    setAdminUser(null);
    setStats(null);
    setUsers([]);
    safeRemove('admin_token');
    safeRemove('admin_user');
  };

  useEffect(() => {
    const storedToken = safeGet('admin_token');
    const rawUser = safeGet('admin_user');

    if (!storedToken || !rawUser) {
      setCheckingAuth(false);
      return;
    }

    try {
      const parsed = JSON.parse(rawUser);
      setToken(storedToken);
      setAdminUser(parsed);
    } catch {
      safeRemove('admin_token');
      safeRemove('admin_user');
    } finally {
      setCheckingAuth(false);
    }
  }, []);

  useEffect(() => {
    if (!token) return;

    fetch(`${API_BASE}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async (res) => {
        if (!res.ok) {
          logout();
          return;
        }
        const me = await res.json();
        if (me?.role !== 'admin') {
          setAuthError('Only admin accounts can access this portal.');
          logout();
          return;
        }
        setAdminUser(me);
        safeSet('admin_user', JSON.stringify(me));
      })
      .catch(() => {
        logout();
      });
  }, [token, API_BASE]);

  const loadStats = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/api/admin/onboarding/stats`, { headers });
      if (!res.ok) return;
      const data = await res.json();
      setStats(data);
    } catch {
      // Ignore transient failure.
    }
  };

  const loadUsers = async () => {
    if (!token) return;
    try {
      const qs = new URLSearchParams();
      qs.set('limit', '240');
      if (roleFilter !== 'all') qs.set('role', roleFilter);
      if (search.trim()) qs.set('search', search.trim());
      const res = await fetch(`${API_BASE}/api/admin/users?${qs.toString()}`, { headers });
      if (!res.ok) return;
      const data = await res.json();
      setUsers(data.users || []);
    } catch {
      // Ignore transient failure.
    }
  };

  useEffect(() => {
    if (!token) return;
    loadStats();
    loadUsers();
    const id = setInterval(() => {
      loadStats();
      loadUsers();
    }, 15000);
    return () => clearInterval(id);
  }, [token, roleFilter]);

  const login = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setAuthError(body?.detail || 'Admin login failed.');
        return;
      }
      const data = await res.json();
      setToken(data.token);
      setAdminUser(data.user);
      safeSet('admin_token', data.token);
      safeSet('admin_user', JSON.stringify(data.user));
      setTab('overview');
    } catch {
      setAuthError('Unable to reach backend.');
    } finally {
      setAuthLoading(false);
    }
  };

  const createSingleUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    setFlash('');
    try {
      const res = await fetch(`${API_BASE}/api/admin/users/create`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: newName.trim(),
          email: newEmail.trim(),
          phone: newPhone.trim() || null,
          state: newState,
          district: newDistrict,
          role: newRole,
          password: newPassword,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body?.detail || 'Create user failed.');
        return;
      }
      setFlash(body?.message || 'User onboarded.');
      setNewName('');
      setNewEmail('');
      setNewPhone('');
      setNewState('');
      setNewDistrict('');
      setNewPassword('');
      await loadStats();
      await loadUsers();
      setTab('directory');
    } catch {
      setError('Create user request failed.');
    } finally {
      setBusy(false);
    }
  };

  const parseBulkRows = (): BulkParsedRow[] => {
    const rows = bulkText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    return rows
      .map((line) => line.split(',').map((part) => part.trim()))
      .filter((parts) => parts.length >= 7)
      .map((parts) => ({
        name: parts[0],
        email: parts[1],
        phone: parts[2],
        state: parts[3],
        district: parts[4],
        role: parts[5].toLowerCase(),
        password: parts[6],
      }));
  };

  const submitBulk = async () => {
    const parsed = parseBulkRows();
    if (parsed.length === 0) {
      setError('No valid rows. Use: name,email,phone,role,password');
      return;
    }

    setBusy(true);
    setError('');
    setFlash('');
    try {
      const res = await fetch(`${API_BASE}/api/admin/users/bulk-create`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ users: parsed }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body?.detail || 'Bulk onboarding failed.');
        return;
      }

      setFlash(`Created ${body.created_count} users, skipped ${body.skipped_count}.`);
      setBulkText('');
      await loadStats();
      await loadUsers();
      setTab('directory');
    } catch {
      setError('Bulk request failed.');
    } finally {
      setBusy(false);
    }
  };

  const updateRole = async (userId: number, role: string) => {
    setBusy(true);
    setError('');
    setFlash('');
    try {
      const res = await fetch(`${API_BASE}/api/admin/users/${userId}/role`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ role }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body?.detail || 'Role update failed.');
        return;
      }
      setFlash(body?.message || 'Role updated.');
      await loadUsers();
      await loadStats();
    } catch {
      setError('Role update request failed.');
    } finally {
      setBusy(false);
    }
  };

  const toggleActivation = async (userId: number, isActive: boolean) => {
    setBusy(true);
    setError('');
    setFlash('');
    try {
      const res = await fetch(`${API_BASE}/api/admin/users/${userId}/activation`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ is_active: isActive }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body?.detail || 'Activation update failed.');
        return;
      }
      setFlash(body?.message || 'Status updated.');
      await loadUsers();
      await loadStats();
    } catch {
      setError('Activation request failed.');
    } finally {
      setBusy(false);
    }
  };

  const resetPassword = async (userId: number) => {
    const nextPassword = resetPasswordById[userId] || '';
    if (!nextPassword || nextPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setBusy(true);
    setError('');
    setFlash('');
    try {
      const res = await fetch(`${API_BASE}/api/admin/users/${userId}/reset-password`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ new_password: nextPassword }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body?.detail || 'Password reset failed.');
        return;
      }
      setFlash(body?.message || 'Password reset done.');
      setResetPasswordById((prev) => ({ ...prev, [userId]: '' }));
      await loadUsers();
    } catch {
      setError('Password reset request failed.');
    } finally {
      setBusy(false);
    }
  };

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return users;
    return users.filter((u) =>
      [u.name, u.email, u.phone || '', u.role].join(' ').toLowerCase().includes(query),
    );
  }, [users, search]);

  const roleBuckets = useMemo(() => {
    const groups: Record<string, AdminUser[]> = {
      authority: [],
      leader: [],
      citizen: [],
      admin: [],
    };

    for (const user of filteredUsers) {
      const role = (user.role || 'citizen').toLowerCase();
      if (groups[role]) {
        groups[role].push(user);
      }
    }

    return groups;
  }, [filteredUsers]);

  if (checkingAuth) {
    return (
      <main className="main-content portal-shell">
        <section className="section" style={{ paddingTop: 100 }}>
          <div className="container">
            <div className="glass-card" style={{ textAlign: 'center', padding: 40 }}>
              Checking admin session...
            </div>
          </div>
        </section>
      </main>
    );
  }

  if (!token || !adminUser) {
    return (
      <main className="main-content portal-shell">
        <section className="section" style={{ paddingTop: 92 }}>
          <div className="container">
            <div
              style={{
                borderRadius: 22,
                overflow: 'hidden',
                border: '1px solid rgba(14, 116, 144, 0.22)',
                boxShadow: '0 30px 60px rgba(2, 6, 23, 0.15)',
                background: 'linear-gradient(135deg, #f0f9ff 0%, #fef9c3 48%, #fff1f2 100%)',
              }}
            >
              <div style={{ padding: '24px 28px', borderBottom: '1px solid rgba(14, 116, 144, 0.18)' }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.12em', color: '#0369a1' }}>
                  JANSHAKTI ADMIN GRID
                </div>
                <h1 style={{ marginTop: 8, fontSize: '2rem', fontWeight: 900, color: '#0f172a' }}>
                  Authority + Leader Onboarding Command Center
                </h1>
                <p style={{ marginTop: 8, color: '#334155', fontSize: '0.95rem', maxWidth: 720 }}>
                  Create leader and authority identities, run bulk onboarding waves, enforce password resets,
                  and manage account status from one high-visibility operations cockpit.
                </p>
              </div>

              <div style={{ padding: 28, display: 'grid', gap: 14 }}>
                <form onSubmit={login} style={{ display: 'grid', gap: 12, maxWidth: 500 }}>
                  <input
                    placeholder="Admin email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    style={{ border: '1px solid #bae6fd', borderRadius: 12, padding: '12px 14px', fontSize: '0.9rem' }}
                  />
                  <input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    style={{ border: '1px solid #bae6fd', borderRadius: 12, padding: '12px 14px', fontSize: '0.9rem' }}
                  />
                  <button className="btn btn-primary" disabled={authLoading} style={{ justifyContent: 'center' }}>
                    {authLoading ? 'Authenticating...' : 'Enter Admin Portal'}
                  </button>
                </form>

                {authError && (
                  <div style={{ color: '#dc2626', fontWeight: 700, fontSize: '0.86rem' }}>{authError}</div>
                )}
              </div>
            </div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="main-content portal-shell">
      <section className="section" style={{ paddingTop: 92 }}>
        <div className="container" style={{ display: 'grid', gap: 20 }}>
          <div
            style={{
              borderRadius: 18,
              padding: 20,
              border: '1px solid rgba(37, 99, 235, 0.2)',
              background: 'linear-gradient(120deg, rgba(191,219,254,0.55) 0%, rgba(167,243,208,0.4) 45%, rgba(254,243,199,0.45) 100%)',
              boxShadow: '0 20px 40px rgba(15, 23, 42, 0.12)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: '0.72rem', letterSpacing: '0.1em', fontWeight: 800, color: '#1d4ed8' }}>
                  ADMIN OPS CORE
                </div>
                <h2 style={{ marginTop: 6, fontSize: '1.6rem', fontWeight: 900 }}>Identity Onboarding War Room</h2>
                <p style={{ marginTop: 6, color: '#334155', fontSize: '0.86rem' }}>
                  Signed in as {adminUser.name} ({adminUser.email})
                </p>
              </div>
              <button className="btn btn-secondary" onClick={logout}>Logout</button>
            </div>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {[
              { key: 'overview', label: 'Overview' },
              { key: 'single', label: 'Single Onboarding' },
              { key: 'bulk', label: 'Bulk Import' },
              { key: 'segmented', label: 'Role Segments' },
              { key: 'directory', label: 'Identity Directory' },
            ].map((item) => (
              <button
                key={item.key}
                className="btn"
                onClick={() => setTab(item.key as 'overview' | 'single' | 'bulk' | 'directory' | 'segmented')}
                style={{
                  background: tab === item.key ? '#1d4ed8' : '#eff6ff',
                  color: tab === item.key ? '#fff' : '#1e3a8a',
                  border: tab === item.key ? '1px solid #1d4ed8' : '1px solid #bfdbfe',
                }}
              >
                {item.label}
              </button>
            ))}
          </div>

          {(flash || error) && (
            <div
              style={{
                borderRadius: 10,
                padding: '10px 14px',
                border: `1px solid ${error ? '#fecaca' : '#bbf7d0'}`,
                background: error ? '#fef2f2' : '#f0fdf4',
                color: error ? '#b91c1c' : '#166534',
                fontWeight: 700,
                fontSize: '0.82rem',
              }}
            >
              {error || flash}
            </div>
          )}

          {tab === 'overview' && (
            <div style={{ display: 'grid', gap: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                <StatCard title="Total Accounts" value={String(stats?.total_users || 0)} color="#2563eb" />
                <StatCard title="Active" value={String(stats?.active_users || 0)} color="#16a34a" />
                <StatCard title="Inactive" value={String(stats?.inactive_users || 0)} color="#dc2626" />
                <StatCard title="Leaders" value={String(stats?.role_counts?.leader || 0)} color="#7c3aed" />
                <StatCard title="Authorities" value={String(stats?.role_counts?.authority || 0)} color="#ea580c" />
                <StatCard title="Admins" value={String(stats?.role_counts?.admin || 0)} color="#0891b2" />
              </div>

              <div className="glass-card" style={{ padding: 18 }}>
                <div style={{ fontWeight: 800, fontSize: '1rem', marginBottom: 12 }}>Recently Onboarded</div>
                <div style={{ display: 'grid', gap: 8 }}>
                  {(stats?.recent_onboarded || []).map((u) => (
                    <div key={u.id} style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: 10, display: 'grid', gap: 4 }}>
                      <div style={{ fontWeight: 700 }}>{u.name} • {u.role}</div>
                      <div style={{ fontSize: '0.8rem', color: '#475569' }}>{u.email}</div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                        Created: {u.created_at ? new Date(u.created_at).toLocaleString() : 'n/a'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {tab === 'single' && (
            <div className="glass-card" style={{ padding: 20 }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, marginBottom: 10 }}>Onboard Single Identity</h3>
              <form onSubmit={createSingleUser} style={{ display: 'grid', gap: 10, maxWidth: 700 }}>
                <input placeholder="Full name" value={newName} onChange={(e) => setNewName(e.target.value)} style={inputStyle} required />
                <input placeholder="Email" type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} style={inputStyle} required />
                <input placeholder="Phone (optional)" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} style={inputStyle} />
                <select
                  value={newState}
                  onChange={(e) => {
                    setNewState(e.target.value);
                    setNewDistrict('');
                  }}
                  style={inputStyle}
                  required
                >
                  <option value="">Select state</option>
                  {Object.keys(STATE_DISTRICT_MAP).map((state) => (
                    <option key={state} value={state}>{state}</option>
                  ))}
                </select>
                <select value={newDistrict} onChange={(e) => setNewDistrict(e.target.value)} style={inputStyle} required>
                  <option value="">Select district</option>
                  {(STATE_DISTRICT_MAP[newState] || []).map((district) => (
                    <option key={district} value={district}>{district}</option>
                  ))}
                </select>
                <select value={newRole} onChange={(e) => setNewRole(e.target.value)} style={inputStyle}>
                  <option value="authority">Authority</option>
                  <option value="leader">Leader</option>
                  <option value="admin">Admin</option>
                </select>
                <input placeholder="Temporary password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} style={inputStyle} minLength={8} required />
                <button className="btn btn-primary" disabled={busy} style={{ justifyContent: 'center' }}>
                  {busy ? 'Creating...' : 'Create Identity'}
                </button>
              </form>
            </div>
          )}

          {tab === 'bulk' && (
            <div className="glass-card" style={{ padding: 20 }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, marginBottom: 10 }}>Bulk Onboarding Wave</h3>
              <p style={{ fontSize: '0.82rem', color: '#475569', marginBottom: 10 }}>
                Format per line: name,email,phone,state,district,role,password
              </p>
              <textarea
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                placeholder={'Riya Sharma,riya@city.gov,+919900001111,Maharashtra,Pune,authority,Secure@123\nArjun Singh,arjun@city.gov,+919900001112,Uttar Pradesh,Lucknow,leader,Secure@123'}
                rows={10}
                style={{ ...inputStyle, resize: 'vertical', minHeight: 220 }}
              />
              <div style={{ marginTop: 10, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <button className="btn btn-primary" onClick={submitBulk} disabled={busy}>
                  {busy ? 'Processing...' : 'Run Bulk Import'}
                </button>
                <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                  Parsed rows: {parseBulkRows().length}
                </span>
              </div>
            </div>
          )}

          {tab === 'directory' && (
            <div className="glass-card" style={{ padding: 20, display: 'grid', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10 }}>
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, email, phone, role" style={inputStyle} />
                <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} style={inputStyle}>
                  <option value="all">All roles</option>
                  <option value="admin">Admin</option>
                  <option value="leader">Leader</option>
                  <option value="authority">Authority</option>
                  <option value="citizen">Citizen</option>
                </select>
              </div>

              <div style={{ display: 'grid', gap: 10 }}>
                {filteredUsers.map((u) => (
                  <div key={u.id} style={{ border: '1px solid #dbeafe', borderRadius: 12, padding: 12, background: 'linear-gradient(135deg, rgba(255,255,255,0.95), rgba(239,246,255,0.78))' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                      <div>
                        <div style={{ fontWeight: 800 }}>{u.name}</div>
                        <div style={{ fontSize: '0.8rem', color: '#475569' }}>{u.email} {u.phone ? `• ${u.phone}` : ''}</div>
                        <div style={{ fontSize: '0.76rem', color: '#475569' }}>{u.state || 'n/a'} • {u.district || 'n/a'}</div>
                        <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: 4 }}>
                          Created: {u.created_at ? new Date(u.created_at).toLocaleString() : 'n/a'} • Last Login: {u.last_login_at ? new Date(u.last_login_at).toLocaleString() : 'never'}
                        </div>
                      </div>

                      <div style={{ display: 'grid', gap: 8, minWidth: 260 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 8 }}>
                          <select value={u.role} onChange={(e) => updateRole(u.id, e.target.value)} style={miniInputStyle} disabled={busy}>
                            <option value="admin">Admin</option>
                            <option value="leader">Leader</option>
                            <option value="authority">Authority</option>
                            <option value="citizen">Citizen</option>
                          </select>
                          <button className="btn" style={miniButtonStyle} onClick={() => toggleActivation(u.id, !u.is_active)} disabled={busy}>
                            {u.is_active ? 'Deactivate' : 'Activate'}
                          </button>
                          <span style={{ alignSelf: 'center', fontSize: '0.72rem', fontWeight: 700, color: u.is_active ? '#15803d' : '#b91c1c' }}>
                            {u.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}>
                          <input
                            type="password"
                            placeholder="New password"
                            value={resetPasswordById[u.id] || ''}
                            onChange={(e) => setResetPasswordById((prev) => ({ ...prev, [u.id]: e.target.value }))}
                            style={miniInputStyle}
                          />
                          <button className="btn" style={miniButtonStyle} onClick={() => resetPassword(u.id)} disabled={busy}>
                            Reset
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === 'segmented' && (
            <div className="glass-card" style={{ padding: 20, display: 'grid', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10 }}>
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search across all role segments" style={inputStyle} />
                <div style={{ ...inputStyle, display: 'flex', alignItems: 'center', background: '#f8fafc' }}>
                  Segmented view for Authority / Leader / Citizen
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
                {[
                  { key: 'authority', title: 'Authority', color: '#ea580c', bg: 'rgba(249,115,22,0.08)' },
                  { key: 'leader', title: 'Leader', color: '#7c3aed', bg: 'rgba(124,58,237,0.08)' },
                  { key: 'citizen', title: 'Citizen', color: '#0f766e', bg: 'rgba(13,148,136,0.08)' },
                  { key: 'admin', title: 'Admin', color: '#0284c7', bg: 'rgba(2,132,199,0.08)' },
                ].map((lane) => (
                  <div key={lane.key} style={{ border: '1px solid #dbeafe', borderRadius: 12, overflow: 'hidden', background: 'rgba(255,255,255,0.68)' }}>
                    <div style={{ padding: '10px 12px', background: lane.bg, borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between' }}>
                      <strong style={{ color: lane.color }}>{lane.title}</strong>
                      <span style={{ color: lane.color, fontWeight: 800 }}>{roleBuckets[lane.key].length}</span>
                    </div>
                    <div style={{ maxHeight: 460, overflowY: 'auto', display: 'grid', gap: 8, padding: 10 }}>
                      {roleBuckets[lane.key].length === 0 && (
                        <div style={{ fontSize: '0.78rem', color: '#64748b', padding: 8 }}>
                          No users in this segment.
                        </div>
                      )}
                      {roleBuckets[lane.key].map((u) => (
                        <div key={u.id} style={{ border: '1px solid #dbeafe', borderRadius: 10, padding: 10, background: 'linear-gradient(135deg, rgba(255,255,255,0.95), rgba(239,246,255,0.7))' }}>
                          <div style={{ fontWeight: 700 }}>{u.name}</div>
                          <div style={{ fontSize: '0.78rem', color: '#475569' }}>{u.email}</div>
                          <div style={{ fontSize: '0.74rem', color: '#475569', marginTop: 2 }}>{u.state || 'n/a'} • {u.district || 'n/a'}</div>
                          <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}>
                            <select value={u.role} onChange={(e) => updateRole(u.id, e.target.value)} style={miniInputStyle} disabled={busy}>
                              <option value="admin">Admin</option>
                              <option value="leader">Leader</option>
                              <option value="authority">Authority</option>
                              <option value="citizen">Citizen</option>
                            </select>
                            <button className="btn" style={miniButtonStyle} onClick={() => toggleActivation(u.id, !u.is_active)} disabled={busy}>
                              {u.is_active ? 'Deactivate' : 'Activate'}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

function StatCard({ title, value, color }: { title: string; value: string; color: string }) {
  return (
    <div
      style={{
        borderRadius: 12,
        border: '1px solid rgba(148, 163, 184, 0.25)',
        background: 'linear-gradient(135deg, rgba(255,255,255,0.95), rgba(239,246,255,0.72))',
        padding: 14,
        boxShadow: '0 8px 20px rgba(2, 6, 23, 0.06)',
      }}
    >
      <div style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 700 }}>{title}</div>
      <div style={{ fontSize: '1.6rem', fontWeight: 900, color, marginTop: 4 }}>{value}</div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  border: '1px solid #bfdbfe',
  borderRadius: 10,
  padding: '11px 12px',
  fontSize: '0.86rem',
  width: '100%',
};

const miniInputStyle: React.CSSProperties = {
  border: '1px solid #bfdbfe',
  borderRadius: 8,
  padding: '8px 10px',
  fontSize: '0.8rem',
  width: '100%',
};

const miniButtonStyle: React.CSSProperties = {
  border: '1px solid #bfdbfe',
  borderRadius: 8,
  padding: '8px 10px',
  fontSize: '0.75rem',
  fontWeight: 700,
  background: 'linear-gradient(135deg, #eff6ff 0%, #e0f2fe 100%)',
  color: '#0f172a',
};
