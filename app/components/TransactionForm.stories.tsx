
import type { Meta, StoryObj } from '@storybook/react';
import TransactionForm from './TransactionForm';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient();

const meta: Meta<typeof TransactionForm> = {
  title: 'Components/TransactionForm',
  component: TransactionForm,
  parameters: {
    layout: 'fullscreen',
    nextjs: {
      appDirectory: true,
    },
  },
  decorators: [
    (Story) => (
      <QueryClientProvider client={queryClient}>
        <Story />
      </QueryClientProvider>
    ),
  ],
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof TransactionForm>;

const mockCategories = [
  { category_id: '1', name: '식비', icon: 'food', type: 'expense', user_id: 'user1', created_at: '' },
  { category_id: '2', name: '카페/간식', icon: 'cafe', type: 'expense', user_id: 'user1', created_at: '' },
  { category_id: '3', name: '교통', icon: 'transport', type: 'expense', user_id: 'user1', created_at: '' },
  { category_id: '4', name: '쇼핑', icon: 'shopping', type: 'expense', user_id: 'user1', created_at: '' },
  { category_id: '5', name: '주거/통신', icon: 'home', type: 'expense', user_id: 'user1', created_at: '' },
  { category_id: '6', name: '월급', icon: 'salary', type: 'income', user_id: 'user1', created_at: '' },
  { category_id: '7', name: '용돈', icon: 'money', type: 'income', user_id: 'user1', created_at: '' },
];

export const Default: Story = {
  args: {
    categories: mockCategories,
    onSubmit: async (data) => {
      console.log('Form submitted:', data);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    },
  },
};

export const EditMode: Story = {
  args: {
    categories: mockCategories,
    isEditMode: true,
    initialData: {
      type: 'expense',
      date: new Date(),
      amount: 15600,
      category_id: '1', // 식비
      memo: '점심 식사',
      is_recurring: false,
      end_type: 'never',
    },
    onSubmit: async (data) => {
      console.log('Edit submitted:', data);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    },
  },
};

export const IncomeMode: Story = {
  args: {
    categories: mockCategories,
    initialData: {
      type: 'income',
      date: new Date(),
      amount: 0,
       category_id: '',
      memo: '',
      is_recurring: false,
      end_type: 'never',
    },
    onSubmit: async (data) => {
      console.log('Income submitted:', data);
    },
  },
};
