-- 하루살이 데이터베이스 스키마
-- Supabase SQL Editor에서 실행

-- 사용자 설정 테이블 (급여 사이클, 주 시작 요일)
CREATE TABLE IF NOT EXISTS user_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  cycle_start_day INTEGER DEFAULT 1 CHECK (cycle_start_day >= 1 AND cycle_start_day <= 31),
  week_start TEXT DEFAULT 'sunday' CHECK (week_start IN ('sunday', 'monday')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 카테고리 테이블
CREATE TABLE IF NOT EXISTS categories (
  category_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  type TEXT CHECK (type IN ('income', 'expense')) NOT NULL,
  icon TEXT NOT NULL,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 거래 내역 테이블
CREATE TABLE IF NOT EXISTS transactions (
  transaction_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  amount INTEGER NOT NULL CHECK (amount > 0),
  type TEXT CHECK (type IN ('income', 'expense')) NOT NULL,
  category_id UUID REFERENCES categories ON DELETE SET NULL,
  date DATE NOT NULL,
  memo TEXT,
  source_fixed_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 고정 지출/수입 테이블
CREATE TABLE IF NOT EXISTS fixed_transactions (
  fixed_transaction_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  amount INTEGER NOT NULL CHECK (amount > 0),
  type TEXT CHECK (type IN ('income', 'expense')) NOT NULL,
  day INTEGER CHECK (day >= 1 AND day <= 31) NOT NULL,
  category_id UUID REFERENCES categories ON DELETE SET NULL,
  memo TEXT,
  end_type TEXT CHECK (end_type IN ('never', 'date')) DEFAULT 'never',
  end_date DATE,
  last_generated DATE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON transactions(user_id, date);
CREATE INDEX IF NOT EXISTS idx_transactions_source ON transactions(source_fixed_id);
CREATE INDEX IF NOT EXISTS idx_categories_user ON categories(user_id);
CREATE INDEX IF NOT EXISTS idx_fixed_transactions_user ON fixed_transactions(user_id);

-- RLS 정책 활성화
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE fixed_transactions ENABLE ROW LEVEL SECURITY;

-- user_settings RLS
CREATE POLICY "user_settings_select" ON user_settings 
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "user_settings_insert" ON user_settings 
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_settings_update" ON user_settings 
  FOR UPDATE USING (auth.uid() = user_id);

-- categories RLS
CREATE POLICY "categories_select" ON categories 
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "categories_insert" ON categories 
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "categories_update" ON categories 
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "categories_delete" ON categories 
  FOR DELETE USING (auth.uid() = user_id);

-- transactions RLS
CREATE POLICY "transactions_select" ON transactions 
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "transactions_insert" ON transactions 
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "transactions_update" ON transactions 
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "transactions_delete" ON transactions 
  FOR DELETE USING (auth.uid() = user_id);

-- fixed_transactions RLS
CREATE POLICY "fixed_transactions_select" ON fixed_transactions 
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "fixed_transactions_insert" ON fixed_transactions 
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "fixed_transactions_update" ON fixed_transactions 
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "fixed_transactions_delete" ON fixed_transactions 
  FOR DELETE USING (auth.uid() = user_id);
-- fixed_transactions 테이블에 할부 관련 컬럼 추가
-- 이 스크립트를 Supabase SQL Editor에서 실행하세요.

-- 1. 컬럼 추가
ALTER TABLE fixed_transactions
ADD COLUMN IF NOT EXISTS is_installment boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS installment_principal integer,      -- 할부 원금
ADD COLUMN IF NOT EXISTS installment_months integer,         -- 할부 기간 (개월)
ADD COLUMN IF NOT EXISTS installment_rate numeric(5,2),      -- 연 이자율 (%)
ADD COLUMN IF NOT EXISTS installment_free_months integer DEFAULT 0, -- 무이자 개월 수
ADD COLUMN IF NOT EXISTS installment_current_month integer DEFAULT 1; -- 현재 회차 (몇 번째 달인지)

-- 2. 코멘트 추가 (선택 사항)
COMMENT ON COLUMN fixed_transactions.is_installment IS '할부 결제 여부';
COMMENT ON COLUMN fixed_transactions.installment_principal IS '할부 원금 총액';
COMMENT ON COLUMN fixed_transactions.installment_months IS '총 할부 개월 수';
COMMENT ON COLUMN fixed_transactions.installment_rate IS '할부 연 이자율 (%)';
COMMENT ON COLUMN fixed_transactions.installment_free_months IS '무이자 적용 개월 수';
COMMENT ON COLUMN fixed_transactions.installment_current_month IS '현재 납부 회차';

-- 푸시 알림 구독 테이블
-- 이 스크립트를 Supabase SQL Editor에서 실행하세요.
CREATE TABLE IF NOT EXISTS user_push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  subscription JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, subscription)
);

-- user_push_subscriptions RLS
ALTER TABLE user_push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_push_subscriptions_select" ON user_push_subscriptions 
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "user_push_subscriptions_insert" ON user_push_subscriptions 
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_push_subscriptions_delete" ON user_push_subscriptions 
  FOR DELETE USING (auth.uid() = user_id);
