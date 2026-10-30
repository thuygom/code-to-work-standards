# 기여 웹사이트

공개 주소: https://standard.linh.day/

README의 원본 일러스트, 아이보리·먹색·오렌지, 종이 카드와 탭을 사용한 정적 웹사이트입니다. 프레임워크·외부 CDN·분석 추적기 없이 HTML/CSS/JavaScript로 동작하며 기존 나눔고딕과 OFL 라이선스를 함께 배포합니다. 다른 디자인 사이트의 컴포넌트를 복제하지 않았습니다.

## 기여 흐름

분야 검색·필터 → 기여 작성 창 → 사례·규칙·확인 방법 → 공개·라이선스 확인 → GitHub 이슈 작성 화면에서 최종 제출.

- `.md`·`.txt` UTF-8 파일을 브라우저에서 읽습니다. 최대 64 KB, 사례 본문 12,000자입니다. 기존 사례 내용에 추가하며 원문을 서버에 전송하지 않습니다.
- 사용자 입력은 미리보기의 `textContent`로 표시합니다. HTML/Markdown을 실행하지 않습니다.
- GitHub URL이 7,000자를 넘으면 본문을 복사한 뒤 GitHub에 붙여넣도록 안내합니다. 초안은 `.md`로 저장할 수 있습니다.
- PDF·이미지 첨부, 로그인, 실제 접수·검토 이력은 GitHub가 담당합니다. 웹사이트 자체 업로드 저장소·자동 접수 API는 없습니다.
- 작성 내용은 자동 저장하지 않습니다. 모달을 닫아도 같은 페이지에서는 유지되지만 새로고침·페이지 종료 시 사라집니다.
- 실제 현업 검증 전 v0.1입니다. 새 분야 카드는 참여 예시이며 등록·채택된 업무군이 아닙니다.

## 개발·검증

Python 3.10+와 Node.js 22+를 사용합니다. 외부 패키지는 필요 없습니다.

```bash
python3 scripts/build_website.py
node --test tests/*.test.mjs
PYTHONPATH=scripts python3 -m unittest discover -s tests -v
python3 scripts/check_repository.py
python3 scripts/summarize_evaluation.py
node scripts/serve_website.mjs
```

로컬 주소는 `http://127.0.0.1:4318`입니다. 빌드는 공개 파일만 `dist/`에 복사하고 서버는 명시된 파일만 제공합니다. 저장소·숨김 파일·디렉터리 목록·배포 설정을 서빙하지 않습니다. 포트는 `PORT` 환경변수로 변경할 수 있습니다.

## Cloudflare 운영

사용자 systemd 서비스 `work-standards-web.service`와 `work-standards-tunnel.service`로 실행합니다. ingress는 `standard.linh.day`를 `http://127.0.0.1:4318`에 연결하며 기존 `standard.jhkim3ispark.work` 주소도 전환 기간 동안 같은 사이트를 제공하며, 그 외 hostname에는 404를 반환합니다. 운영 config는 git에서 제외되는 `local-deploy/`, tunnel 자격증명은 사용자의 `~/.cloudflared/`에만 둡니다. 서비스 단위는 `~/.config/systemd/user/`에 있습니다. 기존 다른 서비스의 ingress는 변경하지 않습니다.

```bash
python3 scripts/build_website.py
node --test tests/*.test.mjs
systemctl --user restart work-standards-web.service
systemctl --user status work-standards-web.service work-standards-tunnel.service
```

서버는 시작 시 공개 파일을 읽기 때문에 변경 후 빌드·재시작이 필요합니다. 재부팅 시 사용자 서비스가 시작되려면 user lingering이 활성화되어 있어야 합니다. 이 호스트와 tunnel이 중지되면 사이트 접속도 중지됩니다. GitHub 이슈·기여 문서는 계속 사용할 수 있습니다.

## 문서 영향

기여 접수와 새 업무군 등록 절차를 추가했습니다. 기존 N/B SOP·PRD의 의미와 단계 ID는 바꾸지 않았으며 PDF v0.1은 그대로인 스냅샷입니다. 다음 PDF 재발행 때 웹 기여 경로와 업무군 등록부를 반영합니다.
