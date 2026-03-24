import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-grid">
        <div className="footer-brand">
          <h3>जनशक्ति<span style={{ color: 'var(--accent-blue)' }}>.AI</span></h3>
          <p>AI-powered citizen governance platform connecting citizens, data, and leaders — end to end. Built for India&apos;s 833M+ rural citizens.</p>
          <div style={{ display: 'flex', gap: '10px', marginTop: '14px' }}>
            <span style={{ padding: '3px 10px', borderRadius: 6, background: 'linear-gradient(120deg, #DBEAFE, #E0F2FE)', fontSize: '0.75rem', color: '#1E3A8A', border: '1px solid #BFDBFE' }}>India-First</span>
            <span style={{ padding: '3px 10px', borderRadius: 6, background: 'linear-gradient(120deg, #DBEAFE, #E0F2FE)', fontSize: '0.75rem', color: '#1E3A8A', border: '1px solid #BFDBFE' }}>Mobile-First</span>
            <span style={{ padding: '3px 10px', borderRadius: 6, background: 'linear-gradient(120deg, #DBEAFE, #E0F2FE)', fontSize: '0.75rem', color: '#1E3A8A', border: '1px solid #BFDBFE' }}>Encrypted</span>
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
            <li><span style={{ color: '#64748B', fontSize: '0.85rem' }}>!Perfect — IIITA</span></li>
            <li><a href="https://www.linkedin.com/in/krishnamohan07/" target="_blank" rel="noopener noreferrer">Krishna Mohan</a></li>
            <li><a href="https://www.linkedin.com/in/varun-karankar-9b62b2284/" target="_blank" rel="noopener noreferrer">Varun Karankar</a></li>
            <li><a href="https://www.linkedin.com/in/adityak29/" target="_blank" rel="noopener noreferrer">Aditya Kishore</a></li>
            <li><a href="https://www.linkedin.com/in/kanishk-jain-7690292b6/" target="_blank" rel="noopener noreferrer">Kanishk Jain</a></li>
          </ul>
        </div>
      </div>
      <div className="footer-bottom">
        <p>© 2026 जनशक्ति.AI — Empowering Leaders · Restoring Trust · Transforming Governance</p>
      </div>
    </footer>
  );
}
