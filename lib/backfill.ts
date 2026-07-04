/**
 * 고정 지출/수입 등록 시 "시작월 ~ 현재월"의 회차 날짜를 계산하는 공용 유틸.
 *
 * 기존에 transactions/new, recurring/new 두 곳에 복붙되어 있던 백필 루프를 단일 소스로 통합한다.
 * (복붙으로 인해 종료일 비교/말일 처리 불일치 버그가 발생했었음 — 개선 보고서 3-1, 3-4, G)
 */

export interface BackfillParams {
  /** 반복 시작일 */
  startDate: Date;
  /** 기준 현재 시각 (보통 new Date()) */
  now: Date;
  /** 결제일 (1~31). 해당 월에 없는 일자는 말일로 클램프된다. */
  day: number;
  /** 종료일 (yyyy-MM-dd). 있으면 이 날짜까지 포함, 초과 회차는 생성하지 않는다. */
  endDateStr?: string | null;
}

/**
 * 시작월부터 현재월(포함)까지 각 달의 회차 날짜(yyyy-MM-dd) 배열을 반환한다.
 * - 해당 월에 결제일이 없으면 말일로 클램프 (예: day=31, 2월 → 2월 28/29일)
 * - endDateStr이 있으면 종료일 당일까지 포함하고 그 다음 회차부터 중단
 * - 시작월이 현재월보다 미래면 빈 배열 (백필 없음)
 */
export function generateBackfillDates({
  startDate,
  now,
  day,
  endDateStr,
}: BackfillParams): string[] {
  const dates: string[] = [];
  let pointer = new Date(startDate.getFullYear(), startDate.getMonth(), 1);

  while (
    pointer.getFullYear() < now.getFullYear() ||
    (pointer.getFullYear() === now.getFullYear() && pointer.getMonth() <= now.getMonth())
  ) {
    const year = pointer.getFullYear();
    const month = pointer.getMonth(); // 0-based

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const targetDay = Math.min(day, daysInMonth);

    const targetDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(targetDay).padStart(2, '0')}`;

    // 종료일 당일 회차는 포함, 초과 시 중단 (문자열 비교로 UTC/KST 혼용 방지)
    if (endDateStr && targetDateStr > endDateStr) break;

    dates.push(targetDateStr);
    pointer = new Date(year, month + 1, 1);
  }

  return dates;
}
