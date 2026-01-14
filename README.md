# 하루살이 (Harusari) 💸

**"오늘 벌어 오늘 사는, 가장 심플한 1인 가계부"**

하루살이는 복잡한 자산 관리보다는 당장의 수입과 지출에 집중하여, 직관적이고 빠르게 소비 흐름을 파악할 수 있도록 돕는 웹 애플리케이션입니다.

## ✨ 주요 기능

- **📅 캘린더 뷰**: 월별 수입/지출 현황을 달력 형태로 한눈에 파악
- **📝 간편한 거래 내역 입력**: 수입/지출을 빠르게 기록하고 카테고리 분류
- **📊 통계 분석**: 카테고리별 지출 비중 및 월별 추이 분석 (Recharts 활용)
- **⚙️ 설정 관리**: 급여일 기준 월 시작일 설정, 다크 모드 지원
- **🔄 고정 지출/수입 관리**: 매월 반복되는 내역 자동 관리
- **📱 PWA 지원**: 모바일 앱처럼 홈 화면에 추가하여 사용 가능

## 🛠 기술 스택

- **Framework**: [Next.js 14](https://nextjs.org/) (App Router)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **UI Components**: [Shadcn/ui](https://ui.shadcn.com/) (Radix UI 기반)
- **Icons**: [Lucide React](https://lucide.dev/)
- **State Management**: [TanStack Query (React Query)](https://tanstack.com/query/latest)
- **Database & Auth**: [Supabase](https://supabase.com/)
- **Testing**:
  - Unit: [Jest](https://jestjs.io/), [React Testing Library](https://testing-library.com/)
  - E2E: [Playwright](https://playwright.dev/)

## 🚀 시작하기 (Getting Started)

### 1. 레포지토리 클론

```bash
git clone https://github.com/your-username/harusari.git
cd harusari
```

### 2. 패키지 설치

```bash
npm install
```

### 3. 환경 변수 설정

`.env.local` 파일을 생성하고 Supabase 관련 키를 입력하세요.

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### 4. 개발 서버 실행

```bash
npm run dev
```

브라우저에서 `http://localhost:3000`으로 접속하여 확인합니다.

## 🧪 테스트 실행

### 단위 테스트 (Unit Test)

```bash
npm test
```

### E2E 테스트 (Playwright)

```bash
npx playwright test
```

## 📂 프로젝트 구조

```
harusari/
├── app/                  # Next.js App Router 페이지 및 레이아웃
│   ├── components/       # 페이지별 하위 컴포넌트
│   ├── context/          # React Context (전역 상태)
│   ├── login/            # 로그인 페이지
│   ├── settings/         # 설정 페이지
│   ├── stats/            # 통계 페이지
│   └── page.tsx          # 메인(홈) 페이지
├── components/           # 공통 UI 컴포넌트 (shadcn/ui 등)
├── lib/                  # 유틸리티 함수 및 라이브러리 설정 (Supabase 등)
├── types/                # TypeScript 타입 정의
├── tests/                # Playwright E2E 테스트 코드
└── public/               # 정적 파일 (이미지, 아이콘 등)
```

## 🤝 컨벤션 (Convention)

### 커밋 메시지 규칙

- `feat`: 새로운 기능 추가
- `fix`: 버그 수정
- `docs`: 문서 수정
- `style`: 코드 포맷팅, 세미콜론 누락 등 (코드 변경 없음)
- `refactor`: 코드 리팩토링
- `test`: 테스트 코드 추가
- `chore`: 빌드 업무 수정, 패키지 매니저 수정 등

예시: `feat: 카테고리 아이콘 선택 기능 구현`

## 📄 라이선스

This project is licensed under the MIT License.
