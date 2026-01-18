'use client';

import { Edit2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CategoryIcon } from '@/components/category/IconPicker';
import type { BudgetGoalWithCategory } from '@/hooks/useBudgetGoals';

interface BudgetGoalItemProps {
  goal: BudgetGoalWithCategory;
  onEdit: (category_id: string, amount: number) => void;
  onDelete: (id: string) => void;
}

export default function BudgetGoalItem({ goal, onEdit, onDelete }: BudgetGoalItemProps) {
  return (
    <div className="bg-card rounded-[20px] p-4 pr-2 shadow-sm ring-1 ring-black/5 dark:ring-white/5 flex justify-between items-center transition-all hover:shadow-md">
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 shrink-0">
          <CategoryIcon 
            iconName={goal.category?.icon || 'folder'} 
            className="h-full w-full" 
            variant="squircle" 
            showBackground={true} 
          />
        </div>
        <div className="flex flex-col">
          <div className="font-bold text-sm text-muted-foreground">{goal.category?.name || '삭제된 카테고리'}</div>
          <div className="font-extrabold text-lg text-foreground">{goal.amount.toLocaleString()}원</div>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-9 w-9 text-muted-foreground hover:text-primary rounded-full"
          onClick={() => goal.category_id && onEdit(goal.category_id, goal.amount)}
        >
          <Edit2 className="w-4 h-4" />
        </Button>
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-9 w-9 text-muted-foreground hover:text-destructive rounded-full"
          onClick={() => onDelete(goal.id)}
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
