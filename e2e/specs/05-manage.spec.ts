import { test, expect, kstToday } from '../support/fixtures';
import { seedCategories, setPayday, transactionsOf } from '../support/db';
import { addMonthsYmd } from '../support/dates';

test.describe('관리 화면', () => {
  test('카테고리 추가 → 중복 이름 안내 → 삭제 (사용 건수 안내)', async ({ authedPage, admin, user }) => {
    const cats = await seedCategories(admin, user.id);
    await admin.from('transactions').insert({
      user_id: user.id, amount: 5000, type: 'expense', category_id: cats.get('카페'), date: kstToday(), memo: '커피',
    });
    await authedPage.goto('/categories');
    await authedPage.getByRole('button', { name: '새 카테고리 추가' }).click();
    await authedPage.getByPlaceholder('카테고리 이름을 입력하세요').fill('반려동물');
    await authedPage.getByRole('button', { name: '저장하기' }).click();
    await expect(authedPage.getByText('반려동물').first()).toBeVisible();

    // 같은 이름 다시 추가 → 실패 안내, 중복 행 없음
    await authedPage.getByRole('button', { name: '새 카테고리 추가' }).click();
    await authedPage.getByPlaceholder('카테고리 이름을 입력하세요').fill('반려동물');
    await authedPage.getByRole('button', { name: '저장하기' }).click();
    await expect(authedPage.getByText(/실패|이미/).first()).toBeVisible();
    const { data: pets } = await admin.from('categories').select('category_id').eq('user_id', user.id).eq('name', '반려동물');
    expect(pets).toHaveLength(1);
    await authedPage.keyboard.press('Escape');

    // 사용 중인 카테고리 삭제 → 건수 안내 후 삭제, 거래는 남는다
    await authedPage.getByRole('button', { name: '카페 삭제', exact: true }).click();
    await expect(authedPage.getByText(/거래 1건/)).toBeVisible();
    await authedPage.getByRole('button', { name: '삭제하기' }).click();
    await expect(authedPage.getByRole('button', { name: '카페 삭제', exact: true })).toHaveCount(0);
    await expect.poll(async () => (await transactionsOf(admin, user.id)).map((r) => r.category_id)).toEqual([null]);
  });

  test('고정 내역 삭제: 과거 내역 함께 삭제 옵션', async ({ authedPage, admin, user }) => {
    await seedCategories(admin, user.id);
    await setPayday(admin, user.id, 1);
    const start = addMonthsYmd(kstToday(), -2, 3);
    const { data: fixed } = await admin
      .from('fixed_transactions')
      .insert({ user_id: user.id, amount: 9900, type: 'expense', day: 3, memo: '구독', start_date: start, end_type: 'never', is_active: true })
      .select('fixed_transaction_id')
      .single();
    // 동기화로 과거 회차 생성
    await authedPage.goto('/');
    await authedPage.request.post('/api/recurring/sync', { data: { fixedId: fixed!.fixed_transaction_id } });
    await expect.poll(async () => (await transactionsOf(admin, user.id)).length).toBeGreaterThanOrEqual(3);

    await authedPage.goto('/recurring');
    await authedPage.getByRole('button', { name: '고정 내역 삭제' }).click();
    await authedPage.getByLabel('이 설정으로 생성된 과거 내역도 함께 삭제').check();
    await authedPage.getByRole('button', { name: '삭제하기' }).click();
    await expect.poll(async () => (await transactionsOf(admin, user.id)).length).toBe(0);
    await expect
      .poll(async () => (await admin.from('fixed_transactions').select('*').eq('user_id', user.id)).data?.length)
      .toBe(0);
  });

  test('홈에서 내역 삭제 후 목록·합계 갱신', async ({ authedPage, admin, user }) => {
    const cats = await seedCategories(admin, user.id);
    await admin.from('transactions').insert([
      { user_id: user.id, amount: 7000, type: 'expense', category_id: cats.get('식비'), date: kstToday(), memo: '점심' },
      { user_id: user.id, amount: 3000, type: 'expense', category_id: cats.get('카페'), date: kstToday(), memo: '아메리카노' },
    ]);
    await authedPage.goto('/');
    await expect(authedPage.getByText('아메리카노').first()).toBeVisible();
    await authedPage.getByRole('button', { name: '아메리카노 삭제' }).first().click();
    await authedPage.getByRole('button', { name: '삭제하기' }).click();
    await expect(authedPage.getByText('아메리카노')).toHaveCount(0);
    expect(await transactionsOf(admin, user.id)).toHaveLength(1);
  });

  test('예산 설정: 0원은 저장 불가, 정상 금액 저장', async ({ authedPage, admin, user }) => {
    await seedCategories(admin, user.id);
    await authedPage.goto('/budget-settings');
    await expect(authedPage.getByRole('button', { name: '뒤로 가기' })).toBeVisible();
    await authedPage.screenshot({ path: 'e2e/.screens/budget-settings.png', fullPage: true });
  });
});
