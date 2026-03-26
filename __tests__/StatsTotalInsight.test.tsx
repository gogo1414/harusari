import React from 'react';
import { render, screen } from '@testing-library/react';
import StatsTotalInsight from '@/components/stats/StatsTotalInsight';

describe('StatsTotalInsight', () => {
  it('총 지출 금액을 한국어 포맷으로 표시한다', () => {
    render(<StatsTotalInsight totalExpense={350000} expenseDiff={0} />);
    expect(screen.getByText('350,000')).toBeInTheDocument();
    expect(screen.getByText('이번 달 총 지출')).toBeInTheDocument();
  });

  it('지출이 증가했을 때 "더 썼어요" 메시지와 차이 금액을 표시한다', () => {
    render(<StatsTotalInsight totalExpense={200000} expenseDiff={50000} />);
    // 텍스트가 여러 span에 분리되므로 regex 사용
    expect(screen.getByText(/더 썼어요/)).toBeInTheDocument();
    // "50,000원" span 확인 (절댓값 + "원" 이 하나의 span)
    expect(screen.getByText(/50,000원/)).toBeInTheDocument();
  });

  it('지출이 감소했을 때 "덜 썼어요" 메시지와 차이 금액을 표시한다', () => {
    render(<StatsTotalInsight totalExpense={150000} expenseDiff={-30000} />);
    expect(screen.getByText(/덜 썼어요/)).toBeInTheDocument();
    expect(screen.getByText(/30,000원/)).toBeInTheDocument();
  });

  it('지출이 동일할 때 "지난달과 지출이 같아요" 메시지를 표시한다', () => {
    render(<StatsTotalInsight totalExpense={100000} expenseDiff={0} />);
    // 텍스트는 "➖지난달과 지출이 같아요" 이므로 regex 사용
    expect(screen.getByText(/지난달과 지출이 같아요/)).toBeInTheDocument();
  });

  it('증가 배지에 빨간 계열 클래스가 적용된다', () => {
    const { container } = render(<StatsTotalInsight totalExpense={200000} expenseDiff={10000} />);
    const badge = container.querySelector('.bg-red-500\\/10');
    expect(badge).toBeInTheDocument();
  });

  it('감소 배지에 파란 계열 클래스가 적용된다', () => {
    const { container } = render(<StatsTotalInsight totalExpense={200000} expenseDiff={-10000} />);
    const badge = container.querySelector('.bg-blue-500\\/10');
    expect(badge).toBeInTheDocument();
  });

  it('증가 배지에 📈 이모지를 표시한다', () => {
    render(<StatsTotalInsight totalExpense={100000} expenseDiff={5000} />);
    expect(screen.getByText(/📈/)).toBeInTheDocument();
  });

  it('감소 배지에 📉 이모지를 표시한다', () => {
    render(<StatsTotalInsight totalExpense={100000} expenseDiff={-5000} />);
    expect(screen.getByText(/📉/)).toBeInTheDocument();
  });

  it('동일 배지에 ➖ 이모지를 표시한다', () => {
    render(<StatsTotalInsight totalExpense={100000} expenseDiff={0} />);
    expect(screen.getByText(/➖/)).toBeInTheDocument();
  });
});
