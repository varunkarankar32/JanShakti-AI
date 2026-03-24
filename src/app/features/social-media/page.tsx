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
  fact_summary: string;
  fact?: string;
  source?: string;
  is_listed_last_week?: boolean;
  last_week_signal_summary?: string;
  possible_fact_check_actions?: string[];
  sources?: { title: string; publisher: string; url: string; published_hint?: string; relevance?: string }[];
  provider?: string;
  fallback_reason?: string;
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
  const [factRegion, setFactRegion] = useState('India');
  const [factLookback, setFactLookback] = useState(7);
  const [factResult, setFactResult] = useState<FactCheck | null>(null);
  const [factLoading, setFactLoading] = useState(false);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [govIntel, setGovIntel] = useState<any>(null);
  const [govLoading, setGovLoading] = useState(false);

  const runGovernanceIntelligence = async () => {
    setGovLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/dashboard/governance-intelligence`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ region: 'Municipal Region' }),
      });
      if (res.ok) {
        setGovIntel(await res.json());
      } else {
        setGovIntel(null);
      }
    } catch {
      setGovIntel(null);
    } finally {
      setGovLoading(false);
    }
  };

  const runManualFactCheck = async () => {
    if (!factInput.trim()) return;
    setFactLoading(true);
    setFactResult(null);

    try {
      const res = await fetch(`${API_BASE}/api/nlp/fact-check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: factInput.trim(),
          region: factRegion.trim() || 'India',
          lookback_days: factLookback,
        }),
      });
      if (!res.ok) return;
      const data = await res.json();
      setFactResult({
        claim: data.claim || data.input || factInput,
        verdict: data.verdict,
        fact_summary: data.fact_summary || data.fact,
        is_listed_last_week: data.is_listed_last_week,
        last_week_signal_summary: data.last_week_signal_summary,
        possible_fact_check_actions: data.possible_fact_check_actions || [],
        sources: data.sources || [],
        provider: data.provider,
        fallback_reason: data.fallback_reason,
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

  // — Helpers for verdict styling —
  const getVerdictColor = (verdict: string) => {
    switch (verdict) {
      case 'Likely True': return { bg: 'rgba(34,197,94,0.15)', color: '#15803d', border: 'rgba(34,197,94,0.4)', icon: '✅' };
      case 'Likely False': return { bg: 'rgba(239,68,68,0.15)', color: '#dc2626', border: 'rgba(239,68,68,0.4)', icon: '❌' };
      case 'Partly True': return { bg: 'rgba(245,158,11,0.15)', color: '#b45309', border: 'rgba(245,158,11,0.4)', icon: '⚠️' };
      default: return { bg: 'rgba(148,163,184,0.15)', color: '#475569', border: 'rgba(148,163,184,0.4)', icon: '❓' };
    }
  };

  const getConfidenceBar = (confidence: number) => {
    const pct = Math.round(confidence * 100);
    const hue = pct > 70 ? 142 : pct > 40 ? 38 : 0;
    return { pct, hue };
  };

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
            {/* Rumor Detection — compact card */}
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
                      <div><strong>Fact:</strong> {fc.fact_summary || fc.fact}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="glass-card" style={{ padding: 22 }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 12 }}>Starvation Guard</h3>
              {!starvationWatch ? (
                <div style={{ fontSize: '0.84rem', color: 'var(--text-tertiary)' }}>No starvation metrics available</div>
              ) : (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                    <div className="glass-card" style={{ padding: 12 }}>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>Unresponded {'>'} 24h</div>
                      <div style={{ fontWeight: 800, fontSize: '1.2rem', color: '#ea580c' }}>{starvationWatch.unresponded_24h}</div>
                    </div>
                    <div className="glass-card" style={{ padding: 12 }}>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>Unresponded {'>'} 72h</div>
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

          {/* ═══════════════════════════════════════════════════════════ */}
          {/* ═══  HYBRID NEWS FACT-CHECK — DEDICATED SECTION  ═══ */}
          {/* ═══════════════════════════════════════════════════════════ */}
          <div className="glass-card" style={{
            padding: 0,
            marginTop: 28,
            border: '1px solid rgba(16,185,129,0.25)',
            overflow: 'hidden',
            position: 'relative',
          }}>
            {/* Header Band */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(16,185,129,0.12) 0%, rgba(59,130,246,0.10) 50%, rgba(139,92,246,0.10) 100%)',
              borderBottom: '1px solid rgba(16,185,129,0.18)',
              padding: '18px 24px',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              flexWrap: 'wrap',
            }}>
              <div style={{ fontSize: '1.5rem' }}>🔍</div>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, letterSpacing: '-0.01em' }}>
                  AI Rumor Fact-Check
                </h3>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                  Paste any news, rumor, or WhatsApp forward — the verifier cross-checks live news evidence in seconds
                </div>
              </div>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
                <span style={{
                  fontSize: '0.62rem',
                  background: 'linear-gradient(135deg, #10b981, #3b82f6)',
                  color: '#fff',
                  padding: '3px 10px',
                  borderRadius: 12,
                  fontWeight: 700,
                  letterSpacing: '0.02em',
                }}>Hybrid Verifier</span>
                <span style={{
                  fontSize: '0.62rem',
                  background: 'rgba(245,158,11,0.15)',
                  color: '#b45309',
                  padding: '3px 10px',
                  borderRadius: 12,
                  fontWeight: 700,
                }}>+ News RSS + NLI</span>
              </div>
            </div>

            {/* Input Area */}
            <div style={{ padding: '20px 24px 16px' }}>
              <textarea
                id="fact-check-input"
                value={factInput}
                onChange={(e) => setFactInput(e.target.value)}
                placeholder={"Paste a rumor, WhatsApp forward, viral message, or news claim here...\n\nFor best results, include: the full message text, any dates mentioned, names of places or people, and any links if available. The verifier scans major Indian and international news sites from the selected lookback window."}
                rows={7}
                style={{
                  width: '100%',
                  border: '1.5px solid var(--border-subtle)',
                  borderRadius: 14,
                  padding: '14px 16px',
                  fontSize: '0.88rem',
                  lineHeight: 1.6,
                  resize: 'vertical',
                  background: 'rgba(15,23,42,0.02)',
                  transition: 'border-color 0.2s, box-shadow 0.2s',
                  outline: 'none',
                  fontFamily: 'inherit',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(16,185,129,0.5)';
                  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(16,185,129,0.08)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-subtle)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              />

              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr auto',
                gap: 10,
                marginTop: 12,
                alignItems: 'end',
              }}>
                <div>
                  <label style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: 4, display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Region / Location
                  </label>
                  <input
                    id="fact-check-region"
                    value={factRegion}
                    onChange={(e) => setFactRegion(e.target.value)}
                    placeholder="India, Delhi, Maharashtra..."
                    style={{
                      width: '100%',
                      border: '1.5px solid var(--border-subtle)',
                      borderRadius: 10,
                      padding: '10px 12px',
                      fontSize: '0.82rem',
                      outline: 'none',
                      transition: 'border-color 0.2s',
                      fontFamily: 'inherit',
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: 4, display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Lookback ({factLookback} days)
                  </label>
                  <input
                    id="fact-check-lookback"
                    type="range"
                    min={1}
                    max={30}
                    value={factLookback}
                    onChange={(e) => setFactLookback(Number(e.target.value))}
                    style={{
                      width: '100%',
                      height: 38,
                      accentColor: '#10b981',
                      cursor: 'pointer',
                    }}
                  />
                </div>
                <button
                  id="fact-check-submit"
                  onClick={runManualFactCheck}
                  disabled={factLoading || !factInput.trim()}
                  style={{
                    background: factLoading ? 'rgba(16,185,129,0.3)' : 'linear-gradient(135deg, #10b981, #059669)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 12,
                    padding: '12px 28px',
                    fontSize: '0.88rem',
                    fontWeight: 700,
                    cursor: factLoading || !factInput.trim() ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s',
                    whiteSpace: 'nowrap',
                    opacity: !factInput.trim() && !factLoading ? 0.5 : 1,
                    letterSpacing: '0.01em',
                  }}
                >
                  {factLoading ? '⏳ Analyzing...' : '🔍 Verify Now'}
                </button>
              </div>
            </div>

            {/* Loading State */}
            {factLoading && (
              <div style={{
                padding: '40px 24px',
                textAlign: 'center',
                background: 'linear-gradient(180deg, rgba(16,185,129,0.04) 0%, transparent 100%)',
              }}>
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 12,
                  background: 'rgba(16,185,129,0.08)',
                  border: '1px solid rgba(16,185,129,0.2)',
                  borderRadius: 16,
                  padding: '14px 24px',
                }}>
                  <div style={{
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    border: '2.5px solid rgba(16,185,129,0.3)',
                    borderTopColor: '#10b981',
                    animation: 'spin 0.8s linear infinite',
                  }} />
                  <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#10b981' }}>
                    Verifying claim across recent news sources...
                  </div>
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', marginTop: 10 }}>
                  Searching Google News RSS • Scoring support vs contradiction • Cross-referencing publishers
                </div>
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
              </div>
            )}

            {/* Result Display */}
            {factResult && !factLoading && (() => {
              const vc = getVerdictColor(factResult.verdict);
              const cb = getConfidenceBar(factResult.confidence);
              return (
                <div style={{ padding: '0 24px 24px' }}>
                  {/* Verdict Header */}
                  <div style={{
                    background: vc.bg,
                    border: `1.5px solid ${vc.border}`,
                    borderRadius: 14,
                    padding: '16px 20px',
                    marginBottom: 16,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
                      <span style={{ fontSize: '1.5rem' }}>{vc.icon}</span>
                      <span style={{
                        fontSize: '1.1rem',
                        fontWeight: 800,
                        color: vc.color,
                        letterSpacing: '-0.01em',
                      }}>
                        {factResult.verdict}
                      </span>

                      {/* Confidence */}
                      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 100, height: 7, background: 'rgba(0,0,0,0.08)', borderRadius: 10, overflow: 'hidden' }}>
                          <div style={{
                            width: `${cb.pct}%`,
                            height: '100%',
                            background: `hsl(${cb.hue}, 70%, 45%)`,
                            borderRadius: 10,
                            transition: 'width 0.6s ease',
                          }} />
                        </div>
                        <span style={{ fontSize: '0.74rem', fontWeight: 700, color: `hsl(${cb.hue}, 70%, 40%)` }}>
                          {cb.pct}%
                        </span>
                      </div>
                    </div>

                    {/* Signal Badges */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                      <span style={{
                        borderRadius: 999,
                        padding: '3px 10px',
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        background: factResult.is_listed_last_week ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.12)',
                        color: factResult.is_listed_last_week ? '#15803d' : '#dc2626',
                      }}>
                        {factResult.is_listed_last_week ? '📰 Found in Recent News' : '🚫 Not Found in Recent News'}
                      </span>
                      {factResult.provider && (
                        <span style={{
                          borderRadius: 999,
                          padding: '3px 10px',
                          fontSize: '0.68rem',
                          fontWeight: 700,
                          background: 'rgba(99,102,241,0.12)',
                          color: '#4338ca',
                        }}>
                          🤖 {factResult.provider === 'hybrid_news_nli_v1' ? 'Hybrid News + NLI' : factResult.provider === 'civic_kb_fallback' ? 'Civic KB (Fallback)' : factResult.provider}
                        </span>
                      )}
                    </div>

                    {/* Claim */}
                    <div style={{ fontSize: '0.82rem', lineHeight: 1.5, color: 'var(--text-secondary)' }}>
                      <strong style={{ color: 'var(--text-primary)' }}>Claim:</strong> {factResult.claim}
                    </div>
                  </div>

                  {/* AI Explanation */}
                  <div style={{
                    background: 'rgba(59,130,246,0.04)',
                    border: '1px solid rgba(59,130,246,0.15)',
                    borderRadius: 12,
                    padding: '14px 18px',
                    marginBottom: 16,
                  }}>
                    <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#3b82f6', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      🧠 AI Analysis
                    </div>
                    <div style={{ fontSize: '0.84rem', lineHeight: 1.65, color: 'var(--text-primary)' }}>
                      {factResult.fact_summary}
                    </div>
                  </div>

                  {/* Recent News Signal */}
                  {factResult.last_week_signal_summary && (
                    <div style={{
                      background: 'rgba(245,158,11,0.05)',
                      border: '1px solid rgba(245,158,11,0.2)',
                      borderRadius: 12,
                      padding: '12px 18px',
                      marginBottom: 16,
                    }}>
                      <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#b45309', marginBottom: 4 }}>
                        📅 Recent News Coverage Signal
                      </div>
                      <div style={{ fontSize: '0.82rem', lineHeight: 1.55, color: 'var(--text-secondary)' }}>
                        {factResult.last_week_signal_summary}
                      </div>
                    </div>
                  )}

                  {/* Fallback Technical Note */}
                  {factResult.fallback_reason && (
                    <div style={{
                      background: 'rgba(245,158,11,0.06)',
                      border: '1px solid rgba(245,158,11,0.2)',
                      borderRadius: 10,
                      padding: '10px 14px',
                      marginBottom: 16,
                      fontSize: '0.76rem',
                      color: '#b45309',
                    }}>
                      <strong>⚙️ Technical Note:</strong> {factResult.fallback_reason}
                    </div>
                  )}

                  {/* Two-Column: Sources + Actions */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: (factResult.sources && factResult.sources.length > 0) ? '2fr 1fr' : '1fr',
                    gap: 16,
                  }}>
                    {/* Sources */}
                    {factResult.sources && factResult.sources.length > 0 && (
                      <div>
                        <div style={{ fontSize: '0.78rem', fontWeight: 700, marginBottom: 8, color: 'var(--text-primary)' }}>
                          📎 Sources ({factResult.sources.length})
                        </div>
                        <div style={{ display: 'grid', gap: 8 }}>
                          {factResult.sources.slice(0, 8).map((src, idx) => (
                            <div key={`${src.url}-${idx}`} style={{
                              border: '1px solid var(--border-subtle)',
                              borderRadius: 10,
                              padding: '10px 12px',
                              background: 'rgba(255,255,255,0.6)',
                              transition: 'border-color 0.15s, transform 0.15s',
                            }}>
                              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>
                                {src.title || src.publisher || 'News Source'}
                              </div>
                              <div style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)', marginBottom: 4 }}>
                                {src.publisher || 'Unknown Publisher'} • {src.published_hint || 'unknown date'}
                              </div>
                              {src.relevance && (
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: 4 }}>
                                  {src.relevance}
                                </div>
                              )}
                              {src.url && (
                                <a
                                  href={src.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  style={{
                                    display: 'inline-block',
                                    fontSize: '0.7rem',
                                    color: '#3b82f6',
                                    textDecoration: 'none',
                                    wordBreak: 'break-all',
                                  }}
                                >
                                  🔗 {src.url.length > 80 ? src.url.slice(0, 80) + '...' : src.url}
                                </a>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* No sources fallback */}
                    {(!factResult.sources || factResult.sources.length === 0) && (
                      <div style={{
                        border: '1px dashed var(--border-subtle)',
                        borderRadius: 10,
                        padding: 16,
                        textAlign: 'center',
                        color: 'var(--text-tertiary)',
                        fontSize: '0.8rem',
                      }}>
                        No matching news sources found for this claim.
                      </div>
                    )}

                    {/* Recommended Actions */}
                    {factResult.possible_fact_check_actions && factResult.possible_fact_check_actions.length > 0 && (
                      <div>
                        <div style={{ fontSize: '0.78rem', fontWeight: 700, marginBottom: 8, color: 'var(--text-primary)' }}>
                          💡 Recommended Actions
                        </div>
                        <div style={{
                          background: 'rgba(139,92,246,0.05)',
                          border: '1px solid rgba(139,92,246,0.15)',
                          borderRadius: 10,
                          padding: '12px 14px',
                          display: 'grid',
                          gap: 6,
                        }}>
                          {factResult.possible_fact_check_actions.slice(0, 5).map((action, idx) => (
                            <div key={`action-${idx}`} style={{
                              fontSize: '0.76rem',
                              color: 'var(--text-secondary)',
                              lineHeight: 1.5,
                              paddingLeft: 16,
                              position: 'relative',
                            }}>
                              <span style={{ position: 'absolute', left: 0, color: '#8b5cf6', fontWeight: 700 }}>{idx + 1}.</span>
                              {action}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>

          {/* === AI GOVERNANCE INTELLIGENCE === */}
          <div className="glass-card" style={{ padding: 24, marginTop: 24, border: '1px solid rgba(139,92,246,0.3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0 }}>🧠 AI Governance Intelligence</h3>
              <span style={{ fontSize: '0.68rem', background: 'linear-gradient(135deg, #8b5cf6, #6366f1)', color: '#fff', padding: '2px 8px', borderRadius: 12, fontWeight: 600 }}>Gemini 2.5 Flash</span>
              <button className="btn btn-secondary" onClick={runGovernanceIntelligence} disabled={govLoading} style={{ marginLeft: 'auto' }}>
                {govLoading ? 'Running...' : 'Run Intelligence'}
              </button>
            </div>

            {!govLoading && !govIntel && (
              <div style={{ marginBottom: 12, fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>
                Click <strong>Run Intelligence</strong> to generate the governance intelligence report on demand and reduce unnecessary API usage.
              </div>
            )}

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
