import pg from 'pg';
if (!process.env.MIGRATION_DATABASE_URL || !process.env.STANDARD_APP_PASSWORD || process.env.STANDARD_APP_PASSWORD.length < 32) throw new Error('Operator URL and a random application password (32+ characters) required');
const client = new pg.Client({connectionString:process.env.MIGRATION_DATABASE_URL});
try {
  await client.connect();
  await client.query('BEGIN');
  await client.query('SELECT pg_advisory_xact_lock(43180003)');
  const exists = (await client.query("SELECT FROM pg_roles WHERE rolname='standard_web'")).rowCount;
  if (!exists) {
    const { rows } = await client.query("SELECT format('CREATE ROLE standard_web LOGIN PASSWORD %L', $1::text) AS command",[process.env.STANDARD_APP_PASSWORD]);
    await client.query(rows[0].command);
  }
  await client.query('GRANT standard_submitter TO standard_web');
  await client.query('COMMIT');
  console.log('Website role ready; existing passwords are preserved.');
} finally { await client.end(); }
