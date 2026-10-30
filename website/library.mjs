import MarkdownIt from './vendor/markdown-it.mjs';
import { renderDocument } from './render-markdown.mjs';
import { DOMAINS, FORMATS } from './contribution.mjs';
const $ = selector => document.querySelector(selector);
for (const [id,name] of Object.entries(FORMATS)) $('#library-format').add(new Option(name,id));
for (const d of DOMAINS) $('#library-domain').add(new Option(d.name,d.id));
let offset = 0;
let generation = 0;
let reading;
let previousFocus;
function element(tag,text,className) {
  const el = document.createElement(tag); el.textContent = text;
  if (className) el.className = className;
  return el;
}
async function loadLibrary(more = false) {
  const run = ++generation;
  if (!more) { offset = 0; $('#library-grid').replaceChildren(); }
  $('#library-status').textContent = '공개 자료를 불러오는 중입니다…';
  $('#library-more').disabled = true;
  const params = new URLSearchParams({ q:$('#library-query').value, format:$('#library-format').value, domain:$('#library-domain').value, offset });
  try {
    const response = await fetch(`/api/library?${params}`);
    const data = await response.json();
    if (run !== generation) return;
    if (!response.ok) throw new Error(data.error);
    for (const item of data.items) {
      const card = element('article','', 'library-card');
      const domain = DOMAINS.find(d => d.id === item.domain)?.name || item.domain;
      const button = element('button','읽고 가져가기 ↗','text-link');
      button.addEventListener('click',() => openReading(item.id));
      card.append(element('span',FORMATS[item.format],'pill'),element('h3',item.title),element('p',`${domain} · ${item.author || '익명 기여자'}`),element('span',item.source === 'synthetic' ? '합성 사례 · 현업 검증 전' : item.source === 'reference' ? '문서·코드 기반 · 현업 검증 전' : '공개용 가공 자료 · 적용 범위 확인','eyebrow'),button);
      $('#library-grid').append(card);
    }
    offset += data.items.length;
    $('#library-status').textContent = data.total ? `${data.total}개 자료 중 ${offset}개를 보고 있습니다.` : '아직 이 조건의 공개 자료가 없습니다. 첫 자료를 나눠 주세요.';
    $('#library-more').hidden = offset >= data.total;
  } catch { if (run === generation) { $('#library-status').textContent = '자료를 불러오지 못했습니다. 잠시 후 찾기를 눌러 다시 시도해 주세요.'; $('#library-more').hidden = true; } }
  finally { $('#library-more').disabled = false; }
}
$('#library-search').addEventListener('submit', e => { e.preventDefault(); void loadLibrary(); });
for (const id of ['#library-format','#library-domain']) $(id).addEventListener('change', () => void loadLibrary());
$('#library-more').addEventListener('click',() => void loadLibrary(true));
async function openReading(id) {
  try {
    const response = await fetch(`/api/library/${encodeURIComponent(id)}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    reading = data;
    $('#reading-title').textContent = data.title;
    $('#reading-meta').textContent = `${FORMATS[data.format]} / ${DOMAINS.find(d => d.id === data.domain)?.name || data.domain}`;
    $('#reading-credit').textContent = `${data.author || '익명 기여자'} · ${data.published_at.slice(0,10)} 공개 · 신규 기여 MIT / 외부 출처 권리 유지`;
    $('#reading-body').innerHTML = renderDocument(MarkdownIt,data.body);
    $('#reading-status').textContent = '내 업무에 적용하기 전 근거·예외·검증 상태를 확인해 주세요.';
    $('#reading-download').href = `/api/library/${data.id}/markdown`;
    $('#reading-files').replaceChildren(...data.attachments.map(file => {
      const link = element('a',`${file.name} ↓ (${Math.ceil(file.size / 1024)} KB)`,'button button-paper');
      link.href = `/api/library/${data.id}/attachments/${file.position}`;
      return link;
    }));
    previousFocus = document.activeElement;
    $('#reading-dialog').showModal();
    const url = new URL(location.href); url.searchParams.set('contribution',data.id); history.replaceState(null,'',url);
  } catch (error) { $('#library-status').textContent = error.message || '자료를 열지 못했습니다.'; }
}
$('#close-reading').addEventListener('click',() => $('#reading-dialog').close());
$('#reading-dialog').addEventListener('close',() => {
  const url = new URL(location.href); url.searchParams.delete('contribution'); history.replaceState(null,'',url); previousFocus?.focus();
});
$('#share-reading').addEventListener('click',async () => {
  const link = `${location.origin}/?contribution=${reading.id}`;
  try { await navigator.clipboard.writeText(link); $('#reading-status').textContent = '자료 링크를 복사했습니다.'; }
  catch { $('#reading-status').textContent = `링크를 복사해 주세요: ${link}`; }
});
void loadLibrary();
const requested = new URL(location.href).searchParams.get('contribution');
if (requested) void openReading(requested);
