
import type { Meta, StoryObj } from '@storybook/react';
import StatSection from './StatSection';

const meta: Meta<typeof StatSection> = {
  title: 'Stats/StatSection',
  component: StatSection,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof StatSection>;

const generateStats = (count: number) => {
  const colors = [
    '#3182F6', '#F04452', '#33C7A2', '#FFB800', '#8B5CF6', 
    '#F97316', '#06B6D4', '#6366F1', '#10B981', '#64748B'
  ];
  return Array.from({ length: count }, (_, i) => ({
    name: `Category ${i + 1}`,
    amount: Math.floor(Math.random() * 1000000),
    icon: 'money',
    color: colors[i % colors.length],
  })).sort((a, b) => b.amount - a.amount);
};

export const Default: Story = {
  args: {
    title: '지출',
    type: 'expense',
    total: 1500000,
    stats: generateStats(5),
    diffAmount: 50000,
  },
};

export const ManyCategories: Story = {
  args: {
    title: '지출 (많은 카테고리)',
    type: 'expense',
    total: 5000000,
    stats: generateStats(20),
    diffAmount: -120000,
  },
};

export const Empty: Story = {
  args: {
    title: '수입',
    type: 'income',
    total: 0,
    stats: [],
    diffAmount: 0,
  },
};
