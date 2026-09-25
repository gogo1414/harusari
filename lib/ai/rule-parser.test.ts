/**
 * @jest-environment node
 */
import {
  parseWithRules,
  findAmounts,
  parseKoreanAmount,
  detectType,
  cleanMemo,
} from './rule-parser';
import type { CategoryOption, ParsedEntry } from './types';

// 2026-09-25 = 금요일
const TODAY = '2026-09-25';

const CATEGORIES: CategoryOption[] = [
  { id: 'food', name: '식비', type: 'expense' },
  { id: 'cafe', name: '카페/간식', type: 'expense' },
  { id: 'transport', name: '교통', type: 'expense' },
  { id: 'living', name: '생활', type: 'expense' },
  { id: 'culture', name: '문화/여가', type: 'expense' },
  { id: 'medical', name: '의료/건강', type: 'expense' },
  { id: 'shopping', name: '쇼핑', type: 'expense' },
  { id: 'house', name: '주거·통신', type: 'expense' },
  { id: 'gift', name: '경조사/선물', type: 'expense' },
  { id: 'sub', name: '구독', type: 'expense' },
  { id: 'car', name: '자동차', type: 'expense' },
  { id: 'salary', name: '급여', type: 'income' },
  { id: 'allowance', name: '용돈', type: 'income' },
  { id: 'etc-income', name: '기타 수입', type: 'income' },
];

function parse(text: string, categories: CategoryOption[] = CATEGORIES): ParsedEntry[] {
  return parseWithRules(text, categories, TODAY);
}

function one(text: string, categories?: CategoryOption[]): ParsedEntry {
  const entries = parse(text, categories);
  expect(entries).toHaveLength(1);
  return entries[0];
}

describe('parseKoreanAmount', () => {
  it.each([
    ['1400', 1400],
    ['1,400', 1400],
    ['1400원', 1400],
    ['9천원', 9000],
    ['2만3천원', 23000],
    ['2만 3천원', 23000],
    ['5만3천500원', 53500],
    ['1.5만', 15000],
    ['만원', 10000],
    ['4.5천', 4500],
    ['320만원', 3_200_000],
    ['3억', 300_000_000],
    ['12,300', 12300],
    ['오천원', 5000],
    ['사천오백원', 4500],
    ['천오백원', 1500],
    ['십만원', 100_000],
    ['백만원', 1_000_000],
  ])('%s → %d', (input, expected) => {
    expect(parseKoreanAmount(input)).toEqual({ value: expected, currency: 'KRW' });
  });

  it.each([
    ['1200엔', 1200, 'JPY'],
    ['¥1200', 1200, 'JPY'],
    ['$12', 12, 'USD'],
    ['$12.99', 12.99, 'USD'],
    ['12달러', 12, 'USD'],
    ['USD 12', 12, 'USD'],
    ['20유로', 20, 'EUR'],
    ['€20', 20, 'EUR'],
    ['100위안', 100, 'CNY'],
    ['300바트', 300, 'THB'],
    ['50000동', 50000, 'VND'],
    ['500페소', 500, 'PHP'],
    ['1만엔', 10000, 'JPY'],
  ])('외화 %s → %d %s', (input, value, currency) => {
    expect(parseKoreanAmount(input)).toEqual({ value, currency });
  });

  it('수량/브랜드 숫자/한글 단어는 금액이 아니다', () => {
    expect(findAmounts('커피 2잔')).toEqual([]);
    expect(findAmounts('GS25')).toEqual([]);
    expect(findAmounts('11번가')).toEqual([]);
    expect(findAmounts('101동')).toEqual([]);
    expect(findAmounts('만두 삼각김밥 백화점 천안 이천')).toEqual([]);
    expect(findAmounts('29cm')).toEqual([]);
    expect(findAmounts('4.5')).toEqual([]);
    expect(findAmounts('불고기')).toEqual([]);
  });
});

describe('parseWithRules — 요구 예시', () => {
  it('삼각김밥 1400원', () => {
    expect(one('삼각김밥 1400원')).toMatchObject({
      amount: 1400,
      type: 'expense',
      categoryId: 'food',
      categoryName: '식비',
      date: TODAY,
      memo: '삼각김밥',
      placeHint: null,
      currency: 'KRW',
      originalAmount: null,
    });
  });

  it('스벅 아아 4500 → 카페 + 스타벅스', () => {
    expect(one('스벅 아아 4500')).toMatchObject({
      amount: 4500,
      categoryId: 'cafe',
      placeHint: '스타벅스',
      memo: '스벅 아아',
    });
  });

  it('점심 김치찌개 9천원', () => {
    expect(one('점심 김치찌개 9천원')).toMatchObject({
      amount: 9000,
      categoryId: 'food',
      memo: '점심 김치찌개',
    });
  });

  it('택시 12,300', () => {
    expect(one('택시 12,300')).toMatchObject({
      amount: 12300,
      categoryId: 'transport',
      memo: '택시',
    });
  });

  it('넷플릭스 17000원 어제 → 구독, 어제', () => {
    expect(one('넷플릭스 17000원 어제')).toMatchObject({
      amount: 17000,
      categoryId: 'sub',
      date: '2026-09-24',
      memo: '넷플릭스',
      placeHint: '넷플릭스',
    });
  });

  it('월급 320만원 들어옴 → 수입/급여', () => {
    expect(one('월급 320만원 들어옴')).toMatchObject({
      amount: 3_200_000,
      type: 'income',
      categoryId: 'salary',
      memo: '월급',
    });
  });

  it('용돈 5만 받음 → 수입/용돈', () => {
    expect(one('용돈 5만 받음')).toMatchObject({
      amount: 50000,
      type: 'income',
      categoryId: 'allowance',
      memo: '용돈',
    });
  });

  it('편의점 3200 커피 4500 → 2건', () => {
    const entries = parse('편의점 3200 커피 4500');
    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({ amount: 3200, memo: '편의점', categoryId: 'food' });
    expect(entries[1]).toMatchObject({ amount: 4500, memo: '커피', categoryId: 'cafe' });
  });

  it('여러 줄 + 서로 다른 날짜', () => {
    const entries = parse('어제 저녁 치킨 2만3천원\n오늘 커피 4800');
    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({
      amount: 23000,
      date: '2026-09-24',
      memo: '저녁 치킨',
      categoryId: 'food',
    });
    expect(entries[1]).toMatchObject({
      amount: 4800,
      date: TODAY,
      memo: '커피',
      categoryId: 'cafe',
    });
  });

  it('지난주 금요일 영화 15000', () => {
    expect(one('지난주 금요일 영화 15000')).toMatchObject({
      amount: 15000,
      date: '2026-09-18',
      categoryId: 'culture',
      memo: '영화',
    });
  });

  it('9/3 병원 12000', () => {
    expect(one('9/3 병원 12000')).toMatchObject({
      amount: 12000,
      date: '2026-09-03',
      categoryId: 'medical',
      memo: '병원',
    });
  });

  it('1.5만 다이소 (금액이 앞)', () => {
    expect(one('1.5만 다이소')).toMatchObject({
      amount: 15000,
      categoryId: 'living',
      placeHint: '다이소',
      memo: '다이소',
    });
  });

  it('만원 꽃', () => {
    expect(one('만원 꽃')).toMatchObject({ amount: 10000, memo: '꽃', categoryId: 'gift' });
  });

  it('커피 4.5천', () => {
    expect(one('커피 4.5천')).toMatchObject({ amount: 4500, memo: '커피', categoryId: 'cafe' });
  });

  it('주유 7만원 GS칼텍스', () => {
    expect(one('주유 7만원 GS칼텍스')).toMatchObject({
      amount: 70000,
      categoryId: 'car',
      placeHint: 'GS칼텍스',
    });
  });

  it('환불 12000원 들어옴 → 수입', () => {
    expect(one('환불 12000원 들어옴')).toMatchObject({
      amount: 12000,
      type: 'income',
      categoryId: 'etc-income',
      memo: '환불',
    });
  });

  it('마트 장보기 5만3천500원', () => {
    expect(one('마트 장보기 5만3천500원')).toMatchObject({
      amount: 53500,
      categoryId: 'food',
      memo: '마트 장보기',
    });
  });

  it('라멘 1200엔 → 외화 유지, 원화 금액 null', () => {
    expect(one('라멘 1200엔')).toMatchObject({
      amount: null,
      currency: 'JPY',
      originalAmount: 1200,
      memo: '라멘',
      categoryId: 'food',
    });
  });

  it('$12 uber → USD, 교통, 우버', () => {
    expect(one('$12 uber')).toMatchObject({
      amount: null,
      currency: 'USD',
      originalAmount: 12,
      categoryId: 'transport',
      placeHint: '우버',
    });
  });
});

describe('parseWithRules — 분리', () => {
  it('쉼표/그리고/슬래시로 분리', () => {
    const entries = parse('커피 4500원, 빵 3000원 그리고 우유 2500 / 택시 8000');
    expect(entries.map((e) => [e.memo, e.amount])).toEqual([
      ['커피', 4500],
      ['빵', 3000],
      ['우유', 2500],
      ['택시', 8000],
    ]);
  });

  it('천 단위 쉼표는 분리하지 않는다', () => {
    expect(parse('택시 12,300, 커피 4,500').map((e) => e.amount)).toEqual([12300, 4500]);
  });

  it('금액이 먼저 오는 연속 입력', () => {
    const entries = parse('3200 편의점 4500 커피');
    expect(entries.map((e) => [e.memo, e.amount])).toEqual([
      ['편의점', 3200],
      ['커피', 4500],
    ]);
  });

  it('금액 없는 조각은 다음 조각과 합친다', () => {
    expect(one('스벅, 아아 4500')).toMatchObject({ memo: '스벅 아아', amount: 4500 });
  });

  it('목록 기호 제거', () => {
    const entries = parse('1. 커피 4500\n- 택시 8000');
    expect(entries.map((e) => [e.memo, e.amount])).toEqual([
      ['커피', 4500],
      ['택시', 8000],
    ]);
  });

  it('한 줄 날짜 하나는 줄 전체에 적용', () => {
    const entries = parse('편의점 3200 커피 4500 어제');
    expect(entries.map((e) => e.date)).toEqual(['2026-09-24', '2026-09-24']);
  });

  it('날짜만 적은 줄은 다음 줄들에 적용', () => {
    const entries = parse('어제\n치킨 2만\n커피 4800');
    expect(entries.map((e) => e.date)).toEqual(['2026-09-24', '2026-09-24']);
  });

  it('한 줄에 날짜가 여럿이면 항목별', () => {
    const entries = parse('어제 치킨 2만 오늘 커피 4800');
    expect(entries.map((e) => e.date)).toEqual(['2026-09-24', TODAY]);
  });

  it('수량은 메모에 남고 금액으로 쓰이지 않는다', () => {
    expect(one('커피 2잔 9000원')).toMatchObject({ amount: 9000, memo: '커피 2잔' });
  });

  it('시각/전화번호는 무시', () => {
    expect(one('12:30 점심 9000')).toMatchObject({ amount: 9000, memo: '점심' });
  });

  it('최대 20건', () => {
    const text = Array.from({ length: 25 }, (_, i) => `커피 ${1000 + i}`).join('\n');
    expect(parse(text)).toHaveLength(20);
  });
});

describe('parseWithRules — 날짜', () => {
  it.each([
    ['오늘 커피 4500', TODAY],
    ['어제 커피 4500', '2026-09-24'],
    ['그제 커피 4500', '2026-09-23'],
    ['그저께 커피 4500', '2026-09-23'],
    ['엊그제 커피 4500', '2026-09-23'],
    ['3일 전 커피 4500', '2026-09-22'],
    ['이틀 전 커피 4500', '2026-09-23'],
    ['지난주 월요일 커피 4500', '2026-09-14'],
    ['지난주 일요일 커피 4500', '2026-09-20'],
    ['이번주 수요일 커피 4500', '2026-09-23'],
    ['금요일 커피 4500', TODAY],
    ['월요일 커피 4500', '2026-09-21'],
    ['일요일 커피 4500', '2026-09-20'],
    ['토요일 커피 4500', '2026-09-19'],
    ['9월 3일 커피 4500', '2026-09-03'],
    ['9/3 커피 4500', '2026-09-03'],
    ['9.3 커피 4500', '2026-09-03'],
    ['2026-08-15 커피 4500', '2026-08-15'],
    ['지난달 25일 커피 4500', '2026-08-25'],
    ['20일 커피 4500', '2026-09-20'],
    ['28일 커피 4500', '2026-08-28'],
    ['12/25 선물 3만', '2025-12-25'],
    ['10/3 커피 4500', '2026-10-03'],
  ])('%s → %s', (text, date) => {
    expect(one(text).date).toBe(date);
  });

  it('이번주 미래 요일은 오늘로 보정하고 신뢰도를 낮춘다', () => {
    const e = one('이번주 토요일 영화 1만');
    expect(e.date).toBe(TODAY);
    expect(e.confidence).toBeLessThan(one('영화 1만').confidence);
  });

  it('날짜 없으면 오늘', () => {
    expect(one('커피 4500').date).toBe(TODAY);
  });
});

describe('parseWithRules — 수입/지출', () => {
  it.each([
    ['월급 320만', 'income'],
    ['급여 300만', 'income'],
    ['보너스 100만', 'income'],
    ['이자 1200원', 'income'],
    ['캐시백 3000', 'income'],
    ['중고 판매 3만', 'income'],
    ['정산 받음 15000', 'income'],
    ['엄마한테 용돈 받음 10만', 'income'],
    ['부모님 용돈 20만', 'expense'],
    ['대출 이자 30만', 'expense'],
    ['정산 보냄 15000', 'expense'],
    ['커피 4500', 'expense'],
  ])('%s → %s', (text, type) => {
    expect(one(text).type).toBe(type);
  });

  it('detectType 기본값은 지출', () => {
    expect(detectType('아무거나')).toBe('expense');
  });
});

describe('parseWithRules — 카테고리 매칭', () => {
  it('사용자 카테고리 이름이 다르면 동의어/유사도로 맞춘다', () => {
    const cats: CategoryOption[] = [
      { id: 'a', name: '🍚 밥값', type: 'expense' },
      { id: 'b', name: '커피', type: 'expense' },
      { id: 'c', name: '교통비', type: 'expense' },
      { id: 'd', name: '월급', type: 'income' },
    ];
    expect(one('스벅 아아 4500', cats).categoryId).toBe('b');
    expect(one('택시 8000', cats).categoryId).toBe('c');
    expect(one('김치찌개 9000', cats).categoryId).toBe('a');
    expect(one('급여 300만', cats).categoryId).toBe('d');
  });

  it('입력 단어가 카테고리 이름과 직접 일치하면 우선', () => {
    const cats: CategoryOption[] = [
      { id: 'food', name: '식비', type: 'expense' },
      { id: 'conv', name: '편의점', type: 'expense' },
    ];
    expect(one('편의점 삼각김밥 1400', cats).categoryId).toBe('conv');
    expect(one('삼각김밥 1400', cats).categoryId).toBe('conv');
  });

  it('맞는 카테고리가 없으면 null', () => {
    expect(one('알리오올리오 12000', [{ id: 'x', name: '교통', type: 'expense' }])).toMatchObject({
      categoryId: null,
      categoryName: null,
    });
  });

  it('유형이 다른 카테고리는 고르지 않는다', () => {
    const cats: CategoryOption[] = [{ id: 'inc', name: '식비', type: 'income' }];
    expect(one('김치찌개 9000', cats).categoryId).toBeNull();
  });

  it('카테고리 목록이 비어도 동작', () => {
    expect(one('커피 4500', [])).toMatchObject({ amount: 4500, categoryId: null });
  });

  it('짧은 브랜드 별칭은 다른 단어 속에서 오탐하지 않는다', () => {
    expect(one('알리오올리오 12000').placeHint).toBeNull();
    expect(one('알리 직구 12000').placeHint).toBe('알리익스프레스');
    expect(one('CU에서 3200').placeHint).toBe('CU');
  });
});

describe('parseWithRules — 경계 사례', () => {
  it('금액 없음 → amount null, 낮은 신뢰도', () => {
    const e = one('삼각김밥');
    expect(e.amount).toBeNull();
    expect(e.memo).toBe('삼각김밥');
    expect(e.confidence).toBeLessThan(0.6);
  });

  it('3억은 허용, 10억 초과는 null', () => {
    expect(one('3억 집').amount).toBe(300_000_000);
    const big = one('15억 집');
    expect(big.amount).toBeNull();
    expect(big.confidence).toBeLessThan(0.5);
  });

  it('빈 입력/공백', () => {
    expect(parse('')).toEqual([]);
    expect(parse('   \n  ')).toEqual([]);
  });

  it('메모는 50자 이내', () => {
    const e = one(`${'가'.repeat(80)} 5000`);
    expect(Array.from(e.memo).length).toBeLessThanOrEqual(50);
  });

  it('신뢰도는 0..1', () => {
    for (const e of parse('커피 4500\n라멘 1200엔\n삼각김밥')) {
      expect(e.confidence).toBeGreaterThanOrEqual(0);
      expect(e.confidence).toBeLessThanOrEqual(1);
    }
  });

  it('cleanMemo는 군더더기와 조사를 뺀다', () => {
    expect(cleanMemo('스벅에서 아아 결제')).toBe('스벅 아아');
    expect(cleanMemo('  환불  들어옴 ')).toBe('환불');
  });
});
