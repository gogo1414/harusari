import { addDays, subDays } from 'date-fns';
import { getCycleRange, type CycleRange } from '@/lib/date';

/**
 * 급여 사이클 단위 이동 헬퍼.
 *
 * addMonths(cycle.start, ±1)로 이동하면 급여일 29/30/31일에서 말일 클램프 때문에
 * 같은 사이클에 머무르거나(예: 1/31 → 2/28 → 여전히 1/31 사이클) 한 사이클을 건너뛰는 문제가 있다.
 * 사이클 경계(종료일 다음날 / 시작일 전날)로 이동하면 항상 정확히 인접 사이클로 이동한다.
 */

/** 다음 사이클에 속하는 기준일 (= 현재 사이클 종료일 + 1일 = 다음 사이클 시작일) */
export function getNextCycleBaseDate(baseDate: Date, cycleDay: number): Date {
  return addDays(getCycleRange(baseDate, cycleDay).end, 1);
}

/** 이전 사이클에 속하는 기준일 (= 현재 사이클 시작일 - 1일 = 이전 사이클 종료일) */
export function getPrevCycleBaseDate(baseDate: Date, cycleDay: number): Date {
  return subDays(getCycleRange(baseDate, cycleDay).start, 1);
}

/** delta(±N)만큼 사이클을 이동한 기준일 */
export function shiftCycle(baseDate: Date, cycleDay: number, delta: number): Date {
  let date = baseDate;
  const step = delta > 0 ? getNextCycleBaseDate : getPrevCycleBaseDate;
  for (let i = 0; i < Math.abs(delta); i++) {
    date = step(date, cycleDay);
  }
  return date;
}

/** 기준일이 속한 사이클의 직전 사이클 범위 */
export function getPrevCycleRange(baseDate: Date, cycleDay: number): CycleRange {
  return getCycleRange(getPrevCycleBaseDate(baseDate, cycleDay), cycleDay);
}

/**
 * 기준일이 속한 사이클을 포함해 최근 count개의 사이클 범위를 과거→현재 순으로 반환.
 */
export function getRecentCycleRanges(baseDate: Date, cycleDay: number, count: number): CycleRange[] {
  const ranges: CycleRange[] = [];
  let date = baseDate;
  for (let i = 0; i < count; i++) {
    const range = getCycleRange(date, cycleDay);
    ranges.unshift(range);
    date = subDays(range.start, 1);
  }
  return ranges;
}

/**
 * `?month=yyyy-MM` 쿼리 값을 통계 화면의 기준일로 변환한다. 형식이 틀리면 null.
 *
 * 통계 화면은 사이클 종료일이 속한 월을 라벨로 쓰므로(StatsDateNavigator),
 * 해당 월 1일이 속한 사이클(= 그 월에 끝나는 사이클)을 보여줘야 라벨이 요청한 월과 일치한다.
 * (예: 급여일 25일, month=2024-05 → 04/25~05/24 사이클, 라벨 '2024년 5월')
 */
export function parseMonthParam(month: string | null | undefined): Date | null {
  if (!month) return null;
  const match = /^(\d{4})-(\d{2})$/.exec(month);
  if (!match) return null;
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  if (year < 2000 || year > 2100 || monthIndex < 0 || monthIndex > 11) return null;
  return new Date(year, monthIndex, 1);
}
