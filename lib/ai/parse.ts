import type { CategoryOption, ParsedEntry, ParseResult } from './types';
import { parseWithGemini } from './gemini';
import { parseWithRules } from './rule-parser';

/**
 * AI 빠른 입력 분석 진입점.
 * - GEMINI_API_KEY가 있고 useGemini !== false면 Gemini 우선
 * - Gemini 실패(예외) 또는 0건인데 규칙이 찾은 경우 → 규칙 기반 결과 + 안내 문구
 * - Gemini 결과의 빈 카테고리는 같은 금액/유형의 규칙 결과로 보충
 */

export const FALLBACK_WARNING = '간단 분석 모드로 처리했어요';
export const EMPTY_WARNING = '거래 내역을 찾지 못했어요. 품목과 금액을 함께 적어 주세요';
export const FOREIGN_WARNING = '외화 금액은 원화로 직접 입력해 주세요';
export const MISSING_AMOUNT_WARNING = '금액을 찾지 못한 항목이 있어요';

export interface ParseOptions {
  useGemini?: boolean;
}

/** Gemini 항목 중 카테고리가 비어 있으면 규칙 결과(같은 금액·유형)에서 채운다 */
function fillCategoriesFromRules(entries: ParsedEntry[], rules: ParsedEntry[]): ParsedEntry[] {
  const used = new Set<number>();
  return entries.map((e) => {
    if (e.categoryId || e.amount === null) return e;
    const idx = rules.findIndex(
      (r, i) => !used.has(i) && r.categoryId && r.amount === e.amount && r.type === e.type
    );
    if (idx < 0) return e;
    used.add(idx);
    return { ...e, categoryId: rules[idx].categoryId, categoryName: rules[idx].categoryName };
  });
}

/** 결과 상태에 따른 안내 문구 */
function collectWarnings(entries: ParsedEntry[]): string[] {
  const warnings: string[] = [];
  if (entries.length === 0) warnings.push(EMPTY_WARNING);
  if (entries.some((e) => e.currency !== 'KRW')) warnings.push(FOREIGN_WARNING);
  if (entries.some((e) => e.currency === 'KRW' && e.amount === null)) {
    warnings.push(MISSING_AMOUNT_WARNING);
  }
  return warnings;
}

export async function parseTransactionText(
  text: string,
  categories: CategoryOption[],
  today: string,
  opts: ParseOptions = {}
): Promise<ParseResult> {
  const ruleEntries = parseWithRules(text, categories, today);
  const geminiEnabled = Boolean(process.env.GEMINI_API_KEY) && opts.useGemini !== false;

  if (!geminiEnabled) {
    return { engine: 'rules', entries: ruleEntries, warnings: collectWarnings(ruleEntries) };
  }

  try {
    const geminiEntries = await parseWithGemini(text, categories, today);
    if (geminiEntries.length === 0 && ruleEntries.length > 0) {
      return {
        engine: 'rules',
        entries: ruleEntries,
        warnings: [FALLBACK_WARNING, ...collectWarnings(ruleEntries)],
      };
    }
    const entries = fillCategoriesFromRules(geminiEntries, ruleEntries);
    return { engine: 'gemini', entries, warnings: collectWarnings(entries) };
  } catch (err) {
    // 입력 원문은 로그에 남기지 않는다 (길이만)
    console.warn(
      `[ai/parse] Gemini 실패 → 규칙 기반 대체 (len=${text.length}):`,
      err instanceof Error ? err.message : 'unknown'
    );
    return {
      engine: 'rules',
      entries: ruleEntries,
      warnings: [FALLBACK_WARNING, ...collectWarnings(ruleEntries)],
    };
  }
}
