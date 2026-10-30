import { readdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import pg from 'pg';

export async function manifest(directory = new URL('./migrations/', import.meta.url)) {
  const names = (await readdir(directory)).filter(n => n.endsWith('.sql')).sort();
  if (!names.length || names.some((name, i) => !name.startsWith(`${String(i + 1).padStart(3, '0')}_`))) throw new Error('Migration sequence has gaps');
  return Promise.all(names.map(async name => {
    const sql = await readFile(new URL(name, directory), 'utf8');
    return { name, sql, checksum: createHash('sha256').update(sql).digest('hex') };
  }));
}
export async function checkSchema(client, entries = undefined) {
  entries ??= await manifest();
  const { rows } = await client.query('SELECT name, checksum FROM schema_migrations ORDER BY name');
  if (rows.length !== entries.length || rows.some((r, i) => r.name !== entries[i].name || r.checksum !== entries[i].checksum)) throw new Error('Database migration mismatch');
}
export async function migrate(client, directory) {
  const entries = await manifest(directory);
  await client.query('BEGIN');
  try {
    await client.query("SET LOCAL lock_timeout = '20s'; SET LOCAL statement_timeout = '60s'");
    await client.query('SELECT pg_advisory_xact_lock(43180001)');
    await client.query('CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT clock_timestamp())');
    const { rows } = await client.query('SELECT name, checksum FROM schema_migrations ORDER BY name');
    if (rows.length > entries.length || rows.some((r, i) => r.name !== entries[i].name || r.checksum !== entries[i].checksum)) throw new Error('Applied migration missing or checksum changed');
    for (const entry of entries.slice(rows.length)) {
      await client.query(entry.sql);
      await client.query('INSERT INTO schema_migrations(name,checksum) VALUES ($1,$2)', [entry.name, entry.checksum]);
    }
    await checkSchema(client, entries);
    await client.query('COMMIT');
  } catch (error) { await client.query('ROLLBACK'); throw error; }
}
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const client = new pg.Client({ connectionString: process.env.MIGRATION_DATABASE_URL, connectionTimeoutMillis: 5000 });
  if (!process.env.MIGRATION_DATABASE_URL) throw new Error('MIGRATION_DATABASE_URL is required');
  try { await client.connect(); await migrate(client); console.log('Database schema ready'); }
  finally { await client.end(); }
}
