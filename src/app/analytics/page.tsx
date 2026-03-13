'use client';

import { mockComplaints, mockTrendData, mockSentimentData, mockCategoryDistribution, PRIORITY_CONFIG } from '@/lib/mockData';

export default function AnalyticsPage() {
  const totalComplaints = 1247;
  const resolvedRate = 89;
  const avgDays = 2.3;

  const priorityDist = [
    { priority: 'P0', count: 45, pct: 4 },
    { priority: 'P1', count: 187, pct: 15 },
    { priority: 'P2', count: 498, pct: 40 },
    { priority: 'P3', count: 517, pct: 41 },
  ];

  const inputDist = [
    { mode: 'Voice 🎤', count: 486, pct: 39 },
    { mode: 'Text 💬', count: 436, pct: 35 },
    { mode: 'Photo 📸', count: 325, pct: 26 },
  ];

  const timeResolution = [
    { range: '< 1 day', count: 312, pct: 28 },
    { range: '1-3 days', count: 498, pct: 45 },
    { range: '3-7 days', count: 212, pct: 19 },
    { range: '> 7 days', count: 89, pct: 8 },
  ];

  return (
    <main className="main-content">
      <section className="section" style={{ paddingTop: 80 }}>
        <div className="container">
          <div className="section-label">ADVANCED ANALYTICS</div>
          <h1 className="section-title">Data-Driven Governance Insights</h1>
          <p className="section-subtitle" style={{ marginBottom: 48 }}>
            Deep analytics across complaints, resolution times, citizen sentiment, and resource allocation
          </p>

          {/* Top KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 32 }}>
            {[
              { label: 'Total Complaints Processed', value: '1,247', color: '#3b82f6', sub: 'Since pilot launch' },
              { label: 'AI Auto-Classified', value: '98.5%', color: '#8b5cf6', sub: 'Accuracy rate' },
              { label: 'Avg Resolution Time', value: '2.3 days', color: '#10b981', sub: '87% faster than baseline' },
              { label: 'Citizen Satisfaction', value: '4.2 / 5.0', color: '#f59e0b', sub: '+1.1 from pre-launch' },
              { label: 'Cost Savings', value: '₹2.4 Cr/yr', color: '#f43f5e', sub: 'Per district estimated' },
            ].map(kpi => (
              <div key={kpi.label} className="glass-card" style={{ padding: 20, borderTop: `3px solid ${kpi.color}` }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', fontWeight: 600, marginBottom: 8 }}>{kpi.label}</div>
                <div style={{ fontSize: '1.8rem', fontWeight: 800, fontFamily: 'Outfit', color: kpi.color }}>{kpi.value}</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: 4 }}>{kpi.sub}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
            {/* Priority Distribution */}
            <div className="glass-card" style={{ padding: 24 }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 16 }}>🎯 Priority Distribution</h3>
              {priorityDist.map(p => {
                const config = PRIORITY_CONFIG[p.priority as keyof typeof PRIORITY_CONFIG];
                return (
                  <div key={p.priority} style={{ marginBottom: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span className={`badge badge-${p.priority.toLowerCase()}`}>{p.priority} — {config.label}</span>
                      <span style={{ fontSize: '0.85rem', fontWeight: 700, color: config.color }}>{p.count} ({p.pct}%)</span>
                    </div>
                    <div style={{ height: 10, background: 'var(--bg-tertiary)', borderRadius: 5 }}>
                      <div style={{ height: '100%', width: `${p.pct}%`, background: config.color, borderRadius: 5, transition: 'width 1s ease' }} />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Input Mode Distribution */}
            <div className="glass-card" style={{ padding: 24 }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 16 }}>📱 Input Mode Distribution</h3>
              {inputDist.map(inp => (
                <div key={inp.mode} style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{inp.mode}</span>
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--accent-blue-light)' }}>{inp.count} ({inp.pct}%)</span>
                  </div>
                  <div style={{ height: 10, background: 'var(--bg-tertiary)', borderRadius: 5 }}>
                    <div style={{ height: '100%', width: `${inp.pct}%`, background: 'var(--gradient-blue)', borderRadius: 5, transition: 'width 1s ease' }} />
                  </div>
                </div>
              ))}

              <h3 style={{ fontSize: '1rem', fontWeight: 700, marginTop: 32, marginBottom: 16 }}>⏱️ Resolution Time</h3>
              {timeResolution.map(tr => (
                <div key={tr.range} style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{tr.range}</span>
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#10b981' }}>{tr.count} ({tr.pct}%)</span>
                  </div>
                  <div style={{ height: 10, background: 'var(--bg-tertiary)', borderRadius: 5 }}>
                    <div style={{ height: '100%', width: `${tr.pct}%`, background: 'var(--gradient-emerald)', borderRadius: 5 }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Category Breakdown */}
          <div className="glass-card" style={{ padding: 24, marginBottom: 24 }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 16 }}>📊 Category Breakdown</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
              {mockCategoryDistribution.map(cat => (
                <div key={cat.name} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                  <div style={{ width: 12, height: 12, borderRadius: 3, background: cat.color }} />
                  <span style={{ flex: 1, fontSize: '0.9rem' }}>{cat.name}</span>
                  <div style={{ width: 120, height: 8, background: 'var(--bg-tertiary)', borderRadius: 4 }}>
                    <div style={{ height: '100%', width: `${(cat.value / 28) * 100}%`, background: cat.color, borderRadius: 4 }} />
                  </div>
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: cat.color, width: 40, textAlign: 'right' }}>{cat.value}%</span>
                </div>
              ))}
            </div>
          </div>

          {/* Weekly Trends */}
          <div className="glass-card" style={{ padding: 24, marginBottom: 24 }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 16 }}>📈 8-Week Performance Trend</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 8, alignItems: 'end', height: 200 }}>
              {mockTrendData.map(week => (
                <div key={week.week} style={{ textAlign: 'center', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center' }}>
                    <div style={{
                      width: '80%', height: `${(week.complaints / 70) * 150}px`,
                      background: 'rgba(239,68,68,0.3)', borderRadius: '4px 4px 0 0',
                      position: 'relative',
                    }}>
                      <div style={{
                        position: 'absolute', bottom: 0, left: 0, right: 0,
                        height: `${(week.resolved / week.complaints) * 100}%`,
                        background: 'rgba(34,197,94,0.5)', borderRadius: '0 0 0 0',
                      }} />
                    </div>
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', marginTop: 8, fontWeight: 600 }}>{week.week}</div>
                  <div style={{ fontSize: '0.6rem', color: '#f59e0b' }}>⭐{week.satisfaction}</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 24, marginTop: 16 }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 10, height: 10, background: 'rgba(239,68,68,0.3)', borderRadius: 2 }} /> Filed
              </span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 10, height: 10, background: 'rgba(34,197,94,0.5)', borderRadius: 2 }} /> Resolved
              </span>
            </div>
          </div>

          {/* Sentiment Heatmap */}
          <div className="glass-card" style={{ padding: 24 }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 16 }}>😊 Ward Sentiment Analysis</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
              {mockSentimentData.map(w => (
                <div key={w.ward} style={{
                  padding: 16, borderRadius: 10,
                  background: w.positive > 60 ? 'rgba(34,197,94,0.08)' : w.negative > 50 ? 'rgba(239,68,68,0.08)' : 'rgba(234,179,8,0.08)',
                  border: `1px solid ${w.positive > 60 ? 'rgba(34,197,94,0.2)' : w.negative > 50 ? 'rgba(239,68,68,0.2)' : 'rgba(234,179,8,0.2)'}`,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{w.ward}</span>
                    <span style={{ fontSize: '1.2rem' }}>{w.positive > 60 ? '😊' : w.negative > 50 ? '😠' : '😐'}</span>
                  </div>
                  <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ width: `${w.positive}%`, background: '#22c55e' }} />
                    <div style={{ width: `${w.neutral}%`, background: '#64748b' }} />
                    <div style={{ width: `${w.negative}%`, background: '#ef4444' }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
