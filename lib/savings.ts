import type { Transaction, Category } from '@/types/database';

/**
 * 저축 분리 기능 (기획안 C안) - 판별 유틸 단일 소스.
 *
 * 저축 거래 = 지출(expense)이면서 소속 카테고리의 is_savings === true.
 * 카테고리가 없는 거래(SET NULL 포함)는 일반 지출로 취급한다.
 */

export type CategoryMap = Map<string, Pick<Category, 'is_savings'>>;

/** 카테고리 배열을 category_id → Category Map으로 변환 */
export function buildCategoryMap(categories: Category[]): CategoryMap {
  return new Map(categories.map((c) => [c.category_id, c]));
}

/** 거래가 저축 거래인지 판별 */
export function isSavings(
  t: Pick<Transaction, 'type' | 'category_id'>,
  categoryMap: CategoryMap
): boolean {
  return (
    t.type === 'expense' &&
    !!t.category_id &&
    !!categoryMap.get(t.category_id)?.is_savings
  );
}

export interface SpendingBreakdown {
  /** 순수 소비 지출 (저축 제외) */
  spending: number;
  /** 저축 합계 */
  savings: number;
  /** 수입 합계 */
  income: number;
}

/**
 * 거래 목록을 소비/저축/수입으로 분해한다.
 * - expense & 저축 카테고리 → savings
 * - expense & 일반 카테고리 → spending
 * - income → income
 */
export function summarizeTransactions(
  transactions: Pick<Transaction, 'type' | 'amount' | 'category_id'>[],
  categoryMap: CategoryMap
): SpendingBreakdown {
  return transactions.reduce<SpendingBreakdown>(
    (acc, t) => {
      if (t.type === 'income') {
        acc.income += t.amount;
      } else if (isSavings(t, categoryMap)) {
        acc.savings += t.amount;
      } else {
        acc.spending += t.amount;
      }
      return acc;
    },
    { spending: 0, savings: 0, income: 0 }
  );
}

/**
 * 저축률 = 저축 합계 / 수입 합계.
 * 수입이 0이면 null 반환 (0 나눗셈 방지 → 호출부에서 미표시).
 */
export function savingsRate(savings: number, income: number): number | null {
  if (income <= 0) return null;
  return savings / income;
}
