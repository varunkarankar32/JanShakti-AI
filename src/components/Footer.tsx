import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-grid">
        <div className="footer-brand">
          <h3>🏛️ जनशक्ति<span style={{ color: 'var(--accent-blue)' }}>.AI</span></h3>
          <p>AI-powered citizen governance platform connecting citizens, data, and leaders — end to end. Built for India&apos;s 833M+ rural citizens.</p>
          <div style={{ display: 'flex', gap: '10px', marginTop: '14px' }}>
            <span style={{ padding: '3px 10px', borderRadius: 4, background: '#F1F5F9', fontSize: '0.75rem', color: '#475569', border: '1px solid #E2E8F0' }}>🇮🇳 India-First</span>
            <span style={{ padding: '3px 10px', borderRadius: 4, background: '#F1F5F9', fontSize: '0.75rem', color: '#475569', border: '1px solid #E2E8F0' }}>📱 Mobile-First</span>
            <span style={{ padding: '3px 10px', borderRadius: 4, background: '#F1F5F9', fontSize: '0.75rem', color: '#475569', border: '1px solid #E2E8F0' }}>🔒 Encrypted</span>
          </div>
        </div>
        <div className="footer-col">
          <h4>Platform</h4>
          <ul>
            <li><Link href="/features">Features</Link></li>
            <li><Link href="/dashboard">Dashboard</Link></li>
            <li><Link href="/citizen">Citizen Portal</Link></li>
            <li><Link href="/architecture">Architecture</Link></li>
            <li><Link href="/analytics">Analytics</Link></li>
          </ul>
        </div>
        <div className="footer-col">
          <h4>Features</h4>
          <ul>
            <li><Link href="/features/multi-modal">Multi-Modal Input</Link></li>
            <li><Link href="/features/prioritization">AI Prioritization</Link></li>
            <li><Link href="/features/verification">Work Verification</Link></li>
            <li><Link href="/features/social-media">Social Intelligence</Link></li>
            <li><Link href="/features/communication">AI Communication</Link></li>
          </ul>
        </div>
        <div className="footer-col">
          <h4>Team</h4>
          <ul>
            <li><span style={{ color: '#64748B', fontSize: '0.85rem' }}>!PerfectIndian — IIITA</span></li>
            <li><Link href="mailto:iec2023043@iiita.ac.in">Krishna Mohan</Link></li>
            <li><Link href="mailto:iec2023037@iiita.ac.in">Varun Karankar</Link></li>
            <li><Link href="mailto:iec2023038@iiita.ac.in">Aditya Kishore</Link></li>
            <li><Link href="mailto:iec2023042@iiita.ac.in">Kanishk Jain</Link></li>
          </ul>
        </div>
      </div>
      <div className="footer-bottom">
        <p>© 2026 जनशक्ति.AI — Empowering Leaders · Restoring Trust · Transforming Governance</p>
      </div>
    </footer>
  );
}
