import { AdminFrame } from '@/components/AdminFrame';
import { getDashboardStats } from '@/lib/repository';

export const dynamic = 'force-dynamic';

export default async function CatalogPage() {
  const stats = await getDashboardStats();

  return (
    <AdminFrame
      active="catalog"
      title="Catalog and source readiness"
      subtitle="Track feed coverage, Telegram intake readiness, article volume, and insight output from the database."
    >
      <section className="hero compact">
        <div className="hero-copy">
          <h2>News and Telegram ingestion are ready for signal processing</h2>
          <p>Use this surface to manage sources, review dedupe quality, and promote high-confidence signals into premium insights.</p>
          <div className="stat-strip">
            <div className="mini-stat">
              <strong>{stats.sources}</strong>
              <span>Active sources</span>
            </div>
            <div className="mini-stat">
              <strong>{stats.articles}</strong>
              <span>Articles stored</span>
            </div>
            <div className="mini-stat">
              <strong>{stats.insights}</strong>
              <span>Insights generated</span>
            </div>
          </div>
        </div>
        <div className="hero-card">
          <h3>Catalog sync priorities</h3>
          <ul>
            <li>Connect RSS feeds and API sources.</li>
            <li>Normalize titles, timestamps, and dedupe keys.</li>
            <li>Publish only high-confidence summaries.</li>
          </ul>
        </div>
      </section>

      <div className="grid two">
        <section className="card">
          <div className="section-head">
            <div>
              <h3>Ingestion status</h3>
              <p>Live database counters from the current schema.</p>
            </div>
            <span className="badge blue">Database-backed</span>
          </div>
          <div className="kpi-band">
            <div className="kpi">
              <span>Published insights</span>
              <strong>{stats.insights}</strong>
            </div>
            <div className="kpi">
              <span>Paid sessions</span>
              <strong>{stats.paidSessions}</strong>
            </div>
            <div className="kpi">
              <span>Active grants</span>
              <strong>{stats.activeGrants}</strong>
            </div>
            <div className="kpi">
              <span>News sources</span>
              <strong>{stats.sources}</strong>
            </div>
          </div>
        </section>

        <section className="card soft">
          <div className="section-head">
            <div>
              <h3>Next workflow</h3>
              <p>Wire a feed processor to call the insert helpers in `lib/repository.ts`.</p>
            </div>
          </div>
          <div className="insight-list">
            <div className="insight">
              <strong>Step 1</strong>
              <div>Fetch a feed item or Telegram post and compute a stable dedupe key.</div>
            </div>
            <div className="insight">
              <strong>Step 2</strong>
              <div>Insert the raw record, cluster duplicates, then generate the AI insight record.</div>
            </div>
            <div className="insight">
              <strong>Step 3</strong>
              <div>Mark the insight as published so it appears on the landing page.</div>
            </div>
          </div>
        </section>
      </div>
    </AdminFrame>
  );
}
