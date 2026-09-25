/**
 * yyyy-MM-dd 문자열 기반 날짜 유틸 (실행 환경 TZ와 무관하도록 UTC 연산만 사용).
 * 기준일(today)은 항상 KST 달력 날짜 문자열로 전달된다.
 */

const YMD_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export const WEEKDAY_KO = ['일', '월', '화', '수', '목', '금', '토'] as const;

/** 유효한 달력 날짜인지 (yyyy-MM-dd) */
export function isValidYmd(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const m = YMD_RE.exec(value);
  if (!m) return false;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1) return false;
  return d <= daysInMonth(y, mo);
}

/** 해당 월의 일수 (month: 1~12) */
export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** yyyy-MM-dd → UTC 자정 epoch(ms) */
function toUtc(ymd: string): number {
  const [y, m, d] = ymd.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** 연/월/일 → yyyy-MM-dd (범위 밖이면 Date 정규화를 따른다) */
export function makeYmd(year: number, month: number, day: number): string {
  const dt = new Date(Date.UTC(year, month - 1, day));
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

/** 날짜 더하기 */
export function addDays(ymd: string, days: number): string {
  const dt = new Date(toUtc(ymd) + days * 86_400_000);
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

/** a - b (일 단위) */
export function diffDays(a: string, b: string): number {
  return Math.round((toUtc(a) - toUtc(b)) / 86_400_000);
}

/** 요일 (0=일 ~ 6=토) */
export function weekdayOf(ymd: string): number {
  return new Date(toUtc(ymd)).getUTCDay();
}

/** 연/월/일 분해 */
export function splitYmd(ymd: string): { year: number; month: number; day: number } {
  const [year, month, day] = ymd.split('-').map(Number);
  return { year, month, day };
}
