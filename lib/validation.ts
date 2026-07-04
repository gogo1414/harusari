// 금액/할부 입력 검증 유틸
// transactions.amount는 Postgres INTEGER(최대 약 21.4억)이며 CHECK(amount > 0) 제약이 있다.
// 클라이언트에서 상한/하한을 막지 않으면 overflow나 0원 거래가 원인 불명 에러로 이어진다.

// 금액 상한: 10억원. INTEGER 상한(2,147,483,647)에 충분한 여유를 두고 실사용 범위를 넘는 값을 차단.
export const MAX_TRANSACTION_AMOUNT = 1_000_000_000;

/**
 * 거래 금액 검증. 유효하면 null, 아니면 사용자에게 보여줄 에러 메시지를 반환.
 */
export function validateAmount(amount: number): string | null {
  if (!Number.isFinite(amount) || !Number.isInteger(amount)) {
    return '금액을 올바르게 입력해 주세요';
  }
  if (amount <= 0) {
    return '금액을 1원 이상 입력해 주세요';
  }
  if (amount > MAX_TRANSACTION_AMOUNT) {
    return `금액은 ${MAX_TRANSACTION_AMOUNT.toLocaleString()}원 이하로 입력해 주세요`;
  }
  return null;
}

/**
 * 할부 검증. 원금이 개월 수보다 작으면 회차 금액이 0원이 되어
 * cron insert가 CHECK 위반으로 매일 실패하는 영구 루프에 빠진다.
 */
export function validateInstallment(principal: number, months: number): string | null {
  if (!Number.isInteger(months) || months < 1) {
    return '할부 개월 수는 1개월 이상이어야 합니다';
  }
  if (principal < months) {
    return '할부 원금이 개월 수보다 작아 회차 금액이 0원이 됩니다. 금액이나 개월 수를 조정해 주세요';
  }
  return null;
}
