# 하루살이 개선 보고서

작성일: 2026-07-03 | 검토 범위: 기능 정합성(A), 안정성 로직(B), 보안(C), 데이터 정합성(D), 성능(E), UI/UX(F), 코드 품질(G)

검증 방법: 전 소스 정독 + 급여 사이클 로직은 date-fns로 직접 시뮬레이션 + Critical 항목은 교차 검증(복수 리뷰어가 독립적으로 동일 결론). 린트 실행 결과: 0 errors, 9 warnings. 단위 테스트는 샌드박스(Linux)에서 SWC 바이너리 불일치로 실행 불가 — 로컬에서 `npm test` 실행 필요.

---

## 요약: 우선 수정 Top 10

| # | 심각도 | 문제 | 위치 |
|---|--------|------|------|
| 1 | Critical | 급여일 29~31일 시 사이클 구멍/이중집계 → 거래 영구 누락 | `lib/date.ts:22-31` |
| 2 | Critical | 위 버그의 cron 전파 → 고정지출이 특정 달 통째로 미생성 | `app/api/cron/recurring/route.ts:51-62` |
| 3 | Critical | 할부 수정 화면이 기존 결제일 미로딩 → 저장만 해도 데이터 손상 | `app/installment/edit/[id]/page.tsx:103` |
| 4 | High | auth callback open redirect (`?next=//evil.com` 통과) | `app/auth/callback/route.ts:8` |
| 5 | High | push/send가 CRON_SECRET 미설정 시 무인증 개방 + 전체 user_id 노출 | `app/api/push/send/route.ts:61-64` |
| 6 | High | 백필·cron 기준 불일치로 고정지출 중복 생성 | `app/recurring/new/page.tsx:69-116` |
| 7 | High | 미래 시작 할부의 1회차 영구 누락 | `app/transactions/new/page.tsx:88` |
| 8 | High | 에러 상태 UI 전무 — 무한 스피너 3곳, 에러가 "내역 없음"으로 위장 | 전 화면 |
| 9 | High | 홈 날짜 카드의 수정/삭제 버튼이 모바일에서 안 보임 (hover 의존) | `components/common/TransactionItem.tsx:80` |
| 10 | High | 고정 내역 등록 후 홈 캘린더 미반영 (invalidation 누락) | `app/recurring/new/page.tsx:132-136` |

---

## 1. Critical

### 1-1. 급여 사이클 계산: 29/30/31일 급여일에서 사이클 구멍·겹침 발생
**위치**: `lib/date.ts:22-31` (+ `components/calendar/Calendar.tsx:76-81` 동일 로직 중복)

`setDate(prevMonth, cycleDay)`는 해당 월에 없는 일자(예: 2월 31일)를 주면 다음 달로 롤오버된다. date-fns로 직접 시뮬레이션한 결과 (급여일 31일 기준):

| 기준일 | 반환 사이클 | 문제 |
|---|---|---|
| 2026-02-28 | 01-31 ~ 02-27 | 2/28이 어느 사이클에도 속하지 않음 (고아) |
| 2026-03-01 | 03-03 ~ 04-02 | 기준일조차 범위 밖 (setDate(2월,31)→3/3 롤오버) |
| 2026-04-30 | 03-31 ~ 04-29 | 4/30 고아 |
| 2026-05-01 | 05-01 ~ 05-31 | 5/31이 다음 사이클(05-31~06-29)과 **이중 집계** |

급여일 29·30일, 윤년(2/29)에서도 동일 계열의 문제. 설정 UI(`components/settings/BasicSettingSection.tsx:41`)는 1~31일을 모두 허용하므로 실사용자가 도달 가능. 영향: 홈 월 합계(`app/page.tsx:56`), 통계·6개월 추이(`app/stats/page.tsx`), 캘린더, cron 전부.

**개선안**: 사이클 시작일을 말일로 클램프.
```ts
const clampedStart = (y: number, m: number) =>
  new Date(y, m, Math.min(cycleDay, new Date(y, m + 1, 0).getDate()));
```
종료일 = "다음 달 클램프된 시작일 − 1일". 경계 판정도 클램프된 시작일과 비교. `Calendar.tsx`의 중복 구현을 제거하고 `getCycleRange`로 통일. **급여일 29/30/31 × 2월/평년/윤년/연도 경계 테스트 추가 필수** (현재 `lib/date.ts` 테스트 0건).

### 1-2. cron 전파: 월말 급여일 사용자는 고정지출이 특정 달 통째로 누락
**위치**: `app/api/cron/recurring/route.ts:51-62`

1-1 버그로 사이클 범위가 왜곡되어, 급여일 31일 + 고정지출 day=31이면 2월분·4월분 등 31일이 없는 달마다 생성이 영구 스킵된다 (연 12회 나가야 할 월세가 5~6회 누락 가능). 1-1 수정 시 함께 해소되지만, `calculateTargetDateInCycle`이 null을 반환하는 경로(74-77행)를 로깅 대상으로 승격해 재발을 감지할 것.

### 1-3. 할부 수정: 기존 값 미로딩으로 저장만 해도 결제일·종료일 왜곡
**위치**: `app/installment/edit/[id]/page.tsx:103` (초기값 `date: new Date()`), `:51-77`

수정 화면의 날짜 초기값이 **오늘**이고, 저장 시 `day = formData.date.getDate()`, `end_date = addMonths(formData.date, months)`로 재계산한다. 즉 아무것도 바꾸지 않고 저장만 눌러도 결제일이 오늘 일자로 바뀌고 종료일이 밀리며, 이후 cron 생성 날짜가 전부 왜곡된다.

**개선안**: `installmentData.day`로 원래 결제일 복원, end_date는 원래 시작일 기준으로 재계산. 참고로 `app/recurring/edit/[id]/page.tsx:84`도 `new Date(y, m, fixedItem.day)` 재구성 시 day=31 + 30일 달이면 다음 달 1일로 넘어가는 동일 계열 문제가 있음.

---

## 2. High — 보안

### 2-1. auth callback open redirect
**위치**: `app/auth/callback/route.ts:8` — `rawNext.startsWith('/')` 검사만으로는 protocol-relative URL을 못 막는다. `?next=//evil.com` → `new URL('//evil.com', origin)` = `https://evil.com`. `/\evil.com`(백슬래시)도 우회 가능. 로그인 직후 피싱 사이트로 이동시키는 데 악용 가능.

**개선안**: `startsWith('/') && !startsWith('//') && !startsWith('/\\')` 또는 `new URL(next, origin).origin === origin` 검증. docs/auth-tdd-plan.md에 명시된 `sanitizeNextPath()` 유틸로 추출 + 테스트 작성 (문서상 머지 조건인데 미구현 상태).

### 2-2. push/send: CRON_SECRET 미설정 시 완전 개방 (fail-open)
**위치**: `app/api/push/send/route.ts:61-64` — `if (process.env.CRON_SECRET && ...)`이라 시크릿이 없으면 검사 자체가 스킵된다. 이 라우트는 middleware 제외 경로이며 service role로 전체 사용자 구독·거래를 읽어 발송한다. 게다가 응답 JSON(243행)이 전체 사용자 UUID를 노출. `vercel.json`이 빈 객체(`{}`)라 실제 Vercel Cron이 미구성 → CRON_SECRET 미설정 개연성 높음.

**개선안**: `if (!process.env.CRON_SECRET || authHeader !== ...) return 401` (fail-closed), 응답에서 user_id 제거.

### 2-3. cron/recurring: "Bearer undefined" 통과
**위치**: `app/api/cron/recurring/route.ts:14-17` — CRON_SECRET 미설정 시 기대값이 문자열 `"Bearer undefined"`가 되어, 해당 헤더를 보내면 인증 통과. **개선안**: 진입 시 `if (!process.env.CRON_SECRET) return 500` 가드.

### 2-4. 기타 보안 (Medium/Low)
- **[Medium]** `app/api/push/subscribe/route.ts:13-27`: subscription 바디 shape/endpoint 무검증 → 내부망 URL 저장 시 push 발송이 SSRF 벡터가 됨. endpoint https + 알려진 푸시 도메인 화이트리스트 검증 권장.
- **[Medium]** `supabase/schema.sql:133-141`: `user_push_subscriptions`에 UPDATE RLS 정책 부재 → upsert의 UPDATE 경로가 42501로 실패 (재구독 500 에러, 기능 장애).
- **양호 확인**: 전 테이블 RLS `auth.uid() = user_id` 성립, service role 사용처는 cron·push 2곳뿐, 클라이언트 번들 시크릿 유입 없음, `.env.local` git 미추적, middleware matcher 우회 경로 없음.

---

## 3. High — 로직·데이터 정합성

### 3-1. 백필 vs cron 기준 불일치 → 고정지출 중복 생성
**위치**: `app/recurring/new/page.tsx:69-116` + `app/api/cron/recurring/route.ts:56-62`

cron의 중복 방지는 "last_generated가 현재 사이클 안이면 skip"인데, 등록 시 백필은 달력 월 기준으로 미래 날짜까지 생성하고 last_generated를 미래로 둔다. 시뮬레이션: 급여일 25일, 7/3에 5/28 시작(day=28) 등록 → 백필이 7/28(미래)까지 생성 → 7/4 cron이 "사이클 밖"으로 판단해 6/28 **중복 생성** → 7/25 cron이 7/28 **또 중복 생성**. 등록 1건으로 중복 2건.

**개선안(근본)**: `transactions(source_fixed_id, date)` UNIQUE 제약 + insert를 `on conflict do nothing`으로 → DB 레벨 멱등성. (아래 3-2, 3-3도 함께 해소)

### 3-2. cron 멱등성: last_generated update 실패 미확인
**위치**: `app/api/cron/recurring/route.ts:119-129, 157-161` — insert 에러는 체크하지만 후속 `fixed_transactions` update의 반환값은 버림. update만 실패하면 다음 날 같은 거래 재생성. GH Actions `workflow_dispatch` 수동 실행과 스케줄이 겹치는 레이스에서도 동일. → 3-1의 UNIQUE 제약으로 해결.

### 3-3. cron 종료일 비교 오류: 종료일 지나도 생성
**위치**: `app/api/cron/recurring/route.ts:64-69` — `end_date < cycleStart`만 체크. 사이클 7/25~8/24, day=28, end_date=7/26이면 종료일 이틀 뒤인 7/28에 생성됨. → targetDateStr 계산 후 `endDateStr < targetDateStr`이면 skip.

### 3-4. end_date 저장 시 KST→UTC 하루 밀림
**위치**: `app/recurring/new/page.tsx:45`, `app/installment/edit/[id]/page.tsx:71` — `date.toISOString().split('T')[0]`은 KST 자정을 UTC 전날로 만든다 (8/1 선택 → "07-31" 저장). 같은 로직인 `app/transactions/new/page.tsx:159`는 `format(date, 'yyyy-MM-dd')`로 올바름 — 경로별 동작 불일치. → 전부 `format()`으로 통일. 백필의 `new Date(targetDateStr) > new Date(end_date)` UTC/KST 혼용 비교(`recurring/new:81-87`)도 종료일 당일 회차를 누락시키므로 문자열 비교로 통일.

### 3-5. 미래 시작 할부: 1회차 영구 누락
**위치**: `app/transactions/new/page.tsx:88` — 미래 시작이면 백필 0건인데 `last_generated = 시작일`로 저장 → 해당 사이클이 오면 cron이 "이미 생성됨"으로 skip → 1회차는 영원히 생성 안 되고 2회차부터 시작. 고정지출도 유사(시작월 개념 부재로 미래 시작 지정 시 당일 밤 cron이 즉시 생성). → 미래 시작 시 last_generated를 null로 두고 cron이 시작일 도래 여부로 판단.

### 3-6. 거래 수정 화면: 반복/할부 옵션이 무시됨
**위치**: `app/transactions/edit/[id]/page.tsx:44-59` + `components/forms/TransactionForm.tsx:232-257` — 수정 화면에도 반복/할부 토글이 노출·조작 가능하지만 update는 해당 필드를 무시. 켜고 저장하면 성공 토스트가 뜨는데 실제로는 아무것도 안 됨. → 수정 모드에서 두 옵션 숨김.

### 3-7. invalidation 누락 2건
- `app/recurring/new/page.tsx:132-136`: 과거분 거래를 직접 insert하는데 `['fixed_transactions']`만 무효화 → 홈 복귀 시 최대 60초간 캘린더/합계에 미반영 (E2E-01 시나리오 위반). → `['transactions']` 추가.
- `app/transactions/new/page.tsx:257-263`: 반대로 fixed_transactions에 insert하면서 `['transactions']`만 무효화 → `/recurring` 목록 stale. → `['fixed_transactions']` 추가.

### 3-8. 카테고리 삭제: 조용한 실패 + orphan + stale
**위치**: `app/categories/page.tsx:271-282, 332-336`, `supabase/migrations/20260118_create_budget_goals.sql`
- budget_goals의 category FK에 ON DELETE 절 없음 → 예산이 걸린 카테고리 삭제는 FK 위반으로 실패하는데 onError 핸들러가 없어 **무반응** (추가/수정 mutation도 onError 없음).
- 삭제 성공 시에도 사용 중 거래 건수 경고 없이 전부 '카테고리 없음'이 되고, `['transactions']`/`['fixed_transactions']` 미무효화로 삭제된 카테고리가 화면에 잔존.
- native `confirm()` 사용 — 앱의 AlertDialog 패턴과 불일치.

**개선안**: FK `ON DELETE CASCADE`(또는 SET NULL) + onError 토스트 + 삭제 전 사용 건수 안내 다이얼로그 + invalidation 추가.

### 3-9. stats 추이 쿼리 키에 월 누락
**위치**: `app/stats/page.tsx:88-92` — queryKey가 `['transactions','trend', 연도, cycleStartDay]`인데 queryFn 범위는 월 의존 → 같은 해 안에서 월 이동 시 refetch 안 되어 추이 차트가 0으로 표시. → 키에 `trendStart/trendEnd` 포함.

### 3-10. 고정지출/할부 수정 시 기생성 거래 미보정 (Medium)
`app/recurring/edit/[id]/page.tsx:42-61`, `app/installment/edit/[id]/page.tsx:66-77` — 금액을 바꿔도 이번 사이클에 이미 생성된 거래는 그대로이고 안내도 없음. 할부는 총 납부액 ≠ 원금+이자가 됨. → 최소 "이미 기록된 내역은 변경되지 않습니다" 안내, 이상적으로 "이번 사이클분도 갱신" 선택지. `months < current_month` 축소 검증도 추가.

### 3-11. 백필 비원자성 (Medium)
`app/transactions/new/page.tsx:117-238`, `app/recurring/new/page.tsx:34-126` — fixed insert → 루프 개별 insert → last_generated update가 트랜잭션 없이 순차 실행. 중간 실패 시 반쪽 데이터가 남고, 고정 경로는 건별 실패를 `console.error`로 삼킨 채 last_generated를 마지막 성공일로 세팅 → **빠진 달을 cron이 영구 스킵**. → Postgres RPC로 단일 트랜잭션화 + bulk insert(`insert([...])`), 부분 실패 시 토스트.

### 3-12. 기타 정합성 (Medium/Low)
- **[Medium]** 급여일 변경 시 cron 중복/스킵 가능 (`cycle_start_day` 변경으로 last_generated가 새 사이클 범위 밖으로 밀림) → 3-1 UNIQUE 제약으로 해소.
- **[Medium]** 기본 카테고리 자동 생성 경쟁 (`UserSettingsContext.tsx:76-111`): 두 탭 동시 첫 로드 시 30개 중복 생성. `(user_id, name, type)` UNIQUE + upsert 또는 DB 트리거로 이전.
- **[Medium]** 금액 상한 검증 부재: `amount INTEGER`(최대 21.4억)인데 클라이언트 상한 검증 없음 → overflow 시 원인 불명 에러. 0원도 `!!amount`(문자열 "0"은 truthy)로 통과 → DB CHECK 위반. → `0 < 금액 ≤ 1e9` 검증.
- **[Low]** `transactions.source_fixed_id`에 FK 없음 → dangling 참조 방치. `REFERENCES fixed_transactions ON DELETE SET NULL` 권장.
- **[Low]** `hooks/useDailySurvival.ts:86-88`: `Math.abs(end - today)` — 과거 사이클 조회 시 생존 예산 오계산.
- **[Low]** 극소액 할부(원금 < 개월수) 시 0원 회차 → cron insert가 CHECK 위반으로 매일 실패하는 영구 루프. 등록 시 `principal >= months` 검증.
- **[Low]** `?date=garbage` 쿼리 파라미터 무검증 → `format()` RangeError.

---

## 4. High — UI/UX

### 4-1. 에러 상태 UI 전면 부재
grep 확인 결과 `isError`/`refetch`/`ErrorBoundary`/`app/error.tsx`/`loading.tsx`가 코드베이스에 **0건**.
- 홈(`app/page.tsx:32`): 쿼리 실패 시 빈 배열 → 달력 백지 + "내역이 없어요" 표시. **오프라인이면 데이터가 삭제된 것처럼 보임.**
- 수정 화면 3곳(`transactions/edit`, `recurring/edit`, `installment/edit`): `if (isLoading || !data)` 패턴이라 에러 시 **무한 스피너**.

**개선안**: 공용 `QueryErrorState` 컴포넌트("불러오지 못했어요" + 재시도 버튼) + `isError` 분기, 루트 `error.tsx` 추가.

### 4-2. 홈 날짜 카드의 수정/삭제 버튼이 모바일에서 발견 불가
`components/common/TransactionItem.tsx:80` — `showActionsOnHover`가 `opacity-0 group-hover:opacity-100`인데 터치 기기에는 hover가 없음. 투명 버튼이 눌리긴 하나 보이지 않는 UI. 버튼 크기도 28~32px로 44px 미만. → `@media (hover: hover)`에서만 숨기고 모바일은 항상 표시 + `h-10 w-10` 이상.

### 4-3. 무음 실패 mutation 다수
- 고정내역 삭제(`app/recurring/page.tsx:46-74`): onError·성공 토스트 없음.
- 카테고리 추가/수정/삭제(`app/categories/page.tsx:228-282`): 3종 모두 onError 없음 (`showToast.categoryDeleted`는 정의만 되고 미사용).
- 설정 변경(`components/settings/BasicSettingSection.tsx:16-22`): `updateSettings` throw를 await/catch 안 함 → unhandled rejection, 성공/실패 피드백 전무.
- 로그인(`app/login/page.tsx:28`)은 `alert()` 사용 — sonner 토스트로 통일 필요.

### 4-4. BudgetFormDialog만 폼 규칙이 다름
`components/budget/BudgetFormDialog.tsx:110-124` — `type="number"`(iOS 전체 키보드, 콤마 없음), 저장 버튼 비활성 조건 없음, isPending 미적용으로 연타 시 중복 upsert. → 다른 금액 입력과 동일하게 `type="text" inputMode="numeric"` + 콤마 포맷 + `disabled={!category || !amount || isPending}`.

### 4-5. 기타 UI/UX (Medium/Low)
- **[Medium]** 홈 거래 목록·예산 화면에 로딩 스켈레톤 없음 → "내역이 없어요" 번쩍임 (`HomeTransactionList`, `budget-settings/page.tsx:17`).
- **[Medium]** OAuth 실패 시 `/login?error=auth`로 오지만 로그인 페이지가 error 파라미터를 안 읽음 → 무표시.
- **[Medium]** 딥링크 진입 후 `router.back()`이 앱 밖으로 이탈 → `history.length` 체크 후 `router.push('/')` fallback.
- **[Medium]** 터치 타겟 44px 미만 다수: 캘린더 월 이동 `h-8 w-8`, StatsDateNavigator, BudgetGoalItem `h-9 w-9`, DailySurvivalCard "예산 수정" 텍스트 링크 등 → 히트 영역 확장.
- **[Medium]** `app/layout.tsx:23-24` `userScalable: false` — 핀치 줌 차단 (WCAG 1.4.4 위반) → 제거 권장.
- **[Medium]** aria-label 없는 아이콘 버튼 다수 (뒤로가기 전부, 캘린더 이동, + 버튼 등). DailySurvivalCard는 div onClick이라 키보드 접근 불가.
- **[Medium]** 다크모드 깨짐 2곳: `HomeHeader.tsx:50-86` 메뉴 아이콘 박스 `bg-white`, `categories/page.tsx:358` 활성 탭 `bg-white` → `dark:bg-muted` 추가.
- **[Medium]** 홈 수입/지출 요약 카드가 눌리는 버튼인데 onClick이 `console.log` 플레이스홀더 (`HomeCalendarSection.tsx:47-50`) — 무반응 안티패턴. 기능 연결 또는 버튼 제거.
- **[Medium]** PWA 오프라인 fallback 미설정 (`fallbacks.document` 없음, offline 페이지 없음) → 오프라인에서 브라우저 기본 에러 화면.
- **[Low]** FAB가 뷰포트 기준 `fixed`라 데스크톱에서 콘텐츠 밖에 위치 + `safe-area-inset-bottom` 미적용.
- **[Low]** 알림 딥링크 `/stats?month=...`를 stats 페이지가 읽지 않음 → 알림 눌러도 항상 이번 달 표시.
- **[Low]** `BottomSheet.tsx`는 잘 구현됐으나 실제 사용처 0곳 (죽은 코드 or 미완 기능).
- **양호**: 거래 폼 콤마 포맷·inputMode·중복 제출 가드, 삭제 다이얼로그 3종, +/− 접두사로 색상 단독 구분 회피, dnd-kit 롱프레스, 스켈레톤 컴포넌트.

---

## 5. 성능 (E)

- **[Medium]** 홈이 5개월치 거래를 페칭 (`app/page.tsx:36-37`) — 실제 필요 범위는 사이클 ±1주. 범위 축소 권장.
- **[Medium]** stats·trend 쿼리가 겹치는 범위를 `select('*')`로 이중 페칭 → 통합 또는 컬럼 축소.
- **[Medium]** `UserSettingsContext` value 미메모이제이션 + `updateSettings` 매 렌더 재생성 → 루트 Provider라 전 소비자 연쇄 리렌더. `useMemo`/`useCallback` 적용.
- **[Medium]** 캘린더 셀당 전체 거래 `filter + parseISO` — 렌더 1회당 수만 회 호출. `useMemo`로 `Map<'yyyy-MM-dd', 합계>` 1회 구축으로 전환 (문자열 키 사용 시 parseISO 자체가 불필요).
- **[Medium]** 백필 루프 내 개별 insert (N+1) → 배열 bulk insert. cron·push/send도 사용자별 순차 쿼리·발송 → 일괄 조회 + `Promise.allSettled`.
- **[Medium]** 폰트가 렌더 블로킹 CSS `@import`(CDN) — `next/font/local` 자체 호스팅으로 전환.
- **[Low]** framer-motion 정적 import 10곳 (홈 초기 번들 포함) → `LazyMotion`. recharts는 stats 라우트로 자연 격리됨(양호).
- **[Low]** 월 이동 시 스켈레톤 깜빡임 → `placeholderData: keepPreviousData`.
- **[Low]** `--webpack` 플래그로 Turbopack 비활성 상태 — 전환 검토.

## 6. 코드 품질 (G)

- **[High]** 백필 루프가 3곳에 복붙 (`transactions/new`, `recurring/new`, cron의 말일 보정) — 이번 검토에서 발견된 불일치 버그(3-1, 3-4)의 직접 원인. `lib/`로 추출 (installment-logic.ts 선례 있음).
- **[High]** `useUserSettings` 동명 훅 2벌 (hooks/ vs context) — 다른 queryKey·다른 반환 형태로 이중 페칭 + upsert 로직 중복. 통합 필수.
- **[High]** 테스트 역전: 할부(lib)는 테스트가 있는데 정작 `getCycleRange`·cron 날짜 계산은 0건. `calculateTargetDateInCycle`은 비공개 함수라 테스트 불가 구조 → lib로 추출.
- **[Medium]** `@ts-expect-error` 25건 + `as any` 등 — 대부분 types/database.ts가 실제 스키마(할부 컬럼, budget_goals, RPC)와 어긋난 것이 원인. `npx supabase gen types typescript` 재실행으로 일괄 해소 가능.
- **[Medium]** Jest + Vitest + Playwright 3중 러너 — 당장 충돌은 없으나 신규 테스트 작성 기준 모호. 하나로 수렴 권장.
- **[Medium]** 급여 사이클 계산 2벌, 예산 상태(80%/50%) 계산 2벌, categories queryFn 7곳 복붙 → 각각 단일 소스로.
- **[Low]** 죽은 코드: `/stats/mock` 라우트가 프로덕션 노출(참조 0건), 미사용 `kstOffset`, `handleSave`, `IconPicker` 등 (린트 warning 9건과 일치), `harusari.pen` untracked 방치.
- **[Low]** stats 파생 계산 전부 useMemo 없음 (홈은 사용 — 불일치).

## 7. 명세-구현 불일치

| 명세 (출처) | 실제 | 심각도 |
|---|---|---|
| auth-tdd-plan: 인증 테스트 5종이 머지 조건 | 인증 테스트 0건 | High |
| auth-tdd-plan: `sanitizeNextPath` 등 유틸 단일화 | 미구현 (인라인 로직만) | Medium |
| login-observability: KPI 이벤트 8종 + L-* 에러코드 | 코드에 전무 | Medium |
| test plan E2E-01/02 (입력→캘린더/통계 반영) | E2E는 로그인 리다이렉트 3케이스뿐 | Medium |
| CLAUDE.md: "Vercel Cron" | 실제는 GitHub Actions (`vercel.json`은 `{}`), 문서 갱신 필요 | Low |
| CLAUDE.md: 테스트 위치 `app/components/*.test.tsx` | 실제 `components/**`·`__tests__/` | Low |
| README: 고정지출 "자동 관리" | 수정 시 기생성분 미반영, 시작월 개념 부재 | Medium |

추가: GH Actions cron이 `curl -s`(-f 없음)라 API 500도 성공으로 표시 → `-sf`로 변경. 스케줄 지연으로 17:00 UTC 창을 넘기면 그날 실행 스킵.

## 8. 권장 실행 순서

1. **긴급(데이터 손상 방지)**: 1-3 할부 수정 → 1-1/1-2 사이클 클램프(+테스트) → 3-4 end_date 하루 밀림
2. **보안**: 2-1 open redirect → 2-2/2-3 cron fail-closed + CRON_SECRET 설정 확인
3. **멱등성**: `transactions(source_fixed_id, date)` UNIQUE + upsert (3-1, 3-2, 3-12 일괄 해소)
4. **UX 신뢰**: 4-1 에러 상태 → 4-2 모바일 액션 버튼 → 4-3 무음 실패 토스트 → 3-7 invalidation 2건
5. **구조**: 백필 로직 lib 추출 + RPC 트랜잭션화, useUserSettings 통합, Supabase 타입 재생성
6. **다듬기**: 성능(캘린더 Map, 폰트, Context memo), 접근성, 다크모드, PWA fallback
