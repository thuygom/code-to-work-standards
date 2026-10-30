import test from 'node:test';
import assert from 'node:assert/strict';
import { request } from 'node:http';
import { createSiteServer } from '../scripts/serve_website.mjs';

test('public server allows only built assets and rejects methods, traversal and private paths', async t => {
  const server = createSiteServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const home = await fetch(base);
  assert.equal(home.status, 200);
  assert.match(await home.text(), /당신이 고친 이유가/);
  assert.match(home.headers.get('content-security-policy'), /connect-src 'self'/);
  assert.equal((await fetch(base, { headers: { 'If-None-Match': home.headers.get('etag') } })).status, 304);
  for (const path of ['/.git/config', '/.env', '/local-deploy/cloudflared.yml', '/assets/', '/%2e%2e%2f.env']) {
    assert.equal((await fetch(base + path)).status, 404, path);
  }
  assert.equal((await fetch(base, { method: 'POST' })).status, 405);
  const head = await fetch(base + '/assets/hero.png', { method: 'HEAD' });
  assert.equal(head.status, 200);
  assert.equal(head.headers.get('content-type'), 'image/png');
  assert.equal(await head.text(), '');
  const malformed = await new Promise(resolve => {
    const req = request({ host: '127.0.0.1', port: server.address().port, path: '/%ZZ' }, res => { res.resume(); res.on('end', () => resolve(res.statusCode)); });
    req.end();
  });
  assert.equal(malformed, 400);
});
