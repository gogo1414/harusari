import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import StatsDateNavigator from '@/components/stats/StatsDateNavigator';

describe('StatsDateNavigator', () => {
  const currentCycle = {
    start: new Date('2026-03-01'),
    end: new Date('2026-03-31'),
  };
  const onMonthChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('사이클 종료 기준 연월을 표시한다', () => {
    render(<StatsDateNavigator currentCycle={currentCycle} onMonthChange={onMonthChange} />);
    expect(screen.getByText('2026년 3월')).toBeInTheDocument();
  });

  it('사이클 기간(시작~종료)을 표시한다', () => {
    render(<StatsDateNavigator currentCycle={currentCycle} onMonthChange={onMonthChange} />);
    expect(screen.getByText('(3.1 ~ 3.31)')).toBeInTheDocument();
  });

  it('이전 버튼 클릭 시 onMonthChange(-1)이 호출된다', () => {
    render(<StatsDateNavigator currentCycle={currentCycle} onMonthChange={onMonthChange} />);
    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[0]); // 왼쪽 화살표 버튼
    expect(onMonthChange).toHaveBeenCalledWith(-1);
  });

  it('다음 버튼 클릭 시 onMonthChange(1)이 호출된다', () => {
    render(<StatsDateNavigator currentCycle={currentCycle} onMonthChange={onMonthChange} />);
    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[1]); // 오른쪽 화살표 버튼
    expect(onMonthChange).toHaveBeenCalledWith(1);
  });
});
