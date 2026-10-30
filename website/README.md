# 기여 웹사이트

공개 주소: https://standard.linh.day/

README의 원본 일러스트와 아이보리·먹색·오렌지를 사용합니다. HTML/CSS/JavaScript와 Node HTTP 서버, PostgreSQL로 자료 탐색·접수·검토·공개·다운로드를 연결합니다. 외부 CDN·분석 추적기는 없고 나눔고딕·OFL 라이선스를 함께 배포합니다.

## 이용 흐름

- 공개 자료를 종류·분야·검색어로 탐색하고 본문·첨부·출처를 확인한 뒤 가져갑니다. 자료별 공유 링크와 Markdown 다운로드를 제공합니다.
- 웹 제출은 본문·첨부를 DB에 원자적으로 저장하고 확인 번호를 발급합니다. 같은 요청의 재시도는 중복 저장하지 않습니다. 검토 수용과 실제 공개는 별도 단계입니다.
- 접수 확인 키는 탭에 보관하며 파일로 내려받아 다른 브라우저에서도 조회할 수 있습니다. 초안 본문은 자동 저장하지 않습니다. 키 파일을 공개하지 마세요.
- GitHub 이슈 경로도 제공합니다. 긴 글은 복사·붙여넣기를 사용하고 첨부는 GitHub 화면에서 직접 추가합니다.
- 초기 자료 18개의 출처·가공·검증 범위는 [초기 자료 안내](../library/README.md)에 기록합니다.

## 개발·검증

```bash
npm ci --ignore-scripts
python3 scripts/build_website.py
node --test tests/*.test.mjs
PYTHONPATH=scripts python3 -m unittest discover -s tests -v
python3 scripts/check_repository.py
python3 scripts/summarize_evaluation.py
node --env-file=local-deploy/website.env scripts/serve_website.mjs
```

Node.js 22+와 Python 3.10+를 사용합니다. PostgreSQL 설치, 환경변수와 실제 DB 통합 검사·운영자 검토·백업/복구는 [저장 운영 안내](../docs/contribution-storage.md)를 따릅니다. DB 테스트를 생략한 결과를 전체 검증으로 보고하지 않습니다.

서버는 `127.0.0.1:4318`에서 공개 파일 allowlist와 API만 제공합니다. 저장소·숨김 파일·배포 설정은 서빙하지 않습니다. DB·서버·문서 변경 후에는 해당 계층의 검사를 실행합니다.

## Cloudflare 운영

`work-standards-web.service`와 `work-standards-tunnel.service` 사용자 서비스를 사용합니다. ingress는 `standard.linh.day`를 loopback 서버에 연결합니다. 운영 config와 비밀 값은 git에서 제외된 `local-deploy/`, tunnel 자격증명은 사용자 `~/.cloudflared/`에 있습니다. 웹 프로세스에는 제한된 DB 역할만 전달합니다.

```bash
python3 scripts/build_website.py
systemctl --user restart work-standards-web.service
systemctl --user status work-standards-web.service work-standards-tunnel.service
```

공개 파일은 시작 시 읽으므로 변경 후 빌드·재시작이 필요합니다. 호스트와 tunnel이 중지되면 웹사이트도 중지됩니다. GitHub 기여 경로는 별도로 이용할 수 있습니다.

## 문서와 PDF

2026-10-30 PDF 공개 개정본은 특정 제품의 내부 구현 설명을 공통 문서에서 제거하고 기여별 근거 기록으로 정리했습니다. 기존 N/B 단계·요구 ID를 유지합니다. PDF는 업무 초안·검증 방법의 스냅샷이며 최신 웹 접수·자료실 기능은 이 문서와 저장 운영 안내를 기준으로 봅니다.
