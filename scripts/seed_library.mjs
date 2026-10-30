import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import pg from 'pg';
import { normalizeSubmission, saveSubmission, reviewSubmission, sha256 } from './contribution_api.mjs';
import { publishSubmission } from './library.mjs';

export async function seedInputs() {
  const catalog = JSON.parse(await readFile(new URL('../library/catalog.json',import.meta.url),'utf8'));
  const rows = [];
  for (const item of catalog) {
    if (!/^(library|workflows)\/[a-z0-9/.-]+\.md$/.test(item.file) || item.file.includes('..')) throw new Error('Invalid seed path');
    const content = await readFile(new URL(`../${item.file}`,import.meta.url),'utf8');
    const link = `https://github.com/thuygom/code-to-work-standards/blob/master/${item.file}`;
    const attachment = `${content}\n\n---\n출처: ${link}\n${item.provenance}\n`;
    const input = { title:item.title, domain:item.domain, format:item.format, source:item.source, kind:'documentation', author:'Standard 초기 자료', role:'공개 자료 편집', context:content, rule:item.provenance, check:'공개 가공·출처를 확인한 초기 자료입니다. 실제 적용 전에 담당자·도구·예외·수용 조건을 검토해 주세요. 현업 채택·효과 측정은 별도 확인 대상입니다.', references:`${link}\nhttps://github.com/thuygom/code-to-work-standards/blob/master/library/README.md`, consent:'2026-10-30', attachments:[{name:item.file.replaceAll('/','-'),data:Buffer.from(attachment).toString('base64')}] };
    rows.push({ key:item.key, input:normalizeSubmission(input) });
  }
  return rows;
}
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  if (!process.argv.includes('--publish-reviewed') || !process.env.MIGRATION_DATABASE_URL) throw new Error('Use --publish-reviewed after reviewing the public seed files');
  const inputs = await seedInputs();
  const pool = new pg.Pool({connectionString:process.env.MIGRATION_DATABASE_URL});
  const lock = await pool.connect();
  try {
    await lock.query('SELECT pg_advisory_lock(43180002)');
    for (const item of inputs) {
      // This string is not a valid browser bearer token; curated records are operator-owned.
      const result = await saveSubmission(pool,sha256('standard-curated-library-v1'),item.key,item.input,`seed:${item.key}`);
      let row = (await pool.query('SELECT status,revision FROM submissions WHERE id=$1',[result.receipt.id])).rows[0];
      if (row.status === 'received') row = await reviewSubmission(pool,result.receipt.id,row.revision,'reviewing','초기 자료의 출처와 공개 가공 검토');
      if (row.status === 'reviewing') row = await reviewSubmission(pool,result.receipt.id,row.revision,'accepted','공개 가능한 초안으로 수용. 현업 검증·성과 확인과 별도.');
      if (row.status !== 'accepted') throw new Error('Seed was declined; operator review required');
      await publishSubmission(pool,result.receipt.id,[0]);
    }
    console.log(`${inputs.length} curated resources ready; repeated imports reuse existing records.`);
  } finally { await lock.query('SELECT pg_advisory_unlock(43180002)'); lock.release(); await pool.end(); }
}
