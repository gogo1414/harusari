import React from 'react';
import { render, screen } from '@testing-library/react';
import CategoryChart from './CategoryChart';

// Tooltip formatter 캡처
let capturedTooltipFormatter: ((value: unknown) => string) | null = null;

jest.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: React.PropsWithChildren) => (
    <div className="recharts-responsive-container">{children}</div>
  ),
  PieChart: ({ children }: React.PropsWithChildren) => (
    <div data-testid="pie-chart">{children}</div>
  ),
  Pie: ({ children }: React.PropsWithChildren) => <div data-testid="pie">{children}</div>,
  Cell: () => <div data-testid="cell" />,
  Tooltip: ({ formatter }: { formatter?: (v: unknown) => string }) => {
    if (formatter) capturedTooltipFormatter = formatter;
    return <div data-testid="tooltip" />;
  },
}));

describe('CategoryChart', () => {
  const mockData = [
    { name: '식비', amount: 50000, color: '#FF0000', icon: 'food' },
    { name: '교통', amount: 20000, color: '#00FF00', icon: 'bus' },
  ];

  beforeEach(() => {
    capturedTooltipFormatter = null;
  });

  describe('donut 차트', () => {
    it('데이터가 있으면 파이 차트를 렌더링한다', () => {
      render(<CategoryChart stats={mockData} type="donut" total={70000} />);
      expect(screen.getByTestId('pie-chart')).toBeInTheDocument();
    });

    it('isIncome=false이면 "지출" 텍스트를 표시한다', () => {
      render(<CategoryChart stats={mockData} type="donut" total={70000} isIncome={false} />);
      expect(screen.getByText('지출')).toBeInTheDocument();
    });

    it('isIncome=true이면 "수입" 텍스트를 표시한다', () => {
      render(<CategoryChart stats={mockData} type="donut" total={70000} isIncome={true} />);
      expect(screen.getByText('수입')).toBeInTheDocument();
    });

    it('데이터가 비어있으면 "내역 없음" 빈 상태를 표시한다', () => {
      render(<CategoryChart stats={[]} type="donut" total={0} />);
      expect(screen.getByText('내역 없음')).toBeInTheDocument();
      expect(screen.queryByTestId('pie-chart')).not.toBeInTheDocument();
    });

    it('Tooltip formatter가 금액을 한국어 포맷으로 반환한다', () => {
      render(<CategoryChart stats={mockData} type="donut" total={70000} />);
      expect(capturedTooltipFormatter).not.toBeNull();
      expect(capturedTooltipFormatter?.(50000)).toBe('50,000원');
      expect(capturedTooltipFormatter?.(0)).toBe('0원');
      expect(capturedTooltipFormatter?.(null)).toBe('0원');
    });
  });

  describe('bar 차트', () => {
    it('데이터가 있으면 비율에 맞는 바를 렌더링한다', () => {
      render(<CategoryChart stats={mockData} type="bar" total={70000} />);
      expect(screen.getByTitle('식비: 71.4%')).toBeInTheDocument();
      expect(screen.getByTitle('교통: 28.6%')).toBeInTheDocument();
    });

    it('데이터가 비어있으면 "내역 없음" 빈 상태를 표시한다', () => {
      render(<CategoryChart stats={[]} type="bar" total={0} />);
      expect(screen.getByText('내역 없음')).toBeInTheDocument();
    });

    it('비율이 1% 미만인 항목(마지막 제외)은 렌더링에서 제외된다', () => {
      const tinyData = [
        { name: '주요', amount: 99900, color: '#FF0000', icon: 'food' },
        { name: '극소', amount: 50, color: '#00FF00', icon: 'bus' }, // 0.05% < 1% → 제외
        { name: '마지막', amount: 50, color: '#0000FF', icon: 'cafe' }, // 마지막은 항상 포함
      ];
      const { container } = render(
        <CategoryChart stats={tinyData} type="bar" total={100000} />
      );
      const bars = container.querySelectorAll('[title]');
      expect(bars.length).toBeLessThan(tinyData.length);
    });
  });

  describe('알 수 없는 타입', () => {
    it('donut/bar 이외의 타입이면 null을 반환한다', () => {
      // @ts-expect-error 잘못된 타입 테스트
      const { container } = render(<CategoryChart stats={mockData} type="unknown" total={70000} />);
      expect(container.firstChild).toBeNull();
    });
  });
});
