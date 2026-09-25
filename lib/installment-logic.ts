import { calculateInstallment } from '@/lib/installment';

interface GetInstallmentCurrentAmountParams {
  principal: number;
  months: number;
  annualRate: number;
  interestFreeMonths: number;
  currentMonth: number;
}

/**
 * 현재 회차(1-based)의 납입금. 회차가 0이면(아직 생성 전) 1회차 금액.
 * 회차별 거래 생성 자체는 lib/recurring/engine.ts가 담당한다.
 */
export function getInstallmentAmountByCurrentMonth(params: GetInstallmentCurrentAmountParams): number {
  const result = calculateInstallment({
    principal: params.principal,
    months: params.months,
    annualRate: params.annualRate,
    interestFreeMonths: params.interestFreeMonths,
  });

  const index = Math.max(0, params.currentMonth - 1);
  return result.schedule[index]?.total ?? 0;
}
