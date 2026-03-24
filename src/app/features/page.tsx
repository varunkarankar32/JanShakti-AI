'use client';

import Link from 'next/link';

const features = [
  {
    num: '04', icon: '', title: 'Multi-Modal Issue Collection',
    desc: 'Citizens report problems the way they naturally communicate — voice, text, or photo. Powered by Whisper ASR, GPT-4o NLP, and YOLOv8 computer vision.',
    href: '/features/multi-modal',
    gradient: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
    stats: ['30-sec voice → structured ticket', '3-sec AI processing', '12+ languages supported'],
    img: '/images/multi-modal.png',
  },
  {
    num: '05', icon: '', title: 'Intelligent Prioritization',
    desc: 'A leaking gas pipe should never wait behind a park bench repaint — AI ensures it doesn\'t. Formula: Urgency × Impact × Recurrence × Sentiment.',
    href: '/features/prioritization',
    gradient: 'linear-gradient(135deg, #f59e0b, #f97316)',
    stats: ['0-100 AI score', '4 priority tiers', 'Auto-escalation to authorities'],
    img: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&q=80',
  },
  {
    num: '06', icon: '', title: 'Proof-of-Work Verification',
    desc: '"The road was repaired" — now prove it. Geo-tagged, time-stamped, AI-verified evidence with anti-fraud measures.',
    href: '/features/verification',
    gradient: 'linear-gradient(135deg, #10b981, #06b6d4)',
    stats: ['GPS ±50m match', 'AI before/after comparison', '4 anti-fraud checks'],
    img: 'images/proof.png',
  },
  {
    num: '07', icon: '', title: 'Social Media Intelligence',
    desc: 'What citizens say online tells you more than complaint forms. Real-time sentiment tracking, early warning, and misinformation detection.',
    href: '/features/social-media',
    gradient: 'linear-gradient(135deg, #8b5cf6, #ec4899)',
    stats: ['Ward-level sentiment', '20-min misinfo detection', 'Hotspot mapping'],
    img: 'images/social_media_intelligence.jpeg',
  },
  {
    num: '08', icon: '', title: 'AI Communication Engine',
    desc: 'Leaders shouldn\'t spend hours drafting updates — AI generates them from real data. Weekly reports, citizen SMS, rapid response.',
    href: '/features/communication',
    gradient: 'linear-gradient(135deg, #06b6d4, #3b82f6)',
    stats: ['Auto weekly reports', 'SMS citizen updates', 'Multi-language support'],
    img: 'images/aicomm.jpeg',
  },
  {
    num: '09', icon: '', title: 'WhatsApp Complaint Bot',
    desc: 'Citizens file complaints, send photos, record voice notes, and track status — all through WhatsApp. No app download needed.',
    href: '/features/whatsapp',
    gradient: 'linear-gradient(135deg, #25D366, #128C7E)',
    stats: ['Photo AI detection', 'Voice transcription', '12+ languages', 'Live status tracking'],
    img: '/images/whatsapp-bot.jpeg',
  },
];

export default function FeaturesPage() {
  return (
    <main className="main-content">
      <section className="section" style={{ paddingTop: 80 }}>
        <div className="container">
          <div className="section-label">PLATFORM CAPABILITIES</div>
          <h1 className="section-title">Powerful Features for Smarter Governance</h1>
          <p className="section-subtitle" style={{ marginBottom: 64 }}>
            Every feature solves a real governance failure affecting 833M+ Indians
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
            {features.map((feat, i) => (
              <Link key={feat.num} href={feat.href} style={{ textDecoration: 'none' }}>
                <div className="glass-card" style={{
                  display: 'flex', gap: 32,
                  alignItems: 'center', position: 'relative', overflow: 'hidden', minHeight: 180,
                }}>
                  <div style={{
                    position: 'absolute', top: -40, right: -40, width: 200, height: 200,
                    background: feat.gradient, borderRadius: '50%', opacity: 0.05,
                  }} />
                  <div style={{ position: 'relative', zIndex: 2, maxWidth: '60%', paddingRight: 40, flex: 1 }}>
                    <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--accent-blue)', letterSpacing: 2 }}>CHAPTER {feat.num}</span>
                    <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: 8, color: 'var(--text-primary)' }}>{feat.title}</h2>
                    <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.6, maxWidth: 600 }}>{feat.desc}</p>
                    <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                      {feat.stats.map((s, j) => (
                        <span key={j} className="chip">{s}</span>
                      ))}
                    </div>
                  </div>
                  <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: '45%', zIndex: 1, WebkitMaskImage: 'linear-gradient(to right, transparent 0%, rgba(0,0,0,1) 50%)', maskImage: 'linear-gradient(to right, transparent 0%, rgba(0,0,0,1) 50%)' }}>
                    <img src={feat.img} alt={feat.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                  <div style={{ position: 'absolute', right: 24, top: '50%', transform: 'translateY(-50%)', zIndex: 3, fontSize: '1.2rem', color: 'white', fontWeight: 600, background: 'rgba(0,0,0,0.5)', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', backdropFilter: 'blur(4px)' }}>→</div>
                </div>
              </Link>
            ))} 
          </div>
        </div>
      </section>
    </main>
  );
}
