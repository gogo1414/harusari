'use client';

import { createClient } from '@/lib/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { BudgetGoal, Database } from '@/types/database';

export type BudgetGoalWithCategory = BudgetGoal & { category?: { name: string; icon: string; type: string } | null };
type BudgetGoalInsert = Database['public']['Tables']['budget_goals']['Insert'];

export function useBudgetGoals() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  // 1. 조회: 모든 목표 예산 가져오기
  const { data: budgetGoals = [], isLoading } = useQuery({
    queryKey: ['budget_goals'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('budget_goals')
        .select(`
          *,
          category:categories(name, icon, type)
        `)
        .eq('user_id', user.id)
        .order('category_id', { ascending: true, nullsFirst: true }); // 전체 예산(Null)이 먼저 오도록

      if (error) throw error;
      return data as BudgetGoalWithCategory[];
    },
  });
  // 2. 추가/수정 (Upsert)
  const upsertMutation = useMutation({
    mutationFn: async (goal: { category_id: string | null; amount: number }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const budgetGoal: BudgetGoalInsert = {
        user_id: user.id,
        category_id: goal.category_id,
        amount: goal.amount,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('budget_goals')
        .upsert(
            budgetGoal as any,
            { onConflict: 'user_id, category_id' }
        );
// ...

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budget_goals'] });
    },
  });

  // 3. 삭제
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('budget_goals')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budget_goals'] });
    },
  });

  return {
    budgetGoals,
    isLoading,
    upsertBudgetGoal: upsertMutation.mutate,
    deleteBudgetGoal: deleteMutation.mutate,
  };
}
