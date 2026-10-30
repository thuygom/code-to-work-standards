import pg from 'pg';
import { writeFile } from 'node:fs/promises';
import { reviewSubmission } from './contribution_api.mjs';
import { publishSubmission, withdrawPublication } from './library.mjs';

if (!process.env.MIGRATION_DATABASE_URL) throw new Error('Use the operator database credential');
const pool = new pg.Pool({ connectionString: process.env.MIGRATION_DATABASE_URL });
const [command,id,revision,status,...note] = process.argv.slice(2);
try {
  if (command === 'list') console.log(JSON.stringify((await pool.query('SELECT id,title,domain,format,status,revision,received_at FROM submissions ORDER BY received_at DESC LIMIT 100')).rows,null,2));
  else if (command === 'show') {
    const rows = (await pool.query('SELECT id,title,domain,format,source,author,role,context,rule,verification,reference_text,status,revision,review_note FROM submissions WHERE id=$1',[id])).rows;
    const files = (await pool.query('SELECT position,name,media_type,octet_length(bytes) AS size,sha256 FROM attachments WHERE submission_id=$1 ORDER BY position',[id])).rows;
    console.log(JSON.stringify({ submissions:rows, attachments:files },null,2));
  } else if (command === 'review') console.log(await reviewSubmission(pool,id,Number(revision),status,note.join(' ')));
  else if (command === 'publish') { await publishSubmission(pool,id,revision ? revision.split(',').map(Number) : []); console.log('Published'); }
  else if (command === 'withdraw') { await withdrawPublication(pool,id); console.log('Withdrawn'); }
  else if (command === 'attachment') {
    if (!status) throw new Error('Usage: attachment <id> <position> <output-file>');
    const row = (await pool.query('SELECT bytes FROM attachments WHERE submission_id=$1 AND position=$2',[id,Number(revision)])).rows[0];
    if (!row) throw new Error('Attachment not found');
    await writeFile(status,row.bytes,{ flag:'wx', mode:0o600 }); console.log('Saved');
  } else throw new Error('Commands: list | show ID | review ID REVISION STATUS NOTE | publish ID [0,1,2] | withdraw ID | attachment ID POSITION OUTPUT');
} finally { await pool.end(); }
