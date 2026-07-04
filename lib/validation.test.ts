import { validateAmount, validateInstallment, MAX_TRANSACTION_AMOUNT } from './validation';

describe('validateAmount', () => {
  it('정상 금액은 null 반환', () => {
    expect(validateAmount(1)).toBeNull();
    expect(validateAmount(10000)).toBeNull();
    expect(validateAmount(MAX_TRANSACTION_AMOUNT)).toBeNull();
  });

  it('0원 이하는 에러', () => {
    expect(validateAmount(0)).not.toBeNull();
    expect(validateAmount(-100)).not.toBeNull();
  });

  it('상한 초과는 에러', () => {
    expect(validateAmount(MAX_TRANSACTION_AMOUNT + 1)).not.toBeNull();
  });

  it('NaN·소수는 에러', () => {
    expect(validateAmount(NaN)).not.toBeNull();
    expect(validateAmount(1000.5)).not.toBeNull();
  });
});

describe('validateInstallment', () => {
  it('원금 >= 개월수면 null', () => {
    expect(validateInstallment(120000, 12)).toBeNull();
    expect(validateInstallment(3, 3)).toBeNull();
  });

  it('원금 < 개월수면 0원 회차 방어 에러', () => {
    expect(validateInstallment(2, 3)).not.toBeNull();
  });

  it('개월수 1 미만은 에러', () => {
    expect(validateInstallment(10000, 0)).not.toBeNull();
  });
});
