import { test, expect, kstToday } from '../support/fixtures';
import { seedCategories, setPayday } from '../support/db';
import { cycleOf } from '../support/dates';

test.describe('통계·지출 지도', () => {
  test('가장 많이 쓴 곳, 지도 마커, 국내/해외 전환', async ({ authedPage, admin, user }) => {
    const today = kstToday();
    await setPayday(admin, user.id, 1);
    const cats = await seedCategories(admin, user.id);
    const { start } = cycleOf(today, 1);
    const place = (name: string, lat: number, lng: number, cc: string, address: string) => ({
      place_name: name,
      place_address: address,
      latitude: lat,
      longitude: lng,
      country_code: cc,
    });
    const hyundai = place('판교 현대백화점', 37.3925, 127.1112, 'KR', '경기 성남시 분당구 판교역로146번길 20');
    const starbucks = place('스타벅스 강남역점', 37.4979, 127.0276, 'KR', '서울 강남구 강남대로 390');
    const ichiran = place('이치란 시부야', 35.6595, 139.7005, 'JP', '渋谷区 神南1-22-7');
    const base = { user_id: user.id, type: 'expense', date: start, input_source: 'manual' };
    const { error } = await admin.from('transactions').insert([
      { ...base, amount: 45000, memo: '셔츠', category_id: cats.get('쇼핑'), ...hyundai },
      { ...base, amount: 32000, memo: '식품관', category_id: cats.get('식비'), ...hyundai, latitude: 37.39252 },
      { ...base, amount: 20000, memo: '선물', category_id: cats.get('쇼핑'), ...hyundai, longitude: 127.11122 },
      { ...base, amount: 5200, memo: '라떼', category_id: cats.get('카페'), ...starbucks },
      { ...base, amount: 12000, memo: '라멘', category_id: cats.get('식비'), ...ichiran },
      { ...base, amount: 9000, memo: '위치 없음', category_id: cats.get('식비'), place_name: null, place_address: null, latitude: null, longitude: null, country_code: null },
    ]);
    expect(error).toBeNull();

    await authedPage.goto('/stats');
    await expect(authedPage.getByText('어디서 썼나')).toBeVisible();
    await expect(authedPage.getByText(/판교 현대백화점.*에서 가장 많이 썼어요/).first()).toBeVisible();
    await expect(authedPage.getByText(/3회/).first()).toBeVisible();

    const map = authedPage.getByRole('region', { name: /지도/ }).first();
    await map.scrollIntoViewIfNeeded();
    await expect(map).toBeVisible();
    // 마커는 canvas 렌더러로 그려진다
    await expect(authedPage.locator('.leaflet-container canvas').first()).toBeAttached({ timeout: 15_000 });

    const ranking = authedPage.locator('ol').filter({ hasText: '판교 현대백화점' }).first();
    await expect(ranking.getByRole('listitem')).toHaveCount(2); // 기본: 지출이 가장 많은 나라(국내)
    await expect(ranking.getByRole('listitem').first()).toContainText('97,000');

    const countryChips = authedPage.getByRole('group', { name: '나라별로 보기' });
    await countryChips.getByRole('button', { name: /일본/ }).click();
    await expect(authedPage.getByText('이치란 시부야').first()).toBeVisible();
    await expect(authedPage.locator('ol li').filter({ hasText: '판교 현대백화점' })).toHaveCount(0);
    await countryChips.getByRole('button', { name: /전체/ }).click();
    await expect(authedPage.locator('ol li').filter({ hasText: /판교 현대백화점|스타벅스 강남역점|이치란 시부야/ })).toHaveCount(3);

    // 순위 항목을 누르면 선택 상태
    await authedPage.locator('ol li button').first().click();
    await expect(authedPage.locator('ol li button').first()).toHaveAttribute('aria-pressed', 'true');

    await authedPage.screenshot({ path: 'e2e/.screens/stats-places.png', fullPage: true });
  });

  test('급여일 31일: 이전/다음 사이클 이동이 멈추거나 건너뛰지 않는다', async ({ authedPage, admin, user }) => {
    await setPayday(admin, user.id, 31);
    await seedCategories(admin, user.id);
    await authedPage.goto('/stats');
    const range = authedPage.locator('[aria-live="polite"] p').first();
    await expect(range).toBeVisible();
    // 설정 로딩 후 급여일 31일 사이클(예: 8.31 ~ 9.29)이 처음부터 보여야 한다 (1일 기준 범위가 번쩍이면 안 됨)
    await expect(range).not.toHaveText(/\.1 \(.\) ~/);

    const seen: string[] = [await range.innerText()];
    for (let i = 0; i < 7; i++) {
      await authedPage.getByRole('button', { name: '이전 사이클' }).click();
      await expect(range).not.toHaveText(seen[seen.length - 1]);
      seen.push(await range.innerText());
    }
    expect(new Set(seen).size).toBe(seen.length);
    // 다시 앞으로 7번 → 처음 사이클로 복귀
    for (let i = 0; i < 7; i++) {
      await authedPage.getByRole('button', { name: '다음 사이클' }).click();
      await expect(range).toHaveText(seen[seen.length - 2 - i]);
    }
  });

  test('?month= 딥링크(월간 알림)로 해당 월 통계를 연다', async ({ authedPage, admin, user }) => {
    await setPayday(admin, user.id, 1);
    await seedCategories(admin, user.id);
    await authedPage.goto('/stats?month=2026-03');
    await expect(authedPage.getByRole('heading', { name: '2026년 3월' })).toBeVisible();
  });
});
