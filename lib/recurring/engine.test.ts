import { format, addDays, parseISO } from 'date-fns';
import { getCycleRange } from '@/lib/date';
import {
  planRecurringGeneration,
  clampedDateStr,
  addOneDayStr,
  buildInstallmentMemo,
  type RecurringSource,
} from './engine';

function makeItem(overrides: Partial<RecurringSource> = {}): RecurringSource {
  return {
    fixed_transaction_id: 'f1',
    user_id: 'u1',
    amount: 10000,
    type: 'expense',
    day: 15,
    category_id: 'c1',
    memo: '월세',
    start_date: '2026-01-15',
    end_type: 'never',
    end_date: null,
    last_generated: null,
    is_active: true,
    is_installment: false,
    installment_principal: null,
    installment_months: null,
    installment_rate: null,
    installment_free_months: null,
    ...overrides,
  };
}

/**
 * 매일 cron(현재 사이클 모드)을 돌리는 시뮬레이션.
 * 생성된 날짜 목록과 최종 항목 상태를 돌려준다.
 */
function simulateDailyCron(
  initial: RecurringSource,
  cycleDay: number,
  fromDay: string,
  toDay: string
): { dates: string[]; rows: { date: string; amount: number; memo: string | null }[]; item: RecurringSource } {
  let item = { ...initial };
  const created = new Map<string, { date: string; amount: number; memo: string | null }>();
  for (let d = parseISO(fromDay); format(d, 'yyyy-MM-dd') <= toDay; d = addDays(d, 1)) {
    if (item.is_active === false) break;
    const cycle = getCycleRange(d, cycleDay);
    const plan = planRecurringGeneration(item, format(cycle.end, 'yyyy-MM-dd'), {
      floor: format(cycle.start, 'yyyy-MM-dd'),
    });
    for (const row of plan.rows) {
      // DB 유니크 인덱스 (source_fixed_id, date) + DO NOTHING 재현
      if (!created.has(row.date)) created.set(row.date, { date: row.date, amount: row.amount, memo: row.memo });
    }
    if (plan.fixedUpdate) item = { ...item, ...plan.fixedUpdate } as RecurringSource;
  }
  const rows = [...created.values()].sort((a, b) => a.date.localeCompare(b.date));
  return { dates: rows.map((r) => r.date), rows, item };
}

function expectedMonthlyDates(start: string, day: number, until: string): string[] {
  const out: string[] = [];
  const s = parseISO(start);
  for (let i = 0; ; i++) {
    const date = clampedDateStr(s.getFullYear(), s.getMonth() + i, day);
    if (date > until) break;
    if (date >= start) out.push(date);
  }
  return out;
}

describe('clampedDateStr / addOneDayStr', () => {
  test('말일 클램프와 연도 경계 정규화', () => {
    expect(clampedDateStr(2026, 1, 31)).toBe('2026-02-28');
    expect(clampedDateStr(2028, 1, 30)).toBe('2028-02-29');
    expect(clampedDateStr(2026, 12, 5)).toBe('2027-01-05');
    expect(clampedDateStr(2026, -1, 31)).toBe('2025-12-31');
  });

  test('하루 더하기는 월/연 경계를 넘는다', () => {
    expect(addOneDayStr('2026-02-28')).toBe('2026-03-01');
    expect(addOneDayStr('2026-12-31')).toBe('2027-01-01');
  });
});

describe('planRecurringGeneration: 일반 고정', () => {
  test('등록 백필: 시작일부터 horizon까지 매달 1건', () => {
    const plan = planRecurringGeneration(makeItem({ start_date: '2026-06-15' }), '2026-09-30');
    expect(plan.rows.map((r) => r.date)).toEqual(['2026-06-15', '2026-07-15', '2026-08-15', '2026-09-15']);
    expect(plan.fixedUpdate).toEqual({ last_generated: '2026-09-15' });
    expect(plan.rows[0].input_source).toBe('recurring');
  });

  test('미래 시작 항목은 시작일 전에 생성하지 않는다', () => {
    const plan = planRecurringGeneration(makeItem({ start_date: '2026-10-05', day: 5 }), '2026-09-30');
    expect(plan.rows).toHaveLength(0);
    expect(plan.fixedUpdate).toBeNull();
  });

  test('last_generated 다음 날부터 이어서 생성 (중간 누락 복구)', () => {
    const plan = planRecurringGeneration(makeItem({ last_generated: '2026-07-15' }), '2026-09-30');
    expect(plan.rows.map((r) => r.date)).toEqual(['2026-08-15', '2026-09-15']);
  });

  test('fromStart: 다른 동기화가 먼저 last_generated를 올려도 백필은 시작일부터 채우고 last_generated는 되돌리지 않는다', () => {
    const plan = planRecurringGeneration(
      makeItem({ start_date: '2026-07-15', last_generated: '2026-09-15' }),
      '2026-09-30',
      { fromStart: true }
    );
    expect(plan.rows.map((r) => r.date)).toEqual(['2026-07-15', '2026-08-15', '2026-09-15']);
    expect(plan.fixedUpdate).toBeNull();
  });

  test('floor 이전 회차는 소급 생성하지 않는다', () => {
    const plan = planRecurringGeneration(makeItem({ last_generated: '2026-05-15' }), '2026-09-30', {
      floor: '2026-09-01',
    });
    expect(plan.rows.map((r) => r.date)).toEqual(['2026-09-15']);
  });

  test('종료일 당일까지 포함하고, 종료되면 비활성화', () => {
    const plan = planRecurringGeneration(
      makeItem({ start_date: '2026-07-15', end_type: 'date', end_date: '2026-08-15' }),
      '2026-09-30'
    );
    expect(plan.rows.map((r) => r.date)).toEqual(['2026-07-15', '2026-08-15']);
    expect(plan.fixedUpdate?.is_active).toBe(false);
  });

  test('비활성 항목은 아무것도 하지 않는다', () => {
    const plan = planRecurringGeneration(makeItem({ is_active: false }), '2026-09-30');
    expect(plan).toEqual({ rows: [], fixedUpdate: null });
  });

  test('급여일 31일 + 결제일 30일: 2년간 매일 cron을 돌려도 매달 정확히 1건 (누락/중복 없음)', () => {
    const item = makeItem({ day: 30, start_date: '2026-01-30' });
    const { dates } = simulateDailyCron(item, 31, '2026-01-30', '2027-12-31');
    const cycleEndAtFinish = format(getCycleRange(parseISO('2027-12-31'), 31).end, 'yyyy-MM-dd');
    expect(dates).toEqual(expectedMonthlyDates('2026-01-30', 30, cycleEndAtFinish));
  });

  test.each([
    [29, 28],
    [31, 30],
    [30, 31],
    [25, 28],
    [1, 31],
    [15, 1],
  ])('급여일 %i일 + 결제일 %i일 조합에서 결제 누락 없음', (cycleDay, day) => {
    const item = makeItem({ day, start_date: clampedDateStr(2026, 0, day) });
    const { dates } = simulateDailyCron(item, cycleDay, item.start_date!, '2028-03-31');
    const until = format(getCycleRange(parseISO('2028-03-31'), cycleDay).end, 'yyyy-MM-dd');
    expect(dates).toEqual(expectedMonthlyDates(item.start_date!, day, until));
  });
});

describe('planRecurringGeneration: 할부', () => {
  const installment = (overrides: Partial<RecurringSource> = {}) =>
    makeItem({
      is_installment: true,
      installment_principal: 300000,
      installment_months: 3,
      installment_rate: 0,
      installment_free_months: 0,
      memo: '노트북',
      day: 28,
      start_date: '2026-07-28',
      end_type: 'date',
      end_date: '2026-10-28',
      ...overrides,
    });

  test('회차는 카운터가 아니라 시작월과의 개월 차로 결정된다', () => {
    const plan = planRecurringGeneration(installment(), '2026-09-24');
    expect(plan.rows.map((r) => [r.date, r.memo])).toEqual([
      ['2026-07-28', '노트북 (할부 1/3)'],
      ['2026-08-28', '노트북 (할부 2/3)'],
    ]);
    expect(plan.fixedUpdate).toMatchObject({ installment_current_month: 2, last_generated: '2026-08-28' });
  });

  test('회귀: 백필(달력 월)과 cron(사이클)이 섞여도 회차가 사라지지 않는다 (급여일 25일)', () => {
    // 6개월 할부, 7/28 시작을 9/10에 등록 → 등록 백필은 현재 사이클(8/25~9/24) 종료일까지
    const item = installment({ installment_months: 6, installment_principal: 600000, end_date: '2027-01-28' });
    const backfill = planRecurringGeneration(item, format(getCycleRange(parseISO('2026-09-10'), 25).end, 'yyyy-MM-dd'));
    const afterBackfill = { ...item, ...backfill.fixedUpdate } as RecurringSource;
    const { rows, item: finalItem } = simulateDailyCron(afterBackfill, 25, '2026-09-10', '2027-03-31');

    const all = [...backfill.rows.map((r) => ({ date: r.date, memo: r.memo })), ...rows];
    const memos = [...new Map(all.map((r) => [r.date, r.memo])).values()];
    expect(memos).toEqual([1, 2, 3, 4, 5, 6].map((n) => `노트북 (할부 ${n}/6)`));
    expect(finalItem.is_active).toBe(false);
  });

  test('회귀: 1회차가 누락되지 않는다 (미래 시작, 급여일 1일)', () => {
    const item = installment({ start_date: '2026-10-05', day: 5, end_date: '2027-01-05' });
    const { rows } = simulateDailyCron(item, 1, '2026-09-25', '2027-02-28');
    expect(rows.map((r) => [r.date, r.memo])).toEqual([
      ['2026-10-05', '노트북 (할부 1/3)'],
      ['2026-11-05', '노트북 (할부 2/3)'],
      ['2026-12-05', '노트북 (할부 3/3)'],
    ]);
  });

  test('마지막 회차 금액은 원금 자투리를 포함한다', () => {
    const plan = planRecurringGeneration(installment({ installment_principal: 100000 }), '2026-12-31');
    expect(plan.rows.map((r) => r.amount)).toEqual([33333, 33333, 33334]);
    expect(plan.fixedUpdate?.is_active).toBe(false);
  });

  test('원금/개월이 잘못된 할부는 비활성화한다', () => {
    const plan = planRecurringGeneration(installment({ installment_principal: 0 }), '2026-12-31');
    expect(plan).toEqual({ rows: [], fixedUpdate: { is_active: false } });
  });

  test('start_date가 없는 레거시 할부는 end_date - 개월로 시작일을 추정한다', () => {
    const plan = planRecurringGeneration(installment({ start_date: null }), '2026-08-31');
    expect(plan.rows[0]).toMatchObject({ date: '2026-07-28', memo: '노트북 (할부 1/3)' });
  });
});

describe('buildInstallmentMemo', () => {
  test('기존 회차 꼬리표를 교체한다', () => {
    expect(buildInstallmentMemo('노트북 (할부 1/3)', 2, 3)).toBe('노트북 (할부 2/3)');
    expect(buildInstallmentMemo(null, 1, 2)).toBe('(할부 1/2)');
  });
});
