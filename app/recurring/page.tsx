'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Trash2, Calendar, Repeat as RepeatIcon, Loader2, Edit2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CategoryIcon } from '@/components/category/IconPicker';
import { format } from 'date-fns';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from '@/components/ui/label';
import type { FixedTransaction, Category } from '@/types/database';

// 카테고리 join된 고정 거래 타입
interface FixedTransactionWithCategory extends FixedTransaction {
  categories: Category | null;
}

export default function RecurringPage() {
  const router = useRouter();
  const supabase = createClient();
  const queryClient = useQueryClient();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteRelated, setDeleteRelated] = useState(false);

  // 고정 지출 조회
  const { data: recurringItems = [], isLoading } = useQuery({
    queryKey: ['fixed_transactions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fixed_transactions')
        .select(`
          *,
          categories:category_id (*)
        `)
        .order('day', { ascending: true });
      
      if (error) throw error;
      return data;
    },
  });

  // 삭제 Mutation
  const deleteMutation = useMutation({
    mutationFn: async ({ id, deleteRelated }: { id: string; deleteRelated: boolean }) => {
      // 1. 관련 거래 삭제 (옵션)
      if (deleteRelated) {
        const { error: relatedError } = await supabase
          .from('transactions')
          .delete()
          .eq('source_fixed_id', id);
        if (relatedError) throw relatedError;
      }

      // 2. 고정 지출 삭제
      const { error } = await supabase
        .from('fixed_transactions')
        .delete()
        .eq('fixed_transaction_id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fixed_transactions'] });
      // 관련 거래도 삭제했다면 거래 목록도 갱신
      if (deleteRelated) {
        queryClient.invalidateQueries({ queryKey: ['transactions'] });
      }
      setDeleteId(null);
      setDeleteRelated(false);
    },
  });

  const handleDeleteConfirm = () => {
    if (deleteId) {
      deleteMutation.mutate({ id: deleteId, deleteRelated });
    }
  };

  const formatAmount = (amount: number) => new Intl.NumberFormat('ko-KR').format(amount);

  const getEndDescription = (endType: string, endDate: string | null) => {
    if (endType === 'never') return '계속 반복';
    if (!endDate) return '종료일 미지정';
    return `${format(new Date(endDate), 'yyyy.MM.dd')} 종료`;
  };

  // 통계 계산
  const stats = recurringItems.reduce(
    (acc: { income: number; expense: number }, item: FixedTransactionWithCategory) => {
      if (item.type === 'income') acc.income += item.amount;
      else acc.expense += item.amount;
      return acc;
    },
    { income: 0, expense: 0 }
  );

  return (
    <div className="min-h-dvh bg-background pb-20">
      <div className="sticky top-0 z-10 flex items-center gap-2 bg-background/95 backdrop-blur-sm px-4 py-3 border-b border-border/30">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="-ml-2 rounded-full h-10 w-10">
          <ChevronLeft className="h-6 w-6" />
        </Button>
        <h1 className="text-xl font-bold">고정 지출/수입 관리</h1>
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => router.push('/recurring/new')} 
          className="ml-auto rounded-full h-10 w-10 hover:bg-black/5 dark:hover:bg-white/10"
        >
           <Plus className="h-6 w-6" />
        </Button>
      </div>

      <div className="p-4 space-y-6">
        {/* 요약 카드 */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <div className="rounded-[24px] bg-card p-4 sm:p-5 shadow-sm ring-1 ring-black/5 dark:ring-white/5 flex flex-col justify-between h-[100px] sm:h-[110px] relative overflow-hidden">
             <div className="absolute top-0 right-0 p-4 opacity-10">
               <span className="text-3xl sm:text-4xl text-income">↘</span>
             </div>
             <p className="text-xs sm:text-sm font-medium text-muted-foreground">고정 수입 (월)</p>
             <p className="text-[clamp(18px,5vw,24px)] font-extrabold tracking-tight truncate w-full">
               <span className="text-income">+</span>
               <span className="text-foreground">{stats.income.toLocaleString()}</span>
             </p>
          </div>

          <div className="rounded-[24px] bg-card p-4 sm:p-5 shadow-sm ring-1 ring-black/5 dark:ring-white/5 flex flex-col justify-between h-[100px] sm:h-[110px] relative overflow-hidden">
             <div className="absolute top-0 right-0 p-4 opacity-10">
                <span className="text-3xl sm:text-4xl text-expense">↗</span>
             </div>
             <p className="text-xs sm:text-sm font-medium text-muted-foreground">고정 지출 (월)</p>
             <p className="text-[clamp(18px,5vw,24px)] font-extrabold tracking-tight truncate w-full">
               <span className="text-expense">-</span>
               <span className="text-foreground">{stats.expense.toLocaleString()}</span>
             </p>
          </div>
        </div>


      {isLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : recurringItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
           <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted/50">
             <RepeatIcon className="h-8 w-8 text-muted-foreground" />
           </div>
           <p className="text-lg font-medium text-muted-foreground">등록된 고정 내역이 없습니다</p>
           <p className="text-sm text-muted-foreground/60 mt-2">
             거래 추가 시 &apos;고정 내역으로 등록&apos;을 선택해보세요
           </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {recurringItems.map((item: FixedTransactionWithCategory) => (
            <div
              key={item.fixed_transaction_id}
              className="flex flex-col gap-3 rounded-2xl border border-border/50 bg-card p-4 shadow-sm"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-2xl text-2xl ${
                    item.type === 'income' ? 'bg-income/10 text-income' : 'bg-expense/10 text-expense'
                  }`}>
                    <CategoryIcon iconName={item.categories?.icon || 'money'} className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-foreground">
                      {item.memo || item.categories?.name || '미분류'}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                       {item.categories?.name}
                    </p>
                  </div>
                </div>
                 {/* 버튼 그룹 */}
                 <div className="flex items-center gap-1">
                   <Button
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 active:scale-95 transition-all"
                    onClick={() => router.push(`/recurring/edit/${item.fixed_transaction_id}`)}
                    aria-label="고정 내역 수정"
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                   <Button
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 rounded-xl bg-destructive/10 text-destructive hover:bg-destructive/20 active:scale-95 transition-all"
                    onClick={() => setDeleteId(item.fixed_transaction_id)}
                    aria-label="고정 내역 삭제"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                 </div>
              </div>

              <div className="flex items-center justify-between border-t border-border/40 pt-3 mt-1">
                 <div className="flex items-center gap-4 text-sm font-medium text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <Calendar className="h-4 w-4" />
                      매월 {item.day}일
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-muted">
                      {getEndDescription(item.end_type, item.end_date)}
                    </span>
                 </div>
                 <span className={`text-lg font-bold ${
                    item.type === 'income' ? 'text-income' : 'text-expense'
                 }`}>
                   {item.type === 'income' ? '+' : '-'}{formatAmount(item.amount)}원
                 </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 삭제 확인 다이얼로그 - 토스 UX 스타일 */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent className="rounded-3xl max-w-[320px] p-6">
          <AlertDialogHeader className="text-center">
            <AlertDialogTitle className="text-xl font-bold">고정 내역을 삭제할까요?</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground mt-2">
              삭제하면 더 이상 자동으로 기록되지 않아요
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="flex items-center gap-3 p-4 rounded-2xl bg-muted/50 mt-4">
            <Checkbox
              id="delete-related"
              checked={deleteRelated}
              onCheckedChange={(checked) => setDeleteRelated(checked as boolean)}
              className="h-5 w-5"
            />
            <Label htmlFor="delete-related" className="text-sm font-medium leading-tight cursor-pointer">
              이 설정으로 생성된 과거 내역도 함께 삭제
            </Label>
          </div>

          <AlertDialogFooter className="flex-row gap-3 mt-6">
            <AlertDialogCancel className="flex-1 h-12 rounded-2xl bg-muted hover:bg-muted/80 border-none font-bold text-foreground">
              닫기
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="flex-1 h-12 rounded-2xl bg-destructive hover:bg-destructive/90 font-bold text-white"
            >
              삭제하기
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </div>
    </div>
  );
}
