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

### 폴더 계층 구조

```
harusari/
├── app/                          # Next.js App Router
│   ├── (auth)/                   # 인증 관련 라우트 그룹
│   │   ├── login/
│   │   └── auth/callback/
│   ├── (main)/                   # 메인 앱 라우트 그룹
│   │   ├── dashboard/            # 대시보드
│   │   ├── transactions/         # 거래 관리
│   │   │   ├── new/
│   │   │   └── [id]/edit/
│   │   ├── recurring/            # 반복 거래
│   │   ├── installment/          # 할부
│   │   ├── stats/                # 통계
│   │   ├── categories/           # 카테고리
│   │   └── settings/             # 설정
│   ├── api/                      # API Routes
│   ├── globals.css
│   ├── layout.tsx
│   └── providers.tsx
│
├── components/                   # 모든 컴포넌트
│   ├── ui/                       # Shadcn UI
│   ├── common/                   # 공용 (BottomSheet, EmptyState 등)
│   ├── forms/                    # 폼 (TransactionForm 등)
│   ├── charts/                   # 차트 (CategoryChart 등)
│   ├── calendar/                 # 캘린더 관련
│   ├── category/                 # 카테고리 관련
│   └── animation/                # 애니메이션
│
├── lib/                          # 라이브러리/유틸리티
│   ├── supabase/                 # Supabase 설정
│   ├── utils/                    # 유틸 함수 (date, format, cn)
│   └── constants/                # 상수 정의
│
├── hooks/                        # 커스텀 훅
├── types/                        # 타입 정의
└── tests/                        # E2E 테스트
```

### 파일명 규칙

#### 페이지 파일
- Next.js App Router 규칙 유지: `page.tsx`, `layout.tsx`, `loading.tsx`
- **폴더명으로 페이지 구분**: `/dashboard/page.tsx` → 대시보드 페이지

#### 컴포넌트 파일명
| 카테고리 | 규칙 | 예시 |
|---------|------|------|
| 폼 | `[역할]Form.tsx` | `TransactionForm.tsx` |
| 차트 | `[데이터]Chart.tsx` | `CategoryChart.tsx` |
| 리스트 | `[데이터]List.tsx` | `TransactionList.tsx` |
| 모달/시트 | `[역할]Sheet.tsx` | `BottomSheet.tsx` |
| 아이콘 | `[대상]Icon.tsx` | `CategoryIcon.tsx` |
| 선택기 | `[대상]Picker.tsx` | `IconPicker.tsx` |

#### 컴포넌트 폴더 구조
```
ComponentName/
├── ComponentName.tsx         # 메인 컴포넌트
├── ComponentName.test.tsx    # 단위 테스트
├── ComponentName.stories.tsx # Storybook
└── index.ts                  # 배럴 익스포트 (선택)
```

### 컴포넌트 분류 기준

| 위치 | 조건 | 예시 |
|------|------|------|
| `components/ui/` | Shadcn UI | Button, Card, Input |
| `components/common/` | 2개 이상 페이지에서 사용 | BottomSheet, EmptyState |
| `components/forms/` | 폼 입력 관련 | TransactionForm |
| `components/charts/` | 데이터 시각화 | CategoryChart |
| `app/[route]/` 내부 | 해당 라우트에서만 사용 | 로컬 컴포넌트 |

---

## 컴포넌트 설계 및 리팩토링 원칙

### 1. Monolithic JSX 지양 (Declarative Composition)
페이지나 폼 컴포넌트의 `return` 문 내부에는 `div`, `section` 등의 Raw HTML 태그가 길게 나열되는 것을 피하고, **의미 있는 단위의 하위 컴포넌트(Sub-components)** 로 추상화하여 구성해야 합니다.

**작성 규칙:**
- **의미적 분리**: UI의 각 섹션(헤더, 입력 필드 그룹, 요약 카드 등)을 별도 컴포넌트로 분리
- **조립형 구조**: 상위 컴포넌트는 로직(State, Handler)을 관리하고, `return` 문에서는 하위 컴포넌트들을 조립(Composition)하는 역할만 수행
- **유지보수성**: 특정 섹션을 수정할 때, 전체 파일을 열지 않고 해당 하위 컴포넌트만 수정하도록 격리

**Bad Case:**
```tsx
// 모든 마크업이 한 파일에 노출됨
return (
  <form>
    <div className="header">
      <button>Back</button>
      <h1>Title</h1>
    </div>
    <div className="input-section">
      <input type="text" />
      ...
    </div>
  </form>
);
```

**Good Case:**
```tsx
// 의미 있는 컴포넌트의 조합으로 표현
return (
  <form>
    <FormHeader />
    <AmountInputSection />
    <OptionConfigSection />
    <SubmitButton />
  </form>
);
```

---

## 스타일 컨벤션

### 기본 원칙
- **Tailwind CSS**를 기본 스타일링 도구로 사용
- 복잡한 조건부 스타일링은 **CVA (Class Variance Authority)** 활용
- 클래스 병합은 **`cn` 유틸리티** (`clsx` + `tailwind-merge`) 사용

### 스타일 파일 구조 (`lib/styles/`)
| 파일 | 용도 | 예시 |
|------|------|------|
| `variants.ts` | CVA 변형(variant) 정의 모음 | `cardVariants`, `buttonVariants` |
| `constants.ts` | 공통 Tailwind 클래스 상수 | `CARD_BASE_STYLE`, `INPUT_STYLE` |
| `index.ts` | 스타일 모듈 배럴 익스포트 | `export * from './variants'` |

### 작성 규칙
1. **인라인 스타일 지양**: 의미 있는 단위는 컴포넌트로 추출하거나 CVA 변형으로 정의
2. **조건부 스타일**: 삼항 연산자보다 `cn()`과 객체/조건문 활용 권장
3. **색상**: 하드코딩된 색상 대신 Tailwind Theme 색상 (`bg-primary`, `text-muted-foreground`) 사용

---

## 미사용 코드 관리

- **정기 검토**: 매 릴리스 전 미사용 파일 검토
- **deprecation 표시**: 삭제 전 `@deprecated` 주석 추가
- **테스트 파일**: 대응 컴포넌트 삭제 시 함께 삭제
- **도구 활용**: `npx unimported`로 미사용 import 검사

---

## 공통 로직 추출 규칙

### 커스텀 훅 추출 조건
- 2회 이상 반복되는 상태 관리 로직
- API 호출 로직
- 폼 검증 로직

### 유틸리티 함수 추출 조건
- 2회 이상 사용되는 순수 함수
- 날짜, 통화, 문자열 포맷팅

### 상수 추출 조건
- 매직 넘버/스트링
- 설정값, 카테고리 정의

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
