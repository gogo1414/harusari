import { useMemo } from 'react';
import { format, parseISO, startOfDay, differenceInCalendarDays } from 'date-fns';
import type { Transaction } from '@/types/database';
import type { BudgetGoalWithCategory } from '@/hooks/useBudgetGoals';

interface UseDailySurvivalProps {
  transactions: Transaction[];
  budgetGoals: BudgetGoalWithCategory[];
  cycleEndDate: Date;
}

export function useDailySurvival({ 
  transactions, 
  budgetGoals, 
  cycleEndDate 
}: UseDailySurvivalProps) {
  
  // 1. 전체 목표 예산 조회 & 카테고리별 통계 계산
  const { totalBudgetGoal, categoryStats, currentSpent } = useMemo(() => {
    // 전체 예산 합계 계산
    const validGoals = budgetGoals.filter(g => g.category_id !== null);
    const total = validGoals.reduce((sum, goal) => sum + goal.amount, 0);

    const stats = validGoals.map(goal => {
      // 해당 카테고리의 현재 지출 계산 (고정지출 제외)
      const spent = transactions
        .filter(t => 
          t.type === 'expense' && 
          !t.source_fixed_id && 
          t.category_id === goal.category_id
        )
        .reduce((sum, t) => sum + t.amount, 0);

      const remaining = goal.amount - spent;
      // 목표 금액 0 이하(비정상 데이터)에서 NaN/Infinity 방지
      const rawPercentage = goal.amount > 0 ? (spent / goal.amount) * 100 : spent > 0 ? 100 : 0;
      const percentage = Math.min(100, Math.max(0, rawPercentage));
      
      // 상태 결정
      let status: 'safe' | 'warning' | 'danger' = 'safe';
      if (remaining < 0) status = 'danger';
      else if (percentage >= 80) status = 'danger'; // 80% 이상 사용
      else if (percentage >= 50) status = 'warning'; // 50% 이상 사용

      return {
        ...goal,
        spent,
        remaining,
        percentage,
        status,
        categoryName: goal.category?.name || '미분류',
        categoryIcon: goal.category?.icon || 'circle'
      };
    });

    // 전체 지출 합계
    const spentSum = stats.reduce((sum, stat) => sum + stat.spent, 0);

    return { 
        totalBudgetGoal: total, 
        categoryStats: stats,
        currentSpent: spentSum 
    };
  }, [budgetGoals, transactions]);

  // 오늘 날짜 키: 자정이 지나 다시 렌더되면 값이 바뀌어 남은 일수가 재계산된다
  // (useMemo 의존성에 없으면 앱을 켜둔 채 날짜가 바뀌어도 어제 기준 값이 유지됨)
  const todayKey = format(new Date(), 'yyyy-MM-dd');

  // 2. 전체 생존 예산 계산 로직
  const { 
    dailyAvailable, 
    remainingBudget, 
    status,
    hasBudget
  } = useMemo(() => {
    const budget = totalBudgetGoal;
    
    // 예산 미설정 시
    if (!budget) {
        return { 
            dailyAvailable: 0, 
            remainingBudget: 0, 
            status: 'unknown' as const,
            hasBudget: false
        };
    }

    // 남은 일수 계산 (오늘 포함)
    const today = parseISO(todayKey);
    const end = startOfDay(cycleEndDate);
    // 과거 사이클 조회 시 Math.abs로 인해 남은 일수가 잘못 계산되던 문제 수정 (음수는 1로 클램프)
    // differenceInCalendarDays는 DST 등으로 하루 길이가 24h가 아닐 때도 달력 기준으로 계산한다
    const daysLeft = Math.max(1, differenceInCalendarDays(end, today) + 1);

    // 남은 생활비
    const disposableBalance = budget - currentSpent;

    // 하루 권장 사용액
    const daily = Math.floor(disposableBalance / Math.max(1, daysLeft));

    // 전체 상태 결정
    let currentStatus: 'safe' | 'warning' | 'danger' = 'safe';
    if (daily <= 0) currentStatus = 'danger';
    else if (budget > 0 && daily < (budget / 30) * 0.5) currentStatus = 'warning';

    return {
      dailyAvailable: daily,
      remainingBudget: disposableBalance,
      remainingDays: daysLeft,
      status: currentStatus,
      hasBudget: true
    };
  }, [totalBudgetGoal, currentSpent, cycleEndDate, todayKey]);

  return {
    totalBudgetGoal,
    categoryStats,
    currentSpent,
    dailyAvailable,
    remainingBudget,
    status,
    hasBudget
  };
}
