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
- `app/components/`: 프로젝트 전용 컴포넌트 (Calendar, TransactionForm, BottomSheet 등)
- `app/context/`: React Context (UserSettingsContext - 설정 및 카테고리 전역 관리)
- `app/api/cron/`: Vercel Cron 작업 (고정 지출/수입 자동 생성)
- `components/ui/`: Shadcn/ui 컴포넌트 (수정 시 주의)
- `lib/supabase/`: Supabase 클라이언트 (client.ts: 브라우저용, server.ts: 서버 컴포넌트용, middleware.ts: 인증 처리)
- `types/database.ts`: Supabase 테이블 타입 정의

### 데이터베이스 테이블
| 테이블 | 설명 |
|-------|------|
| `user_settings` | 급여일(cycle_start_day), 주 시작일 |
| `categories` | 수입/지출 카테고리 (아이콘, 기본값 여부) |
| `transactions` | 거래 내역 (금액, 날짜, 메모, 카테고리) |
| `fixed_transactions` | 고정 지출/수입 (매월 자동 생성) |

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

- 단위 테스트: `app/components/*.test.tsx` (Jest + RTL)
- E2E 테스트: `tests/*.spec.ts` (Playwright)
- Playwright는 Mobile Chrome, Mobile Safari, Desktop Chrome에서 실행
