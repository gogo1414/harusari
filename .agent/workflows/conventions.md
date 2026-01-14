---
description: 하루살이 프로젝트 코드 컨벤션 및 작업 규칙
---

# 하루살이 프로젝트 컨벤션

이 문서는 프로젝트 전체에서 일관되게 따라야 할 규칙입니다.

## 커밋 컨벤션

### 커밋 타입 (5가지만 사용)
- `feature:` 새로운 기능 추가
- `refactor:` 코드 리팩토링 (기능 변경 없음)
- `fix:` 버그 수정
- `chore:` 설정, 의존성, 빌드 관련
- `style:` 코드 포맷팅, 스타일 수정 (기능 변경 없음)

### 커밋 메시지 규칙
- **한글로 작성**
- **간결하게** (디테일한 내용 X)
- **이모지 사용 금지**
- 예시:
  - `feature: 달력 컴포넌트 구현`
  - `fix: 날짜 계산 오류 수정`
  - `chore: Supabase 의존성 설치`
  - `refactor: 거래 입력 폼 로직 분리`
  - `style: 달력 셀 간격 조정`

### 커밋 크기 규칙
- **커밋 1개당 300줄 이하**
- 작업 중간중간 간헐적으로 커밋
- 한 번에 모든 것을 작업 후 커밋하지 않음

---

## 코드 컨벤션

### 네이밍
| 대상 | 규칙 | 예시 |
|------|------|------|
| 컴포넌트 파일 | PascalCase | `Calendar.tsx`, `BottomSheet.tsx` |
| 일반 파일 | camelCase | `supabase.ts`, `utils.ts` |
| 함수 | camelCase | `handleDateSelect()`, `formatCurrency()` |
| 변수 | camelCase | `currentMonth`, `isLoading` |
| 상수 | UPPER_SNAKE_CASE | `MAX_AMOUNT`, `DEFAULT_CATEGORY` |
| 타입/인터페이스 | PascalCase | `Transaction`, `CalendarProps` |

### 주석
- **한글로 작성**
- 복잡한 로직이나 의도 설명 시 사용
- 예시:
  ```tsx
  // 급여 사이클 기준으로 월의 시작일 계산
  const cycleStartDate = getCycleStartDate(date, cycleStartDay);
  ```

### 파일 구조
```
app/
├── components/      # 재사용 가능한 컴포넌트
│   ├── ui/          # Shadcn UI 컴포넌트
│   └── *.tsx        # 프로젝트 컴포넌트
├── hooks/           # 커스텀 훅
├── api/             # API 라우트
└── [페이지]/page.tsx
lib/                 # 유틸리티, 설정
```

---

## TypeScript & 린트 설정

### TypeScript
- `strict: true` 사용
- `any` 타입 최소화

### ESLint & Prettier
- Next.js 기본 ESLint 설정 사용
- Prettier 기본 설정:
  - 세미콜론: 사용
  - 따옴표: 작은따옴표
  - 탭 너비: 2칸

---

## 브랜치 전략

- **단일 main 브랜치** 사용 (개인 프로젝트)
- 별도 feature 브랜치 분리하지 않음
