
import type { Meta, StoryObj } from '@storybook/react';
import Calendar from './Calendar';

const meta: Meta<typeof Calendar> = {
  title: 'Components/Calendar',
  component: Calendar,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof Calendar>;


const today = new Date();

export const Default: Story = {
  args: {
    currentDate: today,
    selectedDate: today,
    transactions: [
      {
        transaction_id: '1',
        date: new Date(today.getFullYear(), today.getMonth(), today.getDate() - 2).toISOString().split('T')[0],
        amount: 25000,
        type: 'expense',
        memo: 'Lunch', // Changed description to memo
        category_id: 'food',
        user_id: 'user1',
        created_at: new Date().toISOString(),
        source_fixed_id: null,
      },
      {
        transaction_id: '2',
        date: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 2).toISOString().split('T')[0],
        amount: 500000,
        type: 'income',
        memo: 'Allowance',
        category_id: 'salary',
        user_id: 'user1',
        created_at: new Date().toISOString(),
        source_fixed_id: null,
      },
      {
        transaction_id: '3',
        date: today.toISOString().split('T')[0],
        amount: 12000,
        type: 'expense',
        memo: 'Coffee',
        category_id: 'cafe',
        user_id: 'user1',
        created_at: new Date().toISOString(),
        source_fixed_id: null,
      },
    ],
    onDateSelect: (date) => console.log('Selected date:', date),
    onMonthChange: (date) => console.log('Month changed:', date),
  },
};

