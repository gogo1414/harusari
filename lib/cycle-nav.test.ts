import { format } from 'date-fns';
import { getCycleRange } from './date';
import {
  getNextCycleBaseDate,
  getPrevCycleBaseDate,
  shiftCycle,
  getPrevCycleRange,
  getRecentCycleRanges,
  parseMonthParam,
} from './cycle-nav';

const fmt = (d: Date) => format(d, 'yyyy-MM-dd');
const rangeStr = (base: Date, cycleDay: number) => {
  const r = getCycleRange(base, cycleDay);
  return `${fmt(r.start)}~${fmt(r.end)}`;
};

describe('cycle-nav', () => {
  describe('급여일 31일: 사이클 이동이 멈추거나 건너뛰지 않는다', () => {
    it('다음 사이클로 12번 이동하면 매번 다른 연속 사이클을 지난다', () => {
      let date = new Date(2026, 0, 31); // 2026-01-31 사이클
      const seen: string[] = [rangeStr(date, 31)];
      for (let i = 0; i < 12; i++) {
        const prevEnd = getCycleRange(date, 31).end;
        date = getNextCycleBaseDate(date, 31);
        const cur = getCycleRange(date, 31);
        // 연속성: 이전 종료일 다음날이 새 시작일
        expect(fmt(cur.start)).toBe(fmt(new Date(prevEnd.getFullYear(), prevEnd.getMonth(), prevEnd.getDate() + 1)));
        seen.push(rangeStr(date, 31));
      }
      expect(new Set(seen).size).toBe(13);
      expect(seen[1]).toBe('2026-02-28~2026-03-30');
      expect(seen[2]).toBe('2026-03-31~2026-04-29');
    });

    it('이전 사이클로 이동해도 연속된다 (3/31 사이클 → 2/28 사이클 → 1/31 사이클)', () => {
      let date = new Date(2026, 2, 31);
      date = getPrevCycleBaseDate(date, 31);
      expect(rangeStr(date, 31)).toBe('2026-02-28~2026-03-30');
      date = getPrevCycleBaseDate(date, 31);
      expect(rangeStr(date, 31)).toBe('2026-01-31~2026-02-27');
    });

    it('next 후 prev 하면 원래 사이클로 돌아온다', () => {
      for (const cycleDay of [1, 15, 25, 29, 30, 31]) {
        for (let m = 0; m < 12; m++) {
          const base = new Date(2024, m, 10);
          const back = getPrevCycleBaseDate(getNextCycleBaseDate(base, cycleDay), cycleDay);
          expect(rangeStr(back, cycleDay)).toBe(rangeStr(base, cycleDay));
        }
      }
    });
  });

  it('shiftCycle은 delta만큼 이동한다', () => {
    const base = new Date(2026, 0, 15);
    expect(rangeStr(shiftCycle(base, 1, 2), 1)).toBe('2026-03-01~2026-03-31');
    expect(rangeStr(shiftCycle(base, 1, -1), 1)).toBe('2025-12-01~2025-12-31');
    expect(rangeStr(shiftCycle(base, 1, 0), 1)).toBe('2026-01-01~2026-01-31');
  });

  it('getPrevCycleRange: 2/28 시작 사이클의 직전은 1/31 사이클 (subMonths 사용 시 12/31로 건너뛰던 버그)', () => {
    const prev = getPrevCycleRange(new Date(2026, 1, 28), 31);
    expect(`${fmt(prev.start)}~${fmt(prev.end)}`).toBe('2026-01-31~2026-02-27');
  });

  it('getRecentCycleRanges는 과거→현재 순의 연속된 사이클을 반환한다', () => {
    const ranges = getRecentCycleRanges(new Date(2026, 2, 31), 31, 3);
    expect(ranges.map((r) => `${fmt(r.start)}~${fmt(r.end)}`)).toEqual([
      '2026-01-31~2026-02-27',
      '2026-02-28~2026-03-30',
      '2026-03-31~2026-04-29',
    ]);
  });

  describe('parseMonthParam', () => {
    it('yyyy-MM을 해당 월 1일로 변환한다', () => {
      expect(fmt(parseMonthParam('2024-05')!)).toBe('2024-05-01');
    });

    it('급여일 25일이면 요청 월에 끝나는 사이클을 가리킨다', () => {
      const base = parseMonthParam('2024-05')!;
      expect(rangeStr(base, 25)).toBe('2024-04-25~2024-05-24');
    });

    it.each([null, undefined, '', '2024-13', '2024-00', '2024-5', 'abcd-ef', '2024-05-01', '1800-01'])(
      '잘못된 값(%p)은 null',
      (value) => {
        expect(parseMonthParam(value as string | null | undefined)).toBeNull();
      }
    );
  });
});
