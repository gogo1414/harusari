import { test, expect, kstToday } from '../support/fixtures';
import { seedCategories, transactionsOf } from '../support/db';

test.describe('AI 빠른 입력과 위치', () => {
  test('문장으로 여러 건 입력 → 확인 → 저장, 오늘 내역에만 현재 위치', async ({ authedPage, admin, user }) => {
    const cats = await seedCategories(admin, user.id);
    const today = kstToday();
    const yesterday = kstToday(-1);

    await authedPage.goto('/');
    await authedPage.getByRole('button', { name: '새 내역 추가' }).click();
    await expect(authedPage).toHaveURL(/\/transactions\/new/);
    // 처음 쓰는 사용자는 '문장으로' 입력이 기본
    await expect(authedPage.getByRole('radio', { name: '문장으로' })).toHaveAttribute('aria-checked', 'true');

    // 위치 자동 추가(강남역 좌표 → 주변 장소/주소)
    await expect(authedPage.getByText('위치 확인 중').first()).toBeHidden({ timeout: 20_000 });

    await authedPage.getByLabel('쓴 돈을 그냥 적어주세요').fill('삼각김밥 1400원\n어제 택시 12,300');
    await authedPage.getByRole('button', { name: '분석', exact: true }).click();

    const cards = authedPage.getByRole('listitem', { name: /번째 내역/ });
    await expect(cards).toHaveCount(2);
    await expect(authedPage.getByLabel('1번째 내역 금액(원)')).toHaveValue('1,400');
    await expect(authedPage.getByLabel('2번째 내역 금액(원)')).toHaveValue('12,300');
    await expect(authedPage.getByLabel('2번째 내역 날짜')).toHaveValue(yesterday);

    // 금액 수정 후 저장
    await authedPage.getByLabel('1번째 내역 금액(원)').fill('1500');
    await authedPage.getByRole('button', { name: /2건 저장하기/ }).click();
    await expect(authedPage).toHaveURL(/\/$/);

    const rows = await transactionsOf(admin, user.id);
    expect(rows).toHaveLength(2);
    const kimbap = rows.find((r) => r.memo === '삼각김밥')!;
    const taxi = rows.find((r) => r.memo === '택시')!;
    expect(kimbap).toMatchObject({ amount: 1500, date: today, input_source: 'ai', category_id: cats.get('식비') });
    expect(taxi).toMatchObject({ amount: 12300, date: yesterday, input_source: 'ai', category_id: cats.get('교통') });
    // 오늘 내역만 위치 부착 (어제 택시에 지금 위치를 붙이지 않음)
    expect(kimbap.latitude).not.toBeNull();
    expect(Math.abs((kimbap.latitude as number) - 37.4979)).toBeLessThan(0.01);
    expect(taxi.latitude).toBeNull();
  });

  test('카테고리를 못 고르면 저장 전에 알려준다', async ({ authedPage, admin, user }) => {
    await seedCategories(admin, user.id);
    // 예전 주소는 합쳐진 입력 화면(문장 모드)으로 이동
    await authedPage.goto('/transactions/quick');
    await expect(authedPage).toHaveURL(/\/transactions\/new\?mode=quick/);
    await authedPage.getByLabel('쓴 돈을 그냥 적어주세요').fill('뭔가 777원');
    await authedPage.getByRole('button', { name: '분석', exact: true }).click();
    await expect(authedPage.getByRole('listitem', { name: /번째 내역/ })).toHaveCount(1);
    await authedPage.getByRole('button', { name: /1건 저장하기/ }).click();
    await expect(authedPage.getByRole('alert').filter({ hasText: '카테고리를 골라 주세요' })).toBeVisible();
    expect(await transactionsOf(admin, user.id)).toHaveLength(0);

    await authedPage.getByRole('button', { name: /1번째 내역 카테고리 선택/ }).click();
    await authedPage.getByRole('button', { name: '쇼핑' }).click();
    await authedPage.getByRole('button', { name: /1건 저장하기/ }).click();
    await expect(authedPage).toHaveURL(/\/$/);
    expect(await transactionsOf(admin, user.id)).toHaveLength(1);
  });

  test('일반 입력: 위치 자동 추가 → 수정 화면에서 위치 삭제', async ({ authedPage, admin, user }) => {
    await seedCategories(admin, user.id);
    await authedPage.goto('/transactions/new');
    await authedPage.getByRole('radio', { name: '직접 입력' }).click();
    await expect(authedPage).toHaveURL(/mode=manual/);
    await authedPage.getByPlaceholder('0').first().fill('4800');
    await authedPage.getByRole('button', { name: /카테고리 선택/ }).click();
    await authedPage.getByRole('button', { name: '카페' }).click();
    await authedPage.getByPlaceholder('어떤 내역인가요?').fill('라떼');
    await expect(authedPage.getByText('위치 확인 중').first()).toBeHidden({ timeout: 20_000 });
    await authedPage.getByRole('button', { name: '저장' }).click();
    await expect(authedPage).toHaveURL(/\/$/);

    let [row] = await transactionsOf(admin, user.id);
    expect(row.latitude).not.toBeNull();
    expect(row.input_source).toBe('manual');

    // 목록에 장소 표시
    const label = (row.place_name || row.place_address) as string;
    await expect(authedPage.getByText(label).first()).toBeVisible();

    await authedPage.goto(`/transactions/edit/${row.transaction_id}`);
    await authedPage.getByRole('button', { name: /위치 빼기|위치 삭제|위치 제거/ }).first().click();
    await expect(authedPage.getByRole('button', { name: '위치 추가' })).toBeVisible();
    await authedPage.getByRole('button', { name: /원 수정$/ }).click();
    await expect.poll(async () => (await transactionsOf(admin, user.id))[0].latitude).toBeNull();
    [row] = await transactionsOf(admin, user.id);
    expect(row).toMatchObject({ amount: 4800, memo: '라떼' });
  });

  test('입력 방식은 마지막 선택을 기억하고, 캘린더에서 고른 날짜가 문장 입력의 기본 날짜가 된다', async ({ authedPage, admin, user }) => {
    await seedCategories(admin, user.id);
    await authedPage.goto('/transactions/new');
    await authedPage.getByRole('radio', { name: '직접 입력' }).click();
    await expect(authedPage.getByPlaceholder('어떤 내역인가요?')).toBeVisible();
    await authedPage.goto('/transactions/new');
    await expect(authedPage.getByRole('radio', { name: '직접 입력' })).toHaveAttribute('aria-checked', 'true');

    const picked = kstToday(-5);
    await authedPage.goto(`/transactions/new?date=${picked}`);
    await authedPage.getByRole('radio', { name: '문장으로' }).click();
    await expect(authedPage).toHaveURL(new RegExp(`date=${picked}`));
    await authedPage.getByLabel('쓴 돈을 그냥 적어주세요').fill('커피 4500\n어제 택시 12300');
    await authedPage.getByRole('button', { name: '분석', exact: true }).click();
    await expect(authedPage.getByLabel('1번째 내역 날짜')).toHaveValue(picked);
    await expect(authedPage.getByLabel('2번째 내역 날짜')).toHaveValue(kstToday(-1));
  });
});
