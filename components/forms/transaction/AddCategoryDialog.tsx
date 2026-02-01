'use client';

import { useState, useRef } from 'react';
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
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import IconPicker, { CategoryIcon } from '@/components/category/IconPicker';

interface AddCategoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: 'income' | 'expense';
  onAdd: (name: string, icon: string) => void;
  isPending: boolean;
}

export default function AddCategoryDialog({
  open,
  onOpenChange,
  type,
  onAdd,
  isPending,
}: AddCategoryDialogProps) {
  const [newCatName, setNewCatName] = useState('');
  const [newCatIcon, setNewCatIcon] = useState('money');
  const [isIconPickerOpen, setIsIconPickerOpen] = useState(false);
  const isSubmittingRef = useRef(false);

  const handleAdd = () => {
    if (!newCatName || isSubmittingRef.current) return;
    
    isSubmittingRef.current = true;
    // onAdd가 비동기가 아니더라도 호출자가 처리하는 동안 중복 호출 방지
    // 만약 onAdd가 promise를 반환하지 않는다면 이 패턴은 효과가 제한적일 수 있으나,
    // 현재 코드 컨맥락에서 mutation을 트리거하므로 안전장치로 동작
    try {
        onAdd(newCatName, newCatIcon);
    } finally {
        setTimeout(() => {
            isSubmittingRef.current = false;
        }, 1000); // UI 갱신 시간을 고려해 약간의 딜레이
    }
  };

  // Reset state when dialog opens (optional, but good for UX)
  // For simplicity, we just keep state here.

  return (
    <Dialog open={open} onOpenChange={(val) => {
        if (!val) {
           // Reset on close
           setNewCatName('');
           setNewCatIcon('money');
        }
        onOpenChange(val);
    }}>
      <DialogContent className="sm:max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-center text-lg font-bold">
            새 {type === 'income' ? '수입' : '지출'} 카테고리
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-6 py-6">
          <div className="flex flex-col items-center gap-4">
            <Label className="text-muted-foreground text-xs">아이콘을 선택하세요</Label>
            <button
              onClick={() => setIsIconPickerOpen(true)}
              className="transition-transform hover:scale-105 focus:outline-none"
            >
              <CategoryIcon 
                iconName={newCatIcon} 
                className="h-20 w-20 shadow-sm" 
                variant="squircle" 
                showBackground={true} 
              />
            </button>
            
            <IconPicker 
              isOpen={isIconPickerOpen}
              onClose={() => setIsIconPickerOpen(false)}
              onSelect={(newIcon) => setNewCatIcon(newIcon)}
              currentIcon={newCatIcon}
            />
          </div>

          <div className="space-y-3">
            <Label htmlFor="new-cat-name" className="text-muted-foreground text-xs">이름</Label>
            <Input
              id="new-cat-name"
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              placeholder="카테고리 이름"
              className="h-12 rounded-xl text-lg font-medium bg-muted/30 border-none"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <DialogClose asChild>
            <Button type="button" variant="outline" className="h-12 w-full rounded-xl text-base border-none bg-muted/50 hover:bg-muted">취소</Button>
          </DialogClose>
          <Button 
            onClick={handleAdd} 
            disabled={!newCatName || isPending}
            className="h-12 w-full rounded-xl text-base font-bold shadow-lg shadow-primary/20"
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : '추가하기'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
