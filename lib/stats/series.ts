/**
 * 통계 화면 차트용 파생 데이터 (순수 함수).
 * 금액 합산 규칙은 통계 화면과 동일: 지출(expense) 중 저축 거래는 호출부에서 제외한다.
 */
import { addDays, differenceInCalendarDays, format, parseISO, startOfDay } from 'date-fns';

export interface SeriesTransaction {
  amount: number;
  type: 'income' | 'expense';
  category_id: string | null;
  date: string;
}

// ─── 카테고리 색 ─────────────────────────────────────────────

/**
 * 범주형 색 슬롯 수. dataviz 검증 팔레트(globals.css --viz-1..6)의 앞 6칸.
 * 7번째 이후 카테고리는 '기타'(중립 회색)로 접는다 — 색을 순환·생성하지 않는다.
 */
export const CATEGORY_SLOT_COUNT = 6;
/** 지도(모든 쌍 비교 형태)는 색각이상 안전 기준상 앞 3칸만 색으로 구분 */
export const MAP_SLOT_COUNT = 3;

export const OTHER_COLOR = 'var(--viz-other)';

export function slotColor(slot: number | null | undefined): string {
  if (slot === null || slot === undefined || slot < 0 || slot >= CATEGORY_SLOT_COUNT) return OTHER_COLOR;
  return `var(--viz-${slot + 1})`;
}

/**
 * 카테고리 → 색 슬롯. 조회 구간(최근 6사이클) 전체 지출 순위로 한 번 정해,
 * 사이클 이동 전까지 기간 토글/지도/도넛 어디서나 같은 카테고리는 같은 색을 유지한다.
 */
export function buildCategorySlots(expenseByCategory: Record<string, number>): Map<string, number> {
  const ranked = Object.entries(expenseByCategory)
    .filter(([id, amount]) => id !== 'unknown' && amount > 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  return new Map(ranked.slice(0, CATEGORY_SLOT_COUNT).map(([id], index) => [id, index]));
}

export interface CategorySlice {
  /** 카테고리 id ('other'는 기타 묶음) */
  id: string;
  name: string;
  icon: string;
  amount: number;
  /** 0~1 */
  share: number;
  color: string;
  /** 기타로 묶인 카테고리 수 (기타 항목에만) */
  foldedCount?: number;
}

/**
 * 카테고리별 지출을 도넛/범례용 조각으로 변환.
 * 색 슬롯이 있는 카테고리만 개별 조각, 나머지는 '기타' 하나로 접는다(마지막에 배치).
 */
export function buildCategorySlices(
  expenseByCategory: Record<string, number>,
  categories: readonly { category_id: string; name: string; icon: string }[],
  slots: Map<string, number>
): CategorySlice[] {
  const total = Object.values(expenseByCategory).reduce((s, v) => s + v, 0);
  if (total <= 0) return [];
  const byId = new Map(categories.map((c) => [c.category_id, c]));

  const slices: CategorySlice[] = [];
  let otherAmount = 0;
  let foldedCount = 0;
  for (const [id, amount] of Object.entries(expenseByCategory)) {
    if (amount <= 0) continue;
    const slot = slots.get(id);
    if (slot === undefined) {
      otherAmount += amount;
      foldedCount += 1;
      continue;
    }
    const cat = byId.get(id);
    slices.push({
      id,
      name: cat?.name ?? '미분류',
      icon: cat?.icon ?? 'money',
      amount,
      share: amount / total,
      color: slotColor(slot),
    });
  }
  slices.sort((a, b) => b.amount - a.amount);
  if (otherAmount > 0) {
    slices.push({
      id: 'other',
      name: foldedCount === 1 ? otherName(expenseByCategory, slots, byId) : '기타',
      icon: 'money',
      amount: otherAmount,
      share: otherAmount / total,
      color: OTHER_COLOR,
      foldedCount,
    });
  }
  return slices;
}

// 기타로 접힌 카테고리가 하나뿐이면 그 이름을 그대로 보여준다
function otherName(
  expenseByCategory: Record<string, number>,
  slots: Map<string, number>,
  byId: Map<string, { name: string }>
): string {
  const id = Object.keys(expenseByCategory).find((k) => expenseByCategory[k] > 0 && !slots.has(k));
  return (id && byId.get(id)?.name) || '기타';
}

// ─── 일별 지출 ───────────────────────────────────────────────

export interface DailyPoint {
  date: string;
  /** 축 라벨 (일) */
  day: number;
  amount: number;
  isToday: boolean;
  isFuture: boolean;
}

export interface DailySeries {
  points: DailyPoint[];
  total: number;
  /** 경과일 기준 일평균 (진행 중 사이클은 오늘까지, 지난 사이클은 전체 일수) */
  average: number;
  elapsedDays: number;
  maxPoint: DailyPoint | null;
}

export function buildDailySeries(
  transactions: readonly SeriesTransaction[],
  cycle: { start: Date; end: Date },
  today: Date
): DailySeries {
  const start = startOfDay(cycle.start);
  const end = startOfDay(cycle.end);
  const todayKey = format(today, 'yyyy-MM-dd');
  const totalDays = differenceInCalendarDays(end, start) + 1;

  const byDate = new Map<string, number>();
  for (const t of transactions) {
    if (t.type !== 'expense') continue;
    byDate.set(t.date, (byDate.get(t.date) ?? 0) + t.amount);
  }

  const points: DailyPoint[] = [];
  let total = 0;
  for (let i = 0; i < totalDays; i++) {
    const d = addDays(start, i);
    const key = format(d, 'yyyy-MM-dd');
    const amount = byDate.get(key) ?? 0;
    total += amount;
    points.push({ date: key, day: d.getDate(), amount, isToday: key === todayKey, isFuture: key > todayKey });
  }

  const elapsed = Math.min(totalDays, Math.max(0, differenceInCalendarDays(startOfDay(today), start) + 1));
  // 미래 사이클(elapsed 0)은 평균 0, 지난 사이클은 전체 일수
  const elapsedDays = startOfDay(today) > end ? totalDays : elapsed;
  const average = elapsedDays > 0 ? Math.round(total / elapsedDays) : 0;

  let maxPoint: DailyPoint | null = null;
  for (const p of points) {
    if (p.amount > 0 && (!maxPoint || p.amount > maxPoint.amount)) maxPoint = p;
  }

  return { points, total, average, elapsedDays, maxPoint };
}

// ─── 요일 패턴 ───────────────────────────────────────────────

export const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'] as const;

export interface WeekdayPoint {
  /** 0=일 ~ 6=토 */
  weekday: number;
  label: string;
  /** 해당 요일 하루 평균 지출 */
  average: number;
  total: number;
  /** 구간 내 해당 요일 일수 */
  days: number;
}

/**
 * 요일별 하루 평균 지출. 구간은 [start, min(end, today)]로 자른다(미래 요일이 평균을 깎지 않도록).
 * weekStartDay(0=일, 1=월) 순서로 정렬해 반환.
 */
export function buildWeekdayPattern(
  transactions: readonly SeriesTransaction[],
  range: { start: Date; end: Date },
  today: Date,
  weekStartDay = 0
): WeekdayPoint[] {
  const start = startOfDay(range.start);
  const cappedEnd = startOfDay(range.end) < startOfDay(today) ? startOfDay(range.end) : startOfDay(today);
  const startKey = format(start, 'yyyy-MM-dd');
  const endKey = format(cappedEnd, 'yyyy-MM-dd');

  const days = new Array(7).fill(0);
  const totals = new Array(7).fill(0);
  const span = differenceInCalendarDays(cappedEnd, start) + 1;
  for (let i = 0; i < span; i++) days[addDays(start, i).getDay()] += 1;

  for (const t of transactions) {
    if (t.type !== 'expense' || t.date < startKey || t.date > endKey) continue;
    totals[parseISO(t.date).getDay()] += t.amount;
  }

  const result: WeekdayPoint[] = [];
  for (let i = 0; i < 7; i++) {
    const weekday = (weekStartDay + i) % 7;
    result.push({
      weekday,
      label: WEEKDAY_LABELS[weekday],
      average: days[weekday] > 0 ? Math.round(totals[weekday] / days[weekday]) : 0,
      total: totals[weekday],
      days: days[weekday],
    });
  }
  return result;
}

// ─── 금액 표기 ───────────────────────────────────────────────

const KRW = new Intl.NumberFormat('ko-KR');

export function formatWon(value: number): string {
  return `${KRW.format(Math.round(value))}원`;
}

/** 축/라벨용 축약 (12만, 3.5만, 8천) */
export function formatCompactWon(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 100_000_000) return `${trimZero(value / 100_000_000)}억`;
  if (abs >= 10_000) return `${trimZero(value / 10_000)}만`;
  if (abs >= 1_000) return `${trimZero(value / 1_000)}천`;
  return KRW.format(Math.round(value));
}

function trimZero(n: number): string {
  const fixed = Math.abs(n) >= 100 ? n.toFixed(0) : n.toFixed(1);
  return fixed.replace(/\.0$/, '');
}
