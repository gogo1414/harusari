
import type { Meta, StoryObj } from '@storybook/react';
import BottomSheet from './BottomSheet';

const meta: Meta<typeof BottomSheet> = {
  title: 'Components/BottomSheet',
  component: BottomSheet,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof BottomSheet>;

const mockCategories = [
  { category_id: '1', name: '식비', icon: 'food', type: 'expense' as const, user_id: 'user1', is_default: false, created_at: '' },
  { category_id: '2', name: '월급', icon: 'salary', type: 'income' as const, user_id: 'user1', is_default: false, created_at: '' },
];

const mockTransactions = [
  {
    transaction_id: '1',
    amount: 15000,
    type: 'expense' as const,
    category_id: '1',
    date: '2024-03-15',
    displayDate: '2024-03-15',
    memo: '점심 식사',
    user_id: 'user1',
    created_at: '',
    source_fixed_id: null,
  },
  {
    transaction_id: '2',
    amount: 3500000,
    type: 'income' as const,
    category_id: '2',
    date: '2024-03-15',
    displayDate: '2024-03-15',
    memo: '3월 월급',
    user_id: 'user1',
    created_at: '',
    source_fixed_id: null,
  },
];

export const DailyView: Story = {
  args: {
    isOpen: true,
    onClose: () => console.log('closed'),
    selectedDate: new Date('2024-03-15'),
    transactions: mockTransactions,
    categories: mockCategories,
    onEdit: (t) => console.log('edit', t),
    onDelete: (id) => console.log('delete', id),
    viewMode: 'date',
  },
};

export const EmptyDailyView: Story = {
  args: {
    isOpen: true,
    onClose: () => console.log('closed'),
    selectedDate: new Date('2024-03-16'),
    transactions: [],
    categories: mockCategories,
    onEdit: (t) => console.log('edit', t),
    onDelete: (id) => console.log('delete', id),
    viewMode: 'date',
  },
};

export const TypeView: Story = {
  args: {
    isOpen: true,
    onClose: () => console.log('closed'),
    selectedDate: null,
    transactions: mockTransactions,
    categories: mockCategories,
    onEdit: (t) => console.log('edit', t),
    onDelete: (id) => console.log('delete', id),
    viewMode: 'type',
    filterType: 'expense',
  },
};
