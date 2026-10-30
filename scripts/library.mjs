import { buildContribution, FORMATS, DOMAINS } from '../website/contribution.mjs';
import { UUID, HttpError } from './contribution_api.mjs';

export async function publishSubmission(pool, id, positions = []) {
  if (!UUID.test(id) || !Array.isArray(positions) || positions.some(x => !Number.isInteger(x) || x < 0 || x > 2)) throw new Error('Invalid publication selection');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const row = (await client.query('SELECT * FROM submissions WHERE id=$1 FOR UPDATE', [id])).rows[0];
    if (!row || row.status !== 'accepted') throw new Error('Only accepted submissions can be published');
    const body = buildContribution({ ...row, check: row.verification, references: row.reference_text }).body;
    const old = (await client.query('SELECT source_revision FROM publications WHERE id=$1', [id])).rows[0];
    if (old) {
      const files = (await client.query('SELECT position FROM publication_files WHERE submission_id=$1 ORDER BY position', [id])).rows.map(r => r.position);
      if (old.source_revision !== row.revision || JSON.stringify(files) !== JSON.stringify([...new Set(positions)].sort())) throw new Error('Published revision/selection differs; withdraw before republishing');
    } else {
      await client.query('INSERT INTO publications(id,title,domain,format,author,source,body,source_revision) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)', [id,row.title,row.domain,row.format,row.author,row.source,body,row.revision]);
      for (const position of new Set(positions)) await client.query('INSERT INTO publication_files(submission_id,position) VALUES ($1,$2)', [id,position]);
      await client.query("INSERT INTO publication_events(submission_id,action) VALUES ($1,'publish')", [id]);
    }
    await client.query('COMMIT');
  } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
}
export async function withdrawPublication(pool, id) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query('DELETE FROM publications WHERE id=$1 RETURNING id', [id]);
    if (result.rowCount) await client.query("INSERT INTO publication_events(submission_id,action) VALUES ($1,'withdraw')", [id]);
    await client.query('COMMIT');
  } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
}

export async function libraryRequest(pool, req, res) {
  const url = new URL(req.url, 'http://localhost');
  if (req.method !== 'GET') throw new HttpError(405, '조회만 지원합니다.');
  res.setHeader('Cache-Control','no-store');
  if (url.pathname === '/api/library') {
    const format = url.searchParams.get('format') || '';
    const domain = url.searchParams.get('domain') || '';
    const query = url.searchParams.get('q') || '';
    const offset = Number(url.searchParams.get('offset') || 0);
    if ((format && !Object.hasOwn(FORMATS,format)) || (domain && !DOMAINS.some(d => d.id === domain)) || query.length > 100 || !Number.isInteger(offset) || offset < 0 || offset > 10000) throw new HttpError(400,'검색 조건을 확인해 주세요.');
    const args = [format,domain,query.replace(/[\\%_]/g,'\\$&')];
    const where = "WHERE ($1='' OR format=$1) AND ($2='' OR domain=$2) AND ($3='' OR title ILIKE '%'||$3||'%' OR body ILIKE '%'||$3||'%')";
    const items = (await pool.query(`SELECT id,title,domain,format,author,source,published_at,left(body,240) AS excerpt FROM publications ${where} ORDER BY published_at DESC,id DESC LIMIT 24 OFFSET $4`, [...args,offset])).rows;
    const total = Number((await pool.query(`SELECT count(*) FROM publications ${where}`, args)).rows[0].count);
    res.writeHead(200,{'Content-Type':'application/json; charset=utf-8'}); res.end(JSON.stringify({ items,total })); return;
  }
  const match = /^\/api\/library\/([a-f0-9-]+)(?:\/(markdown|attachments\/([0-2])))?$/.exec(url.pathname);
  if (!match || !UUID.test(match[1])) throw new HttpError(404,'자료를 찾을 수 없습니다.');
  const row = (await pool.query('SELECT id,title,domain,format,author,source,body,published_at FROM publications WHERE id=$1', [match[1]])).rows[0];
  if (!row) throw new HttpError(404,'공개된 자료를 찾을 수 없습니다.');
  if (match[3] !== undefined) {
    const a = (await pool.query('SELECT name,bytes FROM published_files WHERE submission_id=$1 AND position=$2', [row.id,Number(match[3])])).rows[0];
    if (!a) throw new HttpError(404,'공개된 첨부파일을 찾을 수 없습니다.');
    res.writeHead(200,{'Content-Type':'application/octet-stream','Content-Disposition':`attachment; filename="attachment"; filename*=UTF-8''${encodeURIComponent(a.name).replace(/'/g,'%27')}`}); res.end(a.bytes); return;
  }
  if (match[2] === 'markdown') {
    res.writeHead(200,{'Content-Type':'text/markdown; charset=utf-8','Content-Disposition':`attachment; filename="standard-${row.id}.md"`});
    res.end(`# ${row.title}\n\n${row.body}\n---\n출처: https://standard.linh.day/?contribution=${row.id}\n공개 자료 · 현업 채택·성과 검증과 별개\n`); return;
  }
  row.attachments = (await pool.query('SELECT position,name,media_type,octet_length(bytes) AS size,sha256 FROM published_files WHERE submission_id=$1 ORDER BY position',[row.id])).rows;
  res.writeHead(200,{'Content-Type':'application/json; charset=utf-8'}); res.end(JSON.stringify(row));
}
