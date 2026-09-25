'use client';

import { MapPin, X, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CategoryIcon } from '@/components/category/IconPicker';
import type { Category } from '@/types/database';
import type { QuickDraft } from '@/lib/quick-add/drafts';
import type { TransactionLocation } from '@/lib/location/types';

interface DraftCardProps {
  draft: QuickDraft;
  index: number;
  category: Category | undefined;
  /** 이 초안에 실제로 저장될 위치 (공통 위치 반영 결과) */
  effectiveLocation: TransactionLocation | null;
  error: string | null;
  showError: boolean;
  onChange: (patch: Partial<QuickDraft>) => void;
  onRemove: () => void;
  onPickCategory: () => void;
}

function formatAmountInput(value: number | null): string {
  return value === null ? '' : value.toLocaleString('ko-KR');
}

export default function DraftCard({
  draft,
  index,
  category,
  effectiveLocation,
  error,
  showError,
  onChange,
  onRemove,
  onPickCategory,
}: DraftCardProps) {
  const label = `${index + 1}번째 내역`;
  const isForeign = draft.currency !== 'KRW';

  return (
    <li
      className={cn(
        'rounded-3xl border bg-card p-4 shadow-sm transition-colors',
        showError && error ? 'border-destructive/60' : 'border-border/60'
      )}
      aria-label={label}
    >
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={onPickCategory}
          className="flex shrink-0 flex-col items-center gap-1 rounded-2xl p-0.5 active:scale-95 transition-transform"
          aria-label={`${label} 카테고리 선택${category ? ` (현재 ${category.name})` : ''}`}
        >
          {category ? (
            <CategoryIcon iconName={category.icon} className="h-12 w-12" variant="squircle" showBackground />
          ) : (
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl border-2 border-dashed border-muted-foreground/30 text-xs font-semibold text-muted-foreground">
              선택
            </span>
          )}
          <span className="max-w-[56px] truncate text-[11px] font-medium text-muted-foreground">
            {category?.name ?? '카테고리'}
          </span>
        </button>

        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <input
              value={draft.memo}
              onChange={(e) => onChange({ memo: e.target.value.slice(0, 50) })}
              placeholder="내용"
              aria-label={`${label} 내용`}
              className="h-9 min-w-0 flex-1 rounded-xl bg-transparent px-1 text-[16px] font-semibold text-foreground outline-none placeholder:text-muted-foreground/60 focus:bg-muted/50"
            />
            <button
              type="button"
              onClick={onRemove}
              className="-mr-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
              aria-label={`${label} 빼기`}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <div
              role="radiogroup"
              aria-label={`${label} 수입/지출`}
              className="flex shrink-0 rounded-full bg-muted p-0.5 text-xs font-semibold"
            >
              {(['expense', 'income'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  role="radio"
                  aria-checked={draft.type === t}
                  onClick={() => draft.type !== t && onChange({ type: t, categoryId: null })}
                  className={cn(
                    'h-8 rounded-full px-3 transition-colors',
                    draft.type === t
                      ? t === 'expense'
                        ? 'bg-card text-foreground shadow-sm'
                        : 'bg-card text-blue-600 shadow-sm dark:text-blue-400'
                      : 'text-muted-foreground'
                  )}
                >
                  {t === 'expense' ? '지출' : '수입'}
                </button>
              ))}
            </div>
            <div className="flex min-w-0 flex-1 items-center justify-end gap-1">
              <input
                inputMode="numeric"
                value={formatAmountInput(draft.amount)}
                onChange={(e) => {
                  const digits = e.target.value.replace(/[^\d]/g, '').slice(0, 10);
                  onChange({ amount: digits ? Number(digits) : null });
                }}
                placeholder={isForeign ? '원화 금액' : '0'}
                aria-label={`${label} 금액(원)`}
                className="h-9 w-full min-w-0 rounded-xl bg-muted/50 px-3 text-right text-[17px] font-bold tabular-nums text-foreground outline-none focus:ring-2 focus:ring-primary/40"
              />
              <span className="text-sm font-semibold text-muted-foreground">원</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted-foreground">
            <input
              type="date"
              value={draft.date}
              onChange={(e) => e.target.value && onChange({ date: e.target.value })}
              aria-label={`${label} 날짜`}
              className="h-8 rounded-lg bg-transparent px-1 font-medium text-muted-foreground outline-none focus:bg-muted/50"
            />
            {isForeign && draft.originalAmount !== null && (
              <span className="rounded-full bg-amber-500/10 px-2 py-0.5 font-medium text-amber-700 dark:text-amber-400">
                {draft.originalAmount.toLocaleString('ko-KR')} {draft.currency}
              </span>
            )}
            {effectiveLocation && (
              <span className="inline-flex min-w-0 max-w-full items-center gap-1">
                <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span className="truncate">
                  {effectiveLocation.placeName || effectiveLocation.address || '현재 위치'}
                </span>
                {draft.location !== null && (
                  <button
                    type="button"
                    onClick={() => onChange({ location: null })}
                    className="ml-0.5 rounded-full p-1 hover:bg-muted"
                    aria-label={`${label} 위치 빼기`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </span>
            )}
          </div>

          {showError && error && (
            <p className="flex items-center gap-1 text-[13px] font-medium text-destructive" role="alert">
              <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
              {error}
            </p>
          )}
        </div>
      </div>
    </li>
  );
}
