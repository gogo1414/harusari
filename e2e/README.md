# 로컬 E2E (Playwright + 로컬 Supabase)

운영 DB가 아니라 도커로 띄운 로컬 Supabase에 테스트 계정을 만들어 실제 화면을 끝까지 검증한다.
`e2e/support/db.ts`는 `127.0.0.1`/`localhost`가 아닌 Supabase URL이면 실행을 거부한다.

## 1. 로컬 Supabase 띄우기 (최초 1회)

```bash
mkdir -p /tmp/harusari-sb && cd /tmp/harusari-sb
npx supabase init
# supabase/config.toml에서 realtime/studio/storage/inbucket/edge_runtime/analytics는 꺼도 된다
# 저장소의 스키마 + 마이그레이션을 순서대로 복사
R=<레포 경로>/supabase
mkdir -p supabase/migrations
cp $R/schema.sql                                   supabase/migrations/20240101000000_schema.sql
cp $R/migrations/20240118_ensure_user_settings.sql supabase/migrations/20240118000001_ensure_user_settings.sql
cp $R/migrations/20240118_drop_impulse_items.sql   supabase/migrations/20240118000002_drop_impulse.sql
cp $R/migrations/20260118_create_budget_goals.sql  supabase/migrations/20260118000000_budget_goals.sql
cp $R/migrations/20260120_categories_sort_order.sql supabase/migrations/20260120000000_sort_order.sql
cp $R/migrations/20260703_integrity_and_security.sql supabase/migrations/20260703000001_integrity.sql
cp $R/migrations/20260703_savings_category.sql     supabase/migrations/20260703000002_savings.sql
cp $R/migrations/20260925_revamp_recurring_location.sql supabase/migrations/20260925000000_revamp.sql
npx supabase start   # 출력되는 API URL / anon key / service_role key를 메모
```

## 2. 앱을 로컬 DB로 빌드·실행

`.env.local`을 로컬 값으로 바꾼 별도 복사본에서 실행하는 것을 권장한다 (운영 키와 섞이지 않게).

```bash
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
SUPABASE_SERVICE_ROLE_KEY=<service_role key>
CRON_SECRET=local-test-cron-secret
```

```bash
npm run build && TZ=UTC npx next start -p 3100   # Vercel과 같은 UTC 서버 시간대로 검증
```

## 3. 테스트 실행

```bash
E2E_SUPABASE_ANON_KEY=<anon key> E2E_SUPABASE_SERVICE_ROLE_KEY=<service_role key> \
  npx playwright test -c e2e/playwright.config.ts
# 주요 화면 스크린샷(라이트/다크)까지: E2E_SCREENS=1 을 추가 → e2e/.screens/
```

테스트마다 새 계정을 만들고 끝나면 지운다. 위치는 강남역 좌표로 고정되고, 장소 조회는 실제 Photon(OSM)을 호출한다.

| 파일 | 검증 내용 |
| --- | --- |
| 01-auth-onboarding | 비로그인 리다이렉트, API 401, 기본 카테고리 동시 생성 중복 없음 |
| 02-recurring | cron 누락 시 홈 진입 자동 복구·멱등성, 과거 시작 고정지출 백필, 할부 회차·종료, 급여일 변경 |
| 03-quick-add-location | 빠른 입력 여러 건·날짜·카테고리·오늘만 위치, 검증 안내, 일반 입력 위치 자동/삭제 |
| 04-stats-map | 가장 많이 쓴 곳·국내/해외 전환, 급여일 31일 사이클 이동, ?month 딥링크 |
| 05-manage | 카테고리 추가·중복·삭제, 고정 내역 삭제, 홈 내역 삭제, 예산 화면 |
| 06-screens | 주요 화면 캡처 (E2E_SCREENS=1) |
