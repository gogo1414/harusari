import { calculateInstallment } from './installment';

describe('calculateInstallment', () => {
  test('기본 할부 계산 (유이자)', () => {
    // 원금 1,200,000원, 12개월, 연 10%, 무이자 없음
    const result = calculateInstallment({
      principal: 1200000,
      months: 12,
      annualRate: 10,
      interestFreeMonths: 0
    });

    // 월 원금은 100,000원 고정
    expect(result.schedule[0].principal).toBe(100000);
    
    // 첫 달 이자: 1,200,000 * (10% / 12) = 10,000원
    expect(result.schedule[0].interest).toBe(10000);
    expect(result.schedule[0].total).toBe(110000);

    // 마지막 달 확인
    expect(result.schedule[11].principal).toBe(100000);
    // 마지막 달 잔액은 100,000원이므로 이자는 100,000 * (10% / 12) = 833.33... -> 833원
    expect(result.schedule[11].interest).toBe(833);
    
    expect(result.totalPayment).toBeGreaterThan(1200000);
  });

  test('완전 무이자 할부', () => {
    const result = calculateInstallment({
      principal: 100000,
      months: 10,
      annualRate: 20, // 이자율이 있어도 무이자 기간이면 0원이어야 함
      interestFreeMonths: 10
    });

    expect(result.totalInterest).toBe(0);
    expect(result.monthlyPayment).toBe(10000);
    expect(result.totalPayment).toBe(100000);
  });

  test('부분 무이자 할부 (6개월 중 3개월 무이자)', () => {
    // 원금 600,000원, 6개월, 연 12% (월 1%)
    const result = calculateInstallment({
      principal: 600000,
      months: 6,
      annualRate: 12,
      interestFreeMonths: 3
    });

    // 1~3회차는 이자 0원
    expect(result.schedule[0].interest).toBe(0);
    expect(result.schedule[1].interest).toBe(0);
    expect(result.schedule[2].interest).toBe(0);

    // 4회차부터 이자 발생
    // 4회차 시작 전 잔액: 300,000원 (이미 3번 냈으므로)
    // 이자: 300,000 * 1% = 3,000원
    expect(result.schedule[3].interest).toBe(3000);
  });

  test('원금 자투리 처리', () => {
    // 100,000원을 3개월로 나눔 -> 33,333원씩
    const result = calculateInstallment({
      principal: 100000,
      months: 3,
      annualRate: 0,
      interestFreeMonths: 3
    });

    expect(result.schedule[0].principal).toBe(33333);
    expect(result.schedule[1].principal).toBe(33333);
    // 마지막 달은 33,334원 (+1원)
    expect(result.schedule[2].principal).toBe(33334);
    
    expect(result.totalPayment).toBe(100000);
  });
});
