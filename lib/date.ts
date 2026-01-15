import { startOfMonth, endOfMonth, addMonths, subMonths, setDate, subDays, format } from 'date-fns';
import type { Transaction } from '@/types/database';

export interface CycleRange {
  start: Date;
  end: Date;
}

/**
 * 급여 사이클 기준 날짜 범위 계산
 * @param baseDate 기준 날짜
 * @param cycleDay 급여일 (1~31)
 * @returns 사이클 시작일과 종료일
 */
export function getCycleRange(baseDate: Date, cycleDay: number): CycleRange {
  let start: Date;
  let end: Date;

  if (cycleDay === 1) {
    start = startOfMonth(baseDate);
    end = endOfMonth(baseDate);
  } else {
    const currentDay = baseDate.getDate();
    if (currentDay >= cycleDay) {
      start = setDate(baseDate, cycleDay);
      end = subDays(addMonths(start, 1), 1);
    } else {
      const prevMonth = subMonths(baseDate, 1);
      start = setDate(prevMonth, cycleDay);
      end = subDays(addMonths(start, 1), 1);
    }
  }

  return { start, end };
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
