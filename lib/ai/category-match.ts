import type { CategoryOption } from './types';
import { BRANDS, BUCKETS, KEYWORD_RULES, isShortAlias, type EntryType } from './dictionary';

/**
 * 키워드/브랜드 탐지 및 사용자 카테고리 매칭 (순수 함수).
 */

/** 조사 제거 대상 (3자 이상 단어에만 적용해 '도로' 같은 단어 보호) */
const PARTICLE_RE = /(에서|으로|에게|한테|을|를|에|로)$/;

/** 단어 끝의 조사를 떼어낸다. 예) '커피에' → '커피', '마트에서' → '마트' */
export function stripParticle(token: string): string {
  if (token.length < 3) return token;
  const stripped = token.replace(PARTICLE_RE, '');
  return stripped.length >= 1 ? stripped : token;
}

/** 텍스트를 소문자 토큰으로 분리 (조사 제거 포함) */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[\s,.;:!?~()[\]{}"'`·|]+/)
    .filter(Boolean)
    .map(stripParticle);
}

/** 오탐이 잦아 "단어 전체 일치"로만 인정하는 한글 키워드 */
const EXACT_ONLY_KEYWORDS = new Set([
  '와우',
  '지니',
  '리디',
  '보드',
  '팜',
  '대리',
  '펌',
  '바',
  '죽',
  '회',
  '약',
  '시험',
  '2차',
  '충전',
  '티켓',
  '케이스',
  '시장',
  '당근',
  '헤어',
  '판매',
  '중고',
  '포인트',
  '정산',
  '이자',
  '술',
  '밥',
  '빵',
  '옷',
  '쌀',
  '꽃',
  '책',
  '펫',
  '전시',
  '이사',
  '미용',
  '게임',
  '보험',
]);

/** 짧은 브랜드 별칭 중 접두어 일치(예: '스벅에서')를 허용하면 위험한 것 */
const AMBIGUOUS_BRAND_PREFIX = new Set([
  '알리',
  '세븐',
  '메가',
  '베라',
  '배라',
  '파바',
  '맥도',
  '교보',
  '홈플',
  '카택',
  '넷플',
  '올영',
]);

interface Hit {
  buckets: string[];
  weight: number;
  length: number;
  position: number;
  brand?: string;
}

const LATIN_RE = /^[a-z0-9+\-&.]+$/i;

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** 영문 별칭: 앞뒤가 영문자가 아닐 때만 일치 (예: 'cu'가 'cute'에 걸리지 않게) */
function findLatin(lowerText: string, alias: string): number {
  const re = new RegExp(`(^|[^a-z])${escapeRegExp(alias.toLowerCase())}(?![a-z])`);
  const m = re.exec(lowerText);
  return m ? m.index + m[1].length : -1;
}

/** 토큰 전체 일치 위치 */
function findExactToken(lowerText: string, tokens: string[], word: string): number {
  const w = word.toLowerCase();
  if (!tokens.includes(w)) return -1;
  const idx = lowerText.indexOf(w);
  return idx >= 0 ? idx : 0;
}

/** 키워드 한 개 탐지 → 위치 (-1: 없음) */
function findKeyword(lowerText: string, tokens: string[], keyword: string): number {
  const kw = keyword.toLowerCase();
  if (LATIN_RE.test(kw)) return findLatin(lowerText, kw);
  if (kw.length === 1 || EXACT_ONLY_KEYWORDS.has(kw)) return findExactToken(lowerText, tokens, kw);
  return lowerText.indexOf(kw);
}

/** 브랜드 별칭 탐지 → 위치 (-1: 없음) */
function findBrandAlias(lowerText: string, tokens: string[], alias: string): number {
  const a = alias.toLowerCase();
  if (LATIN_RE.test(a)) return findLatin(lowerText, a);
  if (isShortAlias(a)) {
    const ok = tokens.some(
      (t) =>
        t === a || (!AMBIGUOUS_BRAND_PREFIX.has(a) && t.startsWith(a) && t.length <= a.length + 2)
    );
    return ok ? Math.max(0, lowerText.indexOf(a)) : -1;
  }
  return lowerText.indexOf(a);
}

/** 입력에서 가장 확실한 브랜드 (가장 긴 별칭 우선) */
export function detectBrand(text: string): { name: string; buckets: string[] } | null {
  const lower = text.toLowerCase();
  const tokens = tokenize(text);
  let best: { name: string; buckets: string[]; len: number; pos: number } | null = null;
  for (const brand of BRANDS) {
    for (const alias of brand.aliases) {
      const pos = findBrandAlias(lower, tokens, alias);
      if (pos < 0) continue;
      if (!best || alias.length > best.len || (alias.length === best.len && pos < best.pos)) {
        best = { name: brand.name, buckets: brand.buckets, len: alias.length, pos };
      }
    }
  }
  return best ? { name: best.name, buckets: best.buckets } : null;
}

/** 키워드/브랜드 탐지 결과를 우선순위 순으로 정렬해 반환 */
function collectHits(text: string): Hit[] {
  const lower = text.toLowerCase();
  const tokens = tokenize(text);
  const hits: Hit[] = [];
  for (const rule of KEYWORD_RULES) {
    for (const kw of rule.keywords) {
      const pos = findKeyword(lower, tokens, kw);
      if (pos >= 0) {
        hits.push({ buckets: rule.buckets, weight: rule.weight, length: kw.length, position: pos });
      }
    }
  }
  const brand = detectBrand(text);
  if (brand) {
    hits.push({ buckets: brand.buckets, weight: 3, length: 99, position: 0, brand: brand.name });
  }
  // 가중치 → 길이(구체적일수록) → 먼저 나온 순
  return hits.sort((a, b) => b.weight - a.weight || b.length - a.length || a.position - b.position);
}

/** 이름 정규화: 소문자, 이모지/기호 제거 */
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^0-9a-z가-힣ㄱ-ㆎ/·,&|+\s]/g, '')
    .trim();
}

/** 카테고리 이름을 구성 단어로 분리. 예) '카페/간식' → ['카페/간식' 정규화본, '카페', '간식'] */
export function nameParts(name: string): string[] {
  const norm = normalizeName(name);
  const whole = norm.replace(/[\s/·,&|+]/g, '');
  const parts = norm
    .split(/[\s/·,&|+]+|및/)
    .map((p) => p.trim())
    .filter(Boolean);
  return Array.from(new Set([whole, ...parts])).filter(Boolean);
}

/** 바이그램 Dice 유사도 (0..1) */
export function bigramSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;
  const grams = (s: string) => {
    const out: string[] = [];
    for (let i = 0; i < s.length - 1; i++) out.push(s.slice(i, i + 2));
    return out;
  };
  const ga = grams(a);
  const gb = grams(b);
  let inter = 0;
  const pool = [...gb];
  for (const g of ga) {
    const idx = pool.indexOf(g);
    if (idx >= 0) {
      inter++;
      pool.splice(idx, 1);
    }
  }
  return (2 * inter) / (ga.length + gb.length);
}

/** 카테고리 이름과 동의어의 일치 점수 (0..1) */
export function nameScore(categoryName: string, synonym: string): number {
  const syn = synonym.toLowerCase();
  let best = 0;
  for (const part of nameParts(categoryName)) {
    if (part === syn) return 1;
    if (Math.min(part.length, syn.length) >= 2 && (part.includes(syn) || syn.includes(part))) {
      best = Math.max(best, 0.85);
    } else {
      const sim = bigramSimilarity(part, syn);
      if (sim >= 0.5) best = Math.max(best, sim * 0.8);
    }
  }
  return best;
}

export interface CategoryMatch {
  category: CategoryOption;
  /** direct: 입력 단어가 카테고리 이름과 직접 일치, bucket: 사전 경유 */
  via: 'direct' | 'bucket';
}

/** 입력 단어가 사용자 카테고리 이름과 직접 일치하는지 */
function directMatch(tokens: string[], candidates: CategoryOption[]): CategoryOption | null {
  for (const cat of candidates) {
    for (const part of nameParts(cat.name)) {
      if (tokens.some((t) => t === part || (part.length >= 2 && t.includes(part)))) return cat;
    }
  }
  return null;
}

/** 버킷에 가장 잘 맞는 사용자 카테고리 (없으면 null) */
export function bestCategoryForBucket(
  bucketKey: string,
  candidates: CategoryOption[]
): CategoryOption | null {
  const bucket = BUCKETS[bucketKey];
  if (!bucket) return null;
  let bestCat: CategoryOption | null = null;
  let bestScore = 0;
  for (let synIdx = 0; synIdx < bucket.synonyms.length; synIdx++) {
    for (const cat of candidates) {
      // 앞선 동의어일수록 대표성이 높으므로 약간 가산
      const score = nameScore(cat.name, bucket.synonyms[synIdx]) - synIdx * 0.001;
      if (score >= 0.6 && score > bestScore) {
        bestCat = cat;
        bestScore = score;
      }
    }
  }
  return bestCat;
}

/**
 * 입력 텍스트에 맞는 사용자 카테고리를 찾는다.
 * 1) 입력 단어 == 카테고리 이름(구성 단어) 직접 일치
 * 2) 키워드/브랜드 → 버킷 → 동의어 → 사용자 카테고리 이름 유사도
 */
export function matchCategory(
  text: string,
  type: EntryType,
  categories: CategoryOption[]
): CategoryMatch | null {
  const candidates = categories.filter((c) => c.type === type);
  if (candidates.length === 0 || !text.trim()) return null;

  const direct = directMatch(tokenize(text), candidates);
  if (direct) return { category: direct, via: 'direct' };

  for (const hit of collectHits(text)) {
    for (const bucketKey of hit.buckets) {
      if (BUCKETS[bucketKey]?.type !== type) continue;
      const cat = bestCategoryForBucket(bucketKey, candidates);
      if (cat) return { category: cat, via: 'bucket' };
    }
  }
  return null;
}
