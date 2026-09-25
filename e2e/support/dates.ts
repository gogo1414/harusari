/** 테스트 기대값 계산용 날짜 유틸 (앱 코드와 독립적으로 단순 구현) */
const pad = (n: number) => String(n).padStart(2, '0');

export function ymd(y: number, m0: number, d: number): string {
  const base = new Date(Date.UTC(y, m0, 1));
  const yy = base.getUTCFullYear();
  const mm = base.getUTCMonth();
  const last = new Date(Date.UTC(yy, mm + 1, 0)).getUTCDate();
  return `${yy}-${pad(mm + 1)}-${pad(Math.min(d, last))}`;
}

export function parts(s: string) {
  const [y, m, d] = s.split('-').map(Number);
  return { y, m0: m - 1, d };
}

/** 급여일 기준 사이클 [start, end] (yyyy-MM-dd) */
export function cycleOf(today: string, payday: number): { start: string; end: string } {
  const { y, m0, d } = parts(today);
  const thisStart = ymd(y, m0, payday);
  const startMonth = today >= thisStart ? m0 : m0 - 1;
  const start = ymd(y, startMonth, payday);
  const nextStart = ymd(y, startMonth + 1, payday);
  const ns = parts(nextStart);
  const endDate = new Date(Date.UTC(ns.y, ns.m0, ns.d - 1));
  const end = `${endDate.getUTCFullYear()}-${pad(endDate.getUTCMonth() + 1)}-${pad(endDate.getUTCDate())}`;
  void d;
  return { start, end };
}

/** 매달 day일(말일 클램프) 중 [from, to] 구간에 속하는 날짜들 */
export function monthlyDates(day: number, from: string, to: string): string[] {
  const f = parts(from);
  const out: string[] = [];
  for (let i = 0; i < 48; i++) {
    const date = ymd(f.y, f.m0 + i, day);
    if (date > to) break;
    if (date >= from) out.push(date);
  }
  return out;
}

export function addMonthsYmd(s: string, months: number, day?: number): string {
  const { y, m0, d } = parts(s);
  return ymd(y, m0 + months, day ?? d);
}
