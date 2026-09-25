-- 2026-09 개편 마이그레이션
-- 1) 고정/할부 자동 생성 엔진 재설계: start_date 도입, ON CONFLICT 가능한 유니크 인덱스
-- 2) 거래 위치 정보(지출 지도)
-- 3) 입력 출처(AI 빠른 입력) 기록
-- 4) RLS 성능(initplan)·중복 정책 정리, FK 인덱스, reorder_categories 보안 강화

-- =============================================================
-- 1-1. fixed_transactions.start_date
--   기존엔 시작일 개념이 없어 (a) 미래 시작 항목이 이번 달에 미리 생성되고
--   (b) 할부 회차를 카운터로만 추적해 회차 누락이 발생했다.
--   회차/생성 대상일은 start_date 기준으로 계산한다.
-- =============================================================
alter table fixed_transactions add column if not exists start_date date;

-- 할부: end_date = 시작일 + N개월 이므로 역산 후 결제일(day)을 말일 클램프
update fixed_transactions f
set start_date = make_date(
    extract(year from s.m)::int,
    extract(month from s.m)::int,
    least(f.day, extract(day from (s.m + interval '1 month' - interval '1 day'))::int)
  )
from (
  select fixed_transaction_id,
         date_trunc('month', end_date - make_interval(months => installment_months))::date as m
  from fixed_transactions
  where is_installment = true and end_date is not null and installment_months is not null
) s
where f.fixed_transaction_id = s.fixed_transaction_id
  and f.start_date is null;

-- 일반 고정: 최초 생성 거래일, 없으면 등록일(KST)
update fixed_transactions f
set start_date = coalesce(
  (select min(t.date) from transactions t where t.source_fixed_id = f.fixed_transaction_id),
  (f.created_at at time zone 'Asia/Seoul')::date
)
where f.start_date is null;

-- =============================================================
-- 1-2. (source_fixed_id, date) 유니크 인덱스를 부분 인덱스 → 일반 인덱스로 교체
--   PostgREST upsert(ON CONFLICT (source_fixed_id, date) DO NOTHING)는 WHERE 절이 있는
--   부분 인덱스를 추론하지 못한다. NULL은 서로 다른 값으로 취급되므로 수동 거래에는 영향 없음.
-- =============================================================
create unique index if not exists uq_transactions_source_fixed_date
  on transactions (source_fixed_id, date);
drop index if exists uq_transactions_source_date;

-- =============================================================
-- 2. 거래 위치 정보
-- =============================================================
alter table transactions add column if not exists place_name text;
alter table transactions add column if not exists place_address text;
alter table transactions add column if not exists latitude double precision;
alter table transactions add column if not exists longitude double precision;
alter table transactions add column if not exists country_code text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'transactions_lat_range') then
    alter table transactions add constraint transactions_lat_range
      check (latitude is null or (latitude between -90 and 90));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'transactions_lng_range') then
    alter table transactions add constraint transactions_lng_range
      check (longitude is null or (longitude between -180 and 180));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'transactions_latlng_pair') then
    -- 위도/경도는 둘 다 있거나 둘 다 없어야 한다
    alter table transactions add constraint transactions_latlng_pair
      check ((latitude is null) = (longitude is null));
  end if;
end $$;

-- 지도 조회용 (위치 있는 거래만)
create index if not exists idx_transactions_user_geo
  on transactions (user_id, date)
  where latitude is not null;

-- =============================================================
-- 3. 입력 출처 (manual / ai / recurring 등) — AI 입력 품질 추적용
-- =============================================================
alter table transactions add column if not exists input_source text;

-- =============================================================
-- 4-1. RLS: auth.uid()를 (select auth.uid())로 감싸 행마다 재평가하지 않도록 (initplan)
--       user_settings의 중복 정책 정리
-- =============================================================
drop policy if exists "Users can insert their own settings" on user_settings;
drop policy if exists "Users can view their own settings" on user_settings;
drop policy if exists "Users can update their own settings" on user_settings;

do $$
declare
  t text;
begin
  foreach t in array array['user_settings', 'categories', 'transactions', 'fixed_transactions', 'user_push_subscriptions']
  loop
    execute format('drop policy if exists %I on %I', t || '_select', t);
    execute format('drop policy if exists %I on %I', t || '_insert', t);
    execute format('drop policy if exists %I on %I', t || '_update', t);
    execute format('drop policy if exists %I on %I', t || '_delete', t);

    execute format('create policy %I on %I for select to authenticated using ((select auth.uid()) = user_id)', t || '_select', t);
    execute format('create policy %I on %I for insert to authenticated with check ((select auth.uid()) = user_id)', t || '_insert', t);
    execute format('create policy %I on %I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', t || '_update', t);
    execute format('create policy %I on %I for delete to authenticated using ((select auth.uid()) = user_id)', t || '_delete', t);
  end loop;
end $$;

drop policy if exists "Users can view their own budget goals" on budget_goals;
drop policy if exists "Users can insert their own budget goals" on budget_goals;
drop policy if exists "Users can update their own budget goals" on budget_goals;
drop policy if exists "Users can delete their own budget goals" on budget_goals;
drop policy if exists budget_goals_select on budget_goals;
drop policy if exists budget_goals_insert on budget_goals;
drop policy if exists budget_goals_update on budget_goals;
drop policy if exists budget_goals_delete on budget_goals;
create policy budget_goals_select on budget_goals for select to authenticated using ((select auth.uid()) = user_id);
create policy budget_goals_insert on budget_goals for insert to authenticated with check ((select auth.uid()) = user_id);
create policy budget_goals_update on budget_goals for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy budget_goals_delete on budget_goals for delete to authenticated using ((select auth.uid()) = user_id);

-- =============================================================
-- 4-2. FK 커버링 인덱스
-- =============================================================
create index if not exists idx_transactions_category on transactions (category_id);
create index if not exists idx_fixed_transactions_category on fixed_transactions (category_id);
create index if not exists idx_budget_goals_category on budget_goals (category_id);

-- =============================================================
-- 4-3. reorder_categories: search_path 고정 + anon 실행 권한 제거
-- =============================================================
create or replace function public.reorder_categories(items jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  item jsonb;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  for item in select * from jsonb_array_elements(items)
  loop
    update public.categories
    set sort_order = (item->>'sort_order')::int
    where category_id = (item->>'category_id')::uuid
      and user_id = auth.uid();
  end loop;
end;
$function$;

revoke execute on function public.reorder_categories(jsonb) from public, anon;
grant execute on function public.reorder_categories(jsonb) to authenticated;
