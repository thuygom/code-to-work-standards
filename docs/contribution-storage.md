# 기여 저장·검토·공개 운영

## 접수와 공개

웹 기여는 `received → reviewing → accepted / declined`로 검토합니다. accepted는 공개 검토 수용이며 현업 채택·구현 완료·성과 검증을 뜻하지 않습니다. 공개는 운영자가 별도로 선택한 본문과 첨부파일만 `publications`에 기록합니다. 자동 GitHub 이슈 생성은 하지 않습니다.

웹 요청은 64자리 무작위 확인 토큰을 Authorization 헤더로 보냅니다. DB에는 토큰의 SHA-256만 저장합니다. 확인 파일을 보관하면 다른 브라우저에서도 접수 상태를 조회할 수 있습니다. 로그인·이메일 복구는 없으며 키를 잃으면 익명 접수의 소유권을 자동 확인할 수 없습니다. 키를 URL·로그·공개 자료에 넣지 않습니다.

## DB 보장과 경계

- `(owner_hash, request_key)` 고유 제약과 트랜잭션 잠금으로 동시 재시도를 직렬화합니다. 정규화된 필드, 동의 버전, 첨부 이름·타입·크기·SHA-256을 요청 해시에 포함합니다. 같은 키·같은 내용은 처음 접수 번호·시각을 반환하고, 다른 내용은 409로 거절합니다. 멱등 키를 자동 만료하지 않습니다.
- 본문·첨부·초기 이벤트·접수 한도를 같은 트랜잭션에 저장합니다. 하나라도 실패하면 모두 롤백합니다. 원본 필드는 수정 트리거로 보호합니다. 웹 DB 역할에는 수정·삭제·공개 권한이 없습니다.
- PostgreSQL RLS로 확인 토큰에 해당하는 접수·첨부·이력만 조회합니다. 공개 목록은 검토 후 만든 명시적 공개본만 읽습니다. 운영자 자격증명은 웹 프로세스와 분리합니다.
- 검토는 예상 revision을 요구하며 오래된 화면의 수정은 충돌로 처리합니다. 상태 전이는 DB가 검사하고 변경 이력은 트리거가 기록합니다. 공개·철회 이력도 남깁니다. 이미 공개한 원본과 첨부 선택을 바꾸려면 철회 후 다시 검토·공개합니다.
- MD·TXT·PDF·PNG·JPEG, 최대 3개, 각 2 MiB입니다. 실제 바이트·이름·형식과 DB 해시를 검사하며 다운로드는 attachment/nosniff로 제공합니다. 파일 형식 검사는 악성코드 검사가 아닙니다. 운영자는 첨부를 실행하지 말고 출처와 공개 범위를 검토합니다.
- IP는 원문 대신 HMAC으로 접수 제한에 사용합니다. UTC 하루 기준 IP당 10건, 전체 100건이며 성공한 새 접수만 집계합니다. 2일 지난 버킷은 다음 접수에서 정리합니다. 재시도는 한도를 소모하지 않습니다. 대규모 공개 캠페인 전에는 저장 용량·스팸 대응을 재평가해야 합니다.
- `TRUST_CLOUDFLARE=true`는 loopback 서버 앞에 Cloudflare Tunnel만 있는 배포에 사용합니다. 임의 인터넷 클라이언트가 직접 서버 포트에 접근할 수 있게 열지 않습니다. 이 설정에서는 Cloudflare 전달 헤더가 없는 POST를 거절합니다.

## API

| 경로 | 용도 | 인증 |
|---|---|---|
| `GET /api/health` | DB 연결·마이그레이션 체크섬 준비 상태 | 없음 |
| `POST /api/contributions` | 본문·첨부 원자 접수 | Bearer 확인 토큰, Idempotency-Key UUID v4, 동일 Origin |
| `GET /api/contributions/:id` | 상태·검토 의견·첨부 목록 | 소유 확인 토큰 |
| `GET /api/contributions/by-key/:key` | 응답 유실 후 접수 조회 | 소유 확인 토큰 |
| `GET /api/contributions/:id/attachments/:position` | 접수 첨부 다운로드 | 소유 확인 토큰 |
| `GET /api/library` | 공개 자료 검색: q, domain, format, offset | 없음 |
| `GET /api/library/:id` | 공개 자료 읽기 | 없음 |
| `GET /api/library/:id/markdown` | 출처를 포함한 Markdown 다운로드 | 없음 |
| `GET /api/library/:id/attachments/:position` | 검토자가 공개한 첨부만 다운로드 | 없음 |

POST 필드는 `domain`, `kind`, `source`, `format`, `author`, `role`, `title`, `context`, `rule`, `check`, `references`, `consent: "2026-10-30"`, `attachments: [{name,data}]`입니다. data는 base64이며 총 HTTP 본문 한도는 9 MiB입니다. 공개 열거값과 글자 제한은 `website/contribution.mjs`, 서버 정규화는 `scripts/contribution_api.mjs`에서 관리합니다. 원문은 자동 저장하지 않고 확인 키·요청 키만 탭의 sessionStorage에 보관합니다.

## 설치와 마이그레이션

Node.js 22+, Python 3.10+, Docker Compose가 필요합니다. 외부 런타임 패키지는 `pg`, 안전한 Markdown 표시용 `markdown-it`과 잠금 파일로 고정한 의존성입니다.

`local-deploy/database.env`를 권한 600으로 만들고 강한 무작위 값을 설정합니다:

```text
POSTGRES_PASSWORD=<owner-password>
MIGRATION_DATABASE_URL=postgresql://standard_owner:<owner-password>@127.0.0.1:19433/standard
STANDARD_APP_PASSWORD=<different-random-password>
```

```bash
npm ci --ignore-scripts
docker compose --env-file local-deploy/database.env -f db/compose.yml up -d
node --env-file=local-deploy/database.env db/migrate.mjs
node --env-file=local-deploy/database.env db/setup_web_role.mjs
```

마이그레이션은 단일 트랜잭션과 공유 잠금으로 적용하며 번호 누락, 적용 파일 누락, 체크섬 변조를 거절합니다. 적용한 SQL 파일을 수정하지 말고 다음 번호의 파일을 추가합니다. 웹 서버는 스키마 불일치 시 시작하지 않고 준비 상태 API도 503을 반환합니다. 새 배포 전 백업과 복구 경로를 확인합니다.

`local-deploy/website.env`도 권한 600으로 만들고 웹 서비스에만 연결합니다:

```text
DATABASE_URL=postgresql://standard_web:<application-password>@127.0.0.1:19433/standard
PUBLIC_ORIGIN=https://standard.linh.day
RATE_LIMIT_SECRET=<independent-random-secret>
TRUST_CLOUDFLARE=true
```

## 검토·공개

```bash
node --env-file=local-deploy/database.env scripts/review_contributions.mjs list
node --env-file=local-deploy/database.env scripts/review_contributions.mjs show <id>
node --env-file=local-deploy/database.env scripts/review_contributions.mjs attachment <id> 0 <local-output-file>
node --env-file=local-deploy/database.env scripts/review_contributions.mjs review <id> 0 reviewing '출처·공개 범위 확인 중'
node --env-file=local-deploy/database.env scripts/review_contributions.mjs review <id> 1 accepted '공개 가능한 초안으로 수용'
node --env-file=local-deploy/database.env scripts/review_contributions.mjs publish <id> 0
node --env-file=local-deploy/database.env scripts/review_contributions.mjs withdraw <id>
```

publish 뒤 숫자는 공개할 첨부 위치입니다. 생략하면 본문만 공개하며 `0,2`처럼 선택할 수 있습니다. 공개 전에 개인정보·출처·재배포 권한을 확인합니다. 철회는 공개본만 내리고 접수 원본·검토 이력은 보존합니다. 이미 내려받은 사본까지 회수하지는 못합니다. 민감정보 삭제 요청은 운영자가 관련 공개본·원본·백업 보존 범위를 함께 처리해야 합니다.

## 백업·복구

첨부도 DB에 있으므로 pg_dump 한 번에 본문·첨부·검토·공개·마이그레이션 이력이 포함됩니다. 이 예시는 수동 작업이며 자동 백업 스케줄을 설정하지 않습니다. 저장 위치는 비공개로 유지합니다.

```bash
umask 077
docker compose --env-file local-deploy/database.env -f db/compose.yml exec -T db pg_dump -U standard_owner -d standard -Fc > local-deploy/standard.dump
```

복구는 운영 DB를 덮어쓰지 말고 격리된 PostgreSQL에 역할과 빈 DB를 준비한 뒤 `pg_restore --exit-on-error`로 수행합니다. 접수·공개·첨부 건수와 `encode(sha256(bytes),'hex') = sha256`을 비교하고 실제 다운로드까지 확인한 뒤 전환합니다. Compose volume 삭제는 일반 재배포 절차가 아닙니다.

## 검증

CI는 폐기 가능한 `standard_test` DB에서 새 설치·동시 마이그레이션·실패 롤백·체크섬 변조, 동시 접수·동일/변경 재시도, 소유권·RLS·Origin, 첨부 원자성, revision 충돌, 공개·철회·다운로드, 접수 한도와 준비 상태를 검사합니다. `TEST_DATABASE_URL`이 없으면 DB 통합 검사는 건너뜁니다. 실제 운영 DB를 테스트 대상으로 사용하지 않습니다.
