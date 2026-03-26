import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import Calendar from './Calendar';
import { format, addMonths, subMonths } from 'date-fns';

// 로컬 시간 기준 날짜 생성 (UTC 자정 오프셋 문제 방지)
const BASE_DATE = new Date(2026, 2, 15); // 2026-03-15

const mockTransactions = [
  {
    transaction_id: '1',
    user_id: 'user1',
    amount: 10000,
    type: 'expense' as const,
    category_id: 'cat1',
    date: format(BASE_DATE, 'yyyy-MM-dd'),
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
    date: format(BASE_DATE, 'yyyy-MM-dd'),
    created_at: new Date().toISOString(),
    memo: 'bonus',
    source_fixed_id: null,
  },
];

describe('Calendar Component', () => {
  const mockOnDateSelect = jest.fn();
  const mockOnMonthChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('현재 월/연도를 렌더링한다', () => {
    render(
      <Calendar
        transactions={[]}
        onDateSelect={mockOnDateSelect}
        currentDate={BASE_DATE}
        onMonthChange={mockOnMonthChange}
      />
    );
    expect(screen.getByText('2026년 3월')).toBeInTheDocument();
  });

  it('일요일 시작 요일 헤더를 렌더링한다', () => {
    render(
      <Calendar
        transactions={[]}
        onDateSelect={mockOnDateSelect}
        currentDate={BASE_DATE}
        onMonthChange={mockOnMonthChange}
        weekStartDay="sunday"
      />
    );
    const days = screen.getAllByText(/^[일월화수목금토]$/);
    expect(days[0]).toHaveTextContent('일');
  });

  it('월요일 시작 요일 헤더를 렌더링한다', () => {
    render(
      <Calendar
        transactions={[]}
        onDateSelect={mockOnDateSelect}
        currentDate={BASE_DATE}
        onMonthChange={mockOnMonthChange}
        weekStartDay="monday"
      />
    );
    const days = screen.getAllByText(/^[일월화수목금토]$/);
    expect(days[0]).toHaveTextContent('월');
    // 일요일이 마지막
    expect(days[days.length - 1]).toHaveTextContent('일');
  });

  it('날짜 클릭 시 onDateSelect가 호출된다', () => {
    render(
      <Calendar
        transactions={mockTransactions}
        onDateSelect={mockOnDateSelect}
        currentDate={BASE_DATE}
        onMonthChange={mockOnMonthChange}
      />
    );
    // DOM 순서: [0]=prev, [1]=月picker toggle, [2]=next, [3..]=날짜 셀
    const allBtns = screen.getAllByRole('button');
    fireEvent.click(allBtns[3]);
    expect(mockOnDateSelect).toHaveBeenCalled();
  });

  it('이전 달 버튼(인덱스 0) 클릭 시 onMonthChange가 호출된다', () => {
    render(
      <Calendar
        transactions={[]}
        onDateSelect={mockOnDateSelect}
        currentDate={BASE_DATE}
        onMonthChange={mockOnMonthChange}
      />
    );
    const allBtns = screen.getAllByRole('button');
    fireEvent.click(allBtns[0]); // ChevronLeft
    expect(mockOnMonthChange).toHaveBeenCalled();
    const calledWith: Date = mockOnMonthChange.mock.calls[0][0];
    expect(format(calledWith, 'yyyy-MM')).toBe(format(subMonths(BASE_DATE, 1), 'yyyy-MM'));
  });

  it('다음 달 버튼(인덱스 2) 클릭 시 onMonthChange가 호출된다', () => {
    render(
      <Calendar
        transactions={[]}
        onDateSelect={mockOnDateSelect}
        currentDate={BASE_DATE}
        onMonthChange={mockOnMonthChange}
      />
    );
    const allBtns = screen.getAllByRole('button');
    fireEvent.click(allBtns[2]); // ChevronRight
    expect(mockOnMonthChange).toHaveBeenCalled();
    const calledWith: Date = mockOnMonthChange.mock.calls[0][0];
    expect(format(calledWith, 'yyyy-MM')).toBe(format(addMonths(BASE_DATE, 1), 'yyyy-MM'));
  });

  it('수입/지출 금액을 표시한다', () => {
    const { container } = render(
      <Calendar
        transactions={mockTransactions}
        onDateSelect={mockOnDateSelect}
        currentDate={BASE_DATE}
        onMonthChange={mockOnMonthChange}
      />
    );
    expect(container.querySelectorAll('.text-income').length).toBeGreaterThan(0);
    expect(container.querySelectorAll('.text-expense').length).toBeGreaterThan(0);
  });

  describe('월/연도 피커', () => {
    it('월 버튼 클릭 시 피커가 열린다', () => {
      render(
        <Calendar
          transactions={[]}
          onDateSelect={mockOnDateSelect}
          currentDate={BASE_DATE}
          onMonthChange={mockOnMonthChange}
        />
      );
      // 인덱스 1이 月/年 토글 버튼
      const allBtns = screen.getAllByRole('button');
      fireEvent.click(allBtns[1]);
      expect(screen.getByText('1월')).toBeInTheDocument();
      expect(screen.getByText('12월')).toBeInTheDocument();
      expect(screen.getByText('2026년')).toBeInTheDocument();
    });

    it('피커에서 월 선택 시 onMonthChange가 호출되고 피커가 닫힌다', () => {
      render(
        <Calendar
          transactions={[]}
          onDateSelect={mockOnDateSelect}
          currentDate={BASE_DATE}
          onMonthChange={mockOnMonthChange}
        />
      );
      const allBtns = screen.getAllByRole('button');
      fireEvent.click(allBtns[1]); // 피커 열기
      fireEvent.click(screen.getByText('5월'));
      expect(mockOnMonthChange).toHaveBeenCalled();
      // 피커 닫히면 요일 헤더 재표시
      expect(screen.getAllByText(/^[일월화수목금토]$/).length).toBeGreaterThan(0);
    });

    it('피커에서 이전 연도 버튼(인덱스 3) 클릭 시 연도가 감소한다', () => {
      render(
        <Calendar
          transactions={[]}
          onDateSelect={mockOnDateSelect}
          currentDate={BASE_DATE}
          onMonthChange={mockOnMonthChange}
        />
      );
      const allBtns = screen.getAllByRole('button');
      fireEvent.click(allBtns[1]); // 피커 열기
      // 피커 오픈 후 버튼 순서: [0]=prev月(disabled), [1]=月toggle, [2]=next月(disabled),
      //                         [3]=prevYear, [4]=nextYear, [5..16]=12개 월 버튼
      const afterBtns = screen.getAllByRole('button');
      fireEvent.click(afterBtns[3]); // 이전 연도
      expect(screen.getByText('2025년')).toBeInTheDocument();
    });

    it('피커에서 다음 연도 버튼(인덱스 4) 클릭 시 연도가 증가한다', () => {
      render(
        <Calendar
          transactions={[]}
          onDateSelect={mockOnDateSelect}
          currentDate={BASE_DATE}
          onMonthChange={mockOnMonthChange}
        />
      );
      const allBtns = screen.getAllByRole('button');
      fireEvent.click(allBtns[1]); // 피커 열기
      const afterBtns = screen.getAllByRole('button');
      fireEvent.click(afterBtns[4]); // 다음 연도
      expect(screen.getByText('2027년')).toBeInTheDocument();
    });

    it('피커가 열려 있으면 이전/다음 달 버튼(인덱스 0, 2)이 비활성화된다', () => {
      render(
        <Calendar
          transactions={[]}
          onDateSelect={mockOnDateSelect}
          currentDate={BASE_DATE}
          onMonthChange={mockOnMonthChange}
        />
      );
      const allBtns = screen.getAllByRole('button');
      fireEvent.click(allBtns[1]); // 피커 열기
      const afterBtns = screen.getAllByRole('button');
      expect(afterBtns[0]).toBeDisabled(); // prev month
      expect(afterBtns[2]).toBeDisabled(); // next month
    });
  });

  describe('급여 사이클', () => {
    it('cycleStartDay >= 20이면 다음 달 기준으로 월을 표시한다', () => {
      // cycleStartDay=25, 현재 3월 26일 → 헤더에 4월 표시
      render(
        <Calendar
          transactions={[]}
          onDateSelect={mockOnDateSelect}
          currentDate={new Date(2026, 2, 26)}
          onMonthChange={mockOnMonthChange}
          cycleStartDay={25}
        />
      );
      expect(screen.getByText('2026년 4월')).toBeInTheDocument();
    });

    it('cycleStartDay < 20이면 현재 달 기준으로 월을 표시한다', () => {
      render(
        <Calendar
          transactions={[]}
          onDateSelect={mockOnDateSelect}
          currentDate={BASE_DATE}
          onMonthChange={mockOnMonthChange}
          cycleStartDay={10}
        />
      );
      expect(screen.getByText('2026년 3월')).toBeInTheDocument();
    });

    it('사이클 기간 범위(MM.dd ~ MM.dd)를 표시한다', () => {
      render(
        <Calendar
          transactions={[]}
          onDateSelect={mockOnDateSelect}
          currentDate={BASE_DATE}
          onMonthChange={mockOnMonthChange}
          cycleStartDay={1}
        />
      );
      expect(screen.getByText(/03\.01/)).toBeInTheDocument();
      expect(screen.getByText(/03\.31/)).toBeInTheDocument();
    });
  });

  describe('선택 날짜', () => {
    it('선택된 날짜가 있으면 해당 날짜 셀에 bg-foreground 클래스가 적용된다', () => {
      const { container } = render(
        <Calendar
          transactions={[]}
          onDateSelect={mockOnDateSelect}
          currentDate={BASE_DATE}
          onMonthChange={mockOnMonthChange}
          selectedDate={BASE_DATE}
        />
      );
      expect(container.querySelector('.bg-foreground')).toBeInTheDocument();
    });
  });
});
