import { test, expect, kstToday } from '../support/fixtures';
import { seedCategories, setPayday, transactionsOf } from '../support/db';
import { cycleOf, monthlyDates, addMonthsYmd, parts } from '../support/dates';

const CRON_SECRET = process.env.E2E_CRON_SECRET || 'local-test-cron-secret';

test.describe('고정지출·할부 자동 생성', () => {
  test('cron이 빠져도 홈 진입 시 이번 사이클 회차가 채워지고, 반복 실행해도 중복이 없다', async ({
    authedPage,
    admin,
    user,
    request,
  }) => {
    const today = kstToday();
    const payday = 25;
    await setPayday(admin, user.id, payday);
    const cats = await seedCategories(admin, user.id);
    const cycle = cycleOf(today, payday);

    // 지난 사이클까지만 생성된 상태 (오늘 cron이 누락된 운영 상황 재현)
    const prevCycleEnd = addMonthsYmd(cycle.start, 0, parts(cycle.start).d - 1);
    const items = [
      { day: 26, memo: '월세', amount: 500000 },
      { day: 5, memo: '보험', amount: 31560 },
      { day: 31, memo: '말일 적금', amount: 100000 },
    ];
    const start = addMonthsYmd(cycle.start, -4, 1);
    for (const it of items) {
      const past = monthlyDates(it.day, start, prevCycleEnd);
      const { data: fixed, error } = await admin
        .from('fixed_transactions')
        .insert({
          user_id: user.id,
          amount: it.amount,
          type: 'expense',
          day: it.day,
          category_id: cats.get('주거/통신'),
          memo: it.memo,
          start_date: past[0],
          end_type: 'never',
          last_generated: past[past.length - 1],
          is_active: true,
        })
        .select('fixed_transaction_id')
        .single();
      expect(error).toBeNull();
      await admin.from('transactions').insert(
        past.map((date) => ({
          user_id: user.id,
          amount: it.amount,
          type: 'expense',
          category_id: cats.get('주거/통신'),
          date,
          memo: it.memo,
          source_fixed_id: fixed!.fixed_transaction_id,
        }))
      );
    }
    const before = (await transactionsOf(admin, user.id)).length;

    await authedPage.goto('/');
    const expectedNew = items.flatMap((it) => monthlyDates(it.day, cycle.start, cycle.end).map((d) => `${d}|${it.memo}`));
    await expect
      .poll(async () => (await transactionsOf(admin, user.id)).length, { timeout: 15_000 })
      .toBe(before + expectedNew.length);

    const rows = await transactionsOf(admin, user.id);
    const inCycle = rows
      .filter((r) => r.date >= cycle.start && r.date <= cycle.end)
      .map((r) => `${r.date}|${r.memo}`)
      .sort();
    expect(inCycle).toEqual(expectedNew.sort());
    expect(rows.filter((r) => r.date >= cycle.start).every((r) => r.input_source === 'recurring')).toBe(true);

    // 캘린더/목록에 반영
    await expect(authedPage.getByText('월세').first()).toBeVisible();

    // 멱등성: cron 2회 + 동기화 재호출
    for (let i = 0; i < 2; i++) {
      const res = await request.get('/api/cron/recurring', { headers: { Authorization: `Bearer ${CRON_SECRET}` } });
      expect(res.status()).toBe(200);
    }
    await authedPage.evaluate(() => localStorage.removeItem('harusari:recurring-sync-date'));
    await authedPage.reload();
    await authedPage.waitForTimeout(1500);
    expect((await transactionsOf(admin, user.id)).length).toBe(before + expectedNew.length);
  });

  test('과거 시작일로 고정 지출을 등록하면 시작월부터 현재 사이클까지 생성된다', async ({ authedPage, admin, user }) => {
    const today = kstToday();
    await seedCategories(admin, user.id);
    const startDate = addMonthsYmd(today, -2, 10);

    await authedPage.goto(`/transactions/new?mode=manual&date=${startDate}`);
    await authedPage.getByPlaceholder('0').first().fill('13500');
    await authedPage.getByRole('button', { name: /카테고리 선택/ }).click();
    await authedPage.getByRole('button', { name: '주거/통신' }).click();
    await authedPage.getByPlaceholder('어떤 내역인가요?').fill('인터넷');
    await authedPage.getByRole('switch').first().click();
    await authedPage.getByRole('button', { name: '저장' }).click();
    await expect(authedPage).toHaveURL(/\/$|\/transactions\/new/);

    const cycle = cycleOf(today, 1);
    const expected = monthlyDates(10, startDate, cycle.end);
    await expect
      .poll(async () => (await transactionsOf(admin, user.id)).filter((r) => r.memo === '인터넷').map((r) => r.date))
      .toEqual(expected);

    const { data: fixed } = await admin.from('fixed_transactions').select('*').eq('user_id', user.id).single();
    expect(fixed).toMatchObject({ start_date: startDate, day: 10, is_active: true, last_generated: expected.at(-1) });
  });

  test('할부 등록: 회차별 금액·메모가 날짜 기준으로 생성되고 끝나면 비활성화된다', async ({ authedPage, admin, user }) => {
    const today = kstToday();
    await seedCategories(admin, user.id);
    const startDate = addMonthsYmd(today, -2, 12);

    await authedPage.goto(`/transactions/new?mode=manual&date=${startDate}`);
    await authedPage.getByPlaceholder('0').first().fill('100000');
    await authedPage.getByRole('button', { name: /카테고리 선택/ }).click();
    await authedPage.getByRole('button', { name: '쇼핑' }).click();
    await authedPage.getByPlaceholder('어떤 내역인가요?').fill('노트북');
    await authedPage.getByRole('button', { name: '할부 결제' }).click();
    // 할부 기간 3개월 (기본값)
    await authedPage.getByRole('button', { name: '저장' }).click();

    const cycle = cycleOf(today, 1);
    const allRounds = monthlyDates(12, startDate, addMonthsYmd(startDate, 2, 12));
    const expected = allRounds.filter((d) => d <= cycle.end);
    await expect
      .poll(async () => (await transactionsOf(admin, user.id)).map((r) => `${r.date}|${r.memo}|${r.amount}`))
      .toEqual(
        expected.map((d, i) => `${d}|노트북 (할부 ${i + 1}/3)|${i === 2 ? 33334 : 33333}`)
      );
    const { data: fixed } = await admin.from('fixed_transactions').select('*').eq('user_id', user.id).single();
    expect(fixed.installment_current_month).toBe(expected.length);
    expect(fixed.is_active).toBe(expected.length < 3);
  });

  test('급여일을 바꾸면 저장되고 새 사이클 기준으로 동기화된다', async ({ authedPage, admin, user }) => {
    await seedCategories(admin, user.id);
    await setPayday(admin, user.id, 1);
    await authedPage.goto('/settings');
    await authedPage.getByRole('combobox').first().click();
    await authedPage.getByRole('option', { name: '매월 25일' }).click();
    await expect(authedPage.getByText(/저장/).first()).toBeVisible();
    await expect
      .poll(async () => (await admin.from('user_settings').select('cycle_start_day').eq('user_id', user.id).single()).data?.cycle_start_day)
      .toBe(25);
  });
});
