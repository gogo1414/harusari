import { getInstallmentAmountByCurrentMonth } from './installment-logic';
import { calculateInstallment } from './installment';

describe('installment logic', () => {
  test('수정 시 현재 회차 기준 납입금을 사용한다', () => {
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

  test('회차 0(생성 전)이면 1회차 금액', () => {
    const amount = getInstallmentAmountByCurrentMonth({
      principal: 300000,
      months: 3,
      annualRate: 0,
      interestFreeMonths: 0,
      currentMonth: 0,
    });
    expect(amount).toBe(100000);
  });
});
