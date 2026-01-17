'use client';

import { format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import TransactionItem from '@/components/common/TransactionItem';
import type { Transaction, Category } from '@/types/database';

interface HomeTransactionListProps {
  transactions: Transaction[];
  categories: Category[];
  groupedTransactions: Record<string, Transaction[]>; // date string key
  sortedDates: string[];
  onDeleteRequest: (id: string) => void;
  onEdit: (id: string) => void;
}

export default function HomeTransactionList({
  transactions,
  categories,
  groupedTransactions,
  sortedDates,
  onDeleteRequest,
  onEdit,
}: HomeTransactionListProps) {
  return (
    <div className="px-5 pb-24 -mt-16">
       <div className="bg-card rounded-[32px] p-6 shadow-lg shadow-black/5 ring-1 ring-black/5 dark:ring-white/10 min-h-[300px]">
           <h3 className="text-lg font-bold mb-4 flex items-center justify-between">
              <span>거래 내역</span>
              <span className="text-xs font-normal text-muted-foreground bg-muted px-2 py-1 rounded-full">
                 {transactions.length}건
              </span>
           </h3>
           
           {transactions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center opacity-60">
                 <span className="text-4xl mb-2">🍃</span>
                 <p className="text-sm font-medium">내역이 없어요</p>
              </div>
           ) : (
              <div className="space-y-6">
                 {sortedDates.map(date => (
                    <div key={date}>
                       <h4 className="text-xs font-bold text-muted-foreground mb-2 px-1">
                          {format(parseISO(date), 'd일 EEEE', { locale: ko })}
                       </h4>
                       <div className="space-y-1">
                          {groupedTransactions[date].map(t => (
                             <TransactionItem
                                key={t.transaction_id}
                                transaction={t}
                                categories={categories}
                                onDelete={onDeleteRequest}
                                onEdit={onEdit}
                             />
                          ))}
                       </div>
                    </div>
                 ))}
              </div>
           )}
       </div>
    </div>
  );
}
