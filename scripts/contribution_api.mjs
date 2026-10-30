import { createHash, createHmac, randomUUID } from 'node:crypto';
import { buildContribution, LIMITS } from '../website/contribution.mjs';
import { checkSchema } from '../db/migrate.mjs';
import { libraryRequest } from './library.mjs';

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const bad = message => { throw new HttpError(422, message); };
const MAX_BODY = 9 * 1024 * 1024;
export function normalizeSubmission(input) {
  const keys = ['domain','kind','source','format', ...Object.keys(LIMITS), 'consent', 'attachments'];
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(k => !keys.includes(k))) bad('지원하지 않는 입력입니다.');
  const fields = {};
  for (const key of keys.slice(0, -2)) {
    if (typeof input[key] !== 'string' || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(input[key])) bad('텍스트 입력을 확인해 주세요.');
    fields[key] = input[key].trim();
  }
  try { buildContribution(fields); } catch (e) { bad(e.message); }
  if (input.consent !== '2026-10-30') bad('공개 범위와 기여 라이선스에 동의해 주세요.');
  if (!Array.isArray(input.attachments) || input.attachments.length > 3) bad('첨부파일은 최대 3개입니다.');
  const attachments = input.attachments.map(file => {
    if (!file || typeof file.name !== 'string' || file.name.length > 120 || !file.name.length || /[\u0000-\u001f\u007f/\\]/u.test(file.name)) bad('첨부파일 이름을 확인해 주세요.');
    if (typeof file.data !== 'string' || file.data.length > 2796204 || file.data.length % 4 !== 0) bad('첨부파일 인코딩을 확인해 주세요.');
    const bytes = Buffer.from(file.data, 'base64');
    if (!bytes.length || bytes.length > 2 * 1024 * 1024 || bytes.toString('base64') !== file.data) bad('파일별 용량은 1바이트 이상, 2 MiB 이하입니다.');
    const extension = file.name.split('.').pop().toLowerCase();
    let mediaType;
    if (['md','txt'].includes(extension)) {
      let text;
      try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch { bad('텍스트 첨부는 UTF-8 형식이어야 합니다.'); }
      if (text.includes('\0')) bad('바이너리 파일은 텍스트로 첨부할 수 없습니다.');
      mediaType = extension === 'md' ? 'text/markdown' : 'text/plain';
    } else if (extension === 'pdf' && bytes.subarray(0,5).equals(Buffer.from('%PDF-'))) mediaType = 'application/pdf';
    else if (extension === 'png' && bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) mediaType = 'image/png';
    else if (['jpg','jpeg'].includes(extension) && bytes.subarray(0,3).equals(Buffer.from([255,216,255]))) mediaType = 'image/jpeg';
    else bad('실제 내용과 확장자가 일치하는 PDF, PNG, JPEG, MD, TXT 파일만 첨부할 수 있습니다.');
    return { name: file.name, mediaType, bytes, sha256: sha256(bytes) };
  });
  const hash = sha256(JSON.stringify({ ...fields, consent: input.consent, attachments: attachments.map(({ bytes, ...meta }) => ({ ...meta, size: bytes.length })) }));
  return { fields, attachments, hash };
}

export async function ownedTransaction(pool, owner, action) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('standard.owner_hash',$1,true)", [owner]);
    const result = await action(client);
    await client.query('COMMIT');
    return result;
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}
const receipt = row => ({ id: row.id, receivedAt: row.received_at, status: 'received' });

export async function saveSubmission(pool, owner, key, normalized, ipBucket) {
  return ownedTransaction(pool, owner, async client => {
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [`${owner}:${key}`]);
    const previous = (await client.query('SELECT id, received_at, request_hash FROM submissions WHERE owner_hash=$1 AND request_key=$2', [owner,key])).rows[0];
    if (previous) {
      if (previous.request_hash !== normalized.hash) throw new HttpError(409, '같은 요청 키로 다른 내용을 접수할 수 없습니다. 기존 접수 상태를 먼저 확인해 주세요.');
      return { receipt: receipt(previous), replayed: true };
    }
    // Count only committed new submissions; retries and failed transactions consume no quota.
    for (const [bucket, limit] of [['all',100], [ipBucket,10]]) {
      const { rows } = await client.query(`INSERT INTO submission_limits(bucket,starts_at,count) VALUES ($1, date_trunc('day', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC',1)
        ON CONFLICT(bucket) DO UPDATE SET starts_at=EXCLUDED.starts_at,
        count=CASE WHEN submission_limits.starts_at < EXCLUDED.starts_at THEN 1 ELSE submission_limits.count+1 END
        WHERE submission_limits.starts_at < EXCLUDED.starts_at OR submission_limits.count < $2 RETURNING count`, [bucket,limit]);
      if (!rows.length) throw new HttpError(429, '오늘의 접수 한도에 도달했습니다. 나중에 다시 시도하거나 GitHub 이슈로 제안해 주세요.');
    }
    await client.query("DELETE FROM submission_limits WHERE starts_at < now() - interval '2 days'");
    const f = normalized.fields;
    const { rows } = await client.query(`INSERT INTO submissions(id,owner_hash,request_key,request_hash,domain,kind,source,title,role,context,rule,verification,reference_text,format,author,consent_version)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'2026-10-30') RETURNING id,received_at`,
    [randomUUID(),owner,key,normalized.hash,f.domain,f.kind,f.source,f.title,f.role,f.context,f.rule,f.check,f.references,f.format,f.author]);
    for (const [position, a] of normalized.attachments.entries()) {
      await client.query('INSERT INTO attachments(submission_id,position,name,media_type,bytes,sha256) VALUES ($1,$2,$3,$4,$5,$6)', [rows[0].id,position,a.name,a.mediaType,a.bytes,a.sha256]);
    }
    return { receipt: receipt(rows[0]), replayed: false };
  });
}

export async function reviewSubmission(pool, id, revision, status, note) {
  if (!UUID.test(id) || !Number.isInteger(revision) || revision < 0 || !['reviewing','accepted','declined'].includes(status) || typeof note !== 'string' || !note.trim() || note.length > 3000) throw new Error('Invalid review arguments');
  const { rows } = await pool.query('UPDATE submissions SET status=$3,review_note=$4,revision=revision+1 WHERE id=$1 AND revision=$2 RETURNING id,status,revision', [id,revision,status,note.trim()]);
  if (!rows.length) throw new HttpError(409, '접수 내역이 없거나 검토 버전이 바뀌었습니다.');
  return rows[0];
}

function json(res, status, body, extra = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extra });
  res.end(JSON.stringify(body));
}
async function readJSON(req) {
  if (!/^application\/json(?:;\s*charset=utf-8)?$/i.test(req.headers['content-type'] || '')) throw new HttpError(415, 'JSON 요청만 지원합니다.');
  if (req.headers['content-encoding'] || Number(req.headers['content-length']) > MAX_BODY) throw new HttpError(413, '요청 용량을 줄여 주세요.');
  const chunks = []; let length = 0;
  for await (const chunk of req) {
    length += chunk.length;
    if (length > MAX_BODY) throw new HttpError(413, '요청 용량을 줄여 주세요.');
    chunks.push(chunk);
  }
  try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks))); }
  catch { throw new HttpError(400, 'JSON 형식을 확인해 주세요.'); }
}
export function createAPI({ pool, origin, rateSecret, trustProxy = false }) {
  let activeWrites = 0;
  return async (req, res, path) => {
    const write = req.method === 'POST';
    if (write && activeWrites >= 8) { req.resume(); json(res,503,{error:'접수가 몰리고 있습니다. 같은 내용으로 잠시 후 다시 시도해 주세요.'},{'Retry-After':'5'}); return; }
    if (write) activeWrites++;
    res.setHeader('Cache-Control', 'no-store');
    try {
      if (!pool) throw new HttpError(503, '접수 시스템을 준비 중입니다. 잠시 후 다시 시도해 주세요.');
      if (path === '/api/library' || path.startsWith('/api/library/')) { await libraryRequest(pool,req,res); return; }
      if (path === '/api/health' && req.method === 'GET') { await checkSchema(pool); json(res,200,{ status:'ready' }); return; }
      if (req.method === 'POST' && req.headers.origin !== origin) throw new HttpError(403, '이 웹사이트에서 직접 제출해 주세요.');
      if (req.headers.origin && req.headers.origin !== origin) throw new HttpError(403, '허용되지 않은 출처입니다.');
      const token = /^Bearer ([a-f0-9]{64})$/.exec(req.headers.authorization || '')?.[1];
      if (!token) throw new HttpError(401, '접수 확인 키가 필요합니다.');
      const owner = sha256(token);
      if (path === '/api/contributions' && req.method === 'POST') {
        const key = req.headers['idempotency-key'];
        if (typeof key !== 'string' || !UUID.test(key)) throw new HttpError(400, '올바른 요청 키가 필요합니다.');
        const input = normalizeSubmission(await readJSON(req));
        const address = trustProxy ? req.headers['cf-connecting-ip'] : req.socket.remoteAddress;
        if (typeof address !== 'string' || !rateSecret) throw new HttpError(503, '접수 설정을 확인 중입니다.');
        const bucket = createHmac('sha256', rateSecret).update(address).digest('hex');
        const result = await saveSubmission(pool,owner,key.toLowerCase(),input,bucket);
        json(res,result.replayed ? 200 : 201,result.receipt,{ 'Idempotency-Replayed': String(result.replayed) }); return;
      }
      const match = /^\/api\/contributions\/(?:by-key\/)?([a-f0-9-]+)(?:\/attachments\/([0-2]))?$/.exec(path);
      if (match && UUID.test(match[1]) && req.method === 'GET') {
        const found = await ownedTransaction(pool, owner, async client => {
          const column = path.includes('/by-key/') ? 'request_key' : 'id';
          const row = (await client.query(`SELECT id,received_at,status,revision,review_note FROM submissions WHERE ${column}=$1 AND owner_hash=$2`, [match[1],owner])).rows[0];
          if (!row) throw new HttpError(404, '이 확인 키에 해당하는 접수가 없습니다.');
          if (match[2] !== undefined) {
            const a = (await client.query('SELECT name,media_type,bytes FROM attachments WHERE submission_id=$1 AND position=$2', [row.id,Number(match[2])])).rows[0];
            if (!a) throw new HttpError(404,'첨부파일을 찾을 수 없습니다.');
            return { attachment: a };
          }
          const attachments = (await client.query('SELECT position,name,media_type,octet_length(bytes) AS size,sha256 FROM attachments WHERE submission_id=$1 ORDER BY position', [row.id])).rows;
          return { id: row.id, receivedAt: row.received_at, status: row.status, revision: row.revision, reviewNote: row.review_note, attachments };
        });
        if (found.attachment) {
          const a = found.attachment;
          res.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Content-Disposition': `attachment; filename="attachment"; filename*=UTF-8''${encodeURIComponent(a.name).replace(/'/g,'%27')}`, 'Content-Length': a.bytes.length }); res.end(a.bytes);
        } else json(res,200,found);
        return;
      }
      throw new HttpError(404, '지원하지 않는 접수 경로입니다.');
    } catch (error) {
      if (!(error instanceof HttpError)) console.error('Contribution request failed:', /^[0-9A-Z]{5}$/.test(error.code || '') ? error.code : error.name);
      req.resume();
      json(res,error.status || 503,{ error: error.status ? error.message : '지금은 접수 결과를 확인할 수 없습니다. 같은 내용으로 다시 시도해 주세요.' });
    } finally { if (write) activeWrites--; }
  };
}
