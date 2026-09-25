import {
  buildCategorySlices,
  buildCategorySlots,
  buildDailySeries,
  buildWeekdayPattern,
  formatCompactWon,
  slotColor,
  type SeriesTransaction,
} from './series';

function tx(date: string, amount: number, type: 'income' | 'expense' = 'expense'): SeriesTransaction {
  return { date, amount, type, category_id: 'c' };
}

describe('buildCategorySlots / buildCategorySlices', () => {
  const categories = [
    { category_id: 'a', name: '식비', icon: 'food' },
    { category_id: 'b', name: '카페', icon: 'cafe' },
    { category_id: 'c', name: '교통', icon: 'transport' },
  ];

  it('구간 지출 순위 상위 6개만 슬롯을 받고 unknown은 제외', () => {
    const slots = buildCategorySlots({ a: 10, b: 30, c: 20, d: 5, e: 4, f: 3, g: 2, unknown: 100 });
    expect([...slots.entries()]).toEqual([
      ['b', 0],
      ['c', 1],
      ['a', 2],
      ['d', 3],
      ['e', 4],
      ['f', 5],
    ]);
    expect(slots.has('g')).toBe(false);
  });

  it('색은 순위가 아니라 카테고리를 따른다', () => {
    const slots = buildCategorySlots({ a: 100, b: 50 });
    // 이번 사이클에선 b가 더 많아도 b는 슬롯 1(두 번째 색) 유지
    const slices = buildCategorySlices({ a: 10, b: 90 }, categories, slots);
    expect(slices.map((s) => [s.id, s.color])).toEqual([
      ['b', 'var(--viz-2)'],
      ['a', 'var(--viz-1)'],
    ]);
    expect(slices[0].share).toBeCloseTo(0.9);
  });

  it('슬롯 없는 카테고리는 기타로 접어 마지막에 둔다', () => {
    const slots = buildCategorySlots({ a: 100 });
    const slices = buildCategorySlices({ a: 10, b: 50, unknown: 40 }, categories, slots);
    expect(slices.map((s) => s.name)).toEqual(['식비', '기타']);
    expect(slices[1]).toMatchObject({ id: 'other', amount: 90, foldedCount: 2, color: 'var(--viz-other)' });
  });

  it('기타가 하나뿐이면 그 이름을 쓴다', () => {
    const slices = buildCategorySlices({ a: 10, c: 5 }, categories, buildCategorySlots({ a: 1 }));
    expect(slices[1].name).toBe('교통');
  });

  it('합계 0이면 빈 배열', () => {
    expect(buildCategorySlices({}, categories, new Map())).toEqual([]);
  });

  it('slotColor 범위 밖은 기타색', () => {
    expect(slotColor(0)).toBe('var(--viz-1)');
    expect(slotColor(6)).toBe('var(--viz-other)');
    expect(slotColor(undefined)).toBe('var(--viz-other)');
  });
});

describe('buildDailySeries', () => {
  const cycle = { start: new Date(2026, 8, 25), end: new Date(2026, 9, 24) };

  it('진행 중 사이클: 오늘까지 경과일로 평균, 오늘/미래 표시', () => {
    const series = buildDailySeries(
      [tx('2026-09-25', 10000), tx('2026-09-26', 20000), tx('2026-09-26', 5000), tx('2026-09-26', 99999, 'income')],
      cycle,
      new Date(2026, 8, 27, 15)
    );
    expect(series.points).toHaveLength(30);
    expect(series.total).toBe(35000);
    expect(series.elapsedDays).toBe(3);
    expect(series.average).toBe(11667);
    expect(series.points[2]).toMatchObject({ date: '2026-09-27', isToday: true, isFuture: false });
    expect(series.points[3].isFuture).toBe(true);
    expect(series.maxPoint?.date).toBe('2026-09-26');
  });

  it('지난 사이클은 전체 일수로 평균', () => {
    const series = buildDailySeries([tx('2026-09-25', 30000)], cycle, new Date(2027, 0, 1));
    expect(series.elapsedDays).toBe(30);
    expect(series.average).toBe(1000);
    expect(series.points.some((p) => p.isToday || p.isFuture)).toBe(false);
  });

  it('미래 사이클은 평균 0', () => {
    const series = buildDailySeries([], cycle, new Date(2026, 0, 1));
    expect(series.average).toBe(0);
    expect(series.maxPoint).toBeNull();
  });
});

describe('buildWeekdayPattern', () => {
  it('요일별 하루 평균 (오늘 이후 제외, 주 시작일 순서)', () => {
    // 2026-09-07(월) ~ 2026-09-20(일) 2주, 오늘은 2026-09-20
    const range = { start: new Date(2026, 8, 7), end: new Date(2026, 8, 30) };
    const pattern = buildWeekdayPattern(
      [tx('2026-09-07', 10000), tx('2026-09-14', 30000), tx('2026-09-19', 8000), tx('2026-09-25', 50000)],
      range,
      new Date(2026, 8, 20),
      1
    );
    expect(pattern.map((p) => p.label)).toEqual(['월', '화', '수', '목', '금', '토', '일']);
    expect(pattern[0]).toMatchObject({ weekday: 1, days: 2, total: 40000, average: 20000 });
    expect(pattern[5]).toMatchObject({ weekday: 6, days: 2, average: 4000 });
    // 오늘 이후(9/25 금) 거래는 제외
    expect(pattern[4].total).toBe(0);
  });
});

describe('formatCompactWon', () => {
  it.each([
    [0, '0'],
    [800, '800'],
    [8000, '8천'],
    [35000, '3.5만'],
    [120000, '12만'],
    [1234567, '123만'],
    [250000000, '2.5억'],
  ])('%d → %s', (value, expected) => {
    expect(formatCompactWon(value)).toBe(expected);
  });
});
