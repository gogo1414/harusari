import { parseISO } from 'date-fns';

/**
 * 한국 시간(KST) 기준 날짜 유틸.
 *
 * 서버(Vercel)는 UTC, 로컬 개발 환경은 KST 등 실행 환경의 TZ가 제각각이라
 * `new Date()`의 로컬 getter를 그대로 쓰면 00:00~09:00 KST 사이에 하루가 어긋난다.
 * Intl로 KST 달력 날짜를 문자열로 뽑은 뒤, 로컬 자정 Date로 다시 만들어
 * 실행 환경 TZ와 무관하게 "KST의 오늘"을 다룬다.
 */
const KST_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** KST 기준 오늘 날짜 문자열 (yyyy-MM-dd) */
export function getKstTodayStr(now: Date = new Date()): string {
  // en-CA 로케일은 yyyy-MM-dd 형식을 반환한다
  return KST_FORMATTER.format(now);
}

/** KST 기준 오늘을 "로컬 자정 Date"로 반환 (getCycleRange 등 로컬 getter 기반 계산용) */
export function getKstToday(now: Date = new Date()): Date {
  return parseISO(getKstTodayStr(now));
}
