
-- 1. budget_goals 테이블 생성 (월 목표 예산 관리)
-- "if not exists"를 추가하여 이미 생성된 경우 에러 방지
create table if not exists public.budget_goals (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  category_id uuid references public.categories(category_id), -- NULL인 경우: '월 전체 목표 예산'을 의미
  amount integer not null default 0, -- 목표 금액
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  
  -- 유효성 검사: 한 유저는 카테고리별로 하나의 목표만 가질 수 있음 (NULL 포함)
  unique(user_id, category_id)
);

-- 2. 전체 목표 예산(category_id가 NULL인 경우)에 대한 중복 방지 인덱스
-- if not exists 구문이 인덱스에는 표준으로 없으므로, 충돌 시 무시하거나 확인 필요하지만
-- Supabase SQL 에러 발생 시 이 부분은 주석 처리하고 넘어가셔도 됩니다.
-- 일반적으로는 아래와 같이 작성합니다.
drop index if exists budget_goals_user_total_idx;
create unique index budget_goals_user_total_idx on public.budget_goals (user_id) where category_id is null;

-- 3. RLS(Row Level Security) 활성화
alter table public.budget_goals enable row level security;

-- 4. RLS 정책 설정
-- 기존 정책이 있을 수 있으므로 drop 후 create
drop policy if exists "Users can view their own budget goals" on public.budget_goals;
create policy "Users can view their own budget goals"
  on public.budget_goals for select
  using ( auth.uid() = user_id );

drop policy if exists "Users can insert their own budget goals" on public.budget_goals;
create policy "Users can insert their own budget goals"
  on public.budget_goals for insert
  with check ( auth.uid() = user_id );

drop policy if exists "Users can update their own budget goals" on public.budget_goals;
create policy "Users can update their own budget goals"
  on public.budget_goals for update
  using ( auth.uid() = user_id );

drop policy if exists "Users can delete their own budget goals" on public.budget_goals;
create policy "Users can delete their own budget goals"
  on public.budget_goals for delete
  using ( auth.uid() = user_id );

-- 5. 데이터 마이그레이션 생략
-- (monthly_budget 컬럼이 없으므로 데이터 이관 및 컬럼 삭제 로직을 제거했습니다)
