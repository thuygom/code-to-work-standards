export const REPO = 'https://github.com/thuygom/code-to-work-standards';
export const DOMAINS = [
  { id: 'notes', name: '노트·회의록', status: 'draft', code: 'N / NOTES', icon: 'notes', description: '제안과 결정 사이의 차이. 담당자, 기한, 후속 행동까지 놓치지 않는 기록.', keywords: '기획 PM 행정 회의 기록', path: 'workflows/notes/README.md' },
  { id: 'company-analysis', name: '기업·영업 분석', status: 'draft', code: 'B / RESEARCH', icon: 'chart', description: '출처가 있는 사실에서 고객의 문제로. 제품의 적합성과 다음 영업 행동까지.', keywords: '영업 마케팅 리서치 기업 제품 금융', path: 'workflows/company-analysis/README.md' },
  { id: 'people', name: '인사·조직', status: 'proposal', icon: 'people', description: '채용, 온보딩, 조직 운영. 사람에 대한 판단에서 놓치면 안 되는 기준은 무엇일까요?', keywords: 'HR 인사 채용 조직 노무' },
  { id: 'healthcare', name: '의료·연구', status: 'proposal', icon: 'cross', description: '불확실성을 드러내는 기록과 근거 검토. 현장의 판단을 함께 정리해 주세요.', keywords: '의료 보건 연구 간호 임상 실험' },
  { id: 'education', name: '교육·콘텐츠', status: 'proposal', icon: 'book', description: '학습 목표, 피드백, 콘텐츠 검토. 좋은 설명과 평가를 가르는 경험을 모읍니다.', keywords: '교육 교사 학습 디자인 편집 콘텐츠' },
  { id: 'operations', name: '제조·운영', status: 'proposal', icon: 'box', description: '품질 확인부터 예외 처리와 인계까지. 실제로 일이 끝났다고 판단하는 기준.', keywords: '제조 운영 물류 품질 고객 지원 CS 생산' },
  { id: 'other', name: '다른 분야 / 새 업무', status: 'proposal', keywords: '기타 법무 회계 금융 재무 건설 공공' },
];
export const KINDS = { observation: '현업 사례·수정 이유', improvement: '판단 규칙·반례', 'new-domain': '새 업무군 제안', documentation: '문서·번역 개선' };
export const FORMATS = { experience: '현업 경험', insight: '인사이트', mow: 'MoW · 업무 지도', prd: 'PRD · 요구사항', sop: 'SOP · 업무 절차', bundle: '자료 묶음' };
export const LIMITS = { title: 100, role: 80, author: 80, context: 12000, rule: 3000, check: 3000, references: 500 };

export function matchingDomains(filter, query) {
  const term = query.trim().toLocaleLowerCase();
  return DOMAINS.filter(d => d.id !== 'other' && (filter === 'all' || d.status === filter) && `${d.name} ${d.description} ${d.keywords}`.toLocaleLowerCase().includes(term));
}

export function buildContribution(input) {
  const domain = DOMAINS.find(d => d.id === input.domain);
  if (!domain || !Object.hasOwn(KINDS, input.kind) || !['real', 'synthetic', 'reference'].includes(input.source)) throw new Error('분야, 기여 유형과 사례 구분을 확인해 주세요.');
  const values = {};
  for (const [key, limit] of Object.entries(LIMITS)) {
    values[key] = String(input[key] ?? '').trim();
    if (values[key].length > limit) throw new Error(`${key}: 최대 ${limit}자까지 입력할 수 있습니다.`);
    if (!['references','author'].includes(key) && !values[key]) throw new Error('필수 항목에 공백이 아닌 내용을 입력해 주세요.');
  }
  if (!Object.hasOwn(FORMATS, input.format || 'experience')) throw new Error('자료 종류를 확인해 주세요.');
  const title = `[${KINDS[input.kind]}] ${values.title.replace(/[\r\n]/g, ' ')}`;
  const body = `## 업무와 기여 유형\n\n- 분야: ${domain.name}\n- 자료 종류: ${FORMATS[input.format || 'experience']}\n- 기여자: ${values.author || '익명 기여자'}\n- 역할 / 제안 분야: ${values.role}\n- 유형: ${KINDS[input.kind]}\n- 사례: ${input.source === 'synthetic' ? 'synthetic · 합성 사례 · 미실행' : input.source === 'reference' ? 'reference · 문서·코드 기반 정리 · 현업 검증 전' : 'real · 실제 사례의 공개 가능한 가공본'}\n- 상태: 제안 · 채택 및 비교 평가 전\n\n## 상황과 수정한 부분\n\n${values.context}\n\n## 바뀌어야 할 규칙과 이유\n\n${values.rule}\n\n## 확인 방법과 아직 모르는 점\n\n${values.check}\n\n## 관련 문서·단계 ID\n\n${values.references || '미지정 · 검토 시 연결 필요'}\n\n## 공개 및 기여 조건\n\n- 공개할 권한이 있는 자료이며 민감 정보와 평가 전 보류 사례를 포함하지 않았습니다.\n- 새로 작성한 기여는 MIT License로 제공하며 외부 출처의 권리를 유지합니다.\n- 현업 채택, 평가 결과, 구현·배포는 별도 확인이 필요합니다.\n`;
  const url = new URL(`${REPO}/issues/new`);
  url.searchParams.set('title', title);
  url.searchParams.set('body', body);
  // shortcut: browsers/proxies differ on URL limits; long drafts use explicit copy/paste.
  const needsCopy = url.href.length > 7000;
  if (needsCopy) url.searchParams.delete('body');
  return { title, body, url: url.href, needsCopy };
}

export function decodeFile(name, bytes) {
  if (!/\.(md|txt)$/i.test(name)) throw new Error('.md 또는 .txt 파일을 선택해 주세요. PDF·이미지는 GitHub에서 첨부할 수 있습니다.');
  if (bytes.byteLength > 65536) throw new Error('파일은 64 KB 이하로 준비해 주세요.');
  let content;
  try { content = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
  catch { throw new Error('UTF-8 텍스트 파일로 저장한 뒤 다시 선택해 주세요.'); }
  if (content.includes('\0')) throw new Error('텍스트 파일만 불러올 수 있습니다.');
  if (!content.trim()) throw new Error('파일이 비어 있습니다.');
  if (content.length > LIMITS.context) throw new Error('사례는 12,000자 이내로 정리해 주세요.');
  return content;
}
