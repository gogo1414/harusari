import { toDrafts, validateDraft, resolveDraftLocation, toInsertRow, type QuickDraft } from './drafts';
import type { ParsedEntry } from '@/lib/ai/types';

const entry = (overrides: Partial<ParsedEntry> = {}): ParsedEntry => ({
  amount: 1400,
  type: 'expense',
  categoryId: 'c-food',
  categoryName: '식비',
  date: '2026-09-25',
  memo: '삼각김밥',
  placeHint: null,
  currency: 'KRW',
  originalAmount: null,
  confidence: 0.9,
  ...overrides,
});

const here = { placeName: 'GS25 역삼점', address: '서울 강남구', lat: 37.5, lng: 127.03, countryCode: 'KR' };

describe('quick-add drafts', () => {
  test('toDrafts는 고유 key를 부여한다', () => {
    const drafts = toDrafts([entry(), entry({ memo: '커피' })]);
    expect(new Set(drafts.map((d) => d.key)).size).toBe(2);
  });

  test('검증: 금액·카테고리 누락, 외화', () => {
    const [ok] = toDrafts([entry()]);
    expect(validateDraft(ok)).toBeNull();
    expect(validateDraft({ ...ok, amount: null })).toBe('금액을 입력해 주세요');
    expect(validateDraft({ ...ok, amount: null, currency: 'JPY' })).toBe('원화 금액을 입력해 주세요');
    expect(validateDraft({ ...ok, categoryId: null })).toBe('카테고리를 골라 주세요');
    expect(validateDraft({ ...ok, amount: 0 })).not.toBeNull();
  });

  test('공통 위치는 오늘 내역에만 적용, 개별 위치/위치 없음이 우선', () => {
    const [d] = toDrafts([entry()]);
    expect(resolveDraftLocation(d, here, '2026-09-25')).toEqual(here);
    expect(resolveDraftLocation({ ...d, date: '2026-09-24' }, here, '2026-09-25')).toBeNull();
    expect(resolveDraftLocation({ ...d, location: null }, here, '2026-09-25')).toBeNull();
    expect(resolveDraftLocation({ ...d, type: 'income' }, here, '2026-09-25')).toBeNull();
    const own = { ...here, placeName: '스타벅스' };
    expect(resolveDraftLocation({ ...d, date: '2026-09-24', location: own }, here, '2026-09-25')).toEqual(own);
  });

  test('저장 행: input_source=ai, 위치 컬럼, 외화 메모', () => {
    const [d] = toDrafts([entry({ currency: 'JPY', originalAmount: 1200, memo: '라멘' })]);
    const row = toInsertRow({ ...(d as QuickDraft), amount: 11000 }, 'u1', here, '2026-09-25');
    expect(row).toMatchObject({
      user_id: 'u1',
      amount: 11000,
      memo: '라멘 (1,200 JPY)',
      input_source: 'ai',
      place_name: 'GS25 역삼점',
      latitude: 37.5,
      longitude: 127.03,
      country_code: 'KR',
    });
  });
});
