import { defineConfig, devices } from '@playwright/test';

/**
 * 로컬 Supabase(도커) + next start 대상 E2E.
 * 실행 방법은 e2e/README.md 참고. 운영 DB에는 절대 연결하지 않는다.
 */
const baseURL = process.env.E2E_BASE_URL || 'http://localhost:3100';
const executablePath = process.env.E2E_CHROMIUM_PATH || undefined;

export default defineConfig({
  testDir: './specs',
  outputDir: './.results',
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [['list']],
  use: {
    baseURL,
    locale: 'ko-KR',
    timezoneId: 'Asia/Seoul',
    // 강남역 근처 (위치 자동 추가 검증용)
    geolocation: { latitude: 37.4979, longitude: 127.0276, accuracy: 20 },
    permissions: ['geolocation'],
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: executablePath ? { executablePath } : undefined,
  },
  projects: [
    {
      name: 'mobile',
      use: { ...devices['Pixel 7'], browserName: 'chromium' },
    },
  ],
});
