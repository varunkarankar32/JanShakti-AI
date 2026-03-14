'use client';

import { useState, useEffect } from 'react';
import { CATEGORIES, WARDS, STATUS_CONFIG } from '@/lib/mockData';

interface SubmittedComplaint {
  id: string;
  ticket_id: string;
  title: string;
  category: string;
  ward: string;
  priority: string;
  status: string;
  ai_score: number;
  input_mode: string;
  created_at: string;
}

interface AuthUser {
  id: number;
  name: string;
  email: string;
  phone?: string;
}

interface TrackedComplaint {
  ticket_id: string;
  title: string;
  priority: string;
  category: string;
  ward: string;
  ai_score: number;
  status: string;
  assigned_authority?: string;
  authority_response?: string;
  citizen_update?: string;
  activity?: { actor_role: string; actor_name?: string; action: string; note?: string; created_at?: string }[];
}

interface MyComplaint {
  ticket_id: string;
  title: string;
  category: string;
  ward: string;
  priority: string;
  status: string;
  assigned_authority?: string;
  authority_response?: string;
  citizen_update?: string;
  resolved_at?: string;
  created_at?: string;
}

function isTokenExpired(token: string): boolean {
  try {
    const base64Url = token.split('.')[1];
    // JWT uses base64url (- and _ instead of + and /), atob needs standard base64
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const payload = JSON.parse(atob(padded));
    return typeof payload.exp === 'number' && payload.exp * 1000 < Date.now();
  } catch {
    return false; // If we can't decode, let the server decide
  }
}

export default function CitizenPortal() {
  const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';

  const [tab, setTab] = useState<'file' | 'track'>('file');
  const [contactPhone, setContactPhone] = useState('');
  const [category, setCategory] = useState('');
  const [ward, setWard] = useState('');
  const [description, setDescription] = useState('');
  const [inputMode, setInputMode] = useState<'text' | 'voice' | 'photo'>('text');
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [inputProcessing, setInputProcessing] = useState(false);
  const [lastTicket, setLastTicket] = useState('');
  const [complaints, setComplaints] = useState<SubmittedComplaint[]>([]);
  const [trackingId, setTrackingId] = useState('');
  const [trackedResult, setTrackedResult] = useState<TrackedComplaint | null>(null);
  const [myComplaints, setMyComplaints] = useState<MyComplaint[]>([]);
  const [trackError, setTrackError] = useState('');
  const [backendOnline, setBackendOnline] = useState(false);

  const [authMode, setAuthMode] = useState<'signup' | 'login'>('signup');
  const [authName, setAuthName] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [authPhone, setAuthPhone] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authToken, setAuthToken] = useState('');
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('citizen_token') || '';
    const userRaw = localStorage.getItem('citizen_user');
    if (token && userRaw) {
      if (!isTokenExpired(token)) {
        try {
          const parsedUser = JSON.parse(userRaw) as AuthUser;
          setAuthToken(token);
          setAuthUser(parsedUser);
          setContactPhone(parsedUser.phone || '');
        } catch {
          localStorage.removeItem('citizen_token');
          localStorage.removeItem('citizen_user');
        }
      } else {
        // Token expired — clear storage and show login form
        localStorage.removeItem('citizen_token');
        localStorage.removeItem('citizen_user');
        setAuthMode('login');
      }
    }
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!authToken) return;

    fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${authToken}`, 'Cache-Control': 'no-cache' },
    })
      .then(async (res) => {
        if (!res.ok) return; // Keep user in — any issues handled at submit time
        const user = await res.json();
        setAuthUser(user);
        setContactPhone(user?.phone || '');
      })
      .catch(() => {
        // Network error (backend temporarily down) — do NOT log out
      });
  }, [authToken]);  // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!authToken) {
      setMyComplaints([]);
      return;
    }

    fetch(`${API_BASE}/api/complaints/my`, {
      headers: { Authorization: `Bearer ${authToken}`, 'Cache-Control': 'no-cache' },
    })
      .then(async (res) => {
        if (res.status === 401) {
          handleLogout();
          setAuthError('Your session expired. Please log in again to continue.');
          return;
        }
        if (!res.ok) return;
        const data = await res.json();
        setMyComplaints(data?.complaints || []);
      })
      .catch(() => {
        // Keep existing UI state on temporary network failures.
      });
  }, [authToken, submitted]);  // eslint-disable-line react-hooks/exhaustive-deps

  // Check backend health + load complaints
  useEffect(() => {
    fetch('/api/complaints?limit=20')
      .then(r => r.json())
      .then((data: { complaints?: Array<Partial<SubmittedComplaint>> }) => {
        setBackendOnline(true);
        if (data.complaints) {
          setComplaints(data.complaints.map((c) => ({
            id: c.ticket_id || '',
            ticket_id: c.ticket_id || '',
            title: c.title || '',
            category: c.category || '',
            ward: c.ward || '',
            priority: c.priority || 'P3',
            status: c.status || 'open',
            ai_score: c.ai_score || 0,
            input_mode: c.input_mode || 'text',
            created_at: c.created_at || '',
          })));
        }
      })
      .catch(() => setBackendOnline(false));
  }, [submitted]);

  const persistAuth = (token: string, user: AuthUser) => {
    setAuthToken(token);
    setAuthUser(user);
    setContactPhone(user.phone || '');
    localStorage.setItem('citizen_token', token);
    localStorage.setItem('citizen_user', JSON.stringify(user));
  };

  const handleLogout = () => {
    setAuthToken('');
    setAuthUser(null);
    setMyComplaints([]);
    setTrackedResult(null);
    setAuthMode('login');
    localStorage.removeItem('citizen_token');
    localStorage.removeItem('citizen_user');
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError('');

    try {
      const endpoint = authMode === 'signup' ? '/api/auth/signup' : '/api/auth/login';
      const payload = authMode === 'signup'
        ? { name: authName.trim(), email: authEmail.trim(), phone: authPhone.trim() || null, password: authPassword }
        : { email: authEmail.trim(), password: authPassword };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        setAuthError(data?.detail || 'Authentication failed');
        return;
      }

      persistAuth(data.token, data.user as AuthUser);
      setAuthName('');
      setAuthEmail('');
      setAuthPhone('');
      setAuthPassword('');
    } catch {
      setAuthError('Cannot connect to backend auth service.');
    } finally {
      setAuthLoading(false);
    }
  };

  const parseErrorMessage = async (res: Response) => {
    try {
      const payload = await res.json();
      return payload?.detail || 'Request failed';
    } catch {
      return 'Request failed';
    }
  };

  // Submit complaint to real backend
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Read token fresh from localStorage to avoid React stale closure issues
    const currentToken = authToken || localStorage.getItem('citizen_token') || '';
    const currentUser = authUser;

    if (!currentToken || !currentUser) {
      setAuthMode('login');
      setAuthError('Please log in before filing a complaint.');
      return;
    }

    // Catch expired tokens client-side before wasting the network call
    if (isTokenExpired(currentToken)) {
      handleLogout();
      setAuthError('Your session expired. Please log in again to continue.');
      return;
    }

    setSubmitting(true);
    setInputProcessing(true);

    try {
      let finalDescription = description.trim();
      let finalCategory = category;

      if (inputMode === 'voice') {
        if (!audioFile) {
          alert('Please upload or record an audio file for voice mode.');
          return;
        }
        const audioData = new FormData();
        audioData.append('audio', audioFile);

        const transcribeRes = await fetch('/api/speech/transcribe', {
          method: 'POST',
          body: audioData,
        });
        if (!transcribeRes.ok) {
          throw new Error(await parseErrorMessage(transcribeRes));
        }
        const transcription = await transcribeRes.json();
        finalDescription = transcription?.text?.trim() || finalDescription;
      }

      if (inputMode === 'photo') {
        if (!photoFile) {
          alert('Please upload a photo for photo mode.');
          return;
        }
        const imageData = new FormData();
        imageData.append('image', photoFile);

        const detectRes = await fetch('/api/vision/detect', {
          method: 'POST',
          body: imageData,
        });
        if (!detectRes.ok) {
          throw new Error(await parseErrorMessage(detectRes));
        }
        const detection = await detectRes.json();
        if (!finalCategory && detection?.category) {
          finalCategory = String(detection.category);
        }
        if (!finalDescription) {
          finalDescription = `Photo report: ${detection?.category || 'issue'} detected with ${detection?.severity || 'unknown'} severity.`;
        }
      }

      if (!finalDescription) {
        alert('Please provide complaint details before submitting.');
        return;
      }

      if (!finalCategory) {
        alert('Please select a category (or use photo detection to auto-detect).');
        return;
      }

      const res = await fetch(`${API_BASE}/api/complaints/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${currentToken}`,
        },
        body: JSON.stringify({
          title: finalDescription.slice(0, 80),
          description: finalDescription,
          category: finalCategory,
          ward,
          citizen_name: currentUser.name,
          citizen_phone: contactPhone || currentUser.phone || null,
          input_mode: inputMode,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setLastTicket(data.ticket_id);
        setSubmitted(true);
        setTimeout(() => setSubmitted(false), 8000);
        setDescription('');
        setCategory('');
        setWard('');
        setAudioFile(null);
        setPhotoFile(null);
      } else {
        const detail = await parseErrorMessage(res);
        if (res.status === 401) {
          handleLogout();
          setAuthError('Your session expired. Please log in again to continue.');
        } else {
          alert(`Failed to submit complaint: ${detail}`);
        }
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      alert(`Cannot process complaint: ${message}`);
    } finally {
      setInputProcessing(false);
      setSubmitting(false);
    }
  };

  // Track complaint from backend
  const handleTrack = async () => {
    if (!trackingId) return;
    setTrackError('');
    setTrackedResult(null);

    try {
      const res = await fetch(`/api/complaints/${trackingId.trim().toUpperCase()}`);
      if (res.ok) {
        const data = await res.json();
        setTrackedResult(data);
      } else {
        setTrackError('Ticket not found. Check the ID and try again.');
      }
    } catch {
      setTrackError('Cannot connect to backend.');
    }
  };

  return (
    <main className="main-content">
      <section className="section" style={{ paddingTop: 80 }}>
        <div className="container">
          <div className="section-label">CITIZEN PORTAL</div>
          <h1 className="section-title">Your Voice Matters</h1>
          <p className="section-subtitle" style={{ marginBottom: 16 }}>
            Report issues, track progress, and rate the resolution — all in one place
          </p>

          {/* Backend Status */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '6px 16px', borderRadius: 20, marginBottom: 24,
            background: backendOnline ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
            border: `1px solid ${backendOnline ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
            fontSize: '0.8rem', fontWeight: 600,
            color: backendOnline ? '#16a34a' : '#dc2626',
          }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: backendOnline ? '#22c55e' : '#ef4444' }} />
            {backendOnline ? 'AI Backend Connected' : 'Backend Offline — Start with: uvicorn main:app --port 8000'}
          </div>

          {/* Tab Switcher */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 32 }}>
            <button onClick={() => setTab('file')} className="glass-card" style={{
              flex: 1, cursor: 'pointer', textAlign: 'center', padding: '16px',
              border: tab === 'file' ? '1px solid var(--accent-blue)' : '1px solid var(--border-subtle)',
              background: tab === 'file' ? 'rgba(59,130,246,0.1)' : 'var(--bg-glass)',
            }}>
              <div style={{ fontSize: '1.5rem', marginBottom: 4 }}>📝</div>
              <div style={{ fontWeight: 700 }}>File Complaint</div>
            </button>
            <button onClick={() => setTab('track')} className="glass-card" style={{
              flex: 1, cursor: 'pointer', textAlign: 'center', padding: '16px',
              border: tab === 'track' ? '1px solid var(--accent-blue)' : '1px solid var(--border-subtle)',
              background: tab === 'track' ? 'rgba(59,130,246,0.1)' : 'var(--bg-glass)',
            }}>
              <div style={{ fontSize: '1.5rem', marginBottom: 4 }}>🔍</div>
              <div style={{ fontWeight: 700 }}>Track Complaint</div>
            </button>
          </div>

          {tab === 'file' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32 }}>
              <div className="glass-card" style={{ padding: 32 }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 24 }}>Submit Your Complaint</h3>

                {!authToken || !authUser ? (
                  <>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                      <button
                        onClick={() => setAuthMode('signup')}
                        style={{
                          flex: 1,
                          padding: '10px',
                          borderRadius: 8,
                          cursor: 'pointer',
                          border: 'none',
                          background: authMode === 'signup' ? 'rgba(59,130,246,0.15)' : 'var(--bg-tertiary)',
                          color: authMode === 'signup' ? 'var(--accent-blue-light)' : 'var(--text-secondary)',
                          fontWeight: 600,
                        }}
                      >
                        Create Account
                      </button>
                      <button
                        onClick={() => setAuthMode('login')}
                        style={{
                          flex: 1,
                          padding: '10px',
                          borderRadius: 8,
                          cursor: 'pointer',
                          border: 'none',
                          background: authMode === 'login' ? 'rgba(59,130,246,0.15)' : 'var(--bg-tertiary)',
                          color: authMode === 'login' ? 'var(--accent-blue-light)' : 'var(--text-secondary)',
                          fontWeight: 600,
                        }}
                      >
                        Login
                      </button>
                    </div>

                    <form onSubmit={handleAuthSubmit}>
                      {authMode === 'signup' && (
                        <div className="form-group">
                          <label className="form-label">Full Name</label>
                          <input className="form-input" value={authName} onChange={e => setAuthName(e.target.value)} placeholder="Enter your name" required />
                        </div>
                      )}
                      <div className="form-group">
                        <label className="form-label">Email</label>
                        <input type="email" className="form-input" value={authEmail} onChange={e => setAuthEmail(e.target.value)} placeholder="you@example.com" required />
                      </div>
                      {authMode === 'signup' && (
                        <div className="form-group">
                          <label className="form-label">Phone Number (Optional)</label>
                          <input className="form-input" value={authPhone} onChange={e => setAuthPhone(e.target.value)} placeholder="+91 XXXXX XXXXX" />
                        </div>
                      )}
                      <div className="form-group">
                        <label className="form-label">Password</label>
                        <input type="password" className="form-input" value={authPassword} onChange={e => setAuthPassword(e.target.value)} placeholder="Enter password" required minLength={6} />
                      </div>

                      <button type="submit" className="btn btn-primary" disabled={authLoading} style={{ width: '100%', justifyContent: 'center' }}>
                        {authLoading ? '⏳ Authenticating...' : authMode === 'signup' ? '✅ Sign Up & Continue' : '🔐 Login'}
                      </button>
                    </form>

                    {authError && <div style={{ marginTop: 12, color: '#dc2626', fontSize: '0.85rem' }}>❌ {authError}</div>}
                    <div style={{ marginTop: 12, fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>
                      Complaint filing is allowed only for authenticated citizens.
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: 16,
                      padding: '10px 12px',
                      borderRadius: 8,
                      background: 'rgba(34,197,94,0.08)',
                      border: '1px solid rgba(34,197,94,0.25)',
                    }}>
                      <div style={{ fontSize: '0.82rem' }}>
                        Filing as <strong>{authUser.name}</strong> ({authUser.email})
                      </div>
                      <button className="btn btn-secondary" onClick={handleLogout} style={{ padding: '6px 12px' }}>
                        Logout
                      </button>
                    </div>

                    <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
                      {([
                        { key: 'text' as const, icon: '💬', label: 'Text' },
                        { key: 'voice' as const, icon: '🎤', label: 'Voice' },
                        { key: 'photo' as const, icon: '📸', label: 'Photo' },
                      ]).map(mode => (
                        <button
                          key={mode.key}
                          onClick={() => {
                            setInputMode(mode.key);
                            setAudioFile(null);
                            setPhotoFile(null);
                          }}
                          style={{
                            flex: 1,
                            padding: '10px',
                            borderRadius: 8,
                            cursor: 'pointer',
                            border: 'none',
                            background: inputMode === mode.key ? 'rgba(59,130,246,0.15)' : 'var(--bg-tertiary)',
                            color: inputMode === mode.key ? 'var(--accent-blue-light)' : 'var(--text-secondary)',
                            fontWeight: 600,
                            fontSize: '0.85rem',
                            fontFamily: 'Inter, sans-serif',
                          }}
                        >
                          {mode.icon} {mode.label}
                        </button>
                      ))}
                    </div>

                    <form onSubmit={handleSubmit}>
                      <div className="form-group">
                        <label className="form-label">Contact Phone (Optional)</label>
                        <input className="form-input" value={contactPhone} onChange={e => setContactPhone(e.target.value)} placeholder="+91 XXXXX XXXXX" />
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div className="form-group">
                          <label className="form-label">Category</label>
                          <select className="form-select" value={category} onChange={e => setCategory(e.target.value)}>
                            <option value="">Select category</option>
                            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </div>
                        <div className="form-group">
                          <label className="form-label">Ward</label>
                          <select className="form-select" value={ward} onChange={e => setWard(e.target.value)} required>
                            <option value="">Select ward</option>
                            {WARDS.map(w => <option key={w} value={w}>{w}</option>)}
                          </select>
                        </div>
                      </div>

                      {inputMode === 'voice' && (
                        <div className="form-group">
                          <label className="form-label">Upload Voice Recording</label>
                          <input
                            type="file"
                            accept="audio/*"
                            capture="user"
                            onChange={e => setAudioFile(e.target.files?.[0] || null)}
                            required
                            style={{ width: '100%' }}
                          />
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: 4 }}>
                            {audioFile ? `Selected: ${audioFile.name}` : 'Audio will be transcribed automatically before filing.'}
                          </div>
                        </div>
                      )}

                      {inputMode === 'photo' && (
                        <div className="form-group">
                          <label className="form-label">Upload Issue Photo</label>
                          <input
                            type="file"
                            accept="image/*"
                            capture="environment"
                            onChange={e => setPhotoFile(e.target.files?.[0] || null)}
                            required
                            style={{ width: '100%' }}
                          />
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: 4 }}>
                            {photoFile ? `Selected: ${photoFile.name}` : 'Photo detection will suggest category and severity automatically.'}
                          </div>
                        </div>
                      )}

                      <div className="form-group">
                        <label className="form-label">
                          {inputMode === 'text' ? 'Describe the Issue' : 'Additional Details (Optional)'}
                        </label>
                        <textarea
                          className="form-textarea"
                          value={description}
                          onChange={e => setDescription(e.target.value)}
                          placeholder={inputMode === 'text' ? 'Describe the problem in detail...' : 'Add landmarks, timings, or extra context...'}
                          required={inputMode === 'text'}
                        />
                      </div>

                      <button type="submit" className="btn btn-primary" disabled={submitting || inputProcessing} style={{
                        width: '100%', justifyContent: 'center', marginTop: 8,
                        opacity: submitting || inputProcessing ? 0.7 : 1,
                      }}>
                        {submitting || inputProcessing ? '⏳ Processing AI + Filing...' : '🚀 Submit Complaint'}
                      </button>
                    </form>

                    {submitted && (
                      <div style={{
                        marginTop: 16, padding: 16, borderRadius: 10,
                        background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)',
                        animation: 'fadeInUp 0.5s ease',
                      }}>
                        <div style={{ fontWeight: 700, color: '#22c55e', marginBottom: 4 }}>✅ Complaint Filed & AI Processed!</div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                          Your ticket ID: <strong style={{ color: 'var(--accent-blue-light)' }}>{lastTicket}</strong>
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', marginTop: 4 }}>
                          AI auto-classified, priority-scored, and sentiments analyzed.
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Right Panel */}
              <div>
                <div className="glass-card" style={{ padding: 24, marginBottom: 16 }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 16 }}>How It Works</h3>
                  {[
                    { step: 1, title: 'Submit', desc: 'Voice, text, or photo — your choice' },
                    { step: 2, title: 'AI Processes', desc: 'Auto-classified and prioritized in seconds' },
                    { step: 3, title: 'Leader Sees', desc: 'Appears on ward officer\'s dashboard' },
                    { step: 4, title: 'Crew Dispatched', desc: 'Nearest team with GPS directions' },
                    { step: 5, title: 'Verified & Closed', desc: 'GPS photo proof + your SMS confirmation' },
                  ].map(s => (
                    <div key={s.step} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 16 }}>
                      <div style={{
                        width: 32, height: 32, minWidth: 32, borderRadius: '50%',
                        background: 'var(--gradient-blue)', display: 'flex',
                        alignItems: 'center', justifyContent: 'center',
                        fontSize: '0.8rem', fontWeight: 800,
                      }}>{s.step}</div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{s.title}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{s.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="glass-card" style={{ padding: 24 }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 12 }}>📱 Multiple Ways to Report</h3>
                  {['WhatsApp: +91 9430862005', 'SMS: COMPLAINT to 56789', 'IVR: 1800-XXX-XXXX (toll-free)', 'Web Portal: this page'].map(ch => (
                    <div key={ch} style={{ padding: '8px 0', borderBottom: '1px solid var(--border-subtle)', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{ch}</div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {tab === 'track' && (
            <div style={{ maxWidth: 700, margin: '0 auto' }}>
              <div className="glass-card" style={{ padding: 32, marginBottom: 24 }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 16 }}>🔍 Track Your Complaint</h3>
                <div style={{ display: 'flex', gap: 12 }}>
                  <input className="form-input" value={trackingId} onChange={e => setTrackingId(e.target.value)}
                    placeholder="Enter Ticket ID (e.g., TKT-A1B2C3)" onKeyDown={e => e.key === 'Enter' && handleTrack()} />
                  <button className="btn btn-primary" onClick={handleTrack}>Search</button>
                </div>

                {trackError && (
                  <div style={{ marginTop: 12, color: '#dc2626', fontSize: '0.85rem' }}>❌ {trackError}</div>
                )}

                {trackedResult && (
                  <div style={{ marginTop: 24, animation: 'fadeInUp 0.3s ease' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                      <div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--accent-blue-light)', fontWeight: 600 }}>{trackedResult.ticket_id}</div>
                        <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>{trackedResult.title}</div>
                      </div>
                      <span className={`badge badge-${trackedResult.priority?.toLowerCase()}`}>{trackedResult.priority}</span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                      <div style={{ background: 'var(--bg-tertiary)', borderRadius: 8, padding: 12 }}>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>Category</div>
                        <div style={{ fontWeight: 600 }}>{trackedResult.category}</div>
                      </div>
                      <div style={{ background: 'var(--bg-tertiary)', borderRadius: 8, padding: 12 }}>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>Ward</div>
                        <div style={{ fontWeight: 600 }}>{trackedResult.ward}</div>
                      </div>
                      <div style={{ background: 'var(--bg-tertiary)', borderRadius: 8, padding: 12 }}>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>AI Score</div>
                        <div style={{ fontWeight: 600, color: 'var(--accent-blue-light)' }}>{trackedResult.ai_score}/100</div>
                      </div>
                      <div style={{ background: 'var(--bg-tertiary)', borderRadius: 8, padding: 12 }}>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>Status</div>
                        <div style={{ fontWeight: 600, textTransform: 'capitalize' }}>{trackedResult.status?.replace('_', ' ')}</div>
                      </div>
                    </div>

                    {/* Status Timeline */}
                    <div style={{ display: 'flex', gap: 0, marginBottom: 24 }}>
                      {Object.entries(STATUS_CONFIG).map(([key, config], i) => {
                        const statuses = Object.keys(STATUS_CONFIG);
                        const currentIdx = statuses.indexOf(trackedResult.status);
                        const isComplete = i <= currentIdx;
                        const isActive = i === currentIdx;
                        return (
                          <div key={key} style={{ flex: 1, textAlign: 'center', position: 'relative' }}>
                            {i > 0 && (
                              <div style={{
                                position: 'absolute', top: 16, left: -10, right: '50%', height: 3,
                                background: isComplete ? config.color : 'var(--bg-tertiary)', zIndex: 0,
                              }} />
                            )}
                            <div style={{
                              width: 32, height: 32, borderRadius: '50%', margin: '0 auto 8px',
                              background: isComplete ? config.color : 'var(--bg-tertiary)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: '0.8rem', position: 'relative', zIndex: 1,
                              boxShadow: isActive ? `0 0 16px ${config.color}44` : 'none',
                              color: isComplete ? 'white' : 'var(--text-tertiary)',
                            }}>
                              {isComplete ? '✓' : (i + 1)}
                            </div>
                            <div style={{ fontSize: '0.7rem', fontWeight: 600, color: isComplete ? config.color : 'var(--text-tertiary)' }}>{config.label}</div>
                          </div>
                        );
                      })}
                    </div>

                    {(trackedResult.citizen_update || trackedResult.authority_response) && (
                      <div style={{ display: 'grid', gap: 10, marginBottom: 16 }}>
                        {trackedResult.citizen_update && (
                          <div style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 8, padding: 12 }}>
                            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--accent-blue-light)', marginBottom: 4 }}>PROFILE UPDATE</div>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{trackedResult.citizen_update}</div>
                          </div>
                        )}

                        {trackedResult.authority_response && (
                          <div style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 8, padding: 12 }}>
                            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#16a34a', marginBottom: 4 }}>AUTHORITY RESPONSE</div>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{trackedResult.authority_response}</div>
                          </div>
                        )}
                      </div>
                    )}

                    {trackedResult.activity && trackedResult.activity.length > 0 && (
                      <div>
                        <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: 1, marginBottom: 8 }}>WORKFLOW TIMELINE</div>
                        {trackedResult.activity.slice(-5).reverse().map((a, idx) => (
                          <div key={`${a.action}-${idx}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                            <div>
                              <div style={{ fontSize: '0.83rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                                {a.action.replaceAll('_', ' ')}
                              </div>
                              {a.note && <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{a.note}</div>}
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', textTransform: 'capitalize' }}>{a.actor_role}</div>
                              <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>{a.created_at ? new Date(a.created_at).toLocaleString('en-IN') : ''}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {authUser && (
                <div className="glass-card" style={{ padding: 24, marginBottom: 24 }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 14 }}>
                    👤 My Profile Updates
                  </h3>

                  {myComplaints.length === 0 ? (
                    <div style={{ color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>
                      No complaints in your profile yet. File a complaint to start tracking updates.
                    </div>
                  ) : (
                    myComplaints.slice(0, 8).map((c) => {
                      const sConfig = STATUS_CONFIG[c.status as keyof typeof STATUS_CONFIG];
                      const solved = c.status === 'resolved';
                      return (
                        <div key={c.ticket_id} style={{ padding: '12px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                            <div>
                              <div style={{ fontSize: '0.78rem', color: 'var(--accent-blue-light)', fontWeight: 600 }}>{c.ticket_id}</div>
                              <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>{c.title}</div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>{c.category} · {c.ward}</div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontSize: '0.78rem', color: solved ? '#16a34a' : (sConfig?.color || '#64748b'), fontWeight: 700 }}>
                                {solved ? 'Solved ✓' : (sConfig?.label || c.status)}
                              </div>
                              <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>
                                {c.resolved_at ? `Resolved ${new Date(c.resolved_at).toLocaleDateString('en-IN')}` : (c.created_at ? `Filed ${new Date(c.created_at).toLocaleDateString('en-IN')}` : '')}
                              </div>
                            </div>
                          </div>

                          {(c.citizen_update || c.assigned_authority) && (
                            <div style={{ marginTop: 8, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                              {c.citizen_update || `Assigned to ${c.assigned_authority}`}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {/* Recent Complaints from Backend */}
              <div className="glass-card" style={{ padding: 24 }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 16 }}>
                  Recent Complaints {complaints.length > 0 && <span style={{ fontWeight: 400, color: 'var(--text-tertiary)' }}>({complaints.length})</span>}
                </h3>
                {complaints.length === 0 && (
                  <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-tertiary)' }}>
                    No complaints yet. File one above!
                  </div>
                )}
                {complaints.map(c => {
                  const sConfig = STATUS_CONFIG[c.status as keyof typeof STATUS_CONFIG];
                  return (
                    <div key={c.id} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '12px 0', borderBottom: '1px solid var(--border-subtle)',
                    }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <span style={{ fontSize: '0.8rem', color: 'var(--accent-blue-light)', fontWeight: 600 }}>{c.id || c.ticket_id}</span>
                          <span className={`badge badge-${c.priority?.toLowerCase()}`} style={{ fontSize: '0.65rem', padding: '2px 6px' }}>{c.priority}</span>
                          {c.ai_score > 0 && <span style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)' }}>AI: {c.ai_score}</span>}
                        </div>
                        <div style={{ fontSize: '0.9rem' }}>{c.title}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>{c.category} · {c.ward}</div>
                      </div>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: sConfig?.color || '#64748b' }} />
                        <span style={{ fontSize: '0.8rem', color: sConfig?.color || '#64748b' }}>{sConfig?.label || c.status}</span>
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
