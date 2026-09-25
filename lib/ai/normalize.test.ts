/**
 * @jest-environment node
 */
import { normalizeEntries } from './normalize';
import type { CategoryOption } from './types';

const TODAY = '2026-09-25';
const CATEGORIES: CategoryOption[] = [
  { id: 'food', name: '식비', type: 'expense' },
  { id: 'cafe', name: '카페', type: 'expense' },
  { id: 'salary', name: '급여', type: 'income' },
];

const base = {
  amount: 4500,
  type: 'expense',
  categoryId: 'cafe',
  categoryName: '카페',
  date: TODAY,
  memo: '커피',
  placeHint: null,
  currency: 'KRW',
  originalAmount: null,
  confidence: 0.9,
};

function norm(item: Record<string, unknown>) {
  const out = normalizeEntries({ entries: [{ ...base, ...item }] }, CATEGORIES, TODAY);
  expect(out).toHaveLength(1);
  return out[0];
}

describe('normalizeEntries', () => {
  it('정상 항목은 그대로 통과', () => {
    expect(norm({})).toEqual(base);
  });

  it('배열/객체 형태 모두 허용, 그 외는 빈 배열', () => {
    expect(normalizeEntries([base], CATEGORIES, TODAY)).toHaveLength(1);
    expect(normalizeEntries(null, CATEGORIES, TODAY)).toEqual([]);
    expect(normalizeEntries('oops', CATEGORIES, TODAY)).toEqual([]);
    expect(normalizeEntries({ entries: 'x' }, CATEGORIES, TODAY)).toEqual([]);
    expect(normalizeEntries([null, 1, 'a', [], base], CATEGORIES, TODAY)).toHaveLength(1);
  });

  it('금액 반올림/문자열 숫자 허용', () => {
    expect(norm({ amount: 4500.6 }).amount).toBe(4501);
    expect(norm({ amount: '12,300' }).amount).toBe(12300);
  });

  it('범위 밖 금액은 null + 신뢰도 하향', () => {
    const zero = norm({ amount: 0 });
    expect(zero.amount).toBeNull();
    expect(zero.confidence).toBeLessThan(0.9);
    expect(norm({ amount: 1_500_000_000 }).amount).toBeNull();
    expect(norm({ amount: 1_000_000_000 }).amount).toBe(1_000_000_000);
    expect(norm({ amount: 'abc' }).amount).toBeNull();
    expect(norm({ amount: Number.NaN }).amount).toBeNull();
  });

  it('존재하지 않는 카테고리 id → 이름으로 재시도, 실패 시 null', () => {
    expect(norm({ categoryId: 'ghost', categoryName: '식비' })).toMatchObject({
      categoryId: 'food',
      categoryName: '식비',
    });
    expect(norm({ categoryId: 'ghost', categoryName: '없는이름' })).toMatchObject({
      categoryId: null,
      categoryName: null,
    });
  });

  it('유형이 다른 카테고리는 거부', () => {
    expect(norm({ categoryId: 'salary', categoryName: '급여' })).toMatchObject({
      categoryId: null,
      categoryName: null,
    });
    expect(norm({ type: 'income', categoryId: 'salary' })).toMatchObject({
      type: 'income',
      categoryId: 'salary',
    });
  });

  it('카테고리 이름은 목록의 실제 이름으로 교체', () => {
    expect(norm({ categoryId: 'food', categoryName: '아무거나' }).categoryName).toBe('식비');
  });

  it('잘못된 type은 expense', () => {
    expect(norm({ type: 'transfer' }).type).toBe('expense');
  });

  it('날짜: 형식 오류/범위 밖이면 오늘', () => {
    expect(norm({ date: '2026-09-24' }).date).toBe('2026-09-24');
    expect(norm({ date: '2026-02-30' }).date).toBe(TODAY);
    expect(norm({ date: '어제' }).date).toBe(TODAY);
    expect(norm({ date: '2024-01-01' }).date).toBe(TODAY); // 400일 초과 과거
    expect(norm({ date: '2026-12-31' }).date).toBe(TODAY); // 31일 초과 미래
    expect(norm({ date: '2026-10-26' }).date).toBe('2026-10-26'); // +31일
    expect(norm({ date: '2025-08-21' }).date).toBe('2025-08-21'); // -400일
  });

  it('메모 정리: 제어 문자 제거, 공백 정리, 50자 제한', () => {
    expect(norm({ memo: '  커피\n\t라떼  ' }).memo).toBe('커피 라떼');
    expect(Array.from(norm({ memo: '가'.repeat(80) }).memo)).toHaveLength(50);
    expect(norm({ memo: 123 }).memo).toBe('');
  });

  it('placeHint 빈 문자열은 null', () => {
    expect(norm({ placeHint: '  ' }).placeHint).toBeNull();
    expect(norm({ placeHint: '스타벅스' }).placeHint).toBe('스타벅스');
  });

  it('통화: 3자리 영문만, 소문자는 대문자로', () => {
    expect(norm({ currency: 'won' }).currency).toBe('KRW');
    expect(norm({ currency: 'ABC' }).currency).toBe('KRW');
    expect(norm({ currency: '원화' }).currency).toBe('KRW');
    expect(norm({ currency: undefined }).currency).toBe('KRW');
    expect(norm({ currency: 'usd', amount: null, originalAmount: 12 })).toMatchObject({
      currency: 'USD',
      amount: null,
      originalAmount: 12,
    });
  });

  it('외화는 원화 금액을 버리고 originalAmount를 유지 (모델이 환산해도 무시)', () => {
    expect(norm({ currency: 'JPY', amount: 11000, originalAmount: 1200 })).toMatchObject({
      amount: null,
      originalAmount: 1200,
    });
    // originalAmount가 없으면 amount를 외화 금액으로 간주
    expect(norm({ currency: 'JPY', amount: 1200, originalAmount: null }).originalAmount).toBe(1200);
  });

  it('KRW면 originalAmount는 null', () => {
    expect(norm({ originalAmount: 999 }).originalAmount).toBeNull();
  });

  it('신뢰도 0..1 클램프', () => {
    expect(norm({ confidence: 3 }).confidence).toBe(1);
    expect(norm({ confidence: -1 }).confidence).toBe(0);
    expect(norm({ confidence: 'x' }).confidence).toBe(0.5);
  });

  it('금액도 메모도 없는 항목은 버린다', () => {
    expect(normalizeEntries([{ ...base, amount: null, memo: '' }], CATEGORIES, TODAY)).toEqual([]);
  });

  it('최대 20건', () => {
    const many = Array.from({ length: 30 }, () => base);
    expect(normalizeEntries(many, CATEGORIES, TODAY)).toHaveLength(20);
  });
});
