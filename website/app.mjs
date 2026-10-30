import { REPO, DOMAINS, matchingDomains, buildContribution, decodeFile, LIMITS } from './contribution.mjs';

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

form.addEventListener('submit', event => {
  event.preventDefault();
  try {
    draft = buildContribution(Object.fromEntries(new FormData(form)));
    copied = false;
    $('#privacy-check').checked = false;
    $('#license-check').checked = false;
    $('#contribution-preview').textContent = `${draft.title}\n\n${draft.body}`;
    $('#submit-status').textContent = draft.needsCopy ? '긴 글입니다. 먼저 본문을 복사한 뒤, GitHub 이슈 본문에 붙여 넣어 주세요.' : 'GitHub 작성 화면에 제목과 본문이 자동으로 채워집니다.';
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
