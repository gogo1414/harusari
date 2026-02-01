'use client';

import type { Database } from '@/types/database';

type CategoryInsert = Database['public']['Tables']['categories']['Insert'];

import { useState, useMemo, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
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
import IconPicker, { CategoryIcon } from '@/components/category/IconPicker';
import CategoryFormDialog from '@/components/category/CategoryFormDialog';

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
  const router = useRouter();
  const supabase = createClient();
  const queryClient = useQueryClient();
  
  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const isSubmittingRef = useRef(false);

  const [name, setName] = useState('');
  const [icon, setIcon] = useState('money');
  const [isIconPickerOpen, setIsIconPickerOpen] = useState(false);

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

  // 로컬 상태로 정렬 순서 관리 (optimistic updates 위함)
  // 서버 데이터와 로컬 오버라이드를 분리하여 파생 상태로 관리
  const [localOrder, setLocalOrder] = useState<Category[] | null>(null);

  const serverCategories = useMemo(() => {
    return data?.filter(c => c.type === type) || [];
  }, [data, type]);

  // 화면에 보여줄 카테고리 목록
  const orderedCategories = localOrder || serverCategories;



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
  const reorderMutation = useMutation({
    mutationFn: async (newOrder: Category[]) => {
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      // 낙관적 업데이트가 이미 화면에 반영되어 있으므로 토스트는 굳이 안 띄우거나 짧게 처리
    },
    onError: () => {
      showToast.error('순서 저장에 실패했습니다. 다시 시도해주세요.');
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      setLocalOrder(null); // 실패 시 원복
    },
  });

  // 추가 Mutation
  const addMutation = useMutation({
    mutationFn: async (newCategory: { name: string; icon: string; type: string }) => {
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      setIsDialogOpen(false);
    },
  });

  // 수정 Mutation
  const updateMutation = useMutation({
    mutationFn: async (category: { id: string; name: string; icon: string }) => {
      const { error } = await supabase
        .from('categories')
        // @ts-expect-error - 부분 업데이트 타입 불일치
        .update({ name: category.name, icon: category.icon })
        .eq('category_id', category.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      setIsDialogOpen(false);
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
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
  });

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = orderedCategories.findIndex((item) => item.category_id === active.id);
      const newIndex = orderedCategories.findIndex((item) => item.category_id === over.id);
      
      const newOrder = arrayMove(orderedCategories, oldIndex, newIndex);
      
      // 로컬 상태 즉시 업데이트
      setLocalOrder(newOrder);
      
      // 서버에 순서 업데이트 요청
      reorderMutation.mutate(newOrder);
    }
  };

  const openAddDialog = () => {
    setEditingCategory(null);
    setName('');
    setIcon('money');
    setIsDialogOpen(true);
  };

  const openEditDialog = (category: Category) => {
    setEditingCategory(category);
    setName(category.name);
    setIcon(category.icon);
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!name || isSubmittingRef.current) return;
    
    isSubmittingRef.current = true;
    try {
        if (editingCategory) {
          await updateMutation.mutateAsync({ id: editingCategory.category_id, name, icon });
        } else {
          await addMutation.mutateAsync({ name, icon, type });
        }
    } catch (e) {
        console.error(e);
    } finally {
        isSubmittingRef.current = false;
    }
  };

  const handleDelete = (id: string) => {
    if (confirm('정말 삭제하시겠습니까?')) {
      deleteMutation.mutate(id);
    }
  };

  const isSaving = addMutation.isPending || updateMutation.isPending;

  return (
    <div className="min-h-dvh bg-background p-4 pb-20">
      <div className="mb-6 flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="-ml-2">
          <ChevronLeft className="h-6 w-6" />
        </Button>
        <h1 className="text-xl font-bold">카테고리 관리</h1>
      </div>

      <Tabs
        value={type}
        onValueChange={(v) => {
          setType(v as 'expense' | 'income');
          setLocalOrder(null); // 탭 변경 시 정렬 순서 초기화
        }}
        className="mb-6 w-full"
      >
        <TabsList className="grid w-full grid-cols-2 bg-muted/50 p-1">
          <TabsTrigger value="expense" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">지출</TabsTrigger>
          <TabsTrigger value="income" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">수입</TabsTrigger>
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
    </div>
  );
}
