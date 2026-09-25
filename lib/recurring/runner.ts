import type { SupabaseClient } from '@supabase/supabase-js';
import { format } from 'date-fns';
import { getCycleRange } from '@/lib/date';
import { getKstToday } from '@/lib/kst';
import { planRecurringGeneration, type RecurringSource } from './engine';

/**
 * 고정 지출/수입·할부 자동 생성 실행기.
 * cron(service role, 전체 사용자), 앱 진입/급여일 변경 시 동기화(사용자 세션 + RLS),
 * 신규 등록 직후 백필이 모두 이 함수 하나를 거친다.
 */

const PAGE_SIZE = 1000;

export interface SyncOptions {
  /** 특정 사용자만 처리 (없으면 전체 — service role 전용) */
  userId?: string;
  /** 특정 고정 항목만 처리 */
  fixedIds?: string[];
  /**
   * 'current': 현재 급여 사이클 안에서만 생성 (cron/동기화 기본값)
   * 'backfill': 시작일부터 현재 사이클 종료일까지 소급 생성 (신규 등록 직후)
   */
  mode?: 'current' | 'backfill';
  now?: Date;
}

export interface SyncResult {
  processed: number;
  created: number;
  deactivated: number;
  failures: { fixedId: string; stage: 'insert' | 'update'; message: string }[];
}

// Supabase 쿼리 빌더 타입이 수기 작성된 Database 타입과 맞지 않아 느슨하게 다룬다
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = SupabaseClient<any, any, any>;

async function fetchAll<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>
): Promise<T[]> {
  const all: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await build(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    const rows = data || [];
    all.push(...rows);
    if (rows.length < PAGE_SIZE) break;
  }
  return all;
}

export async function syncRecurring(supabase: AnyClient, options: SyncOptions = {}): Promise<SyncResult> {
  const { userId, fixedIds, mode = 'current', now = new Date() } = options;
  const today = getKstToday(now);

  // 1. 급여일 설정 (조회 실패 시 기본값 1로 진행하면 잘못된 사이클로 생성되므로 중단)
  const settings = await fetchAll<{ user_id: string; cycle_start_day: number | null }>((from, to) => {
    let q = supabase.from('user_settings').select('user_id, cycle_start_day');
    if (userId) q = q.eq('user_id', userId);
    return q.order('user_id').range(from, to);
  });
  const cycleDayMap = new Map(settings.map((s) => [s.user_id, s.cycle_start_day || 1]));

  // 2. 활성 고정 항목
  const items = await fetchAll<RecurringSource>((from, to) => {
    let q = supabase.from('fixed_transactions').select('*').eq('is_active', true);
    if (userId) q = q.eq('user_id', userId);
    if (fixedIds && fixedIds.length > 0) q = q.in('fixed_transaction_id', fixedIds);
    return q.order('fixed_transaction_id').range(from, to);
  });

  const result: SyncResult = { processed: 0, created: 0, deactivated: 0, failures: [] };

  for (const item of items) {
    const cycleDay = cycleDayMap.get(item.user_id) || 1;
    const cycle = getCycleRange(today, cycleDay);
    const horizonEnd = format(cycle.end, 'yyyy-MM-dd');
    const floor = mode === 'current' ? format(cycle.start, 'yyyy-MM-dd') : undefined;

    let plan;
    try {
      plan = planRecurringGeneration(item, horizonEnd, { floor });
    } catch (error) {
      result.failures.push({
        fixedId: item.fixed_transaction_id,
        stage: 'insert',
        message: error instanceof Error ? error.message : String(error),
      });
      continue;
    }

    result.processed += 1;

    if (plan.rows.length > 0) {
      // (source_fixed_id, date) 유니크 인덱스 + DO NOTHING → 재실행/동시 실행에도 중복 없음
      const { data: inserted, error } = await supabase
        .from('transactions')
        .upsert(plan.rows, { onConflict: 'source_fixed_id,date', ignoreDuplicates: true })
        .select('transaction_id');
      if (error) {
        // insert가 실패하면 last_generated를 올리지 않는다 → 다음 실행에서 재시도
        result.failures.push({ fixedId: item.fixed_transaction_id, stage: 'insert', message: error.message });
        continue;
      }
      result.created += inserted?.length ?? 0;
    }

    if (plan.fixedUpdate) {
      const { error } = await supabase
        .from('fixed_transactions')
        .update(plan.fixedUpdate)
        .eq('fixed_transaction_id', item.fixed_transaction_id);
      if (error) {
        result.failures.push({ fixedId: item.fixed_transaction_id, stage: 'update', message: error.message });
        continue;
      }
      if (plan.fixedUpdate.is_active === false) result.deactivated += 1;
    }
  }

  return result;
}
