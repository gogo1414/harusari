'use client';

import TransactionForm from '@/app/components/TransactionForm';
import type { Category } from '@/types/database';
import { useRouter } from 'next/navigation';

// 더미 데이터
const dummyCategories: Category[] = [
  // 지출
  {
    category_id: '1',
    user_id: 'user1',
    name: '식비',
    type: 'expense',
    icon: '🍔',
    created_at: '',
  },
  {
    category_id: '2',
    user_id: 'user1',
    name: '교통',
    type: 'expense',
    icon: '🚌',
    created_at: '',
  },
  {
    category_id: '3',
    user_id: 'user1',
    name: '쇼핑',
    type: 'expense',
    icon: '🛒',
    created_at: '',
  },
  {
    category_id: '4',
    user_id: 'user1',
    name: '카페',
    type: 'expense',
    icon: '☕',
    created_at: '',
  },
  // 수입
  {
    category_id: '11',
    user_id: 'user1',
    name: '월급',
    type: 'income',
    icon: '💰',
    created_at: '',
  },
  {
    category_id: '12',
    user_id: 'user1',
    name: '용돈',
    type: 'income',
    icon: '💵',
    created_at: '',
  },
];

export default function NewTransactionPage() {
  const router = useRouter();

  const handleSubmit = async (data: any) => {
    console.log('Form Data:', data);
    // TODO: Supabase 저장 로직 구현
    alert('저장되었습니다 (테스트)');
    router.back();
  };

  return (
    <div className="min-h-dvh bg-background pb-8">
      <TransactionForm categories={dummyCategories} onSubmit={handleSubmit} />
    </div>
  );
}
