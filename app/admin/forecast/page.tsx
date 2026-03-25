import { AdminFrame } from '@/components/AdminFrame';
import { listPublishedInsights } from '@/lib/repository';

export const dynamic = 'force-dynamic';

export default async function ForecastPage() {
  const insights = await listPublishedInsights(6);

  return (
    <AdminFrame
      active="forecast"
      title="AI demand forecasting"
      subtitle="This placeholder view shows how live insights can be surfaced and scheduled from the database."
    >
      <section className="card">
        <div className="section-head">
          <div>
            <h3>Published insight feed</h3>
            <p>These rows come directly from `news_insights` joined with `news_articles`.</p>
          </div>
          <span className="badge blue">Updated from Postgres</span>
        </div>
        <div className="insight-list">
          {insights.length > 0 ? (
            insights.map((item) => (
              <div className="insight" key={item.id}>
                <strong>{item.title}</strong>
                <div>
                  {item.category} • {item.bias} • Score {item.score}/100
                </div>
                <div style={{ marginTop: 8 }}>{item.summary}</div>
                <div style={{ marginTop: 8, color: 'var(--text-soft)' }}>{item.whyItMatters}</div>
              </div>
            ))
          ) : (
            <div className="note">No published insights yet. Seed the database to populate this page.</div>
          )}
        </div>
      </section>
    </AdminFrame>
  );
}
