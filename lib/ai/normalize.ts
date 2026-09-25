import type { CategoryOption, ParsedEntry } from './types';
import { getKstTodayStr } from '@/lib/kst';
import { diffDays, isValidYmd } from './dates';

/**
 * 어떤 엔진(Gemini/규칙)의 출력이든 저장 가능한 형태로 검증·정리한다.
 * 모델 출력은 신뢰하지 않는다: 존재하지 않는 카테고리 id, 범위 밖 금액/날짜 등을 모두 걸러낸다.
 */

export const MAX_ENTRIES = 20;
export const MAX_AMOUNT = 1_000_000_000;
export const MAX_MEMO_LENGTH = 50;
const MAX_PLACE_LENGTH = 30;
/** 허용 날짜 범위 (기준일 대비) */
const MIN_DAY_OFFSET = -400;
const MAX_DAY_OFFSET = 31;

function toNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const cleaned = value.replace(/[,\s원]/g, '');
    if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** 제어 문자·제로폭·줄 구분 문자 (U+2028 등을 정규식 리터럴에 넣으면 트랜스파일 시 깨지므로 문자열로 생성) */
const CONTROL_CHARS_RE = new RegExp(
  '[\\u0000-\\u001f\\u007f\\u200b-\\u200f\\u2028\\u2029\\ufeff]',
  'g'
);

/** 제어 문자 제거 + 공백 정리 + 코드포인트 기준 길이 제한 */
export function cleanText(value: unknown, maxLength: number): string {
  if (typeof value !== 'string') return '';
  const cleaned = value.replace(CONTROL_CHARS_RE, ' ');
  const collapsed = cleaned.replace(/\s+/g, ' ').trim();
  return Array.from(collapsed).slice(0, maxLength).join('').trim();
}

function clampConfidence(value: unknown): number {
  const n = toNumber(value);
  if (n === null) return 0.5;
  return Math.min(1, Math.max(0, n));
}

/** 흔한 비표준 표기 → ISO 4217 */
const CURRENCY_ALIASES: Record<string, string> = { WON: 'KRW', YEN: 'JPY', RMB: 'CNY' };

let knownCurrencies: Set<string> | null | undefined;
/** 런타임이 아는 ISO 4217 코드 목록 (미지원 환경이면 null → 형식만 검사) */
function getKnownCurrencies(): Set<string> | null {
  if (knownCurrencies !== undefined) return knownCurrencies;
  try {
    const intl = Intl as unknown as { supportedValuesOf?: (key: string) => string[] };
    knownCurrencies = intl.supportedValuesOf ? new Set(intl.supportedValuesOf('currency')) : null;
  } catch {
    knownCurrencies = null;
  }
  return knownCurrencies;
}

/** 통화 코드 정규화: 3자리 ISO 코드가 아니면 KRW */
function normalizeCurrency(raw: string): string {
  const code = CURRENCY_ALIASES[raw] ?? raw;
  if (!/^[A-Z]{3}$/.test(code)) return 'KRW';
  const known = getKnownCurrencies();
  return !known || known.has(code) ? code : 'KRW';
}

/** id → 카테고리, 실패 시 이름으로 재시도. type 불일치는 인정하지 않는다 */
function resolveCategory(
  rawId: unknown,
  rawName: unknown,
  type: 'income' | 'expense',
  categories: CategoryOption[]
): CategoryOption | null {
  if (typeof rawId === 'string' && rawId) {
    const byId = categories.find((c) => c.id === rawId);
    if (byId && byId.type === type) return byId;
  }
  if (typeof rawName === 'string' && rawName.trim()) {
    const name = rawName.trim().toLowerCase();
    const byName = categories.find((c) => c.type === type && c.name.trim().toLowerCase() === name);
    if (byName) return byName;
  }
  return null;
}

/** 원시 출력에서 항목 배열을 꺼낸다 ({ entries: [...] } 또는 [...]) */
function extractItems(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === 'object' && Array.isArray((raw as { entries?: unknown }).entries)) {
    return (raw as { entries: unknown[] }).entries;
  }
  return [];
}

/** 단일 항목 정규화 (버릴 항목이면 null) */
function normalizeEntry(
  item: unknown,
  categories: CategoryOption[],
  today: string
): ParsedEntry | null {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
  const obj = item as Record<string, unknown>;
  let confidence = clampConfidence(obj.confidence);

  const type: 'income' | 'expense' = obj.type === 'income' ? 'income' : 'expense';

  // 통화: 3자리 영문 대문자만 인정
  const rawCurrency = typeof obj.currency === 'string' ? obj.currency.trim().toUpperCase() : '';
  const currency = normalizeCurrency(rawCurrency);

  let amount: number | null = null;
  let originalAmount: number | null = null;
  if (currency === 'KRW') {
    const n = toNumber(obj.amount);
    if (n !== null) {
      const rounded = Math.round(Math.abs(n));
      if (rounded > 0 && rounded <= MAX_AMOUNT) {
        amount = rounded;
      } else {
        confidence *= 0.5;
      }
    }
  } else {
    // 외화: 환산하지 않는다. 원화 금액은 사용자가 직접 입력
    const n = toNumber(obj.originalAmount) ?? toNumber(obj.amount);
    if (n !== null && n > 0 && n <= MAX_AMOUNT) {
      originalAmount = Math.round(n * 100) / 100;
    } else {
      confidence *= 0.5;
    }
  }

  const category = resolveCategory(obj.categoryId, obj.categoryName, type, categories);

  let date = today;
  if (isValidYmd(obj.date)) {
    const offset = diffDays(obj.date, today);
    if (offset >= MIN_DAY_OFFSET && offset <= MAX_DAY_OFFSET) {
      date = obj.date;
    } else {
      confidence *= 0.7;
    }
  } else if (obj.date !== undefined && obj.date !== null && obj.date !== '') {
    confidence *= 0.8;
  }

  const memo = cleanText(obj.memo, MAX_MEMO_LENGTH);
  const place = cleanText(obj.placeHint, MAX_PLACE_LENGTH);

  // 금액도, 내용도 없는 항목은 버린다
  if (amount === null && originalAmount === null && !memo) return null;

  return {
    amount,
    type,
    categoryId: category?.id ?? null,
    categoryName: category?.name ?? null,
    date,
    memo,
    placeHint: place || null,
    currency,
    originalAmount,
    confidence: Math.round(confidence * 100) / 100,
  };
}

/** 엔진 출력 전체 정규화 (최대 20건) */
export function normalizeEntries(
  raw: unknown,
  categories: CategoryOption[],
  today: string
): ParsedEntry[] {
  const safeToday = isValidYmd(today) ? today : getKstTodayStr();
  const out: ParsedEntry[] = [];
  for (const item of extractItems(raw)) {
    const entry = normalizeEntry(item, categories, safeToday);
    if (entry) out.push(entry);
    if (out.length >= MAX_ENTRIES) break;
  }
  return out;
}
