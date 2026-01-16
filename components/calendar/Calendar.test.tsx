import { render, screen, fireEvent } from '@testing-library/react';
import Calendar from './Calendar';
import { format } from 'date-fns';

// No mocks needed for date-fns as it is a pure utility library and we pass explicit dates


describe('Calendar Component', () => {
  const mockTransactions = [
    {
      transaction_id: '1',
      user_id: 'user1',
      amount: 10000,
      type: 'expense' as const,
      category_id: 'cat1',
      date: format(new Date(), 'yyyy-MM-dd'),
      created_at: new Date().toISOString(),
      memo: 'lunch',
      source_fixed_id: null,
    },
    {
      transaction_id: '2',
      user_id: 'user1',
      amount: 50000,
      type: 'income' as const,
      category_id: 'cat2',
      date: format(new Date(), 'yyyy-MM-dd'),
      created_at: new Date().toISOString(),
      memo: 'bonus',
      source_fixed_id: null,
    },
  ];

  const mockOnDateSelect = jest.fn();
  const mockOnMonthChange = jest.fn();

  it('renders current month and year', () => {
    render(
      <Calendar
        transactions={[]}
        onDateSelect={mockOnDateSelect}
        currentDate={new Date()}
        onMonthChange={mockOnMonthChange}
      />
    );
    // Format: "202x년 x월"
    const currentMonthText = format(new Date(), 'yyyy년 M월');
    expect(screen.getByText(currentMonthText)).toBeInTheDocument();
  });

  it('renders weekdays based on sunday start', () => {
    render(
      <Calendar
        transactions={[]}
        onDateSelect={mockOnDateSelect}
        currentDate={new Date()}
        onMonthChange={mockOnMonthChange}
        weekStartDay="sunday"
      />
    );
    const sunday = screen.getByText('일');
    expect(sunday).toBeInTheDocument();
  });

  it('calls onDateSelect when a date is clicked', () => {
    render(
      <Calendar
        transactions={mockTransactions}
        onDateSelect={mockOnDateSelect}
        currentDate={new Date()}
        onMonthChange={mockOnMonthChange}
      />
    );

    // Find the button for today (it usually has the day number)
    const todayRequest = format(new Date(), 'd');
    const dayButtons = screen.getAllByText(
      (content, element) => {
        return element?.tagName.toLowerCase() === 'span' && content === todayRequest;
      }
    );
    
    // There might be multiple due to previous/next month days, but the current month one should be prominent.
    // However, simplest way is to click the first one found that is enabled/visible
    const dayButton = dayButtons[0].closest('button');
    if (dayButton) {
      fireEvent.click(dayButton);
      expect(mockOnDateSelect).toHaveBeenCalled();
    }
  });

  it('displays income and expense amounts', () => {
    // 현재 구현에서는 수입/지출을 축약 금액 텍스트로 표시
    const { container } = render(
      <Calendar
        transactions={mockTransactions}
        onDateSelect={mockOnDateSelect}
        currentDate={new Date()}
        onMonthChange={mockOnMonthChange}
      />
    );

    // 수입 금액 (text-income 클래스를 가진 요소)
    const incomeAmounts = container.querySelectorAll('.text-income');
    expect(incomeAmounts.length).toBeGreaterThan(0);

    // 지출 금액 (text-expense 클래스를 가진 요소)
    const expenseAmounts = container.querySelectorAll('.text-expense');
    expect(expenseAmounts.length).toBeGreaterThan(0);
  });
});
