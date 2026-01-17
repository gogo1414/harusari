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

interface HomeDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

export default function HomeDeleteDialog({ open, onOpenChange, onConfirm }: HomeDeleteDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="rounded-3xl max-w-[320px] p-6">
        <AlertDialogHeader className="text-center">
          <AlertDialogTitle className="text-xl font-bold">이 내역을 삭제할까요?</AlertDialogTitle>
          <AlertDialogDescription className="text-muted-foreground mt-2">
            삭제한 내역은 다시 복구할 수 없어요
          </AlertDialogDescription>
        </AlertDialogHeader>
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
