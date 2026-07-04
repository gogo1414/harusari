import { generateBackfillDates } from './backfill';

describe('generateBackfillDates', () => {
  it('시작월부터 현재월까지 매월 생성', () => {
    const result = generateBackfillDates({
      startDate: new Date(2025, 8, 24), // 2025-09-24
      now: new Date(2026, 0, 25), // 2026-01-25
      day: 24,
    });
    expect(result).toEqual([
      '2025-09-24',
      '2025-10-24',
      '2025-11-24',
      '2025-12-24',
      '2026-01-24',
    ]);
  });

  it('결제일 31일은 해당 월 말일로 클램프', () => {
    const result = generateBackfillDates({
      startDate: new Date(2026, 0, 31), // 2026-01-31
      now: new Date(2026, 2, 31), // 2026-03-31
      day: 31,
    });
    expect(result).toEqual(['2026-01-31', '2026-02-28', '2026-03-31']);
  });

  it('종료일 당일 회차는 포함하고 그 다음은 중단', () => {
    const result = generateBackfillDates({
      startDate: new Date(2026, 0, 15),
      now: new Date(2026, 5, 15),
      day: 15,
      endDateStr: '2026-03-15',
    });
    expect(result).toEqual(['2026-01-15', '2026-02-15', '2026-03-15']);
  });

  it('종료일이 첫 회차보다 이전이면 빈 배열', () => {
    const result = generateBackfillDates({
      startDate: new Date(2026, 5, 15),
      now: new Date(2026, 5, 15),
      day: 15,
      endDateStr: '2026-05-01',
    });
    expect(result).toEqual([]);
  });

  it('시작월이 현재월보다 미래면 빈 배열', () => {
    const result = generateBackfillDates({
      startDate: new Date(2026, 8, 1), // 9월
      now: new Date(2026, 6, 1), // 7월
      day: 1,
    });
    expect(result).toEqual([]);
  });

  it('시작일이 이번 달 미래(같은 달)면 이번 달 회차는 생성', () => {
    const result = generateBackfillDates({
      startDate: new Date(2026, 6, 25), // 7/25
      now: new Date(2026, 6, 3), // 7/3
      day: 25,
    });
    expect(result).toEqual(['2026-07-25']);
  });
});
