import { format, addDays } from 'date-fns';
import { getCycleRange, filterByDateRange } from './date';
import type { Transaction } from '@/types/database';

const fmt = (d: Date) => format(d, 'yyyy-MM-dd');

describe('getCycleRange', () => {
  describe('cycleDay = 1 (달력 월과 동일)', () => {
    it('해당 월 1일 ~ 말일', () => {
      const { start, end } = getCycleRange(new Date(2026, 1, 15), 1); // 2026-02-15
      expect(fmt(start)).toBe('2026-02-01');
      expect(fmt(end)).toBe('2026-02-28');
    });
  });

  describe('cycleDay = 25 (일반 케이스)', () => {
    it('기준일이 급여일 이후면 이번 달 시작', () => {
      const { start, end } = getCycleRange(new Date(2026, 5, 26), 25); // 6/26
      expect(fmt(start)).toBe('2026-06-25');
      expect(fmt(end)).toBe('2026-07-24');
    });

    it('기준일이 급여일 이전이면 지난 달 시작', () => {
      const { start, end } = getCycleRange(new Date(2026, 5, 10), 25); // 6/10
      expect(fmt(start)).toBe('2026-05-25');
      expect(fmt(end)).toBe('2026-06-24');
    });
  });

  // 개선 보고서 1-1: 급여일 31일에서의 사이클 구멍/겹침 회귀 방지
  describe('cycleDay = 31 (말일 클램프)', () => {
    it('2026-02-28은 이번 사이클(02-28 시작)에 속한다 (고아 방지)', () => {
      const { start, end } = getCycleRange(new Date(2026, 1, 28), 31); // 2/28
      expect(fmt(start)).toBe('2026-02-28');
      expect(fmt(end)).toBe('2026-03-30');
    });

    it('2026-02-27은 이전 사이클(01-31 ~ 02-27)에 속한다', () => {
      const { start, end } = getCycleRange(new Date(2026, 1, 27), 31); // 2/27
      expect(fmt(start)).toBe('2026-01-31');
      expect(fmt(end)).toBe('2026-02-27');
    });

    it('2026-05-01은 04-30 시작 사이클에 속한다 (기준일 범위 밖 롤오버 방지)', () => {
      const { start, end } = getCycleRange(new Date(2026, 4, 1), 31); // 5/1
      expect(fmt(start)).toBe('2026-04-30');
      expect(fmt(end)).toBe('2026-05-30');
    });

    it('2026-05-31은 05-31 시작 사이클에 속한다 (이중 집계 방지)', () => {
      const { start, end } = getCycleRange(new Date(2026, 4, 31), 31); // 5/31
      expect(fmt(start)).toBe('2026-05-31');
      expect(fmt(end)).toBe('2026-06-29');
    });
  });

  describe('cycleDay = 29 (윤년/평년)', () => {
    it('윤년 2024-02-29 존재', () => {
      const { start, end } = getCycleRange(new Date(2024, 1, 29), 29); // 2024-02-29
      expect(fmt(start)).toBe('2024-02-29');
      expect(fmt(end)).toBe('2024-03-28');
    });

    it('평년 2026-02는 29일이 없어 28일로 클램프', () => {
      const { start, end } = getCycleRange(new Date(2026, 1, 28), 29); // 2/28
      expect(fmt(start)).toBe('2026-02-28');
      expect(fmt(end)).toBe('2026-03-28');
    });
  });

  describe('연도 경계', () => {
    it('cycleDay=31, 1월 초는 지난해 12-31 시작', () => {
      const { start, end } = getCycleRange(new Date(2026, 0, 5), 31); // 2026-01-05
      expect(fmt(start)).toBe('2025-12-31');
      expect(fmt(end)).toBe('2026-01-30');
    });
  });

  // 속성 테스트: 모든 날짜가 정확히 하나의 사이클에 속하며(구멍 없음),
  // 사이클들이 서로 겹치지 않는다(이중 집계 없음).
  describe.each([28, 29, 30, 31])('연속성 속성 (cycleDay=%i)', (cycleDay) => {
    it('연속된 날짜의 사이클은 구멍/겹침이 없다', () => {
      let cursor = new Date(2025, 11, 1); // 2025-12-01
      const last = new Date(2027, 0, 31); // 2027-01-31
      let prevStart: Date | null = null;
      let prevEnd: Date | null = null;
      while (cursor <= last) {
        const { start, end } = getCycleRange(cursor, cycleDay);
        // 기준일은 항상 자기 사이클 범위 안에 있어야 한다
        expect(fmt(cursor) >= fmt(start)).toBe(true);
        expect(fmt(cursor) <= fmt(end)).toBe(true);
        // 새 사이클로 넘어가면 이전 사이클 end + 1 == 새 사이클 start (구멍/겹침 없음)
        if (prevStart && fmt(start) !== fmt(prevStart)) {
          expect(fmt(start)).toBe(fmt(addDays(prevEnd as Date, 1)));
        }
        prevStart = start;
        prevEnd = end;
        cursor = addDays(cursor, 1);
      }
    });
  });
});

describe('filterByDateRange', () => {
  const tx = (date: string): Transaction => ({
    transaction_id: date,
    user_id: 'u',
    amount: 1000,
    type: 'expense',
    category_id: null,
    date,
    memo: null,
    source_fixed_id: null,
    created_at: date,
  });

  it('범위 경계 포함', () => {
    const txs = [tx('2026-05-24'), tx('2026-05-25'), tx('2026-06-24'), tx('2026-06-25')];
    const result = filterByDateRange(txs, new Date(2026, 4, 25), new Date(2026, 5, 24));
    expect(result.map((t) => t.date)).toEqual(['2026-05-25', '2026-06-24']);
  });
});
