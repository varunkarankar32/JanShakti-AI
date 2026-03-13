'use client';

import { useState } from 'react';

const sampleReport = `━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WEEKLY WARD REPORT — Ward 12
Date: Mar 7-13, 2026
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Resolved This Week:       23 issues
In Progress:                    8 issues
New Complaints:            15 issues
Citizen Satisfaction:      4.2 / 5.0

TOP WIN:
Main road pothole repaired in 2 days
(vs 18 day avg). GPS-verified.
Sunita's water complaint resolved
in 36 hours — rated 5/5.

NEXT WEEK PRIORITY:
Water pipeline upgrade — Mon Mar 16
━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

const smsUpdates = [
  { time: '6:05 AM', msg: 'Your complaint about water pipe (Ticket #4521) has been received and assigned to our team.', status: 'assigned' },
  { time: '10:15 AM', msg: 'Your water pipe repair work has started. Plumbing team is on-site at Ward 7.', status: 'in_progress' },
  { time: '4:30 PM', msg: 'Your water pipe complaint (Ticket #4521) has been resolved. Please rate our service!', status: 'resolved' },
];

export default function CommunicationPage() {
  const [generating, setGenerating] = useState(false);
  const [showReport, setShowReport] = useState(false);

  const generateReport = () => {
    setShowReport(false);
    setGenerating(true);
    setTimeout(() => { setGenerating(false); setShowReport(true); }, 3000);
  };

  return (
    <main className="main-content">
      <section className="section" style={{ paddingTop: 80 }}>
        <div className="container">
          <div className="section-label">CHAPTER 08</div>
          <h1 className="section-title">AI Communication Engine</h1>
          <p className="section-subtitle" style={{ marginBottom: 48 }}>
            Leaders shouldn&apos;t spend hours drafting updates — AI generates them from real data
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 32 }}>
            {/* Left: Features */}
            <div>
              {[
                { icon: '📋', title: 'Weekly Progress Reports', desc: 'AI compiles all issue data, resolution rates, pending items into a professional report — auto-translated to local language. Leader reviews and publishes with one tap.' },
                { icon: '📱', title: 'Real-Time Citizen Updates', desc: 'Citizens get SMS updates when complaint is assigned, work begins, and verified complete. Full transparency from filing to resolution.' },
                { icon: '🛡️', title: 'Misinformation Rapid Response', desc: 'Rumour detected → AI generates fact-checked response with data + official links in 5 minutes. Leader reviews and broadcasts.' },
                { icon: '📢', title: 'Proactive Announcements', desc: 'Monsoon prep, vaccination drives, new scheme launches — AI drafts targeted broadcasts by ward, demography, and past interaction history.' },
              ].map(feat => (
                <div key={feat.title} className="glass-card" style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                    <div style={{ fontSize: '1.5rem', marginTop: 2 }}>{feat.icon}</div>
                    <div>
                      <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 6 }}>{feat.title}</h3>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{feat.desc}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Right: AI Report Demo */}
            <div>
              <div className="glass-card" style={{ padding: 28 }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 16 }}>📝 AI Report Generator</h3>
                <button onClick={generateReport} className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginBottom: 16 }}>
                  {generating ? '⚡ AI Generating Report...' : '▶ Generate Weekly Report'}
                </button>

                {generating && (
                  <div style={{ textAlign: 'center', padding: 20 }}>
                    <div style={{ fontSize: '2rem', animation: 'rotate 2s linear infinite' }}>⚙️</div>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: 8 }}>
                      Analyzing 46 complaints, resolution data, citizen feedback...
                    </p>
                  </div>
                )}

                {showReport && (
                  <div style={{ animation: 'fadeInUp 0.5s ease' }}>
                    <div style={{ fontSize: '0.75rem', color: '#22c55e', fontWeight: 700, marginBottom: 8 }}>✅ REPORT GENERATED</div>
                    <pre style={{
                      background: 'var(--bg-primary)', borderRadius: 8, padding: 16,
                      fontSize: '0.75rem', color: 'var(--accent-cyan)', lineHeight: 1.6,
                      fontFamily: 'monospace', whiteSpace: 'pre-wrap', overflowX: 'auto',
                      border: '1px solid var(--border-subtle)',
                    }}>
                      {sampleReport}
                    </pre>
                    <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                      <button className="btn btn-primary" style={{ padding: '8px 16px', fontSize: '0.8rem' }}>📤 Publish</button>
                      <button className="btn btn-secondary" style={{ padding: '8px 16px', fontSize: '0.8rem' }}>🌐 Translate</button>
                      <button className="btn btn-secondary" style={{ padding: '8px 16px', fontSize: '0.8rem' }}>✏️ Edit</button>
                    </div>
                  </div>
                )}
              </div>

              {/* Citizen SMS Flow */}
              <div className="glass-card" style={{ padding: 28, marginTop: 16 }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 16 }}>📱 Citizen SMS Updates for Ticket #4521</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {smsUpdates.map((sms, i) => (
                    <div key={i} style={{
                      display: 'flex', gap: 12, alignItems: 'flex-start',
                      animation: `fadeInUp 0.3s ease ${i * 0.15}s both`,
                    }}>
                      <div style={{
                        width: 8, height: 8, borderRadius: '50%', marginTop: 8,
                        background: sms.status === 'resolved' ? '#22c55e' : sms.status === 'in_progress' ? '#3b82f6' : '#f59e0b',
                      }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', marginBottom: 4 }}>{sms.time}</div>
                        <div style={{
                          background: 'rgba(37,211,102,0.08)', border: '1px solid rgba(37,211,102,0.2)',
                          borderRadius: '12px 12px 12px 4px', padding: '10px 14px',
                          fontSize: '0.85rem', color: 'var(--text-primary)', lineHeight: 1.5,
                        }}>
                          {sms.msg}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
