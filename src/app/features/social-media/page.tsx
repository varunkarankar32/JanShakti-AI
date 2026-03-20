'use client';

import { useEffect, useState } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8010';

type Alert = {
  type: string;
  icon: string;
  message: string;
  time: string;
};

type WardHeat = {
  ward: string;
  complaints: number;
  severity: string;
};

type Incident = {
  incident_id: string;
  ward: string;
  category: string;
  complaint_count: number;
  p0_count: number;
  risk_score: number;
  severity: string;
};

type ProactiveAnnouncement = {
  ward: string;
  alert_type: string;
  risk: string;
  signal_count: number;
  announcement: string;
  precautions: string[];
};

type WardDrive = {
  ward: string;
  focus_category: string;
  complaint_load: number;
  drive_title: string;
  playbook: string;
};

type MisinfoAlert = {
  rumor_id: string;
  ward: string;
  ticket_id?: string;
  severity: string;
  claim_preview: string;
  fact: string;
  source: string;
};

type FactCheck = {
  claim: string;
  verdict: string;
  fact: string;
  source: string;
  affected_ward: string;
  confidence: number;
};

type StarvationWatch = {
  unresponded_24h: number;
  unresponded_72h: number;
  stale_queue: { ticket_id: string; ward: string; category: string; age_hours: number; severity: string }[];
};

export default function SocialMediaPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [heat, setHeat] = useState<WardHeat[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [announcements, setAnnouncements] = useState<ProactiveAnnouncement[]>([]);
  const [wardDrives, setWardDrives] = useState<WardDrive[]>([]);
  const [misinfoAlerts, setMisinfoAlerts] = useState<MisinfoAlert[]>([]);
  const [factChecks, setFactChecks] = useState<FactCheck[]>([]);
  const [starvationWatch, setStarvationWatch] = useState<StarvationWatch | null>(null);
  const [factInput, setFactInput] = useState('');
  const [factResult, setFactResult] = useState<FactCheck | null>(null);
  const [factLoading, setFactLoading] = useState(false);

  const runManualFactCheck = async () => {
    if (!factInput.trim()) return;
    setFactLoading(true);
    setFactResult(null);

    try {
      const res = await fetch(`${API_BASE}/api/nlp/fact-check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: factInput.trim() }),
      });
      if (!res.ok) return;
      const data = await res.json();
      setFactResult({
        claim: data.input || factInput,
        verdict: data.verdict,
        fact: data.fact,
        source: data.source,
        affected_ward: 'Manual Check',
        confidence: data.confidence || 0,
      });
    } catch {
      setFactResult(null);
    } finally {
      setFactLoading(false);
    }
  };

  useEffect(() => {
    const load = async () => {
      try {
        const [statsRes, incidentsRes] = await Promise.all([
          fetch(`${API_BASE}/api/dashboard/public-analytics`, { cache: 'no-store' }),
          fetch(`${API_BASE}/api/complaints/incidents/summary?limit=12`, { cache: 'no-store' }),
        ]);

        const intelligenceRes = await fetch(`${API_BASE}/api/dashboard/intelligence`, { cache: 'no-store' });

        if (statsRes.ok) {
          const stats = await statsRes.json();
          setAlerts(stats.alerts || []);
          setHeat(stats.ward_heat_data || []);
        }

        if (incidentsRes.ok) {
          const incidentData = await incidentsRes.json();
          setIncidents(incidentData.incidents || []);
        }

        if (intelligenceRes.ok) {
          const intelligence = await intelligenceRes.json();
          setAnnouncements(intelligence.proactive_announcements || []);
          setWardDrives(intelligence.ward_drives || []);
          setMisinfoAlerts(intelligence.misinfo_alerts || []);
          setFactChecks(intelligence.fact_checks || []);
          setStarvationWatch(intelligence.starvation_watch || null);
        }
      } catch {
        setAlerts([]);
        setHeat([]);
        setIncidents([]);
        setAnnouncements([]);
        setWardDrives([]);
        setMisinfoAlerts([]);
        setFactChecks([]);
        setStarvationWatch(null);
      }
    };

    load();
  }, []);

  return (
    <main className="main-content">
      <section className="section" style={{ paddingTop: 80 }}>
        <div className="container">
          <div className="section-label">CHAPTER 07</div>
          <h1 className="section-title">Social Signal Intelligence</h1>
          <p className="section-subtitle" style={{ marginBottom: 36 }}>
            AI fused incident clustering, live operational alerts, and ward-level sentiment proxy from active complaints
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20, marginBottom: 30 }}>
            <div className="glass-card" style={{ padding: 22 }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 12 }}>Early Warning Alerts</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {alerts.length === 0 && <div style={{ color: 'var(--text-tertiary)', fontSize: '0.84rem' }}>No alerts available</div>}
                {alerts.map((a, idx) => (
                  <div key={`${a.type}-${idx}`} style={{
                    borderRadius: 8,
                    padding: 10,
                    border: '1px solid var(--border-subtle)',
                    background: a.type === 'critical' ? 'rgba(239,68,68,0.08)' : a.type === 'warning' ? 'rgba(249,115,22,0.08)' : 'rgba(59,130,246,0.08)',
                  }}>
                    <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{a.icon} {a.message}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', marginTop: 4 }}>{a.time}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="glass-card" style={{ padding: 22 }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 12 }}>Ward Hotspot Map</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(120px, 1fr))', gap: 10 }}>
                {heat.slice(0, 10).map((w) => (
                  <div key={w.ward} style={{
                    borderRadius: 8,
                    padding: 10,
                    border: '1px solid var(--border-subtle)',
                    background: w.severity === 'high' ? 'rgba(239,68,68,0.12)' : w.severity === 'medium' ? 'rgba(249,115,22,0.12)' : 'rgba(34,197,94,0.12)',
                  }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>{w.ward}</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>{w.complaints}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="glass-card" style={{ padding: 24 }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 12 }}>Incident Clusters (Merged Complaints)</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
              {incidents.length === 0 && <div style={{ color: 'var(--text-tertiary)', fontSize: '0.84rem' }}>No clusters detected yet</div>}
              {incidents.map((incident) => (
                <div key={incident.incident_id} style={{
                  borderRadius: 8,
                  padding: 12,
                  border: '1px solid var(--border-subtle)',
                  background: incident.severity === 'critical' ? 'rgba(239,68,68,0.08)' : incident.severity === 'high' ? 'rgba(249,115,22,0.08)' : 'rgba(59,130,246,0.08)',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <strong style={{ fontSize: '0.84rem' }}>{incident.incident_id}</strong>
                    <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: 1 }}>{incident.severity}</span>
                  </div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{incident.category} in {incident.ward}</div>
                  <div style={{ marginTop: 6, fontSize: '0.8rem' }}>
                    Complaints: <strong>{incident.complaint_count}</strong> | P0: <strong>{incident.p0_count}</strong>
                  </div>
                  <div style={{ marginTop: 4, fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>
                    Risk Score: {incident.risk_score}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20, marginTop: 24 }}>
            <div className="glass-card" style={{ padding: 22 }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 12 }}>Proactive Warnings & Precautions</h3>
              <div style={{ display: 'grid', gap: 10 }}>
                {announcements.length === 0 && <div style={{ fontSize: '0.84rem', color: 'var(--text-tertiary)' }}>No proactive warning triggered yet</div>}
                {announcements.slice(0, 6).map((a, idx) => (
                  <div key={`${a.ward}-${idx}`} style={{ border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <strong style={{ fontSize: '0.83rem' }}>{a.alert_type} • {a.ward}</strong>
                      <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: a.risk === 'critical' ? '#dc2626' : a.risk === 'high' ? '#ea580c' : '#2563eb' }}>{a.risk}</span>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 6 }}>{a.announcement}</div>
                    <div style={{ fontSize: '0.76rem', color: 'var(--text-tertiary)' }}>
                      Precautions: {a.precautions.join(' | ')}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="glass-card" style={{ padding: 22 }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 12 }}>Ward Drives Planner</h3>
              <div style={{ display: 'grid', gap: 10 }}>
                {wardDrives.length === 0 && <div style={{ fontSize: '0.84rem', color: 'var(--text-tertiary)' }}>No drive recommendations available</div>}
                {wardDrives.slice(0, 8).map((d, idx) => (
                  <div key={`${d.ward}-${idx}`} style={{ border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 10 }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 700 }}>{d.drive_title}</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{d.ward} • {d.focus_category} • Load {d.complaint_load}</div>
                    <div style={{ marginTop: 4, fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>{d.playbook}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20, marginTop: 24 }}>
            <div className="glass-card" style={{ padding: 22 }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 12 }}>Rumor Detection & Fact Checks</h3>
              <div style={{ display: 'grid', gap: 10 }}>
                {misinfoAlerts.length === 0 && <div style={{ fontSize: '0.84rem', color: 'var(--text-tertiary)' }}>No active rumor signal</div>}
                {misinfoAlerts.slice(0, 6).map((m, idx) => (
                  <div key={`${m.rumor_id}-${idx}`} style={{ borderRadius: 8, border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.08)', padding: 10 }}>
                    <div style={{ fontSize: '0.82rem', fontWeight: 700 }}>Ward {m.ward} • {m.severity}</div>
                    <div style={{ fontSize: '0.78rem', marginTop: 4, color: 'var(--text-secondary)' }}>{m.claim_preview}</div>
                    <div style={{ fontSize: '0.78rem', marginTop: 4 }}><strong>Fact:</strong> {m.fact}</div>
                    <div style={{ fontSize: '0.72rem', marginTop: 2, color: 'var(--text-tertiary)' }}>{m.source}</div>
                  </div>
                ))}
              </div>

              {factChecks.length > 0 && (
                <div style={{ marginTop: 12, borderTop: '1px solid var(--border-subtle)', paddingTop: 10, display: 'grid', gap: 8 }}>
                  {factChecks.slice(0, 4).map((fc, idx) => (
                    <div key={`${fc.claim}-${idx}`} style={{ fontSize: '0.78rem', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 8 }}>
                      <div><strong>Claim:</strong> {fc.claim}</div>
                      <div><strong>Verdict:</strong> {fc.verdict}</div>
                      <div><strong>Fact:</strong> {fc.fact}</div>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ marginTop: 12, borderTop: '1px solid var(--border-subtle)', paddingTop: 10 }}>
                <div style={{ fontSize: '0.78rem', fontWeight: 700, marginBottom: 6 }}>Manual Rumor Fact Check</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    value={factInput}
                    onChange={(e) => setFactInput(e.target.value)}
                    placeholder="Paste rumor text to verify"
                    style={{ flex: 1, border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '8px 10px', fontSize: '0.8rem' }}
                  />
                  <button className="btn btn-secondary" onClick={runManualFactCheck} disabled={factLoading}>
                    {factLoading ? 'Checking...' : 'Verify'}
                  </button>
                </div>

                {factResult && (
                  <div style={{ marginTop: 8, border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 8, fontSize: '0.78rem' }}>
                    <div><strong>Verdict:</strong> {factResult.verdict}</div>
                    <div><strong>Fact:</strong> {factResult.fact}</div>
                    <div style={{ color: 'var(--text-tertiary)' }}>{factResult.source}</div>
                  </div>
                )}
              </div>
            </div>

            <div className="glass-card" style={{ padding: 22 }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 12 }}>Starvation Guard</h3>
              {!starvationWatch ? (
                <div style={{ fontSize: '0.84rem', color: 'var(--text-tertiary)' }}>No starvation metrics available</div>
              ) : (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                    <div className="glass-card" style={{ padding: 12 }}>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>Unresponded {'>'}24h</div>
                      <div style={{ fontWeight: 800, fontSize: '1.2rem', color: '#ea580c' }}>{starvationWatch.unresponded_24h}</div>
                    </div>
                    <div className="glass-card" style={{ padding: 12 }}>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>Unresponded {'>'}72h</div>
                      <div style={{ fontWeight: 800, fontSize: '1.2rem', color: '#dc2626' }}>{starvationWatch.unresponded_72h}</div>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gap: 8 }}>
                    {starvationWatch.stale_queue?.slice(0, 6).map((s, idx) => (
                      <div key={`${s.ticket_id}-${idx}`} style={{ border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 8, fontSize: '0.78rem' }}>
                        <strong>{s.ticket_id}</strong> • {s.ward} • {s.category}
                        <div style={{ color: 'var(--text-secondary)' }}>{s.age_hours}h waiting • {s.severity}</div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
