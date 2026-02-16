import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import TransactionForm, { type TransactionFormData } from '@/components/forms/TransactionForm';

const mockBack = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    back: mockBack,
  }),
}));

jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({
    invalidateQueries: jest.fn(),
  }),
  useMutation: () => ({
    mutate: jest.fn(),
    isPending: false,
  }),
}));

jest.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: { getUser: jest.fn() },
    from: jest.fn(),
  }),
}));

jest.mock('@/components/forms/transaction/TransactionDateInput', () => {
  return function MockTransactionDateInput({ date }: { date: Date }) {
    return <div data-testid="date-input">{date.toISOString().slice(0, 10)}</div>;
  };
});

jest.mock('@/components/forms/transaction/TransactionAmountInput', () => {
  return function MockTransactionAmountInput({
    type,
    amount,
    onChange,
    onTypeChange,
  }: {
    type: 'income' | 'expense';
    amount: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onTypeChange: (type: 'income' | 'expense') => void;
  }) {
    return (
      <div>
        <div data-testid="current-type">{type}</div>
        <button type="button" onClick={() => onTypeChange('expense')}>
          지출
        </button>
        <button type="button" onClick={() => onTypeChange('income')}>
          수입
        </button>
        <input aria-label="amount-input" value={amount} onChange={onChange} />
      </div>
    );
  };
});

jest.mock('@/components/forms/transaction/TransactionCategorySelect', () => {
  return function MockTransactionCategorySelect({
    selectedCategory,
    onClick,
  }: {
    selectedCategory?: { name: string };
    onClick: () => void;
  }) {
    return (
      <div>
        <div data-testid="selected-category">{selectedCategory?.name ?? 'none'}</div>
        <button type="button" onClick={onClick}>
          카테고리 선택 열기
        </button>
      </div>
    );
  };
});

jest.mock('@/components/forms/transaction/TransactionMemoInput', () => {
  return function MockTransactionMemoInput({
    value,
    onChange,
  }: {
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  }) {
    return <input aria-label="memo-input" value={value} onChange={onChange} />;
  };
});

jest.mock('@/components/forms/transaction/TransactionInstallmentOption', () => {
  return function MockTransactionInstallmentOption({
    paymentType,
    onPaymentTypeChange,
    installmentMonths,
    onInstallmentMonthsChange,
    annualRate,
    onAnnualRateChange,
    interestFreeMonths,
    onInterestFreeMonthsChange,
  }: {
    paymentType: 'lumpsum' | 'installment';
    onPaymentTypeChange: (type: 'lumpsum' | 'installment') => void;
    installmentMonths: number;
    onInstallmentMonthsChange: (months: number) => void;
    annualRate: number;
    onAnnualRateChange: (rate: number) => void;
    interestFreeMonths: number;
    onInterestFreeMonthsChange: (months: number) => void;
  }) {
    return (
      <div data-testid="installment-option">
        <div data-testid="payment-type">{paymentType}</div>
        <button type="button" onClick={() => onPaymentTypeChange('lumpsum')}>
          일시불
        </button>
        <button type="button" onClick={() => onPaymentTypeChange('installment')}>
          할부 결제
        </button>
        <input
          aria-label="installment-months"
          value={installmentMonths}
          onChange={(e) => onInstallmentMonthsChange(Number(e.target.value))}
        />
        <input
          aria-label="annual-rate"
          value={annualRate}
          onChange={(e) => onAnnualRateChange(Number(e.target.value))}
        />
        <input
          aria-label="interest-free-months"
          value={interestFreeMonths}
          onChange={(e) => onInterestFreeMonthsChange(Number(e.target.value))}
        />
      </div>
    );
  };
});

jest.mock('@/components/forms/transaction/TransactionRecurringOption', () => {
  return function MockTransactionRecurringOption() {
    return <div data-testid="recurring-option">반복 설정</div>;
  };
});

jest.mock('@/components/forms/transaction/TransactionSubmitButton', () => {
  return function MockTransactionSubmitButton({
    isValid,
    isLoading,
    onSubmit,
  }: {
    isValid: boolean;
    isLoading: boolean;
    onSubmit: () => void;
  }) {
    return (
      <button type="button" disabled={!isValid || isLoading} onClick={onSubmit}>
        저장
      </button>
    );
  };
});

jest.mock('@/components/forms/transaction/CategorySelectDialog', () => {
  return function MockCategorySelectDialog({
    open,
    categories,
    onSelect,
    onOpenChange,
  }: {
    open: boolean;
    categories: Array<{ category_id: string; name: string }>;
    onSelect: (id: string) => void;
    onOpenChange: (open: boolean) => void;
  }) {
    if (!open) return null;
    return (
      <div data-testid="category-dialog">
        {categories.map((c) => (
          <button
            key={c.category_id}
            type="button"
            onClick={() => {
              onSelect(c.category_id);
              onOpenChange(false);
            }}
          >
            {c.name}
          </button>
        ))}
      </div>
    );
  };
});

jest.mock('@/components/forms/transaction/AddCategoryDialog', () => {
  return function MockAddCategoryDialog() {
    return null;
  };
});

const categories = [
  {
    category_id: 'c-expense',
    user_id: 'u1',
    name: '식비',
    type: 'expense' as const,
    icon: 'utensils',
    is_default: false,
    created_at: '2026-01-01',
    sort_order: 1,
  },
  {
    category_id: 'c-income',
    user_id: 'u1',
    name: '월급',
    type: 'income' as const,
    icon: 'wallet',
    is_default: false,
    created_at: '2026-01-01',
    sort_order: 2,
  },
];

describe('TransactionForm', () => {
  it('금액과 카테고리 선택 전에는 저장할 수 없다', () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);

    render(<TransactionForm categories={categories} onSubmit={onSubmit} />);

    expect(screen.getByRole('button', { name: '저장' })).toBeDisabled();
  });

  it('일시불 기본값으로 제출 시 할부 필드는 undefined 로 전달된다', async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    render(<TransactionForm categories={categories} onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText('amount-input'), { target: { value: '12000' } });
    fireEvent.change(screen.getByLabelText('memo-input'), { target: { value: '점심' } });

    fireEvent.click(screen.getByRole('button', { name: '카테고리 선택 열기' }));
    fireEvent.click(screen.getByRole('button', { name: '식비' }));

    fireEvent.click(screen.getByRole('button', { name: '저장' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));

    const submitted: TransactionFormData = onSubmit.mock.calls[0][0];
    expect(submitted.type).toBe('expense');
    expect(submitted.amount).toBe(12000);
    expect(submitted.category_id).toBe('c-expense');
    expect(submitted.memo).toBe('점심');

    expect(submitted.is_installment).toBe(false);
    expect(submitted.installment_months).toBeUndefined();
    expect(submitted.installment_rate).toBeUndefined();
    expect(submitted.installment_free_months).toBeUndefined();
  });

  it('할부 선택 시 반복 설정 UI 가 숨겨지고 할부 데이터가 제출된다', async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    render(<TransactionForm categories={categories} onSubmit={onSubmit} />);

    expect(screen.getByTestId('recurring-option')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('amount-input'), { target: { value: '300000' } });
    fireEvent.click(screen.getByRole('button', { name: '카테고리 선택 열기' }));
    fireEvent.click(screen.getByRole('button', { name: '식비' }));

    fireEvent.click(screen.getByRole('button', { name: '할부 결제' }));
    fireEvent.change(screen.getByLabelText('installment-months'), { target: { value: '6' } });
    fireEvent.change(screen.getByLabelText('annual-rate'), { target: { value: '12.5' } });
    fireEvent.change(screen.getByLabelText('interest-free-months'), { target: { value: '2' } });

    expect(screen.queryByTestId('recurring-option')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '저장' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const submitted: TransactionFormData = onSubmit.mock.calls[0][0];

    expect(submitted.is_installment).toBe(true);
    expect(submitted.installment_months).toBe(6);
    expect(submitted.installment_rate).toBe(12.5);
    expect(submitted.installment_free_months).toBe(2);
  });

  it('수입으로 전환하면 할부 섹션이 사라지고 카테고리 선택이 초기화된다', async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    render(<TransactionForm categories={categories} onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText('amount-input'), { target: { value: '10000' } });
    fireEvent.click(screen.getByRole('button', { name: '카테고리 선택 열기' }));
    fireEvent.click(screen.getByRole('button', { name: '식비' }));
    expect(screen.getByTestId('selected-category')).toHaveTextContent('식비');

    fireEvent.click(screen.getByRole('button', { name: '수입' }));

    expect(screen.queryByTestId('installment-option')).not.toBeInTheDocument();
    expect(screen.getByTestId('selected-category')).toHaveTextContent('none');

    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    await waitFor(() => expect(onSubmit).not.toHaveBeenCalled());

    fireEvent.click(screen.getByRole('button', { name: '카테고리 선택 열기' }));
    fireEvent.click(screen.getByRole('button', { name: '월급' }));

    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));

    const submitted: TransactionFormData = onSubmit.mock.calls[0][0];
    expect(submitted.type).toBe('income');
    expect(submitted.category_id).toBe('c-income');
  });

  it('중복 클릭해도 제출은 1회만 수행된다', async () => {
    let resolveSubmit: (() => void) | null = null;
    const onSubmit = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveSubmit = resolve;
        })
    );

    render(<TransactionForm categories={categories} onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText('amount-input'), { target: { value: '5000' } });
    fireEvent.click(screen.getByRole('button', { name: '카테고리 선택 열기' }));
    fireEvent.click(screen.getByRole('button', { name: '식비' }));

    const submitButton = screen.getByRole('button', { name: '저장' });
    fireEvent.click(submitButton);
    fireEvent.click(submitButton);

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));

    resolveSubmit?.();
  });
});
