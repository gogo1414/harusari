import { calculateInstallment } from '@/lib/installment';

/**
 * 고정 지출/수입·할부 자동 생성 엔진 (순수 함수).
 *
 * 이전 구조의 문제
 * - cron은 "급여 사이클당 1건"만 만들었는데, 급여일 29~31일 + 결제일 조합에 따라
 *   한 사이클에 실제 결제일이 0개 또는 2개인 경우가 있어 결제가 누락됐다.
 * - 할부 회차를 카운터(installment_current_month)로만 진행해, 이미 존재하는 날짜와 충돌(23505)해도
 *   카운터를 올려 회차가 통째로 사라졌다.
 * - 시작일 개념이 없어 미래 시작 항목이 시작 전에 생성되고 할부 1회차가 누락됐다.
 * - 등록 시 백필(달력 월 기준)과 cron(사이클 기준)이 서로 다른 규칙을 썼다.
 *
 * 새 규칙 (등록 백필 · cron · 앱 진입 시 동기화가 모두 이 함수 하나를 쓴다)
 * - 결제일은 "매달 day일(말일 클램프)"로 달력 기준으로만 정해진다.
 * - 생성 구간: (마지막 생성일 다음 날 또는 시작일) ~ horizonEnd(보통 현재 급여 사이클 종료일)
 * - 할부 회차 = 시작월로부터의 개월 차 + 1 (카운터가 아니라 날짜로 결정 → 누락/중복 불가)
 * - 중복은 DB 유니크 인덱스 (source_fixed_id, date) + ON CONFLICT DO NOTHING으로 최종 방어
 */

export interface RecurringSource {
  fixed_transaction_id: string;
  user_id: string;
  amount: number;
  type: 'income' | 'expense';
  day: number;
  category_id: string | null;
  memo: string | null;
  start_date: string | null;
  end_type: 'never' | 'date' | null;
  end_date: string | null;
  last_generated: string | null;
  is_active: boolean | null;
  created_at?: string | null;
  is_installment: boolean | null;
  installment_principal: number | null;
  installment_months: number | null;
  installment_rate: number | null;
  installment_free_months: number | null;
  installment_current_month?: number | null;
}

export interface GeneratedTransaction {
  user_id: string;
  amount: number;
  type: 'income' | 'expense';
  category_id: string | null;
  date: string;
  memo: string | null;
  source_fixed_id: string;
  input_source: 'recurring';
}

export interface FixedUpdate {
  last_generated?: string;
  installment_current_month?: number;
  amount?: number;
  memo?: string;
  is_active?: boolean;
}

export interface GenerationPlan {
  rows: GeneratedTransaction[];
  /** 생성 후 fixed_transactions에 반영할 변경 (없으면 null) */
  fixedUpdate: FixedUpdate | null;
}

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function parseYmd(s: string): { y: number; m: number; d: number } {
  const match = DATE_RE.exec(s);
  if (!match) throw new Error(`Invalid date string: ${s}`);
  return { y: Number(match[1]), m: Number(match[2]) - 1, d: Number(match[3]) };
}

/** (연, 0-based 월, 일) → yyyy-MM-dd. 해당 월에 없는 일자는 말일로 클램프 */
export function clampedDateStr(year: number, monthIndex: number, day: number): string {
  // monthIndex가 범위를 벗어나도 정규화
  const base = new Date(year, monthIndex, 1);
  const y = base.getFullYear();
  const m = base.getMonth();
  const lastDay = new Date(y, m + 1, 0).getDate();
  return `${y}-${pad(m + 1)}-${pad(Math.min(Math.max(day, 1), lastDay))}`;
}

/** yyyy-MM-dd 문자열에 하루 더하기 (TZ 무관) */
export function addOneDayStr(s: string): string {
  const { y, m, d } = parseYmd(s);
  const next = new Date(y, m, d + 1);
  return `${next.getFullYear()}-${pad(next.getMonth() + 1)}-${pad(next.getDate())}`;
}

function monthIndexOf(s: string): number {
  const { y, m } = parseYmd(s);
  return y * 12 + m;
}

/** 할부 메모: 기존 "(할부 n/m)" 꼬리표를 지우고 새 회차로 교체 */
export function buildInstallmentMemo(memo: string | null | undefined, round: number, months: number): string {
  const baseMemo = (memo || '').replace(/\s*\(할부\s*\d+\/\d+\)\s*$/, '').trim();
  return `${baseMemo} (할부 ${round}/${months})`.trim();
}

/** start_date가 없는 레거시 행을 위한 시작일 추정 */
export function resolveStartDate(item: RecurringSource): string {
  if (item.start_date && DATE_RE.test(item.start_date)) return item.start_date;

  if (item.is_installment && item.end_date && item.installment_months) {
    const { y, m } = parseYmd(item.end_date);
    return clampedDateStr(y, m - item.installment_months, item.day);
  }
  if (item.last_generated && DATE_RE.test(item.last_generated)) return item.last_generated;
  if (item.created_at) return item.created_at.slice(0, 10);
  throw new Error(`Cannot resolve start date for ${item.fixed_transaction_id}`);
}

export interface PlanOptions {
  /**
   * 이 날짜 이전 회차는 만들지 않는다 (yyyy-MM-dd, 포함 하한).
   * cron/앱 동기화는 "현재 급여 사이클 시작일"을 넘겨 과거 달을 소급 생성하지 않는다
   * (사용자가 일부러 지운 과거 회차가 되살아나는 것 방지). 등록 시 백필은 생략.
   */
  floor?: string;
}

/**
 * 고정 항목 1건에 대해 horizonEnd(포함)까지 생성해야 할 거래와 fixed 행 변경을 계산한다.
 * @param horizonEnd 생성 한계일 (yyyy-MM-dd, 포함). 보통 KST 오늘이 속한 급여 사이클의 종료일.
 */
export function planRecurringGeneration(
  item: RecurringSource,
  horizonEnd: string,
  options: PlanOptions = {}
): GenerationPlan {
  if (item.is_active === false) return { rows: [], fixedUpdate: null };

  const day = Math.min(Math.max(item.day || 1, 1), 31);
  const startStr = resolveStartDate(item);
  const fromCandidate = item.last_generated ? addOneDayStr(item.last_generated) : startStr;
  let fromStr = fromCandidate > startStr ? fromCandidate : startStr;
  if (options.floor && options.floor > fromStr) fromStr = options.floor;

  const isInstallment = item.is_installment === true;
  const months = item.installment_months || 0;
  const schedule = isInstallment
    ? calculateInstallment({
        principal: item.installment_principal || 0,
        months,
        annualRate: Number(item.installment_rate) || 0,
        interestFreeMonths: item.installment_free_months || 0,
      }).schedule
    : [];

  // 할부인데 스케줄을 만들 수 없으면(원금/개월 이상) 더 이상 생성하지 않도록 비활성화
  if (isInstallment && schedule.length === 0) {
    return { rows: [], fixedUpdate: { is_active: false } };
  }

  const endLimit =
    !isInstallment && item.end_type === 'date' && item.end_date ? item.end_date : null;

  const rows: GeneratedTransaction[] = [];
  let lastRound = 0;
  const startMonth = monthIndexOf(startStr);

  if (fromStr <= horizonEnd) {
    for (let mi = monthIndexOf(fromStr); mi <= monthIndexOf(horizonEnd); mi++) {
      const year = Math.floor(mi / 12);
      const month = mi % 12;
      const date = clampedDateStr(year, month, day);

      if (date < fromStr || date < startStr || date > horizonEnd) continue;
      if (endLimit && date > endLimit) break;

      if (isInstallment) {
        const round = mi - startMonth + 1;
        if (round < 1) continue;
        if (round > months) break;
        const scheduleItem = schedule[round - 1];
        rows.push({
          user_id: item.user_id,
          amount: scheduleItem.total,
          type: 'expense',
          category_id: item.category_id,
          date,
          memo: buildInstallmentMemo(item.memo, round, months),
          source_fixed_id: item.fixed_transaction_id,
          input_source: 'recurring',
        });
        lastRound = round;
      } else {
        rows.push({
          user_id: item.user_id,
          amount: item.amount,
          type: item.type,
          category_id: item.category_id,
          date,
          memo: item.memo,
          source_fixed_id: item.fixed_transaction_id,
          input_source: 'recurring',
        });
      }
    }
  }

  const update: FixedUpdate = {};
  if (rows.length > 0) {
    const last = rows[rows.length - 1];
    update.last_generated = last.date;
    if (isInstallment) {
      update.installment_current_month = lastRound;
      update.amount = last.amount;
      update.memo = last.memo || undefined;
    }
  }

  // 종료 판정: 더 생성할 회차가 없으면 비활성화
  if (isInstallment) {
    const finalDate = clampedDateStr(Math.floor((startMonth + months - 1) / 12), (startMonth + months - 1) % 12, day);
    // 마지막 회차 날짜가 이번 생성 한계 안에 들어오면 이번 실행으로 모든 회차가 처리된 것
    if (finalDate <= horizonEnd) update.is_active = false;
  } else if (endLimit && endLimit <= horizonEnd) {
    update.is_active = false;
  }

  return { rows, fixedUpdate: Object.keys(update).length > 0 ? update : null };
}
