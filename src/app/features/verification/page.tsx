'use client';

import { useState } from 'react';

const steps = [
  { num: 1, title: 'COMPLAINT LOCATION', desc: 'GPS from citizen\'s report pinned on ward map', icon: '📍', status: 'complete' },
  { num: 2, title: 'BEFORE PHOTO', desc: 'Field worker captures geo-tagged photo of issue', icon: '📸', status: 'complete' },
  { num: 3, title: 'WORK IN PROGRESS', desc: 'Real-time status updates from field + time tracking', icon: '🔨', status: 'active' },
  { num: 4, title: 'AFTER PHOTO', desc: 'Completion photo — GPS must match (±50m radius)', icon: '✅', status: 'pending' },
  { num: 5, title: 'AI VERIFICATION', desc: 'Computer vision compares before/after for change', icon: '🤖', status: 'pending' },
];

const antiFraud = [
  { icon: '🛑', title: 'GPS Spoofing Blocked', scenario: 'Worker tries to upload photo from home', result: 'GPS mismatch detected. Rejected.', color: '#ef4444' },
  { icon: '🔁', title: 'Recycled Photo Detected', scenario: 'Same "after" photo for 3 complaints', result: 'Image hash matching catches duplicates.', color: '#f97316' },
  { icon: '🖼️', title: 'Stock Photo Detected', scenario: 'Fake stock photo uploaded', result: 'AI reverse-image search flags as non-original.', color: '#8b5cf6' },
  { icon: '⏰', title: 'Time Window Violation', scenario: 'Photo uploaded 3 weeks late', result: 'Flagged suspicious, requires supervisor review.', color: '#eab308' },
];

export default function VerificationPage() {
  const [activeStep, setActiveStep] = useState(2);

  return (
    <main className="main-content">
      <section className="section" style={{ paddingTop: 80 }}>
        <div className="container">
          <div className="section-label">CHAPTER 06</div>
          <h1 className="section-title">Proof-of-Work Verification</h1>
          <p className="section-subtitle" style={{ marginBottom: 48 }}>
            &ldquo;The road was repaired&rdquo; — now prove it. Geo-tagged, time-stamped, AI-verified evidence.
          </p>

          {/* 5-Step Pipeline */}
          <div className="glass-card" style={{ padding: 32, marginBottom: 48 }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 24 }}>Verification Pipeline</h3>
            <div style={{ display: 'flex', gap: 0, alignItems: 'flex-start', position: 'relative' }}>
              {/* Connection line */}
              <div style={{ position: 'absolute', top: 28, left: 28, right: 28, height: 3, background: 'var(--bg-tertiary)', zIndex: 0 }} />
              <div style={{ position: 'absolute', top: 28, left: 28, height: 3, width: `${(activeStep / 4) * 100}%`, background: 'var(--gradient-blue)', zIndex: 1, transition: 'width 0.5s ease', maxWidth: 'calc(100% - 56px)' }} />

              {steps.map((step, i) => (
                <div key={step.num} onClick={() => setActiveStep(i)} style={{ flex: 1, textAlign: 'center', cursor: 'pointer', position: 'relative', zIndex: 2 }}>
                  <div style={{
                    width: 56, height: 56, borderRadius: '50%', margin: '0 auto 12px',
                    background: i <= activeStep ? 'var(--gradient-blue)' : 'var(--bg-tertiary)',
                    border: i === activeStep ? '3px solid var(--accent-blue)' : '3px solid var(--border-subtle)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem',
                    boxShadow: i === activeStep ? '0 0 20px rgba(59,130,246,0.4)' : 'none',
                    transition: 'all 0.3s ease',
                  }}>
                    {i < activeStep ? '✓' : step.icon}
                  </div>
                  <div style={{ fontWeight: 700, fontSize: '0.75rem', color: i <= activeStep ? 'var(--accent-blue-light)' : 'var(--text-tertiary)', letterSpacing: 0.5, marginBottom: 4 }}>
                    {step.title}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', lineHeight: 1.4, maxWidth: 150, margin: '0 auto' }}>
                    {step.desc}
                  </div>
                </div>
              ))}
            </div>

            {/* Step Detail */}
            <div style={{ marginTop: 32, background: 'var(--bg-tertiary)', borderRadius: 12, padding: 24, border: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <span style={{ fontSize: '1.5rem' }}>{steps[activeStep].icon}</span>
                <span style={{ fontWeight: 700 }}>Step {steps[activeStep].num}: {steps[activeStep].title}</span>
                <span className="badge" style={{
                  background: activeStep < 2 ? 'rgba(34,197,94,0.15)' : activeStep === 2 ? 'rgba(59,130,246,0.15)' : 'rgba(100,116,139,0.15)',
                  color: activeStep < 2 ? '#22c55e' : activeStep === 2 ? '#3b82f6' : '#64748b',
                  border: 'none',
                }}>
                  {activeStep < 2 ? 'Complete' : activeStep === 2 ? 'Active' : 'Pending'}
                </span>
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{steps[activeStep].desc}</p>

              {activeStep === 0 && (
                <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div style={{ background: 'var(--bg-primary)', borderRadius: 8, padding: 16 }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginBottom: 4 }}>Latitude</div>
                    <div style={{ fontFamily: 'monospace', color: 'var(--accent-blue-light)' }}>25.3176° N</div>
                  </div>
                  <div style={{ background: 'var(--bg-primary)', borderRadius: 8, padding: 16 }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginBottom: 4 }}>Longitude</div>
                    <div style={{ fontFamily: 'monospace', color: 'var(--accent-blue-light)' }}>82.9739° E</div>
                  </div>
                </div>
              )}

              {activeStep === 1 && (
                <div style={{ marginTop: 16, display: 'flex', gap: 16, alignItems: 'center' }}>
                  <div style={{ width: 120, height: 80, background: 'var(--bg-primary)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #ef4444' }}>
                    <span style={{ fontSize: '2rem' }}>🚧</span>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Before photo captured</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: 4 }}>GPS: 25.3176°N, 82.9739°E · Time: 10:15 AM</div>
                    <span className="badge" style={{ background: 'rgba(34,197,94,0.15)', color: '#22c55e', border: 'none', marginTop: 8 }}>✓ GPS Verified</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Anti-Fraud */}
          <div className="section-label">ANTI-FRAUD MEASURES</div>
          <h2 className="section-title" style={{ fontSize: '1.8rem', marginBottom: 32 }}>Real Scenarios Prevented</h2>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20 }}>
            {antiFraud.map(fraud => (
              <div key={fraud.title} className="glass-card" style={{ borderTop: `3px solid ${fraud.color}` }}>
                <div style={{ fontSize: '2rem', marginBottom: 12 }}>{fraud.icon}</div>
                <h4 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 8, color: fraud.color }}>{fraud.title}</h4>
                <div style={{ background: 'var(--bg-tertiary)', borderRadius: 8, padding: 12, marginBottom: 12 }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginBottom: 4 }}>SCENARIO</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{fraud.scenario}</div>
                </div>
                <div style={{ fontSize: '0.85rem', color: '#22c55e', fontWeight: 600 }}>✗ {fraud.result}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
