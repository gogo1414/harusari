-- 스키마 드리프트 보정: 운영 DB에는 있으나 저장소 마이그레이션에 없던 categories.sort_order
-- (카테고리 드래그 정렬용, reorder_categories RPC가 사용). 새 환경을 마이그레이션만으로 재현할 수 있도록 추가.
alter table public.categories add column if not exists sort_order integer;
