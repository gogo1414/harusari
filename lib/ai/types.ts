/**
 * AI 빠른 입력 공용 타입.
 * 자유 텍스트("삼각김밥 1400원")를 거래 초안으로 변환한 결과를 표현한다.
 */

/** 분석에 사용하는 사용자 카테고리 (DB categories 테이블의 부분 집합) */
export interface CategoryOption {
  id: string;
  name: string;
  type: 'income' | 'expense';
}

/** 분석된 거래 초안 1건 (저장 전 사용자 확인용) */
export interface ParsedEntry {
  amount: number | null; // KRW 정수 (1..1_000_000_000). 외화면 null
  type: 'income' | 'expense';
  categoryId: string | null; // 반드시 CategoryOption 목록 안의 id, type 일치
  categoryName: string | null;
  date: string; // yyyy-MM-dd (기준일 today 기준 상대 날짜 해석)
  memo: string; // 짧은 내용 (예: '삼각김밥'), 최대 50자
  placeHint: string | null; // 상호/지점이 언급되면 (예: '스타벅스', 'GS칼텍스'), 없으면 null
  currency: string; // ISO 4217, 기본 'KRW'
  originalAmount: number | null; // 외화 금액 (KRW면 null)
  confidence: number; // 0..1
}

/** 분석 결과 */
export interface ParseResult {
  engine: 'gemini' | 'rules';
  entries: ParsedEntry[];
  warnings: string[];
}
