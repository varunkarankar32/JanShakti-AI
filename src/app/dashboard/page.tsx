'use client';

import { useState } from 'react';
import { mockComplaints, mockDashboardStats, mockTrendData, mockAlerts, mockActionQueue, mockWardHeatData, mockCategoryDistribution, PRIORITY_CONFIG, STATUS_CONFIG } from '@/lib/mockData';

const kpis = [
  { label: 'Issues Tracked', value: '1,247', icon: '📋', color: '#3b82f6', change: '+15 today' },
  { label: 'Resolution Rate', value: '89%', icon: '✅', color: '#22c55e', change: '+3% this week' },
  { label: 'Avg Response', value: '2.3 Days', icon: '⚡', color: '#f59e0b', change: '-0.4 from last week' },
  { label: 'Satisfaction', value: '4.2/5', icon: '⭐', color: '#8b5cf6', change: '+0.2 this month' },
  { label: 'Trust Index', value: '+23%', icon: '📈', color: '#06b6d4', change: 'Month-over-month' },
];

export default function DashboardPage() {
  const [activeView, setActiveView] = useState('overview');

  return (
    <main className="main-content">
      <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', minHeight: 'calc(100vh - var(--nav-height))' }}>
        {/* Sidebar */}
        <div style={{
          background: 'var(--bg-secondary)', borderRight: '1px solid var(--border-subtle)',
          padding: '24px 12px', position: 'sticky', top: 'var(--nav-height)',
          height: 'calc(100vh - var(--nav-height))', overflowY: 'auto',
        }}>
          <div style={{ padding: '8px 12px', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: 2, marginBottom: 8 }}>COMMAND CENTER</div>
          {[
            { key: 'overview', icon: '📊', label: 'Overview' },
            { key: 'complaints', icon: '📋', label: 'All Complaints' },
            { key: 'alerts', icon: '🚨', label: 'Smart Alerts' },
            { key: 'actions', icon: '📝', label: 'Action Queue' },
          ].map(item => (
            <div key={item.key} className="sidebar-item" onClick={() => setActiveView(item.key)}
              style={{
                background: activeView === item.key ? 'rgba(59,130,246,0.12)' : 'transparent',
                color: activeView === item.key ? 'var(--accent-blue-light)' : 'var(--text-secondary)',
                border: activeView === item.key ? '1px solid rgba(59,130,246,0.2)' : '1px solid transparent',
                marginBottom: 4,
              }}>
              <span>{item.icon}</span><span>{item.label}</span>
            </div>
          ))}

          <div style={{ padding: '16px 12px 8px', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: 2, marginTop: 16 }}>QUICK STATS</div>
          <div style={{ padding: '0 12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>Resolved Today</span>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#22c55e' }}>7</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>P0 Active</span>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#ef4444' }}>2</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>Pending Verify</span>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#f59e0b' }}>5</span>
            </div>
          </div>

          <div style={{ padding: '24px 12px 8px' }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', marginBottom: 4 }}>Last Updated</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--accent-blue-light)', fontWeight: 600 }}>60 seconds ago</div>
          </div>
        </div>

        {/* Main Content */}
        <div style={{ padding: 24, overflowY: 'auto' }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
            <div>
              <h1 style={{ fontSize: '1.8rem', fontWeight: 800, fontFamily: 'Outfit, sans-serif', marginBottom: 4 }}>
                🏛️ Leader&apos;s Command Dashboard
              </h1>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Everything you need — one screen, updated every 60 seconds</p>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', animation: 'pulse 2s infinite' }} />
              <span style={{ fontSize: '0.8rem', color: '#22c55e' }}>Live</span>
            </div>
          </div>

          {/* KPI Row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
            {kpis.map(kpi => (
              <div key={kpi.label} className="glass-card" style={{ padding: 20, position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: -10, right: -10, width: 60, height: 60, borderRadius: '50%', background: `${kpi.color}15` }} />
                <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', fontWeight: 600, marginBottom: 8 }}>{kpi.label}</div>
                <div style={{
                  fontSize: '2rem', fontWeight: 800, fontFamily: 'Outfit, sans-serif',
                  color: kpi.color, marginBottom: 4,
                }}>{kpi.value}</div>
                <div style={{ fontSize: '0.7rem', color: kpi.color, opacity: 0.8 }}>{kpi.change}</div>
              </div>
            ))}
          </div>

          {activeView === 'overview' && (
            <>
              {/* Charts Row */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 24 }}>
                {/* Trend Chart */}
                <div className="glass-card" style={{ padding: 24 }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 16 }}>📈 Trend Analytics (8 Weeks)</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {mockTrendData.map((week, i) => (
                      <div key={week.week} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', width: 24 }}>{week.week}</span>
                        <div style={{ flex: 1, display: 'flex', gap: 4, alignItems: 'center' }}>
                          <div style={{
                            height: 20, width: `${(week.complaints / 70) * 100}%`,
                            background: 'linear-gradient(90deg, #ef4444, #f97316)',
                            borderRadius: '4px 0 0 4px', display: 'flex', alignItems: 'center',
                            justifyContent: 'flex-end', paddingRight: 6,
                            fontSize: '0.6rem', color: 'white', fontWeight: 700, minWidth: 30,
                          }}>{week.complaints}</div>
                          <div style={{
                            height: 20, width: `${(week.resolved / 70) * 100}%`,
                            background: 'linear-gradient(90deg, #22c55e, #10b981)',
                            borderRadius: '0 4px 4px 0', display: 'flex', alignItems: 'center',
                            paddingLeft: 6, fontSize: '0.6rem', color: 'white', fontWeight: 700, minWidth: 30,
                          }}>{week.resolved}</div>
                        </div>
                        <span style={{ fontSize: '0.75rem', color: '#f59e0b', width: 32, textAlign: 'right' }}>⭐{week.satisfaction}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 16, marginTop: 12 }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>🔴 Complaints</span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>🟢 Resolved</span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>⭐ Satisfaction</span>
                  </div>
                </div>

                {/* Category Distribution */}
                <div className="glass-card" style={{ padding: 24 }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 16 }}>📊 By Category</h3>
                  {mockCategoryDistribution.map(cat => (
                    <div key={cat.name} style={{ marginBottom: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{cat.name}</span>
                        <span style={{ fontSize: '0.8rem', color: cat.color, fontWeight: 700 }}>{cat.value}%</span>
                      </div>
                      <div style={{ height: 6, background: 'var(--bg-tertiary)', borderRadius: 3 }}>
                        <div style={{ height: '100%', width: `${cat.value}%`, background: cat.color, borderRadius: 3, transition: 'width 0.5s' }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Heat Map & Alerts Row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
                {/* Ward Heat Map */}
                <div className="glass-card" style={{ padding: 24 }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 16 }}>🗺️ Ward Heat Map</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                    {mockWardHeatData.map(ward => (
                      <div key={ward.ward} style={{
                        padding: 12, borderRadius: 8, textAlign: 'center',
                        background: ward.severity === 'high' ? 'rgba(239,68,68,0.15)' : ward.severity === 'medium' ? 'rgba(249,115,22,0.15)' : 'rgba(34,197,94,0.15)',
                        border: `1px solid ${ward.severity === 'high' ? 'rgba(239,68,68,0.3)' : ward.severity === 'medium' ? 'rgba(249,115,22,0.3)' : 'rgba(34,197,94,0.3)'}`,
                      }}>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', marginBottom: 4 }}>{ward.ward}</div>
                        <div style={{
                          fontSize: '1.2rem', fontWeight: 800, fontFamily: 'Outfit',
                          color: ward.severity === 'high' ? '#ef4444' : ward.severity === 'medium' ? '#f97316' : '#22c55e',
                        }}>{ward.complaints}</div>
                        <div style={{ fontSize: '0.6rem', color: 'var(--text-tertiary)' }}>complaints</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Smart Alerts */}
                <div className="glass-card" style={{ padding: 24 }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 16 }}>🚨 Smart Alerts</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {mockAlerts.map(alert => (
                      <div key={alert.id} style={{
                        display: 'flex', alignItems: 'flex-start', gap: 10, padding: 12, borderRadius: 8,
                        background: alert.type === 'critical' ? 'rgba(239,68,68,0.08)' : alert.type === 'warning' ? 'rgba(249,115,22,0.08)' : alert.type === 'success' ? 'rgba(34,197,94,0.08)' : 'rgba(59,130,246,0.08)',
                        border: `1px solid ${alert.type === 'critical' ? 'rgba(239,68,68,0.2)' : alert.type === 'warning' ? 'rgba(249,115,22,0.2)' : alert.type === 'success' ? 'rgba(34,197,94,0.2)' : 'rgba(59,130,246,0.2)'}`,
                      }}>
                        <span style={{ fontSize: '1.1rem' }}>{alert.icon}</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.4 }}>{alert.message}</div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', marginTop: 4 }}>{alert.time}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Action Queue */}
              <div className="glass-card" style={{ padding: 24, marginBottom: 24 }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 16 }}>📝 AI-Ranked Morning Action Queue</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {mockActionQueue.map(action => (
                    <div key={action.rank} style={{
                      display: 'flex', alignItems: 'center', gap: 16, padding: '12px 16px',
                      background: 'var(--bg-tertiary)', borderRadius: 10,
                      border: '1px solid var(--border-subtle)',
                    }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: '50%', display: 'flex',
                        alignItems: 'center', justifyContent: 'center', fontWeight: 800,
                        fontSize: '0.85rem', fontFamily: 'Outfit',
                        background: action.rank <= 2 ? 'rgba(239,68,68,0.15)' : 'rgba(59,130,246,0.1)',
                        color: action.rank <= 2 ? '#ef4444' : 'var(--accent-blue-light)',
                      }}>
                        #{action.rank}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '0.9rem', fontWeight: 500 }}>{action.task}</div>
                        <span className="chip" style={{ marginTop: 4, fontSize: '0.7rem' }}>{action.category}</span>
                      </div>
                      <span className={`badge badge-${action.priority.toLowerCase()}`}>{action.priority}</span>
                      <button className="btn btn-primary" style={{ padding: '6px 14px', fontSize: '0.75rem' }}>Act</button>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {activeView === 'complaints' && (
            <div className="glass-card" style={{ padding: 24 }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 16 }}>📋 All Complaints</h3>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      {['ID', 'Title', 'Category', 'Ward', 'Priority', 'Status', 'AI Score', 'Input'].map(h => (
                        <th key={h} style={{ textAlign: 'left', padding: '10px 12px', fontSize: '0.75rem', color: 'var(--text-tertiary)', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {mockComplaints.map(c => {
                      const pConfig = PRIORITY_CONFIG[c.priority];
                      const sConfig = STATUS_CONFIG[c.status];
                      return (
                        <tr key={c.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                          <td style={{ padding: '12px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--accent-blue-light)' }}>{c.id}</td>
                          <td style={{ padding: '12px', fontSize: '0.85rem', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.title}</td>
                          <td style={{ padding: '12px' }}><span className="chip" style={{ fontSize: '0.7rem' }}>{c.category}</span></td>
                          <td style={{ padding: '12px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{c.ward}</td>
                          <td style={{ padding: '12px' }}><span className={`badge badge-${c.priority.toLowerCase()}`} style={{ fontSize: '0.65rem' }}>{c.priority}</span></td>
                          <td style={{ padding: '12px' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ width: 6, height: 6, borderRadius: '50%', background: sConfig.color }} />
                              <span style={{ fontSize: '0.8rem', color: sConfig.color }}>{sConfig.label}</span>
                            </span>
                          </td>
                          <td style={{ padding: '12px', fontSize: '0.85rem', fontWeight: 700, color: c.aiScore > 80 ? '#ef4444' : c.aiScore > 50 ? '#f59e0b' : '#22c55e' }}>{c.aiScore}</td>
                          <td style={{ padding: '12px', fontSize: '0.8rem' }}>{c.inputMode === 'voice' ? '🎤' : c.inputMode === 'photo' ? '📸' : '💬'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeView === 'alerts' && (
            <div className="glass-card" style={{ padding: 24 }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 16 }}>🚨 All Smart Alerts</h3>
              {mockAlerts.map(alert => (
                <div key={alert.id} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 12, padding: 16, borderRadius: 10,
                  background: alert.type === 'critical' ? 'rgba(239,68,68,0.08)' : alert.type === 'warning' ? 'rgba(249,115,22,0.08)' : 'rgba(59,130,246,0.08)',
                  border: `1px solid ${alert.type === 'critical' ? 'rgba(239,68,68,0.2)' : 'transparent'}`,
                  marginBottom: 12,
                }}>
                  <span style={{ fontSize: '1.3rem' }}>{alert.icon}</span>
                  <div>
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>{alert.message}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>{alert.time}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeView === 'actions' && (
            <div className="glass-card" style={{ padding: 24 }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 16 }}>📝 AI-Ranked Action Queue</h3>
              {mockActionQueue.map(action => (
                <div key={action.rank} style={{
                  display: 'flex', alignItems: 'center', gap: 16, padding: 16, borderRadius: 10,
                  background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)', marginBottom: 12,
                }}>
                  <div style={{
                    width: 48, height: 48, borderRadius: '50%', display: 'flex',
                    alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '1.2rem',
                    background: action.rank <= 2 ? 'rgba(239,68,68,0.15)' : 'rgba(59,130,246,0.1)',
                    color: action.rank <= 2 ? '#ef4444' : 'var(--accent-blue-light)',
                    fontFamily: 'Outfit',
                  }}>#{action.rank}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>{action.task}</div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <span className={`badge badge-${action.priority.toLowerCase()}`}>{action.priority}</span>
                      <span className="chip">{action.category}</span>
                    </div>
                  </div>
                  <button className="btn btn-primary" style={{ padding: '8px 20px' }}>Take Action</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
