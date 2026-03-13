'use client';

import { useState } from 'react';

const voiceDemo = {
  input: '"Hamar gali mein paani ka pipe toot gail ba, teen din se paani bah raha hai"',
  language: 'Bhojpuri',
  output: { issue: 'Water pipe burst', location: 'Ward 7', duration: '3 days', priority: 'P0 — CRITICAL', category: 'Water Supply' },
};

const photoDemo = {
  input: 'Phone camera captures road damage',
  output: { detected: '3 potholes', size: '2m × 1m estimated', hazard: 'Traffic hazard near school zone', priority: 'P1 — HIGH', category: 'Roads & Potholes' },
};

const textDemo = {
  input: '"Streetlight not working opp. SBI ATM, Sector 5"',
  output: { issue: 'Streetlight outage', location: 'Sector 5, opp. SBI ATM', category: 'Electrical', priority: 'P2 — MEDIUM', ticket: '#4521' },
};

export default function MultiModalPage() {
  const [activeTab, setActiveTab] = useState<'voice' | 'photo' | 'text'>('voice');
  const [processing, setProcessing] = useState(false);
  const [showResult, setShowResult] = useState(false);

  const handleDemo = () => {
    setShowResult(false);
    setProcessing(true);
    setTimeout(() => { setProcessing(false); setShowResult(true); }, 2000);
  };

  const switchTab = (tab: 'voice' | 'photo' | 'text') => {
    setActiveTab(tab);
    setShowResult(false);
    setProcessing(false);
  };

  return (
    <main className="main-content">
      <section className="section" style={{ paddingTop: 80 }}>
        <div className="container">
          <div className="section-label">CHAPTER 04</div>
          <h1 className="section-title">Multi-Modal Issue Collection</h1>
          <p className="section-subtitle" style={{ marginBottom: 48 }}>
            Citizens report problems the way they naturally communicate — voice, text, or photo. No forms, no friction.
          </p>

          {/* Tab Selector */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 32 }}>
            {([
              { key: 'voice' as const, icon: '🎤', label: 'Voice Input', tech: 'Whisper ASR + GPT-4o' },
              { key: 'photo' as const, icon: '📸', label: 'Photo Input', tech: 'YOLOv8 Detection' },
              { key: 'text' as const, icon: '💬', label: 'Text Input', tech: 'LLM Classification' },
            ]).map(tab => (
              <button
                key={tab.key}
                onClick={() => switchTab(tab.key)}
                className="glass-card"
                style={{
                  flex: 1, cursor: 'pointer', textAlign: 'center', padding: '20px 16px',
                  border: activeTab === tab.key ? '1px solid var(--accent-blue)' : '1px solid var(--border-subtle)',
                  background: activeTab === tab.key ? 'rgba(59,130,246,0.1)' : 'var(--bg-glass)',
                }}
              >
                <div style={{ fontSize: '2rem', marginBottom: 8 }}>{tab.icon}</div>
                <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>{tab.label}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: 4 }}>{tab.tech}</div>
              </button>
            ))}
          </div>

          {/* Demo Area */}
          <div className="glass-card" style={{ padding: 40 }}>
            {activeTab === 'voice' && (
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: 8 }}>🎤 Voice in Any Language</h3>
                <p style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>
                  Sunita doesn&apos;t type — she sends a 30-second voice note in Bhojpuri. Whisper ASR transcribes it. GPT-4o extracts issue type, location, urgency — all in under 3 seconds.
                </p>

                <div style={{ background: 'var(--bg-tertiary)', borderRadius: 12, padding: 20, marginBottom: 20, border: '1px solid var(--border-subtle)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                    <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--gradient-blue)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🎤</div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Voice Note — {voiceDemo.language}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>30 seconds · WhatsApp</div>
                    </div>
                  </div>
                  <div style={{ background: 'var(--bg-primary)', borderRadius: 8, padding: 12, fontStyle: 'italic', color: 'var(--accent-amber)', fontSize: '0.9rem' }}>
                    {voiceDemo.input}
                  </div>
                </div>

                <button onClick={handleDemo} className="btn btn-primary" style={{ marginBottom: 20 }}>
                  {processing ? '⚡ Processing with Whisper + GPT-4o...' : '▶ Simulate AI Processing'}
                </button>

                {processing && (
                  <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
                    {['Whisper ASR', 'NLP Extract', 'Priority Score'].map((step, i) => (
                      <div key={step} style={{ display: 'flex', alignItems: 'center', gap: 8, animation: `fadeIn 0.5s ease ${i * 0.5}s both` }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent-blue)', animation: 'pulse 1s infinite' }} />
                        <span style={{ fontSize: '0.8rem', color: 'var(--accent-blue-light)' }}>{step}</span>
                      </div>
                    ))}
                  </div>
                )}

                {showResult && (
                  <div style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 12, padding: 20, animation: 'fadeInUp 0.5s ease' }}>
                    <div style={{ fontWeight: 700, color: '#22c55e', marginBottom: 12, fontSize: '0.9rem' }}>✅ AI Extraction Complete — 2.8 seconds</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
                      {Object.entries(voiceDemo.output).map(([k, v]) => (
                        <div key={k} style={{ background: 'var(--bg-tertiary)', padding: '10px 14px', borderRadius: 8 }}>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: 700 }}>{k}</div>
                          <div style={{ fontSize: '0.9rem', fontWeight: 600, color: k === 'priority' ? '#ef4444' : 'var(--text-primary)', marginTop: 4 }}>{v}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'photo' && (
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: 8 }}>📸 Photo with Smart Detection</h3>
                <p style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>
                  Raju photographs the broken road. YOLOv8 detects: pothole (category), severe (grade), GPS auto-captured. No form filling needed — the photo is the complaint.
                </p>

                <div style={{ background: 'var(--bg-tertiary)', borderRadius: 12, padding: 20, marginBottom: 20, border: '1px solid var(--border-subtle)', position: 'relative', minHeight: 200 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 160, background: 'var(--bg-primary)', borderRadius: 8, border: '2px dashed var(--border-accent)', position: 'relative' }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '3rem', marginBottom: 8 }}>📸</div>
                      <div style={{ color: 'var(--text-tertiary)', fontSize: '0.9rem' }}>Simulated Road Damage Photo</div>
                      <div style={{ color: 'var(--text-tertiary)', fontSize: '0.75rem', marginTop: 4 }}>GPS: 26.4499°N, 80.3319°E</div>
                    </div>
                    {showResult && (
                      <>
                        <div style={{ position: 'absolute', top: 20, left: 40, width: 80, height: 50, border: '2px solid #ef4444', borderRadius: 4, animation: 'fadeIn 0.3s ease' }}>
                          <span style={{ position: 'absolute', top: -10, left: 0, fontSize: '0.6rem', background: '#ef4444', color: 'white', padding: '1px 4px', borderRadius: 2 }}>Pothole 1</span>
                        </div>
                        <div style={{ position: 'absolute', top: 30, right: 60, width: 70, height: 45, border: '2px solid #f97316', borderRadius: 4, animation: 'fadeIn 0.3s ease 0.2s both' }}>
                          <span style={{ position: 'absolute', top: -10, left: 0, fontSize: '0.6rem', background: '#f97316', color: 'white', padding: '1px 4px', borderRadius: 2 }}>Pothole 2</span>
                        </div>
                        <div style={{ position: 'absolute', bottom: 25, left: '40%', width: 60, height: 40, border: '2px solid #eab308', borderRadius: 4, animation: 'fadeIn 0.3s ease 0.4s both' }}>
                          <span style={{ position: 'absolute', top: -10, left: 0, fontSize: '0.6rem', background: '#eab308', color: 'white', padding: '1px 4px', borderRadius: 2 }}>Pothole 3</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <button onClick={handleDemo} className="btn btn-primary" style={{ marginBottom: 20 }}>
                  {processing ? '⚡ Running YOLOv8 Detection...' : '▶ Simulate AI Detection'}
                </button>

                {showResult && (
                  <div style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 12, padding: 20, animation: 'fadeInUp 0.5s ease' }}>
                    <div style={{ fontWeight: 700, color: '#22c55e', marginBottom: 12, fontSize: '0.9rem' }}>✅ YOLOv8 Detection Complete</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
                      {Object.entries(photoDemo.output).map(([k, v]) => (
                        <div key={k} style={{ background: 'var(--bg-tertiary)', padding: '10px 14px', borderRadius: 8 }}>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: 700 }}>{k}</div>
                          <div style={{ fontSize: '0.9rem', fontWeight: 600, color: k === 'priority' ? '#f97316' : 'var(--text-primary)', marginTop: 4 }}>{v}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'text' && (
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: 8 }}>💬 WhatsApp / SMS Text</h3>
                <p style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>
                  Priya types a quick WhatsApp message. LLM classifies the issue, auto-fills location, and creates a tracked ticket instantly.
                </p>

                <div style={{ background: 'var(--bg-tertiary)', borderRadius: 12, padding: 20, marginBottom: 20, border: '1px solid var(--border-subtle)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                    <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'linear-gradient(135deg, #25D366, #128C7E)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>💬</div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>WhatsApp Message</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>To: Ward Helpline</div>
                    </div>
                  </div>
                  <div style={{ background: 'rgba(37,211,102,0.08)', borderRadius: 8, padding: 12, color: 'var(--text-primary)', fontSize: '0.9rem', border: '1px solid rgba(37,211,102,0.2)' }}>
                    {textDemo.input}
                  </div>
                </div>

                <button onClick={handleDemo} className="btn btn-primary" style={{ marginBottom: 20 }}>
                  {processing ? '⚡ LLM Classifying...' : '▶ Simulate AI Classification'}
                </button>

                {showResult && (
                  <div style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 12, padding: 20, animation: 'fadeInUp 0.5s ease' }}>
                    <div style={{ fontWeight: 700, color: '#22c55e', marginBottom: 12, fontSize: '0.9rem' }}>✅ Ticket Created — #{textDemo.output.ticket}</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
                      {Object.entries(textDemo.output).map(([k, v]) => (
                        <div key={k} style={{ background: 'var(--bg-tertiary)', padding: '10px 14px', borderRadius: 8 }}>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: 700 }}>{k}</div>
                          <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: 4 }}>{v}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Supported Inputs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 16, marginTop: 48 }}>
            {['WhatsApp Business API', 'Telegram Bot', 'IVR Voice Call', 'Camera SDK', 'SMS Gateway', 'Web Portal'].map(input => (
              <div key={input} className="glass-card" style={{ textAlign: 'center', padding: 20 }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>{input}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
