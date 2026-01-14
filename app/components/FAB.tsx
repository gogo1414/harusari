'use client';

import { Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function FAB() {
  const router = useRouter();

  return (
    <button
      onClick={() => router.push('/transactions/new')}
      className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 active:scale-95"
      aria-label="새 거래 추가"
    >
      <Plus className="h-7 w-7" />
    </button>
  );
}
