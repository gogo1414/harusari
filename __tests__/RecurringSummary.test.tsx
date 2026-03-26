import React from 'react';
import { render, screen } from '@testing-library/react';
import RecurringSummary from '@/app/recurring/components/RecurringSummary';

describe('RecurringSummary', () => {
  it('고정 수입 금액을 표시한다', () => {
    render(<RecurringSummary stats={{ income: 2500000, expense: 500000 }} />);
    expect(screen.getByText('고정 수입 (월)')).toBeInTheDocument();
    expect(screen.getByText('2,500,000')).toBeInTheDocument();
  });

  it('고정 지출 금액을 표시한다', () => {
    render(<RecurringSummary stats={{ income: 0, expense: 350000 }} />);
    expect(screen.getByText('고정 지출 (월)')).toBeInTheDocument();
    expect(screen.getByText('350,000')).toBeInTheDocument();
  });

  it('0원일 때 0을 표시한다', () => {
    render(<RecurringSummary stats={{ income: 0, expense: 0 }} />);
    const zeros = screen.getAllByText('0');
    expect(zeros.length).toBeGreaterThanOrEqual(2);
  });

  it('수입 카드에 + 기호를 표시한다', () => {
    render(<RecurringSummary stats={{ income: 100000, expense: 50000 }} />);
    // "+" 기호를 직접 텍스트로 찾음 (income span 내부)
    expect(screen.getByText('+')).toBeInTheDocument();
  });

  it('지출 카드에 - 기호를 표시한다', () => {
    render(<RecurringSummary stats={{ income: 100000, expense: 50000 }} />);
    expect(screen.getByText('-')).toBeInTheDocument();
  });

  it('고정 수입과 고정 지출 두 카드가 모두 렌더링된다', () => {
    const { container } = render(<RecurringSummary stats={{ income: 100000, expense: 50000 }} />);
    // 그리드 내 2개의 카드
    const cards = container.querySelectorAll('.rounded-\\[24px\\]');
    expect(cards.length).toBe(2);
  });
});
