# 코드에서 확인한 출발점

확인 기준일은 2026-10-30 KST입니다. 정적 문서·코드 열람이며 운영 호출과 현업 품질 검증은 수행하지 않았습니다. 원본 저장소는 접근 권한이 필요할 수 있습니다. 이 공개 프로젝트는 원본 애플리케이션 소스를 재배포하지 않습니다.

| 대상 | 확인 범위 | SOP에 연결할 질문 |
|---|---|---|
| IScribe | 완성 음성·청크 음성, 전사·화자, 노트와 별도 회의록 생성 | 중간 전사·최종 분석·현업 수용은 각각 언제인가? |
| writingAgent | 분석·답장 모드, 인물·요약·업무·일정, 수정 범위와 완료 후보 | 요청·합의·완료, 대상·기한·버전 보호를 어떻게 판정하는가? |
| GomCrawl / webSearchAgent | 검색·connector·수집과 공통 EvidenceRecord | 검색 발췌와 실제 근거, 자료의 독립성·최신성을 어떻게 확인하는가? |
| TieRPT | 기업 자료 수집·분석·작성·검증 | 인용 존재와 의미적 지지, 사실 리포트와 제품 연결을 어떻게 구분하는가? |

## 근거 링크

- IScribe: [README](https://github.com/thuygom/IScribe/blob/master/README.md), [audio_analysis](https://github.com/thuygom/IScribe/blob/master/cowork/audio_analysis_latest.md), [pre_audio_analysis](https://github.com/thuygom/IScribe/blob/master/cowork/pre_audio_analysis_latest.md)
- writingAgent: [analyze_text](https://github.com/thuygom/writingAgent/blob/master/cowork/analyze_text_latest.md), [text_refine](https://github.com/thuygom/writingAgent/blob/master/cowork/text_refine_latest.md)
- GomCrawl: [README](https://github.com/thuygom/GomCrawl/blob/a519ea5935a8f66876105fcf272f4cfb91389905/README.md), [news_quality](https://github.com/thuygom/GomCrawl/blob/a519ea5935a8f66876105fcf272f4cfb91389905/core/news_quality.py)
- TieRPT: [품질 설계](https://github.com/thuygom/TieRPT/blob/255fb5239baf421fdae49384fade44ae016a2faa/docs/quality-v2.md), [검증 코드](https://github.com/thuygom/TieRPT/blob/255fb5239baf421fdae49384fade44ae016a2faa/tierpt/report.py), [v3 문서](https://github.com/thuygom/TieRPT/blob/255fb5239baf421fdae49384fade44ae016a2faa/docs/report-v3.md), [quality](https://github.com/thuygom/TieRPT/blob/255fb5239baf421fdae49384fade44ae016a2faa/tierpt/quality.py)

GomCrawl과 TieRPT는 위 링크의 commit으로 고정했습니다. IScribe와 writingAgent의 master 링크는 이후 변경될 수 있습니다. 다음 관찰에서 [코드 근거 양식](../templates/code-evidence.md)에 확인한 commit을 새로 기록합니다. 배포 여부와 품질 성과는 별도 근거가 필요합니다.

## 해석상 중요한 경계

1. 중간 청크의 success가 완성된 회의록을 뜻하지 않습니다.
2. 답장 초안과 일반 노트 분석은 목적과 출력이 다를 수 있습니다.
3. 기사 관계가치(축하·안부·대화 소재)는 고객의 구매 니즈 확인과 다릅니다.
4. 인용 구절·숫자 포함 검사는 주장의 의미적 타당성을 완전히 보장하지 않습니다.
5. 자사제품의 승인 기능과 고객 근거를 연결하는 전용 업무는 이번 검증 대상인 제안입니다.

## 방법론 참고

- [US EPA — Guidance for Preparing Standard Operating Procedures](https://www.epa.gov/sites/default/files/2015-06/documents/g6-final.pdf): 반복 업무의 절차·검토·재현·개정 원칙을 참고했습니다.
- [GOV.UK — Contextual research and observation](https://www.gov.uk/service-manual/user-research/contextual-research-and-observation): 실제 자료·도구를 사용한 수행과 판단 이유 관찰을 참고했습니다.
- [NASA — How to Write a Good Requirement](https://www.nasa.gov/reference/appendix-c-how-to-write-a-good-requirement/): 명확하고 추적·검증 가능한 요구사항 원칙을 참고했습니다.
- [Anthropic — Building effective agents](https://www.anthropic.com/research/building-effective-agents): 정해진 워크플로와 동적 판단의 구분에 관한 개념을 참고했습니다.

외부 자료는 방법론 근거입니다. 이 프로젝트의 효과를 검증한 자료가 아닙니다.
