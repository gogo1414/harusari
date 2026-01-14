'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Plus, Trash2, Edit2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { createClient } from '@/lib/supabase/client';
import type { Category } from '@/types/database';

// 자주 사용하는 이모지 목록
const EMOJI_LIST = [
  '🍔', '☕', '🍺', '🚌', '🚕', '🏠', '📱', '🛒', '👕', '🎮',
  '💊', '📚', '💰', '💼', '💵', '🎁', '✈️', '🐶', '👶', '❤️',
  '🏋️', '🎬', '🥐', '🚗', '⛽', '🎉', '💡', '🔧', '🏦', '💳'
];

// 더미 데이터 (임시)
const dummyCategories: Category[] = [
  { category_id: '1', name: '식비', icon: '🍔', type: 'expense', user_id: '1', created_at: '' },
  { category_id: '2', name: '교통', icon: '🚌', type: 'expense', user_id: '1', created_at: '' },
  { category_id: '3', name: '카페', icon: '☕', type: 'expense', user_id: '1', created_at: '' },
  { category_id: '4', name: '월급', icon: '💼', type: 'income', user_id: '1', created_at: '' },
];

export default function CategoryManagementPage() {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>(dummyCategories); // TODO: 실제 DB 연동 시 제거
  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  // 폼 상태
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('💰');
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);

  const filteredCategories = categories.filter((c) => c.type === type);

  const openAddDialog = () => {
    setEditingCategory(null);
    setName('');
    setIcon('💰');
    setIsDialogOpen(true);
  };

  const openEditDialog = (category: Category) => {
    setEditingCategory(category);
    setName(category.name);
    setIcon(category.icon);
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!name) return;

    if (editingCategory) {
      // 수정
      setCategories((prev) =>
        prev.map((c) =>
          c.category_id === editingCategory.category_id
            ? { ...c, name, icon }
            : c
        )
      );
    } else {
      // 추가
      setCategories((prev) => [
        ...prev,
        {
          category_id: Math.random().toString(),
          name,
          icon,
          type,
          user_id: '1',
          created_at: new Date().toISOString(),
        },
      ]);
    }
    setIsDialogOpen(false);
  };

  const handleDelete = (id: string) => {
    if (confirm('정말 삭제하시겠습니까? 관련 내역의 카테고리가 비워집니다.')) {
      setCategories((prev) => prev.filter((c) => c.category_id !== id));
    }
  };

  return (
    <div className="min-h-dvh bg-background p-4 pb-20">
      {/* 헤더 */}
      <div className="mb-6 flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ChevronLeft className="h-6 w-6" />
        </Button>
        <h1 className="text-lg font-bold">카테고리 관리</h1>
        <div className="w-10" />
      </div>

      {/* 탭 */}
      <Tabs
        value={type}
        onValueChange={(v) => setType(v as 'expense' | 'income')}
        className="mb-6 w-full"
      >
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="expense">지출</TabsTrigger>
          <TabsTrigger value="income">수입</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* 카테고리 목록 */}
      <div className="grid grid-cols-1 gap-2">
        {filteredCategories.map((category) => (
          <div
            key={category.category_id}
            className="flex items-center justify-between rounded-xl border border-border bg-card p-3 shadow-sm transition-colors hover:bg-muted/50"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-xl">
                {category.icon}
              </span>
              <span className="font-medium">{category.name}</span>
            </div>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => openEditDialog(category)}
              >
                <Edit2 className="h-4 w-4 text-muted-foreground" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleDelete(category.category_id)}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </div>
        ))}

        {/* 추가 버튼 */}
        <button
          onClick={openAddDialog}
          className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-muted-foreground/30 p-4 text-muted-foreground transition-colors hover:bg-muted/30"
        >
          <Plus className="h-5 w-5" />
          <span>새 카테고리 추가</span>
        </button>
      </div>

      {/* 추가/수정 다이얼로그 */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingCategory ? '카테고리 수정' : '새 카테고리 추가'}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="flex flex-col items-center gap-2">
              <Label>아이콘</Label>
              <button
                onClick={() => setIsEmojiPickerOpen(!isEmojiPickerOpen)}
                className="flex h-16 w-16 items-center justify-center rounded-full bg-muted text-4xl shadow-sm ring-offset-background transition-all hover:bg-muted/80 focus:ring-2 focus:ring-ring focus:ring-offset-2"
              >
                {icon}
              </button>
              
              {isEmojiPickerOpen && (
                <div className="grid grid-cols-6 gap-2 rounded-lg border bg-popover p-2 shadow-md">
                  {EMOJI_LIST.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => {
                        setIcon(emoji);
                        setIsEmojiPickerOpen(false);
                      }}
                      className="flex h-8 w-8 items-center justify-center rounded hover:bg-muted"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">이름</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="예: 식비"
              />
            </div>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">취소</Button>
            </DialogClose>
            <Button onClick={handleSave} disabled={!name}>
              저장
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
