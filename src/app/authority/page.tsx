'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { STATUS_CONFIG } from '@/lib/mockData';

interface AuthorityComplaint {
  ticket_id: string;
  title: string;
  description: string;
  category: string;
  ward: string;
  priority: 'P0' | 'P1' | 'P2' | 'P3' | string;
  status: string;
  assigned_authority?: string | null;
  authority_email?: string | null;
  leader_note?: string | null;
  authority_response?: string | null;
  citizen_update?: string | null;
  image_path?: string | null;
  audio_path?: string | null;
  verification_status?: string | null;
  verification_score?: number | null;
  verification_confidence?: number | null;
  before_photo?: string | null;
  after_photo?: string | null;
  created_at?: string | null;
}

interface AuthorityUser {
  id: number;
  name: string;
  email: string;
  role: string;
}

interface ComplaintActivityItem {
  actor_role: string;
  actor_name?: string | null;
  action: string;
  note?: string | null;
  created_at?: string | null;
}

interface ComplaintDetail {
  activity?: ComplaintActivityItem[];
}

function storageGet(key: string): string {
  if (typeof window === 'undefined') return '';
  try {
    return window.localStorage.getItem(key) || '';
  } catch {
    return '';
  }
}

function storageSet(key: string, value: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Ignore storage errors.
  }
}

function storageRemove(key: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore storage errors.
  }
}

export default function AuthorityPage() {
  const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8010';

  const [token, setToken] = useState('');
  const [user, setUser] = useState<AuthorityUser | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [queue, setQueue] = useState<AuthorityComplaint[]>([]);
  const [selectedTicket, setSelectedTicket] = useState('');
  const [selectedDetail, setSelectedDetail] = useState<ComplaintDetail | null>(null);
  const [statusFilter, setStatusFilter] = useState('all');

  const [note, setNote] = useState('');
  const [message, setMessage] = useState('');
  const [blocker, setBlocker] = useState(false);
  const [requestVerification, setRequestVerification] = useState(false);

  const [beforePhoto, setBeforePhoto] = useState<File | null>(null);
  const [afterPhoto, setAfterPhoto] = useState<File | null>(null);

  const [loadingAction, setLoadingAction] = useState(false);
  const [feedback, setFeedback] = useState('');

  const logout = useCallback(() => {
    setToken('');
    setUser(null);
    setQueue([]);
    setSelectedTicket('');
    setSelectedDetail(null);
    storageRemove('authority_token');
    storageRemove('authority_user');
  }, []);

  useEffect(() => {
    const storedToken = storageGet('authority_token');
    const storedUser = storageGet('authority_user');

    if (!storedToken || !storedUser) {
      setCheckingAuth(false);
      return;
    }

    try {
      setToken(storedToken);
      setUser(JSON.parse(storedUser));
    } catch {
      storageRemove('authority_token');
      storageRemove('authority_user');
    } finally {
      setCheckingAuth(false);
    }
  }, []);

  useEffect(() => {
    if (!token) return;

    fetch(`${API_BASE}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (res) => {
        if (!res.ok) {
          logout();
          return;
        }

        const me = await res.json();
        if (me?.role !== 'authority') {
          setAuthError('Only authority accounts can access this panel.');
          logout();
          return;
        }

        setUser(me);
        storageSet('authority_user', JSON.stringify(me));
      })
      .catch(() => {
        logout();
      });
  }, [token, logout, API_BASE]);

  const parseDetail = async (res: Response) => {
    try {
      const body = await res.json();
      return body?.detail || 'Request failed';
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

  const fetchQueue = useCallback(async () => {
    if (!token) return;

    try {
      const query = statusFilter === 'all' ? '' : `&status=${encodeURIComponent(statusFilter)}`;
      const res = await fetch(`${API_BASE}/api/complaints/authority/my?limit=120${query}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 401 || res.status === 403) {
        setAuthError('Authority session expired. Login again.');
        logout();
        return;
      }

      if (!res.ok) return;
      const data = await res.json();
      const complaints: AuthorityComplaint[] = data?.complaints || [];
      setQueue(complaints);
      if (!selectedTicket && complaints.length > 0) {
        setSelectedTicket(complaints[0].ticket_id);
      }
    } catch {
      // Ignore transient polling failures.
    }
  }, [token, statusFilter, selectedTicket, logout, API_BASE]);

  const fetchSelectedDetail = useCallback(async () => {
    if (!selectedTicket) {
      setSelectedDetail(null);
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/complaints/${selectedTicket}`);
      if (!res.ok) {
        setSelectedDetail(null);
        return;
      }
      const payload = await res.json();
      setSelectedDetail(payload);
    } catch {
      setSelectedDetail(null);
    }
  }, [selectedTicket, API_BASE]);

  useEffect(() => {
    if (!token || !user) return;
    fetchQueue();
    const interval = setInterval(fetchQueue, 12000);
    return () => clearInterval(interval);
  }, [token, user, fetchQueue]);

  useEffect(() => {
    fetchSelectedDetail();
  }, [fetchSelectedDetail]);

  const selectedComplaint = useMemo(
    () => queue.find((item) => item.ticket_id === selectedTicket) || null,
    [queue, selectedTicket],
  );

  const stats = useMemo(() => {
    const total = queue.length;
    const inProgress = queue.filter((q) => q.status === 'in_progress').length;
    const assigned = queue.filter((q) => q.status === 'assigned').length;
    const verification = queue.filter((q) => q.status === 'verification').length;
    return { total, inProgress, assigned, verification };
  }, [queue]);

  const login = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError('');

    try {
      const res = await fetch(`${API_BASE}/api/auth/authority/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const payload = await res.json();
      if (!res.ok) {
        setAuthError(payload?.detail || 'Unable to login as authority.');
        return;
      }

      setToken(payload.token);
      setUser(payload.user);
      storageSet('authority_token', payload.token);
      storageSet('authority_user', JSON.stringify(payload.user));
      setPassword('');
    } catch {
      setAuthError('Unable to connect to auth service.');
    } finally {
      setAuthLoading(false);
    }
  };

  const runAction = async (endpoint: string, body?: Record<string, unknown>) => {
    if (!token || !selectedComplaint) return false;

    setLoadingAction(true);
    setFeedback('');
    try {
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : '{}',
      });

      if (!res.ok) {
        const detail = await parseDetail(res);
        setFeedback(`✕ ${detail}`);
        return false;
      }

      await fetchQueue();
      await fetchSelectedDetail();
      return true;
    } catch {
      setFeedback('✕ Action failed. Please try again.');
      return false;
    } finally {
      setLoadingAction(false);
    }
  };

  const uploadEvidence = async (stage: 'before' | 'after') => {
    if (!token || !selectedComplaint) return;
    const file = stage === 'before' ? beforePhoto : afterPhoto;
    if (!file) {
      setFeedback(`✕ Choose a ${stage} photo first.`);
      return;
    }

    setLoadingAction(true);
    setFeedback('');
    try {
      const formData = new FormData();
      formData.append('photo', file);
      formData.append('captured_at', new Date().toISOString());

      const res = await fetch(`${API_BASE}/api/complaints/${selectedComplaint.ticket_id}/verification/${stage}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!res.ok) {
        const detail = await parseDetail(res);
        setFeedback(`✕ ${detail}`);
        return;
      }

      setFeedback(`✓ ${stage === 'before' ? 'Before' : 'After'} evidence uploaded`);
      if (stage === 'before') setBeforePhoto(null);
      if (stage === 'after') setAfterPhoto(null);
      await fetchQueue();
      await fetchSelectedDetail();
    } catch {
      setFeedback('✕ Upload failed.');
    } finally {
      setLoadingAction(false);
    }
  };

  const runAiVerification = async () => {
    if (!selectedComplaint) return;
    const ok = await runAction(`/api/complaints/${selectedComplaint.ticket_id}/verification/run`);
    if (ok) {
      setFeedback('✓ AI verification run completed. Leader can now close or request rework.');
    }
  };

  if (checkingAuth) {
    return (
      <main style={{ marginTop: 'var(--nav-height)', minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
        <div className="glass-card">Checking authority session...</div>
      </main>
    );
  }

  if (!token || !user) {
    return (
      <main style={{ marginTop: 'var(--nav-height)', minHeight: '100vh', background: 'var(--bg-secondary)', padding: '42px 0' }}>
        <div className="container" style={{ maxWidth: 540 }}>
          <div className="glass-card" style={{ padding: 30 }}>
            <p className="section-label">Authority Access</p>
            <h1 className="section-title" style={{ marginBottom: 8 }}>Authority Command Panel</h1>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 20 }}>
              Login as an authority officer to receive leader assignments, update field progress, and submit verification proof.
            </p>

            <form onSubmit={login} style={{ display: 'grid', gap: 12 }}>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="authority@janshakti.ai"
                required
                style={{ border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '12px 14px' }}
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                required
                style={{ border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '12px 14px' }}
              />
              <button className="btn btn-primary" type="submit" disabled={authLoading} style={{ justifyContent: 'center' }}>
                {authLoading ? 'Signing in...' : 'Login to Authority Panel'}
              </button>
            </form>

            {authError && (
              <p style={{ marginTop: 12, color: 'var(--p0-critical)', fontWeight: 600 }}>
                {authError}
              </p>
            )}

            <p style={{ marginTop: 14, color: 'var(--text-tertiary)', fontSize: 13 }}>
              Demo bootstrap: authority@janshakti.ai / Authority@123
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main style={{ marginTop: 'var(--nav-height)', minHeight: '100vh', background: 'var(--bg-secondary)', padding: '28px 0 36px' }}>
      <div className="container" style={{ display: 'grid', gap: 16 }}>
        <section className="glass-card" style={{ display: 'grid', gap: 14 }}>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'space-between', flexWrap: 'wrap' }}>
            <div>
              <p className="section-label">Authority Ops</p>
              <h1 className="section-title" style={{ marginBottom: 6 }}>Welcome, {user.name}</h1>
              <p style={{ color: 'var(--text-secondary)' }}>
                Review assigned complaints, send updates to leader, and submit verifiable proof-of-work.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <button className="btn btn-secondary" onClick={() => fetchQueue()}>Refresh Queue</button>
              <button className="btn btn-secondary" onClick={logout}>Logout</button>
            </div>
          </div>

          <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
            <div className="glass-card" style={{ padding: 14 }}><strong>{stats.total}</strong><div>Total Assigned</div></div>
            <div className="glass-card" style={{ padding: 14 }}><strong>{stats.assigned}</strong><div>Waiting Start</div></div>
            <div className="glass-card" style={{ padding: 14 }}><strong>{stats.inProgress}</strong><div>In Progress</div></div>
            <div className="glass-card" style={{ padding: 14 }}><strong>{stats.verification}</strong><div>Verification Stage</div></div>
          </div>
        </section>

        <section style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 1fr) minmax(360px, 2fr)', gap: 14 }}>
          <div className="glass-card" style={{ display: 'grid', gap: 10, alignContent: 'start' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3>Assigned Queue</h3>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{ borderRadius: 8, border: '1px solid var(--border-subtle)', padding: '6px 8px' }}
              >
                <option value="all">All</option>
                <option value="assigned">Assigned</option>
                <option value="in_progress">In Progress</option>
                <option value="verification">Verification</option>
              </select>
            </div>

            <div style={{ display: 'grid', gap: 8, maxHeight: 600, overflowY: 'auto' }}>
              {queue.map((item) => {
                const statusMeta = STATUS_CONFIG[item.status as keyof typeof STATUS_CONFIG] || { label: item.status, color: 'var(--text-secondary)' };
                const active = selectedTicket === item.ticket_id;
                return (
                  <button
                    key={item.ticket_id}
                    onClick={() => setSelectedTicket(item.ticket_id)}
                    style={{
                      textAlign: 'left',
                      border: `1px solid ${active ? 'var(--accent-blue)' : 'var(--border-subtle)'}`,
                      borderRadius: 10,
                      background: active ? 'rgba(30,64,175,0.06)' : 'white',
                      padding: 12,
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
                      <strong>{item.ticket_id}</strong>
                      <span style={{ fontSize: 12, color: statusMeta.color, fontWeight: 700 }}>{statusMeta.label}</span>
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{item.title}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 6 }}>{item.ward} • {item.category} • {item.priority}</div>
                  </button>
                );
              })}

              {queue.length === 0 && (
                <div style={{ color: 'var(--text-secondary)', padding: '8px 2px' }}>
                  No complaints assigned for current filter.
                </div>
              )}
            </div>
          </div>

          <div className="glass-card" style={{ display: 'grid', gap: 12, alignContent: 'start' }}>
            {!selectedComplaint ? (
              <div style={{ color: 'var(--text-secondary)' }}>Select a complaint from queue to open action workspace.</div>
            ) : (
              <>
                <div style={{ display: 'grid', gap: 6 }}>
                  <h2 style={{ margin: 0 }}>{selectedComplaint.ticket_id} • {selectedComplaint.title}</h2>
                  <p style={{ color: 'var(--text-secondary)' }}>{selectedComplaint.description}</p>
                  <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>
                    {selectedComplaint.ward} • {selectedComplaint.category} • Priority {selectedComplaint.priority}
                  </div>
                </div>

                <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 10, display: 'grid', gap: 8 }}>
                  <div><strong>Leader Note:</strong> {selectedComplaint.leader_note || 'No instruction shared yet.'}</div>
                  <div><strong>Citizen Update:</strong> {selectedComplaint.citizen_update || 'No citizen update yet.'}</div>
                  <div>
                    <strong>Verification:</strong> {selectedComplaint.verification_status || 'not_started'}
                    {typeof selectedComplaint.verification_score === 'number' ? ` • Score ${selectedComplaint.verification_score}` : ''}
                  </div>
                </div>

                {(selectedComplaint.image_path || selectedComplaint.audio_path) && (
                  <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 10, display: 'grid', gap: 10 }}>
                    <h3 style={{ margin: 0 }}>Citizen Uploaded Media</h3>

                    {selectedComplaint.image_path && (
                      <div style={{ display: 'grid', gap: 6 }}>
                        <a href={buildMediaUrl(selectedComplaint.image_path)} target="_blank" rel="noreferrer" style={{ fontSize: 13 }}>
                          Open uploaded image
                        </a>
                        <img
                          src={buildMediaUrl(selectedComplaint.image_path)}
                          alt="Citizen uploaded evidence"
                          style={{ width: '100%', maxWidth: 360, borderRadius: 8, border: '1px solid var(--border-subtle)' }}
                        />
                      </div>
                    )}

                    {selectedComplaint.audio_path && (
                      <div style={{ display: 'grid', gap: 6 }}>
                        <a href={buildMediaUrl(selectedComplaint.audio_path)} target="_blank" rel="noreferrer" style={{ fontSize: 13 }}>
                          Open uploaded audio
                        </a>
                        <audio controls src={buildMediaUrl(selectedComplaint.audio_path)} style={{ width: '100%', maxWidth: 420 }} />
                      </div>
                    )}
                  </div>
                )}

                <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 12, display: 'grid', gap: 10 }}>
                  <h3 style={{ margin: 0 }}>Authority Actions</h3>

                  <div style={{ display: 'grid', gap: 8 }}>
                    <textarea
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      rows={2}
                      placeholder="Acknowledgement note (optional)"
                      style={{ border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 10, resize: 'vertical' }}
                    />
                    <button
                      className="btn btn-secondary"
                      disabled={loadingAction}
                      onClick={async () => {
                        const ok = await runAction(`/api/complaints/${selectedComplaint.ticket_id}/authority/acknowledge`, { note: note.trim() || null });
                        if (ok) setFeedback('✓ Complaint acknowledged and marked in progress.');
                      }}
                    >
                      Acknowledge Assignment
                    </button>
                  </div>

                  <div style={{ display: 'grid', gap: 8 }}>
                    <textarea
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      rows={3}
                      placeholder="Send update or blocker to leader"
                      style={{ border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 10, resize: 'vertical' }}
                    />
                    <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14 }}>
                      <input type="checkbox" checked={blocker} onChange={(e) => setBlocker(e.target.checked)} />
                      Mark this update as blocker (returns to leader review)
                    </label>
                    <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14 }}>
                      <input
                        type="checkbox"
                        checked={requestVerification}
                        onChange={(e) => setRequestVerification(e.target.checked)}
                      />
                      Request verification-ready stage
                    </label>
                    <button
                      className="btn btn-primary"
                      disabled={loadingAction || !message.trim()}
                      onClick={async () => {
                        const ok = await runAction(`/api/complaints/${selectedComplaint.ticket_id}/authority/message-leader`, {
                          message,
                          blocker,
                          mark_verification_ready: requestVerification,
                        });
                        if (ok) {
                          setFeedback('✓ Update sent to leader successfully.');
                          setMessage('');
                        }
                      }}
                    >
                      Send Update to Leader
                    </button>
                  </div>
                </div>

                <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 12, display: 'grid', gap: 10 }}>
                  <h3 style={{ margin: 0 }}>Evidence and Verification</h3>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div style={{ display: 'grid', gap: 8 }}>
                      <input type="file" accept="image/*" onChange={(e) => setBeforePhoto(e.target.files?.[0] || null)} />
                      <button className="btn btn-secondary" disabled={loadingAction || !beforePhoto} onClick={() => uploadEvidence('before')}>
                        Upload Before Evidence
                      </button>
                    </div>
                    <div style={{ display: 'grid', gap: 8 }}>
                      <input type="file" accept="image/*" onChange={(e) => setAfterPhoto(e.target.files?.[0] || null)} />
                      <button className="btn btn-secondary" disabled={loadingAction || !afterPhoto} onClick={() => uploadEvidence('after')}>
                        Upload After Evidence
                      </button>
                    </div>
                  </div>

                  <button className="btn btn-primary" disabled={loadingAction} onClick={runAiVerification}>
                    Run AI Verification Self-Check
                  </button>
                </div>

                {feedback && (
                  <div
                    style={{
                      borderRadius: 10,
                      border: `1px solid ${feedback.startsWith('✕') ? '#FECACA' : '#BBF7D0'}`,
                      background: feedback.startsWith('✕') ? '#FEF2F2' : '#F0FDF4',
                      color: feedback.startsWith('✕') ? '#B91C1C' : '#166534',
                      padding: '10px 12px',
                      fontWeight: 600,
                    }}
                  >
                    {feedback}
                  </div>
                )}

                {(selectedDetail?.activity?.length ?? 0) > 0 && (
                  <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 12, display: 'grid', gap: 8 }}>
                    <h3 style={{ margin: 0 }}>Recent Timeline</h3>
                    <div style={{ maxHeight: 180, overflowY: 'auto', display: 'grid', gap: 6 }}>
                      {(selectedDetail?.activity ?? []).slice(-8).reverse().map((a: ComplaintActivityItem, idx: number) => (
                        <div key={idx} style={{ fontSize: 13, border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 8 }}>
                          <strong>{a.action}</strong> • {a.actor_role} {a.actor_name ? `(${a.actor_name})` : ''}
                          <div style={{ color: 'var(--text-secondary)' }}>{a.note || 'No note'}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
