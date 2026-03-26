import { renderHook } from '@testing-library/react';
import { useDailySurvival } from '@/hooks/useDailySurvival';
import type { Transaction } from '@/types/database';
import type { BudgetGoalWithCategory } from '@/hooks/useBudgetGoals';

// 테스트용 헬퍼
function makeTransaction(
  category_id: string,
  amount: number,
  type: 'expense' | 'income' = 'expense',
  source_fixed_id: string | null = null
): Transaction {
  return {
    transaction_id: `${category_id}-${amount}`,
    user_id: 'u1',
    amount,
    type,
    category_id,
    date: '2026-03-15',
    created_at: new Date().toISOString(),
    memo: null,
    source_fixed_id,
  };
}

function makeGoal(
  category_id: string,
  amount: number,
  categoryName = '식비'
): BudgetGoalWithCategory {
  return {
    id: `goal-${category_id}`,
    user_id: 'u1',
    category_id,
    amount,
    updated_at: new Date().toISOString(),
    category: { name: categoryName, icon: 'food', type: 'expense' },
  };
}

// 사이클 종료일: 오늘로부터 14일 후
function getCycleEnd(daysFromNow: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d;
}

describe('useDailySurvival', () => {
  describe('예산 미설정 시', () => {
    it('hasBudget=false, dailyAvailable=0, status=unknown을 반환한다', () => {
      const { result } = renderHook(() =>
        useDailySurvival({
          transactions: [],
          budgetGoals: [],
          cycleEndDate: getCycleEnd(14),
        })
      );

      expect(result.current.hasBudget).toBe(false);
      expect(result.current.dailyAvailable).toBe(0);
      expect(result.current.remainingBudget).toBe(0);
      expect(result.current.status).toBe('unknown');
    });
  });

  describe('예산 설정 시 - 안전 상태', () => {
    it('지출이 적으면 safe 상태이고 하루 권장 금액이 계산된다', () => {
      const goals = [makeGoal('cat-food', 300000, '식비')];
      const transactions = [makeTransaction('cat-food', 30000)]; // 10% 사용

      const { result } = renderHook(() =>
        useDailySurvival({
          transactions,
          budgetGoals: goals,
          cycleEndDate: getCycleEnd(14),
        })
      );

      expect(result.current.hasBudget).toBe(true);
      expect(result.current.status).toBe('safe');
      expect(result.current.dailyAvailable).toBeGreaterThan(0);
      expect(result.current.remainingBudget).toBe(270000);
      expect(result.current.totalBudgetGoal).toBe(300000);
      expect(result.current.currentSpent).toBe(30000);
    });
  });

  describe('예산 설정 시 - 경고/위험 상태', () => {
    it('50% 이상 사용 시 warning 상태이다', () => {
      const goals = [makeGoal('cat-food', 300000)];
      const transactions = [makeTransaction('cat-food', 160000)]; // 53% 사용

      const { result } = renderHook(() =>
        useDailySurvival({
          transactions,
          budgetGoals: goals,
          cycleEndDate: getCycleEnd(10),
        })
      );

      expect(result.current.categoryStats[0].status).toBe('warning');
    });

    it('80% 이상 사용 시 danger 상태이다', () => {
      const goals = [makeGoal('cat-food', 300000)];
      const transactions = [makeTransaction('cat-food', 250000)]; // 83% 사용

      const { result } = renderHook(() =>
        useDailySurvival({
          transactions,
          budgetGoals: goals,
          cycleEndDate: getCycleEnd(10),
        })
      );

      expect(result.current.categoryStats[0].status).toBe('danger');
    });

    it('예산을 초과하면 remaining이 음수이고 danger 상태이다', () => {
      const goals = [makeGoal('cat-food', 100000)];
      const transactions = [makeTransaction('cat-food', 150000)]; // 150% 사용

      const { result } = renderHook(() =>
        useDailySurvival({
          transactions,
          budgetGoals: goals,
          cycleEndDate: getCycleEnd(5),
        })
      );

      expect(result.current.categoryStats[0].remaining).toBe(-50000);
      expect(result.current.categoryStats[0].status).toBe('danger');
    });

    it('dailyAvailable이 0 이하이면 전체 status가 danger이다', () => {
      const goals = [makeGoal('cat-food', 300000)];
      // 지출이 예산보다 많으면 dailyAvailable <= 0
      const transactions = [makeTransaction('cat-food', 350000)];

      const { result } = renderHook(() =>
        useDailySurvival({
          transactions,
          budgetGoals: goals,
          cycleEndDate: getCycleEnd(5),
        })
      );

      expect(result.current.dailyAvailable).toBeLessThanOrEqual(0);
      expect(result.current.status).toBe('danger');
    });
  });

  describe('전체 status - warning 상태', () => {
    it('dailyAvailable이 (budget/30)*0.5 미만이면 warning 상태이다', () => {
      // budget=300,000, budget/30=10,000, 임계치=5,000
      // 지출=290,000 → 잔액=10,000, 남은 일수=3일, daily=3,333 < 5,000 → warning
      const goals = [makeGoal('cat-food', 300000)];
      const transactions = [makeTransaction('cat-food', 290000)];

      const { result } = renderHook(() =>
        useDailySurvival({
          transactions,
          budgetGoals: goals,
          cycleEndDate: getCycleEnd(3),
        })
      );

      expect(result.current.status).toBe('warning');
    });
  });

  describe('카테고리 통계', () => {
    it('고정 지출(source_fixed_id 있음)은 카테고리 지출에 포함되지 않는다', () => {
      const goals = [makeGoal('cat-food', 100000)];
      const transactions = [
        makeTransaction('cat-food', 30000, 'expense', null),       // 일반 지출
        makeTransaction('cat-food', 50000, 'expense', 'fixed-1'),  // 고정 지출 -> 제외
      ];

      const { result } = renderHook(() =>
        useDailySurvival({
          transactions,
          budgetGoals: goals,
          cycleEndDate: getCycleEnd(10),
        })
      );

      // 일반 지출 30000만 카운트
      expect(result.current.categoryStats[0].spent).toBe(30000);
    });

    it('수입 트랜잭션은 카테고리 지출 계산에 포함되지 않는다', () => {
      const goals = [makeGoal('cat-food', 100000)];
      const transactions = [
        makeTransaction('cat-food', 20000, 'expense'),
        makeTransaction('cat-food', 80000, 'income'), // 수입 -> 제외
      ];

      const { result } = renderHook(() =>
        useDailySurvival({
          transactions,
          budgetGoals: goals,
          cycleEndDate: getCycleEnd(10),
        })
      );

      expect(result.current.categoryStats[0].spent).toBe(20000);
    });

    it('여러 카테고리의 목표를 각각 집계한다', () => {
      const goals = [
        makeGoal('cat-food', 200000, '식비'),
        makeGoal('cat-transport', 100000, '교통'),
      ];
      const transactions = [
        makeTransaction('cat-food', 50000),
        makeTransaction('cat-transport', 80000),
      ];

      const { result } = renderHook(() =>
        useDailySurvival({
          transactions,
          budgetGoals: goals,
          cycleEndDate: getCycleEnd(10),
        })
      );

      expect(result.current.totalBudgetGoal).toBe(300000);
      expect(result.current.currentSpent).toBe(130000);
      expect(result.current.categoryStats).toHaveLength(2);

      const foodStat = result.current.categoryStats.find((s) => s.category_id === 'cat-food');
      const transportStat = result.current.categoryStats.find((s) => s.category_id === 'cat-transport');

      expect(foodStat?.spent).toBe(50000);
      expect(transportStat?.spent).toBe(80000);
    });

    it('category가 없으면 categoryName이 "미분류"로 폴백된다', () => {
      const goalWithoutCategory: BudgetGoalWithCategory = {
        id: 'goal-no-cat',
        user_id: 'u1',
        category_id: 'cat-x',
        amount: 50000,
        updated_at: new Date().toISOString(),
        category: null, // 카테고리 없음
      };
      const transactions = [makeTransaction('cat-x', 10000)];

      const { result } = renderHook(() =>
        useDailySurvival({
          transactions,
          budgetGoals: [goalWithoutCategory],
          cycleEndDate: getCycleEnd(10),
        })
      );

      expect(result.current.categoryStats[0].categoryName).toBe('미분류');
      expect(result.current.categoryStats[0].categoryIcon).toBe('circle');
    });

    it('percentage는 0~100 사이로 클램핑된다', () => {
      const goals = [makeGoal('cat-food', 100000)];
      const transactions = [makeTransaction('cat-food', 200000)]; // 200%

      const { result } = renderHook(() =>
        useDailySurvival({
          transactions,
          budgetGoals: goals,
          cycleEndDate: getCycleEnd(10),
        })
      );

      expect(result.current.categoryStats[0].percentage).toBe(100);
    });
  });
});
