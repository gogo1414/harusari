'use client';

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

interface RecurringDeleteDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  deleteRelated: boolean;
  onDeleteRelatedChange: (checked: boolean) => void;
}

export default function RecurringDeleteDialog({
  isOpen,
  onClose,
  onConfirm,
  deleteRelated,
  onDeleteRelatedChange
}: RecurringDeleteDialogProps) {
  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
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
            onCheckedChange={(checked) => onDeleteRelatedChange(checked as boolean)}
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
            onClick={onConfirm}
            className="flex-1 h-12 rounded-2xl bg-destructive hover:bg-destructive/90 font-bold text-white"
          >
            삭제하기
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
