import { cn } from '@/lib/utils';
import { ChevronLeft, Plus } from 'lucide-react';
import { CategoryIcon } from '@/components/category/IconPicker';
import type { Category } from '@/types/database';

interface TransactionCategorySelectProps {
  selectedCategory: Category | undefined;
  onClick: () => void;
}

export default function TransactionCategorySelect({
  selectedCategory,
  onClick,
}: TransactionCategorySelectProps) {
  return (
    <div>
      <label className="text-[13px] font-bold text-muted-foreground ml-1 mb-2 block">카테고리</label>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "w-full flex items-center gap-4 rounded-2xl border p-4 transition-all",
          selectedCategory
            ? "bg-card border-primary/30 shadow-sm"
            : "bg-muted/30 border-border hover:bg-muted/50"
        )}
      >
        {selectedCategory ? (
          <>
            <CategoryIcon
              iconName={selectedCategory.icon}
              className="h-12 w-12"
              variant="circle"
              showBackground={true}
            />
            <span className="font-bold text-lg">{selectedCategory.name}</span>
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
  );
}
