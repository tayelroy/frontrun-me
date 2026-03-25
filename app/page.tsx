import Link from 'next/link';
import { CheckoutPanel } from '@/components/payments/CheckoutPanel';
import { ConnectWalletButton } from '@/components/wallet/ConnectWalletButton';
import { getTelegramAggregationOverview, listPublishedInsights } from '@/lib/repository';
import type { PreviewInsight, SignalBias } from '@/lib/types';

export const dynamic = 'force-dynamic';

const fallbackPreview: PreviewInsight[] = [
  {
    id: 'fallback-1',
    title: 'ETH ETF momentum accelerates',
    category: 'macro',
    bias: 'bullish',
    summary: 'Fresh ETF amendment chatter is pulling attention back toward ETH ecosystem positioning.',
    whyItMatters: 'Narrative rotation can trigger fast liquidity migration before broader CT catches up.',
    score: 88
  },
  {
    id: 'fallback-2',
    title: 'Lending protocol exploit rumor spreads',
    category: 'exploit',
    bias: 'urgent',
    summary: 'Multiple source clusters are flagging an active exploit investigation around a lending market.',
    whyItMatters: 'Security headlines create immediate de-risking and can drain liquidity from exposed pairs.',
    score: 95
  },
  {
    id: 'fallback-3',
    title: 'AI infrastructure raise revives sector watchlists',
    category: 'fundraising',
    bias: 'neutral',
    summary: 'A new infrastructure raise is putting DePIN and AI-linked tokens back on trader radars.',
    whyItMatters: 'Sector validation matters most when it arrives before follow-on listings and narrative copycats.',
    score: 74
  }
];

function formatLabel(value: string) {
  return value.replace(/[-_]/g, ' ');
}

function formatBias(value: SignalBias) {
  return value === 'urgent' ? 'risk alert' : formatLabel(value);
}

function chipTone(value: SignalBias | 'category') {
  if (value === 'bullish') return 'bullish';
  if (value === 'bearish') return 'bearish';
  if (value === 'urgent') return 'urgent';
  if (value === 'neutral') return 'neutral';
  return 'category';
}

export default async function HomePage() {
  const [preview, overview] = await Promise.all([listPublishedInsights(3), getTelegramAggregationOverview()]);
  const cards = preview.length > 0 ? preview : fallbackPreview;
  const heroCard = cards[0];
  const activeSources = overview.activeSources || 12;
  const candidateMessages = overview.candidateMessages || 37;
  const promotedClusters = overview.promotedClusters || cards.length;

  return (
    <div className="frm-page">
      <div className="frm-shell">
        <header className="frm-nav">
          <Link className="frm-wordmark" href="/">
            FrontRunMe
          </Link>
          <nav className="frm-nav-links" aria-label="Primary">
            <Link href="#how-it-works">How It Works</Link>
            <Link href="#intelligence">Intelligence</Link>
            <Link href="#pricing">Pricing</Link>
            <Link href="#telegram">Telegram</Link>
          </nav>
          <ConnectWalletButton className="frm-nav-cta" />
        </header>

        <main className="frm-main">
          <section className="frm-hero">
            <div className="frm-hero-orb frm-hero-orb-left" />
            <div className="frm-hero-orb frm-hero-orb-right" />
            <div className="frm-hero-copy">
              <div className="frm-status-pill">
                <span className="frm-pulse-dot" aria-hidden="true" />
                <span>Live alpha stream active</span>
              </div>
              <h1 className="frm-display">
                Stop Scrolling.
                <br />
                <span>Start Seeing Signal.</span>
              </h1>
              <p className="frm-lede">
                AI-curated crypto intelligence delivered straight to Telegram. No noise. No spam. Just what
                actually matters.
              </p>
              <div className="frm-actions">
                <Link className="frm-button frm-button-primary" href="#pricing">
                  Unlock Today&apos;s Alpha
                </Link>
                <Link className="frm-button frm-button-secondary" href="#intelligence">
                  View Sample Report
                </Link>
              </div>
            </div>

            <aside className="frm-hero-preview frm-glass-card">
              <div className="frm-scan-line" aria-hidden="true" />
              <div className="frm-preview-head">
                <div className="frm-preview-brand">
                  <div className="frm-preview-mark">FR</div>
                  <div>
                    <strong>FrontRunMe Intelligence</strong>
                    <span>
                      <span className="frm-preview-live-dot" aria-hidden="true" />
                      AI is processing
                    </span>
                  </div>
                </div>
                <span className="frm-preview-menu">•••</span>
              </div>

              <div className="frm-preview-bubble">
                <div className="frm-chip-row">
                  <span className="frm-chip" data-tone="category">
                    {formatLabel(heroCard.category)}
                  </span>
                  <span className="frm-chip" data-tone={chipTone(heroCard.bias)}>
                    {formatBias(heroCard.bias)}
                  </span>
                </div>
                <p>
                  {heroCard.summary}{' '}
                  <span className="frm-inline-highlight">Score {Math.round(heroCard.score)}/100.</span>
                </p>
                <div className="frm-preview-note">Why it matters: {heroCard.whyItMatters}</div>
              </div>
            </aside>

            <div className="frm-hero-stats" aria-label="Live platform stats">
              <div className="frm-stat">
                <strong>{activeSources}</strong>
                <span>active sources feeding the pipeline</span>
              </div>
              <div className="frm-stat">
                <strong>{candidateMessages}</strong>
                <span>candidate messages filtered right now</span>
              </div>
              <div className="frm-stat">
                <strong>{promotedClusters}</strong>
                <span>promoted signals ready for delivery</span>
              </div>
            </div>
          </section>

          <section className="frm-section frm-section-toned" id="how-it-works">
            <div className="frm-section-head">
              <div>
                <span className="frm-kicker">Process</span>
                <h2 className="frm-section-title">The Pipeline to Alpha</h2>
              </div>
              <p>
                Four steps from raw Telegram chaos to clear, actionable signals delivered in the channel you
                actually check.
              </p>
            </div>
            <div className="frm-pipeline-grid">
              <article className="frm-step-card">
                <div className="frm-step-index">1</div>
                <h3>Aggregate</h3>
                <p>Monitor {activeSources}+ active Telegram sources and curated market feeds around the clock.</p>
              </article>
              <article className="frm-step-card">
                <div className="frm-step-index">2</div>
                <h3>Filter</h3>
                <p>Normalize, dedupe, cluster, and score the narratives that deserve trader attention.</p>
              </article>
              <article className="frm-step-card">
                <div className="frm-step-index">3</div>
                <h3>Verify</h3>
                <p>Unlock access with a single x402 payment flow that stays private and onchain-native.</p>
              </article>
              <article className="frm-step-card">
                <div className="frm-step-index">4</div>
                <h3>Receive</h3>
                <p>Get premium Telegram drops with summary, conviction, and why-it-matters context attached.</p>
              </article>
            </div>
          </section>

          <section className="frm-section" id="intelligence">
            <div className="frm-intelligence-grid">
              <div className="frm-intelligence-copy">
                <span className="frm-kicker">Daily Brief</span>
                <h2 className="frm-section-title">
                  Your Morning
                  <br />
                  Pulse Check.
                </h2>
                <p>
                  Structured for speed, focused on conviction, and backed by the same storage layer that powers
                  the private feed.
                </p>
                <ul className="frm-checklist">
                  <li>No more refreshing CT for the same rumor twenty times.</li>
                  <li>Signals arrive with category, bias, and impact context.</li>
                  <li>Telegram-first delivery keeps the workflow lightweight.</li>
                </ul>
              </div>
              <div className="frm-report-stack">
                {cards.map((item) => (
                  <article className="frm-report-card" key={item.id}>
                    <div className="frm-report-meta">
                      <div className="frm-chip-row">
                        <span className="frm-chip" data-tone="category">
                          {formatLabel(item.category)}
                        </span>
                        <span className="frm-chip" data-tone={chipTone(item.bias)}>
                          {formatBias(item.bias)}
                        </span>
                      </div>
                      <span className="frm-report-score">Signal {Math.round(item.score)}</span>
                    </div>
                    <h3>{item.title}</h3>
                    <p className="frm-report-summary">{item.summary}</p>
                    <div className="frm-report-callout">
                      <span>Why it matters</span>
                      <p>{item.whyItMatters}</p>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </section>

          <section className="frm-section frm-section-deep" id="telegram">
            <div className="frm-prop-grid">
              <article className="frm-prop-card">
                <div className="frm-prop-icon">01</div>
                <h3>Cut Through Noise</h3>
                <p>
                  The pipeline filters duplicates, meme churn, and shallow reposts so attention stays on the
                  market-moving 1%.
                </p>
              </article>
              <article className="frm-prop-card">
                <div className="frm-prop-icon frm-prop-icon-alt">02</div>
                <h3>Actionable Insight</h3>
                <p>
                  Each brief pairs the summary with a sharp why-it-matters block so the signal lands with
                  conviction.
                </p>
              </article>
              <article className="frm-prop-card">
                <div className="frm-prop-icon frm-prop-icon-cool">03</div>
                <h3>Telegram Native</h3>
                <p>
                  No extra dashboard to babysit. Access lives where crypto traders already coordinate and react.
                </p>
              </article>
            </div>
          </section>

          <section className="frm-section" id="pricing">
            <div className="frm-pricing-panel frm-glass-card">
              <div className="frm-pricing-copy">
                <span className="frm-kicker">Access</span>
                <h2 className="frm-section-title">Pay Once. Unlock Signal.</h2>
                <p>
                  Gain lifetime access to the FrontRunMe intelligence feed. No recurring subscription drag. No
                  hidden upgrade tiers.
                </p>
                <div className="frm-pricing-list">
                  <div className="frm-pricing-item">
                    <span className="frm-checkmark">✓</span>
                    <div>
                      <strong>Lifetime Telegram Entry</strong>
                      <p>Direct access to the private intelligence channel after payment verification.</p>
                    </div>
                  </div>
                  <div className="frm-pricing-item">
                    <span className="frm-checkmark">✓</span>
                    <div>
                      <strong>High-Conviction Weekly Drops</strong>
                      <p>Deep dives on narratives that graduate from noise into real market structure.</p>
                    </div>
                  </div>
                  <div className="frm-pricing-item">
                    <span className="frm-checkmark">✓</span>
                    <div>
                      <strong>Onchain Privacy</strong>
                      <p>x402-based access keeps the unlock path aligned with crypto-native payment rails.</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="frm-price-card">
                <div className="frm-price-label">Lifetime access</div>
                <div className="frm-price">
                  $299<span>.00</span>
                </div>
                <CheckoutPanel />
                <p className="frm-price-note">Supported rails: ETH, BASE, SOL, ARB</p>
              </div>
            </div>
          </section>

          <section className="frm-final-cta">
            <div className="frm-avatar-row" aria-hidden="true">
              <span className="frm-avatar">QT</span>
              <span className="frm-avatar">LP</span>
              <span className="frm-avatar">AR</span>
              <span className="frm-avatar frm-avatar-count">+1.2k</span>
            </div>
            <h2 className="frm-final-title">Your Edge Starts Here.</h2>
            <p>
              Join traders and researchers who prefer intelligence delivered, not discovered halfway down a
              scrolling feed.
            </p>
            <Link className="frm-button frm-button-primary frm-button-large" href="#pricing">
              Get Instant Access
            </Link>
          </section>
        </main>
      </div>

      <footer className="frm-footer">
        <div className="frm-footer-inner">
          <div className="frm-footer-brand">FRONTRUNME</div>
          <nav className="frm-footer-links" aria-label="Footer">
            <Link href="#pricing">Pricing</Link>
            <Link href="/admin/catalog">Admin</Link>
            <Link href="/admin/telegram">Telegram Intake</Link>
            <Link href="/api/health">Health</Link>
          </nav>
          <div className="frm-footer-copy">© 2026 FrontRunMe. AI-powered signal delivery.</div>
        </div>
      </footer>
    </div>
  );
}
