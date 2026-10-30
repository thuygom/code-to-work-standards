import test from 'node:test';
import assert from 'node:assert/strict';
import { buildContribution, decodeFile, matchingDomains } from '../website/contribution.mjs';

const input = { domain: 'notes', kind: 'observation', source: 'synthetic', role: '기획자', title: '요청과 수락 구분', context: '<script>alert(1)</script> 요청은 수락과 다릅니다.', rule: '상태를 분리합니다.', check: '수락 발화가 없는 반례로 확인합니다.', references: 'N01' };

test('Korean draft reaches the correct repository, preserves evidence state and treats text literally', () => {
  const draft = buildContribution(input);
  const url = new URL(draft.url);
  assert.equal(url.origin + url.pathname, 'https://github.com/thuygom/code-to-work-standards/issues/new');
  assert.equal(url.searchParams.get('body'), draft.body);
  assert.match(draft.body, /synthetic · 합성 사례 · 미실행/);
  assert.match(draft.body, /제안 · 채택 및 비교 평가 전/);
  assert.ok(draft.body.includes(input.context));
});

test('long Korean drafts use copy/paste without silently truncating content', () => {
  const draft = buildContribution({ ...input, context: '한'.repeat(5000) });
  assert.equal(draft.needsCopy, true);
  assert.equal(new URL(draft.url).searchParams.has('body'), false);
  assert.ok(draft.body.includes('한'.repeat(5000)));
});

test('submission validation covers missing fields, unknown choices and excessive input', () => {
  for (const invalid of [{ role: ' ' }, { domain: 'unknown' }, { kind: 'toString' }, { source: 'unverified' }, { title: 'a'.repeat(101) }]) {
    assert.throws(() => buildContribution({ ...input, ...invalid }));
  }
});

test('import accepts UTF-8 Markdown and rejects binary, oversized, empty and non-UTF-8 files', () => {
  const bytes = text => new TextEncoder().encode(text);
  assert.equal(decodeFile('사례.MD', bytes('공개 합성 사례')), '공개 합성 사례');
  for (const [name, data] of [['a.pdf', bytes('pdf')], ['a.txt', new Uint8Array(65537)], ['a.md', bytes(' ')], ['a.md', bytes('a\0b')], ['a.txt', new Uint8Array([255, 254])], ['a.txt', bytes('a'.repeat(12001))]]) {
    assert.throws(() => decodeFile(name, data));
  }
});

test('filters distinguish proposed domains from existing drafts and support search/empty states', () => {
  assert.equal(matchingDomains('draft', '').length, 2);
  assert.equal(matchingDomains('proposal', '').length, 4);
  assert.equal(matchingDomains('all', 'HR')[0].id, 'people');
  assert.equal(matchingDomains('all', 'no-such-workflow').length, 0);
});
