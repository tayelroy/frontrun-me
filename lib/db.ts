import { Pool, type PoolClient, type QueryResultRow } from 'pg';
import { env } from './env';

let pool: Pool | null = null;

export function getPool() {
  if (!env.DATABASE_URL) {
    throw new Error('DATABASE_URL must be set for database access.');
  }

  if (!pool) {
    pool = new Pool({
      connectionString: env.DATABASE_URL
    });
  }

  return pool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(text: string, params: any[] = []) {
  const result = await getPool().query<T>(text, params);
  return result;
}

export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query('begin');
    const result = await fn(client);
    await client.query('commit');
    return result;
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}
