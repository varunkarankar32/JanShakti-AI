'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { mockComplaints, PRIORITY_CONFIG } from '@/lib/mockData';

function AnimatedCounter({ end, suffix = '', prefix = '', duration = 2000 }: { end: number; suffix?: string; prefix?: string; duration?: number }) {
  const [count, setCount] = useState(0);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setStarted(true), 300);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!started) return;
    let startTime: number;
    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(eased * end));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [started, end, duration]);

  return <span>{prefix}{count}{suffix}</span>;
}

const features = [
  { icon: 'V', title: 'Multi-Modal Input', desc: 'Voice, text, photo — citizens report issues naturally', href: '/features/multi-modal', color: 'var(--accent-blue)' },
  { icon: 'AI', title: 'AI Prioritization', desc: 'Smart scoring: Urgency × Impact × Recurrence × Sentiment', href: '/features/prioritization', color: '#B45309' },
  { icon: 'GPS', title: 'Proof-of-Work Verification', desc: 'GPS + timestamp + AI photo proof. No faking.', href: '/features/verification', color: '#047857' },
  { icon: 'SM', title: 'Social Media Intelligence', desc: 'Real-time sentiment, early warnings, misinfo detection', href: '/features/social-media', color: '#6D28D9' },
  { icon: 'MSG', title: 'AI Communication Engine', desc: 'Auto-generated reports, citizen SMS updates', href: '/features/communication', color: '#0891B2' },
  { icon: 'DB', title: 'Leader\'s Dashboard', desc: 'Everything on one screen, updated every 60 seconds', href: '/dashboard', color: '#BE123C' },
];

const pipelineSteps = [
  { step: '01', title: 'CITIZEN REPORTS', desc: 'Sunita sends a WhatsApp voice note in Hindi about a broken pipe at 6 AM', icon: '1', img: 'images/complain.png' },
  { step: '02', title: 'AI STRUCTURES', desc: 'NLP extracts: \'water pipe\', \'Ward 7\', \'leaking 3 days\'. Auto-tagged as P0 CRITICAL', icon: '2', img: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&q=80' },
  { step: '03', title: 'LEADER SEES', desc: 'Ward officer\'s dashboard shows this as top priority with map location & photo', icon: '3', img: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&q=80' },
  { step: '04', title: 'CREW DISPATCHED', desc: 'Nearest plumbing team gets GPS directions + issue brief. Arrives within 4 hours.', icon: '4', img: 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&q=80' },
  { step: '05', title: 'VERIFIED COMPLETE', desc: 'Before/after geo-tagged photos. AI confirms repair. Sunita gets SMS confirmation.', icon: '5', img: 'images/proof.png' },
];

const stories = [
  { name: 'Sunita Devi', location: 'Varanasi', quote: 'I complained about sewage overflow 4 times in 3 months. Each time they wrote it in a register. Nothing happened. My children fell sick twice.', problem: 'Repeated complaints lost in paper registers. No tracking. No accountability.', color: '#DC2626' },
  { name: 'Raju Kumar', location: 'Patna', quote: 'The road near our school was damaged for 6 months. The MLA said it was fixed — but we have photos proving the contractor never came.', problem: 'Zero verification. Fake completion reports.', color: '#B45309' },
  { name: 'Priya Sharma', location: 'Indore', quote: 'WhatsApp rumors said PM Awas Yojana was cancelled. 200 families panicked and stopped applications.', problem: 'Social media misinformation unchecked. Leaders reactive, not proactive.', color: '#6D28D9' },
];

const impacts = [
  { before: '18', after: '2', unit: 'Days', label: 'Response Time', desc: 'Resolved in 36 hours instead of 3 months' },
  { before: '12%', after: '95%', unit: '', label: 'Verified Work', desc: 'Every fix has GPS photo proof' },
  { before: '3.1', after: '4.5/5', unit: '', label: 'Citizen Trust', desc: 'Evidence-driven transparency' },
  { before: '0', after: '100%', unit: '', label: 'Social Awareness', desc: 'Know what citizens say online' },
  { before: '—', after: '40% ↓', unit: '', label: 'Repeat Complaints', desc: 'Issues fixed the first time' },
  { before: '—', after: '₹2.4 Cr/yr', unit: '', label: 'Cost Savings', desc: 'Per district savings' },
];

const rootCauses = [
  { icon: '1', title: 'Fragmented Data', desc: 'Complaints never in one place', stat: '200+ on paper registers' },
  { icon: '2', title: 'No Smart Priority', desc: 'Gas leak same queue as bench repaint', stat: 'Critical issues buried' },
  { icon: '3', title: 'Unverifiable Work', desc: 'Zero photo/GPS evidence', stat: '₹1.2L Cr no proof' },
  { icon: '4', title: 'Social Media Blind Spot', desc: 'Misinformation spreads unchecked', stat: '40% scheme uptake drop' },
  { icon: '5', title: 'Reactive Communication', desc: 'Citizens never hear back', stat: '68% no response' },
];

const heroImages = [
  'images/c1.jpeg',
  'images/c2.jpeg',
  'images/c3.jpeg',
  'images/c4.jpeg',
];

export default function HomePage() {
  const [activeComplaint, setActiveComplaint] = useState(0);
  const [heroImgIdx, setHeroImgIdx] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveComplaint(p => (p + 1) % mockComplaints.length);
      setHeroImgIdx(p => (p + 1) % heroImages.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <main className="main-content">
      {/* ============ HERO ============ */}
      <section style={{
        minHeight: '92vh', display: 'flex', alignItems: 'center',
        background: 'linear-gradient(180deg, #F8FAFC 0%, #FFFFFF 45%, #F1F5F9 100%)',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(15,23,42,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(15,23,42,0.03) 1px, transparent 1px)', backgroundSize: '48px 48px' }} />
        
        {/* CAROUSEL BACKGROUND */}
        <div style={{ position: 'absolute', top: 0, bottom: 0, right: 0, width: '50%', zIndex: 0, WebkitMaskImage: 'linear-gradient(to right, transparent 0%, rgba(0,0,0,1) 25%)', maskImage: 'linear-gradient(to right, transparent 0%, rgba(0,0,0,1) 25%)' }}>
          {heroImages.map((src, i) => (
            <img key={i} src={src} alt="Hero illustration" style={{ opacity: i === heroImgIdx ? 1 : 0, transition: 'opacity 1s ease-in-out', position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
          ))}
        </div>

        <div className="container" style={{ position: 'relative', zIndex: 1, paddingTop: 40, paddingBottom: 40 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '16px' }}>
            <span style={{ padding: '5px 14px', borderRadius: 6, background: '#EFF6FF', color: 'var(--accent-blue)', fontSize: '0.78rem', fontWeight: 600, border: '1px solid #BFDBFE' }}>
              AI-Powered Governance Platform
            </span>
          </div>
          <h1 style={{ fontSize: 'clamp(2.2rem, 5vw, 3.8rem)', fontWeight: 900, lineHeight: 1.1, marginBottom: 20, maxWidth: 780 }}>
            जनशक्ति<span style={{ color: 'var(--accent-blue)' }}>.AI</span>
            <br />
            <span style={{ fontSize: '0.5em', fontWeight: 500, color: '#475569', display: 'block', maxWidth: '600px' }}>
              AI for Local Leadership, Decision Intelligence & Public Trust
            </span>
          </h1>
          <p style={{ fontSize: '1.05rem', color: '#334155', maxWidth: 560, lineHeight: 1.7, marginBottom: 28 }}>
            When Ramesh from Ward 7 reports a broken water pipe at 6 AM, his leader should know by 6:01 and the repair crew by 6:05.
          </p>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: 48 }}>
            <Link href="/citizen" className="btn btn-primary" style={{ padding: '12px 28px', fontSize: '0.95rem' }}>File a Complaint</Link>
            <Link href="/dashboard" className="btn btn-secondary" style={{ padding: '12px 28px', fontSize: '0.95rem' }}>Leader Dashboard</Link>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 16, maxWidth: 600 }}>
            {[
              { val: 73, suf: '%', label: 'grievances unresolved' },
              { val: 18, suf: ' days', label: 'avg complaint time' },
              { val: 3, suf: '.8L Cr', label: 'lost to poor governance' },
            ].map((s, i) => (
              <div key={i} style={{ background: 'rgba(255,255,255,0.96)', border: '1px solid #E2E8F0', borderRadius: 10, padding: 16, textAlign: 'center', boxShadow: 'var(--shadow-sm)' }}>
                <div style={{ fontSize: 'clamp(1.5rem, 3vw, 2.2rem)', fontWeight: 800, fontFamily: 'Outfit', color: 'var(--accent-blue)' }}>
                  {i === 2 ? '₹' : ''}<AnimatedCounter end={s.val} suffix={s.suf} />
                </div>
                <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: 4 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ STORIES ============ */}
      <section className="section" style={{ background: 'var(--bg-secondary)' }}>
        <div className="container">
          <div className="section-label">THE GROUND REALITY</div>
          <h2 className="section-title">Real Stories from Real Citizens</h2>
          <p className="section-subtitle" style={{ marginBottom: 40 }}>
            Daily reality for 833 million rural Indians across 2.5 lakh+ panchayats
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
            {stories.map((s, i) => (
              <div key={i} className="glass-card" style={{ borderTop: `3px solid ${s.color}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                  <div style={{ width: 40, height: 40, borderRadius: '50%', background: `${s.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', fontWeight: 700, color: s.color }}>{s.name[0]}</div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{s.name}</div>
                    <div style={{ color: 'var(--text-tertiary)', fontSize: '0.8rem' }}>{s.location}</div>
                  </div>
                </div>
                <blockquote style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.7, borderLeft: `3px solid ${s.color}30`, paddingLeft: 14, marginBottom: 14, fontStyle: 'italic' }}>
                  &ldquo;{s.quote}&rdquo;
                </blockquote>
                <div style={{ background: '#FEF2F2', padding: '8px 12px', borderRadius: 6, fontSize: '0.8rem', color: '#DC2626', fontWeight: 500, display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                  <span>{s.problem}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ ROOT CAUSE ============ */}
      <section className="section">
        <div className="container">
          <div className="section-label">ROOT CAUSE ANALYSIS</div>
          <h2 className="section-title">Five Systemic Failures</h2>
          <p className="section-subtitle" style={{ marginBottom: 40 }}>Keeping local governance broken</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 16 }}>
            {rootCauses.map((c, i) => (
              <div key={i} className="glass-card" style={{ textAlign: 'center', padding: 22 }}>
                {/* <div style={{ fontSize: '2rem', marginBottom: 10 }}>{c.icon}</div> */}
                <h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: 6 }}>{c.title}</h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 10 }}>{c.desc}</p>
                <div style={{ background: '#FEF2F2', padding: '6px 10px', borderRadius: 6, fontSize: '0.7rem', color: '#DC2626', fontWeight: 600 }}>{c.stat}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ PIPELINE ============ */}
      <section className="section" style={{ background: 'var(--bg-secondary)' }}>
        <div className="container">
          <div className="section-label">HOW जनशक्ति.AI WORKS</div>
          <h2 className="section-title">Complaint to Resolution in 5 Steps</h2>
          <p className="section-subtitle" style={{ marginBottom: 40 }}>How Sunita&apos;s broken pipe gets resolved in 2 days instead of 90</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0, position: 'relative' }}>
            <div style={{ position: 'absolute', left: 24, top: 0, bottom: 0, width: 3, background: 'linear-gradient(180deg, var(--accent-blue), #047857)', borderRadius: 2, zIndex: 0 }} />
            {pipelineSteps.map((step, i) => (
              <div key={i} style={{ display: 'flex', gap: 20, alignItems: 'flex-start', padding: '18px 0', position: 'relative', zIndex: 1 }}>
                <div style={{ width: 48, height: 48, minWidth: 48, borderRadius: '50%', background: 'var(--accent-blue)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', color: 'white', boxShadow: 'var(--shadow-md)' }}>{step.icon}</div>
                <div className="glass-card" style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'relative', zIndex: 2, maxWidth: '60%' }}>
                    <span style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--accent-blue)', background: '#EFF6FF', padding: '2px 8px', borderRadius: 4, letterSpacing: 1, marginRight: 8 }}>STEP {step.step}</span>
                    <span style={{ fontSize: '1rem', fontWeight: 700 }}>{step.title}</span>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginTop: 6 }}>{step.desc}</p>
                  </div>
                  <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: '45%', zIndex: 1, WebkitMaskImage: 'linear-gradient(to right, transparent 0%, rgba(0,0,0,1) 50%)', maskImage: 'linear-gradient(to right, transparent 0%, rgba(0,0,0,1) 50%)' }}>
                    <img src={step.img} alt={step.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ FEATURES ============ */}
      <section className="section">
        <div className="container">
          <div className="section-label">PLATFORM CAPABILITIES</div>
          <h2 className="section-title">Six Pillars of Intelligent Governance</h2>
          <p className="section-subtitle" style={{ marginBottom: 40 }}>Every feature solves a real governance failure</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
            {features.map((f, i) => (
              <Link key={i} href={f.href} style={{ textDecoration: 'none', color: 'inherit' }}>
                <div className="glass-card" style={{ height: '100%' }}>
                  {/* <div style={{ width: 44, height: 44, borderRadius: 10, background: `${f.color}12`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem', marginBottom: 14 }}>{f.icon}</div> */}
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: 6 }}>{f.title}</h3>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{f.desc}</p>
                  <div style={{ marginTop: 14, fontSize: '0.8rem', color: 'var(--accent-blue)', fontWeight: 600 }}>Learn more →</div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ============ LIVE TICKER ============ */}
      <section className="section" style={{ background: 'var(--bg-secondary)' }}>
        <div className="container">
          <div className="section-label">LIVE COMPLAINT FEED</div>
          <h2 className="section-title">Real-Time Issue Monitoring</h2>
          <div style={{ display: 'flex', gap: 16, overflowX: 'auto', paddingBottom: 12, marginTop: 28 }}>
            {mockComplaints.slice(0, 5).map((c, i) => {
              const pConfig = PRIORITY_CONFIG[c.priority];
              return (
                <div key={c.id} className="glass-card" style={{
                  minWidth: 280, flex: '0 0 auto', borderLeft: `4px solid ${pConfig.color}`,
                  opacity: i === activeComplaint ? 1 : 0.65, transform: i === activeComplaint ? 'scale(1.02)' : 'scale(1)', transition: 'all 0.5s ease',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', fontWeight: 600 }}>{c.id}</span>
                    <span className={`badge badge-${c.priority.toLowerCase()}`}>{c.priority} — {pConfig.label}</span>
                  </div>
                  <h4 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: 6 }}>{c.title}</h4>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <span className="chip">{c.category}</span>
                    <span className="chip">{c.ward}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ============ IMPACT ============ */}
      <section className="section">
        <div className="container">
          <div className="section-label">PROJECTED IMPACT</div>
          <h2 className="section-title">Tangible Changes in Citizens&apos; Lives</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20, marginTop: 32 }}>
            {impacts.map((imp, i) => (
              <div key={i} className="glass-card">
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 6 }}>
                  <span style={{ fontSize: '0.8rem', color: '#DC2626', textDecoration: 'line-through', opacity: 0.5 }}>{imp.before}</span>
                  <span style={{ color: 'var(--text-tertiary)', fontSize: '0.8rem' }}>→</span>
                  <span style={{ fontSize: '1.5rem', fontWeight: 800, fontFamily: 'Outfit', color: '#047857' }}>{imp.after}</span>
                </div>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: 4 }}>{imp.label}</h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{imp.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ CTA ============ */}
      <section className="section" style={{ background: '#F8FAFC', textAlign: 'center', borderTop: '1px solid var(--border-subtle)' }}>
        <div className="container" style={{ maxWidth: 640 }}>
          <h2 style={{ fontSize: 'clamp(1.8rem, 3.5vw, 2.6rem)', fontWeight: 800, marginBottom: 14, color: 'var(--text-primary)' }}>
            Build the Future of Transparent Governance
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', lineHeight: 1.7, marginBottom: 28 }}>Empowering Leaders · Restoring Trust · Transforming Governance</p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/citizen" className="btn btn-primary" style={{ padding: '12px 28px' }}>File a Complaint</Link>
            <Link href="/dashboard" className="btn btn-secondary" style={{ padding: '12px 28px' }}>Explore Dashboard</Link>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 20, marginTop: 32, flexWrap: 'wrap' }}>
            {['India-First', 'Mobile-First', 'Offline-Ready', 'Interoperable', 'Encrypted'].map(c => (
              <span key={c} style={{ padding: '4px 12px', borderRadius: 6, background: '#FFFFFF', border: '1px solid #E2E8F0', fontSize: '0.75rem', color: '#475569' }}>{c}</span>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
