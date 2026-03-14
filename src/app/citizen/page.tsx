'use client';

import { useState, useEffect } from 'react';
import { CATEGORIES, WARDS, PRIORITY_CONFIG, STATUS_CONFIG } from '@/lib/mockData';

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

export default function CitizenPortal() {
  const [tab, setTab] = useState<'file' | 'track'>('file');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [category, setCategory] = useState('');
  const [ward, setWard] = useState('');
  const [description, setDescription] = useState('');
  const [inputMode, setInputMode] = useState<'text' | 'voice' | 'photo'>('text');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [lastTicket, setLastTicket] = useState('');
  const [complaints, setComplaints] = useState<SubmittedComplaint[]>([]);
  const [trackingId, setTrackingId] = useState('');
  const [trackedResult, setTrackedResult] = useState<any>(null);
  const [trackError, setTrackError] = useState('');
  const [rating, setRating] = useState(0);
  const [backendOnline, setBackendOnline] = useState(false);

  // Check backend health + load complaints
  useEffect(() => {
    fetch('/api/complaints?limit=20')
      .then(r => r.json())
      .then(data => {
        setBackendOnline(true);
        if (data.complaints) {
          setComplaints(data.complaints.map((c: any) => ({
            id: c.ticket_id,
            ticket_id: c.ticket_id,
            title: c.title,
            category: c.category,
            ward: c.ward,
            priority: c.priority,
            status: c.status,
            ai_score: c.ai_score,
            input_mode: c.input_mode,
            created_at: c.created_at,
          })));
        }
      })
      .catch(() => setBackendOnline(false));
  }, [submitted]);

  // Submit complaint to real backend
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const res = await fetch('/api/complaints/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: description.slice(0, 80),
          description,
          category,
          ward,
          citizen_name: name,
          citizen_phone: phone,
          input_mode: inputMode,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setLastTicket(data.ticket_id);
        setSubmitted(true);
        setTimeout(() => setSubmitted(false), 8000);
        setDescription(''); setName(''); setPhone(''); setCategory(''); setWard('');
      } else {
        alert('Failed to submit. Is the backend running?');
      }
    } catch {
      alert('Cannot connect to backend. Make sure to run: cd backend && uvicorn main:app --reload --port 8000');
    }
    setSubmitting(false);
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

                {/* Input Mode Selector */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
                  {([
                    { key: 'text' as const, icon: '💬', label: 'Text' },
                    { key: 'voice' as const, icon: '🎤', label: 'Voice' },
                    { key: 'photo' as const, icon: '📸', label: 'Photo' },
                  ]).map(mode => (
                    <button key={mode.key} onClick={() => setInputMode(mode.key)} style={{
                      flex: 1, padding: '10px', borderRadius: 8, cursor: 'pointer', border: 'none',
                      background: inputMode === mode.key ? 'rgba(59,130,246,0.15)' : 'var(--bg-tertiary)',
                      color: inputMode === mode.key ? 'var(--accent-blue-light)' : 'var(--text-secondary)',
                      fontWeight: 600, fontSize: '0.85rem', fontFamily: 'Inter, sans-serif',
                    }}>
                      {mode.icon} {mode.label}
                    </button>
                  ))}
                </div>

                <form onSubmit={handleSubmit}>
                  <div className="form-group">
                    <label className="form-label">Full Name</label>
                    <input className="form-input" value={name} onChange={e => setName(e.target.value)} placeholder="Enter your name" required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Phone Number</label>
                    <input className="form-input" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+91 XXXXX XXXXX" required />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div className="form-group">
                      <label className="form-label">Category</label>
                      <select className="form-select" value={category} onChange={e => setCategory(e.target.value)} required>
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

                  <div className="form-group">
                    <label className="form-label">Describe the Issue</label>
                    <textarea className="form-textarea" value={description} onChange={e => setDescription(e.target.value)} placeholder="Describe the problem in detail..." required />
                  </div>

                  <button type="submit" className="btn btn-primary" disabled={submitting} style={{
                    width: '100%', justifyContent: 'center', marginTop: 8,
                    opacity: submitting ? 0.7 : 1,
                  }}>
                    {submitting ? '⏳ Filing with AI...' : '🚀 Submit Complaint'}
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
                  </div>
                )}
              </div>

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
