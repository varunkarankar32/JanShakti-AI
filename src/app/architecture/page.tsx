'use client';

const layers = [
  {
    title: 'INPUT LAYER',
    color: '#3b82f6',
    desc: 'Multi-channel citizen interface',
    items: [
      { name: 'WhatsApp Business API', icon: '💬', desc: 'Primary citizen communication channel' },
      { name: 'Telegram Bot', icon: '🤖', desc: 'Alternative messaging platform' },
      { name: 'IVR Voice', icon: '📞', desc: 'Toll-free voice complaint line' },
      { name: 'Camera SDK', icon: '📸', desc: 'Photo-based issue detection' },
      { name: 'Twitter/X API', icon: '𝕏', desc: 'Social media monitoring' },
      { name: 'Facebook Graph', icon: '👤', desc: 'Social sentiment analysis' },
    ],
  },
  {
    title: 'AI / ML LAYER',
    color: '#8b5cf6',
    desc: 'Intelligence and processing engine',
    items: [
      { name: 'Whisper (ASR)', icon: '🎤', desc: 'Speech-to-text for 12+ Indian languages' },
      { name: 'GPT-4o (NLP)', icon: '🧠', desc: 'Natural language understanding & extraction' },
      { name: 'YOLOv8 (CV)', icon: '👁️', desc: 'Object detection in complaint photos' },
      { name: 'BERT (Sentiment)', icon: '📊', desc: 'Social media sentiment classification' },
      { name: 'LangChain', icon: '🔗', desc: 'LLM orchestration framework' },
      { name: 'RAG Pipeline', icon: '📚', desc: 'Retrieval-augmented generation for responses' },
    ],
  },
  {
    title: 'APPLICATION LAYER',
    color: '#10b981',
    desc: 'Core business logic and services',
    items: [
      { name: 'FastAPI', icon: '⚡', desc: 'High-performance async API server' },
      { name: 'Priority Engine', icon: '🎯', desc: 'AI scoring: Urgency × Impact × Recurrence × Sentiment' },
      { name: 'Verification Service', icon: '✅', desc: 'GPS proof-of-work verification' },
      { name: 'Notification Engine', icon: '📱', desc: 'SMS, push, and WhatsApp notifications' },
      { name: 'Report Generator', icon: '📋', desc: 'AI-powered weekly report compilation' },
      { name: 'Next.js Frontend', icon: '🖥️', desc: 'React-based dashboard & citizen portal' },
    ],
  },
  {
    title: 'DATA LAYER',
    color: '#f59e0b',
    desc: 'Storage and data management',
    items: [
      { name: 'PostgreSQL + PostGIS', icon: '🗄️', desc: 'Geospatial complaint data storage' },
      { name: 'Redis', icon: '⚡', desc: 'Real-time caching & session management' },
      { name: 'Elasticsearch', icon: '🔍', desc: 'Full-text search across complaints' },
      { name: 'MinIO', icon: '📦', desc: 'S3-compatible object storage for photos' },
      { name: 'TimescaleDB', icon: '📈', desc: 'Time-series data for trend analytics' },
    ],
  },
  {
    title: 'INFRASTRUCTURE LAYER',
    color: '#f43f5e',
    desc: 'Deployment and monitoring',
    items: [
      { name: 'AWS / Azure India', icon: '☁️', desc: 'Data residency compliant cloud hosting' },
      { name: 'Docker + K8s', icon: '🐳', desc: 'Containerized microservice deployment' },
      { name: 'Nginx', icon: '🌐', desc: 'Reverse proxy and load balancing' },
      { name: 'Prometheus + Grafana', icon: '📊', desc: 'Real-time monitoring and alerting' },
      { name: 'GitHub Actions', icon: '🔄', desc: 'CI/CD pipeline automation' },
    ],
  },
];

const compliance = [
  { icon: '🔒', title: 'End-to-End Encrypted', desc: 'All data encrypted in transit and at rest' },
  { icon: '📜', title: 'GDPR + IT Act Compliant', desc: 'Meets Indian and international privacy standards' },
  { icon: '🇮🇳', title: 'Data Residency: India', desc: 'All citizen data stays within Indian borders' },
  { icon: '🏅', title: 'ISO 27001 Ready', desc: 'Information security management certified' },
];

export default function ArchitecturePage() {
  return (
    <main className="main-content">
      <section className="section" style={{ paddingTop: 80 }}>
        <div className="container">
          <div className="section-label">SYSTEM ARCHITECTURE</div>
          <h1 className="section-title">Production-Grade, Cloud-Native</h1>
          <p className="section-subtitle" style={{ marginBottom: 48 }}>
            Built for India&apos;s scale — serving 833M+ citizens across 2.5 lakh+ panchayats
          </p>

          {/* Layered Architecture */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {layers.map((layer, i) => (
              <div key={layer.title}>
                <div className="glass-card" style={{ borderLeft: `4px solid ${layer.color}`, borderRadius: i === 0 ? '16px 16px 0 0' : i === layers.length - 1 ? '0 0 16px 16px' : '0', borderTop: i > 0 ? 'none' : undefined }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                    <div style={{
                      padding: '4px 12px', borderRadius: 6,
                      background: `${layer.color}22`, border: `1px solid ${layer.color}44`,
                      fontSize: '0.75rem', fontWeight: 800, color: layer.color, letterSpacing: 1,
                    }}>{layer.title}</div>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{layer.desc}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                    {layer.items.map(item => (
                      <div key={item.name} style={{
                        background: 'var(--bg-tertiary)', padding: '12px 14px', borderRadius: 10,
                        border: '1px solid var(--border-subtle)', transition: 'all 0.2s',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <span style={{ fontSize: '1.1rem' }}>{item.icon}</span>
                          <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>{item.name}</span>
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', lineHeight: 1.4 }}>{item.desc}</div>
                      </div>
                    ))}
                  </div>
                </div>
                {i < layers.length - 1 && (
                  <div style={{ textAlign: 'center', padding: '4px 0', fontSize: '1.2rem', color: 'var(--text-tertiary)' }}>▼</div>
                )}
              </div>
            ))}
          </div>

          {/* Compliance */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginTop: 48 }}>
            {compliance.map(c => (
              <div key={c.title} className="glass-card" style={{ textAlign: 'center', padding: 24, borderTop: '3px solid var(--accent-blue)' }}>
                <div style={{ fontSize: '2rem', marginBottom: 8 }}>{c.icon}</div>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: 4 }}>{c.title}</h4>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{c.desc}</p>
              </div>
            ))}
          </div>

          {/* Roadmap */}
          <div style={{ marginTop: 64 }}>
            <div className="section-label">IMPLEMENTATION ROADMAP</div>
            <h2 className="section-title" style={{ fontSize: '1.8rem', marginBottom: 32 }}>From Pilot to Pan-India in 12 Months</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20 }}>
              {[
                { phase: 'Phase 1', title: 'PILOT', quarter: 'Q1', desc: '3 wards in 1 city. Text + voice input. Basic priority scoring. WhatsApp bot.', metric: '80% complaints digitized', color: '#3b82f6' },
                { phase: 'Phase 2', title: 'CITY SCALE', quarter: 'Q2', desc: '50 wards. Photo verification + social media monitoring. Leader dashboard v1.0.', metric: '50% faster resolution', color: '#8b5cf6' },
                { phase: 'Phase 3', title: 'FULL PLATFORM', quarter: 'Q3', desc: 'AI communication engine. Misinfo detection. 10 regional languages. State integration.', metric: '4.0+ citizen satisfaction', color: '#10b981' },
                { phase: 'Phase 4', title: 'SCALE', quarter: 'Q4', desc: 'Pan-district expansion. Advanced ML. Open data API. National e-governance integration.', metric: '10 districts live', color: '#f59e0b' },
              ].map(p => (
                <div key={p.phase} className="glass-card" style={{ borderTop: `3px solid ${p.color}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: '0.7rem', fontWeight: 800, color: p.color, letterSpacing: 1 }}>{p.phase}</span>
                    <span className="chip">{p.quarter}</span>
                  </div>
                  <h4 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 8 }}>{p.title}</h4>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 12 }}>{p.desc}</p>
                  <div style={{ background: `${p.color}15`, padding: '8px 12px', borderRadius: 8, border: `1px solid ${p.color}33` }}>
                    <span style={{ fontSize: '0.75rem', color: p.color, fontWeight: 600 }}>🎯 {p.metric}</span>
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
