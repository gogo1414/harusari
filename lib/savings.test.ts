import { isSavings, buildCategoryMap, summarizeTransactions, savingsRate } from './savings';
import type { Category, Transaction } from '@/types/database';

const cat = (id: string, type: 'income' | 'expense', is_savings = false): Category => ({
  category_id: id,
  user_id: 'u',
  name: id,
  type,
  icon: 'money',
  is_default: false,
  created_at: '2026-01-01',
  sort_order: 0,
  is_savings,
});

const tx = (
  type: 'income' | 'expense',
  amount: number,
  category_id: string | null
): Pick<Transaction, 'type' | 'amount' | 'category_id'> => ({ type, amount, category_id });

const categories = [
  cat('food', 'expense', false),
  cat('saving', 'expense', true),
  cat('salary', 'income', false),
];
const map = buildCategoryMap(categories);

describe('isSavings', () => {
  it('저축 카테고리 지출이면 true', () => {
    expect(isSavings(tx('expense', 100, 'saving'), map)).toBe(true);
  });
  it('일반 카테고리 지출이면 false', () => {
    expect(isSavings(tx('expense', 100, 'food'), map)).toBe(false);
  });
  it('카테고리 없는 지출이면 false', () => {
    expect(isSavings(tx('expense', 100, null), map)).toBe(false);
  });
  it('수입이면 false (저축 카테고리여도)', () => {
    expect(isSavings(tx('income', 100, 'saving'), map)).toBe(false);
  });
});

describe('summarizeTransactions', () => {
  it('소비/저축/수입을 분리 집계', () => {
    const txs = [
      tx('expense', 45, 'food'),
      tx('expense', 30, 'saving'),
      tx('income', 200, 'salary'),
      tx('expense', 5, null),
    ];
    expect(summarizeTransactions(txs, map)).toEqual({
      spending: 50, // 45 + 5(미분류)
      savings: 30,
      income: 200,
    });
  });
});

describe('savingsRate', () => {
  it('저축률 계산', () => {
    expect(savingsRate(30, 200)).toBeCloseTo(0.15);
  });
  it('수입 0이면 null (0 나눗셈 방지)', () => {
    expect(savingsRate(30, 0)).toBeNull();
  });
});
