export interface InstallmentInput {
  principal: number;         // 할부 원금
  months: number;            // 할부 기간 (개월)
  annualRate: number;        // 연 이자율 (%)
  interestFreeMonths: number; // 무이자 개월 수
}

export interface MonthlyPayment {
  round: number;             // 회차
  principal: number;         // 월 원금
  interest: number;          // 월 이자
  total: number;             // 월 납입금 (원금 + 이자)
  remainingPrincipal: number;// 남은 원금
}

export interface InstallmentResult {
  monthlyPayment: number;    // 첫 달 납입금 (또는 평균)
  totalInterest: number;     // 총 이자
  totalPayment: number;      // 총 납부액
  schedule: MonthlyPayment[]; // 월별 스케줄
}

/**
 * 할부 계산 함수 (원금 균등 상환 방식)
 * @param input 할부 입력 정보
 * @returns 할부 계산 결과
 */
export function calculateInstallment(input: InstallmentInput): InstallmentResult {
  const { principal, months, annualRate, interestFreeMonths } = input;
  
  // 유효성 검사
  if (principal <= 0 || months <= 0) {
    return {
      monthlyPayment: 0,
      totalInterest: 0,
      totalPayment: 0,
      schedule: []
    };
  }

  const monthlyPrincipal = Math.floor(principal / months); // 월 상환 원금 (내림)
  const remainder = principal - (monthlyPrincipal * months); // 원금 자투리 (마지막 달에 합산)
  
  const schedule: MonthlyPayment[] = [];
  let currentPrincipal = principal;
  let totalInterest = 0;

  for (let i = 1; i <= months; i++) {
    // 이번 달 납부할 원금
    let paymentPrincipal = monthlyPrincipal;
    if (i === months) {
      paymentPrincipal += remainder; // 마지막 달에 자투리 더함
    }

    // 이번 달 이자 계산
    let interest = 0;
    // 무이자 기간이 아니면 이자 부과
    if (i > interestFreeMonths) {
      // 이자 = 잔액 * (연이율 / 12)
      // 10원 단위 절사 등은 카드사마다 다르지만 여기선 반올림 후 정수로 처리
      interest = Math.round(currentPrincipal * (annualRate / 100 / 12));
    }

    const total = paymentPrincipal + interest;
    currentPrincipal -= paymentPrincipal; // 잔액 차감

    schedule.push({
      round: i,
      principal: paymentPrincipal,
      interest,
      total,
      remainingPrincipal: currentPrincipal
    });

    totalInterest += interest;
  }

  return {
    monthlyPayment: schedule[0].total, // 첫 달 납입금을 대표 금액으로 표시 (원금균등이므로 갈수록 줄어듦)
    totalInterest,
    totalPayment: principal + totalInterest,
    schedule
  };
}
