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

const formatDate = (d: Date) => d.toISOString().slice(0, 10);

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

  const generateReport = async () => {
    setReportLoading(true);
    setReportError('');
    setReport('');
    setReportStats(null);

    try {
      const res = await fetch(`${API_BASE}/api/reports/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ward,
          date_from: dateFrom,
          date_to: dateTo,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setReportError(data?.detail || 'Failed to generate report');
        return;
      }

      const data = await res.json();
      setReport(data.report_text || 'No report text returned');
      setReportStats((data.stats || null) as ReportStats | null);
    } catch {
      setReportError('Unable to connect to report service');
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

  return (
    <main className="main-content">
      <section className="section" style={{ paddingTop: 80 }}>
        <div className="container">
          <div className="section-label">CHAPTER 08</div>
          <h1 className="section-title">AI Communication Engine</h1>
          <p className="section-subtitle" style={{ marginBottom: 40 }}>
            Auto-generated ward reports and transparent citizen communication from live complaint data
          </p>

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
