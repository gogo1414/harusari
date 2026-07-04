-- 개선 보고서 대응: 데이터 정합성 + 보안 마이그레이션
-- 대상: 2-4(RLS), 3-1/3-2/3-12(멱등성), source_fixed_id FK, budget_goals ON DELETE, categories 중복

-- =============================================================
-- 1. user_push_subscriptions: UPDATE RLS 정책 부재로 upsert의 UPDATE 경로가 42501로 실패
--    (재구독 500 에러) → UPDATE 정책 추가
-- =============================================================
drop policy if exists "user_push_subscriptions_update" on user_push_subscriptions;
create policy "user_push_subscriptions_update" on user_push_subscriptions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- =============================================================
-- 2. transactions 멱등성: (source_fixed_id, date) UNIQUE
--    cron/백필 중복 생성(3-1, 3-2, 3-12)을 DB 레벨에서 차단
-- =============================================================

-- 2-1. 기존 중복 제거 (가장 먼저 생성된 행만 유지)
delete from transactions t
using transactions dup
where t.source_fixed_id is not null
  and t.source_fixed_id = dup.source_fixed_id
  and t.date = dup.date
  and (t.created_at, t.transaction_id) > (dup.created_at, dup.transaction_id);

-- 2-2. 부분 유니크 인덱스 (source_fixed_id가 있는 자동 생성 거래만 대상)
create unique index if not exists uq_transactions_source_date
  on transactions (source_fixed_id, date)
  where source_fixed_id is not null;

-- =============================================================
-- 3. transactions.source_fixed_id 외래키 부재 → dangling 참조 방치
--    FK 추가 (ON DELETE SET NULL)
-- =============================================================

-- 3-1. dangling 참조 정리
update transactions
set source_fixed_id = null
where source_fixed_id is not null
  and source_fixed_id not in (select fixed_transaction_id from fixed_transactions);

-- 3-2. FK 추가 (이미 있으면 skip)
do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'transactions_source_fixed_fk'
  ) then
    alter table transactions
      add constraint transactions_source_fixed_fk
      foreign key (source_fixed_id)
      references fixed_transactions(fixed_transaction_id)
      on delete set null;
  end if;
end $$;

-- =============================================================
-- 4. budget_goals.category_id FK에 ON DELETE 절 부재
--    → 예산이 걸린 카테고리 삭제가 FK 위반으로 실패 (조용한 실패, 3-8)
--    ON DELETE CASCADE로 재정의 (카테고리 삭제 시 해당 예산 목표도 제거)
-- =============================================================
do $$
declare
  fk_name text;
begin
  select tc.constraint_name into fk_name
  from information_schema.table_constraints tc
  join information_schema.key_column_usage kcu
    on tc.constraint_name = kcu.constraint_name
  where tc.table_name = 'budget_goals'
    and tc.constraint_type = 'FOREIGN KEY'
    and kcu.column_name = 'category_id'
  limit 1;

  if fk_name is not null then
    execute format('alter table budget_goals drop constraint %I', fk_name);
  end if;

  alter table budget_goals
    add constraint budget_goals_category_id_fkey
    foreign key (category_id)
    references categories(category_id)
    on delete cascade;
end $$;

-- =============================================================
-- 5. 기본 카테고리 자동 생성 경쟁 → (user_id, name, type) 중복 (3-12)
--    중복 정리 후 유니크 인덱스 추가
-- =============================================================

-- 5-1. 유지할 대표 카테고리 매핑 (user_id, name, type별 최초 생성 건)
create temporary table _cat_dedup on commit drop as
select
  c.category_id,
  first_value(c.category_id) over (
    partition by c.user_id, c.name, c.type
    order by c.created_at, c.category_id
  ) as keep_id
from categories c;

-- 5-2. 중복 카테고리를 참조하는 데이터를 대표 카테고리로 이전
update transactions t
set category_id = d.keep_id
from _cat_dedup d
where t.category_id = d.category_id and d.category_id <> d.keep_id;

update fixed_transactions f
set category_id = d.keep_id
from _cat_dedup d
where f.category_id = d.category_id and d.category_id <> d.keep_id;

-- budget_goals는 (user_id, category_id) UNIQUE라 이전 시 충돌 가능 → 충돌 건은 삭제
delete from budget_goals b
using _cat_dedup d
where b.category_id = d.category_id
  and d.category_id <> d.keep_id
  and exists (
    select 1 from budget_goals b2
    where b2.user_id = b.user_id and b2.category_id = d.keep_id
  );

update budget_goals b
set category_id = d.keep_id
from _cat_dedup d
where b.category_id = d.category_id and d.category_id <> d.keep_id;

-- 5-3. 중복 카테고리 삭제
delete from categories c
using _cat_dedup d
where c.category_id = d.category_id and d.category_id <> d.keep_id;

-- 5-4. 유니크 인덱스
create unique index if not exists uq_categories_user_name_type
  on categories (user_id, name, type);
