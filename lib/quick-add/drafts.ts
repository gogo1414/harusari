import type { ParsedEntry } from '@/lib/ai/types';
import { locationColumns, type TransactionLocation } from '@/lib/location/types';
import { validateAmount } from '@/lib/validation';

/**
 * AI 빠른 입력: 분석 결과(ParsedEntry)를 사용자가 확인·수정하는 초안과 저장 행 변환 (순수 함수).
 */
export interface QuickDraft {
  key: string;
  amount: number | null;
  type: 'income' | 'expense';
  categoryId: string | null;
  date: string;
  memo: string;
  placeHint: string | null;
  currency: string;
  originalAmount: number | null;
  confidence: number;
  /**
   * 위치. undefined = 공통 위치(현재 위치)를 따름, null = 위치 없음, 값 = 개별 위치(상호 검색 결과 등)
   */
  location?: TransactionLocation | null;
}

let seq = 0;
export function toDrafts(entries: ParsedEntry[]): QuickDraft[] {
  return entries.map((e) => ({
    key: `d${Date.now().toString(36)}${(seq++).toString(36)}`,
    amount: e.amount,
    type: e.type,
    categoryId: e.categoryId,
    date: e.date,
    memo: e.memo,
    placeHint: e.placeHint,
    currency: e.currency || 'KRW',
    originalAmount: e.originalAmount,
    confidence: e.confidence,
  }));
}

/** 저장 가능 여부 검사. 문제가 있으면 사용자에게 보여줄 메시지 */
export function validateDraft(draft: QuickDraft): string | null {
  if (draft.amount === null) {
    return draft.currency !== 'KRW' ? '원화 금액을 입력해 주세요' : '금액을 입력해 주세요';
  }
  const amountError = validateAmount(draft.amount);
  if (amountError) return amountError;
  if (!draft.categoryId) return '카테고리를 골라 주세요';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.date)) return '날짜를 확인해 주세요';
  return null;
}

/**
 * 초안에 적용될 위치.
 * 공통 위치(현재 GPS)는 "오늘"의 지출 내역에만 적용한다 — "어제 치킨"에 지금 위치를 붙이면 틀린 기록이 된다.
 */
export function resolveDraftLocation(
  draft: QuickDraft,
  sharedLocation: TransactionLocation | null | undefined,
  today: string
): TransactionLocation | null {
  if (draft.location !== undefined) return draft.location;
  // 수입(월급 등)은 장소 개념이 없다
  if (draft.type === 'income') return null;
  if (draft.date !== today) return null;
  return sharedLocation ?? null;
}

export function toInsertRow(
  draft: QuickDraft,
  userId: string,
  sharedLocation: TransactionLocation | null | undefined,
  today: string
) {
  const foreignNote =
    draft.currency !== 'KRW' && draft.originalAmount !== null
      ? ` (${draft.originalAmount.toLocaleString('ko-KR')} ${draft.currency})`
      : '';
  const memo = `${draft.memo.trim()}${foreignNote}`.trim().slice(0, 100);
  return {
    user_id: userId,
    amount: draft.amount as number,
    type: draft.type,
    category_id: draft.categoryId,
    date: draft.date,
    memo: memo || null,
    input_source: 'ai',
    ...locationColumns(resolveDraftLocation(draft, sharedLocation, today)),
  };
}
