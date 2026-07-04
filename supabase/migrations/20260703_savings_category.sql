-- 기획안: 고정 지출에서 '저축' 분리 (C안 - 카테고리 속성)
-- categories에 is_savings 속성 추가. 저축 카테고리에 속한 지출 거래를 '저축'으로 분류.

-- 1. is_savings 컬럼 추가
alter table categories
  add column if not exists is_savings boolean not null default false;

-- 2. 기존 카테고리 중 이름에 저축/적금/투자/청약이 포함된 지출 카테고리를 저축으로 자동 표시
--    (마이그레이션 안내에서 자동 후보로 제시하던 것을 1회 반영)
update categories
set is_savings = true
where type = 'expense'
  and is_savings = false
  and (name like '%저축%' or name like '%적금%' or name like '%투자%' or name like '%청약%');
