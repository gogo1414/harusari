'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, Loader2, Sparkles, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';
import { showToast } from '@/lib/toast';
import { useBackOrHome } from '@/hooks/useBackOrHome';
import { useUserSettings } from '@/app/context/UserSettingsContext';
import { getKstTodayStr } from '@/lib/kst';
import type { ParseResult } from '@/lib/ai/types';
import type { TransactionLocation } from '@/lib/location/types';
import { toTransactionLocation, type PlaceSearchResponse } from '@/lib/location/place';
import {
  toDrafts,
  validateDraft,
  resolveDraftLocation,
  toInsertRow,
  type QuickDraft,
} from '@/lib/quick-add/drafts';
import LocationPicker from '@/components/location/LocationPicker';
import CategorySelectDialog from '@/components/forms/transaction/CategorySelectDialog';
import DraftCard from '@/components/quick-add/DraftCard';

const MAX_TEXT = 500;
const EXAMPLES = ['삼각김밥 1400원', '어제 택시 12,300', '커피 4500, 점심 9천원', '월급 320만원 들어옴'];
/** 상호 검색 결과를 개별 위치로 쓰는 최대 거리(m) */
const PLACE_HINT_MAX_DISTANCE_M = 1500;

async function requestParse(text: string, today: string): Promise<ParseResult> {
  const res = await fetch('/api/ai/parse', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, today }),
  });
  const isJson = (res.headers.get('content-type') ?? '').includes('application/json');
  const body = isJson ? await res.json().catch(() => null) : null;
  if (!res.ok || !body) {
    throw new Error(body?.error || '분석하지 못했어요. 잠시 후 다시 시도해 주세요');
  }
  return body as ParseResult;
}

export default function QuickAddPage() {
  const router = useRouter();
  const goBack = useBackOrHome();
  const supabase = createClient();
  const queryClient = useQueryClient();
  const { categories } = useUserSettings();

  const [text, setText] = useState('');
  const [drafts, setDrafts] = useState<QuickDraft[]>([]);
  const [engine, setEngine] = useState<ParseResult['engine'] | null>(null);
  const [sharedLocation, setSharedLocation] = useState<TransactionLocation | null | undefined>(undefined);
  const [pickerFor, setPickerFor] = useState<string | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const hintTriedRef = useRef<Set<string>>(new Set());
  const today = getKstTodayStr();

  const categoryMap = useMemo(() => new Map(categories.map((c) => [c.category_id, c])), [categories]);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const parseMutation = useMutation({
    mutationFn: (input: string) => requestParse(input, getKstTodayStr()),
    onSuccess: (result) => {
      if (result.entries.length === 0) {
        showToast.info('금액이 담긴 내역을 찾지 못했어요. 예) 삼각김밥 1400원');
        return;
      }
      setDrafts((prev) => [...prev, ...toDrafts(result.entries)]);
      setEngine(result.engine);
      setShowErrors(false);
      setText('');
      result.warnings.forEach((w) => showToast.info(w));
    },
    onError: (error) => {
      showToast.error(error instanceof Error ? error.message : '분석하지 못했어요');
    },
  });

  // 상호가 언급된 오늘 내역은 현재 위치 근처에서 그 상호를 찾아 개별 위치로 붙인다 (예: '스벅' → 스타벅스 ○○점)
  const hintAbortRef = useRef<AbortController | null>(null);
  useEffect(() => () => hintAbortRef.current?.abort(), []);
  useEffect(() => {
    if (!sharedLocation) return;
    const targets = drafts.filter(
      (d) => d.placeHint && d.location === undefined && d.date === today && !hintTriedRef.current.has(d.key)
    );
    if (targets.length === 0) return;
    if (!hintAbortRef.current) hintAbortRef.current = new AbortController();
    const { signal } = hintAbortRef.current;

    targets.forEach((draft) => {
      hintTriedRef.current.add(draft.key);
      const params = new URLSearchParams({
        q: draft.placeHint as string,
        lat: String(sharedLocation.lat),
        lng: String(sharedLocation.lng),
      });
      fetch(`/api/location/search?${params.toString()}`, { signal })
        .then((res) => (res.ok ? (res.json() as Promise<PlaceSearchResponse>) : null))
        .then((data) => {
          const best = data?.results.find(
            (r) => typeof r.distance === 'number' && r.distance <= PLACE_HINT_MAX_DISTANCE_M
          );
          if (!best) return;
          setDrafts((prev) =>
            prev.map((d) =>
              d.key === draft.key && d.location === undefined ? { ...d, location: toTransactionLocation(best) } : d
            )
          );
        })
        .catch(() => {
          // 상호 검색은 보조 기능 → 실패해도 공통 위치로 저장
        });
    });
  }, [drafts, sharedLocation, today]);

  const errors = useMemo(() => new Map(drafts.map((d) => [d.key, validateDraft(d)])), [drafts]);
  const hasErrors = [...errors.values()].some(Boolean);
  const total = drafts.reduce(
    (acc, d) => {
      if (d.amount) acc[d.type] += d.amount;
      return acc;
    },
    { income: 0, expense: 0 }
  );

  const saveMutation = useMutation({
    mutationFn: async (items: QuickDraft[]) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('로그인이 필요합니다');
      const rows = items.map((d) => toInsertRow(d, user.id, sharedLocation, today));
      // 여러 건을 한 번의 insert로 저장 → 일부만 저장되는 일이 없다
      const { error } = await supabase.from('transactions').insert(rows as never);
      if (error) throw error;
      return rows.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      showToast.success(`${count}건을 저장했어요`);
      router.replace('/');
    },
    onError: (error) => {
      console.error('quick add save failed:', error);
      showToast.error('저장하지 못했어요. 잠시 후 다시 시도해 주세요');
    },
  });

  const handleAnalyze = () => {
    const value = text.trim();
    if (!value || parseMutation.isPending) return;
    parseMutation.mutate(value.slice(0, MAX_TEXT));
  };

  const handleSave = () => {
    if (saveMutation.isPending || drafts.length === 0) return;
    if (hasErrors) {
      setShowErrors(true);
      showToast.error('확인이 필요한 내역이 있어요');
      return;
    }
    saveMutation.mutate(drafts);
  };

  const updateDraft = (key: string, patch: Partial<QuickDraft>) =>
    setDrafts((prev) => prev.map((d) => (d.key === key ? { ...d, ...patch } : d)));

  const pickerDraft = drafts.find((d) => d.key === pickerFor);

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border/30 bg-background/95 px-4 py-3 backdrop-blur-sm">
        <Button
          variant="ghost"
          size="icon"
          onClick={goBack}
          aria-label="뒤로 가기"
          className="-ml-2 h-10 w-10 rounded-full hover:bg-black/5 dark:hover:bg-white/10"
        >
          <ChevronLeft className="h-6 w-6" />
        </Button>
        <span className="text-lg font-bold">빠른 입력</span>
        <div className="w-10" />
      </div>

      <div className="flex-1 space-y-5 px-5 pb-36 pt-4">
        <section aria-labelledby="quick-input-label" className="space-y-3">
          <label id="quick-input-label" htmlFor="quick-input" className="block text-[15px] font-bold text-foreground">
            쓴 돈을 그냥 적어주세요
          </label>
          <div className="rounded-3xl border border-border/60 bg-card p-3 shadow-sm focus-within:ring-2 focus-within:ring-primary/30">
            <textarea
              id="quick-input"
              ref={textareaRef}
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, MAX_TEXT))}
              onKeyDown={(e) => {
                // Enter = 분석, Shift+Enter = 줄바꿈 (한글 조합 중 Enter는 무시)
                if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  handleAnalyze();
                }
              }}
              rows={3}
              placeholder={'예) 삼각김밥 1400원\n어제 택시 12,300 / 스벅 아아 4500'}
              className="w-full resize-none bg-transparent px-2 py-1 text-[17px] leading-relaxed text-foreground outline-none placeholder:text-muted-foreground/60"
            />
            <div className="flex items-center justify-between gap-2 pt-1">
              <span className="pl-2 text-xs text-muted-foreground">여러 건은 줄바꿈·쉼표로 구분</span>
              <Button
                type="button"
                onClick={handleAnalyze}
                disabled={!text.trim() || parseMutation.isPending}
                className="h-11 rounded-2xl px-5 font-bold"
              >
                {parseMutation.isPending ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="mr-1.5 h-4 w-4" />
                )}
                {parseMutation.isPending ? '분석 중' : '분석'}
              </Button>
            </div>
          </div>
          {drafts.length === 0 && (
            <div className="flex flex-wrap gap-2" aria-label="입력 예시">
              {EXAMPLES.map((example) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => {
                    setText(example);
                    textareaRef.current?.focus();
                  }}
                  className="h-9 rounded-full border border-border/60 bg-card px-3 text-[13px] font-medium text-muted-foreground hover:bg-muted"
                >
                  {example}
                </button>
              ))}
            </div>
          )}
        </section>

        <section aria-label="위치" className="space-y-1">
          <LocationPicker value={sharedLocation} onChange={setSharedLocation} autoDetect />
          <p className="px-1 text-xs text-muted-foreground">
            오늘 날짜 내역에만 붙어요. 상호를 적으면(예: 스벅) 근처 매장을 찾아 따로 붙여요.
          </p>
        </section>

        {drafts.length > 0 && (
          <section aria-labelledby="drafts-label" className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 id="drafts-label" className="text-[15px] font-bold text-foreground">
                확인하고 저장하기 <span className="text-primary">{drafts.length}</span>
              </h2>
              {engine && (
                <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
                  <Wand2 className="h-3 w-3" aria-hidden="true" />
                  {engine === 'gemini' ? 'AI 분석' : '간단 분석'}
                </span>
              )}
            </div>
            <ul className="space-y-3">
              {drafts.map((draft, index) => (
                <DraftCard
                  key={draft.key}
                  draft={draft}
                  index={index}
                  category={draft.categoryId ? categoryMap.get(draft.categoryId) : undefined}
                  effectiveLocation={resolveDraftLocation(draft, sharedLocation, today)}
                  error={errors.get(draft.key) ?? null}
                  showError={showErrors}
                  onChange={(patch) => updateDraft(draft.key, patch)}
                  onRemove={() => setDrafts((prev) => prev.filter((d) => d.key !== draft.key))}
                  onPickCategory={() => setPickerFor(draft.key)}
                />
              ))}
            </ul>
          </section>
        )}
      </div>

      {drafts.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-20 mx-auto max-w-[480px] border-t border-border/40 bg-background/95 px-5 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-3 backdrop-blur-sm">
          <p className="mb-2 text-center text-[13px] text-muted-foreground" aria-live="polite">
            {total.expense > 0 && <>지출 {total.expense.toLocaleString('ko-KR')}원</>}
            {total.expense > 0 && total.income > 0 && ' · '}
            {total.income > 0 && <>수입 {total.income.toLocaleString('ko-KR')}원</>}
          </p>
          <Button
            type="button"
            onClick={handleSave}
            disabled={saveMutation.isPending}
            className="h-14 w-full rounded-2xl text-[17px] font-bold"
          >
            {saveMutation.isPending ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
            {drafts.length}건 저장하기
          </Button>
        </div>
      )}

      <CategorySelectDialog
        open={!!pickerDraft}
        onOpenChange={(open) => !open && setPickerFor(null)}
        categories={categories.filter((c) => c.type === (pickerDraft?.type ?? 'expense'))}
        selectedCategoryId={pickerDraft?.categoryId ?? null}
        onSelect={(categoryId) => pickerDraft && updateDraft(pickerDraft.key, { categoryId })}
        onAddNew={() => router.push('/categories')}
      />
    </div>
  );
}
