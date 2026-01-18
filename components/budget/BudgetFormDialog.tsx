'use client';

import { useState } from 'react';
import { ChevronLeft, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CategoryIcon } from '@/components/category/IconPicker';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from '@/lib/utils';
import CategorySelectDialog from '@/components/forms/transaction/CategorySelectDialog';
import type { Category } from '@/types/database';
import type { BudgetGoalWithCategory } from '@/hooks/useBudgetGoals';
import { showToast } from '@/lib/toast';

interface BudgetFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: Category[];
  budgetGoals: BudgetGoalWithCategory[];
  selectedCategory: string;
  onSelectCategory: (id: string) => void;
  amount: string;
  onChangeAmount: (val: string) => void;
  onSubmit: () => void;
}

export default function BudgetFormDialog({
  open,
  onOpenChange,
  categories,
  budgetGoals,
  selectedCategory,
  onSelectCategory,
  amount,
  onChangeAmount,
  onSubmit
}: BudgetFormDialogProps) {
  const [isCategorySelectOpen, setIsCategorySelectOpen] = useState(false);

  // 현재 선택된 카테고리 객체
  const selectedCategoryObj = categories.find(c => c.category_id === selectedCategory);

  // 선택 가능한 카테고리 (이미 예산이 설정된 카테고리는 제외하되, 현재 선택된 본인은 포함 - 수정 시 필요)
  // 단, 이 목록은 CategorySelectDialog에 전달될 것이므로,
  // Dialog 내부에서 disable 처리가 되거나, 아예 목록에서 안보이게 처리.
  // 여기서는 '선택 가능 목록'을 전달하는 방식.
  // 수정 모드일 때(이미 값이 있을 때)는 본인을 포함해야 함.
  const availableCategories = categories.filter(c => 
     c.type === 'expense' && 
     (!budgetGoals.some(g => g.category_id === c.category_id) || selectedCategory === c.category_id)
  );

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="rounded-[32px] sm:max-w-md w-[90%] top-[40%] translate-y-[-50%] p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-center">목표 예산 설정</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6 py-2">
            
            {/* 카테고리 선택 버튼 */}
            <div className="space-y-2">
              <Label className="font-bold text-muted-foreground ml-1 text-xs">대상 카테고리</Label>
              <button
                type="button"
                onClick={() => setIsCategorySelectOpen(true)}
                className={cn(
                  "w-full flex items-center gap-4 rounded-2xl border p-4 transition-all outline-none",
                  selectedCategoryObj
                    ? "bg-card border-primary/30 shadow-sm ring-1 ring-primary/20"
                    : "bg-muted/30 border-transparent hover:bg-muted/50"
                )}
              >
                {selectedCategoryObj ? (
                  <>
                    <CategoryIcon
                      iconName={selectedCategoryObj.icon}
                      className="h-12 w-12"
                      variant="circle"
                      showBackground={true}
                    />
                    <span className="font-bold text-lg">{selectedCategoryObj.name}</span>
                  </>
                ) : (
                  <>
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                      <Plus className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <span className="text-muted-foreground font-medium">카테고리 선택</span>
                  </>
                )}
                <ChevronLeft className="ml-auto h-5 w-5 text-muted-foreground rotate-180" />
              </button>
            </div>

            {/* 금액 입력 */}
            <div className="space-y-2">
              <Label className="font-bold text-muted-foreground ml-1 text-xs">목표 금액</Label>
              <div className="relative">
                <Input 
                  type="number" 
                  placeholder="0" 
                  className="h-14 rounded-2xl text-xl font-bold pr-10 text-right bg-muted/30 border-transparent focus:bg-background focus:border-primary/30 active:scale-[0.99] transition-all"
                  value={amount}
                  onChange={(e) => onChangeAmount(e.target.value)}
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-muted-foreground">원</span>
              </div>
            </div>
          </div>

          <DialogFooter className="mt-2">
            <Button 
                onClick={onSubmit} 
                className="h-14 rounded-2xl w-full text-lg font-bold shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all active:scale-[0.98]"
            >
              저장하기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CategorySelectDialog
           open={isCategorySelectOpen}
           onOpenChange={setIsCategorySelectOpen}
           categories={availableCategories} 
           selectedCategoryId={selectedCategory}
           onSelect={(id) => {
               onSelectCategory(id);
               setIsCategorySelectOpen(false);
           }}
           onAddNew={() => {
               showToast.error("카테고리 추가는 '카테고리 관리' 메뉴를 이용해주세요.");
           }}
      />
    </>
  );
}
