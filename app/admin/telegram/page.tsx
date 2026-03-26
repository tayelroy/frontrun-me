import { AdminFrame } from '@/components/AdminFrame';
import { getTelegramAggregationOverview, listTelegramClusters, listTelegramSourceStatuses } from '@/lib/repository';
import { telegramPipelineSteps } from '@/lib/telegram/pipeline';

export const dynamic = 'force-dynamic';

export default async function TelegramPage() {
  const [overview, sources, clusters] = await Promise.all([
    getTelegramAggregationOverview(),
    listTelegramSourceStatuses(6),
    listTelegramClusters(6)
  ]);

  return (
    <AdminFrame
      active="telegram"
      title="Telegram channel aggregation"
      subtitle="Track source cursors, raw message intake, clustering, and the path from Telegram chatter to premium insight."
    >
      <section className="hero compact">
        <div className="hero-copy">
          <h2>Telegram is now modeled as a first-class ingestion surface</h2>
          <p>
            The database can track source access mode, ingestion runs, raw messages, and signal clusters before anything
            is promoted into the premium feed.
          </p>
          <div className="stat-strip">
            <div className="mini-stat">
              <strong>{overview.activeSources}</strong>
              <span>Active channels</span>
            </div>
            <div className="mini-stat">
              <strong>{overview.rawMessages}</strong>
              <span>Raw messages stored</span>
            </div>
            <div className="mini-stat">
              <strong>{overview.clusters}</strong>
              <span>Signal clusters</span>
            </div>
            <div className="mini-stat">
              <strong>{overview.newClusters}</strong>
              <span>New pool items</span>
            </div>
          </div>
        </div>
        <div className="hero-card">
          <h3>Pipeline goals</h3>
          <ul>
            <li>Ingest only channels we are allowed to monitor.</li>
            <li>Cluster repeated chatter into one reviewable signal.</li>
            <li>Promote only high-confidence clusters into premium insights.</li>
          </ul>
        </div>
      </section>

      <div className="grid two">
        <section className="card">
          <div className="section-head">
            <div>
              <h3>Aggregation overview</h3>
              <p>Live counts from Telegram-specific tables.</p>
            </div>
            <span className="badge blue">Worker-ready</span>
          </div>
          <div className="kpi-band">
            <div className="kpi">
              <span>Total sources</span>
              <strong>{overview.sources}</strong>
            </div>
            <div className="kpi">
              <span>Candidate messages</span>
              <strong>{overview.candidateMessages}</strong>
            </div>
            <div className="kpi">
              <span>Promoted clusters</span>
              <strong>{overview.promotedClusters}</strong>
            </div>
            <div className="kpi">
              <span>Sent clusters</span>
              <strong>{overview.sentClusters}</strong>
            </div>
            <div className="kpi">
              <span>Failed runs</span>
              <strong>{overview.failedRuns}</strong>
            </div>
          </div>
        </section>

        <section className="card soft">
          <div className="section-head">
            <div>
              <h3>Implementation checklist</h3>
              <p>The next milestones are codified in `lib/telegram/pipeline.ts`.</p>
            </div>
          </div>
          <div className="insight-list">
            {telegramPipelineSteps.map((step) => (
              <div className="insight" key={step.id}>
                <strong>{step.title}</strong>
                <div className={`badge ${step.status === 'ready' ? 'green' : step.status === 'next' ? 'orange' : 'blue'}`}>
                  {step.status}
                </div>
                <div style={{ marginTop: 8 }}>{step.detail}</div>
                <div style={{ marginTop: 8, color: 'var(--text-soft)' }}>{step.output}</div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="grid two">
        <section className="card">
          <div className="section-head">
            <div>
              <h3>Source registry</h3>
              <p>Each channel keeps its own cursor and most recent ingestion run status.</p>
            </div>
          </div>
          {sources.length > 0 ? (
            <table className="table">
              <thead>
                <tr>
                  <th>Channel</th>
                  <th>Access</th>
                  <th>Last run</th>
                  <th>Cursor</th>
                </tr>
              </thead>
              <tbody>
                {sources.map((source) => (
                  <tr key={source.id}>
                    <td>
                      <strong>{source.sourceName}</strong>
                      <div style={{ color: 'var(--text-soft)', marginTop: 4 }}>
                        @{source.telegramUsername ?? 'private'} • {source.category}
                      </div>
                    </td>
                    <td>
                      <div>{source.accessMode}</div>
                      <div style={{ color: 'var(--text-soft)' }}>tier: {source.tier}</div>
                    </td>
                    <td>
                      <div>{source.lastRunStatus ?? 'never'}</div>
                      <div style={{ color: 'var(--text-soft)' }}>
                        fetched {source.fetchedCount} / inserted {source.insertedCount} / deduped {source.dedupedCount}
                      </div>
                    </td>
                    <td>
                      <div>{source.lastProcessedMessageId ?? 'n/a'}</div>
                      <div style={{ color: 'var(--text-soft)' }}>{source.lastSeenAt ?? 'no activity yet'}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="note">No Telegram sources are seeded yet. Run the seed script after updating your database.</div>
          )}
        </section>

        <section className="card">
          <div className="section-head">
            <div>
              <h3>Cluster queue</h3>
              <p>Canonical Telegram clusters waiting for review or promotion.</p>
            </div>
          </div>
          <div className="insight-list">
            {clusters.length > 0 ? (
              clusters.map((cluster) => (
                <div className="insight" key={cluster.id}>
                  <strong>{cluster.sourceName}</strong>
                  <div>
                    {cluster.category} • {cluster.bias} • score {cluster.signalScore}/100 • corroboration {cluster.corroborationCount}
                  </div>
                  <div style={{ marginTop: 8 }}>{cluster.summary ?? 'No summary yet.'}</div>
                  <div style={{ marginTop: 8, color: 'var(--text-soft)' }}>{cluster.whyItMatters ?? 'Awaiting analyst review.'}</div>
                  <div style={{ marginTop: 8 }} className={`badge ${cluster.status === 'reviewed' ? 'green' : cluster.status === 'queued' ? 'orange' : 'blue'}`}>
                    {cluster.status}
                  </div>
                  <div style={{ marginTop: 8, color: 'var(--text-soft)' }}>delivery: {cluster.deliveryStatus}</div>
                </div>
              ))
            ) : (
              <div className="note">No Telegram clusters are available yet. Seed the database to populate this queue.</div>
            )}
          </div>
        </section>
      </div>
    </AdminFrame>
  );
}
