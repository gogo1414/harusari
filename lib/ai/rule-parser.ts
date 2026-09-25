import type { CategoryOption, ParsedEntry } from './types';
import { addDays, daysInMonth, diffDays, makeYmd, splitYmd, weekdayOf } from './dates';
import { detectBrand, matchCategory, stripParticle } from './category-match';
import { normalizeEntries } from './normalize';

/**
 * 규칙 기반 거래 분석기 (결정적, 네트워크 없음).
 * Gemini 키가 없거나 실패했을 때 사용하며, 일상적인 한국어 입력은 이것만으로도 처리되도록 한다.
 *
 * 처리 순서 (줄 단위):
 *  1) 날짜 표현 탐지 → 같은 길이의 공백으로 마스킹 (위치 보존, 숫자가 금액으로 오인되지 않게)
 *  2) 쉼표/세미콜론/슬래시/'그리고' 등으로 하위 구간 분리
 *  3) 금액 표현 탐지 → "품목 금액 품목 금액" 순서로 항목 분리
 *  4) 항목별 수입/지출, 카테고리, 상호, 메모, 날짜 결정
 */

interface Span {
  start: number;
  end: number;
}

interface DateSpan extends Span {
  date: string;
  /** 미래 날짜를 오늘로 보정했는지 */
  clamped: boolean;
}

export interface AmountSpan extends Span {
  value: number;
  currency: string;
}

const MAX_INPUT_LENGTH = 1000;
/** 제로폭 문자 (정규식 리터럴에 직접 넣으면 트랜스파일 시 깨질 수 있어 문자열로 생성) */
const ZERO_WIDTH_RE = new RegExp('[\\u200b-\\u200f\\ufeff]', 'g');
const HANGUL_RE = /[가-힣]/;
const LATIN_RE = /[A-Za-z]/;
const DIGIT_RE = /\d/;

// ─────────────────────────── 날짜 ───────────────────────────

const WEEKDAY_IDX: Record<string, number> = { 일: 0, 월: 1, 화: 2, 수: 3, 목: 4, 금: 5, 토: 6 };
const KOR_DAY_COUNT: Record<string, number> = {
  하루: 1,
  이틀: 2,
  사흘: 3,
  나흘: 4,
  닷새: 5,
  엿새: 6,
  이레: 7,
};
const RELATIVE_WORDS: Record<string, number> = {
  엊그저께: -2,
  엊그제: -2,
  그끄저께: -3,
  그끄제: -3,
  그그제: -3,
  그저께: -2,
  그제: -2,
  어저께: -1,
  어제: -1,
  오늘: 0,
  금일: 0,
  내일: 1,
};

/** 월요일 시작 기준 요일 오프셋 (월=0 … 일=6) */
function mondayOffset(dow: number): number {
  return (dow + 6) % 7;
}

/**
 * 연도 없는 명시적 날짜(M/D, M월 D일) 해석.
 * 올해로 보되, 기준일보다 31일 넘게 미래면 작년으로 본다 (가계부는 과거 기록이 대부분).
 */
function resolveMonthDay(month: number, day: number, today: string, year?: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const t = splitYmd(today);
  if (year !== undefined) {
    return day <= daysInMonth(year, month) ? makeYmd(year, month, day) : null;
  }
  let y = t.year;
  if (day <= daysInMonth(y, month) && diffDays(makeYmd(y, month, day), today) > 31) y -= 1;
  return day <= daysInMonth(y, month) ? makeYmd(y, month, day) : null;
}

/** 이번 달/지난달 D일 */
function resolveDayOfMonth(day: number, today: string, monthShift: number): string | null {
  const t = splitYmd(today);
  const first = makeYmd(t.year, t.month + monthShift, 1);
  const { year, month } = splitYmd(first);
  if (day < 1 || day > daysInMonth(year, month)) return null;
  return makeYmd(year, month, day);
}

interface DatePattern {
  re: RegExp;
  /** 매치 앞 글자 검사 (false면 무시) */
  prevOk?: (prev: string) => boolean;
  /** 매치 뒤 문자열 검사 (false면 무시) */
  nextOk?: (rest: string) => boolean;
  resolve: (m: RegExpExecArray, today: string) => { date: string; clamped?: boolean } | null;
}

const notDigit = (prev: string) => !DIGIT_RE.test(prev);
/** 금액 단위/통화가 바로 뒤따르면 날짜가 아니다 (예: '1.5만', '4.5달러') */
const NOT_AMOUNT_AFTER_RE =
  /^\s?(?:[억만천백십원]|엔|달러|불|유로|위안|바트|동|페소|파운드|[A-Za-z%$€¥£₩]|\d)/;

const DATE_PATTERNS: DatePattern[] = [
  // 2026-09-03, 2026.9.3, 2026/9/3
  {
    re: /(\d{4})[-./](\d{1,2})[-./](\d{1,2})일?/g,
    prevOk: notDigit,
    resolve: (m) => {
      const d = resolveMonthDay(Number(m[2]), Number(m[3]), '2000-01-01', Number(m[1]));
      return d ? { date: d } : null;
    },
  },
  // 2026년 9월 3일
  {
    re: /(\d{4})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일/g,
    prevOk: notDigit,
    resolve: (m) => {
      const d = resolveMonthDay(Number(m[2]), Number(m[3]), '2000-01-01', Number(m[1]));
      return d ? { date: d } : null;
    },
  },
  // 9월 3일
  {
    re: /(\d{1,2})\s*월\s*(\d{1,2})\s*일/g,
    prevOk: notDigit,
    resolve: (m, today) => {
      const d = resolveMonthDay(Number(m[1]), Number(m[2]), today);
      return d ? { date: d } : null;
    },
  },
  // 지난달 25일 / 이번달 3일
  {
    re: /(지난|저번|전|이번|요번)\s*달\s*(\d{1,2})\s*일/g,
    resolve: (m, today) => {
      const shift = m[1] === '이번' || m[1] === '요번' ? 0 : -1;
      const d = resolveDayOfMonth(Number(m[2]), today, shift);
      return d ? { date: d } : null;
    },
  },
  // 9/3
  {
    re: /(\d{1,2})\/(\d{1,2})(?![\d/])/g,
    prevOk: (p) => !DIGIT_RE.test(p) && p !== '/',
    resolve: (m, today) => {
      const d = resolveMonthDay(Number(m[1]), Number(m[2]), today);
      return d ? { date: d } : null;
    },
  },
  // 9.3 (금액 소수점과 구분: 앞은 공백/시작, 뒤에 단위·통화가 없어야 함)
  {
    re: /(\d{1,2})\.(\d{1,2})(?![\d.])\.?/g,
    prevOk: (p) => p === '' || /[\s(]/.test(p),
    nextOk: (rest) => !NOT_AMOUNT_AFTER_RE.test(rest),
    resolve: (m, today) => {
      const d = resolveMonthDay(Number(m[1]), Number(m[2]), today);
      return d ? { date: d } : null;
    },
  },
  // 3일 전
  {
    re: /(\d{1,3})\s*일\s*전/g,
    prevOk: notDigit,
    resolve: (m, today) => {
      const n = Number(m[1]);
      return n <= 400 ? { date: addDays(today, -n) } : null;
    },
  },
  // 이틀 전
  {
    re: /(하루|이틀|사흘|나흘|닷새|엿새|이레)\s*전/g,
    resolve: (m, today) => ({ date: addDays(today, -KOR_DAY_COUNT[m[1]]) }),
  },
  // 2주 전 / 일주일 전
  {
    re: /(\d{1,2})\s*주\s*전/g,
    prevOk: notDigit,
    resolve: (m, today) => ({ date: addDays(today, -7 * Number(m[1])) }),
  },
  {
    re: /(일주일|한\s*주)\s*전/g,
    resolve: (m, today) => ({ date: addDays(today, -7) }),
  },
  // 지난주 금요일 / 이번주 월요일
  {
    re: /(지난|저번|이번|요번|금)\s*주\s*([월화수목금토일])(?:요일|욜)?/g,
    resolve: (m, today) => {
      const thisMonday = addDays(today, -mondayOffset(weekdayOf(today)));
      const weekStart = m[1] === '지난' || m[1] === '저번' ? addDays(thisMonday, -7) : thisMonday;
      const date = addDays(weekStart, mondayOffset(WEEKDAY_IDX[m[2]]));
      // 이번주의 미래 요일은 오늘로 보정
      return diffDays(date, today) > 0 ? { date: today, clamped: true } : { date };
    },
  },
  // 지난 주말
  {
    re: /(지난|저번)\s*주말/g,
    resolve: (m, today) => {
      const thisMonday = addDays(today, -mondayOffset(weekdayOf(today)));
      return { date: addDays(thisMonday, -2) };
    },
  },
  // 금요일 (가장 최근의 해당 요일, 오늘 포함)
  {
    re: /([월화수목금토일])(?:요일|욜)/g,
    resolve: (m, today) => {
      const back = (weekdayOf(today) - WEEKDAY_IDX[m[1]] + 7) % 7;
      return { date: addDays(today, -back) };
    },
  },
  // 지난주 (요일 없음)
  {
    re: /(지난|저번)\s*주(?:에)?/g,
    nextOk: (rest) => !HANGUL_RE.test(rest.charAt(0)),
    resolve: (m, today) => ({ date: addDays(today, -7) }),
  },
  // 어제/오늘/그제 …
  {
    re: /(엊그저께|엊그제|그끄저께|그끄제|그그제|그저께|그제|어저께|어제|오늘|금일|내일)/g,
    resolve: (m, today) => ({ date: addDays(today, RELATIVE_WORDS[m[1]]) }),
  },
  // 25일 (이번 달 또는 지난달 중 가장 최근)
  {
    re: /(\d{1,2})\s*일(?:에|날)?/g,
    prevOk: (p) => !DIGIT_RE.test(p) && p !== '.' && p !== '/',
    nextOk: (rest) => !HANGUL_RE.test(rest.charAt(0)) && !DIGIT_RE.test(rest.charAt(0)),
    resolve: (m, today) => {
      const day = Number(m[1]);
      const d =
        day <= splitYmd(today).day
          ? resolveDayOfMonth(day, today, 0)
          : resolveDayOfMonth(day, today, -1);
      return d ? { date: d } : null;
    },
  },
];

function overlaps(spans: Span[], start: number, end: number): boolean {
  return spans.some((s) => start < s.end && end > s.start);
}

/** 줄 안의 날짜 표현을 모두 찾는다 (겹치면 앞선 패턴 우선) */
export function findDates(line: string, today: string): DateSpan[] {
  const spans: DateSpan[] = [];
  for (const p of DATE_PATTERNS) {
    p.re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = p.re.exec(line)) !== null) {
      const start = m.index;
      const end = start + m[0].length;
      if (m[0].length === 0) {
        p.re.lastIndex++;
        continue;
      }
      const prev = start > 0 ? line[start - 1] : '';
      if (p.prevOk && !p.prevOk(prev)) continue;
      if (p.nextOk && !p.nextOk(line.slice(end))) continue;
      if (overlaps(spans, start, end)) continue;
      const r = p.resolve(m, today);
      if (!r) continue;
      spans.push({ start, end, date: r.date, clamped: r.clamped ?? false });
    }
  }
  return spans.sort((a, b) => a.start - b.start);
}

// ─────────────────────────── 금액 ───────────────────────────

const KOR_DIGIT: Record<string, number> = {
  일: 1,
  이: 2,
  삼: 3,
  사: 4,
  오: 5,
  육: 6,
  륙: 6,
  칠: 7,
  팔: 8,
  구: 9,
};
const SMALL_UNIT: Record<string, number> = { 십: 10, 백: 100, 천: 1000 };
const BIG_UNIT: Record<string, number> = { 만: 10_000, 억: 100_000_000 };

/** 금액 앞에 붙는 통화 기호/코드 */
const PREFIX_CURRENCIES: [string, string][] = [
  ['us$', 'USD'],
  ['$', 'USD'],
  ['€', 'EUR'],
  ['¥', 'JPY'],
  ['£', 'GBP'],
  ['₩', 'KRW'],
  ['krw', 'KRW'],
  ['usd', 'USD'],
  ['jpy', 'JPY'],
  ['eur', 'EUR'],
  ['cny', 'CNY'],
  ['gbp', 'GBP'],
  ['thb', 'THB'],
  ['vnd', 'VND'],
  ['hkd', 'HKD'],
  ['twd', 'TWD'],
  ['sgd', 'SGD'],
];

/** 금액 뒤에 붙는 통화 표현 (긴 것부터 검사) */
const SUFFIX_CURRENCIES: [string, string][] = (
  [
    ['홍콩달러', 'HKD'],
    ['대만달러', 'TWD'],
    ['싱가포르달러', 'SGD'],
    ['캐나다달러', 'CAD'],
    ['호주달러', 'AUD'],
    ['뉴질랜드달러', 'NZD'],
    ['미국달러', 'USD'],
    ['원', 'KRW'],
    ['₩', 'KRW'],
    ['won', 'KRW'],
    ['krw', 'KRW'],
    ['엔', 'JPY'],
    ['円', 'JPY'],
    ['yen', 'JPY'],
    ['jpy', 'JPY'],
    ['달러', 'USD'],
    ['딸라', 'USD'],
    ['불', 'USD'],
    ['usd', 'USD'],
    ['$', 'USD'],
    ['유로', 'EUR'],
    ['€', 'EUR'],
    ['eur', 'EUR'],
    ['위안', 'CNY'],
    ['元', 'CNY'],
    ['cny', 'CNY'],
    ['rmb', 'CNY'],
    ['바트', 'THB'],
    ['thb', 'THB'],
    ['동', 'VND'],
    ['vnd', 'VND'],
    ['페소', 'PHP'],
    ['php', 'PHP'],
    ['파운드', 'GBP'],
    ['£', 'GBP'],
    ['gbp', 'GBP'],
    ['루피아', 'IDR'],
    ['idr', 'IDR'],
    ['링깃', 'MYR'],
    ['myr', 'MYR'],
    ['루피', 'INR'],
    ['hkd', 'HKD'],
    ['twd', 'TWD'],
    ['sgd', 'SGD'],
    ['cad', 'CAD'],
    ['aud', 'AUD'],
    ['chf', 'CHF'],
  ] as [string, string][]
).sort((a, b) => b[0].length - a[0].length);

/** 숫자 바로 뒤에 오면 금액이 아닌 수량/단위 */
const COUNTER_RE =
  /^(?:개월|개|잔|인분|인|명|병|시간|시|분|초|권|장|켤레|회|박|일|번|층|호|동|살|달|주|년|캔|봉지|봉|팩|판|마리|그릇|접시|벌|대|곳|알|키로|킬로|퍼센트|프로|등|위|차|배|평|%|kg|g|ml|l|km|m|cm|mm|p)(?![A-Za-z])/i;

/** 이 글자들이 바로 뒤에 오면 통화 접미사로 보지 않는다 ('불고기', '101동 아파트' 등) */
const HANGUL_GUARDED_SUFFIX = new Set(['불', '동']);

const NUMBER_RE = /^(\d{1,3}(?:,\d{3})+(?!\d)|\d+)(\.\d+)?/;

/** 위치 i에서 금액 표현을 해석 (없으면 null) */
function parseAmountAt(s: string, i: number): AmountSpan | null {
  let pos = i;
  let currency: string | null = null;
  const lower = s.toLowerCase();

  // 1) 통화 접두어
  for (const [sym, code] of PREFIX_CURRENCIES) {
    if (!lower.startsWith(sym, pos)) continue;
    const isLatin = LATIN_RE.test(sym);
    const after = pos + sym.length;
    // 영문 코드는 단어 경계 + 뒤에 숫자가 와야 한다 ('usd 12', 'USD12')
    if (isLatin && !/^\s?\d/.test(s.slice(after))) continue;
    currency = code;
    pos = after;
    if (s[pos] === ' ') pos++;
    break;
  }

  // 2) 숫자/한글 수사/단위
  const bodyStart = pos;
  let total = 0;
  let section = 0;
  let n: number | null = null;
  let hasDigit = false;
  let hasKorDigit = false;
  let hasUnit = false;
  let hasDecimal = false;

  while (pos < s.length) {
    const ch = s[pos];
    if (DIGIT_RE.test(ch)) {
      if (n !== null) break;
      const m = NUMBER_RE.exec(s.slice(pos));
      if (!m) break;
      n = parseFloat(m[0].replace(/,/g, ''));
      hasDigit = true;
      if (m[2]) hasDecimal = true;
      pos += m[0].length;
    } else if (KOR_DIGIT[ch] !== undefined) {
      // 한글 수사는 단위가 바로 뒤따를 때만 ('오천', '삼만')
      const next = s[pos + 1];
      if (n !== null || !(next in SMALL_UNIT || next in BIG_UNIT)) break;
      n = KOR_DIGIT[ch];
      hasKorDigit = true;
      pos++;
    } else if (SMALL_UNIT[ch] !== undefined) {
      section += (n ?? 1) * SMALL_UNIT[ch];
      n = null;
      hasUnit = true;
      pos++;
    } else if (BIG_UNIT[ch] !== undefined) {
      section += n ?? 0;
      total += (section || 1) * BIG_UNIT[ch];
      section = 0;
      n = null;
      hasUnit = true;
      pos++;
      // '2만 3천원'처럼 큰 단위 뒤 공백 + 작은 단위 표현은 이어서 읽는다
      if (s[pos] === ' ' && /^ (?:\d+|[일이삼사오육칠팔구])\s?[천백십]/.test(s.slice(pos))) pos++;
    } else {
      break;
    }
  }
  if (pos === bodyStart) return null;
  const value = total + section + (n ?? 0);
  if (!(value > 0)) return null;
  const bodyEnd = pos;

  // 3) 통화 접미사
  let sfxPos = bodyEnd;
  if (s[sfxPos] === ' ') sfxPos++;
  let suffixCode: string | null = null;
  for (const [sym, code] of SUFFIX_CURRENCIES) {
    if (!lower.startsWith(sym, sfxPos)) continue;
    const after = s.charAt(sfxPos + sym.length);
    if (LATIN_RE.test(sym) && LATIN_RE.test(after)) continue;
    if (HANGUL_GUARDED_SUFFIX.has(sym) && HANGUL_RE.test(after)) continue;
    if (sym === '동' && value < 1000) continue;
    suffixCode = code;
    pos = sfxPos + sym.length;
    break;
  }

  if (suffixCode) {
    currency = currency ?? suffixCode;
  } else {
    // 한글 수사/단위만으로 된 표현('만원', '오천원')은 '원' 등이 있어야 금액으로 인정
    if (hasKorDigit || (!hasDigit && hasUnit)) return null;
    if (!currency) {
      const rest = s.slice(bodyEnd);
      if (COUNTER_RE.test(rest)) return null; // '2잔', '3개'
      if (LATIN_RE.test(rest.charAt(0))) return null; // '29cm', '3M'
      if (!hasUnit && value < 100) return null; // 단위 없는 작은 수는 수량일 가능성이 큼
      if (hasDecimal && !hasUnit) return null; // '4.5' 단독
      currency = 'KRW';
    }
  }

  return { start: i, end: pos, value, currency };
}

/** 문자열에서 금액 표현을 모두 찾는다 */
export function findAmounts(s: string): AmountSpan[] {
  const out: AmountSpan[] = [];
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    const prev = i > 0 ? s[i - 1] : '';
    let startable = false;
    if (DIGIT_RE.test(ch)) startable = !/[A-Za-z0-9.,]/.test(prev);
    else if (/[$€¥£₩]/.test(ch)) startable = true;
    else if (LATIN_RE.test(ch)) startable = !LATIN_RE.test(prev);
    else if (ch in KOR_DIGIT || ch in SMALL_UNIT || ch in BIG_UNIT)
      startable = !HANGUL_RE.test(prev);

    if (startable) {
      const m = parseAmountAt(s, i);
      if (m) {
        out.push(m);
        i = m.end;
        continue;
      }
    }
    i++;
  }
  return out;
}

/** 단일 금액 표현 해석 (테스트/외부 유틸용). 예) '5만3천500원' → 53500 */
export function parseKoreanAmount(text: string): { value: number; currency: string } | null {
  const found = findAmounts(text.trim());
  return found.length > 0 ? { value: found[0].value, currency: found[0].currency } : null;
}

// ─────────────────────────── 수입/지출 ───────────────────────────

/** 명확한 수입 표현 */
const STRONG_INCOME_RE =
  /들어옴|들어왔|들어온|받음|받았|받은|수령|입금됨|입금\s*됨|입금되|월급|급여|봉급|결제\s*취소|취소\s*환불/;
/** 수입 명사가 있어도 지출로 보는 문맥 */
const EXPENSE_CONTEXT_RE =
  /드림|드렸|줌|줬|주고|보냄|보냈|송금|이체함|냄|냈|납부|결제|대출|갚|사줌|사줬|쏨|쐈|(부모님|엄마|아빠|어머니|아버지|조카|할머니|할아버지|동생|애들|아들|딸)\s*용돈/;
/** 수입을 시사하는 명사 */
const INCOME_NOUN_RE =
  /용돈|환불|이자|보너스|상여|캐시백|페이백|판매|팔았|팔아서|정산|성과급|인센티브|배당|알바비|세뱃돈|부수입|환급|리워드|입금|수입/;

export function detectType(text: string): 'income' | 'expense' {
  if (STRONG_INCOME_RE.test(text)) return 'income';
  if (EXPENSE_CONTEXT_RE.test(text)) return 'expense';
  if (INCOME_NOUN_RE.test(text)) return 'income';
  return 'expense';
}

// ─────────────────────────── 메모 ───────────────────────────

/** 메모에서 뺄 군더더기 단어 */
const FILLER_WORDS = new Set([
  '들어옴',
  '들어왔음',
  '들어왔어',
  '들어왔다',
  '들어온',
  '받음',
  '받았음',
  '받았어',
  '받았다',
  '입금됨',
  '씀',
  '썼음',
  '썼어',
  '썼다',
  '지출',
  '결제',
  '결제함',
  '결제했음',
  '결제됨',
  '샀음',
  '샀다',
  '샀어',
  '사먹음',
  '먹음',
  '냄',
  '냈음',
  '냈다',
  '구매함',
  '구입함',
  '짜리',
  '원',
  '정도',
  '쯤',
  '총',
  '합계',
  '나감',
  '출금',
  '출금됨',
  '그리고',
  '및',
  '랑',
  '하고',
]);

const EDGE_PUNCT_RE = /^[\s,.;:!?~\-_()[\]{}"'`·•+*=/<>]+|[\s,.;:!?~\-_()[\]{}"'`·•+*=/<>]+$/g;

export function cleanMemo(raw: string): string {
  return raw
    .split(/\s+/)
    .map((t) => stripParticle(t.replace(EDGE_PUNCT_RE, '')))
    .filter((t) => t && !FILLER_WORDS.has(t))
    .join(' ')
    .trim();
}

// ─────────────────────────── 분리 ───────────────────────────

function mask(s: string, spans: Span[]): string {
  const chars = s.split('');
  for (const sp of spans) {
    for (let k = sp.start; k < sp.end; k++) chars[k] = ' ';
  }
  return chars.join('');
}

/** 한 줄 안의 하위 구간 (쉼표, 세미콜론, 슬래시, '그리고' 등) */
function splitSubSegments(masked: string): Span[] {
  const cuts: Span[] = [];
  const re = /,|;|\/|、|\s그리고\s|\s및\s/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(masked)) !== null) {
    const start = m.index;
    const end = start + m[0].length;
    const prev = masked.charAt(start - 1);
    const next = masked.charAt(end);
    // 천 단위 쉼표(12,300)는 구분자가 아니다
    if (m[0] === ',' && DIGIT_RE.test(prev) && /^\d{3}(?!\d)/.test(masked.slice(end))) continue;
    // 숫자 사이 슬래시(1/2 등)는 구분자로 쓰지 않는다
    if (m[0] === '/' && DIGIT_RE.test(prev) && DIGIT_RE.test(next)) continue;
    cuts.push({ start, end });
  }
  const segs: Span[] = [];
  let cursor = 0;
  for (const c of cuts) {
    segs.push({ start: cursor, end: c.start });
    cursor = c.end;
  }
  segs.push({ start: cursor, end: masked.length });
  return segs.filter((sg) => masked.slice(sg.start, sg.end).trim() !== '');
}

interface Chunk extends Span {
  amount: AmountSpan | null;
}

/** 하위 구간을 금액 기준 항목으로 분리 */
function splitChunks(masked: string, seg: Span, amounts: AmountSpan[]): Chunk[] {
  if (amounts.length === 0) return [{ ...seg, amount: null }];
  if (amounts.length === 1) return [{ ...seg, amount: amounts[0] }];

  const leading = masked.slice(seg.start, amounts[0].start).trim();
  const trailing = masked.slice(amounts[amounts.length - 1].end, seg.end).trim();
  const amountFirst = leading === '' && trailing !== '';

  return amounts.map((a, k) => {
    if (amountFirst) {
      // '3200 편의점 4500 커피'
      const start = k === 0 ? seg.start : a.start;
      const end = k + 1 < amounts.length ? amounts[k + 1].start : seg.end;
      return { start, end, amount: a };
    }
    // '편의점 3200 커피 4500' (마지막 금액 뒤 꼬리말은 마지막 항목에 붙인다)
    const start = k === 0 ? seg.start : amounts[k - 1].end;
    const end = k + 1 < amounts.length ? a.end : seg.end;
    return { start, end, amount: a };
  });
}

// ─────────────────────────── 본체 ───────────────────────────

/** 줄 머리 목록 기호 ('- ', '1. ', '• ') */
const LIST_MARKER_RE = /^(\s*)((?:[-*•·]|\d{1,2}[.)])\s+)/;
/** 시각(12:30), 전화번호는 금액 탐지에서 제외 */
const NOISE_RE = /\d{1,2}:\d{2}|\d{2,4}-\d{3,4}-\d{4}/g;

function computeConfidence(opts: {
  amount: AmountSpan | null;
  categoryVia: 'direct' | 'bucket' | null;
  memo: string;
  clamped: boolean;
}): number {
  let c = 0.4;
  if (opts.amount) c += opts.amount.currency === 'KRW' ? 0.3 : 0.15;
  else c -= 0.15;
  if (opts.categoryVia === 'direct') c += 0.2;
  else if (opts.categoryVia === 'bucket') c += 0.15;
  if (opts.memo) c += 0.05;
  if (opts.clamped) c -= 0.1;
  return Math.max(0.1, Math.min(0.9, Math.round(c * 100) / 100));
}

/**
 * 규칙 기반 분석.
 * @param text 사용자 입력 (여러 줄/여러 건 가능)
 * @param categories 사용자 카테고리 목록
 * @param today 기준일 (KST, yyyy-MM-dd)
 */
export interface RuleParseOptions {
  /** 날짜 언급이 없는 항목의 날짜 (기본: today). 상대 날짜(어제 등)는 항상 today 기준 */
  defaultDate?: string;
}

export function parseWithRules(
  text: string,
  categories: CategoryOption[],
  today: string,
  options: RuleParseOptions = {}
): ParsedEntry[] {
  const fallbackDate = options.defaultDate ?? today;
  const input = (text || '')
    .normalize('NFKC')
    .replace(ZERO_WIDTH_RE, '')
    .replace(/\t/g, ' ')
    .slice(0, MAX_INPUT_LENGTH);

  const raw: Record<string, unknown>[] = [];
  let carryDate: string | null = null; // '어제' 한 줄만 쓰고 다음 줄에 항목을 적은 경우

  for (const rawLine of input.split(/\r?\n/)) {
    const line = rawLine.replace(
      LIST_MARKER_RE,
      (_, lead: string, marker: string) => lead + ' '.repeat(marker.length)
    );
    if (!line.trim()) continue;

    const dates = findDates(line, today);
    const noise: Span[] = [];
    NOISE_RE.lastIndex = 0;
    let nm: RegExpExecArray | null;
    while ((nm = NOISE_RE.exec(line)) !== null) {
      noise.push({ start: nm.index, end: nm.index + nm[0].length });
    }
    const masked = mask(line, [...dates, ...noise]);
    const allAmounts = findAmounts(masked);

    // 금액 없는 하위 구간은 다음(없으면 이전) 구간에 합친다: '스벅, 아아 4500'
    let segs = splitSubSegments(masked).map((sg) => ({
      ...sg,
      amounts: allAmounts.filter((a) => a.start >= sg.start && a.end <= sg.end),
    }));
    if (allAmounts.length > 0 && segs.length > 1) {
      const merged: typeof segs = [];
      let pendingStart: number | null = null;
      for (const sg of segs) {
        if (sg.amounts.length === 0) {
          if (pendingStart === null) pendingStart = sg.start;
          continue;
        }
        merged.push({ ...sg, start: pendingStart ?? sg.start });
        pendingStart = null;
      }
      if (pendingStart !== null && merged.length > 0) {
        merged[merged.length - 1] = { ...merged[merged.length - 1], end: line.length };
      }
      segs = merged;
    }

    const chunks = segs.flatMap((sg) => splitChunks(masked, sg, sg.amounts));

    // 날짜 결정: 날짜 표현은 그것이 속한 항목부터 뒤 항목까지 적용한다.
    //   '스벅 4500, 어제 택시 12300' → 스벅=오늘, 택시=어제
    //   '어제 택시 12300, 커피 4500' → 둘 다 어제
    // 줄 끝(마지막 금액 뒤)에 붙은 날짜 하나는 줄 전체에 적용: '편의점 3200 커피 4500 어제'
    const inChunk = (d: DateSpan) => chunks.some((ch) => d.start >= ch.start && d.start < ch.end);
    const lastAmountEnd = allAmounts.reduce((max, a) => Math.max(max, a.end), -1);
    const lineWideDate =
      dates.length === 1 && (!inChunk(dates[0]) || dates[0].start >= lastAmountEnd) ? dates[0] : null;
    let prevDate: DateSpan | null = null;
    const lineEntries: Record<string, unknown>[] = [];
    for (const ch of chunks) {
      const own = dates.find((d) => d.start >= ch.start && d.start < ch.end) ?? null;
      const dateSpan: DateSpan | null = lineWideDate ?? own ?? prevDate;
      prevDate = dateSpan;

      const inner = allAmounts.filter((a) => a.start >= ch.start && a.end <= ch.end);
      const body = mask(masked, inner).slice(ch.start, ch.end);
      const original = line.slice(ch.start, ch.end);

      const type = detectType(original);
      const memoCore = cleanMemo(body);
      if (!ch.amount && !memoCore) continue; // 날짜만 있는 줄 등

      const brand = detectBrand(body);
      const cat = matchCategory(body, type, categories);
      const memo = memoCore || brand?.name || cat?.category.name || '';
      const foreign = ch.amount !== null && ch.amount.currency !== 'KRW';
      const date = dateSpan?.date ?? carryDate ?? fallbackDate;

      lineEntries.push({
        amount: ch.amount && !foreign ? Math.round(ch.amount.value) : null,
        type,
        categoryId: cat?.category.id ?? null,
        categoryName: cat?.category.name ?? null,
        date,
        memo,
        placeHint: brand?.name ?? null,
        currency: ch.amount?.currency ?? 'KRW',
        originalAmount: foreign && ch.amount ? ch.amount.value : null,
        confidence: computeConfidence({
          amount: ch.amount,
          categoryVia: cat?.via ?? null,
          memo: memoCore,
          clamped: dateSpan?.clamped ?? false,
        }),
      });
    }

    if (lineEntries.length === 0 && dates.length > 0) {
      carryDate = dates[dates.length - 1].date;
    }
    raw.push(...lineEntries);
  }

  return normalizeEntries(raw, categories, today);
}
