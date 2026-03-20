'use client';

import { useEffect, useMemo, useState } from 'react';

type Complaint = {
  ticket_id: string;
  category: string;
  priority: 'P0' | 'P1' | 'P2' | 'P3';
  input_mode: 'text' | 'voice' | 'photo';
  created_at: string | null;
  resolved_at?: string | null;
  rating?: number | null;
};

type DashboardStats = {
  total_complaints: number;
  resolution_rate: number;
  avg_response_days: number;
  trust_index: number;
  complaints_today: number;
  resolved_today: number;
  p0_active: number;
  pending_verification: number;
  satisfaction: number;
  category_distribution: { name: string; value: number; color: string }[];
  trend_data: { week: string; complaints: number; resolved: number; satisfaction: number }[];
  ward_heat_data: { ward: string; complaints: number; severity: string }[];
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8010';

const PRIORITY_COLORS: Record<string, string> = {
  P0: '#ef4444',
  P1: '#f97316',
  P2: '#eab308',
  P3: '#22c55e',
};

export default function AnalyticsPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [backendOnline, setBackendOnline] = useState(false);

  useEffect(() => {
    const run = async () => {
      try {
        const [statsRes, complaintsRes] = await Promise.all([
          fetch(`${API_BASE}/api/dashboard/public-analytics`, { cache: 'no-store' }),
          fetch(`${API_BASE}/api/complaints?limit=500`, { cache: 'no-store' }),
        ]);

        if (!statsRes.ok || !complaintsRes.ok) {
          setBackendOnline(false);
          return;
        }

        const statsData = await statsRes.json();
        const complaintsData = await complaintsRes.json();

        setStats(statsData);
        setComplaints(complaintsData.complaints || []);
        setBackendOnline(true);
      } catch {
        setBackendOnline(false);
      }
    };

    run();
  }, []);

  const priorityDist = useMemo(() => {
    const total = complaints.length || 1;
    const counts = { P0: 0, P1: 0, P2: 0, P3: 0 };
    complaints.forEach((c) => {
      counts[c.priority] += 1;
    });

    return (['P0', 'P1', 'P2', 'P3'] as const).map((priority) => ({
      priority,
      count: counts[priority],
      pct: Math.round((counts[priority] / total) * 100),
    }));
  }, [complaints]);

  const inputDist = useMemo(() => {
    const total = complaints.length || 1;
    const counts = { voice: 0, text: 0, photo: 0 };
    complaints.forEach((c) => {
      counts[c.input_mode] += 1;
    });

    return [
      { mode: 'Voice', count: counts.voice, pct: Math.round((counts.voice / total) * 100) },
      { mode: 'Text', count: counts.text, pct: Math.round((counts.text / total) * 100) },
      { mode: 'Photo', count: counts.photo, pct: Math.round((counts.photo / total) * 100) },
    ];
  }, [complaints]);

  const resolutionDist = useMemo(() => {
    const bins = [
      { range: '< 1 day', count: 0 },
      { range: '1-3 days', count: 0 },
      { range: '3-7 days', count: 0 },
      { range: '> 7 days', count: 0 },
    ];

    complaints.forEach((c) => {
      if (!c.created_at || !c.resolved_at) return;
      const created = new Date(c.created_at).getTime();
      const resolved = new Date(c.resolved_at).getTime();
      if (!Number.isFinite(created) || !Number.isFinite(resolved) || resolved <= created) return;
      const days = (resolved - created) / (1000 * 60 * 60 * 24);

      if (days < 1) bins[0].count += 1;
      else if (days < 3) bins[1].count += 1;
      else if (days < 7) bins[2].count += 1;
      else bins[3].count += 1;
    });

    const total = bins.reduce((sum, b) => sum + b.count, 0) || 1;
    return bins.map((b) => ({ ...b, pct: Math.round((b.count / total) * 100) }));
  }, [complaints]);

  return (
    <main className="main-content">
      <section className="section" style={{ paddingTop: 80 }}>
        <div className="container">
          <div className="section-label">ADVANCED ANALYTICS</div>
          <h1 className="section-title">Data-Driven Governance Intelligence</h1>
          <p className="section-subtitle" style={{ marginBottom: 16 }}>
            Live metrics across complaint inflow, resolution performance, ward hotspots, and trust signals
          </p>

          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 16px',
            borderRadius: 20,
            marginBottom: 28,
            background: backendOnline ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
            border: `1px solid ${backendOnline ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
            fontSize: '0.8rem',
            fontWeight: 600,
            color: backendOnline ? '#16a34a' : '#dc2626',
          }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: backendOnline ? '#22c55e' : '#ef4444' }} />
            {backendOnline ? 'Live Backend Analytics' : 'Backend Offline'}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 32 }}>
            {[
              { label: 'Total Complaints', value: stats?.total_complaints ?? 0, color: '#3b82f6', sub: `${stats?.complaints_today ?? 0} today` },
              { label: 'Resolution Rate', value: `${stats?.resolution_rate ?? 0}%`, color: '#10b981', sub: `${stats?.resolved_today ?? 0} resolved today` },
              { label: 'Avg Response Time', value: `${stats?.avg_response_days ?? 0} days`, color: '#f59e0b', sub: 'Resolved tickets only' },
              { label: 'Trust Index', value: `${stats?.trust_index ?? 0}/100`, color: '#8b5cf6', sub: `Satisfaction ${stats?.satisfaction ?? 0}/5` },
            ].map((kpi) => (
              <div key={kpi.label} className="glass-card" style={{ padding: 20, borderTop: `3px solid ${kpi.color}` }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', fontWeight: 600, marginBottom: 8 }}>{kpi.label}</div>
                <div style={{ fontSize: '1.8rem', fontWeight: 800, fontFamily: 'Outfit', color: kpi.color }}>{kpi.value}</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: 4 }}>{kpi.sub}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
            <div className="glass-card" style={{ padding: 24 }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 16 }}>Priority Distribution</h3>
              {priorityDist.map((p) => (
                <div key={p.priority} style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontWeight: 600 }}>{p.priority}</span>
                    <span style={{ color: PRIORITY_COLORS[p.priority], fontWeight: 700 }}>{p.count} ({p.pct}%)</span>
                  </div>
                  <div style={{ height: 10, background: 'var(--bg-tertiary)', borderRadius: 5 }}>
                    <div style={{ height: '100%', width: `${p.pct}%`, background: PRIORITY_COLORS[p.priority], borderRadius: 5 }} />
                  </div>
                </div>
              ))}
            </div>

            <div className="glass-card" style={{ padding: 24 }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 16 }}>Input Mode Split</h3>
              {inputDist.map((row) => (
                <div key={row.mode} style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontWeight: 600 }}>{row.mode}</span>
                    <span style={{ color: 'var(--accent-blue-light)', fontWeight: 700 }}>{row.count} ({row.pct}%)</span>
                  </div>
                  <div style={{ height: 10, background: 'var(--bg-tertiary)', borderRadius: 5 }}>
                    <div style={{ height: '100%', width: `${row.pct}%`, background: 'var(--gradient-blue)', borderRadius: 5 }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
            <div className="glass-card" style={{ padding: 24 }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 16 }}>Resolution Time Bands</h3>
              {resolutionDist.map((row) => (
                <div key={row.range} style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                    <span>{row.range}</span>
                    <span style={{ fontWeight: 700 }}>{row.count} ({row.pct}%)</span>
                  </div>
                  <div style={{ height: 9, background: 'var(--bg-tertiary)', borderRadius: 5 }}>
                    <div style={{ height: '100%', width: `${row.pct}%`, background: 'var(--gradient-emerald)', borderRadius: 5 }} />
                  </div>
                </div>
              ))}
            </div>

            <div className="glass-card" style={{ padding: 24 }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 16 }}>Ward Operational Heat</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
                {(stats?.ward_heat_data || []).slice(0, 12).map((ward) => (
                  <div key={ward.ward} style={{
                    padding: 10,
                    borderRadius: 8,
                    border: '1px solid var(--border-subtle)',
                    background: ward.severity === 'high' ? 'rgba(239,68,68,0.12)' : ward.severity === 'medium' ? 'rgba(249,115,22,0.12)' : 'rgba(34,197,94,0.12)',
                  }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>{ward.ward}</div>
                    <div style={{ fontSize: '1rem', fontWeight: 700 }}>{ward.complaints}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="glass-card" style={{ padding: 24 }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 16 }}>8-Week Trend</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 8, alignItems: 'end', minHeight: 180 }}>
              {(stats?.trend_data || []).map((week) => (
                <div key={week.week} style={{ textAlign: 'center' }}>
                  <div style={{ height: 120, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 3 }}>
                    <div style={{ width: 14, height: `${Math.min(100, week.complaints * 4)}px`, background: 'rgba(239,68,68,0.45)', borderRadius: 4 }} />
                    <div style={{ width: 14, height: `${Math.min(100, week.resolved * 4)}px`, background: 'rgba(34,197,94,0.55)', borderRadius: 4 }} />
                  </div>
                  <div style={{ fontSize: '0.72rem', marginTop: 8 }}>{week.week}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
