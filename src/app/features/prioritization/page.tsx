'use client';

import { useState } from 'react';
import { PRIORITY_CONFIG } from '@/lib/mockData';

const priorities = [
  { level: 'P0', label: 'CRITICAL', color: '#ef4444', response: '< 1 hour', example: 'Gas leak near Govt. School, Sector 12', detail: '500 children at risk. Auto-escalated to District Collector + Fire Dept in 2 min.', score: 97 },
  { level: 'P1', label: 'HIGH', color: '#f97316', response: '< 6 hours', example: 'Main road cave-in blocking ambulance route', detail: 'Alternate route SMS sent to 5,000 residents. Repair crew dispatched same day.', score: 85 },
  { level: 'P2', label: 'MEDIUM', color: '#eab308', response: '< 48 hours', example: 'Streetlights out on residential lane for 5 days', detail: 'Electrician scheduled for next working day. Citizen notified with expected fix date.', score: 55 },
  { level: 'P3', label: 'ROUTINE', color: '#22c55e', response: '< 2 weeks', example: 'Park bench needs repainting in community garden', detail: 'Added to monthly maintenance queue. Scheduled batch job with other minor tasks.', score: 15 },
];

const factors = [
  { name: 'Urgency', desc: 'Health/safety risk? Time-sensitive?', icon: '⚡', weight: 40 },
  { name: 'Impact', desc: 'How many people affected? Infrastructure?', icon: '👥', weight: 30 },
  { name: 'Recurrence', desc: 'Same issue reported multiple times?', icon: '🔄', weight: 20 },
  { name: 'Sentiment', desc: 'Citizens angry on social media?', icon: '😤', weight: 10 },
];

export default function PrioritizationPage() {
  const [urgency, setUrgency] = useState(70);
  const [impact, setImpact] = useState(60);
  const [recurrence, setRecurrence] = useState(40);
  const [sentiment, setSentiment] = useState(50);

  const score = Math.round((urgency * 0.4 + impact * 0.3 + recurrence * 0.2 + sentiment * 0.1));
  const getPriority = (s: number) => s >= 85 ? 'P0' : s >= 65 ? 'P1' : s >= 40 ? 'P2' : 'P3';
  const currentPriority = getPriority(score);
  const pConfig = PRIORITY_CONFIG[currentPriority];

  return (
    <main className="main-content">
      <section className="section" style={{ paddingTop: 80 }}>
        <div className="container">
          <div className="section-label">CHAPTER 05</div>
          <h1 className="section-title">Intelligent Prioritization</h1>
          <p className="section-subtitle" style={{ marginBottom: 48 }}>
            A leaking gas pipe should never wait behind a park bench repaint — AI ensures it doesn&apos;t
          </p>

          {/* Formula */}
          <div className="glass-card" style={{ textAlign: 'center', padding: 32, marginBottom: 48, borderColor: 'var(--accent-amber)' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-amber)', letterSpacing: 2, marginBottom: 12 }}>THE AI PRIORITY FORMULA</div>
            <div style={{ fontSize: 'clamp(1.2rem, 3vw, 2rem)', fontFamily: 'Outfit, sans-serif', fontWeight: 800 }}>
              <span style={{ color: '#ef4444' }}>Urgency</span>{' × '}
              <span style={{ color: '#f97316' }}>Impact</span>{' × '}
              <span style={{ color: '#eab308' }}>Recurrence</span>{' × '}
              <span style={{ color: '#8b5cf6' }}>Sentiment</span>
            </div>
            <div style={{ color: 'var(--text-secondary)', marginTop: 8, fontSize: '0.9rem' }}>Score 0-100 → Assigned P0 (Critical) to P3 (Routine)</div>
          </div>

          {/* Interactive Scorer */}
          <div className="glass-card" style={{ padding: 32, marginBottom: 48 }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 24 }}>🎛️ Interactive Priority Scorer</h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
              <div>
                {[
                  { label: 'Urgency', value: urgency, setter: setUrgency, color: '#ef4444' },
                  { label: 'Impact', value: impact, setter: setImpact, color: '#f97316' },
                  { label: 'Recurrence', value: recurrence, setter: setRecurrence, color: '#eab308' },
                  { label: 'Sentiment', value: sentiment, setter: setSentiment, color: '#8b5cf6' },
                ].map(slider => (
                  <div key={slider.label} style={{ marginBottom: 20 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{slider.label}</span>
                      <span style={{ color: slider.color, fontWeight: 700 }}>{slider.value}%</span>
                    </div>
                    <input
                      type="range" min="0" max="100" value={slider.value}
                      onChange={e => slider.setter(Number(e.target.value))}
                      style={{ width: '100%', accentColor: slider.color }}
                    />
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{
                  width: 160, height: 160, borderRadius: '50%',
                  background: `conic-gradient(${pConfig.color} ${score}%, var(--bg-tertiary) ${score}%)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: `0 0 40px ${pConfig.color}44`,
                }}>
                  <div style={{
                    width: 130, height: 130, borderRadius: '50%', background: 'var(--bg-primary)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <div style={{ fontSize: '2.5rem', fontWeight: 800, fontFamily: 'Outfit', color: pConfig.color }}>{score}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>AI SCORE</div>
                  </div>
                </div>
                <div className={`badge badge-${currentPriority.toLowerCase()}`} style={{ marginTop: 16, fontSize: '0.9rem', padding: '8px 20px' }}>
                  {currentPriority} — {pConfig.label}
                </div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: 8 }}>
                  Response: {pConfig.response}
                </div>
              </div>
            </div>
          </div>

          {/* Priority Tiers */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
            {priorities.map(p => (
              <div key={p.level} className="glass-card" style={{ borderLeft: `4px solid ${p.color}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <span className={`badge badge-${p.level.toLowerCase()}`}>{p.level} — {p.label}</span>
                  <span style={{ fontSize: '0.8rem', color: p.color, fontWeight: 600 }}>{p.response}</span>
                </div>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: 8 }}>{p.example}</h4>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{p.detail}</p>
              </div>
            ))}
          </div>

          {/* Factor Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 20, marginTop: 48 }}>
            {factors.map(f => (
              <div key={f.name} className="glass-card" style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '2rem', marginBottom: 8 }}>{f.icon}</div>
                <h4 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 4 }}>{f.name}</h4>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 8 }}>{f.desc}</p>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, fontFamily: 'Outfit', color: 'var(--accent-blue)' }}>{f.weight}%</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>Weight</div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
