
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
  {
    category_id: '1',
    user_id: 'user1',
    name: '식비',
    type: 'expense' as const,
    icon: 'food',
    is_default: false,
    created_at: new Date().toISOString(),
  },
  {
    category_id: '2',
    user_id: 'user1',
    name: '교통',
    type: 'expense' as const,
    icon: 'bus',
    is_default: false,
    created_at: new Date().toISOString(),
  },
  {
    category_id: '3',
    user_id: 'user1',
    name: '월급',
    type: 'income' as const,
    icon: 'money',
    is_default: false,
    created_at: new Date().toISOString(),
  },
  {
    category_id: '4',
    user_id: 'user1',
    name: '쇼핑',
    type: 'expense' as const,
    icon: 'shopping',
    is_default: false,
    created_at: new Date().toISOString(),
  },
  {
    category_id: '5',
    user_id: 'user1',
    name: '주거/통신',
    type: 'expense' as const,
    icon: 'home',
    is_default: false,
    created_at: new Date().toISOString(),
  },
  {
    category_id: '6',
    user_id: 'user1',
    name: '월급',
    type: 'income' as const,
    icon: 'salary',
    is_default: false,
    created_at: new Date().toISOString(),
  },
  {
    category_id: '7',
    user_id: 'user1',
    name: '용돈',
    type: 'income' as const,
    icon: 'money',
    is_default: false,
    created_at: new Date().toISOString(),
  },
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
