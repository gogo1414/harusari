import { buildReconcilePlan, type FixedItemLite } from './recurring-reconcile';

// today = 2026-06-10 (로컬 기준, 월은 0-based라 5 = 6월)
const TODAY = new Date(2026, 5, 10);

function item(partial: Partial<FixedItemLite> & { fixed_transaction_id: string; day: number }): FixedItemLite {
  return {
    is_active: true,
    end_type: 'never',
    end_date: null,
    is_installment: false,
    ...partial,
  };
}

describe('buildReconcilePlan', () => {
  it('급여일이 그대로면 cycleChanged=false, 액션 없음', () => {
    const plan = buildReconcilePlan({
      fixedItems: [item({ fixed_transaction_id: 'a', day: 26 })],
      oldCycleDay: 25,
      newCycleDay: 25,
      today: TODAY,
    });
    expect(plan.cycleChanged).toBe(false);
    expect(plan.actions).toHaveLength(0);
  });

  it('급여일 25→1: 정리범위는 구∪신 사이클(5/25~6/30)', () => {
    const plan = buildReconcilePlan({
      fixedItems: [],
      oldCycleDay: 25,
      newCycleDay: 1,
      today: TODAY,
    });
    expect(plan.cycleChanged).toBe(true);
    expect(plan.clearWindow.start).toBe('2026-05-25');
    expect(plan.clearWindow.end).toBe('2026-06-30');
  });

  it('급여일 25→1: 활성 고정지출은 새 사이클(6월) 날짜로 재배치', () => {
    const plan = buildReconcilePlan({
      fixedItems: [
        item({ fixed_transaction_id: 'isa', day: 26 }),   // 구 사이클에선 5/26 → 신 사이클 6/26
        item({ fixed_transaction_id: 'netflix', day: 11 }),// 6/11
        item({ fixed_transaction_id: 'db', day: 5 }),      // 6/5
      ],
      oldCycleDay: 25,
      newCycleDay: 1,
      today: TODAY,
    });
    const byId = Object.fromEntries(plan.actions.map(a => [a.fixedId, a.targetDate]));
    expect(byId['isa']).toBe('2026-06-26');
    expect(byId['netflix']).toBe('2026-06-11');
    expect(byId['db']).toBe('2026-06-05');
    expect(plan.actions).toHaveLength(3);
  });

  it('비활성·할부·종료된 항목은 skip', () => {
    const plan = buildReconcilePlan({
      fixedItems: [
        item({ fixed_transaction_id: 'inactive', day: 10, is_active: false }),
        item({ fixed_transaction_id: 'installment', day: 10, is_installment: true }),
        item({ fixed_transaction_id: 'ended', day: 10, end_type: 'date', end_date: '2026-05-01' }),
        item({ fixed_transaction_id: 'ok', day: 10 }),
      ],
      oldCycleDay: 25,
      newCycleDay: 1,
      today: TODAY,
    });
    expect(plan.actions.map(a => a.fixedId)).toEqual(['ok']);
    expect(plan.skipped).toEqual(expect.arrayContaining(['inactive', 'installment', 'ended']));
  });

  it('말일 보정: day=31, 6월(30일)이면 6/30으로', () => {
    const plan = buildReconcilePlan({
      fixedItems: [item({ fixed_transaction_id: 'nh', day: 31 })],
      oldCycleDay: 25,
      newCycleDay: 1,
      today: TODAY,
    });
    expect(plan.actions[0].targetDate).toBe('2026-06-30');
  });
});
