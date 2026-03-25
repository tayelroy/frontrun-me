import { AdminFrame } from '@/components/AdminFrame';
import { getDashboardStats } from '@/lib/repository';

export const dynamic = 'force-dynamic';

export default async function PricingPage() {
  const stats = await getDashboardStats();

  return (
    <AdminFrame
      active="pricing"
      title="Pricing and access controls"
      subtitle="Use this surface for payment sessions, entitlement checks, and x402 reconciliation."
    >
      <div className="grid two">
        <section className="card">
          <div className="section-head">
            <div>
              <h3>Payment health</h3>
              <p>What the database sees right now.</p>
            </div>
            <span className="badge orange">x402 enabled</span>
          </div>
          <div className="kpi-band">
            <div className="kpi">
              <span>Paid sessions</span>
              <strong>{stats.paidSessions}</strong>
            </div>
            <div className="kpi">
              <span>Active grants</span>
              <strong>{stats.activeGrants}</strong>
            </div>
            <div className="kpi">
              <span>Database sources</span>
              <strong>{stats.sources}</strong>
            </div>
            <div className="kpi">
              <span>Premium price</span>
              <strong>$49</strong>
            </div>
          </div>
        </section>

        <section className="card soft">
          <div className="section-head">
            <div>
              <h3>Entitlement model</h3>
              <p>Payment success creates a user, payment session, invite link, and access grant.</p>
            </div>
          </div>
          <div className="insight-list">
            <div className="insight">
              <strong>1. Webhook arrives</strong>
              <div>Validate payload and persist the payment session.</div>
            </div>
            <div className="insight">
              <strong>2. Access is granted</strong>
              <div>Attach the invite to the payment session and wallet.</div>
            </div>
            <div className="insight">
              <strong>3. Telegram link is returned</strong>
              <div>Users join the premium channel through the unique invite.</div>
            </div>
          </div>
        </section>
      </div>
    </AdminFrame>
  );
}
