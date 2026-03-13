'use client';

import { mockSocialPosts, mockSentimentData } from '@/lib/mockData';

export default function SocialMediaPage() {
  return (
    <main className="main-content">
      <section className="section" style={{ paddingTop: 80 }}>
        <div className="container">
          <div className="section-label">CHAPTER 07</div>
          <h1 className="section-title">Social Media Intelligence</h1>
          <p className="section-subtitle" style={{ marginBottom: 48 }}>
            What citizens say online tells you more than what they write in complaint forms
          </p>

          {/* 4 Capabilities */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24, marginBottom: 48 }}>
            {[
              {
                icon: '📊', title: 'Sentiment Tracking', desc: 'Monitor citizen mood ward-by-ward, topic-by-topic in real-time',
                example: 'After Indore\'s garbage trucks deployed, positive sentiment in Ward 5 jumped from 28% → 71% in one week.',
                color: '#3b82f6',
              },
              {
                icon: '⚡', title: 'Early Warning', desc: 'Detect emerging issues from social media before formal complaints arrive',
                example: '15 tweets about \'brown water\' in Sector 8 at 7 AM. Alert sent to Water Dept before a single formal complaint.',
                color: '#f59e0b',
              },
              {
                icon: '🛡️', title: 'Misinfo Detection', desc: 'Identify viral false claims about government schemes and leaders',
                example: '"PM Awas Yojana cancelled" rumour reached 50K people in 6 hours. Flagged in 20 minutes with AI fact-check.',
                color: '#ef4444',
              },
              {
                icon: '🗺️', title: 'Hotspot Mapping', desc: 'Geographic mapping of social conversations to find areas needing attention',
                example: 'Cluster of \'flooding\' mentions in Zone 3 during monsoon. Pre-positioned drainage crews — prevented ₹2Cr damage.',
                color: '#10b981',
              },
            ].map(cap => (
              <div key={cap.title} className="glass-card" style={{ borderTop: `3px solid ${cap.color}` }}>
                <div style={{ fontSize: '2rem', marginBottom: 12 }}>{cap.icon}</div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 8 }}>{cap.title}</h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 16 }}>{cap.desc}</p>
                <div style={{ background: 'rgba(34,197,94,0.08)', padding: '10px 14px', borderRadius: 8, fontSize: '0.8rem', color: '#10b981', lineHeight: 1.5 }}>
                  📌 Real: {cap.example}
                </div>
              </div>
            ))}
          </div>

          {/* Live Social Feed */}
          <div className="section-label">LIVE SOCIAL FEED</div>
          <h2 className="section-title" style={{ fontSize: '1.8rem', marginBottom: 32 }}>Real-Time Social Monitoring</h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 48 }}>
            {mockSocialPosts.map(post => (
              <div key={post.id} className="glass-card" style={{
                display: 'grid', gridTemplateColumns: '48px 1fr auto', gap: 16, alignItems: 'start',
                borderLeft: `4px solid ${post.sentiment === 'positive' ? '#22c55e' : post.sentiment === 'negative' ? '#ef4444' : '#64748b'}`,
              }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 12,
                  background: post.platform === 'Twitter' ? 'rgba(29,155,240,0.15)' : post.platform === 'Facebook' ? 'rgba(24,119,242,0.15)' : 'rgba(37,211,102,0.15)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem',
                }}>
                  {post.platform === 'Twitter' ? '𝕏' : post.platform === 'Facebook' ? 'f' : '💬'}
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{post.platform}</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>{post.location}</span>
                    {post.isMisinfo && (
                      <span className="badge" style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', fontSize: '0.65rem' }}>
                        ⚠️ MISINFO DETECTED
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: '0.9rem', color: 'var(--text-primary)', lineHeight: 1.5 }}>{post.content}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                    {new Date(post.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 4 }}>
                    {post.engagement.toLocaleString()} engagements
                  </div>
                  <span className="badge" style={{
                    marginTop: 4,
                    background: post.sentiment === 'positive' ? 'rgba(34,197,94,0.15)' : post.sentiment === 'negative' ? 'rgba(239,68,68,0.15)' : 'rgba(100,116,139,0.15)',
                    color: post.sentiment === 'positive' ? '#22c55e' : post.sentiment === 'negative' ? '#ef4444' : '#64748b',
                    border: 'none', fontSize: '0.65rem',
                  }}>
                    {post.sentiment}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Sentiment by Ward */}
          <div className="section-label">WARD SENTIMENT</div>
          <h2 className="section-title" style={{ fontSize: '1.8rem', marginBottom: 32 }}>Sentiment by Ward</h2>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
            {mockSentimentData.map(ward => (
              <div key={ward.ward} className="glass-card" style={{ padding: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <span style={{ fontWeight: 700 }}>{ward.ward}</span>
                  <span style={{
                    color: ward.positive > 50 ? '#22c55e' : ward.negative > 50 ? '#ef4444' : '#eab308',
                    fontWeight: 700, fontSize: '0.9rem',
                  }}>
                    {ward.positive > 50 ? '😊' : ward.negative > 50 ? '😠' : '😐'} {ward.positive}% positive
                  </span>
                </div>
                {/* Stacked bar */}
                <div style={{ display: 'flex', height: 12, borderRadius: 6, overflow: 'hidden' }}>
                  <div style={{ width: `${ward.positive}%`, background: '#22c55e', transition: 'width 0.5s' }} />
                  <div style={{ width: `${ward.neutral}%`, background: '#64748b', transition: 'width 0.5s' }} />
                  <div style={{ width: `${ward.negative}%`, background: '#ef4444', transition: 'width 0.5s' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>
                  <span>Positive {ward.positive}%</span>
                  <span>Neutral {ward.neutral}%</span>
                  <span>Negative {ward.negative}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
