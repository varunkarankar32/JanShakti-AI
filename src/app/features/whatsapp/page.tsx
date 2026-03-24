'use client';

import { useState } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8010';

const FLOW_STEPS = [
  {
    user: 'hi',
    bot: '️ *जनशक्ति.AI — Citizen Governance Bot*\n\nनमस्ते! I can help you:\n\n1️⃣ *File a Complaint* — Type complaint\n2️⃣ *Check Status* — Type status\n3️⃣ *Send Photo* — Attach a photo\n4️⃣ *Voice Complaint* — Send a voice note\n\nType help anytime to see this menu.',
  },
  {
    user: 'complaint',
    bot: ' *Select Category:*\n\n1. Water Supply\n2. Roads & Potholes\n3. Drainage\n4. Electricity\n5. Garbage & Sanitation\n6. Safety & Security\n7. Public Health\n\nReply with the number (1-7)',
  },
  {
    user: '2',
    bot: ' Category: *Roads & Potholes*\n\n *Select your Ward:*\nReply with your ward number (1-25)\nExample: 5 for Ward 5',
  },
  {
    user: '7',
    bot: ' Ward: *Ward 7*\n\n *Describe your complaint:*\nType your issue in detail. You can write in English or Hindi.',
  },
  {
    user: 'Big pothole on main road near school causing accidents daily. Been there for 2 weeks.',
    bot: ' *Complaint Filed Successfully!*\n\n Ticket ID: *TKT-X7B2K9*\n Category: Roads & Potholes\n Ward: Ward 7\n Issue: Big pothole on main road near school...\n\n Our AI will prioritize your complaint and assign it to the nearest field team.\n\n Track status anytime — just type status.',
  },
  {
    user: 'status',
    bot: ' *Check Complaint Status*\n\nPlease enter your Ticket ID:\nExample: TKT-A1B2C3',
  },
  {
    user: 'TKT-X7B2K9',
    bot: ' *Complaint Status*\n\n Ticket: *TKT-X7B2K9*\n Category: Roads & Potholes\n Ward: Ward 7\n Status: *Assigned*\n Priority: P1\n AI Score: 78/100\n Assigned: Road Repair Team B\n Filed: 14 Mar 2026',
  },
];

export default function WhatsAppPage() {
  const [visibleSteps, setVisibleSteps] = useState(1);
  const [simulatedInput, setSimulatedInput] = useState('');
  const [botReply, setBotReply] = useState('');
  const [botLoading, setBotLoading] = useState(false);

  const getSimulatedPhone = () => {
    if (typeof window === 'undefined') return 'whatsapp:+919999999999';
    const key = 'whatsapp_test_phone';
    const existing = window.localStorage.getItem(key);
    if (existing) return existing;

    const suffix = Math.floor(100000000 + Math.random() * 900000000).toString();
    const generated = `whatsapp:+91${suffix}`;
    window.localStorage.setItem(key, generated);
    return generated;
  };

  const handleNext = () => {
    if (visibleSteps < FLOW_STEPS.length) {
      setVisibleSteps(visibleSteps + 1);
    }
  };

  const testBotLive = async () => {
    if (!simulatedInput.trim()) return;
    setBotLoading(true);
    setBotReply('');

    try {
      const phone = getSimulatedPhone();
      const res = await fetch(
        `${API_BASE}/api/whatsapp/test?message=${encodeURIComponent(simulatedInput.trim())}&phone=${encodeURIComponent(phone)}`,
      );
      const data = await res.json().catch(() => ({}));
      setBotReply(data?.response || 'No response received');
    } catch {
      setBotReply('Unable to connect to WhatsApp test endpoint.');
    } finally {
      setBotLoading(false);
    }
  };

  return (
    <main style={{ padding: '60px 20px', maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 48 }}>
        <p style={{ color: '#2563EB', fontWeight: 600, letterSpacing: 2, fontSize: 13, textTransform: 'uppercase', marginBottom: 12 }}>
          — WhatsApp Integration
        </p>
        <h1 style={{ fontSize: 40, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.2, marginBottom: 16 }}>
           WhatsApp Complaint Bot
        </h1>
        <p style={{ fontSize: 18, color: '#64748B', maxWidth: 700 }}>
          Citizens can file complaints, send photos, record voice notes, and track status — all through WhatsApp. No app download needed.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40, alignItems: 'start' }}>
        {/* Live Demo */}
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 20 }}>
             Live Bot Demo
          </h2>

          <div style={{
            background: '#ECE5DD',
            borderRadius: 16,
            padding: 20,
            maxHeight: 600,
            overflowY: 'auto',
            border: '1px solid #D1D5DB',
          }}>
            {/* WhatsApp Header */}
            <div style={{
              background: '#075E54',
              color: 'white',
              padding: '12px 16px',
              borderRadius: '12px 12px 0 0',
              marginBottom: 16,
              marginTop: -20,
              marginLeft: -20,
              marginRight: -20,
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#25D366', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>️</div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 15 }}>जनशक्ति.AI Bot</div>
                <div style={{ fontSize: 12, opacity: 0.8 }}>Online</div>
              </div>
            </div>

            {/* Messages */}
            {FLOW_STEPS.slice(0, visibleSteps).map((step, i) => (
              <div key={i}>
                {/* User message */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
                  <div style={{
                    background: '#DCF8C6',
                    padding: '8px 14px',
                    borderRadius: '12px 12px 0 12px',
                    maxWidth: '75%',
                    fontSize: 14,
                    color: '#1a1a1a',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                  }}>
                    {step.user}
                    <div style={{ fontSize: 10, color: '#999', textAlign: 'right', marginTop: 4 }}>
                      {`${10 + i}:${String(i * 2 + 30).padStart(2, '0')}`} 
                    </div>
                  </div>
                </div>

                {/* Bot message */}
                <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 16 }}>
                  <div style={{
                    background: 'white',
                    padding: '8px 14px',
                    borderRadius: '12px 12px 12px 0',
                    maxWidth: '80%',
                    fontSize: 14,
                    color: '#1a1a1a',
                    whiteSpace: 'pre-line',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                    lineHeight: 1.5,
                  }}>
                    {step.bot.replace(/\*/g, '')}
                    <div style={{ fontSize: 10, color: '#999', textAlign: 'right', marginTop: 4 }}>
                      {`${10 + i}:${String(i * 2 + 31).padStart(2, '0')}`}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Next Step Button */}
          {visibleSteps < FLOW_STEPS.length && (
            <button
              onClick={handleNext}
              style={{
                marginTop: 16,
                padding: '12px 28px',
                background: '#25D366',
                color: 'white',
                border: 'none',
                borderRadius: 10,
                fontSize: 15,
                fontWeight: 600,
                cursor: 'pointer',
                width: '100%',
              }}
            >
              ▶ Next Message ({visibleSteps}/{FLOW_STEPS.length})
            </button>
          )}
          {visibleSteps >= FLOW_STEPS.length && (
            <button
              onClick={() => setVisibleSteps(1)}
              style={{
                marginTop: 16,
                padding: '12px 28px',
                background: 'var(--text-primary)',
                color: 'white',
                border: 'none',
                borderRadius: 10,
                fontSize: 15,
                fontWeight: 600,
                cursor: 'pointer',
                width: '100%',
              }}
            >
               Restart Demo
            </button>
          )}

          <div style={{ marginTop: 16, background: '#F8FAFC', borderRadius: 10, border: '1px solid #E2E8F0', padding: 12 }}>
            <div style={{ fontWeight: 600, marginBottom: 8, color: 'var(--text-primary)' }}>Try Live Bot Logic</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                value={simulatedInput}
                onChange={(e) => setSimulatedInput(e.target.value)}
                placeholder="Type message (hi, complaint, status...)"
                style={{ flex: 1, padding: '10px 12px', border: '1px solid #CBD5E1', borderRadius: 8 }}
              />
              <button onClick={testBotLive} style={{ padding: '10px 14px', borderRadius: 8, border: 'none', background: '#2563EB', color: 'white', fontWeight: 600 }}>
                {botLoading ? '...' : 'Send'}
              </button>
            </div>
            {botReply && (
              <div style={{ marginTop: 8, fontSize: 13, color: '#334155', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                {botReply}
              </div>
            )}
          </div>
        </div>

        {/* Features List */}
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 20 }}>
             Capabilities
          </h2>

          {[
            {
              icon: '',
              title: 'Text Complaints',
              desc: 'Guided step-by-step flow: Category → Ward → Description. AI auto-classifies and scores priority.',
              color: '#25D366',
            },
            {
              icon: '',
              title: 'Photo Detection',
              desc: 'Send a photo of a pothole, garbage dump, or broken pipe. YOLOv8 AI auto-detects and files complaint.',
              color: '#2563EB',
            },
            {
              icon: '',
              title: 'Voice Complaints',
              desc: 'Record a voice note in Hindi, Bhojpuri, Tamil, or 12+ languages. Whisper AI transcribes and classifies.',
              color: '#EA580C',
            },
            {
              icon: '',
              title: 'Status Tracking',
              desc: 'Type "status" + ticket ID anytime to get live updates. See priority, assignment, and resolution.',
              color: '#7C3AED',
            },
            {
              icon: '',
              title: 'Proactive Notifications',
              desc: 'Automatic WhatsApp alerts when your complaint status changes — assigned, in progress, resolved.',
              color: '#DC2626',
            },
            {
              icon: '',
              title: 'Multi-Language Support',
              desc: 'Works in Hindi, English, Bhojpuri, Marathi, Bengali, Tamil, Telugu, and 5+ more Indian languages.',
              color: '#0891B2',
            },
          ].map((feature, i) => (
            <div
              key={i}
              style={{
                background: 'white',
                border: '1px solid #E2E8F0',
                borderRadius: 12,
                padding: 20,
                marginBottom: 12,
                borderLeft: `4px solid ${feature.color}`,
              }}
            >
              <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
                {feature.icon} {feature.title}
              </h3>
              <p style={{ fontSize: 14, color: '#64748B', lineHeight: 1.5, margin: 0 }}>
                {feature.desc}
              </p>
            </div>
          ))}

          {/* Setup Info */}
          <div style={{
            background: '#F0F9FF',
            border: '1px solid #BAE6FD',
            borderRadius: 12,
            padding: 20,
            marginTop: 20,
          }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: '#0369A1', marginBottom: 8 }}>
              ️ Setup Options
            </h3>
            <ul style={{ fontSize: 14, color: '#0C4A6E', lineHeight: 2, margin: 0, paddingLeft: 20 }}>
              <li><strong>Twilio</strong> — Quick setup with sandbox (free trial)</li>
              <li><strong>Meta Business API</strong> — Official WhatsApp integration</li>
              <li><strong>Test Endpoint</strong> — Try bot logic at <code>/api/whatsapp/test?message=hello</code></li>
            </ul>
          </div>

          {/* Architecture */}
          <div style={{
            background: '#FFFBEB',
            border: '1px solid #FDE68A',
            borderRadius: 12,
            padding: 20,
            marginTop: 12,
          }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: '#92400E', marginBottom: 8 }}>
              ️ Architecture
            </h3>
            <p style={{ fontSize: 13, color: '#78350F', lineHeight: 1.6, margin: 0, fontFamily: 'monospace' }}>
              Citizen → WhatsApp → Twilio/Meta Webhook<br />
              → FastAPI /api/whatsapp/webhook<br />
              → WhatsApp Bot Service (state machine)<br />
              → NLP + Priority + Sentiment AI<br />
              → SQLite Database<br />
              → Response → Twilio/Meta → WhatsApp → Citizen
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
