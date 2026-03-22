'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { STATUS_CONFIG } from '@/lib/mockData';

interface LiveComplaint {
  id: number;
  ticket_id: string;
  title: string;
  description: string;
  category: string;
  ward: string;
  priority: string;
  effective_priority?: string;
  ai_score: number;
  effective_ai_score?: number;
  urgency_score?: number | null;
  impact_score?: number | null;
  recurrence_score?: number | null;
  sentiment_score?: number | null;
  ai_explanation?: string | null;
  ai_model_version?: string | null;
  score_source?: string | null;
  ai_breakdown?: {
    recurrence_count?: number;
    local_cluster_count?: number;
    social_mentions?: number;
    qwen_reasoning?: string;
    qwen_fallback_reason?: string;
  } | null;
  status: string;
  input_mode: string;
  assigned_to: string | null;
  assigned_authority?: string | null;
  authority_email?: string | null;
  authority_response?: string | null;
  leader_note?: string | null;
  citizen_update?: string | null;
  image_path?: string | null;
  audio_path?: string | null;
  verification_status?: string | null;
  verification_score?: number | null;
  verification_confidence?: number | null;
  verification_engine?: string | null;
  verification_model?: string | null;
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
  avg_response_days: number;
  trust_index: number;
  complaints_today: number;
  resolved_today: number;
  p0_active: number;
  pending_verification: number;
  satisfaction: number;
  category_distribution: CategoryItem[];
  trend_data: { week: string; complaints: number; resolved: number; satisfaction: number }[];
  ward_heat_data: { ward: string; complaints: number; severity: string }[];
  alerts: { type: string; icon: string; message: string; time: string }[];
  action_queue: {
    rank: number;
    task: string;
    category: string;
    priority: string;
    ticket_id: string;
    effective_score?: number;
    starvation_bonus?: number;
    unresponded_hours?: number;
  }[];
  starvation_watch?: {
    unresponded_24h: number;
    unresponded_72h: number;
    stale_queue: { ticket_id: string; ward: string; category: string; age_hours: number; severity: string }[];
  };
  proactive_announcements?: { ward: string; alert_type: string; risk: string; signal_count: number; announcement: string }[];
  ward_drives?: { ward: string; focus_category: string; complaint_load: number; drive_title: string; playbook: string }[];
  misinfo_alerts?: { rumor_id: string; ward: string; severity: string; fact: string }[];
  fact_checks?: { claim: string; verdict: string; fact: string; confidence: number }[];
}

interface IncidentCluster {
  incident_id: string;
  ward: string;
  category: string;
  complaint_count: number;
  p0_count: number;
  risk_score: number;
  severity: 'critical' | 'high' | 'medium';
  tickets: string[];
}

interface VerificationRequestItem {
  ticket_id: string;
  title: string;
  category: string;
  ward: string;
  status: string;
  priority: string;
  effective_priority?: string;
  effective_ai_score?: number;
  assigned_authority?: string | null;
  authority_email?: string | null;
  authority_response?: string | null;
  before_photo?: string | null;
  after_photo?: string | null;
  verification_status?: string | null;
  verification_score?: number | null;
  verification_confidence?: number | null;
  verification_engine?: string | null;
  verification_model?: string | null;
  verification_explanation?: string | null;
  created_at?: string | null;
}

const DEFAULT_KPIS = [
  { label: 'Issues Tracked', value: '0', icon: '📋', color: '#3b82f6', change: 'Live from DB' },
  { label: 'Resolution Rate', value: '0%', icon: '✅', color: '#22c55e', change: 'Resolved / Total' },
  { label: 'Open Issues', value: '0', icon: '🔴', color: '#ef4444', change: 'Needs attention' },
  { label: 'In Progress', value: '0', icon: '⚡', color: '#f59e0b', change: 'Being worked on' },
  { label: 'Avg AI Score', value: '0', icon: '🤖', color: '#8b5cf6', change: 'Priority score' },
];

function safeStorageGet(key: string): string {
  if (typeof window === 'undefined') return '';
  try {
    return window.localStorage.getItem(key) || '';
  } catch {
    return '';
  }
}

function safeStorageSet(key: string, value: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Ignore storage write failures in restricted contexts.
  }
}

function safeStorageRemove(key: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore storage removal failures in restricted contexts.
  }
}

export default function DashboardPage() {
  const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8010';

  const [activeView, setActiveView] = useState('overview');
  const [complaints, setComplaints] = useState<LiveComplaint[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [incidents, setIncidents] = useState<IncidentCluster[]>([]);
  const [verificationRequests, setVerificationRequests] = useState<VerificationRequestItem[]>([]);
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
  const [authorityEmail, setAuthorityEmail] = useState('');
  const [authorityResponse, setAuthorityResponse] = useState('');
  const [leaderNote, setLeaderNote] = useState('');
  const [mailSubject, setMailSubject] = useState('');
  const [mailMessage, setMailMessage] = useState('');
  const [beforePhotoFile, setBeforePhotoFile] = useState<File | null>(null);
  const [afterPhotoFile, setAfterPhotoFile] = useState<File | null>(null);
  const [geoLat, setGeoLat] = useState('');
  const [geoLon, setGeoLon] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const assignPanelRef = useRef<HTMLDivElement | null>(null);

  const handleLeaderLogout = useCallback(() => {
    setLeaderToken('');
    setLeaderUser(null);
    setStats(null);
    setComplaints([]);
    safeStorageRemove('leader_token');
    safeStorageRemove('leader_user');
  }, []);

  useEffect(() => {
    const token = safeStorageGet('leader_token');
    const userRaw = safeStorageGet('leader_user');

    if (!token || !userRaw) {
      setAuthChecking(false);
      return;
    }

    try {
      const parsed = JSON.parse(userRaw) as { id: number; name: string; email: string; role: string };
      setLeaderToken(token);
      setLeaderUser(parsed);
    } catch {
      safeStorageRemove('leader_token');
      safeStorageRemove('leader_user');
    } finally {
      setAuthChecking(false);
    }
  }, []);

  useEffect(() => {
    if (!leaderToken) return;

    fetch(`${API_BASE}/api/auth/me`, {
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
        safeStorageSet('leader_user', JSON.stringify(user));
      })
      .catch(() => {
        handleLeaderLogout();
      });
  }, [leaderToken, handleLeaderLogout, API_BASE]);

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
      const [complaintsRes, statsRes, incidentsRes, verificationRes] = await Promise.all([
        fetch(`${API_BASE}/api/complaints?limit=50`, { headers }),
        fetch(`${API_BASE}/api/dashboard/stats`, { headers }),
        fetch(`${API_BASE}/api/complaints/incidents/summary?limit=8`, { headers }),
        fetch(`${API_BASE}/api/complaints/leader/verification-requests?limit=40`, { headers }),
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

      if (incidentsRes.ok) {
        const data = await incidentsRes.json();
        setIncidents(data.incidents || []);
      } else {
        setIncidents([]);
      }

      if (verificationRes.ok) {
        const data = await verificationRes.json();
        setVerificationRequests(data.requests || []);
      } else {
        setVerificationRequests([]);
      }
    } catch {
      setBackendOnline(false);
      setIncidents([]);
      setVerificationRequests([]);
    }
  }, [leaderToken, handleLeaderLogout, API_BASE]);

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
      const res = await fetch(`${API_BASE}/api/auth/leader/login`, {
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
      safeStorageSet('leader_token', data.token);
      safeStorageSet('leader_user', JSON.stringify(data.user));
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

  const buildMediaUrl = (path?: string | null): string => {
    if (!path) return '';
    if (path.startsWith('http://') || path.startsWith('https://')) return path;
    const normalized = path.startsWith('/') ? path.slice(1) : path;
    return `${API_BASE}/${normalized}`;
  };

  const runLeaderAction = async (endpoint: string, body: Record<string, unknown>, successMessage: string) => {
    if (!leaderToken) return;
    setActionLoading(true);
    setActionMessage('');

    try {
      const actionUrl = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;
      const res = await fetch(actionUrl, {
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

      const payload = await res.json().catch(() => null);
      if (payload?.delivery?.mode === 'mailto_fallback' && payload?.delivery?.mailto_url) {
        setActionMessage(`${successMessage} | Open: ${payload.delivery.mailto_url}`);
      } else {
        setActionMessage(successMessage);
      }
      await fetchData();
    } catch {
      setActionMessage('✕ Unable to update workflow right now.');
    } finally {
      setActionLoading(false);
    }
  };

  const uploadVerificationPhoto = async (stage: 'before' | 'after') => {
    if (!leaderToken || !selectedComplaint) return;
    const file = stage === 'before' ? beforePhotoFile : afterPhotoFile;
    if (!file) {
      setActionMessage(`✕ Select a ${stage} photo first.`);
      return;
    }

    setActionLoading(true);
    setActionMessage('');
    try {
      const formData = new FormData();
      formData.append('photo', file);
      if (geoLat.trim()) formData.append('latitude', geoLat.trim());
      if (geoLon.trim()) formData.append('longitude', geoLon.trim());
      formData.append('captured_at', new Date().toISOString());

      const res = await fetch(`${API_BASE}/api/complaints/${selectedComplaint.ticket_id}/verification/${stage}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${leaderToken}` },
        body: formData,
      });

      if (!res.ok) {
        const detail = await parseDetail(res);
        setActionMessage(`✕ ${detail}`);
        return;
      }

      setActionMessage(`✓ ${stage === 'before' ? 'Before' : 'After'} photo uploaded for verification`);
      await fetchData();
    } catch {
      setActionMessage('✕ Failed to upload verification photo');
    } finally {
      setActionLoading(false);
    }
  };

  const runAiVerification = async () => {
    if (!leaderToken || !selectedComplaint) return;
    setActionLoading(true);
    setActionMessage('');

    try {
      const res = await fetch(`${API_BASE}/api/complaints/${selectedComplaint.ticket_id}/verification/run`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${leaderToken}` },
      });

      if (!res.ok) {
        const detail = await parseDetail(res);
        setActionMessage(`✕ ${detail}`);
        return;
      }

      const payload = await res.json();
      const engine = payload?.verification_engine ? ` via ${payload.verification_engine}` : '';
      const model = payload?.verification_model ? ` (${payload.verification_model})` : '';
      setActionMessage(`✓ Verification ${payload.verification_status} (score ${payload.verification_score}/100)${engine}${model}`);
      await fetchData();
    } catch {
      setActionMessage('✕ Verification engine failed');
    } finally {
      setActionLoading(false);
    }
  };

  const openManagePanel = useCallback((ticketId: string) => {
    setActiveView('complaints');
    setSelectedTicket(ticketId);
    setActionMessage('');
    setTimeout(() => {
      assignPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 120);
  }, []);

  const selectedComplaint = complaints.find((c) => c.ticket_id === selectedTicket) || null;

  useEffect(() => {
    if (activeView !== 'complaints' || !selectedTicket) return;
    const timer = setTimeout(() => {
      assignPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
    return () => clearTimeout(timer);
  }, [activeView, selectedTicket]);

  const kpis = stats ? [
    { label: 'Issues Tracked', value: String(stats.total_complaints), icon: '📋', color: '#3b82f6', change: `${stats.complaints_today} today` },
    { label: 'Resolution Rate', value: `${stats.resolution_rate}%`, icon: '✅', color: '#22c55e', change: `${stats.resolved_today} resolved today` },
    { label: 'P0 Active', value: String(stats.p0_active), icon: '🔴', color: '#ef4444', change: 'Critical issues' },
    { label: 'Pending Verify', value: String(stats.pending_verification), icon: '⚡', color: '#f59e0b', change: 'Awaiting check' },
    { label: 'Trust Index', value: `${stats.trust_index}/100`, icon: '🛡️', color: '#8b5cf6', change: `${stats.avg_response_days} day avg response` },
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
                {backendOnline ? 'Live data from AI backend — auto-refreshes every 15 seconds' : '⚠️ Backend offline — start it with: uvicorn main:app --port 8010'}
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
                    {(stats?.trend_data || []).map((week) => (
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
                    <div style={{ color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>No category distribution available yet.</div>
                  )}
                </div>
              </div>

              {/* Heat Map & Alerts Row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
                <div className="glass-card" style={{ padding: 24 }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 16 }}>🗺️ Ward Heat Map</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                    {(stats?.ward_heat_data || []).map(ward => (
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
                    {(stats?.alerts || []).map((alert, idx) => (
                      <div key={`${alert.type}-${idx}`} style={{
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

              <div className="glass-card" style={{ padding: 24, marginBottom: 24 }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 14 }}>
                  ✅ Authority Completion Queue
                  <span style={{ fontSize: '0.75rem', fontWeight: 500, color: '#f59e0b', marginLeft: 8 }}>
                    ({verificationRequests.length} awaiting leader verification)
                  </span>
                </h3>

                {verificationRequests.length === 0 ? (
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-tertiary)' }}>
                    No authority-marked completion requests right now.
                  </div>
                ) : (
                  <div style={{ display: 'grid', gap: 12 }}>
                    {verificationRequests.slice(0, 8).map((req) => (
                      <div key={req.ticket_id} style={{ border: '1px solid var(--border-subtle)', borderRadius: 10, padding: 12, background: 'var(--bg-tertiary)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
                          <div>
                            <div style={{ fontSize: '0.78rem', color: 'var(--accent-blue-light)', fontWeight: 700 }}>{req.ticket_id}</div>
                            <div style={{ fontWeight: 700 }}>{req.title}</div>
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>{req.ward} • {req.category} • {req.assigned_authority || 'Authority'}</div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <span className={`badge badge-${(req.effective_priority || req.priority || 'p3').toLowerCase()}`}>{req.effective_priority || req.priority}</span>
                            <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginTop: 4 }}>
                              Verify: <strong>{req.verification_status || 'pending_review'}</strong>
                            </div>
                          </div>
                        </div>

                        {(req.before_photo || req.after_photo) && (
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 8, marginTop: 10 }}>
                            {req.before_photo && (
                              <div>
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', marginBottom: 4 }}>Before</div>
                                <img src={buildMediaUrl(req.before_photo)} alt="Before evidence" style={{ width: '100%', borderRadius: 8, border: '1px solid var(--border-subtle)' }} />
                              </div>
                            )}
                            {req.after_photo && (
                              <div>
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', marginBottom: 4 }}>After</div>
                                <img src={buildMediaUrl(req.after_photo)} alt="After evidence" style={{ width: '100%', borderRadius: 8, border: '1px solid var(--border-subtle)' }} />
                              </div>
                            )}
                          </div>
                        )}

                        <div style={{ marginTop: 8, fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                          AI check result: {typeof req.verification_score === 'number' ? `${req.verification_score}/100` : 'pending'}
                          {typeof req.verification_confidence === 'number' ? ` • confidence ${req.verification_confidence}%` : ''}
                        </div>
                        {(req.verification_engine || req.verification_model) && (
                          <div style={{ marginTop: 4, fontSize: '0.74rem', color: 'var(--text-tertiary)' }}>
                            Engine: {req.verification_engine || 'unknown'}{req.verification_model ? ` • ${req.verification_model}` : ''}
                          </div>
                        )}
                        {req.verification_explanation && (
                          <div style={{ marginTop: 4, fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{req.verification_explanation}</div>
                        )}

                        <div style={{ marginTop: 10 }}>
                          <button
                            className="btn btn-secondary"
                            style={{ padding: '6px 12px', fontSize: '0.74rem' }}
                            onClick={() => {
                              openManagePanel(req.ticket_id);
                            }}
                          >
                            Open In Leader Verification Workspace
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Incident Clusters */}
              <div className="glass-card" style={{ padding: 24, marginBottom: 24 }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 16 }}>🧠 Incident Clusters (AI Merged)</h3>
                {incidents.length === 0 ? (
                  <div style={{ color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>No active clusters detected in the selected window.</div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
                    {incidents.map((incident) => (
                      <div key={incident.incident_id} style={{
                        borderRadius: 10,
                        border: '1px solid var(--border-subtle)',
                        background: incident.severity === 'critical' ? 'rgba(239,68,68,0.08)' : incident.severity === 'high' ? 'rgba(249,115,22,0.08)' : 'rgba(59,130,246,0.08)',
                        padding: 12,
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                          <strong style={{ fontSize: '0.82rem' }}>{incident.incident_id}</strong>
                          <span className={`badge badge-${incident.severity === 'critical' ? 'p0' : incident.severity === 'high' ? 'p1' : 'p2'}`}>{incident.severity}</span>
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{incident.category} • {incident.ward}</div>
                        <div style={{ marginTop: 6, fontSize: '0.78rem' }}>
                          Complaints: <strong>{incident.complaint_count}</strong> | P0: <strong>{incident.p0_count}</strong>
                        </div>
                        <div style={{ marginTop: 4, fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>
                          Risk score: {incident.risk_score}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
                <div className="glass-card" style={{ padding: 24 }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 12 }}>📢 Proactive Announcements</h3>
                  {(stats?.proactive_announcements || []).slice(0, 4).map((a, idx) => (
                    <div key={`${a.ward}-${idx}`} style={{ borderBottom: '1px solid var(--border-subtle)', padding: '8px 0' }}>
                      <div style={{ fontSize: '0.8rem', fontWeight: 700 }}>{a.alert_type} • {a.ward}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{a.announcement}</div>
                    </div>
                  ))}
                  {(!stats?.proactive_announcements || stats.proactive_announcements.length === 0) && (
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-tertiary)' }}>No proactive advisories triggered.</div>
                  )}
                </div>

                <div className="glass-card" style={{ padding: 24 }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 12 }}>🔎 Rumor Fact Check</h3>
                  {(stats?.fact_checks || []).slice(0, 3).map((f, idx) => (
                    <div key={`${f.claim}-${idx}`} style={{ borderBottom: '1px solid var(--border-subtle)', padding: '8px 0' }}>
                      <div style={{ fontSize: '0.78rem' }}><strong>Claim:</strong> {f.claim}</div>
                      <div style={{ fontSize: '0.78rem' }}><strong>Verdict:</strong> {f.verdict}</div>
                      <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>{f.fact}</div>
                    </div>
                  ))}
                  {(!stats?.fact_checks || stats.fact_checks.length === 0) && (
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-tertiary)' }}>No high-risk rumor patterns detected.</div>
                  )}
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
                              <td style={{ padding: '12px' }}><span className={`badge badge-${(c.effective_priority || c.priority)?.toLowerCase()}`} style={{ fontSize: '0.65rem' }}>{c.effective_priority || c.priority}</span></td>
                              <td style={{ padding: '12px', fontSize: '0.85rem', fontWeight: 700, color: (c.effective_ai_score || c.ai_score) > 80 ? '#ef4444' : (c.effective_ai_score || c.ai_score) > 50 ? '#f59e0b' : '#22c55e' }}>
                                {Math.round(c.effective_ai_score || c.ai_score)}
                                <div style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)', fontWeight: 500 }}>
                                  {c.score_source === 'qwen' ? 'Qwen LLM' : 'Fallback'}
                                </div>
                              </td>
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
                            <td style={{ padding: '12px' }}><span className={`badge badge-${(c.effective_priority || c.priority)?.toLowerCase()}`} style={{ fontSize: '0.65rem' }}>{c.effective_priority || c.priority}</span></td>
                            <td style={{ padding: '12px', fontSize: '0.85rem', fontWeight: 700, color: (c.effective_ai_score || c.ai_score) > 80 ? '#ef4444' : (c.effective_ai_score || c.ai_score) > 50 ? '#f59e0b' : '#22c55e' }}>
                              {Math.round(c.effective_ai_score || c.ai_score)}
                              <div style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)', fontWeight: 500 }}>
                                {c.score_source === 'qwen' ? 'Qwen LLM' : 'Fallback'}
                              </div>
                            </td>
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
                                  openManagePanel(c.ticket_id);
                                  setAuthorityName(c.assigned_authority || '');
                                  setAuthorityEmail(c.authority_email || '');
                                  setLeaderNote(c.leader_note || '');
                                  setAuthorityResponse(c.authority_response || '');
                                  setMailSubject(`Action Required: ${c.ticket_id} (${c.priority})`);
                                  setMailMessage(`Please take action on ticket ${c.ticket_id} (${c.category}, ${c.ward}).\n\nIssue: ${c.title}`);
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
                <div ref={assignPanelRef} style={{ marginTop: 20, padding: 18, borderRadius: 10, border: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 10 }}>
                    <div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>Workflow Control</div>
                      <div style={{ fontWeight: 700, color: 'var(--accent-blue-light)' }}>{selectedComplaint.ticket_id}</div>
                    </div>
                    <span className={`badge badge-${(selectedComplaint.effective_priority || selectedComplaint.priority)?.toLowerCase()}`}>{selectedComplaint.effective_priority || selectedComplaint.priority}</span>
                  </div>

                  <div style={{ marginBottom: 10, padding: 10, borderRadius: 8, background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)' }}>
                    <div style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--accent-blue-light)', marginBottom: 6 }}>AI PRIORITY BREAKDOWN</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                      <span className="chip" style={{ fontSize: '0.68rem' }}>
                        Engine: {selectedComplaint.score_source === 'qwen' ? 'Qwen LLM' : 'Heuristic Fallback'}
                      </span>
                      {selectedComplaint.ai_model_version && (
                        <span className="chip" style={{ fontSize: '0.68rem' }}>Model: {selectedComplaint.ai_model_version}</span>
                      )}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8, fontSize: '0.8rem' }}>
                      <div><strong>Score:</strong> {Math.round(selectedComplaint.effective_ai_score || selectedComplaint.ai_score)}/100</div>
                      <div><strong>Urgency:</strong> {Math.round(selectedComplaint.urgency_score || 0)}</div>
                      <div><strong>Impact:</strong> {Math.round(selectedComplaint.impact_score || 0)}</div>
                      <div><strong>Recurrence:</strong> {Math.round(selectedComplaint.recurrence_score || 0)}</div>
                      <div><strong>Sentiment:</strong> {Math.round(selectedComplaint.sentiment_score || 0)}</div>
                    </div>
                    {(selectedComplaint.ai_breakdown?.recurrence_count || selectedComplaint.ai_breakdown?.local_cluster_count) ? (
                      <div style={{ marginTop: 6, fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                        Repeat reports: {selectedComplaint.ai_breakdown?.recurrence_count || 0} • Nearby cluster: {selectedComplaint.ai_breakdown?.local_cluster_count || 0}
                      </div>
                    ) : null}
                    {selectedComplaint.ai_explanation && (
                      <div style={{ marginTop: 6, fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                        {selectedComplaint.ai_explanation}
                      </div>
                    )}
                    {selectedComplaint.ai_breakdown?.qwen_reasoning && (
                      <div style={{ marginTop: 6, fontSize: '0.76rem', color: '#0f766e' }}>
                        Qwen reasoning: {selectedComplaint.ai_breakdown.qwen_reasoning}
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10, marginBottom: 10 }}>
                    <input
                      className="form-input"
                      value={authorityName}
                      onChange={(e) => setAuthorityName(e.target.value)}
                      placeholder="Authority (e.g., Water Dept.)"
                    />
                    <input
                      className="form-input"
                      value={authorityEmail}
                      onChange={(e) => setAuthorityEmail(e.target.value)}
                      placeholder="Authority email (dept@example.gov.in)"
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

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                    <input
                      className="form-input"
                      value={mailSubject}
                      onChange={(e) => setMailSubject(e.target.value)}
                      placeholder="Mail subject"
                    />
                    <input
                      className="form-input"
                      value={mailMessage}
                      onChange={(e) => setMailMessage(e.target.value)}
                      placeholder="Mail message summary"
                    />
                  </div>

                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                    gap: 10,
                    marginBottom: 10,
                    padding: 10,
                    borderRadius: 8,
                    background: 'rgba(59,130,246,0.06)',
                    border: '1px solid rgba(59,130,246,0.2)',
                  }}>
                    <div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', marginBottom: 6 }}>Before Photo</div>
                      <input type="file" accept="image/*" onChange={(e) => setBeforePhotoFile(e.target.files?.[0] || null)} />
                      <button className="btn btn-secondary" style={{ marginTop: 6, padding: '6px 10px', fontSize: '0.72rem' }} onClick={() => uploadVerificationPhoto('before')} disabled={actionLoading}>Upload Before</button>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', marginBottom: 6 }}>After Photo</div>
                      <input type="file" accept="image/*" onChange={(e) => setAfterPhotoFile(e.target.files?.[0] || null)} />
                      <button className="btn btn-secondary" style={{ marginTop: 6, padding: '6px 10px', fontSize: '0.72rem' }} onClick={() => uploadVerificationPhoto('after')} disabled={actionLoading}>Upload After</button>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', marginBottom: 6 }}>Geo Latitude</div>
                      <input className="form-input" value={geoLat} onChange={(e) => setGeoLat(e.target.value)} placeholder="25.3176" />
                    </div>
                    <div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', marginBottom: 6 }}>Geo Longitude</div>
                      <input className="form-input" value={geoLon} onChange={(e) => setGeoLon(e.target.value)} placeholder="82.9739" />
                    </div>
                  </div>

                  <div style={{ marginBottom: 10, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    Verification: <strong>{selectedComplaint.verification_status || 'not_started'}</strong>
                    {typeof selectedComplaint.verification_score === 'number' && (
                      <span> | Score: <strong>{selectedComplaint.verification_score}</strong></span>
                    )}
                    {typeof selectedComplaint.verification_confidence === 'number' && (
                      <span> | Confidence: <strong>{selectedComplaint.verification_confidence}</strong></span>
                    )}
                    {selectedComplaint.verification_engine && (
                      <span> | Engine: <strong>{selectedComplaint.verification_engine}</strong></span>
                    )}
                    {selectedComplaint.verification_model && (
                      <span> | Model: <strong>{selectedComplaint.verification_model}</strong></span>
                    )}
                  </div>

                  {(selectedComplaint.image_path || selectedComplaint.audio_path) && (
                    <div style={{ marginBottom: 10, padding: 10, borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'rgba(34,197,94,0.05)' }}>
                      <div style={{ fontSize: '0.78rem', fontWeight: 700, marginBottom: 8 }}>Citizen Uploaded Media</div>
                      {selectedComplaint.image_path && (
                        <div style={{ marginBottom: 8 }}>
                          <a href={buildMediaUrl(selectedComplaint.image_path)} target="_blank" rel="noreferrer" style={{ fontSize: '0.78rem' }}>Open image</a>
                          <img
                            src={buildMediaUrl(selectedComplaint.image_path)}
                            alt="Citizen uploaded issue"
                            style={{ marginTop: 6, display: 'block', width: '100%', maxWidth: 320, borderRadius: 8, border: '1px solid var(--border-subtle)' }}
                          />
                        </div>
                      )}
                      {selectedComplaint.audio_path && (
                        <div>
                          <a href={buildMediaUrl(selectedComplaint.audio_path)} target="_blank" rel="noreferrer" style={{ fontSize: '0.78rem' }}>Open audio</a>
                          <audio controls src={buildMediaUrl(selectedComplaint.audio_path)} style={{ marginTop: 6, width: '100%', maxWidth: 360 }} />
                        </div>
                      )}
                    </div>
                  )}

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    <button
                      className="btn btn-primary"
                      disabled={actionLoading}
                      onClick={() => runLeaderAction(
                        `/api/complaints/${selectedComplaint.ticket_id}/leader/assign`,
                        {
                          authority_name: authorityName || 'Concerned Authority',
                          authority_email: authorityEmail || null,
                          assigned_team: selectedComplaint.assigned_to || null,
                          leader_note: leaderNote || null,
                        },
                        '✓ Assigned to authority'
                      )}
                    >Assign</button>

                    <button
                      className="btn btn-secondary"
                      disabled={actionLoading || !authorityName || !authorityEmail}
                      onClick={() => runLeaderAction(
                        `/api/complaints/${selectedComplaint.ticket_id}/leader/mail-authority`,
                        {
                          authority_name: authorityName,
                          authority_email: authorityEmail,
                          subject: mailSubject || null,
                          message: mailMessage || null,
                        },
                        '✓ Authority mail dispatched (or mailto prepared)'
                      )}
                    >Mail Authority</button>

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
                          mark_verification_ready: false,
                        },
                        '✓ Authority response recorded'
                      )}
                    >Save Response</button>

                    <button
                      className="btn btn-secondary"
                      disabled={actionLoading}
                      onClick={() => runLeaderAction(
                        `/api/complaints/${selectedComplaint.ticket_id}/authority/respond`,
                        {
                          authority_name: authorityName || 'Concerned Authority',
                          response: authorityResponse || 'Work completed by authority.',
                          mark_verification_ready: true,
                        },
                        '✓ Sent to verification queue'
                      )}
                    >Ready for Verification</button>

                    <button
                      className="btn btn-secondary"
                      disabled={actionLoading}
                      onClick={() => runLeaderAction(
                        `/api/complaints/${selectedComplaint.ticket_id}/leader/status`,
                        { status: 'verification', leader_note: leaderNote || null },
                        '✓ Moved to verification'
                      )}
                    >Verification</button>

                    <button className="btn btn-secondary" disabled={actionLoading} onClick={runAiVerification}>Run AI Verify</button>

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

                    <button
                      className="btn btn-secondary"
                      disabled={actionLoading}
                      onClick={() => runLeaderAction(
                        `/api/complaints/${selectedComplaint.ticket_id}/leader/status`,
                        { status: 'open', leader_note: leaderNote || 'Reopened by leader for additional work.' },
                        '✓ Complaint reopened for additional action'
                      )}
                    >Reopen</button>
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
              {(stats?.alerts || []).map((alert, idx) => (
                <div key={`${alert.type}-${idx}`} style={{
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
              {(stats?.action_queue || []).map(action => (
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
                    <div style={{ marginTop: 6, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      Score {action.effective_score ?? '-'}
                      {typeof action.starvation_bonus === 'number' && action.starvation_bonus > 0 ? ` • Starvation +${action.starvation_bonus}` : ''}
                      {typeof action.unresponded_hours === 'number' ? ` • ${action.unresponded_hours}h waiting` : ''}
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
