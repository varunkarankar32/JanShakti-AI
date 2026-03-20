'use client';

import { useState } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8010';

type VerificationPayload = {
  verification_status: string;
  verification_score: number;
  verification_confidence: number;
  components?: {
    visual_score: number;
    geo_score: number;
    time_score: number;
    geo_distance_m?: number | null;
  };
  reasons?: string[];
};

export default function VerificationPage() {
  const [ticketId, setTicketId] = useState('');
  const [beforeFile, setBeforeFile] = useState<File | null>(null);
  const [afterFile, setAfterFile] = useState<File | null>(null);
  const [lat, setLat] = useState('');
  const [lon, setLon] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [result, setResult] = useState<VerificationPayload | null>(null);

  const leaderToken = typeof window === 'undefined' ? '' : window.localStorage.getItem('leader_token') || '';

  const uploadStage = async (stage: 'before' | 'after') => {
    const file = stage === 'before' ? beforeFile : afterFile;
    if (!ticketId.trim() || !file) {
      setMessage(`Enter ticket and pick a ${stage} photo.`);
      return;
    }

    if (!leaderToken) {
      setMessage('Leader login required in dashboard before uploading verification evidence.');
      return;
    }

    setLoading(true);
    setMessage('');
    try {
      const form = new FormData();
      form.append('photo', file);
      if (lat.trim()) form.append('latitude', lat.trim());
      if (lon.trim()) form.append('longitude', lon.trim());
      form.append('captured_at', new Date().toISOString());

      const res = await fetch(`${API_BASE}/api/complaints/${ticketId.trim()}/verification/${stage}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${leaderToken}` },
        body: form,
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(data?.detail || `Failed to upload ${stage} photo`);
        return;
      }

      setMessage(`${stage.toUpperCase()} evidence uploaded.`);
    } catch {
      setMessage('Upload failed due to network or server issue.');
    } finally {
      setLoading(false);
    }
  };

  const runVerification = async () => {
    if (!ticketId.trim()) {
      setMessage('Enter ticket id first.');
      return;
    }
    if (!leaderToken) {
      setMessage('Leader login required in dashboard before running verification.');
      return;
    }

    setLoading(true);
    setMessage('');
    setResult(null);

    try {
      const res = await fetch(`${API_BASE}/api/complaints/${ticketId.trim()}/verification/run`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${leaderToken}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(data?.detail || 'Verification failed');
        return;
      }

      setResult(data);
      setMessage('AI verification completed successfully.');
    } catch {
      setMessage('Verification engine unavailable right now.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="main-content">
      <section className="section" style={{ paddingTop: 80 }}>
        <div className="container">
          <div className="section-label">CHAPTER 06</div>
          <h1 className="section-title">Proof-of-Work Verification Engine</h1>
          <p className="section-subtitle" style={{ marginBottom: 32 }}>
            Upload before and after evidence, run AI verification, and score authenticity with geo, time, and visual checks
          </p>

          <div className="glass-card" style={{ padding: 24 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12, marginBottom: 12 }}>
              <input className="form-input" value={ticketId} onChange={(e) => setTicketId(e.target.value)} placeholder="Ticket ID (TKT-XXXXXX)" />
              <input className="form-input" value={lat} onChange={(e) => setLat(e.target.value)} placeholder="Latitude (optional)" />
              <input className="form-input" value={lon} onChange={(e) => setLon(e.target.value)} placeholder="Longitude (optional)" />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12, marginBottom: 14 }}>
              <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 12 }}>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>Before Evidence</div>
                <input type="file" accept="image/*" onChange={(e) => setBeforeFile(e.target.files?.[0] || null)} />
                <button className="btn btn-secondary" style={{ marginTop: 8 }} onClick={() => uploadStage('before')} disabled={loading}>Upload Before</button>
              </div>

              <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 12 }}>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>After Evidence</div>
                <input type="file" accept="image/*" onChange={(e) => setAfterFile(e.target.files?.[0] || null)} />
                <button className="btn btn-secondary" style={{ marginTop: 8 }} onClick={() => uploadStage('after')} disabled={loading}>Upload After</button>
              </div>
            </div>

            <button className="btn btn-primary" onClick={runVerification} disabled={loading}>
              {loading ? 'Processing...' : 'Run AI Verification'}
            </button>

            {message && <div style={{ marginTop: 10, fontSize: '0.84rem', color: 'var(--text-secondary)' }}>{message}</div>}

            {result && (
              <div style={{ marginTop: 16, border: '1px solid var(--border-subtle)', borderRadius: 10, padding: 14, background: 'var(--bg-secondary)' }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
                  <span className={`badge badge-${result.verification_status === 'verified' ? 'p2' : 'p0'}`}>{result.verification_status}</span>
                  <strong>Score {result.verification_score}/100</strong>
                  <span style={{ color: 'var(--text-tertiary)' }}>Confidence {result.verification_confidence}</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
                  <div className="glass-card" style={{ padding: 10 }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>Visual Change</div>
                    <div style={{ fontSize: '1rem', fontWeight: 700 }}>{result.components?.visual_score ?? 0}</div>
                  </div>
                  <div className="glass-card" style={{ padding: 10 }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>Geo Match</div>
                    <div style={{ fontSize: '1rem', fontWeight: 700 }}>{result.components?.geo_score ?? 0}</div>
                  </div>
                  <div className="glass-card" style={{ padding: 10 }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>Time Window</div>
                    <div style={{ fontSize: '1rem', fontWeight: 700 }}>{result.components?.time_score ?? 0}</div>
                  </div>
                  <div className="glass-card" style={{ padding: 10 }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>Distance (m)</div>
                    <div style={{ fontSize: '1rem', fontWeight: 700 }}>{result.components?.geo_distance_m ?? 'N/A'}</div>
                  </div>
                </div>

                {result.reasons && result.reasons.length > 0 && (
                  <div style={{ marginTop: 10, fontSize: '0.8rem', color: '#b91c1c' }}>
                    Flags: {result.reasons.join(', ')}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
