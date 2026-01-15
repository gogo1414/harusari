
import type { Meta, StoryObj } from '@storybook/react';
import TrendChart from './TrendChart';

const meta: Meta<typeof TrendChart> = {
  title: 'Stats/TrendChart',
  component: TrendChart,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof TrendChart>;

const generateTrendData = () => {
  return Array.from({ length: 12 }, (_, i) => {
    const income = Math.floor(Math.random() * 5000000);
    const expense = Math.floor(Math.random() * 4000000);
    return {
      name: `${i + 1}월`,
      income,
      expense,
      incomeLabel: (income / 10000).toFixed(1),
      expenseLabel: (expense / 10000).toFixed(1),
    };
  });
};

// Helper to generate empty 12 months data
const generateEmpty12Months = () => {
  return Array.from({ length: 12 }, (_, i) => ({
    name: `${i + 1}월`,
    income: 0,
    expense: 0,
    incomeLabel: '',
    expenseLabel: '',
  }));
};

export const Default: Story = {
  args: {
    data: generateTrendData(),
  },
};

export const Empty: Story = {
  args: {
    data: generateEmpty12Months(),
  },
};

export const OneMonth: Story = {
  args: {
    data: generateEmpty12Months().map((d, i) => {
      if (i === 5) { // June only
        return {
           name: '6월',
           income: 3000000,
           expense: 2000000,
           incomeLabel: '300.0천',
           expenseLabel: '200.0천',
        };
      }
      return d;
    }),
  },
};

export const TwoMonths: Story = {
  args: {
    data: generateEmpty12Months().map((d, i) => {
      if (i === 2) { // March
        return {
           name: '3월',
           income: 2500000,
           expense: 1500000,
           incomeLabel: '250.0천',
           expenseLabel: '150.0천',
        };
      }
      if (i === 3) { // April
        return {
           name: '4월',
           income: 2800000,
           expense: 2100000,
           incomeLabel: '280.0천',
           expenseLabel: '210.0천',
        };
      }
      return d;
    }),
  },
};

export const SparseData: Story = {
  args: {
    data: generateEmpty12Months().map((d, i) => {
      if (i === 0) { // Jan
        return {
           name: '1월',
           income: 4500000,
           expense: 4000000,
           incomeLabel: '450.0천',
           expenseLabel: '400.0천',
        };
      }
      if (i === 11) { // Dec
        return {
           name: '12월',
           income: 5000000,
           expense: 1000000,
           incomeLabel: '500.0천',
           expenseLabel: '100.0천',
        };
      }
      return d;
    }),
  },
};
