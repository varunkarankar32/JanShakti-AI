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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [govIntel, setGovIntel] = useState<any>(null);
  const [govLoading, setGovLoading] = useState(false);

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

    // Auto-run governance intelligence
    const loadGov = async () => {
      setGovLoading(true);
      try {
        const res = await fetch(`${API_BASE}/api/dashboard/governance-intelligence`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ region: 'Municipal Region' }),
        });
        if (res.ok) {
          setGovIntel(await res.json());
        }
      } catch {
        setGovIntel(null);
      } finally {
        setGovLoading(false);
      }
    };
    loadGov();
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

          {/* === AI GOVERNANCE INTELLIGENCE === */}
          <div className="glass-card" style={{ padding: 24, marginTop: 24, border: '1px solid rgba(139,92,246,0.3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0 }}>🧠 AI Governance Intelligence</h3>
              <span style={{ fontSize: '0.68rem', background: 'linear-gradient(135deg, #8b5cf6, #6366f1)', color: '#fff', padding: '2px 8px', borderRadius: 12, fontWeight: 600 }}>Gemini 2.5 Flash</span>
            </div>

            {govLoading && (
              <div style={{ textAlign: 'center', padding: 30, color: 'var(--text-secondary)' }}>
                <div style={{ fontSize: '1.5rem', marginBottom: 8, animation: 'pulse 2s infinite' }}>🧠</div>
                Analyzing social signals with Gemini AI...
              </div>
            )}

            {govIntel && govIntel.success && (
              <div>
                {/* Leader Summary */}
                <div style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: 10, padding: 14, marginBottom: 16 }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#8b5cf6', marginBottom: 4 }}>📊 Leader Summary</div>
                  <div style={{ fontSize: '0.85rem', lineHeight: 1.55 }}>{govIntel.leader_summary}</div>
                </div>

                {/* Overall Sentiment */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, marginBottom: 16 }}>
                  <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 10 }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>Overall Sentiment</div>
                    <div style={{ fontWeight: 700, fontSize: '1rem', color: govIntel.overall_sentiment === 'Negative' ? '#dc2626' : govIntel.overall_sentiment === 'Positive' ? '#22c55e' : '#f59e0b' }}>
                      {govIntel.overall_sentiment} ({govIntel.overall_sentiment_score}/100)
                    </div>
                  </div>
                  {(govIntel.trending_topics || []).length > 0 && (
                    <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 10 }}>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', marginBottom: 4 }}>Trending Topics</div>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {govIntel.trending_topics.map((t: string, i: number) => (
                          <span key={i} style={{ fontSize: '0.68rem', background: 'rgba(59,130,246,0.1)', color: '#3b82f6', padding: '2px 6px', borderRadius: 8 }}>#{t}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Top 3 Urgent */}
                {govIntel.top_3_urgent && govIntel.top_3_urgent.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 700, marginBottom: 8 }}>🚨 Top 3 Urgent Issues</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 8 }}>
                      {govIntel.top_3_urgent.map((u: { issue: string; priority_score: number; why: string }, i: number) => (
                        <div key={i} style={{ border: '2px solid rgba(239,68,68,0.3)', borderRadius: 10, padding: 12, background: 'rgba(239,68,68,0.04)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                            <span style={{ fontWeight: 700, fontSize: '0.82rem' }}>{u.issue}</span>
                            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#dc2626' }}>{u.priority_score}/100</span>
                          </div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{u.why}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Detected Issues */}
                {govIntel.detected_issues && govIntel.detected_issues.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 700, marginBottom: 8 }}>📋 Detected Issues ({govIntel.detected_issues.length})</div>
                    <div style={{ display: 'grid', gap: 10 }}>
                      {govIntel.detected_issues.map((issue: { issue_name: string; category: string; mention_count: number; sentiment: string; sentiment_score: number; urgency: string; priority_score: number; is_viral: boolean; inferred_location: string; misinformation_status: string; immediate_action: string; short_term_action: string; long_term_solution: string; public_response: string }, i: number) => (
                        <div key={i} style={{ border: '1px solid var(--border-subtle)', borderRadius: 10, padding: 14 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                            <div>
                              <span style={{ fontWeight: 700, fontSize: '0.88rem' }}>{issue.issue_name}</span>
                              {issue.is_viral && <span style={{ marginLeft: 6, fontSize: '0.62rem', background: '#dc2626', color: '#fff', padding: '1px 5px', borderRadius: 8 }}>🔥 VIRAL</span>}
                            </div>
                            <div style={{ display: 'flex', gap: 4 }}>
                              <span style={{ fontSize: '0.62rem', padding: '2px 6px', borderRadius: 6, background: issue.urgency === 'Critical' ? '#dc2626' : issue.urgency === 'High' ? '#f59e0b' : '#22c55e', color: '#fff' }}>{issue.urgency}</span>
                              <span style={{ fontSize: '0.62rem', padding: '2px 6px', borderRadius: 6, background: issue.sentiment === 'Negative' ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.15)', color: issue.sentiment === 'Negative' ? '#dc2626' : '#22c55e' }}>{issue.sentiment}</span>
                            </div>
                          </div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: 6 }}>
                            {issue.category} • {issue.mention_count} mentions • {issue.inferred_location} • Priority: {issue.priority_score}/100
                          </div>
                          <div style={{ fontSize: '0.68rem', marginBottom: 4 }}>
                            <span style={{ fontWeight: 600 }}>🚀 Immediate:</span> {issue.immediate_action}
                          </div>
                          <div style={{ fontSize: '0.68rem', marginBottom: 4 }}>
                            <span style={{ fontWeight: 600 }}>📅 Short-term:</span> {issue.short_term_action}
                          </div>
                          <div style={{ fontSize: '0.68rem', marginBottom: 6 }}>
                            <span style={{ fontWeight: 600 }}>🏗️ Long-term:</span> {issue.long_term_solution}
                          </div>
                          {issue.public_response && (
                            <div style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)', borderRadius: 8, padding: 8, fontSize: '0.72rem' }}>
                              <div style={{ fontWeight: 600, marginBottom: 2 }}>🐦 AI Public Response:</div>
                              {issue.public_response}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Misinformation Flags */}
                {govIntel.misinformation_flags && govIntel.misinformation_flags.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 700, marginBottom: 8 }}>⚠️ Misinformation Check</div>
                    {govIntel.misinformation_flags.map((m: { claim: string; status: string; fact: string; source: string }, i: number) => (
                      <div key={i} style={{ border: '1px solid rgba(245,158,11,0.3)', borderRadius: 8, padding: 10, marginBottom: 6, background: 'rgba(245,158,11,0.04)' }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: 600 }}>{m.claim}</div>
                        <div style={{ fontSize: '0.68rem', color: m.status === 'Likely Misinformation' ? '#dc2626' : '#f59e0b', fontWeight: 600 }}>{m.status}</div>
                        <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>Fact: {m.fact}</div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Recommended Next Steps */}
                {govIntel.recommended_next_steps && govIntel.recommended_next_steps.length > 0 && (
                  <div>
                    <div style={{ fontSize: '0.8rem', fontWeight: 700, marginBottom: 6 }}>✅ Recommended Next Steps</div>
                    {govIntel.recommended_next_steps.map((s: string, i: number) => (
                      <div key={i} style={{ fontSize: '0.74rem', paddingLeft: 12, marginBottom: 3 }}>• {s}</div>
                    ))}
                  </div>
                )}

                <div style={{ marginTop: 10, fontSize: '0.62rem', color: 'var(--text-tertiary)', textAlign: 'right' }}>AI Model: {govIntel.ai_model}</div>
              </div>
            )}

            {govIntel && !govIntel.success && (
              <div style={{ color: '#dc2626', fontSize: '0.82rem' }}>❌ {govIntel.error || 'Analysis failed'}</div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
