
import type { Meta, StoryObj } from '@storybook/react';
import CategoryChart from './CategoryChart';

const meta: Meta<typeof CategoryChart> = {
  title: 'Stats/CategoryChart',
  component: CategoryChart,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof CategoryChart>;

const generateStats = (count: number) => {
  const colors = [
    '#3182F6', '#F04452', '#33C7A2', '#FFB800', '#8B5CF6', 
    '#F97316', '#06B6D4', '#6366F1', '#10B981', '#64748B'
  ];
  return Array.from({ length: count }, (_, i) => ({
    name: `Category ${i + 1}`,
    amount: Math.floor(Math.random() * 1000000) + 10000,
    icon: 'money',
    color: colors[i % colors.length],
  })).sort((a, b) => b.amount - a.amount);
};

const statsSmall = generateStats(5);
const totalSmall = statsSmall.reduce((sum, s) => sum + s.amount, 0);

const statsLarge = generateStats(20);
const totalLarge = statsLarge.reduce((sum, s) => sum + s.amount, 0);

export const DonutSmall: Story = {
  args: {
    type: 'donut',
    stats: statsSmall,
    total: totalSmall,
    isIncome: false,
  },
};

export const DonutLarge: Story = {
  args: {
    type: 'donut',
    stats: statsLarge,
    total: totalLarge,
    isIncome: false,
  },
};

export const BarSmall: Story = {
  args: {
    type: 'bar',
    stats: statsSmall,
    total: totalSmall,
    isIncome: false,
  },
};

export const BarLarge: Story = {
  args: {
    type: 'bar',
    stats: statsLarge,
    total: totalLarge,
    isIncome: false,
  },
};
