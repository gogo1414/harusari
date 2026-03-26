import React from 'react';
import { render, screen } from '@testing-library/react';
import TrendChart, { type TrendData } from './TrendChart';

// formatBarLabel 및 Tooltip formatter 캡처
let capturedBarFormatter: ((value: unknown) => string) | null = null;
let capturedTooltipFormatter: ((value: unknown) => string) | null = null;

jest.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: React.PropsWithChildren) => (
    <div className="recharts-responsive-container" style={{ width: 800, height: 320 }}>
      {children}
    </div>
  ),
  BarChart: ({ children }: React.PropsWithChildren) => (
    <div data-testid="bar-chart">{children}</div>
  ),
  Bar: ({ label }: { label?: { formatter?: (v: unknown) => string } }) => {
    if (label?.formatter) capturedBarFormatter = label.formatter;
    return <div data-testid="bar" />;
  },
  XAxis: () => <div data-testid="xaxis" />,
  Tooltip: ({ formatter }: { formatter?: (v: unknown) => string }) => {
    if (formatter) capturedTooltipFormatter = formatter;
    return <div data-testid="tooltip" />;
  },
  Legend: () => <div data-testid="legend" />,
}));

describe('TrendChart', () => {
  beforeEach(() => {
    capturedBarFormatter = null;
    capturedTooltipFormatter = null;
  });

  it('데이터가 비어있으면 "내역 없음" 오버레이를 표시한다', () => {
    render(<TrendChart data={[]} />);
    expect(screen.getByText('내역 없음')).toBeInTheDocument();
  });

  it('모든 값이 0이면 "내역 없음" 오버레이를 표시한다', () => {
    const zeroData: TrendData[] = [
      { name: '1월', income: 0, expense: 0, incomeLabel: '', expenseLabel: '' },
      { name: '2월', income: 0, expense: 0, incomeLabel: '', expenseLabel: '' },
    ];
    render(<TrendChart data={zeroData} />);
    expect(screen.getByText('내역 없음')).toBeInTheDocument();
  });

  it('유효한 데이터가 있으면 차트를 렌더링하고 오버레이가 없다', () => {
    const mockData: TrendData[] = [
      { name: '1월', income: 10000, expense: 5000, incomeLabel: '1.0만', expenseLabel: '0.5만' },
    ];
    render(<TrendChart data={mockData} />);
    expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
    expect(screen.queryByText('내역 없음')).not.toBeInTheDocument();
  });

  describe('formatBarLabel (Bar label.formatter)', () => {
    const withData: TrendData[] = [
      { name: '1월', income: 1, expense: 0, incomeLabel: '', expenseLabel: '' },
    ];

    it('0이면 빈 문자열을 반환한다', () => {
      render(<TrendChart data={withData} />);
      expect(capturedBarFormatter?.(0)).toBe('');
    });

    it('NaN이면 빈 문자열을 반환한다', () => {
      render(<TrendChart data={withData} />);
      expect(capturedBarFormatter?.(NaN)).toBe('');
    });

    it('10000 이상이면 만 단위로 반환한다', () => {
      render(<TrendChart data={withData} />);
      expect(capturedBarFormatter?.(50000)).toBe('5.0만');
      expect(capturedBarFormatter?.(10000)).toBe('1.0만');
    });

    it('1000 이상 10000 미만이면 천 단위로 반환한다', () => {
      render(<TrendChart data={withData} />);
      expect(capturedBarFormatter?.(5000)).toBe('5.0천');
      expect(capturedBarFormatter?.(1000)).toBe('1.0천');
    });

    it('1000 미만이면 일반 포맷으로 반환한다', () => {
      render(<TrendChart data={withData} />);
      expect(capturedBarFormatter?.(500)).toBe('500');
    });

    it('문자열 숫자도 처리한다', () => {
      render(<TrendChart data={withData} />);
      expect(capturedBarFormatter?.('20000')).toBe('2.0만');
    });
  });

  describe('Tooltip formatter', () => {
    const withData: TrendData[] = [
      { name: '1월', income: 10000, expense: 5000, incomeLabel: '', expenseLabel: '' },
    ];

    it('금액을 "원" 포맷으로 반환한다', () => {
      render(<TrendChart data={withData} />);
      expect(capturedTooltipFormatter).not.toBeNull();
      expect(capturedTooltipFormatter?.(50000)).toBe('50,000원');
    });

    it('0을 "0원"으로 반환한다', () => {
      render(<TrendChart data={withData} />);
      expect(capturedTooltipFormatter?.(0)).toBe('0원');
    });

    it('null/undefined도 처리한다', () => {
      render(<TrendChart data={withData} />);
      expect(capturedTooltipFormatter?.(null)).toBe('0원');
    });
  });
});
