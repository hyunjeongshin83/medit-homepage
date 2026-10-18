-- 알림 작업(2시간마다)이 이미 알린 신청을 건너뛰기 위한 컬럼
alter table public.demo_requests add column if not exists notified_at timestamptz;
comment on column public.demo_requests.notified_at is '대표 알림(카카오톡)을 보낸 시각. null이면 아직 알리지 않음.';
create index if not exists demo_requests_unnotified_idx on public.demo_requests (created_at) where notified_at is null;
