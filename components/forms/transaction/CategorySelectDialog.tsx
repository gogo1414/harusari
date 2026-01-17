'use client';

import { Check, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { CategoryIcon } from '@/components/category/IconPicker';
import type { Category } from '@/types/database';

interface CategorySelectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: Category[];
  selectedCategoryId: string | null;
  onSelect: (categoryId: string) => void;
  onAddNew: () => void;
}

export default function CategorySelectDialog({
  open,
  onOpenChange,
  categories,
  selectedCategoryId,
  onSelect,
  onAddNew,
}: CategorySelectDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-3xl max-h-[80vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle className="text-center text-lg font-bold">
            카테고리 선택
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-4 gap-x-2 gap-y-4">
            {categories.map((cat) => (
              <button
                key={cat.category_id}
                type="button"
                onClick={() => {
                  onSelect(cat.category_id);
                  onOpenChange(false);
                }}
                className="flex flex-col items-center gap-2 group"
              >
                <div className="relative transition-transform active:scale-95 duration-200">
                  <CategoryIcon
                    iconName={cat.icon}
                    className={cn(
                      "h-14 w-14 transition-all duration-300",
                      selectedCategoryId === cat.category_id
                        ? "ring-2 ring-primary ring-offset-2 ring-offset-background shadow-lg scale-105 opacity-100"
                        : "opacity-60 hover:opacity-100 active:opacity-100"
                    )}
                    variant="circle"
                    showBackground={true}
                  />
                  {selectedCategoryId === cat.category_id && (
                    <div className="absolute -right-0 -bottom-0 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-white shadow ring-2 ring-background animate-in zoom-in">
                      <Check className="h-3 w-3" strokeWidth={4} />
                    </div>
                  )}
                </div>
                <span className={cn(
                  "text-[12px] font-medium truncate w-full text-center transition-colors",
                  selectedCategoryId === cat.category_id ? "text-primary font-bold" : "text-muted-foreground"
                )}>
                  {cat.name}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="p-4 border-t bg-muted/30">
          <Button
            type="button"
            variant="outline"
            className="w-full h-12 rounded-2xl bg-background hover:bg-muted border-dashed border-2"
            onClick={onAddNew}
          >
            <Plus className="mr-2 h-4 w-4" />
            새 카테고리 추가
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
