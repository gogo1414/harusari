import { format } from 'date-fns';
import { getCycleRange, calculateTargetDateInCycle } from './date';

/**
 * 급여 사이클(급여일) 변경 시 고정지출 거래를 새 사이클에 맞게 재정렬하기 위한
 * 순수 계획(plan) 계산 로직. 부수효과 없음 — DB 작업은 호출부(API 라우트)에서 수행한다.
 *
 * 배경: 고정지출 거래는 "달력 월 + day"로 생성되지만, 화면 표시와 cron 중복방지는
 * 급여 사이클(getCycleRange) 기준이다. 급여일을 바꾸면 사이클 창이 이동해
 * (1) 기존 거래가 새 창 밖으로 빠져 안 보이고 (2) cron 중복방지가 어긋나 누락/중복이 발생한다.
 * 이 모듈은 "현재 사이클"의 고정지출을 새 급여일 기준으로 정확히 1건씩 재배치하는 계획을 만든다.
 */

export interface FixedItemLite {
  fixed_transaction_id: string;
  day: number;
  is_active: boolean | null;
  end_type: string | null;
  end_date: string | null;
  /** 할부 항목은 재정렬에서 제외(월 진행 상태가 있어 위험) */
  is_installment?: boolean | null;
}

export interface ReconcileAction {
  fixedId: string;
  /** 새 사이클에서의 올바른 거래 날짜 (YYYY-MM-DD) */
  targetDate: string;
}

export interface ReconcilePlan {
  cycleChanged: boolean;
  /** 각 고정지출별 자동생성 거래 정리(삭제) 범위 — 현재 기간(구/신 사이클 합집합)만 */
  clearWindow: { start: string; end: string };
  actions: ReconcileAction[];
  /** 재정렬에서 제외된 항목 id (할부/종료/사이클 밖) */
  skipped: string[];
}

function minDate(a: Date, b: Date): Date {
  return a.getTime() <= b.getTime() ? a : b;
}
function maxDate(a: Date, b: Date): Date {
  return a.getTime() >= b.getTime() ? a : b;
}

/**
 * 급여일 변경 시 현재 사이클 고정지출 재정렬 계획을 만든다.
 * @param fixedItems 유저의 고정지출 목록
 * @param oldCycleDay 변경 전 급여일
 * @param newCycleDay 변경 후 급여일
 * @param today 기준 날짜(KST 기준 Date 권장)
 */
export function buildReconcilePlan(params: {
  fixedItems: FixedItemLite[];
  oldCycleDay: number;
  newCycleDay: number;
  today: Date;
}): ReconcilePlan {
  const { fixedItems, oldCycleDay, newCycleDay, today } = params;

  const oldCycle = getCycleRange(today, oldCycleDay);
  const newCycle = getCycleRange(today, newCycleDay);

  // 정리 범위 = 구 사이클 ∪ 신 사이클 (현재 기간만 건드림 — 과거 달 기록은 보존)
  const clearStart = format(minDate(oldCycle.start, newCycle.start), 'yyyy-MM-dd');
  const clearEnd = format(maxDate(oldCycle.end, newCycle.end), 'yyyy-MM-dd');
  const clearWindow = { start: clearStart, end: clearEnd };

  if (oldCycleDay === newCycleDay) {
    return { cycleChanged: false, clearWindow, actions: [], skipped: [] };
  }

  const newCycleStartStr = format(newCycle.start, 'yyyy-MM-dd');
  const actions: ReconcileAction[] = [];
  const skipped: string[] = [];

  for (const item of fixedItems) {
    // 비활성 / 할부 항목 제외
    if (item.is_active === false || item.is_installment === true) {
      skipped.push(item.fixed_transaction_id);
      continue;
    }
    // 종료일이 새 사이클 시작 이전이면 재생성하지 않음
    if (item.end_type === 'date' && item.end_date && item.end_date < newCycleStartStr) {
      skipped.push(item.fixed_transaction_id);
      continue;
    }
    const targetDate = calculateTargetDateInCycle(item.day, newCycle.start, newCycle.end, newCycleDay);
    if (!targetDate) {
      skipped.push(item.fixed_transaction_id);
      continue;
    }
    actions.push({ fixedId: item.fixed_transaction_id, targetDate });
  }

  return { cycleChanged: true, clearWindow, actions, skipped };
}
