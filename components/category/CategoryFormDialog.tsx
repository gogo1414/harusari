'use client';

import { useState, useRef, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import IconPicker, { CategoryIcon } from '@/components/category/IconPicker';
import type { Category } from '@/types/database';

interface CategoryFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingCategory: Category | null;
  type: 'income' | 'expense';
  onAdd: (data: { name: string; icon: string; type: string }) => Promise<void>;
  onUpdate: (data: { id: string; name: string; icon: string }) => Promise<void>;
  isSaving: boolean;
}

export default function CategoryFormDialog({
  open,
  onOpenChange,
  editingCategory,
  type,
  onAdd,
  onUpdate,
  isSaving
}: CategoryFormDialogProps) {
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('money');
  const [isIconPickerOpen, setIsIconPickerOpen] = useState(false);
  const isSubmittingRef = useRef(false);

  // 다이얼로그가 열리거나 editingCategory가 변경될 때 상태 초기화
  useEffect(() => {
    if (open) {
      if (editingCategory) {
        setName(editingCategory.name);
        setIcon(editingCategory.icon);
      } else {
        setName('');
        setIcon('money');
      }
    }
  }, [open, editingCategory]);

  const handleSave = async () => {
    if (!name || isSubmittingRef.current) return;
    
    isSubmittingRef.current = true;
    try {
        if (editingCategory) {
          await onUpdate({ id: editingCategory.category_id, name, icon });
        } else {
          await onAdd({ name, icon, type });
        }
    } catch (e) {
        console.error(e);
    } finally {
        isSubmittingRef.current = false;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center text-xl font-bold">
            {editingCategory ? '카테고리 수정' : '새 카테고리'}
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-6 py-6">
          <div className="flex flex-col items-center gap-4">
            <Label className="text-muted-foreground">아이콘</Label>
            <button
              onClick={() => setIsIconPickerOpen(true)}
              className="transition-transform hover:scale-105 focus:outline-none"
            >
              <CategoryIcon 
                iconName={icon} 
                className="h-24 w-24 shadow-sm" 
                variant="squircle" 
                showBackground={true} 
              />
            </button>
            
            <IconPicker 
              isOpen={isIconPickerOpen}
              onClose={() => setIsIconPickerOpen(false)}
              onSelect={(newIcon) => setIcon(newIcon)}
              currentIcon={icon}
            />
          </div>

          <div className="space-y-3">
            <Label htmlFor="name" className="text-muted-foreground">이름</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="카테고리 이름을 입력하세요"
              className="h-12 rounded-xl text-lg font-medium"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <DialogClose asChild>
            <Button type="button" variant="outline" className="h-12 w-full rounded-xl text-base">취소</Button>
          </DialogClose>
          <Button 
            onClick={handleSave} 
            disabled={!name || isSaving}
            className="h-12 w-full rounded-xl text-base font-semibold"
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : '저장하기'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
