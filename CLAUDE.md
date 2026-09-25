# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트 개요

하루살이(Harusari)는 1인 가계부 웹 애플리케이션입니다. 급여 사이클 기준 월간 수입/지출 관리, 캘린더 뷰, 통계 분석을 제공합니다.

## 주요 명령어

```bash
# 개발 서버
npm run dev

# 빌드
npm run build

# 린트
npm run lint

# 단위 테스트 (Jest)
npm test

# 특정 테스트 파일 실행
npm test -- Calendar.test.tsx

# E2E 테스트 (Playwright)
npx playwright test

# 특정 E2E 테스트 실행
npx playwright test tests/app.spec.ts
```

## 아키텍처

### 기술 스택
- Next.js 16 (App Router) + TypeScript + Tailwind CSS v4
- Supabase (Auth + PostgreSQL + RLS)
- TanStack Query (서버 상태 관리)
- Shadcn/ui (Radix UI 기반 컴포넌트)
- PWA 지원

### 핵심 데이터 흐름
```
Supabase Auth → Middleware (세션 검증) → UserSettingsContext (전역 상태)
                                              ↓
                                    TanStack Query (데이터 페칭)
```

### 디렉토리 구조
- `components/`: 프로젝트 전용 컴포넌트 (calendar, forms, dashboard, common 등 하위 폴더로 구성)
- `app/context/`: React Context (UserSettingsContext - 설정 및 카테고리 전역 관리)
- `app/api/cron/`: cron 진입 라우트. 실제 스케줄링은 GitHub Actions(`.github/workflows/cron_scheduler.yml`)가 담당하며, 트리거된 스케줄(`github.event.schedule`)로 작업을 고른다 (고정 지출/수입 자동 생성 하루 2회, 푸시 알림). `vercel.json`은 미사용
- `lib/recurring/`: 고정 지출/수입·할부 자동 생성 엔진. `engine.ts`(순수 함수: 달력 기준 결제일, 시작월 기준 할부 회차), `runner.ts`(cron·`/api/recurring/sync` 공용 실행기, upsert ON CONFLICT DO NOTHING으로 멱등), `client.ts`(등록 + 백필, 실패 시 보상 삭제). 홈 진입 시 하루 1회 동기화(`hooks/useRecurringAutoSync.ts`)로 cron 누락을 자가 복구
- `lib/kst.ts`: 서버 TZ와 무관한 KST 오늘 날짜. 서버 코드에서 `new Date()` 로컬 getter·`toISOString()`으로 날짜를 만들지 말 것
- `lib/ai/` + `app/api/ai/parse`: AI 빠른 입력(`/transactions/new`의 "문장으로" 모드, 예전 `/transactions/quick`은 리다이렉트). Gemini(`GEMINI_API_KEY`) 구조화 출력, 실패·미설정 시 규칙 기반 파서(`rule-parser.ts`)로 대체. 결과는 `normalize.ts`로 항상 검증
- `lib/location/` + `app/api/location/{search,reverse}`: 거래 위치. 국내는 Kakao Local(`KAKAO_REST_API_KEY`, 선택), 해외·미설정 시 Photon(OSM). UI는 `components/location/LocationPicker.tsx`
- `lib/stats/` + `components/map/`: 통계 파생 데이터(장소 집계·지역 요약·일별/요일별)와 Leaflet 지출 지도(클라이언트 전용 dynamic import)
- `components/ui/`: Shadcn/ui 컴포넌트 (수정 시 주의)
- `lib/supabase/`: Supabase 클라이언트 (client.ts: 브라우저용, server.ts: 서버 컴포넌트용, middleware.ts: 인증 처리)
- `types/database.ts`: Supabase 테이블 타입 정의

### 데이터베이스 테이블
| 테이블 | 설명 |
|-------|------|
| `user_settings` | 급여일(cycle_start_day), 주 시작일 |
| `categories` | 수입/지출 카테고리 (아이콘, 기본값 여부) |
| `transactions` | 거래 내역 (금액, 날짜, 메모, 카테고리, 위치 place_name/latitude/longitude/country_code, input_source). (source_fixed_id, date) 유니크 |
| `fixed_transactions` | 고정 지출/수입·할부 (start_date 기준 매월 자동 생성, last_generated 이후만 생성) |

### Provider 구조 (app/providers.tsx)
```
QueryClientProvider → ThemeProvider → UserSettingsProvider
```

## 코드 컨벤션

### 커밋 메시지 (한글, 이모지 금지)
- `feature:` 새 기능 추가
- `fix:` 버그 수정
- `refactor:` 코드 리팩토링
- `chore:` 설정/의존성
- `style:` 포맷팅/스타일

예시: `feature: 달력 컴포넌트 구현`

### 네이밍
| 대상 | 규칙 | 예시 |
|------|------|------|
| 컴포넌트 파일 | PascalCase | `Calendar.tsx` |
| 일반 파일/함수/변수 | camelCase | `formatCurrency()` |
| 상수 | UPPER_SNAKE_CASE | `MAX_AMOUNT` |
| 타입/인터페이스 | PascalCase | `Transaction` |

### 기타 규칙
- 주석: 한글로 작성
- 브랜치: 단일 main 브랜치 사용
- 커밋 크기: 300줄 이하
- 코드 스타일: Prettier (세미콜론 O, 작은따옴표, 탭 2칸)

## Supabase 관련

### 환경 변수
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY  # Cron 작업용 (RLS 우회)
CRON_SECRET                # cron 라우트 인증
GEMINI_API_KEY, GEMINI_MODEL          # AI 빠른 입력 (선택)
KAKAO_REST_API_KEY                    # 국내 장소 검색 (선택)
NEXT_PUBLIC_MAP_TILE_URL_LIGHT/DARK   # 지도 타일 (선택)
```

### 클라이언트 사용
```typescript
// 클라이언트 컴포넌트
import { createClient } from '@/lib/supabase/client';

// 서버 컴포넌트
import { createClient } from '@/lib/supabase/server';
```

### 타입 자동 생성
```bash
npx supabase gen types typescript
```

## 테스트 구조

- 단위 테스트: `components/**/*.test.tsx`, `__tests__/*.test.tsx`, `lib/*.test.ts` (Jest + RTL)
- E2E 테스트: `tests/*.spec.ts` (Playwright)
- Playwright는 Mobile Chrome, Mobile Safari, Desktop Chrome에서 실행
