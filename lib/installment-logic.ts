import { calculateInstallment } from '@/lib/installment';

export interface InstallmentBackfillEntry {
  date: string;
  amount: number;
  memo: string;
  round: number;
}

interface BuildInstallmentBackfillParams {
  startDate: Date;
  now: Date;
  months: number;
  schedule: Array<{ total: number }>;
  memo?: string;
}

function buildInstallmentMemo(memo: string | undefined, round: number, months: number) {
  const baseMemo = (memo || '').replace(/\s*\(할부\s*\d+\/\d+\)\s*$/, '').trim();
  return `${baseMemo} (할부 ${round}/${months})`.trim();
}

export function buildInstallmentBackfillEntries(params: BuildInstallmentBackfillParams): InstallmentBackfillEntry[] {
  const { startDate, now, months, schedule, memo } = params;
  const day = startDate.getDate();
  const entries: InstallmentBackfillEntry[] = [];

  let pointer = new Date(startDate.getFullYear(), startDate.getMonth(), 1);

  while (
    pointer.getFullYear() < now.getFullYear() ||
    (pointer.getFullYear() === now.getFullYear() && pointer.getMonth() <= now.getMonth())
  ) {
    const round = entries.length + 1;
    if (round > months || !schedule[round - 1]) break;

    const year = pointer.getFullYear();
    const month = pointer.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const targetDay = Math.min(day, daysInMonth);
    const date = `${year}-${String(month + 1).padStart(2, '0')}-${String(targetDay).padStart(2, '0')}`;

    entries.push({
      date,
      amount: schedule[round - 1].total,
      memo: buildInstallmentMemo(memo, round, months),
      round,
    });

    pointer = new Date(year, month + 1, 1);
  }

  return entries;
}

interface GetInstallmentCurrentAmountParams {
  principal: number;
  months: number;
  annualRate: number;
  interestFreeMonths: number;
  currentMonth: number;
}

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

interface BuildCronInstallmentPayloadParams {
  principal: number;
  months: number;
  annualRate: number;
  interestFreeMonths: number;
  currentMonth: number;
  memo?: string;
}

export function buildCronInstallmentPayload(params: BuildCronInstallmentPayloadParams) {
  const { principal, months, annualRate, interestFreeMonths, currentMonth, memo } = params;

  if (currentMonth >= months) {
    return { shouldCreate: false, shouldDeactivate: true as const };
  }

  const result = calculateInstallment({
    principal,
    months,
    annualRate,
    interestFreeMonths,
  });

  const nextRound = currentMonth + 1;
  const scheduleItem = result.schedule[currentMonth];

  if (!scheduleItem) {
    return { shouldCreate: false, shouldDeactivate: true as const };
  }

  return {
    shouldCreate: true as const,
    shouldDeactivate: nextRound >= months,
    amount: scheduleItem.total,
    memo: buildInstallmentMemo(memo, nextRound, months),
    nextCurrentMonth: nextRound,
  };
}
