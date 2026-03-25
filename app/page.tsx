import Link from 'next/link';
import { listPublishedInsights } from '@/lib/repository';

export const dynamic = 'force-dynamic';

const fallbackPreview = [
  {
    id: 'fallback-1',
    title: 'ETH ETF chatter returns',
    category: 'macro',
    bias: 'bullish',
    summary: 'Fresh headlines are pulling attention back toward ETH ecosystem assets.',
    whyItMatters: 'Narrative rotation can create short bursts of liquidity and momentum.',
    score: 88
  },
  {
    id: 'fallback-2',
    title: 'Exchange exploit rumor spreads',
    category: 'exploit',
    bias: 'bearish',
    summary: 'Reports suggest a possible exploit surface is being investigated by multiple sources.',
    whyItMatters: 'Security headlines typically trigger volatility and fast risk-off positioning.',
    score: 95
  },
  {
    id: 'fallback-3',
    title: 'New chain partnership announced',
    category: 'partnership',
    bias: 'neutral',
    summary: 'A protocol partnership may expand distribution, but the market is still waiting on usage data.',
    whyItMatters: 'High-signal summaries separate marketing noise from actual catalysts.',
    score: 72
  }
];

export default async function HomePage() {
  const preview = (await listPublishedInsights(3)).slice(0, 3);
  const cards = preview.length > 0 ? preview : fallbackPreview;

  return (
    <div className="page-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">SR</div>
          <div>
            <strong>Signal Room</strong>
            <span>Crypto intelligence for Telegram</span>
          </div>
        </div>
        <nav className="nav-links">
          <Link href="#preview">Preview</Link>
          <Link href="#flow">Flow</Link>
          <Link href="#stack">Stack</Link>
          <Link href="/admin/catalog">Admin</Link>
        </nav>
      </header>

      <main>
        <section className="hero">
          <div className="hero-copy">
            <p className="eyebrow">Paid market intelligence, delivered where traders already are</p>
            <h1>Turn noisy crypto headlines into high-signal Telegram alerts.</h1>
            <p className="lede">
              A landing page for acquisition, x402-based payment, single-use invite issuance, and a private Telegram channel that receives AI-filtered news.
            </p>
            <div className="hero-actions">
              <Link className="button primary" href="#preview">
                See live previews
              </Link>
              <Link className="button secondary" href="#stack">
                View product scaffold
              </Link>
            </div>
            <div className="hero-metrics">
              <div>
                <strong>4x</strong>
                <span>less noise than raw feeds</span>
              </div>
              <div>
                <strong>1</strong>
                <span>payment to unlock access</span>
              </div>
              <div>
                <strong>1</strong>
                <span>single-use Telegram invite</span>
              </div>
            </div>
          </div>

          <aside className="hero-panel">
            <div className="panel-card">
              <p className="panel-label">Example signal</p>
              <h2>Exploit alert spikes DeFi risk</h2>
              <p>Severity: High</p>
              <p>Why it matters: liquidity can rotate fast when a protocol breach hits headline velocity.</p>
            </div>
            <div className="panel-card accent">
              <p className="panel-label">Access path</p>
              <ol>
                <li>Connect wallet</li>
                <li>Complete x402 payment</li>
                <li>Receive Telegram invite</li>
              </ol>
            </div>
          </aside>
        </section>

        <section className="preview-section" id="preview">
          <div className="section-heading">
            <p className="eyebrow">Preview feed</p>
            <h2>Sample premium insights</h2>
            <p>These are the kinds of concise updates the backend stores and then publishes to Telegram.</p>
          </div>
          <div className="preview-grid">
            {cards.map((item) => (
              <article className="preview-card" key={item.id}>
                <div className="meta">
                  <span className="tag">{item.category}</span>
                  <span className="tag">{item.bias}</span>
                </div>
                <strong>{item.title}</strong>
                <p>{item.summary}</p>
                <p>
                  <strong>Why it matters:</strong> {item.whyItMatters}
                </p>
                <p className="score">Score {item.score}/100</p>
              </article>
            ))}
          </div>
        </section>

        <section className="split-section" id="flow">
          <div className="info-card">
            <p className="eyebrow">User flow</p>
            <h2>Minimal public surface, premium delivery in Telegram</h2>
            <ul className="bullet-list">
              <li>Visitors land on a clean acquisition page.</li>
              <li>They pay onchain via x402.</li>
              <li>The backend verifies payment and stores entitlement.</li>
              <li>A single-use Telegram invite is issued.</li>
            </ul>
          </div>
          <div className="info-card dark">
            <p className="eyebrow">Backend responsibilities</p>
            <h2>One small service, clear boundaries</h2>
            <ul className="bullet-list">
              <li>News ingestion and dedupe</li>
              <li>AI categorization and scoring</li>
              <li>Payment session tracking</li>
              <li>Access grants and invite lifecycle</li>
            </ul>
          </div>
        </section>

        <section className="stack-section" id="stack">
          <div className="section-heading">
            <p className="eyebrow">Scaffold</p>
            <h2>What the Next.js app now contains</h2>
          </div>
          <div className="stack-grid">
            <div className="stack-card">
              <strong>Landing page</strong>
              <span>Server-rendered home page backed by preview content from Postgres.</span>
            </div>
            <div className="stack-card">
              <strong>API routes</strong>
              <span>Health, preview, access lookup, and x402 webhook routes inside Next.</span>
            </div>
            <div className="stack-card">
              <strong>Database schema</strong>
              <span>Postgres tables for users, articles, insights, payments, invites, and grants.</span>
            </div>
            <div className="stack-card">
              <strong>Admin views</strong>
              <span>Catalog, pricing, and forecast routes that surface live database counts.</span>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
