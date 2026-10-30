# 기여별 코드 근거 기록

Code to Work Standards는 독립적인 공개 기여 프로젝트입니다. 공통 문서는 특정 프로젝트의 구현·운영 상태를 전제로 삼지 않습니다. 노트·회의록과 기업·영업 분석은 작성 방식을 보여 주는 업무 초안이며, 특정 제품의 공식 사양이 아닙니다.

## 자신의 프로젝트에서 기여할 때

[코드 근거 카드](../templates/code-evidence.md)에 해당 기여의 범위를 기록합니다. 코드 공개는 필수가 아닙니다. 공개할 권한이 없는 저장소 이름·URL·내부 경로·원문은 넣지 않고, 판단 가능한 가공 설명과 한계를 남깁니다.

| 항목 | 기록할 내용 |
|---|---|
| 기여와 출처 | 관련 이슈·기여 ID, 공개가 허용된 프로젝트명·참조 또는 비공개 식별자 |
| 확인 범위 | 확인일, 소스 버전, 문서 읽기·정적 코드 확인·실행 중 실제 수행한 방법 |
| 확인한 동작 | 입력, 처리·분기, 출력, 오류·권한·저장 경계 |
| 업무 가설 | 동작에서 도출한 판단 규칙과 예외, 연결할 SOP·PRD ID |
| 남은 검증 | 실제 배포, 현업 수용, 품질·시간·비용 중 아직 확인하지 않은 내용 |

접수한 프로젝트를 공통 기준이나 공식 연동으로 자동 채택하지 않습니다. 관리자의 프로젝트에도 같은 기준을 적용합니다. 공개 출처를 사용하는 경우 권리자·라이선스 표기는 그대로 유지합니다.

## 공통적으로 구분할 것

1. 중간 처리 성공과 최종 업무 완료는 다릅니다.
2. 초안 생성과 발송·저장·인계 완료는 다릅니다.
3. 접촉 계기와 고객의 구매 니즈 확인은 다릅니다.
4. 인용 포함 검사와 주장의 의미적 타당성 판단은 다릅니다.
5. 정적 구현, 운영 실행, 현업 채택과 성능 측정은 각각 근거가 필요합니다.

## 방법론 참고

- [US EPA — Guidance for Preparing Standard Operating Procedures](https://www.epa.gov/sites/default/files/2015-06/documents/g6-final.pdf): 반복 업무의 절차·검토·재현·개정 원칙을 참고했습니다.
- [GOV.UK — Contextual research and observation](https://www.gov.uk/service-manual/user-research/contextual-research-and-observation): 실제 자료·도구를 사용한 수행과 판단 이유 관찰을 참고했습니다.
- [NASA — How to Write a Good Requirement](https://www.nasa.gov/reference/appendix-c-how-to-write-a-good-requirement/): 명확하고 추적·검증 가능한 요구사항 원칙을 참고했습니다.
- [Anthropic — Building effective agents](https://www.anthropic.com/research/building-effective-agents): 정해진 워크플로와 동적 판단의 구분에 관한 개념을 참고했습니다.

외부 자료는 방법론 근거입니다. 이 프로젝트의 효과를 검증한 자료가 아닙니다.
