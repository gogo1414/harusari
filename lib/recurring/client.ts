import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * 고정 지출/수입·할부 등록 (브라우저).
 * 1) fixed_transactions 1건 insert
 * 2) 서버 동기화 라우트로 시작일부터 현재 사이클까지 회차 생성 (엔진 단일화)
 * 2가 실패하면 1을 지워 "반쪽 등록"(재시도 시 이중 등록)을 남기지 않는다.
 */

export interface FixedInsertPayload {
  user_id: string;
  amount: number;
  type: 'income' | 'expense';
  day: number;
  start_date: string;
  category_id: string | null;
  memo: string | null;
  end_type: 'never' | 'date';
  end_date: string | null;
  is_installment?: boolean;
  installment_principal?: number | null;
  installment_months?: number | null;
  installment_rate?: number | null;
  installment_free_months?: number | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = SupabaseClient<any, any, any>;

export async function requestRecurringSync(fixedId?: string): Promise<{ created: number }> {
  const res = await fetch('/api/recurring/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fixedId ? { fixedId } : {}),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error || `recurring sync failed (${res.status})`);
  }
  const body = await res.json().catch(() => ({}));
  return { created: Number(body?.created) || 0 };
}

export async function createFixedWithBackfill(supabase: AnyClient, payload: FixedInsertPayload): Promise<string> {
  const { data, error } = await supabase
    .from('fixed_transactions')
    .insert({
      ...payload,
      is_active: true,
      last_generated: null,
      // 회차는 엔진이 날짜로 계산해 채운다 (생성 전 0)
      installment_current_month: payload.is_installment ? 0 : null,
    })
    .select('fixed_transaction_id')
    .single();

  if (error) throw error;
  const fixedId = (data as { fixed_transaction_id: string }).fixed_transaction_id;

  try {
    await requestRecurringSync(fixedId);
  } catch (syncError) {
    // 보상 삭제: 생성된 거래가 있어도 FK(ON DELETE SET NULL)로 고아가 되므로 함께 지운다
    await supabase.from('transactions').delete().eq('source_fixed_id', fixedId);
    await supabase.from('fixed_transactions').delete().eq('fixed_transaction_id', fixedId);
    throw syncError;
  }

  return fixedId;
}
