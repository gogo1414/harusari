import type { Config } from 'jest';
import nextJest from 'next/jest.js';

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files in your test environment
  dir: './',
});

// Add any custom config to be passed to Jest
const config: Config = {
  coverageProvider: 'v8',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  testMatch: ['**/__tests__/**/*.[jt]s?(x)', '**/?(*.)+(spec|test).[jt]s?(x)'],
  testPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/tests/',      // Playwright E2E 테스트 제외
    '<rootDir>/.claude/',    // Claude 워크트리 제외
  ],
  // 커버리지 수집 대상: 테스트가 작성된 핵심 애플리케이션 코드만 포함
  // (Shadcn UI 컴포넌트, Supabase 클라이언트, API 라우트, 미테스트 컴포넌트 제외)
  collectCoverageFrom: [
    // 순수 로직 라이브러리
    'lib/date.ts',
    'lib/format.ts',
    'lib/utils.ts',
    'lib/installment.ts',
    'lib/installment-logic.ts',
    // 훅
    'hooks/useDailySurvival.ts',
    // 핵심 컴포넌트
    'components/calendar/Calendar.tsx',
    'components/animation/AnimatedNumber.tsx',
    'components/budget/BudgetGoalItem.tsx',
    'components/charts/CategoryChart.tsx',
    'components/charts/TrendChart.tsx',
    'components/common/EmptyState.tsx',
    'components/common/Skeleton.tsx',
    'components/category/IconPicker.tsx',
    'components/forms/TransactionForm.tsx',
    'components/stats/StatsDateNavigator.tsx',
    'components/stats/StatsTotalInsight.tsx',
    // 반복/고정 거래 컴포넌트
    'app/recurring/components/RecurringSummary.tsx',
    'app/recurring/components/RecurringItem.tsx',
  ],
};

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
export default createJestConfig(config);
