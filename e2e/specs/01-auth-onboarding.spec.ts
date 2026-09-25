import { test, expect } from '../support/fixtures';

test('비로그인 사용자는 로그인 화면으로 이동한다', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/login/);
  await page.goto('/stats');
  await expect(page).toHaveURL(/\/login/);
});

test('API 라우트는 비로그인 시 401', async ({ request }) => {
  const parse = await request.post('/api/ai/parse', { data: { text: '커피 4500' }, maxRedirects: 0 });
  expect([401, 307]).toContain(parse.status());
  const sync = await request.post('/api/recurring/sync', { maxRedirects: 0 });
  expect([401, 307]).toContain(sync.status());
  const cron = await request.get('/api/cron/recurring');
  expect(cron.status()).toBe(401);
});

test('첫 로그인 시 기본 카테고리가 한 번만 생성된다 (탭 2개 동시 진입)', async ({ authedPage, context, admin, user }) => {
  const second = await context.newPage();
  await Promise.all([authedPage.goto('/'), second.goto('/')]);
  await expect(authedPage.getByRole('button', { name: '새 내역 추가' })).toBeVisible();

  await expect
    .poll(async () => {
      const { count } = await admin
        .from('categories')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);
      return count;
    })
    .toBeGreaterThan(0);

  // 두 탭 모두 안정될 시간을 준 뒤 중복 여부 확인
  await authedPage.waitForTimeout(2000);
  const { data } = await admin.from('categories').select('name, type').eq('user_id', user.id);
  const keys = (data ?? []).map((c) => `${c.type}:${c.name}`);
  expect(new Set(keys).size).toBe(keys.length);
});

test('로그인 상태로 /login에 가면 홈으로 이동한다', async ({ authedPage }) => {
  await authedPage.goto('/login');
  await expect(authedPage).toHaveURL(/\/$/);
});
