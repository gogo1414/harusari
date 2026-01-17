import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { CategoryIcon } from '@/components/category/IconPicker';
import type { Category } from '@/types/database';

interface InstallmentCategorySelectProps {
  categoryId: string;
  categories: Category[];
  isCategoryOpen: boolean;
  setIsCategoryOpen: (isOpen: boolean) => void;
  onCategorySelect: (categoryId: string) => void;
}

export default function InstallmentCategorySelect({
  categoryId,
  categories,
  isCategoryOpen,
  setIsCategoryOpen,
  onCategorySelect,
}: InstallmentCategorySelectProps) {
  const currentCategory = categories.find(c => c.category_id === categoryId);

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-muted-foreground">카테고리</label>
      <button
          type="button"
          onClick={() => setIsCategoryOpen(true)}
          className="flex w-full items-center gap-3 rounded-2xl border bg-card px-4 py-3 text-left shadow-sm hover:bg-muted/50 transition-colors"
      >
          <CategoryIcon
              iconName={currentCategory?.icon || 'help_circle'}
              className="h-10 w-10 text-muted-foreground"
              showBackground={true}
          />
          <span className={cn("text-lg font-medium", !currentCategory && "text-muted-foreground")}>
              {currentCategory?.name || '카테고리 선택'}
          </span>
      </button>

      <Dialog open={isCategoryOpen} onOpenChange={setIsCategoryOpen}>
          <DialogContent className="sm:max-w-md rounded-2xl">
            <DialogHeader>
              <DialogTitle>카테고리 선택</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-4 gap-4 py-4">
               {categories.map((cat) => (
                 <button
                   key={cat.category_id}
                   onClick={() => onCategorySelect(cat.category_id)}
                   className="flex flex-col items-center gap-2"
                 >
                   <CategoryIcon 
                      iconName={cat.icon} 
                      className={cn(
                        "h-12 w-12 transition-all",
                        categoryId === cat.category_id ? "ring-2 ring-primary ring-offset-2 rounded-xl" : "opacity-70"
                      )}
                      variant="squircle"
                      showBackground
                   />
                   <span className={cn(
                     "text-xs truncate w-full text-center",
                     categoryId === cat.category_id ? "font-bold text-primary" : "text-muted-foreground"
                   )}>
                     {cat.name}
                   </span>
                 </button>
               ))}
            </div>
            <div className="flex justify-end">
               <DialogClose asChild>
                  <Button variant="ghost">닫기</Button>
               </DialogClose>
            </div>
          </DialogContent>
       </Dialog>
    </div>
  );
}
