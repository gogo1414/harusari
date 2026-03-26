import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import RecurringItem from '@/app/recurring/components/RecurringItem';
import type { FixedTransaction, Category } from '@/types/database';

// CategoryIcon은 단순 아이콘 렌더링 - 별도 테스트 있으므로 모킹
jest.mock('@/components/category/IconPicker', () => ({
  CategoryIcon: () => <span data-testid="category-icon" />,
}));

type FixedTransactionWithCategory = FixedTransaction & { categories: Category | null };

function makeItem(overrides: Partial<FixedTransactionWithCategory> = {}): FixedTransactionWithCategory {
  return {
    fixed_transaction_id: 'ft-1',
    user_id: 'u1',
    amount: 50000,
    type: 'expense',
    day: 25,
    memo: '월 구독',
    end_type: 'never',
    end_date: null,
    is_active: true,
    is_installment: false,
    installment_months: null,
    installment_rate: null,
    installment_free_months: null,
    current_installment_month: null,
    category_id: 'cat-1',
    created_at: new Date().toISOString(),
    categories: {
      category_id: 'cat-1',
      user_id: 'u1',
      name: '구독',
      type: 'expense',
      icon: 'card',
      is_default: false,
      created_at: new Date().toISOString(),
      sort_order: 1,
    },
    ...overrides,
  };
}

describe('RecurringItem', () => {
  const onEdit = jest.fn();
  const onDelete = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('메모와 카테고리 이름을 렌더링한다', () => {
    render(<RecurringItem item={makeItem()} onEdit={onEdit} onDelete={onDelete} />);
    expect(screen.getByText('월 구독')).toBeInTheDocument();
    expect(screen.getByText('구독')).toBeInTheDocument();
  });

  it('메모가 없으면 카테고리 이름을 제목으로 사용한다', () => {
    render(<RecurringItem item={makeItem({ memo: null })} onEdit={onEdit} onDelete={onDelete} />);
    // 카테고리 이름 '구독'이 제목 위치에 표시됨
    expect(screen.getAllByText('구독').length).toBeGreaterThanOrEqual(1);
  });

  it('매월 n일을 표시한다', () => {
    render(<RecurringItem item={makeItem()} onEdit={onEdit} onDelete={onDelete} />);
    expect(screen.getByText('매월 25일')).toBeInTheDocument();
  });

  it('end_type=never이면 "계속 반복"을 표시한다', () => {
    render(<RecurringItem item={makeItem({ end_type: 'never' })} onEdit={onEdit} onDelete={onDelete} />);
    expect(screen.getByText('계속 반복')).toBeInTheDocument();
  });

  it('end_type이 never가 아니고 end_date가 있으면 종료일을 표시한다', () => {
    render(
      <RecurringItem
        item={makeItem({ end_type: 'date', end_date: '2026-12-31' })}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    );
    expect(screen.getByText('2026.12.31 종료')).toBeInTheDocument();
  });

  it('end_date가 null이고 end_type이 never가 아니면 "종료일 미지정"을 표시한다', () => {
    render(
      <RecurringItem
        item={makeItem({ end_type: 'date', end_date: null })}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    );
    expect(screen.getByText('종료일 미지정')).toBeInTheDocument();
  });

  it('지출 금액 앞에 - 기호와 금액을 표시한다', () => {
    render(<RecurringItem item={makeItem({ type: 'expense', amount: 50000 })} onEdit={onEdit} onDelete={onDelete} />);
    // 금액 span 전체 텍스트: "-50,000원"
    expect(screen.getByText(/-50,000원/)).toBeInTheDocument();
  });

  it('수입 금액 앞에 + 기호와 금액을 표시한다', () => {
    render(
      <RecurringItem item={makeItem({ type: 'income', amount: 200000 })} onEdit={onEdit} onDelete={onDelete} />
    );
    expect(screen.getByText(/\+200,000원/)).toBeInTheDocument();
  });

  it('수정 버튼 클릭 시 onEdit이 호출된다', () => {
    render(<RecurringItem item={makeItem()} onEdit={onEdit} onDelete={onDelete} />);
    fireEvent.click(screen.getByLabelText('고정 내역 수정'));
    expect(onEdit).toHaveBeenCalledWith('ft-1', false);
  });

  it('할부 항목 수정 시 is_installment=true로 호출된다', () => {
    render(
      <RecurringItem item={makeItem({ is_installment: true })} onEdit={onEdit} onDelete={onDelete} />
    );
    fireEvent.click(screen.getByLabelText('고정 내역 수정'));
    expect(onEdit).toHaveBeenCalledWith('ft-1', true);
  });

  it('삭제 버튼 클릭 시 onDelete가 호출된다', () => {
    render(<RecurringItem item={makeItem()} onEdit={onEdit} onDelete={onDelete} />);
    fireEvent.click(screen.getByLabelText('고정 내역 삭제'));
    expect(onDelete).toHaveBeenCalledWith('ft-1');
  });
});
