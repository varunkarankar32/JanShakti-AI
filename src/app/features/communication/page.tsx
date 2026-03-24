'use client';

import { useState } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8010';

type Activity = {
  actor_role: string;
  action: string;
  note?: string;
  created_at?: string;
};

type TicketData = {
  ticket_id: string;
  status: string;
  citizen_update?: string;
  authority_response?: string;
  activity?: Activity[];
};

type ReportStats = {
  issues_raised?: number;
  issues_solved?: number;
  resolution_rate?: number;
  citizen_satisfaction?: number;
  open?: number;
  in_progress?: number;
  p0_raised?: number;
  p1_raised?: number;
  avg_resolution_hours?: number;
  stale_over_72h?: number;
};

type CommResult = {
  success: boolean;
  comm_type?: string;
  title?: string;
  content?: string;
  key_points?: string[];
  tone?: string;
  target_audience?: string;
  hashtags?: string[];
  ai_model?: string;
  error?: string;
};

const formatDate = (d: Date) => d.toISOString().slice(0, 10);

const COMM_TYPES = [
  { id: 'press_release', label: '📰 Press Release', desc: 'Formal official statement' },
  { id: 'social_post', label: '🐦 Social Post', desc: 'Twitter/X ready posts' },
  { id: 'citizen_advisory', label: '⚠️ Citizen Advisory', desc: 'Public safety notice' },
  { id: 'awareness_campaign', label: '📢 Campaign', desc: 'Awareness drive' },
];

export default function CommunicationPage() {
  const [ward, setWard] = useState('Ward 1');
  const [dateFrom, setDateFrom] = useState(formatDate(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)));
  const [dateTo, setDateTo] = useState(formatDate(new Date()));
  const [report, setReport] = useState('');
  const [reportStats, setReportStats] = useState<ReportStats | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState('');

  const [ticketId, setTicketId] = useState('');
  const [ticket, setTicket] = useState<TicketData | null>(null);
  const [ticketLoading, setTicketLoading] = useState(false);
  const [ticketError, setTicketError] = useState('');

  // AI Communication Studio state
  const [commType, setCommType] = useState('press_release');
  const [commWard, setCommWard] = useState('Ward 1');
  const [commCategory, setCommCategory] = useState('Roads & Potholes');
  const [commContext, setCommContext] = useState('');
  const [commResult, setCommResult] = useState<CommResult | null>(null);
  const [commLoading, setCommLoading] = useState(false);
  const [commCopied, setCommCopied] = useState(false);

  const generateReport = async () => {
    setReportLoading(true);
    setReportError('');
    setReport('');
    setReportStats(null);

    try {
      const res = await fetch(`${API_BASE}/api/reports/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ward, date_from: dateFrom, date_to: dateTo }),
      });

      if (!res.ok) {
        setReportError('Failed to generate report');
        return;
      }

      const data = await res.json();
      setReport(data.report || '');
      setReportStats(data.stats || null);
    } catch {
      setReportError('Unable to reach backend');
    } finally {
      setReportLoading(false);
    }
  };

  const fetchTicketTimeline = async () => {
    if (!ticketId.trim()) return;
    setTicketLoading(true);
    setTicketError('');
    setTicket(null);

    try {
      const res = await fetch(`${API_BASE}/api/complaints/${ticketId.trim()}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setTicketError(data?.detail || 'Ticket not found');
        return;
      }
      const data = await res.json();
      setTicket(data);
    } catch {
      setTicketError('Unable to load ticket timeline');
    } finally {
      setTicketLoading(false);
    }
  };

  const generateCommunication = async () => {
    setCommLoading(true);
    setCommResult(null);
    setCommCopied(false);

    try {
      const res = await fetch(`${API_BASE}/api/complaints/ai/generate-communication`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          comm_type: commType,
          ward: commWard,
          category: commCategory,
          context: commContext,
          total_complaints: 50,
          resolved: 30,
          pending: 20,
          p0_active: 3,
        }),
      });

      const data = await res.json();
      setCommResult(data);
    } catch {
      setCommResult({ success: false, error: 'Unable to reach AI service' });
    } finally {
      setCommLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCommCopied(true);
    setTimeout(() => setCommCopied(false), 2000);
  };

  return (
    <main className="main-content">
      <section className="section" style={{ paddingTop: 80 }}>
        <div className="container">
          <div className="section-label">CHAPTER 08</div>
          <h1 className="section-title">AI Communication Engine</h1>
          <p className="section-subtitle" style={{ marginBottom: 40 }}>
            Auto-generated ward reports, transparent citizen communication, and AI-powered public communications
          </p>

          {/* AI Communication Studio */}
          <div className="glass-card" style={{ padding: 24, marginBottom: 24, border: '1px solid rgba(139,92,246,0.3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>✨ AI Communication Studio</h3>
              <span style={{ fontSize: '0.68rem', background: 'linear-gradient(135deg, #8b5cf6, #6366f1)', color: '#fff', padding: '2px 8px', borderRadius: 12, fontWeight: 600 }}>Gemini 2.5 Flash</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 14 }}>
              {COMM_TYPES.map((ct) => (
                <button
                  key={ct.id}
                  onClick={() => setCommType(ct.id)}
                  style={{
                    padding: '10px 8px',
                    borderRadius: 10,
                    border: commType === ct.id ? '2px solid #8b5cf6' : '1px solid var(--border-subtle)',
                    background: commType === ct.id ? 'rgba(139,92,246,0.1)' : 'var(--bg-tertiary)',
                    cursor: 'pointer',
                    textAlign: 'center',
                    transition: 'all 0.2s',
                  }}
                >
                  <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{ct.label}</div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)', marginTop: 2 }}>{ct.desc}</div>
                </button>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr', gap: 10, marginBottom: 12 }}>
              <div className="form-group">
                <label className="form-label">Ward</label>
                <input className="form-input" value={commWard} onChange={(e) => setCommWard(e.target.value)} placeholder="Ward 1" />
              </div>
              <div className="form-group">
                <label className="form-label">Category</label>
                <select className="form-input" value={commCategory} onChange={(e) => setCommCategory(e.target.value)}>
                  {['Roads & Potholes', 'Garbage & Sanitation', 'Water Supply', 'Drainage', 'Electricity', 'Safety & Security', 'Others'].map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Context (optional)</label>
                <input className="form-input" value={commContext} onChange={(e) => setCommContext(e.target.value)} placeholder="E.g., Recent flooding in Ward 3..." />
              </div>
            </div>

            <button
              className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center', background: 'linear-gradient(135deg, #8b5cf6, #6366f1)' }}
              onClick={generateCommunication}
              disabled={commLoading}
            >
              {commLoading ? '🧠 Generating with Gemini AI...' : '✨ Generate AI Communication'}
            </button>

            {commResult && commResult.success && (
              <div style={{ marginTop: 16, border: '1px solid rgba(139,92,246,0.2)', borderRadius: 12, padding: 16, background: 'rgba(139,92,246,0.04)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '1rem' }}>{commResult.title}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', marginTop: 2 }}>
                      {commResult.tone} • {commResult.target_audience} • {commResult.ai_model}
                    </div>
                  </div>
                  <button
                    className="btn btn-secondary"
                    style={{ fontSize: '0.72rem', padding: '4px 10px' }}
                    onClick={() => copyToClipboard(commResult.content || '')}
                  >
                    {commCopied ? '✅ Copied!' : '📋 Copy'}
                  </button>
                </div>

                <pre style={{
                  whiteSpace: 'pre-wrap',
                  fontSize: '0.78rem',
                  lineHeight: 1.6,
                  background: 'var(--bg-primary)',
                  borderRadius: 8,
                  padding: 12,
                  border: '1px solid var(--border-subtle)',
                  marginBottom: 10,
                }}>
                  {commResult.content}
                </pre>

                {commResult.key_points && commResult.key_points.length > 0 && (
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: '0.72rem', fontWeight: 600, marginBottom: 4 }}>Key Points:</div>
                    {commResult.key_points.map((p, i) => (
                      <div key={i} style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', paddingLeft: 10 }}>• {p}</div>
                    ))}
                  </div>
                )}

                {commResult.hashtags && commResult.hashtags.length > 0 && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {commResult.hashtags.map((h, i) => (
                      <span key={i} style={{ fontSize: '0.68rem', background: 'rgba(59,130,246,0.1)', color: '#3b82f6', padding: '2px 8px', borderRadius: 10 }}>{h}</span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {commResult && !commResult.success && (
              <div style={{ marginTop: 10, color: '#dc2626', fontSize: '0.82rem' }}>❌ {commResult.error}</div>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 24 }}>
            <div className="glass-card" style={{ padding: 24 }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 14 }}>Ward Report Generator</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div className="form-group">
                  <label className="form-label">Ward</label>
                  <input className="form-input" value={ward} onChange={(e) => setWard(e.target.value)} placeholder="Ward 1" />
                </div>
                <div />
                <div className="form-group">
                  <label className="form-label">From Date</label>
                  <input type="date" className="form-input" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">To Date</label>
                  <input type="date" className="form-input" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                </div>
              </div>

              <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={generateReport}>
                {reportLoading ? 'Generating...' : 'Generate Live Report'}
              </button>

              {reportError && <div style={{ color: '#dc2626', marginTop: 10, fontSize: '0.82rem' }}>{reportError}</div>}

              {reportStats && (
                <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
                  {[
                    { label: 'Raised', value: reportStats.issues_raised ?? 0 },
                    { label: 'Solved', value: reportStats.issues_solved ?? 0 },
                    { label: 'Resolution', value: `${reportStats.resolution_rate ?? 0}%` },
                    { label: 'Satisfaction', value: `${reportStats.citizen_satisfaction ?? 0}/5` },
                    { label: 'Open', value: reportStats.open ?? 0 },
                    { label: 'In Progress', value: reportStats.in_progress ?? 0 },
                    { label: 'P0', value: reportStats.p0_raised ?? 0 },
                    { label: 'Stale >72h', value: reportStats.stale_over_72h ?? 0 },
                  ].map((item) => (
                    <div key={item.label} style={{ border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 8 }}>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>{item.label}</div>
                      <div style={{ fontSize: '0.95rem', fontWeight: 700 }}>{item.value}</div>
                    </div>
                  ))}
                </div>
              )}

              {report && (
                <pre style={{
                  marginTop: 12,
                  background: 'var(--bg-primary)',
                  borderRadius: 8,
                  padding: 14,
                  border: '1px solid var(--border-subtle)',
                  fontSize: '0.75rem',
                  lineHeight: 1.55,
                  whiteSpace: 'pre-wrap',
                }}>
                  {report}
                </pre>
              )}
            </div>

            <div className="glass-card" style={{ padding: 24 }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 14 }}>Citizen Update Timeline</h3>
              <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                <input className="form-input" value={ticketId} onChange={(e) => setTicketId(e.target.value)} placeholder="TKT-XXXXXX" />
                <button className="btn btn-secondary" onClick={fetchTicketTimeline}>{ticketLoading ? 'Loading...' : 'Load'}</button>
              </div>

              {ticketError && <div style={{ color: '#dc2626', marginBottom: 10, fontSize: '0.82rem' }}>{ticketError}</div>}

              {ticket && (
                <div>
                  <div style={{ marginBottom: 10, fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
                    <strong>{ticket.ticket_id}</strong> | Status: <strong>{ticket.status}</strong>
                  </div>

                  {ticket.citizen_update && (
                    <div style={{
                      background: 'rgba(59,130,246,0.08)',
                      border: '1px solid rgba(59,130,246,0.2)',
                      borderRadius: 8,
                      padding: 10,
                      marginBottom: 10,
                      fontSize: '0.82rem',
                    }}>
                      {ticket.citizen_update}
                    </div>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {(ticket.activity || []).slice(-8).reverse().map((a, idx) => (
                      <div key={`${a.action}-${idx}`} style={{
                        borderRadius: 8,
                        border: '1px solid var(--border-subtle)',
                        padding: 10,
                        background: 'var(--bg-tertiary)',
                      }}>
                        <div style={{ fontWeight: 600, fontSize: '0.82rem' }}>{a.action.replaceAll('_', ' ')}</div>
                        {a.note && <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 4 }}>{a.note}</div>}
                        <div style={{ marginTop: 4, fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>
                          {a.actor_role} {a.created_at ? `| ${new Date(a.created_at).toLocaleString('en-IN')}` : ''}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

