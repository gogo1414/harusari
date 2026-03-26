import { format } from 'date-fns';
import { getCycleRange, filterByDateRange } from './date';
import type { Transaction } from '@/types/database';

// ⚠️ new Date('yyyy-MM-dd') 는 UTC 자정으로 해석되어 시스템 타임존에 따라 날짜가 달라집니다.
// new Date(year, month, day)  — 로컬 자정으로 생성해야 date-fns 함수와 일치합니다.
function localDate(year: number, month: number, day: number): Date {
  return new Date(year, month - 1, day);
}

function fmtDate(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}

// 테스트용 트랜잭션 생성 헬퍼
function makeTransaction(date: string): Transaction {
  return {
    transaction_id: date,
    user_id: 'u1',
    amount: 1000,
    type: 'expense',
    category_id: 'cat1',
    date,
    created_at: new Date().toISOString(),
    memo: null,
    source_fixed_id: null,
  };
}

describe('getCycleRange', () => {
  describe('cycleDay === 1 (월 초 고정)', () => {
    it('해당 월의 1일부터 말일까지 반환한다', () => {
      const { start, end } = getCycleRange(localDate(2026, 3, 15), 1);
      expect(fmtDate(start)).toBe('2026-03-01');
      expect(fmtDate(end)).toBe('2026-03-31');
    });

    it('2월에는 말일이 28일(평년)이다', () => {
      const { start, end } = getCycleRange(localDate(2025, 2, 10), 1);
      expect(fmtDate(start)).toBe('2025-02-01');
      expect(fmtDate(end)).toBe('2025-02-28');
    });

    it('2월에는 말일이 29일(윤년)이다', () => {
      const { start, end } = getCycleRange(localDate(2024, 2, 14), 1);
      expect(fmtDate(start)).toBe('2024-02-01');
      expect(fmtDate(end)).toBe('2024-02-29');
    });
  });

  describe('cycleDay > 1 (급여일 기반 사이클)', () => {
    it('현재 날짜 >= 급여일이면 이번 달 급여일 ~ 다음 달 급여일 전날', () => {
      // 급여일 25일, 현재 3월 26일 → 3/25 ~ 4/24
      const { start, end } = getCycleRange(localDate(2026, 3, 26), 25);
      expect(fmtDate(start)).toBe('2026-03-25');
      expect(fmtDate(end)).toBe('2026-04-24');
    });

    it('현재 날짜 < 급여일이면 지난달 급여일 ~ 이번 달 급여일 전날', () => {
      // 급여일 25일, 현재 3월 10일 → 2/25 ~ 3/24
      const { start, end } = getCycleRange(localDate(2026, 3, 10), 25);
      expect(fmtDate(start)).toBe('2026-02-25');
      expect(fmtDate(end)).toBe('2026-03-24');
    });

    it('급여일이 당일이면 해당 월의 사이클 시작이다', () => {
      // 급여일 15일, 현재 3월 15일 → 3/15 ~ 4/14
      const { start, end } = getCycleRange(localDate(2026, 3, 15), 15);
      expect(fmtDate(start)).toBe('2026-03-15');
      expect(fmtDate(end)).toBe('2026-04-14');
    });

    it('급여일 10일, 현재 1월이면 전년 12월부터 사이클이 시작된다', () => {
      // 급여일 10일, 현재 1월 5일 → 12/10 ~ 1/9
      const { start, end } = getCycleRange(localDate(2026, 1, 5), 10);
      expect(fmtDate(start)).toBe('2025-12-10');
      expect(fmtDate(end)).toBe('2026-01-09');
    });
  });
});

describe('filterByDateRange', () => {
  const transactions = [
    makeTransaction('2026-03-01'),
    makeTransaction('2026-03-15'),
    makeTransaction('2026-03-31'),
    makeTransaction('2026-04-01'),
    makeTransaction('2026-02-28'),
  ];

  it('범위 내 거래만 반환한다', () => {
    const result = filterByDateRange(
      transactions,
      localDate(2026, 3, 1),
      localDate(2026, 3, 31)
    );
    expect(result).toHaveLength(3);
    expect(result.map((t) => t.date)).toEqual(['2026-03-01', '2026-03-15', '2026-03-31']);
  });

  it('시작일과 종료일을 포함한다 (경계값)', () => {
    const result = filterByDateRange(
      transactions,
      localDate(2026, 3, 15),
      localDate(2026, 3, 15)
    );
    expect(result).toHaveLength(1);
    expect(result[0].date).toBe('2026-03-15');
  });

  it('범위 밖 거래는 제외한다', () => {
    const result = filterByDateRange(
      transactions,
      localDate(2026, 4, 1),
      localDate(2026, 4, 30)
    );
    expect(result).toHaveLength(1);
    expect(result[0].date).toBe('2026-04-01');
  });

  it('빈 트랜잭션 목록은 빈 배열을 반환한다', () => {
    const result = filterByDateRange([], localDate(2026, 3, 1), localDate(2026, 3, 31));
    expect(result).toHaveLength(0);
  });

  it('범위에 해당하는 거래가 없으면 빈 배열을 반환한다', () => {
    const result = filterByDateRange(
      transactions,
      localDate(2026, 5, 1),
      localDate(2026, 5, 31)
    );
    expect(result).toHaveLength(0);
  });
});
