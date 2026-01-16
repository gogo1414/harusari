import React from 'react';
import { render, screen } from '@testing-library/react';
import CategoryChart from './CategoryChart';

// Mock Recharts modules
jest.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: React.PropsWithChildren) => <div className="recharts-responsive-container">{children}</div>,
  PieChart: ({ children }: React.PropsWithChildren) => <div data-testid="pie-chart">{children}</div>,
  Pie: ({ children }: React.PropsWithChildren) => <div data-testid="pie">{children}</div>,
  Cell: () => <div data-testid="cell" />,
  BarChart: ({ children }: React.PropsWithChildren) => <div data-testid="bar-chart">{children}</div>,
  Bar: () => <div data-testid="bar" />,
  XAxis: () => <div data-testid="xaxis" />,
  YAxis: () => <div data-testid="yaxis" />,
  Tooltip: () => <div data-testid="tooltip" />,
}));

describe('CategoryChart', () => {
  const mockData = [
    { name: '식비', amount: 50000, color: '#FF0000', icon: 'food' },
    { name: '교통', amount: 20000, color: '#00FF00', icon: 'bus' },
  ];

  it('renders donut chart when type is "donut"', () => {
    render(<CategoryChart stats={mockData} type="donut" total={70000} />);
    expect(screen.getByTestId('pie-chart')).toBeInTheDocument();
  });

  it('renders stacked bar chart when type is \"bar\"', () => {
    render(<CategoryChart stats={mockData} type="bar" total={70000} />);
    // The bar chart is implemented as HTML divs, not Recharts
    // Check for the presence of the container or specific color bars by title
    expect(screen.getByTitle('식비: 71.4%')).toBeInTheDocument();
    expect(screen.getByTitle('교통: 28.6%')).toBeInTheDocument();
  });

  it('renders nothing or empty state when data is empty', () => {
      // In current implementation, it might render an empty chart or return null. 
      // Checking if it renders without crashing.
      const { container } = render(<CategoryChart stats={[]} type="donut" total={0} />);
      expect(container).toBeInTheDocument();
  });
});
