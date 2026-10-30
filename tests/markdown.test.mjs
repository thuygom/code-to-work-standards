import test from 'node:test';
import assert from 'node:assert/strict';
import MarkdownIt from 'markdown-it';
import { renderDocument } from '../website/render-markdown.mjs';

test('shared documents render tables and links without HTML, image or script execution',() => {
  const html=renderDocument(MarkdownIt,'# 제목\n\n| 조건 | 결과 |\n|---|---|\n| 요청 | 미확정 |\n\n<script>alert(1)</script>\n\n[bad](javascript:alert(1))\n\n![private](https://example.test/track)\n\n[원문](https://example.test/path)\n\n[절차](sop.md)\n\nhttps://github.com/thuygom/code-to-work-standards/blob/master/workflows/notes/prd.md');
  assert.doesNotThrow(() => renderDocument(MarkdownIt,'[broken](https://[)'));
  assert.match(html,/<table>/); assert.match(html,/&lt;script&gt;/);
  assert.doesNotMatch(html,/<script|<img|href="javascript:/);
  assert.match(html,/rel="noopener noreferrer"/);
  assert.match(html,/href="https:\/\/github.com\/thuygom\/code-to-work-standards\/blob\/master\/workflows\/notes\/sop.md"/);
});
