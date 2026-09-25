import { test, expect, kstToday } from '../support/fixtures';
import { seedCategories, setPayday } from '../support/db';
import { addMonthsYmd, cycleOf, monthlyDates } from '../support/dates';

/**
 * 주요 화면 스크린샷 (UI 리뷰용). 실제와 비슷한 한 달치 데이터를 넣고 라이트/다크로 캡처한다.
 * E2E_SCREENS=1 일 때만 실행.
 */
test.skip(!process.env.E2E_SCREENS, 'E2E_SCREENS=1 일 때만 실행');

const PLACES = {
  gs25: { place_name: 'GS25 역삼점', place_address: '서울 강남구 테헤란로 152', latitude: 37.5003, longitude: 127.0364, country_code: 'KR' },
  starbucks: { place_name: '스타벅스 강남역점', place_address: '서울 강남구 강남대로 390', latitude: 37.4979, longitude: 127.0276, country_code: 'KR' },
  kimbap: { place_name: '김밥천국 역삼점', place_address: '서울 강남구 역삼로 180', latitude: 37.4953, longitude: 127.0381, country_code: 'KR' },
  hyundai: { place_name: '판교 현대백화점', place_address: '경기 성남시 분당구 판교역로146번길 20', latitude: 37.3925, longitude: 127.1112, country_code: 'KR' },
  kyobo: { place_name: '교보문고 광화문점', place_address: '서울 종로구 종로 1', latitude: 37.5709, longitude: 126.9778, country_code: 'KR' },
};

for (const scheme of ['light', 'dark'] as const) {
  test(`주요 화면 캡처 (${scheme})`, async ({ authedPage, admin, user }) => {
    await authedPage.emulateMedia({ colorScheme: scheme });
    const today = kstToday();
    await setPayday(admin, user.id, 25);
    const cats = await seedCategories(admin, user.id);
    const cycle = cycleOf(today, 25);
    const prevStart = addMonthsYmd(cycle.start, -1);

    const days = monthlyDates(1, prevStart, today); // 참고용
    void days;
    const tx: Record<string, unknown>[] = [];
    const add = (date: string, amount: number, cat: string, memo: string, place?: Record<string, unknown>, type = 'expense') =>
      tx.push({ user_id: user.id, date, amount, type, category_id: cats.get(cat), memo, input_source: 'manual', ...(place ?? {}) });

    const d = (offset: number) => kstToday(-offset);
    add(cycle.start, 3_200_000, '급여', '월급', undefined, 'income');
    for (let i = 0; i < 12; i++) {
      const date = d(i * 2);
      if (date < prevStart) break;
      add(date, 1400 + (i % 3) * 700, '식비', ['삼각김밥', '컵라면', '샌드위치'][i % 3], PLACES.gs25);
      if (i % 2 === 0) add(date, 4500, '카페', '아이스 아메리카노', PLACES.starbucks);
      if (i % 3 === 0) add(date, 8000 + i * 300, '식비', '점심', PLACES.kimbap);
      if (i % 4 === 1) add(date, 1550, '교통', '지하철');
    }
    add(d(3), 97000, '쇼핑', '셔츠', PLACES.hyundai);
    add(d(5), 23500, '쇼핑', '책', PLACES.kyobo);
    add(d(1), 12300, '교통', '택시');
    add(d(7), 500000, '저축', '적금');
    const { error } = await admin.from('transactions').insert(
      tx.map((t) => ({ place_name: null, place_address: null, latitude: null, longitude: null, country_code: null, ...t }))
    );
    expect(error).toBeNull();
    await admin.from('budget_goals').insert([
      { user_id: user.id, category_id: null, amount: 800000 },
      { user_id: user.id, category_id: cats.get('식비'), amount: 250000 },
      { user_id: user.id, category_id: cats.get('카페'), amount: 60000 },
    ]);
    await admin.from('fixed_transactions').insert([
      { user_id: user.id, amount: 550000, type: 'expense', day: 26, category_id: cats.get('주거/통신'), memo: '월세', start_date: addMonthsYmd(today, -6, 26), end_type: 'never', is_active: true },
      { user_id: user.id, amount: 17000, type: 'expense', day: 11, category_id: cats.get('주거/통신'), memo: '넷플릭스', start_date: addMonthsYmd(today, -6, 11), end_type: 'never', is_active: true },
    ]);

    const shot = async (name: string) => {
      await authedPage.waitForTimeout(1200);
      await authedPage.screenshot({ path: `e2e/.screens/${name}-${scheme}.png`, fullPage: true });
    };

    await authedPage.goto('/');
    await expect(authedPage.getByText('월세').first()).toBeVisible({ timeout: 15_000 });
    await shot('01-home');
    await authedPage.goto('/stats');
    await expect(authedPage.getByText('어디서 썼나')).toBeVisible();
    await shot('02-stats');
    await authedPage.goto('/transactions/quick');
    await authedPage.getByRole('textbox', { name: '쓴 돈을 그냥 적어주세요' }).fill('스벅 아아 4500, 어제 택시 12300\n월급 320만원');
    await authedPage.getByRole('button', { name: '분석', exact: true }).click();
    await expect(authedPage.getByRole('listitem', { name: /번째 내역/ })).toHaveCount(3);
    await shot('03-quick');
    await authedPage.goto('/transactions/new');
    await authedPage.getByPlaceholder('0').first().fill('4800');
    await shot('04-new');
    await authedPage.goto('/recurring');
    await shot('05-recurring');
    await authedPage.goto('/budget-settings');
    await shot('06-budget');
    await authedPage.goto('/categories');
    await shot('07-categories');
    await authedPage.goto('/settings');
    await shot('08-settings');
  });
}
