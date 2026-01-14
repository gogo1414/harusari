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
    const monday = screen.getByText('월');
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

  it('displays income and expense dots or amounts', () => {
    // In our Calendar implementation, we show amounts if space permits or dots.
    // The current implementation shows text amounts for income/expense.
    render(
      <Calendar
        transactions={mockTransactions}
        onDateSelect={mockOnDateSelect}
        currentDate={new Date()}
        onMonthChange={mockOnMonthChange}
      />
    );

    // "1만" for 10000 expense (displayed as -1만) and "5만" for 50000 income (+5만)
    // Adjust expectation based on formatAmount function: 10000 -> 1만
    expect(screen.getByText('-1만')).toBeInTheDocument();
    expect(screen.getByText('+5만')).toBeInTheDocument();
  });
});
