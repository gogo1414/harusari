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

interface CategoryDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  categoryName?: string;
  // 이 카테고리를 참조하는 거래/고정내역 건수 (null이면 조회 중)
  usage: { transactions: number; fixed: number } | null;
}

export default function CategoryDeleteDialog({
  open,
  onOpenChange,
  onConfirm,
  categoryName,
  usage,
}: CategoryDeleteDialogProps) {
  const total = usage ? usage.transactions + usage.fixed : 0;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="rounded-3xl max-w-[320px] p-6">
        <AlertDialogHeader className="text-center">
          <AlertDialogTitle className="text-xl font-bold">
            {categoryName ? `'${categoryName}'을(를) 삭제할까요?` : '카테고리를 삭제할까요?'}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-muted-foreground mt-2">
            {usage === null
              ? '사용 내역을 확인하는 중이에요...'
              : total > 0
                ? `이 카테고리를 사용하는 거래 ${usage.transactions}건, 고정내역 ${usage.fixed}건이 있어요. 삭제하면 해당 내역은 '카테고리 없음'으로 남습니다.`
                : '사용 중인 내역이 없어 안전하게 삭제할 수 있어요.'}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-row gap-3 mt-6">
          <AlertDialogCancel className="flex-1 h-12 rounded-2xl bg-muted hover:bg-muted/80 border-none font-bold text-foreground">
            취소
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
            className="flex-1 h-12 rounded-2xl bg-destructive hover:bg-destructive/90 font-bold text-white shadow-none"
          >
            삭제하기
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
