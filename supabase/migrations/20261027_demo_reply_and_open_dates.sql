-- 데모 신청자 자동 회신 기록 + 데모 오픈데이트 (2026-10-27, 이미 DB에 적용됨)
alter table public.demo_requests add column if not exists replied_at timestamptz;

create table if not exists public.demo_open_dates (
  id uuid primary key default gen_random_uuid(),
  open_date date not null,
  slot text not null check (slot in ('am','pm1','pm2')),
  is_open boolean not null default true,
  note text,
  created_at timestamptz not null default now(),
  unique (open_date, slot)
);
alter table public.demo_open_dates enable row level security;
revoke all on public.demo_open_dates from anon, authenticated;
comment on table public.demo_open_dates is '데모 시연 가능 일정. is_open=false 로 바꾸면 회신 메일에서 빠짐. am=10~12시, pm1=13~15시, pm2=15~17시 (KST)';

-- 제안 일정(초안): 화·목 오전, 오후 1~3시. 대표님 확인 후 수정.
insert into public.demo_open_dates (open_date, slot, note)
select d::date, s, '초안 — 대표님 확인 필요'
from generate_series('2026-11-03'::date, '2026-11-26'::date, interval '1 day') d,
     lateral (values ('am'),('pm1')) v(s)
where extract(dow from d) in (2,4)
on conflict do nothing;
