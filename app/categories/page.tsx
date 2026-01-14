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
  const [categories, setCategories] = useState<Category[]>(dummyCategories);
  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

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
      setCategories((prev) =>
        prev.map((c) =>
          c.category_id === editingCategory.category_id
            ? { ...c, name, icon }
            : c
        )
      );
    } else {
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
    if (confirm('정말 삭제하시겠습니까?')) {
      setCategories((prev) => prev.filter((c) => c.category_id !== id));
    }
  };

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
        onValueChange={(v) => setType(v as 'expense' | 'income')}
        className="mb-6 w-full"
      >
        <TabsList className="grid w-full grid-cols-2 bg-muted/50 p-1">
          <TabsTrigger value="expense" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">지출</TabsTrigger>
          <TabsTrigger value="income" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">수입</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="grid grid-cols-1 gap-3">
        {filteredCategories.map((category) => (
          <div
            key={category.category_id}
            className="group flex items-center justify-between rounded-2xl border border-border/50 bg-card p-4 shadow-sm transition-all hover:border-primary/20 hover:shadow-md"
          >
            <div className="flex items-center gap-4">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted/50 text-2xl transition-transform group-hover:scale-110 group-hover:bg-primary/10">
                {category.icon}
              </span>
              <span className="font-semibold text-foreground/90">{category.name}</span>
            </div>
            <div className="flex gap-2 opacity-60 transition-opacity group-hover:opacity-100">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 hover:bg-muted"
                onClick={() => openEditDialog(category)}
              >
                <Edit2 className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:bg-destructive/10"
                onClick={() => handleDelete(category.category_id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
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

      {/* 다이얼로그 */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
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
                onClick={() => setIsEmojiPickerOpen(!isEmojiPickerOpen)}
                className="flex h-20 w-20 items-center justify-center rounded-3xl bg-muted text-5xl shadow-sm ring-offset-background transition-all hover:scale-105 hover:bg-muted/80 focus:ring-2 focus:ring-ring focus:ring-offset-2"
              >
                {icon}
              </button>
              
              {isEmojiPickerOpen && (
                <div className="absolute top-24 z-50 grid w-64 grid-cols-6 gap-2 rounded-xl border bg-popover p-3 shadow-xl animate-in fade-in zoom-in-95">
                  {EMOJI_LIST.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => {
                        setIcon(emoji);
                        setIsEmojiPickerOpen(false);
                      }}
                      className="flex h-9 w-9 items-center justify-center rounded-lg text-lg hover:bg-muted hover:scale-110 transition-transform"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}
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
              <Button variant="outline" className="h-12 w-full rounded-xl text-base">취소</Button>
            </DialogClose>
            <Button 
              onClick={handleSave} 
              disabled={!name}
              className="h-12 w-full rounded-xl text-base font-semibold"
            >
              저장하기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
