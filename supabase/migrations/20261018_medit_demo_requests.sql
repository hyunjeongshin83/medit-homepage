-- MedIT 홈페이지 데모 예약·시범 이용 신청 접수 테이블
-- RLS 활성 + 정책 없음 = anon/authenticated 직접 접근 차단. Edge Function(service_role)만 기록한다.
create table if not exists public.demo_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  kind text not null check (kind in ('demo','pilot')),
  name text not null check (char_length(name) between 1 and 60),
  org text check (org is null or char_length(org) <= 100),
  email text not null check (char_length(email) between 5 and 120),
  phone text check (phone is null or char_length(phone) <= 30),
  preferred_date date,
  preferred_slot text check (preferred_slot is null or char_length(preferred_slot) <= 40),
  message text check (message is null or char_length(message) <= 1000),
  consent_version text not null,
  consent_at timestamptz not null default now(),
  status text not null default 'new' check (status in ('new','contacted','scheduled','done','declined')),
  purge_after timestamptz not null default (now() + interval '3 months')
);

comment on table public.demo_requests is 'MedIT 홈페이지 데모 예약·약국 시범 이용 신청. service_role 전용. 수집 후 3개월 경과 시 매일 자동 삭제(purge_after).';

create index if not exists demo_requests_created_idx on public.demo_requests (created_at desc);
create index if not exists demo_requests_email_idx on public.demo_requests (lower(email), created_at desc);
create index if not exists demo_requests_purge_idx on public.demo_requests (purge_after);

alter table public.demo_requests enable row level security;
revoke all on public.demo_requests from anon, authenticated;

-- 보관기간이 지난 신청 정보를 매일 03:17(KST)에 삭제 (pg_cron 필요)
select cron.schedule(
  'purge-demo-requests',
  '17 18 * * *',
  $$delete from public.demo_requests where purge_after < now()$$
);
