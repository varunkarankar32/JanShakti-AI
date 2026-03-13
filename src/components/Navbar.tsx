'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

const navItems = [
  { label: 'Features', href: '/features' },
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'Citizen Portal', href: '/citizen' },
  { label: 'Architecture', href: '/architecture' },
  { label: 'Analytics', href: '/analytics' },
];

export default function Navbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="nav">
      <div className="nav-inner">
        <Link href="/" className="nav-logo">
          <div className="nav-logo-icon">🏛️</div>
          <span>जनशक्ति<span style={{ color: 'var(--accent-blue)' }}>.AI</span></span>
        </Link>

        <ul className="nav-links">
          {navItems.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                style={pathname.startsWith(item.href) ? { color: 'var(--accent-blue)', fontWeight: 600 } : {}}
              >
                {item.label}
              </Link>
            </li>
          ))}
          <li>
            <Link href="/citizen" className="btn btn-primary nav-cta">
              File Complaint
            </Link>
          </li>
        </ul>

        <button className="mobile-menu-btn" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Toggle menu">
          {mobileOpen ? '✕' : '☰'}
        </button>
      </div>

      {mobileOpen && (
        <div style={{
          position: 'absolute', top: 'var(--nav-height)', left: 0, right: 0,
          background: 'rgba(255,255,255,0.98)', backdropFilter: 'blur(12px)',
          borderBottom: '1px solid var(--border-subtle)', padding: '16px 24px',
          animation: 'fadeInUp 0.3s ease', boxShadow: 'var(--shadow-lg)',
        }}>
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)}
              style={{
                display: 'block', padding: '12px 0', fontSize: '1rem',
                color: pathname.startsWith(item.href) ? 'var(--accent-blue)' : 'var(--text-secondary)',
                borderBottom: '1px solid var(--border-subtle)',
              }}>
              {item.label}
            </Link>
          ))}
          <Link href="/citizen" className="btn btn-primary" onClick={() => setMobileOpen(false)}
            style={{ marginTop: '16px', width: '100%', justifyContent: 'center' }}>
            File Complaint
          </Link>
        </div>
      )}
    </nav>
  );
}
