import {
  buildInstallmentBackfillEntries,
  buildCronInstallmentPayload,
  getInstallmentAmountByCurrentMonth,
} from './installment-logic';
import { calculateInstallment } from './installment';

describe('installment logic', () => {
  test('A: 등록 시 과거분 백필이 회차별로 생성된다 (2개월 전 시작 -> 3건)', () => {
    const schedule = calculateInstallment({
      principal: 300000,
      months: 6,
      annualRate: 12,
      interestFreeMonths: 0,
    }).schedule;

    const entries = buildInstallmentBackfillEntries({
      startDate: new Date('2026-01-10'),
      now: new Date('2026-03-15'),
      months: 6,
      schedule,
      memo: '노트북',
    });

    expect(entries).toHaveLength(3);
    expect(entries[0]).toMatchObject({
      date: '2026-01-10',
      amount: schedule[0].total,
      memo: '노트북 (할부 1/6)',
      round: 1,
    });
    expect(entries[1]).toMatchObject({
      date: '2026-02-10',
      amount: schedule[1].total,
      memo: '노트북 (할부 2/6)',
      round: 2,
    });
    expect(entries[2]).toMatchObject({
      date: '2026-03-10',
      amount: schedule[2].total,
      memo: '노트북 (할부 3/6)',
      round: 3,
    });
  });

  test('B-1: 크론에서 다음 회차 금액/메모/회차 증가를 계산한다', () => {
    const payload = buildCronInstallmentPayload({
      principal: 600000,
      months: 6,
      annualRate: 12,
      interestFreeMonths: 0,
      currentMonth: 2,
      memo: '가전',
    });

    const schedule = calculateInstallment({
      principal: 600000,
      months: 6,
      annualRate: 12,
      interestFreeMonths: 0,
    }).schedule;

    expect(payload.shouldCreate).toBe(true);
    if (payload.shouldCreate) {
      expect(payload.amount).toBe(schedule[2].total);
      expect(payload.memo).toBe('가전 (할부 3/6)');
      expect(payload.nextCurrentMonth).toBe(3);
      expect(payload.shouldDeactivate).toBe(false);
    }
  });

  test('B-2: 마지막 회차에 도달하면 자동 종료 대상으로 처리한다', () => {
    const payload = buildCronInstallmentPayload({
      principal: 600000,
      months: 6,
      annualRate: 12,
      interestFreeMonths: 0,
      currentMonth: 6,
      memo: '가전',
    });

    expect(payload).toEqual({ shouldCreate: false, shouldDeactivate: true });
  });

  test('C: 수정 시 현재 회차 기준 납입금을 사용한다', () => {
    const amount = getInstallmentAmountByCurrentMonth({
      principal: 600000,
      months: 6,
      annualRate: 12,
      interestFreeMonths: 0,
      currentMonth: 4,
    });

    const schedule = calculateInstallment({
      principal: 600000,
      months: 6,
      annualRate: 12,
      interestFreeMonths: 0,
    }).schedule;

    expect(amount).toBe(schedule[3].total);
    expect(amount).not.toBe(schedule[0].total);
  });
});
