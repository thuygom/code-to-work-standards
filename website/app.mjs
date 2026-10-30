import { REPO, DOMAINS, FORMATS, matchingDomains, buildContribution, decodeFile, LIMITS } from './contribution.mjs';

import './library.mjs';

const $ = selector => document.querySelector(selector);
const dialog = $('#contribution-dialog');
const form = $('#contribution-form');
const fields = form.elements;
const paths = {
  notes: '<path d="M6 3h9l4 4v14H6zM14 3v5h5M9 12h7M9 16h7"/>',
  chart: '<path d="M4 4v16h17M8 16v-5M13 16V7M18 16V3"/>',
  people: '<circle cx="9" cy="8" r="3"/><path d="M3 21v-4a6 6 0 0 1 12 0v4M16 5a3 3 0 0 1 0 6M18 14a5 5 0 0 1 3 5v2"/>',
  cross: '<path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z"/>',
  book: '<path d="M12 5v16M3 3c4-1 7 0 9 2 2-2 5-3 9-2v16c-4-1-7 0-9 2-2-2-5-3-9-2z"/>',
  box: '<path d="m3 7 9-4 9 4v11l-9 4-9-4zM3 7l9 4 9-4M12 11v11M7 5l10 5v4"/>',
};
let activeFilter = 'all';
let draft;
let copied = false;
let opener;

for (const [id, name] of Object.entries(FORMATS)) fields.format.add(new Option(name, id));
for (const domain of DOMAINS) fields.domain.add(new Option(domain.name, domain.id));

function renderCards() {
  const domains = matchingDomains(activeFilter, $('#search').value);
  $('#work-grid').replaceChildren(...domains.map(domain => {
    const card = document.createElement('article');
    card.className = `work-card ${domain.status}`;
    // Only the fixed, repository-owned domain catalog is rendered as markup.
    card.innerHTML = `<div class="card-top"><span class="work-icon" aria-hidden="true"><svg viewBox="0 0 24 24">${paths[domain.icon]}</svg></span><span class="pill">${domain.status === 'draft' ? '초안 공개 · 검증 전' : '새 업무 제안 환영'}</span></div><h3>${domain.name}</h3><p>${domain.description}</p><div class="card-bottom">${domain.path ? `<a href="${REPO}/blob/master/${domain.path}" target="_blank" rel="noopener noreferrer">업무 문서 읽기 ↗</a>` : '<span class="card-code">OPEN CALL</span>'}<button data-contribute="${domain.id}">${domain.path ? '사례 나누기' : '첫 기준 제안하기'} ↗</button></div>`;
    return card;
  }));
  $('#empty-state').hidden = domains.length !== 0;
  $('#search-status').textContent = `${domains.length}개 분야를 찾았습니다.`;
}
$('#search').addEventListener('input', renderCards);
document.querySelectorAll('[data-filter]').forEach(button => button.addEventListener('click', () => {
  activeFilter = button.dataset.filter;
  document.querySelectorAll('[data-filter]').forEach(item => {
    item.classList.toggle('active', item === button);
    item.setAttribute('aria-pressed', String(item === button));
  });
  renderCards();
}));
renderCards();

function showStep(review) {
  $('#write-step').hidden = review;
  $('#review-step').hidden = !review;
  $('#progress-write').toggleAttribute('aria-current', !review);
  $('#progress-review').toggleAttribute('aria-current', review);
  (review ? $('#progress-review') : $('#progress-write')).setAttribute('aria-current', 'step');
  dialog.scrollTop = 0;
  if (review) $('#contribution-preview').focus();
  else fields.title.focus();
}
document.addEventListener('click', event => {
  const button = event.target.closest('[data-contribute]');
  if (!button) return;
  opener = button;
  const domain = DOMAINS.find(d => d.id === button.dataset.contribute);
  if (domain) {
    fields.domain.value = domain.id;
    fields.kind.value = domain.status === 'proposal' ? 'new-domain' : 'observation';
  }
  form.hidden = false; $('#receipt-panel').hidden = true;
  dialog.showModal();
  showStep(false);
});
$('#close-dialog').addEventListener('click', () => dialog.close());
dialog.addEventListener('close', () => opener?.focus());
fields.domain.addEventListener('change', () => {
  if (DOMAINS.find(d => d.id === fields.domain.value).status === 'proposal') fields.kind.value = 'new-domain';
});

async function importFile(file) {
  if (!file) return;
  try {
    if (file.size > 65536) throw new Error('파일은 64 KB 이하로 준비해 주세요.');
    const text = decodeFile(file.name, await file.arrayBuffer());
    const combined = fields.context.value ? `${fields.context.value}\n\n${text}` : text;
    if (combined.length > LIMITS.context) throw new Error('기존 내용과 합쳐 12,000자를 넘습니다. 내용을 줄인 뒤 다시 선택해 주세요.');
    fields.context.value = combined;
    $('#file-status').textContent = `${file.name} 내용을 사례에 추가했습니다. 서버에 업로드하지 않았습니다.`;
    fields.context.focus();
  } catch (error) { $('#file-status').textContent = error.message; }
  finally { $('#file-input').value = ''; }
}
$('#file-input').addEventListener('change', event => importFile(event.target.files[0]));
const drop = $('#file-drop');
drop.addEventListener('dragover', event => { event.preventDefault(); drop.classList.add('dragover'); });
drop.addEventListener('dragleave', () => drop.classList.remove('dragover'));
drop.addEventListener('drop', event => {
  event.preventDefault(); drop.classList.remove('dragover');
  if (event.dataTransfer.files.length !== 1) { $('#file-status').textContent = '파일을 한 번에 하나씩 선택해 주세요.'; return; }
  importFile(event.dataTransfer.files[0]);
});

let submissionInput;
let busy = false;
let savedReceipt;
try { savedReceipt = JSON.parse(sessionStorage.getItem('standard-receipt') || 'null'); } catch {}
form.addEventListener('submit', async event => {
  event.preventDefault();
  try {
    submissionInput = Object.fromEntries(new FormData(form));
    submissionInput.attachments = await collectAttachments();
    submissionInput.consent = '2026-10-30';
    draft = buildContribution(submissionInput);
    copied = false;
    $('#privacy-check').checked = false;
    $('#license-check').checked = false;
    $('#contribution-preview').textContent = `${draft.title}\n\n${draft.body}\n첨부: ${submissionInput.attachments.map(f => f.name).join(', ') || '없음'}`;
    $('#submit-status').textContent = '웹에서 접수하면 확인 번호가 발급됩니다. 공개 검토 후 다른 사람이 자료를 가져갈 수 있습니다.';
    showStep(true);
  } catch (error) { $('#file-status').textContent = error.message; $('#file-status').scrollIntoView({ block: 'center' }); }
});
$('#back-to-write').addEventListener('click', () => showStep(false));
$('#copy-draft').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(draft.body);
    copied = true;
    $('#submit-status').textContent = '본문을 복사했습니다. GitHub에서 본문을 확인하거나 붙여 넣고 최종 제출해 주세요.';
  } catch {
    const range = document.createRange();
    range.selectNodeContents($('#contribution-preview'));
    const selection = window.getSelection();
    selection.removeAllRanges(); selection.addRange(range);
    $('#submit-status').textContent = '자동 복사가 허용되지 않았습니다. 선택된 내용을 직접 복사하거나 .md 파일을 저장해 주세요.';
  }
});
$('#download-draft').addEventListener('click', () => {
  const url = URL.createObjectURL(new Blob([`# ${draft.title}\n\n${draft.body}`], { type: 'text/markdown;charset=utf-8' }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'work-standard-contribution.md';
  anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  $('#submit-status').textContent = '초안을 .md 파일로 저장했습니다. 아직 기여가 접수된 것은 아닙니다.';
});
$('#contribution-preview').addEventListener('copy', () => { copied = true; });
$('#open-github').addEventListener('click', () => {
  if (!$('#privacy-check').checked || !$('#license-check').checked) {
    $('#submit-status').textContent = '공개 자료와 라이선스 조건을 모두 확인해 주세요.';
    (!$('#privacy-check').checked ? $('#privacy-check') : $('#license-check')).focus(); return;
  }
  if (draft.needsCopy && !copied) {
    $('#submit-status').textContent = '긴 글은 자동 전달되지 않습니다. 먼저 본문 복사를 눌러 주세요.';
    $('#copy-draft').focus(); return;
  }
  window.open(draft.url, '_blank', 'noopener,noreferrer');
  $('#submit-status').textContent = draft.needsCopy ? 'GitHub 작성 화면에서 복사한 본문을 붙여 넣고 제출해 주세요. 팝업이 막혔다면 브라우저에서 허용해 주세요.' : 'GitHub에서 최종 제출해 주세요. 팝업이 막혔다면 브라우저에서 허용해 주세요. 이 창의 초안은 유지됩니다.';
});

async function collectAttachments() {
  const files = [...$('#attachments').files];
  if (files.length > 3) throw new Error('첨부파일은 최대 3개입니다.');
  return Promise.all(files.map(file => {
    if (!file.size || file.size > 2 * 1024 * 1024) throw new Error('첨부파일은 각각 2 MiB 이하이며 비어 있지 않아야 합니다.');
    return new Promise((resolve,reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve({ name:file.name, data:String(reader.result).split(',')[1] });
      reader.onerror = () => reject(new Error('첨부파일을 읽을 수 없습니다.'));
      reader.readAsDataURL(file);
    });
  }));
}
function download(name,content,type) {
  const url = URL.createObjectURL(new Blob([content],{ type }));
  const link = document.createElement('a'); link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url),1000);
}
function keepReceipt() {
  try { sessionStorage.setItem('standard-receipt',JSON.stringify(savedReceipt)); } catch {}
}
function showReceipt() {
  form.hidden = true; $('#receipt-panel').hidden = false;
  if (!dialog.open) dialog.showModal();
  $('#receipt-status').textContent = savedReceipt ? '접수 상태를 확인하는 중입니다…' : '이 탭에 저장된 접수가 없습니다. 보관한 접수 확인 파일을 페이지 아래에서 불러와 주세요.';
  $('#save-receipt').disabled = !savedReceipt;
  $('#refresh-receipt').disabled = !savedReceipt;
  if (savedReceipt) void refreshReceipt();
}
async function refreshReceipt() {
  try {
    const key = savedReceipt.id || `by-key/${savedReceipt.key}`;
    const response = await fetch(`/api/contributions/${key}`,{ headers:{ Authorization:`Bearer ${savedReceipt.token}` } });
    const result = await response.json();
    if (!response.ok) throw new Error(response.status === 404 ? '아직 접수가 확인되지 않았습니다. 원래 내용으로 다시 제출해 주세요.' : result.error);
    savedReceipt.id = result.id; keepReceipt();
    const names = { received:'접수 완료 · 검토 대기', reviewing:'검토 중', accepted:'검토 수용 · 공개 여부는 별도 결정', declined:'보류·반려' };
    $('#receipt-status').textContent = `${names[result.status]}\n접수 번호: ${result.id}\n접수 시각: ${new Date(result.receivedAt).toLocaleString('ko-KR')}\n첨부: ${result.attachments.map(f => f.name).join(', ') || '없음'}${result.reviewNote ? `\n검토 의견: ${result.reviewNote}` : ''}`;
  } catch (error) { $('#receipt-status').textContent = error.message || '조회에 실패했습니다. 다시 시도해 주세요.'; }
}
$('#submit-web').addEventListener('click',async () => {
  if (busy) return;
  if (!$('#privacy-check').checked || !$('#license-check').checked) {
    $('#submit-status').textContent = '공개 자료와 라이선스 조건을 모두 확인해 주세요.';
    (!$('#privacy-check').checked ? $('#privacy-check') : $('#license-check')).focus(); return;
  }
  busy = true;
  for (const el of dialog.querySelectorAll('button')) el.disabled = true;
  $('#submit-status').textContent = '기여와 첨부파일을 접수하고 있습니다…';
  try {
    const payload = JSON.stringify(submissionInput);
    const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(payload)))].map(b => b.toString(16).padStart(2,'0')).join('');
    if (!savedReceipt || savedReceipt.digest !== digest) {
      savedReceipt = { version:1, token:[...crypto.getRandomValues(new Uint8Array(32))].map(b => b.toString(16).padStart(2,'0')).join(''), key:crypto.randomUUID(), digest };
      keepReceipt();
    }
    const response = await fetch('/api/contributions',{ method:'POST',headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${savedReceipt.token}`, 'Idempotency-Key':savedReceipt.key },body:payload,signal:AbortSignal.timeout(30000) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error);
    savedReceipt.id = result.id; keepReceipt(); showReceipt();
  } catch (error) {
    $('#submit-status').textContent = `${error.name === 'TimeoutError' || error instanceof TypeError ? '접수 응답을 확인하지 못했습니다.' : error.message} 같은 내용으로 다시 누르면 중복 저장 없이 확인합니다. 이 탭에서 원고를 유지하거나 .md로 저장해 주세요.`;
  } finally {
    busy = false;
    for (const el of dialog.querySelectorAll('button')) el.disabled = false;
  }
});
dialog.addEventListener('cancel',event => { if (busy) event.preventDefault(); });
$('#my-receipt').addEventListener('click',showReceipt);
$('#refresh-receipt').addEventListener('click',refreshReceipt);
$('#save-receipt').addEventListener('click',() => {
  if (savedReceipt) download(`standard-receipt-${savedReceipt.id || savedReceipt.key}.json`,JSON.stringify(savedReceipt,null,2),'application/json');
});
$('#new-contribution').addEventListener('click',() => { form.hidden = false; $('#receipt-panel').hidden = true; form.reset(); showStep(false); });
$('#load-receipt').addEventListener('change',async event => {
  const file = event.target.files[0];
  if (!file) return;
  try {
    if (file.size > 4096) throw new Error('올바른 접수 확인 파일을 선택해 주세요.');
    const value = JSON.parse(await file.text());
    if (value.version !== 1 || !/^[a-f0-9]{64}$/.test(value.token) || !/^[a-f0-9-]{36}$/.test(value.key) || (value.id && !/^[a-f0-9-]{36}$/.test(value.id))) throw new Error('올바른 접수 확인 파일을 선택해 주세요.');
    savedReceipt = { version:1,token:value.token,key:value.key,id:value.id,digest:value.digest }; keepReceipt(); showReceipt();
  } catch (error) { $('#library-status').textContent = error.message; $('#library-status').scrollIntoView({block:'center'}); }
  finally { event.target.value = ''; }
});
