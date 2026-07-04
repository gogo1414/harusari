import { startOfMonth, endOfMonth, subDays, startOfDay, format } from 'date-fns';
import type { Transaction } from '@/types/database';

export interface CycleRange {
  start: Date;
  end: Date;
}

/**
 * 사이클 시작일을 해당 월의 말일로 클램프한 Date를 반환.
 * 예) cycleDay=31, 2월 → 2월 28/29일. (setDate의 다음 달 롤오버 버그 방지)
 */
function clampedCycleStart(year: number, monthIndex: number, cycleDay: number): Date {
  // new Date(y, m + 1, 0) = 해당 월의 말일
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  // monthIndex가 -1이나 12여도 Date 생성자가 연도 경계를 정규화한다.
  return startOfDay(new Date(year, monthIndex, Math.min(cycleDay, lastDay)));
}

/**
 * 급여 사이클 기준 날짜 범위 계산
 * @param baseDate 기준 날짜
 * @param cycleDay 급여일 (1~31)
 * @returns 사이클 시작일과 종료일
 *
 * cycleDay가 29/30/31이고 해당 월에 그 일자가 없으면 말일로 클램프하여
 * 사이클 구멍(고아 날짜)이나 겹침(이중 집계)이 발생하지 않도록 한다.
 */
export function getCycleRange(baseDate: Date, cycleDay: number): CycleRange {
  if (cycleDay === 1) {
    return { start: startOfMonth(baseDate), end: endOfMonth(baseDate) };
  }

  const year = baseDate.getFullYear();
  const month = baseDate.getMonth();

  // 이번 달의 (클램프된) 사이클 시작일
  const thisMonthStart = clampedCycleStart(year, month, cycleDay);

  // 기준일이 이번 달 시작일 이전이면 지난달 시작일이 기준
  const start =
    startOfDay(baseDate).getTime() >= thisMonthStart.getTime()
      ? thisMonthStart
      : clampedCycleStart(year, month - 1, cycleDay);

  // 종료일 = 다음 달 클램프된 시작일 - 1일
  const nextStart = clampedCycleStart(start.getFullYear(), start.getMonth() + 1, cycleDay);
  const end = subDays(nextStart, 1);

  return { start, end };
}

/**
 * 현재 사이클 내에서 고정지출 날짜(day)에 해당하는 실제 날짜 계산
 * 급여 사이클이 월을 걸치는 경우(예: 급여일 25일 -> 1/25~2/24)를 처리한다.
 * @param day 고정지출 설정 날짜 (1~31)
 * @param cycleStart 사이클 시작일
 * @param cycleEnd 사이클 종료일
 * @param cycleDay 급여일 (사이클 시작일)
 * @returns YYYY-MM-DD 형식의 날짜 문자열, 사이클 범위 밖이면 null
 */
export function calculateTargetDateInCycle(
  day: number,
  cycleStart: Date,
  cycleEnd: Date,
  cycleDay: number
): string | null {
  const startYear = cycleStart.getFullYear();
  const startMonth = cycleStart.getMonth();
  const endYear = cycleEnd.getFullYear();
  const endMonth = cycleEnd.getMonth();

  // day가 cycleDay 이상이면 사이클 시작월, 미만이면 사이클 종료월에 해당
  let targetYear: number;
  let targetMonth: number;
  if (day >= cycleDay) {
    targetYear = startYear;
    targetMonth = startMonth;
  } else {
    targetYear = endYear;
    targetMonth = endMonth;
  }

  // 해당 월의 말일 조정 (예: 31일 설정인데 30일까지인 달)
  const daysInMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
  const targetDay = Math.min(day, daysInMonth);
  const targetDateStr = `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}-${String(targetDay).padStart(2, '0')}`;

  const cycleStartStr = format(cycleStart, 'yyyy-MM-dd');
  const cycleEndStr = format(cycleEnd, 'yyyy-MM-dd');
  if (targetDateStr >= cycleStartStr && targetDateStr <= cycleEndStr) {
    return targetDateStr;
  }
  return null;
}

/**
 * 날짜 범위 내 거래 필터링
 * @param transactions 거래 배열
 * @param start 시작일
 * @param end 종료일
 * @returns 필터링된 거래 배열
 */
export function filterByDateRange(
  transactions: Transaction[],
  start: Date,
  end: Date
): Transaction[] {
  const startStr = format(start, 'yyyy-MM-dd');
  const endStr = format(end, 'yyyy-MM-dd');
  return transactions.filter((t) => t.date >= startStr && t.date <= endStr);
}
