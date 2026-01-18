// Supabase 데이터베이스 타입 정의
// Supabase CLI로 자동 생성된 타입으로 교체 가능: npx supabase gen types typescript

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      user_settings: {
        Row: {
          user_id: string;
          cycle_start_day: number;
          week_start: 'sunday' | 'monday';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          cycle_start_day?: number;
          week_start?: 'sunday' | 'monday';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          cycle_start_day?: number;
          week_start?: 'sunday' | 'monday';
          updated_at?: string;
        };
      };
      categories: {
        Row: {
          category_id: string;
          user_id: string;
          name: string;
          type: 'income' | 'expense';
          icon: string;
          is_default: boolean;
          created_at: string;
        };
        Insert: {
          category_id?: string;
          user_id: string;
          name: string;
          type: 'income' | 'expense';
          icon: string;
          is_default?: boolean;
          created_at?: string;
        };
        Update: {
          name?: string;
          type?: 'income' | 'expense';
          icon?: string;
          is_default?: boolean;
        };
      };
      transactions: {
        Row: {
          transaction_id: string;
          user_id: string;
          amount: number;
          type: 'income' | 'expense';
          category_id: string | null;
          date: string;
          memo: string | null;
          source_fixed_id: string | null;
          created_at: string;
        };
        Insert: {
          transaction_id?: string;
          user_id: string;
          amount: number;
          type: 'income' | 'expense';
          category_id?: string | null;
          date: string;
          memo?: string | null;
          source_fixed_id?: string | null;
          created_at?: string;
        };
        Update: {
          amount?: number;
          type?: 'income' | 'expense';
          category_id?: string | null;
          date?: string;
          memo?: string | null;
        };
      };
      fixed_transactions: {
        Row: {
          fixed_transaction_id: string;
          user_id: string;
          amount: number;
          type: 'income' | 'expense';
          day: number;
          category_id: string | null;
          memo: string | null;
          end_type: 'never' | 'date';
          end_date: string | null;
          last_generated: string | null;
          is_active: boolean;
          created_at: string;
          // 할부 관련 필드
          is_installment: boolean;
          installment_principal: number | null;
          installment_months: number | null;
          installment_rate: number | null;
          installment_free_months: number | null;
          installment_current_month: number | null;
        };
        Insert: {
          fixed_transaction_id?: string;
          user_id: string;
          amount: number;
          type: 'income' | 'expense';
          day: number;
          category_id?: string | null;
          memo?: string | null;
          end_type?: 'never' | 'date';
          end_date?: string | null;
          last_generated?: string | null;
          is_active?: boolean;
          created_at?: string;
          // 할부 관련 필드
          is_installment?: boolean;
          installment_principal?: number | null;
          installment_months?: number | null;
          installment_rate?: number | null;
          installment_free_months?: number | null;
          installment_current_month?: number | null;
        };
        Update: {
          amount?: number;
          type?: 'income' | 'expense';
          day?: number;
          category_id?: string | null;
          memo?: string | null;
          end_type?: 'never' | 'date';
          end_date?: string | null;
          last_generated?: string | null;
          is_active?: boolean;
          // 할부 관련 필드
          is_installment?: boolean;
          installment_principal?: number | null;
          installment_months?: number | null;
          installment_rate?: number | null;
          installment_free_months?: number | null;
          installment_current_month?: number | null;
        };
      };
      user_push_subscriptions: {
        Row: {
          id: string;
          user_id: string;
          subscription: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          subscription: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          subscription?: Json;
          updated_at?: string;
        };
      };
    };
  };
}

// 편의를 위한 타입 별칭
export type UserSettings = Database['public']['Tables']['user_settings']['Row'];
export type Category = Database['public']['Tables']['categories']['Row'];
export type Transaction = Database['public']['Tables']['transactions']['Row'];
export type FixedTransaction = Database['public']['Tables']['fixed_transactions']['Row'];
