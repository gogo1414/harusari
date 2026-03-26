import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import BudgetGoalItem from '@/components/budget/BudgetGoalItem';
import type { BudgetGoalWithCategory } from '@/hooks/useBudgetGoals';

jest.mock('@/components/category/IconPicker', () => ({
  CategoryIcon: () => <span data-testid="category-icon" />,
}));

function makeGoal(overrides: Partial<BudgetGoalWithCategory> = {}): BudgetGoalWithCategory {
  return {
    id: 'goal-1',
    user_id: 'u1',
    category_id: 'cat-1',
    amount: 200000,
    updated_at: new Date().toISOString(),
    category: { name: '식비', icon: 'food', type: 'expense' },
    ...overrides,
  };
}

describe('BudgetGoalItem', () => {
  const onEdit = jest.fn();
  const onDelete = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('카테고리 이름과 금액을 표시한다', () => {
    render(<BudgetGoalItem goal={makeGoal()} onEdit={onEdit} onDelete={onDelete} />);
    expect(screen.getByText('식비')).toBeInTheDocument();
    expect(screen.getByText('200,000원')).toBeInTheDocument();
  });

  it('카테고리가 없으면 "삭제된 카테고리"를 표시한다', () => {
    render(
      <BudgetGoalItem
        goal={makeGoal({ category: null })}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    );
    expect(screen.getByText('삭제된 카테고리')).toBeInTheDocument();
  });

  it('수정 버튼 클릭 시 onEdit이 category_id와 amount로 호출된다', () => {
    render(<BudgetGoalItem goal={makeGoal()} onEdit={onEdit} onDelete={onDelete} />);
    const editButton = screen.getAllByRole('button')[0];
    fireEvent.click(editButton);
    expect(onEdit).toHaveBeenCalledWith('cat-1', 200000);
  });

  it('category_id가 null이면 수정 버튼 클릭 시 onEdit이 호출되지 않는다', () => {
    render(
      <BudgetGoalItem
        goal={makeGoal({ category_id: null })}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    );
    const editButton = screen.getAllByRole('button')[0];
    fireEvent.click(editButton);
    expect(onEdit).not.toHaveBeenCalled();
  });

  it('삭제 버튼 클릭 시 onDelete가 id로 호출된다', () => {
    render(<BudgetGoalItem goal={makeGoal()} onEdit={onEdit} onDelete={onDelete} />);
    const deleteButton = screen.getAllByRole('button')[1];
    fireEvent.click(deleteButton);
    expect(onDelete).toHaveBeenCalledWith('goal-1');
  });
});
