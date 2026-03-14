'use client';

import { useState, useEffect, useCallback } from 'react';
import { mockTrendData, mockAlerts, mockActionQueue, mockWardHeatData, mockCategoryDistribution, STATUS_CONFIG } from '@/lib/mockData';

interface LiveComplaint {
  id: number;
  ticket_id: string;
  title: string;
  description: string;
  category: string;
  ward: string;
  priority: string;
  ai_score: number;
  status: string;
  input_mode: string;
  assigned_to: string | null;
  assigned_authority?: string | null;
  authority_response?: string | null;
  citizen_update?: string | null;
  created_at: string | null;
  rating: number | null;
}

interface CategoryItem {
  name: string;
  value: number;
  color: string;
}

interface DashboardStats {
  total_complaints: number;
  resolution_rate: number;
  complaints_today: number;
  resolved_today: number;
  p0_active: number;
  pending_verification: number;
  satisfaction: number;
  category_distribution: CategoryItem[];
  ward_heat_data: { ward: string; complaints: number; severity: string }[];
  action_queue: { rank: number; task: string; category: string; priority: string; ticket_id: string }[];
}

const DEFAULT_KPIS = [
  { label: 'Issues Tracked', value: '0', icon: '📋', color: '#3b82f6', change: 'Live from DB' },
  { label: 'Resolution Rate', value: '0%', icon: '✅', color: '#22c55e', change: 'Resolved / Total' },
  { label: 'Open Issues', value: '0', icon: '🔴', color: '#ef4444', change: 'Needs attention' },
  { label: 'In Progress', value: '0', icon: '⚡', color: '#f59e0b', change: 'Being worked on' },
  { label: 'Avg AI Score', value: '0', icon: '🤖', color: '#8b5cf6', change: 'Priority score' },
];

export default function DashboardPage() {
  const [activeView, setActiveView] = useState('overview');
  const [complaints, setComplaints] = useState<LiveComplaint[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [backendOnline, setBackendOnline] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [secondsSinceUpdate, setSecondsSinceUpdate] = useState(0);

  const [leaderToken, setLeaderToken] = useState('');
  const [leaderUser, setLeaderUser] = useState<{ id: number; name: string; email: string; role: string } | null>(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [leaderEmail, setLeaderEmail] = useState('');
  const [leaderPassword, setLeaderPassword] = useState('');
  const [selectedTicket, setSelectedTicket] = useState<string>('');
  const [authorityName, setAuthorityName] = useState('');
  const [authorityResponse, setAuthorityResponse] = useState('');
  const [leaderNote, setLeaderNote] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const handleLeaderLogout = useCallback(() => {
    setLeaderToken('');
    setLeaderUser(null);
    setStats(null);
    setComplaints([]);
    localStorage.removeItem('leader_token');
    localStorage.removeItem('leader_user');
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('leader_token') || '';
    const userRaw = localStorage.getItem('leader_user');

    if (!token || !userRaw) {
      setAuthChecking(false);
      return;
    }

    try {
      const parsed = JSON.parse(userRaw) as { id: number; name: string; email: string; role: string };
      setLeaderToken(token);
      setLeaderUser(parsed);
    } catch {
      localStorage.removeItem('leader_token');
      localStorage.removeItem('leader_user');
    } finally {
      setAuthChecking(false);
    }
  }, []);

  useEffect(() => {
    if (!leaderToken) return;

    fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${leaderToken}` },
    })
      .then(async (res) => {
        if (!res.ok) {
          handleLeaderLogout();
          return;
        }

        const user = await res.json();
        if (user?.role !== 'leader') {
          setAuthError('Only leader accounts can access this dashboard.');
          handleLeaderLogout();
          return;
        }

        setLeaderUser(user);
        localStorage.setItem('leader_user', JSON.stringify(user));
      })
      .catch(() => {
        handleLeaderLogout();
      });
  }, [leaderToken, handleLeaderLogout]);

  useEffect(() => {
    if (!lastUpdated) {
      setSecondsSinceUpdate(0);
      return;
    }

    const updateClock = () => {
      const elapsed = Math.max(0, Math.round((new Date().getTime() - lastUpdated.getTime()) / 1000));
      setSecondsSinceUpdate(elapsed);
    };

    updateClock();
    const timer = setInterval(updateClock, 1000);
    return () => clearInterval(timer);
  }, [lastUpdated]);

  const fetchData = useCallback(async () => {
    if (!leaderToken) return;

    try {
      const headers = { Authorization: `Bearer ${leaderToken}` };
      const [complaintsRes, statsRes] = await Promise.all([
        fetch('/api/complaints?limit=50', { headers }),
        fetch('/api/dashboard/stats', { headers }),
      ]);

      if (statsRes.status === 401 || statsRes.status === 403) {
        setAuthError('Leader session expired. Please login again.');
        handleLeaderLogout();
        setBackendOnline(false);
        return;
      }

      if (complaintsRes.ok) {
        const data = await complaintsRes.json();
        setComplaints(data.complaints || []);
      }

      if (statsRes.ok) {
        const data = await statsRes.json();
        setStats(data);
        setBackendOnline(true);
        setLastUpdated(new Date());
      } else {
        setBackendOnline(false);
      }
    } catch {
      setBackendOnline(false);
    }
  }, [leaderToken, handleLeaderLogout]);

  useEffect(() => {
    if (!leaderToken || !leaderUser) return;
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, [fetchData, leaderToken, leaderUser]);

  const handleLeaderLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError('');

    try {
      const res = await fetch('/api/auth/leader/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: leaderEmail.trim(), password: leaderPassword }),
      });

      const data = await res.json();
      if (!res.ok) {
        setAuthError(data?.detail || 'Unable to login as leader.');
        return;
      }

      setLeaderToken(data.token);
      setLeaderUser(data.user);
      localStorage.setItem('leader_token', data.token);
      localStorage.setItem('leader_user', JSON.stringify(data.user));
      setLeaderPassword('');
    } catch {
      setAuthError('Cannot connect to auth service.');
    } finally {
      setAuthLoading(false);
    }
  };

  const parseDetail = async (res: Response) => {
    try {
      const payload = await res.json();
      return payload?.detail || 'Request failed';
    } catch {
      return 'Request failed';
    }
  };

  const runLeaderAction = async (endpoint: string, body: Record<string, unknown>, successMessage: string) => {
    if (!leaderToken) return;
    setActionLoading(true);
    setActionMessage('');

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${leaderToken}`,
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const detail = await parseDetail(res);
        setActionMessage(`✕ ${detail}`);
        return;
      }

      setActionMessage(successMessage);
      await fetchData();
    } catch {
      setActionMessage('✕ Unable to update workflow right now.');
    } finally {
      setActionLoading(false);
    }
  };

  const selectedComplaint = complaints.find((c) => c.ticket_id === selectedTicket) || null;

  const kpis = stats ? [
    { label: 'Issues Tracked', value: String(stats.total_complaints), icon: '📋', color: '#3b82f6', change: `${stats.complaints_today} today` },
    { label: 'Resolution Rate', value: `${stats.resolution_rate}%`, icon: '✅', color: '#22c55e', change: `${stats.resolved_today} resolved today` },
    { label: 'P0 Active', value: String(stats.p0_active), icon: '🔴', color: '#ef4444', change: 'Critical issues' },
    { label: 'Pending Verify', value: String(stats.pending_verification), icon: '⚡', color: '#f59e0b', change: 'Awaiting check' },
    { label: 'Satisfaction', value: stats.satisfaction > 0 ? `${stats.satisfaction}/5` : 'N/A', icon: '⭐', color: '#8b5cf6', change: 'Citizen rating' },
  ] : DEFAULT_KPIS;

  if (authChecking) {
    return (
      <main className="main-content" style={{ minHeight: 'calc(100vh - var(--nav-height))', display: 'grid', placeItems: 'center', background: 'var(--bg-secondary)' }}>
        <div className="glass-card" style={{ width: 'min(420px, 92vw)', textAlign: 'center' }}>
          <h2 style={{ fontSize: '1.2rem', marginBottom: 8 }}>Verifying Leader Session</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Checking authentication...</p>
        </div>
      </main>
    );
  }

  if (!leaderToken || !leaderUser || leaderUser.role !== 'leader') {
    return (
      <main className="main-content" style={{ minHeight: 'calc(100vh - var(--nav-height))', display: 'grid', placeItems: 'center', background: 'var(--bg-secondary)' }}>
        <div className="glass-card" style={{ width: 'min(460px, 94vw)', padding: 28 }}>
          <div className="section-label" style={{ marginBottom: 10 }}>LEADER ACCESS</div>
          <h1 style={{ fontSize: '1.5rem', marginBottom: 8 }}>Leader Dashboard Login</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: 18 }}>
            Dashboard data is restricted to authenticated leader accounts only.
          </p>

          <form onSubmit={handleLeaderLogin}>
            <div className="form-group">
              <label className="form-label">Leader Email</label>
              <input
                type="email"
                className="form-input"
                value={leaderEmail}
                onChange={(e) => setLeaderEmail(e.target.value)}
                placeholder="leader@janshakti.ai"
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <input
                type="password"
                className="form-input"
                value={leaderPassword}
                onChange={(e) => setLeaderPassword(e.target.value)}
                placeholder="Enter leader password"
                required
              />
            </div>

            <button type="submit" className="btn btn-primary" disabled={authLoading} style={{ width: '100%', justifyContent: 'center' }}>
              {authLoading ? 'Signing in...' : 'Login to Leader Dashboard'}
            </button>
          </form>

          {authError && <div style={{ marginTop: 12, color: '#b91c1c', fontSize: '0.85rem' }}>✕ {authError}</div>}
          <div style={{ marginTop: 12, fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>
            Default leader email: leader@janshakti.ai
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="main-content">
      <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', minHeight: 'calc(100vh - var(--nav-height))' }}>
        {/* Sidebar */}
        <div style={{
          background: 'var(--bg-secondary)', borderRight: '1px solid var(--border-subtle)',
          padding: '24px 12px', position: 'sticky', top: 'var(--nav-height)',
          height: 'calc(100vh - var(--nav-height))', overflowY: 'auto',
        }}>
          <div style={{ padding: '8px 12px', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: 2, marginBottom: 8 }}>COMMAND CENTER</div>
          {[
            { key: 'overview', icon: '📊', label: 'Overview' },
            { key: 'complaints', icon: '📋', label: 'All Complaints' },
            { key: 'alerts', icon: '🚨', label: 'Smart Alerts' },
            { key: 'actions', icon: '📝', label: 'Action Queue' },
          ].map(item => (
            <div key={item.key} className="sidebar-item" onClick={() => setActiveView(item.key)}
              style={{
                background: activeView === item.key ? 'rgba(59,130,246,0.12)' : 'transparent',
                color: activeView === item.key ? 'var(--accent-blue-light)' : 'var(--text-secondary)',
                border: activeView === item.key ? '1px solid rgba(59,130,246,0.2)' : '1px solid transparent',
                marginBottom: 4,
              }}>
              <span>{item.icon}</span><span>{item.label}</span>
            </div>
          ))}

          <div style={{ padding: '16px 12px 8px', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: 2, marginTop: 16 }}>LIVE STATUS</div>
          <div style={{ padding: '0 12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>Backend</span>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: backendOnline ? '#22c55e' : '#ef4444' }}>{backendOnline ? '● Online' : '● Offline'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>Total Tickets</span>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#3b82f6' }}>{complaints.length}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>P0 Active</span>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#ef4444' }}>{complaints.filter(c => c.priority === 'P0').length}</span>
            </div>
          </div>

          <div style={{ padding: '24px 12px 8px' }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', marginBottom: 4 }}>Last Updated</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--accent-blue-light)', fontWeight: 600 }}>
              {lastUpdated ? `${secondsSinceUpdate}s ago` : 'Loading...'}
            </div>
            <button onClick={fetchData} style={{
              marginTop: 8, width: '100%', padding: '6px 0', borderRadius: 6,
              background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)',
              color: 'var(--accent-blue-light)', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600,
              fontFamily: 'Inter, sans-serif',
            }}>🔄 Refresh Now</button>
          </div>
        </div>

        {/* Main Content */}
        <div style={{ padding: 24, overflowY: 'auto' }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
            <div>
              <h1 style={{ fontSize: '1.8rem', fontWeight: 800, fontFamily: 'Outfit, sans-serif', marginBottom: 4 }}>
                🏛️ Leader&apos;s Command Dashboard
              </h1>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                {backendOnline ? 'Live data from AI backend — auto-refreshes every 15 seconds' : '⚠️ Backend offline — start it with: uvicorn main:app --port 8000'}
              </p>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: backendOnline ? '#22c55e' : '#ef4444', animation: backendOnline ? 'pulse 2s infinite' : 'none' }} />
              <span style={{ fontSize: '0.8rem', color: backendOnline ? '#22c55e' : '#ef4444' }}>{backendOnline ? 'Live' : 'Offline'}</span>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>{leaderUser.name}</span>
              <button className="btn btn-secondary" onClick={handleLeaderLogout} style={{ padding: '6px 12px', fontSize: '0.75rem' }}>
                Logout
              </button>
            </div>
          </div>

          {/* KPI Row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
            {kpis.map(kpi => (
              <div key={kpi.label} className="glass-card" style={{ padding: 20, position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: -10, right: -10, width: 60, height: 60, borderRadius: '50%', background: `${kpi.color}15` }} />
                <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', fontWeight: 600, marginBottom: 8 }}>{kpi.label}</div>
                <div style={{
                  fontSize: '2rem', fontWeight: 800, fontFamily: 'Outfit, sans-serif',
                  color: kpi.color, marginBottom: 4,
                }}>{kpi.value}</div>
                <div style={{ fontSize: '0.7rem', color: kpi.color, opacity: 0.8 }}>{kpi.change}</div>
              </div>
            ))}
          </div>

          {activeView === 'overview' && (
            <>
              {/* Charts Row */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 24 }}>
                {/* Trend Chart */}
                <div className="glass-card" style={{ padding: 24 }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 16 }}>📈 Trend Analytics (8 Weeks)</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {mockTrendData.map((week) => (
                      <div key={week.week} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', width: 24 }}>{week.week}</span>
                        <div style={{ flex: 1, display: 'flex', gap: 4, alignItems: 'center' }}>
                          <div style={{
                            height: 20, width: `${(week.complaints / 70) * 100}%`,
                            background: 'linear-gradient(90deg, #ef4444, #f97316)',
                            borderRadius: '4px 0 0 4px', display: 'flex', alignItems: 'center',
                            justifyContent: 'flex-end', paddingRight: 6,
                            fontSize: '0.6rem', color: 'white', fontWeight: 700, minWidth: 30,
                          }}>{week.complaints}</div>
                          <div style={{
                            height: 20, width: `${(week.resolved / 70) * 100}%`,
                            background: 'linear-gradient(90deg, #22c55e, #10b981)',
                            borderRadius: '0 4px 4px 0', display: 'flex', alignItems: 'center',
                            paddingLeft: 6, fontSize: '0.6rem', color: 'white', fontWeight: 700, minWidth: 30,
                          }}>{week.resolved}</div>
                        </div>
                        <span style={{ fontSize: '0.75rem', color: '#f59e0b', width: 32, textAlign: 'right' }}>⭐{week.satisfaction}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 16, marginTop: 12 }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>🔴 Complaints</span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>🟢 Resolved</span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>⭐ Satisfaction</span>
                  </div>
                </div>

                {/* Live Category Distribution from backend */}
                <div className="glass-card" style={{ padding: 24 }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 16 }}>📊 By Category {stats ? '(Live)' : ''}</h3>
                  {stats && stats.category_distribution && stats.category_distribution.length > 0 ? (
                    stats.category_distribution.map((cat) => {
                      const total = stats.total_complaints || 1;
                      const pct = Math.round((cat.value / total) * 100);
                      return (
                        <div key={cat.name} style={{ marginBottom: 12 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{cat.name}</span>
                            <span style={{ fontSize: '0.8rem', color: cat.color, fontWeight: 700 }}>{cat.value} ({pct}%)</span>
                          </div>
                          <div style={{ height: 6, background: 'var(--bg-tertiary)', borderRadius: 3 }}>
                            <div style={{ height: '100%', width: `${pct}%`, background: cat.color, borderRadius: 3, transition: 'width 0.5s' }} />
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    mockCategoryDistribution.map(cat => (
                      <div key={cat.name} style={{ marginBottom: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{cat.name}</span>
                          <span style={{ fontSize: '0.8rem', color: cat.color, fontWeight: 700 }}>{cat.value}%</span>
                        </div>
                        <div style={{ height: 6, background: 'var(--bg-tertiary)', borderRadius: 3 }}>
                          <div style={{ height: '100%', width: `${cat.value}%`, background: cat.color, borderRadius: 3, transition: 'width 0.5s' }} />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Heat Map & Alerts Row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
                <div className="glass-card" style={{ padding: 24 }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 16 }}>🗺️ Ward Heat Map</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                    {mockWardHeatData.map(ward => (
                      <div key={ward.ward} style={{
                        padding: 12, borderRadius: 8, textAlign: 'center',
                        background: ward.severity === 'high' ? 'rgba(239,68,68,0.15)' : ward.severity === 'medium' ? 'rgba(249,115,22,0.15)' : 'rgba(34,197,94,0.15)',
                        border: `1px solid ${ward.severity === 'high' ? 'rgba(239,68,68,0.3)' : ward.severity === 'medium' ? 'rgba(249,115,22,0.3)' : 'rgba(34,197,94,0.3)'}`,
                      }}>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', marginBottom: 4 }}>{ward.ward}</div>
                        <div style={{
                          fontSize: '1.2rem', fontWeight: 800, fontFamily: 'Outfit',
                          color: ward.severity === 'high' ? '#ef4444' : ward.severity === 'medium' ? '#f97316' : '#22c55e',
                        }}>{ward.complaints}</div>
                        <div style={{ fontSize: '0.6rem', color: 'var(--text-tertiary)' }}>complaints</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="glass-card" style={{ padding: 24 }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 16 }}>🚨 Smart Alerts</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {mockAlerts.map(alert => (
                      <div key={alert.id} style={{
                        display: 'flex', alignItems: 'flex-start', gap: 10, padding: 12, borderRadius: 8,
                        background: alert.type === 'critical' ? 'rgba(239,68,68,0.08)' : alert.type === 'warning' ? 'rgba(249,115,22,0.08)' : alert.type === 'success' ? 'rgba(34,197,94,0.08)' : 'rgba(59,130,246,0.08)',
                        border: `1px solid ${alert.type === 'critical' ? 'rgba(239,68,68,0.2)' : alert.type === 'warning' ? 'rgba(249,115,22,0.2)' : alert.type === 'success' ? 'rgba(34,197,94,0.2)' : 'rgba(59,130,246,0.2)'}`,
                      }}>
                        <span style={{ fontSize: '1.1rem' }}>{alert.icon}</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.4 }}>{alert.message}</div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', marginTop: 4 }}>{alert.time}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Recent Tickets from Live Backend */}
              <div className="glass-card" style={{ padding: 24, marginBottom: 24 }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 16 }}>
                  🆕 Recent Tickets {backendOnline && <span style={{ fontSize: '0.75rem', fontWeight: 400, color: '#22c55e' }}>(Live from DB)</span>}
                </h3>
                {complaints.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-tertiary)' }}>
                    {backendOnline ? 'No complaints filed yet. Go to Citizen Portal to file one!' : 'Start the backend to see live data here.'}
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                          {['Ticket', 'Title', 'Category', 'Ward', 'Priority', 'AI Score', 'Status', 'Input'].map(h => (
                            <th key={h} style={{ textAlign: 'left', padding: '10px 12px', fontSize: '0.75rem', color: 'var(--text-tertiary)', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {complaints.slice(0, 15).map(c => {
                          const sConfig = STATUS_CONFIG[c.status as keyof typeof STATUS_CONFIG];
                          return (
                            <tr key={c.ticket_id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                              <td style={{ padding: '12px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--accent-blue-light)' }}>{c.ticket_id}</td>
                              <td style={{ padding: '12px', fontSize: '0.85rem', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.title}</td>
                              <td style={{ padding: '12px' }}><span className="chip" style={{ fontSize: '0.7rem' }}>{c.category}</span></td>
                              <td style={{ padding: '12px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{c.ward}</td>
                              <td style={{ padding: '12px' }}><span className={`badge badge-${c.priority?.toLowerCase()}`} style={{ fontSize: '0.65rem' }}>{c.priority}</span></td>
                              <td style={{ padding: '12px', fontSize: '0.85rem', fontWeight: 700, color: c.ai_score > 80 ? '#ef4444' : c.ai_score > 50 ? '#f59e0b' : '#22c55e' }}>{c.ai_score}</td>
                              <td style={{ padding: '12px' }}>
                                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: sConfig?.color || '#64748b' }} />
                                  <span style={{ fontSize: '0.8rem', color: sConfig?.color || '#64748b' }}>{sConfig?.label || c.status}</span>
                                </span>
                              </td>
                              <td style={{ padding: '12px', fontSize: '0.8rem' }}>{c.input_mode === 'voice' ? '🎤' : c.input_mode === 'photo' ? '📸' : '💬'}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}

          {activeView === 'complaints' && (
            <div className="glass-card" style={{ padding: 24 }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 16 }}>
                📋 All Complaints {backendOnline && <span style={{ fontSize: '0.75rem', fontWeight: 400, color: '#22c55e' }}>({complaints.length} from DB)</span>}
              </h3>
              {complaints.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-tertiary)' }}>
                  {backendOnline ? 'No complaints yet. File one via Citizen Portal!' : 'Backend offline — start it to see live data.'}
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        {['Ticket', 'Title', 'Category', 'Ward', 'Priority', 'AI Score', 'Status', 'Input', 'Filed', 'Actions'].map(h => (
                          <th key={h} style={{ textAlign: 'left', padding: '10px 12px', fontSize: '0.75rem', color: 'var(--text-tertiary)', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {complaints.map(c => {
                        const sConfig = STATUS_CONFIG[c.status as keyof typeof STATUS_CONFIG];
                        return (
                          <tr key={c.ticket_id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                            <td style={{ padding: '12px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--accent-blue-light)' }}>{c.ticket_id}</td>
                            <td style={{ padding: '12px', fontSize: '0.85rem', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.title}</td>
                            <td style={{ padding: '12px' }}><span className="chip" style={{ fontSize: '0.7rem' }}>{c.category}</span></td>
                            <td style={{ padding: '12px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{c.ward}</td>
                            <td style={{ padding: '12px' }}><span className={`badge badge-${c.priority?.toLowerCase()}`} style={{ fontSize: '0.65rem' }}>{c.priority}</span></td>
                            <td style={{ padding: '12px', fontSize: '0.85rem', fontWeight: 700, color: c.ai_score > 80 ? '#ef4444' : c.ai_score > 50 ? '#f59e0b' : '#22c55e' }}>{c.ai_score}</td>
                            <td style={{ padding: '12px' }}>
                              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{ width: 6, height: 6, borderRadius: '50%', background: sConfig?.color || '#64748b' }} />
                                <span style={{ fontSize: '0.8rem', color: sConfig?.color || '#64748b' }}>{sConfig?.label || c.status}</span>
                              </span>
                            </td>
                            <td style={{ padding: '12px', fontSize: '0.8rem' }}>{c.input_mode === 'voice' ? '🎤' : c.input_mode === 'photo' ? '📸' : '💬'}</td>
                            <td style={{ padding: '12px', fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                              {c.created_at ? new Date(c.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '-'}
                            </td>
                            <td style={{ padding: '12px' }}>
                              <button
                                className="btn btn-secondary"
                                style={{ padding: '6px 10px', fontSize: '0.72rem' }}
                                onClick={() => {
                                  setSelectedTicket(c.ticket_id);
                                  setAuthorityName(c.assigned_authority || '');
                                  setLeaderNote('');
                                  setAuthorityResponse(c.authority_response || '');
                                  setActionMessage('');
                                }}
                              >
                                Manage
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {selectedComplaint && (
                <div style={{ marginTop: 20, padding: 18, borderRadius: 10, border: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 10 }}>
                    <div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>Workflow Control</div>
                      <div style={{ fontWeight: 700, color: 'var(--accent-blue-light)' }}>{selectedComplaint.ticket_id}</div>
                    </div>
                    <span className={`badge badge-${selectedComplaint.priority?.toLowerCase()}`}>{selectedComplaint.priority}</span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                    <input
                      className="form-input"
                      value={authorityName}
                      onChange={(e) => setAuthorityName(e.target.value)}
                      placeholder="Authority (e.g., Water Dept.)"
                    />
                    <input
                      className="form-input"
                      value={leaderNote}
                      onChange={(e) => setLeaderNote(e.target.value)}
                      placeholder="Leader note"
                    />
                  </div>

                  <textarea
                    className="form-textarea"
                    value={authorityResponse}
                    onChange={(e) => setAuthorityResponse(e.target.value)}
                    placeholder="Authority response / field update"
                    style={{ marginBottom: 10 }}
                  />

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    <button
                      className="btn btn-primary"
                      disabled={actionLoading}
                      onClick={() => runLeaderAction(
                        `/api/complaints/${selectedComplaint.ticket_id}/leader/assign`,
                        {
                          authority_name: authorityName || 'Concerned Authority',
                          assigned_team: selectedComplaint.assigned_to || null,
                          leader_note: leaderNote || null,
                        },
                        '✓ Assigned to authority'
                      )}
                    >Assign</button>

                    <button
                      className="btn btn-secondary"
                      disabled={actionLoading}
                      onClick={() => runLeaderAction(
                        `/api/complaints/${selectedComplaint.ticket_id}/leader/status`,
                        { status: 'in_progress', leader_note: leaderNote || null },
                        '✓ Marked in progress'
                      )}
                    >In Progress</button>

                    <button
                      className="btn btn-secondary"
                      disabled={actionLoading}
                      onClick={() => runLeaderAction(
                        `/api/complaints/${selectedComplaint.ticket_id}/authority/respond`,
                        {
                          authority_name: authorityName || 'Concerned Authority',
                          response: authorityResponse || 'Field team submitted update.',
                          mark_verification_ready: true,
                        },
                        '✓ Authority response recorded'
                      )}
                    >Authority Response</button>

                    <button
                      className="btn btn-secondary"
                      disabled={actionLoading}
                      onClick={() => runLeaderAction(
                        `/api/complaints/${selectedComplaint.ticket_id}/leader/status`,
                        { status: 'verification', leader_note: leaderNote || null },
                        '✓ Moved to verification'
                      )}
                    >Verification</button>

                    <button
                      className="btn btn-primary"
                      disabled={actionLoading}
                      onClick={() => runLeaderAction(
                        `/api/complaints/${selectedComplaint.ticket_id}/leader/resolve`,
                        {
                          resolution_note: leaderNote || authorityResponse || 'Resolved and verified by leader.',
                          citizen_update: `Leader verified completion for ${selectedComplaint.ticket_id}. Issue marked solved.`,
                        },
                        '✓ Marked as solved and notified'
                      )}
                    >Mark Solved</button>
                  </div>

                  {(selectedComplaint.citizen_update || actionMessage) && (
                    <div style={{ marginTop: 10, fontSize: '0.8rem', color: actionMessage.startsWith('✕') ? '#b91c1c' : 'var(--text-secondary)' }}>
                      {actionMessage || selectedComplaint.citizen_update}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {activeView === 'alerts' && (
            <div className="glass-card" style={{ padding: 24 }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 16 }}>🚨 All Smart Alerts</h3>
              {mockAlerts.map(alert => (
                <div key={alert.id} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 12, padding: 16, borderRadius: 10,
                  background: alert.type === 'critical' ? 'rgba(239,68,68,0.08)' : alert.type === 'warning' ? 'rgba(249,115,22,0.08)' : 'rgba(59,130,246,0.08)',
                  border: `1px solid ${alert.type === 'critical' ? 'rgba(239,68,68,0.2)' : 'transparent'}`,
                  marginBottom: 12,
                }}>
                  <span style={{ fontSize: '1.3rem' }}>{alert.icon}</span>
                  <div>
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>{alert.message}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>{alert.time}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeView === 'actions' && (
            <div className="glass-card" style={{ padding: 24 }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 16 }}>📝 AI-Ranked Action Queue</h3>
              {mockActionQueue.map(action => (
                <div key={action.rank} style={{
                  display: 'flex', alignItems: 'center', gap: 16, padding: 16, borderRadius: 10,
                  background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)', marginBottom: 12,
                }}>
                  <div style={{
                    width: 48, height: 48, borderRadius: '50%', display: 'flex',
                    alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '1.2rem',
                    background: action.rank <= 2 ? 'rgba(239,68,68,0.15)' : 'rgba(59,130,246,0.1)',
                    color: action.rank <= 2 ? '#ef4444' : 'var(--accent-blue-light)',
                    fontFamily: 'Outfit',
                  }}>#{action.rank}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>{action.task}</div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <span className={`badge badge-${action.priority.toLowerCase()}`}>{action.priority}</span>
                      <span className="chip">{action.category}</span>
                    </div>
                  </div>
                  <button className="btn btn-primary" style={{ padding: '8px 20px' }}>Take Action</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
