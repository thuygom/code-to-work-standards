import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdtemp, cp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import pg from 'pg';
import { migrate, checkSchema } from '../db/migrate.mjs';
import { normalizeSubmission, sha256, saveSubmission, reviewSubmission } from '../scripts/contribution_api.mjs';
import { publishSubmission, withdrawPublication } from '../scripts/library.mjs';
import { createSiteServer } from '../scripts/serve_website.mjs';

const input = { domain:'notes',kind:'observation',format:'sop',source:'synthetic',author:'테스트',role:'검토자',title:'합성 검증 사례',context:'고객사 A의 요청과 수락을 구분합니다.',rule:'수락을 확인합니다.',check:'반례를 검토합니다.',references:'N01',consent:'2026-10-30',attachments:[{name:'사례.md',data:Buffer.from('합성 자료').toString('base64')}] };
test('submission boundary rejects disguised files, bad fields and missing consent', () => {
  for (const changes of [{consent:''},{format:'unknown'},{context:12},{role:'\0'},{attachments:[{name:'a.html',data:'YWJj'}]},{attachments:[{name:'../a.txt',data:'YWJj'}]},{attachments:[{name:'a.pdf',data:'YWJj'}]},{attachments:[{name:'a.txt',data:'%%%'}]}]) assert.throws(() => normalizeSubmission({...input,...changes}));
  assert.equal(normalizeSubmission({...input,attachments:[{name:'large.txt',data:Buffer.alloc(2*1024*1024,97).toString('base64')}]}).attachments[0].bytes.length,2*1024*1024);
  assert.equal(normalizeSubmission(input).attachments[0].sha256, sha256(Buffer.from('합성 자료')));
});

test('PostgreSQL migrations, ownership, atomic retries, review and publication', { skip: !process.env.TEST_DATABASE_URL }, async t => {
  if (!new URL(process.env.TEST_DATABASE_URL).pathname.endsWith('/standard_test')) throw new Error('Tests require disposable standard_test database');
  const owner = new pg.Pool({connectionString:process.env.TEST_DATABASE_URL,max:6});
  t.after(() => owner.end());
  const migrateOnce = async directory => { const c = await owner.connect(); try { await migrate(c,directory); } finally { c.release(); } };
  await t.test('fresh, repeat and concurrent migrations serialize',async () => {
    await Promise.all([migrateOnce(),migrateOnce(),migrateOnce()]);
    await checkSchema(owner);
    assert.equal(Number((await owner.query('SELECT count(*) FROM schema_migrations')).rows[0].count),2);
  });
  await t.test('checksum drift, missing migration and failed migration roll back',async () => {
    const directory = await mkdtemp(`${tmpdir()}/standard-migrations-`);
    t.after(() => rm(directory,{recursive:true,force:true}));
    await cp(new URL('../db/migrations/',import.meta.url),directory,{recursive:true});
    await writeFile(`${directory}/003_failure.sql`,'CREATE TABLE should_rollback(id int); SELECT missing_column;');
    await assert.rejects(migrateOnce(pathToFileURL(`${directory}/`)));
    assert.equal((await owner.query("SELECT to_regclass('should_rollback') AS found")).rows[0].found,null);
    await rm(`${directory}/003_failure.sql`);
    await writeFile(`${directory}/001_contributions.sql`,'-- tampered');
    await assert.rejects(migrateOnce(pathToFileURL(`${directory}/`)),/checksum/);
    await rm(`${directory}/002_public_library.sql`);
    await assert.rejects(migrateOnce(pathToFileURL(`${directory}/`)),/missing/);
  });
  await owner.query("DO $$ BEGIN IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='standard_test_web') THEN CREATE ROLE standard_test_web LOGIN PASSWORD 'disposable-test-app'; END IF; END $$; GRANT standard_submitter TO standard_test_web");
  const appURL = new URL(process.env.TEST_DATABASE_URL); appURL.username='standard_test_web'; appURL.password='disposable-test-app';
  const app = new pg.Pool({connectionString:appURL.href,max:8}); t.after(() => app.end());
  const server = createSiteServer({pool:app,origin:'https://standard.test',rateSecret:'disposable-limit-key'});
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const token = randomBytes(32).toString('hex'); const key=randomUUID();
  const headers = {Origin:'https://standard.test','Content-Type':'application/json',Authorization:`Bearer ${token}`,'Idempotency-Key':key};
  const submit = changes => fetch(`${base}/api/contributions`,{method:'POST',headers,body:JSON.stringify({...input,...changes})});
  let receipt;
  await t.test('concurrent same-key submissions commit once and replay identical receipt',async () => {
    const responses = await Promise.all(Array.from({length:8},() => submit()));
    assert.equal(responses.filter(r => r.status === 201).length,1);
    assert.equal(responses.filter(r => r.status === 200).length,7);
    const bodies=await Promise.all(responses.map(r => r.json())); receipt=bodies[0];
    for (const body of bodies) assert.deepEqual(body,receipt);
    assert.equal(Number((await owner.query('SELECT count(*) FROM submissions')).rows[0].count),1);
    assert.equal(Number((await owner.query('SELECT count(*) FROM attachments')).rows[0].count),1);
    assert.equal(Number((await owner.query('SELECT count(*) FROM submission_events')).rows[0].count),1);
    assert.equal((await submit({title:'다른 내용'})).status,409);
  });
  await t.test('authorization, origin, RLS and private attachment isolation',async () => {
    const path=`${base}/api/contributions/${receipt.id}`;
    assert.equal((await fetch(path)).status,401);
    assert.equal((await fetch(path,{headers:{Authorization:`Bearer ${randomBytes(32).toString('hex')}`}})).status,404);
    assert.equal((await fetch(path,{headers})).status,200);
    assert.equal((await fetch(`${base}/api/contributions/by-key/${key}`,{headers})).status,200);
    const a=await fetch(`${path}/attachments/0`,{headers}); assert.equal(await a.text(),'합성 자료'); assert.match(a.headers.get('content-disposition'),/^attachment;/);
    assert.equal((await fetch(`${base}/api/contributions`,{method:'POST',headers:{...headers,Origin:'https://evil.test'},body:JSON.stringify(input)})).status,403);
    assert.equal((await app.query('SELECT * FROM submissions')).rowCount,0);
    await assert.rejects(app.query('UPDATE submissions SET status=$1',['accepted']),e => e.code==='42501');
    await assert.rejects(app.query('DELETE FROM attachments'),e => e.code==='42501');
  });
  await t.test('file failure rolls back parent, event and quota; original content immutable',async () => {
    const broken=normalizeSubmission(input); broken.attachments[0].sha256='f'.repeat(64);
    const before=await owner.query('SELECT bucket,count FROM submission_limits ORDER BY bucket');
    await assert.rejects(saveSubmission(app,sha256(token),randomUUID(),broken,'rollback-test'),e => e.code==='23514');
    assert.equal(Number((await owner.query('SELECT count(*) FROM submissions')).rows[0].count),1);
    assert.deepEqual((await owner.query('SELECT bucket,count FROM submission_limits ORDER BY bucket')).rows,before.rows);
    await assert.rejects(owner.query('UPDATE submissions SET title=$1 WHERE id=$2',['overwrite',receipt.id]),e => e.code==='23514');
  });
  await t.test('review version conflict, explicit publication, safe public projection and withdrawal',async () => {
    assert.equal((await (await fetch(`${base}/api/library`)).json()).total,0);
    await assert.rejects(publishSubmission(owner,receipt.id,[0]),/accepted/);
    await reviewSubmission(owner,receipt.id,0,'reviewing','공개 범위 확인');
    await assert.rejects(reviewSubmission(owner,receipt.id,0,'declined','오래된 화면'),e => e.status===409);
    await reviewSubmission(owner,receipt.id,1,'accepted','합성 사례 및 출처 확인');
    await publishSubmission(owner,receipt.id,[0]); await publishSubmission(owner,receipt.id,[0]);
    assert.equal(Number((await owner.query('SELECT count(*) FROM publication_events')).rows[0].count),1);
    const list=await (await fetch(`${base}/api/library?format=sop&q=합성`)).json(); assert.equal(list.total,1);
    const detail=await (await fetch(`${base}/api/library/${receipt.id}`)).json();
    assert.equal(detail.attachments.length,1); assert.ok(!JSON.stringify(detail).includes(token)); assert.ok(!JSON.stringify(detail).includes('owner_hash'));
    assert.match(await (await fetch(`${base}/api/library/${receipt.id}/markdown`)).text(),/고객사 A/);
    assert.equal(await (await fetch(`${base}/api/library/${receipt.id}/attachments/0`)).text(),'합성 자료');
    assert.deepEqual(await (await submit()).json(),receipt);
    await withdrawPublication(owner,receipt.id); await withdrawPublication(owner,receipt.id);
    assert.equal((await fetch(`${base}/api/library/${receipt.id}/attachments/0`)).status,404);
    assert.equal((await fetch(`${base}/api/contributions/${receipt.id}/attachments/0`,{headers})).status,200);
  });
  await t.test('daily quota bounds new writes while allowing replay',async () => {
    for (let n=0;n<10;n++) await saveSubmission(app,sha256(token),randomUUID(),normalizeSubmission({...input,attachments:[]}),'limited-ip');
    await assert.rejects(saveSubmission(app,sha256(token),randomUUID(),normalizeSubmission(input),'limited-ip'),e => e.status===429);
    assert.equal((await submit()).status,200);
  });
  await t.test('health reflects database/schema availability',async () => {
    assert.equal((await fetch(`${base}/api/health`)).status,200);
    const original = (await owner.query("SELECT checksum FROM schema_migrations WHERE name='002_public_library.sql'")).rows[0].checksum;
    await owner.query("UPDATE schema_migrations SET checksum='drift' WHERE name='002_public_library.sql'");
    assert.equal((await fetch(`${base}/api/health`)).status,503);
    await owner.query("UPDATE schema_migrations SET checksum=$1 WHERE name='002_public_library.sql'",[original]);
  });
});
