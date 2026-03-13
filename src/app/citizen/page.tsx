'use client';

import { useState } from 'react';
import { CATEGORIES, WARDS, PRIORITY_CONFIG, STATUS_CONFIG } from '@/lib/mockData';

interface SubmittedComplaint {
  id: string;
  title: string;
  category: string;
  ward: string;
  priority: string;
  status: string;
  timestamp: string;
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
  const [complaints, setComplaints] = useState<SubmittedComplaint[]>([
    { id: 'TKT-4521', title: 'Water pipe burst on Main Road', category: 'Water Supply', ward: 'Ward 7', priority: 'P0', status: 'in_progress', timestamp: '2026-03-11T06:00:00' },
    { id: 'TKT-4529', title: 'Water contamination in Sector 8', category: 'Water Supply', ward: 'Ward 8', priority: 'P0', status: 'resolved', timestamp: '2026-03-05T07:00:00' },
  ]);
  const [trackingId, setTrackingId] = useState('');
  const [rating, setRating] = useState(0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newId = `TKT-${4530 + complaints.length + 1}`;
    const newComplaint: SubmittedComplaint = {
      id: newId, title: description.slice(0, 50), category, ward,
      priority: 'P2', status: 'open', timestamp: new Date().toISOString(),
    };
    setComplaints(prev => [newComplaint, ...prev]);
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 5000);
    setDescription(''); setName(''); setPhone('');
  };

  const trackedComplaint = complaints.find(c => c.id.toLowerCase() === trackingId.toLowerCase());

  return (
    <main className="main-content">
      <section className="section" style={{ paddingTop: 80 }}>
        <div className="container">
          <div className="section-label">CITIZEN PORTAL</div>
          <h1 className="section-title">Your Voice Matters</h1>
          <p className="section-subtitle" style={{ marginBottom: 32 }}>
            Report issues, track progress, and rate the resolution — all in one place
          </p>

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

                  {inputMode === 'text' && (
                    <div className="form-group">
                      <label className="form-label">Describe the Issue</label>
                      <textarea className="form-textarea" value={description} onChange={e => setDescription(e.target.value)} placeholder="Describe the problem in detail..." required />
                    </div>
                  )}

                  {inputMode === 'voice' && (
                    <div className="form-group">
                      <label className="form-label">Record Voice Note</label>
                      <div style={{
                        background: 'var(--bg-tertiary)', borderRadius: 12, padding: 24, textAlign: 'center',
                        border: '2px dashed var(--border-accent)', cursor: 'pointer',
                      }}>
                        <div style={{ fontSize: '3rem', marginBottom: 8, animation: 'pulse 2s infinite' }}>🎤</div>
                        <div style={{ color: 'var(--text-secondary)' }}>Tap to start recording</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: 4 }}>Supports Hindi, Bhojpuri, Tamil, and 9+ languages</div>
                      </div>
                    </div>
                  )}

                  {inputMode === 'photo' && (
                    <div className="form-group">
                      <label className="form-label">Upload Photo</label>
                      <div style={{
                        background: 'var(--bg-tertiary)', borderRadius: 12, padding: 24, textAlign: 'center',
                        border: '2px dashed var(--border-accent)', cursor: 'pointer',
                      }}>
                        <div style={{ fontSize: '3rem', marginBottom: 8 }}>📸</div>
                        <div style={{ color: 'var(--text-secondary)' }}>Click to upload or drag & drop</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: 4 }}>GPS will be auto-captured · AI will detect issue type</div>
                      </div>
                    </div>
                  )}

                  <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: 8 }}>
                    🚀 Submit Complaint
                  </button>
                </form>

                {submitted && (
                  <div style={{
                    marginTop: 16, padding: 16, borderRadius: 10,
                    background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)',
                    animation: 'fadeInUp 0.5s ease',
                  }}>
                    <div style={{ fontWeight: 700, color: '#22c55e', marginBottom: 4 }}>✅ Complaint Submitted Successfully!</div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      Your ticket ID: <strong style={{ color: 'var(--accent-blue-light)' }}>{complaints[0]?.id}</strong>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', marginTop: 4 }}>You will receive SMS updates on your registered phone.</div>
                  </div>
                )}
              </div>

              {/* Right Panel - How It Works */}
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
                  <input className="form-input" value={trackingId} onChange={e => setTrackingId(e.target.value)} placeholder="Enter Ticket ID (e.g., TKT-4521)" />
                  <button className="btn btn-primary">Search</button>
                </div>

                {trackedComplaint && (
                  <div style={{ marginTop: 24, animation: 'fadeInUp 0.3s ease' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                      <div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>{trackedComplaint.id}</div>
                        <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>{trackedComplaint.title}</div>
                      </div>
                      <span className={`badge badge-${trackedComplaint.priority.toLowerCase()}`}>{trackedComplaint.priority}</span>
                    </div>

                    {/* Status Timeline */}
                    <div style={{ display: 'flex', gap: 0, marginBottom: 24 }}>
                      {Object.entries(STATUS_CONFIG).map(([key, config], i) => {
                        const statuses = Object.keys(STATUS_CONFIG);
                        const currentIdx = statuses.indexOf(trackedComplaint.status);
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
                            }}>
                              {isComplete ? '✓' : (i + 1)}
                            </div>
                            <div style={{ fontSize: '0.7rem', fontWeight: 600, color: isComplete ? config.color : 'var(--text-tertiary)' }}>{config.label}</div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Rating */}
                    {trackedComplaint.status === 'resolved' && (
                      <div style={{ background: 'var(--bg-tertiary)', borderRadius: 12, padding: 20, textAlign: 'center' }}>
                        <div style={{ fontWeight: 700, marginBottom: 8 }}>Rate the Resolution</div>
                        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 8 }}>
                          {[1, 2, 3, 4, 5].map(star => (
                            <span key={star} onClick={() => setRating(star)} style={{
                              fontSize: '2rem', cursor: 'pointer',
                              color: star <= rating ? '#f59e0b' : 'var(--text-tertiary)',
                              transition: 'transform 0.2s',
                            }}>⭐</span>
                          ))}
                        </div>
                        {rating > 0 && <div style={{ color: '#22c55e', fontSize: '0.85rem' }}>Thank you for your feedback!</div>}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Recent Complaints */}
              <div className="glass-card" style={{ padding: 24 }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 16 }}>Your Complaints</h3>
                {complaints.map(c => {
                  const sConfig = STATUS_CONFIG[c.status as keyof typeof STATUS_CONFIG];
                  return (
                    <div key={c.id} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '12px 0', borderBottom: '1px solid var(--border-subtle)',
                    }}>
                      <div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--accent-blue-light)', fontWeight: 600 }}>{c.id}</div>
                        <div style={{ fontSize: '0.9rem' }}>{c.title}</div>
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
