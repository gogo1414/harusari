'use client';

import { useState, useMemo, useRef } from 'react';
import { useBackOrHome } from '@/hooks/useBackOrHome';
import { ChevronLeft, Plus, Trash2, Edit2, Loader2, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
// import {
//   Dialog,
//   DialogContent,
//   DialogHeader,
//   DialogTitle,
//   DialogFooter,
//   DialogClose,
// } from '@/components/ui/dialog';
// import { Input } from '@/components/ui/input';
// import { Label } from '@/components/ui/label';
import { createClient } from '@/lib/supabase/client';
import type { Category } from '@/types/database';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { showToast } from '@/lib/toast';
import { CategoryIcon } from '@/components/category/IconPicker';
import CategoryFormDialog from '@/components/category/CategoryFormDialog';
import CategoryDeleteDialog from '@/components/category/CategoryDeleteDialog';

// dnd-kit imports
import {
  DndContext, 
  closestCenter,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// 정렬 가능한 카테고리 아이템 컴포넌트
function SortableCategoryItem({ 
  category, 
  onEdit, 
  onDelete 
}: { 
  category: Category; 
  onEdit: (category: Category) => void;
  onDelete: (id: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: category.category_id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 1 : 0,
    opacity: isDragging ? 0.8 : 1,
    scale: isDragging ? 1.05 : 1,
  };

  // 햅틱 피드백 (모바일)
  const handlePointerDown = (e: React.PointerEvent) => {
    // 편집/삭제 버튼은 드래그 트리거 방지
    if ((e.target as HTMLElement).closest('button')) {
      return;
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onPointerDown={handlePointerDown}
      className={`group flex items-center justify-between rounded-2xl border bg-card p-4 shadow-sm transition-all touch-manipulation relative
        ${isDragging 
          ? 'border-primary border-2 shadow-xl bg-card z-50 cursor-grabbing' 
          : 'border-border/50 hover:border-primary/20 hover:shadow-md cursor-grab active:cursor-grabbing'
        }`}
    >
      <div className="flex items-center gap-4 flex-1 pointer-events-none select-none">
        {/* 드래그 핸들 아이콘 (시각적 힌트로 유지하되 흐리게 처리) */}
        <div className="text-muted-foreground/30 px-1">
          <GripVertical className="h-5 w-5" />
        </div>

        <CategoryIcon
          iconName={category.icon}
          className="h-12 w-12 transition-transform group-hover:scale-105"
          variant="squircle"
          showBackground={true}
        />
        <span className="font-semibold text-foreground/90">{category.name}</span>
        {category.is_savings && (
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
            🏦 저축
          </span>
        )}
      </div>
      
      {/* 수정/삭제 버튼 */}
      {/* 
        onPointerDown 외부 전파 막기를 위해 stopPropagation 추가 
        dnd-kit의 activationConstraint가 동작하려면 이벤트가 센서에 도달해야 하므로 
        버튼 클릭 시엔 드래그가 시작되지 않도록 처리 필요
      */}
      <div className="flex gap-2" onPointerDown={(e) => e.stopPropagation()}>
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 active:scale-95 transition-all"
          onClick={() => onEdit(category)}
          aria-label={`${category.name} 수정`}
        >
          <Edit2 className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10 rounded-xl bg-destructive/10 text-destructive hover:bg-destructive/20 active:scale-95 transition-all"
          onClick={() => onDelete(category.category_id)}
          aria-label={`${category.name} 삭제`}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export default function CategoryManagementPage() {
  const goBack = useBackOrHome();
  const supabase = createClient();
  const queryClient = useQueryClient();
  
  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  // 삭제 확인 다이얼로그 상태 (native confirm 대체) + 사용 건수 안내
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);
  const [deleteUsage, setDeleteUsage] = useState<{ transactions: number; fixed: number } | null>(null);
  const [deleteUsageError, setDeleteUsageError] = useState(false);
  // 마지막으로 사용 건수를 요청한 카테고리 id (늦게 도착한 이전 응답 무시용)
  const usageRequestIdRef = useRef<string | null>(null);

  // 카테고리 데이터 불러오기
  const { data, isLoading } = useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  // 화면에 보여줄 카테고리 목록.
  // 순서 변경은 쿼리 캐시(['categories'])에 낙관적으로 반영하므로 별도 로컬 오버라이드 상태를 두지 않는다.
  // (로컬 상태를 두면 이후 추가/삭제/수정이 화면에 반영되지 않는 문제가 있었음)
  const orderedCategories = useMemo(() => {
    return data?.filter(c => c.type === type) || [];
  }, [data, type]);

  // Dnd-kit 센서 설정
  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 8, // 8px 드래그해야 활성화
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 200, // 200ms 길게 눌러야 활성화
        tolerance: 6,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // 순서 변경 Mutation
  // scope: 같은 scope의 mutation은 직렬 실행되어 연속 드래그 시 요청 순서가 뒤바뀌지 않는다.
  const reorderMutation = useMutation({
    mutationKey: ['category-reorder'],
    scope: { id: 'category-reorder' },
    mutationFn: async ({ newOrder }: { newOrder: Category[]; previous: Category[] | undefined }) => {
      // RPC 호환을 위해 필요한 데이터만 추려서 전송
      const payload = newOrder.map((cat, index) => ({
        category_id: cat.category_id,
        sort_order: index
      }));

      // @ts-expect-error - RPC types not generated yet
      const { error } = await supabase.rpc('reorder_categories', { 
        items: payload 
      });

      if (error) throw error;
    },
    onError: (_error, { previous }) => {
      showToast.error('순서 저장에 실패했습니다. 다시 시도해주세요.');
      // 뒤이은 순서 변경이 대기 중이 아니면 드래그 이전 상태로 롤백 (대기 중이면 onSettled 재조회로 서버 상태에 맞춘다)
      if (previous && queryClient.isMutating({ mutationKey: ['category-reorder'] }) <= 1) {
        queryClient.setQueryData<Category[]>(['categories'], previous);
      }
    },
    onSettled: async () => {
      // 마지막 순서 변경이 끝났을 때만 서버 상태로 동기화 (중간 재조회가 낙관적 순서를 덮어쓰지 않도록)
      if (queryClient.isMutating({ mutationKey: ['category-reorder'] }) <= 1) {
        await queryClient.invalidateQueries({ queryKey: ['categories'] });
      }
    },
  });

  // 추가 Mutation
  const addMutation = useMutation({
    mutationFn: async (newCategory: { name: string; icon: string; type: string; is_savings?: boolean }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // 현재 목록의 마지막 순서 + 1
      const maxSortOrder = orderedCategories.length > 0
        ? Math.max(...orderedCategories.map(c => c.sort_order || 0))
        : -1;

      const { error } = await supabase.from('categories').insert({
        user_id: user.id,
        name: newCategory.name,
        icon: newCategory.icon,
        type: newCategory.type as 'income' | 'expense',
        sort_order: maxSortOrder + 1,
        is_savings: newCategory.is_savings ?? false,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      showToast.success('카테고리가 추가되었습니다');
      setIsDialogOpen(false);
    },
    onError: (error) => {
      console.error(error);
      showToast.error('카테고리 추가에 실패했습니다');
    },
  });

  // 수정 Mutation
  const updateMutation = useMutation({
    mutationFn: async (category: { id: string; name: string; icon: string; is_savings?: boolean }) => {
      const { error } = await supabase
        .from('categories')
        // @ts-expect-error - 부분 업데이트 타입 불일치
        .update({ name: category.name, icon: category.icon, is_savings: category.is_savings ?? false })
        .eq('category_id', category.id);
      if (error) throw error;
    },
    onSuccess: () => {
      // 저축 여부 변경 시 통계/목록이 카테고리 기반 재분류되므로 함께 무효화
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['fixed_transactions'] });
      showToast.success('카테고리가 수정되었습니다');
      setIsDialogOpen(false);
    },
    onError: (error) => {
      console.error(error);
      showToast.error('카테고리 수정에 실패했습니다');
    },
  });

  // 삭제 Mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('categories')
        .delete()
        .eq('category_id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      // 삭제 시 관련 거래/고정내역이 '카테고리 없음'으로 바뀌므로 함께 무효화 (3-8)
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['fixed_transactions'] });
      showToast.success('카테고리가 삭제되었습니다');
    },
    onError: (error) => {
      console.error(error);
      showToast.error('카테고리 삭제에 실패했습니다');
    },
  });

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = orderedCategories.findIndex((item) => item.category_id === active.id);
      const newIndex = orderedCategories.findIndex((item) => item.category_id === over.id);
      
      if (oldIndex < 0 || newIndex < 0) return;

      const newOrder = arrayMove(orderedCategories, oldIndex, newIndex).map((cat, index) => ({
        ...cat,
        sort_order: index,
      }));

      // 진행 중인 조회가 낙관적 업데이트를 덮어쓰지 않도록 취소
      void queryClient.cancelQueries({ queryKey: ['categories'] });
      const previous = queryClient.getQueryData<Category[]>(['categories']);

      // 캐시에 즉시 반영 (드롭 직후 원래 위치로 튀는 현상 방지). 다른 타입(수입/지출)은 그대로 유지.
      const newOrderIds = new Set(newOrder.map((c) => c.category_id));
      queryClient.setQueryData<Category[]>(['categories'], (old) => [
        ...(old ?? []).filter((c) => !newOrderIds.has(c.category_id)),
        ...newOrder,
      ]);

      // 서버에 순서 업데이트 요청
      reorderMutation.mutate({ newOrder, previous });
    }
  };

  const openAddDialog = () => {
    setEditingCategory(null);
    setIsDialogOpen(true);
  };

  const openEditDialog = (category: Category) => {
    setEditingCategory(category);
    setIsDialogOpen(true);
  };


  // 삭제 요청: 확인 다이얼로그를 열고 사용 건수를 조회한다 (native confirm 대체)
  const handleDelete = (id: string) => {
    const target = data?.find((c) => c.category_id === id) || null;
    if (!target) return;
    setDeleteTarget(target);
    setDeleteUsage(null); // 조회 중 표시
    setDeleteUsageError(false);
    usageRequestIdRef.current = id;

    (async () => {
      try {
        const [txRes, fixedRes] = await Promise.all([
          supabase
            .from('transactions')
            .select('*', { count: 'exact', head: true })
            .eq('category_id', id),
          supabase
            .from('fixed_transactions')
            .select('*', { count: 'exact', head: true })
            .eq('category_id', id),
        ]);
        // 다른 카테고리로 다이얼로그가 바뀌었거나 닫힌 뒤 도착한 응답은 무시
        if (usageRequestIdRef.current !== id) return;
        if (txRes.error || fixedRes.error) throw txRes.error || fixedRes.error;
        setDeleteUsage({
          transactions: txRes.count ?? 0,
          fixed: fixedRes.count ?? 0,
        });
      } catch (error) {
        if (usageRequestIdRef.current !== id) return;
        console.error('Category usage count error:', error);
        setDeleteUsageError(true);
      }
    })();
  };

  const closeDeleteDialog = () => {
    usageRequestIdRef.current = null;
    setDeleteTarget(null);
    setDeleteUsage(null);
    setDeleteUsageError(false);
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    deleteMutation.mutate(deleteTarget.category_id);
    closeDeleteDialog();
  };

  const isSaving = addMutation.isPending || updateMutation.isPending;

  return (
    <div className="min-h-dvh bg-background p-4 pb-20">
      <div className="mb-6 flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={goBack} aria-label="뒤로 가기" className="-ml-2">
          <ChevronLeft className="h-6 w-6" />
        </Button>
        <h1 className="text-xl font-bold">카테고리 관리</h1>
      </div>

      <Tabs
        value={type}
        onValueChange={(v) => {
          setType(v as 'expense' | 'income');
        }}
        className="mb-6 w-full"
      >
        <TabsList className="grid w-full grid-cols-2 bg-muted/50 p-1">
          <TabsTrigger value="expense" className="rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-muted data-[state=active]:shadow-sm">지출</TabsTrigger>
          <TabsTrigger value="income" className="rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-muted data-[state=active]:shadow-sm">수입</TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <DndContext 
          sensors={sensors} 
          collisionDetection={closestCenter} 
          onDragEnd={handleDragEnd}
        >
          <SortableContext 
            items={orderedCategories.map(c => c.category_id)} 
            strategy={verticalListSortingStrategy}
          >
            <div className="grid grid-cols-1 gap-3">
              {orderedCategories.map((category) => (
                <SortableCategoryItem 
                  key={category.category_id} 
                  category={category} 
                  onEdit={openEditDialog}
                  onDelete={handleDelete}
                />
              ))}

              <button
                onClick={openAddDialog}
                className="group flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-muted-foreground/20 p-6 text-muted-foreground transition-all hover:border-primary/50 hover:bg-primary/5"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted-foreground/10 transition-colors group-hover:bg-primary/20">
                  <Plus className="h-5 w-5 group-hover:text-primary" />
                </div>
                <span className="font-medium group-hover:text-primary">새 카테고리 추가</span>
              </button>
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* 다이얼로그 */}
      <CategoryFormDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        editingCategory={editingCategory}
        type={type}
        onAdd={async (data) => await addMutation.mutateAsync(data)}
        onUpdate={async (data) => await updateMutation.mutateAsync(data)}
        isSaving={isSaving}
      />

      {/* 삭제 확인 다이얼로그 (사용 건수 안내 포함) */}
      <CategoryDeleteDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) closeDeleteDialog();
        }}
        onConfirm={confirmDelete}
        categoryName={deleteTarget?.name}
        usage={deleteUsage}
        usageError={deleteUsageError}
      />
    </div>
  );
}
