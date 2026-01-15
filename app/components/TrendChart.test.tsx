import { render, screen } from '@testing-library/react';
import TrendChart from './TrendChart';

// Mock Recharts modules
jest.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div className="recharts-responsive-container" style={{ width: 800, height: 320 }}>{children}</div>,
  BarChart: ({ children }: any) => <div data-testid="bar-chart">{children}</div>,
  Bar: () => <div data-testid="bar" />,
  XAxis: () => <div data-testid="xaxis" />,
  Tooltip: () => <div data-testid="tooltip" />,
  Legend: () => <div data-testid="legend" />,
}));

describe('TrendChart', () => {
  it('renders "내역 없음" overlay when data is empty or zero', () => {
    // Empty array
    const { rerender } = render(<TrendChart data={[]} />);
    expect(screen.getByText('내역 없음')).toBeInTheDocument();

    // Zero data
    const zeroData = [
       { name: '1월', income: 0, expense: 0, incomeLabel: '', expenseLabel: '' },
       { name: '2월', income: 0, expense: 0, incomeLabel: '', expenseLabel: '' }
    ];
    rerender(<TrendChart data={zeroData} />);
    expect(screen.getByText('내역 없음')).toBeInTheDocument();
  });

  it('renders chart without overlay when valid data exists', () => {
     const mockData = [
       { name: '1월', income: 10000, expense: 5000, incomeLabel: '1.0만', expenseLabel: '0.5만' },
       { name: '2월', income: 0, expense: 0, incomeLabel: '', expenseLabel: '' }
     ];
     render(<TrendChart data={mockData} />);
     expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
     expect(screen.queryByText('내역 없음')).not.toBeInTheDocument();
  });
});
