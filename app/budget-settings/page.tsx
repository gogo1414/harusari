'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useBudgetGoals } from '@/hooks/useBudgetGoals';
import { useUserSettings } from '@/app/context/UserSettingsContext';
import { showToast } from '@/lib/toast';

import BudgetGoalItem from '@/components/budget/BudgetGoalItem';
import BudgetFormDialog from '@/components/budget/BudgetFormDialog';
import BudgetDeleteDialog from '@/components/budget/BudgetDeleteDialog';

export default function BudgetSettingsPage() {
  const router = useRouter();
  const { budgetGoals, upsertBudgetGoal, deleteBudgetGoal } = useBudgetGoals();
  const { categories } = useUserSettings();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  // 카테고리 예산 목록 (전체 예산 제외)
  const categoryBudgets = budgetGoals.filter(g => g.category_id !== null);

  const handleSubmit = () => {
    const val = parseInt(amount.replace(/,/g, ''), 10);
    if (isNaN(val) || val < 0) {
      showToast.error('유효한 금액을 입력해주세요');
      return;
    }

    if (!selectedCategory || selectedCategory === 'total') {
        showToast.error('카테고리를 선택해주세요');
        return;
    }
    
    upsertBudgetGoal(
        { category_id: selectedCategory, amount: val },
        {
            onSuccess: () => {
                showToast.success('예산이 저장되었습니다');
                setIsDialogOpen(false);
                setAmount('');
                setSelectedCategory('');
            },
            onError: () => {
                showToast.error('저장에 실패했습니다');
            }
        }
    );
  };

  const handleDeleteClick = (id: string) => {
    setDeleteTargetId(id);
    setIsDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (!deleteTargetId) return;

    deleteBudgetGoal(deleteTargetId, {
        onSuccess: () => {
            showToast.success('삭제되었습니다');
            setIsDeleteDialogOpen(false);
            setDeleteTargetId(null);
        },
        onError: () => {
            showToast.error('삭제 실패');
        },
    });
  };

  const openCreate = () => {
      setSelectedCategory('');
      setAmount('');
      setIsDialogOpen(true);
  };

  const openEdit = (categoryId: string, currentAmount: number) => {
      setSelectedCategory(categoryId);
      setAmount(currentAmount.toString());
      setIsDialogOpen(true);
  };

  return (
    <main className="flex min-h-dvh flex-col bg-background font-sans">
      {/* Header */}
      <header className="sticky top-0 z-30 flex items-center gap-3 bg-background/80 px-6 py-4 backdrop-blur-xl border-b border-black/5 dark:border-white/5">
        <Button
          variant="ghost"
          size="icon"
          className="-ml-2 h-10 w-10 rounded-full"
          onClick={() => router.back()}
        >
          <ChevronLeft className="h-6 w-6" />
        </Button>
        <h1 className="text-xl font-bold">월 목표 예산 설정</h1>
      </header>

      <div className="flex-1 p-6 space-y-6">
        
        {/* 설명 */}
        <div className="bg-muted/50 p-4 rounded-2xl text-sm text-muted-foreground leading-relaxed">
            <p>
                매월 얼마를 쓸지 목표를 정해보세요.<br/>
                카테고리별로 예산을 나누어 관리할 수 있습니다.
            </p>
        </div>

        {/* 카테고리별 예산 리스트 */}
        <section>
            <div className="flex items-center justify-between mb-3 px-1">
                <h2 className="text-sm font-bold text-muted-foreground">카테고리별 목표</h2>
                <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-8 text-primary hover:text-primary hover:bg-primary/10 -mr-2"
                    onClick={openCreate}
                >
                    <Plus className="w-4 h-4 mr-1" />
                    추가
                </Button>
            </div>

            <div className="space-y-3">
                {categoryBudgets.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground text-sm bg-muted/20 rounded-[24px] flex flex-col items-center gap-2">
                        <span>설정된 카테고리 목표가 없습니다.</span>
                        <Button 
                            variant="outline" 
                            size="sm"
                            className="rounded-full"
                            onClick={openCreate}
                        >
                            예산 추가하기
                        </Button>
                    </div>
                ) : (
                    categoryBudgets.map(goal => (
                        <BudgetGoalItem 
                            key={goal.id} 
                            goal={goal} 
                            onEdit={openEdit} 
                            onDelete={handleDeleteClick} 
                        />
                    ))
                )}
            </div>
        </section>
      </div>

      <BudgetFormDialog 
          open={isDialogOpen}
          onOpenChange={setIsDialogOpen}
          categories={categories}
          budgetGoals={budgetGoals}
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
          amount={amount}
          onChangeAmount={setAmount}
          onSubmit={handleSubmit}
      />

      <BudgetDeleteDialog 
          open={isDeleteDialogOpen}
          onOpenChange={setIsDeleteDialogOpen}
          onConfirm={handleConfirmDelete}
      />
    </main>
  );
}
