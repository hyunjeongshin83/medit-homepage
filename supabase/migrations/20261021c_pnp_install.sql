-- PnP 설치 시리얼 · 진행 기록
-- 목적: 약국에 "설치 시리얼"을 발급하고(DB에 해시만 저장), 설치 프로그램이 단계별 진행 상황을 보고하도록 한다.
-- 원칙
--  1) 시리얼 원문은 저장하지 않는다. 발급 때 한 번만 보여 준다.
--  2) 진행 보고(detail)에는 이름·건수·해시처럼 허용된 키만 남기고 나머지는 버린다. 환자 정보는 받지 않는다.
--  3) license_verified(약사 면허 확인)가 true가 되기 전에는 시리얼을 쓸 수 없다.
--  4) agreement_confirmed(업체 협약·약사 동의·개인정보 검토 완료)가 true가 되기 전에는 샘플 전용이다.
--  5) RLS 켬 + 정책 없음 + 권한 회수. Edge Function(service_role)과 대시보드만 접근한다.

create table if not exists public.pnp_install_serials (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  serial_hash text not null unique,
  serial_hint text not null check (char_length(serial_hint) = 4),
  pharmacy_label text not null check (char_length(pharmacy_label) between 1 and 60),
  delivery text not null default 'serial' check (delivery in ('serial','link','llm')),
  license_verified boolean not null default false,
  agreement_confirmed boolean not null default false,
  status text not null default 'issued' check (status in ('issued','claimed','mapping','approved','verified','revoked')),
  redeem_count int not null default 0,
  max_redeems int not null default 10 check (max_redeems between 1 and 100),
  expires_at timestamptz not null,
  claimed_at timestamptz,
  last_seen_at timestamptz,
  approved_at timestamptz,
  mapping_hash text check (mapping_hash is null or mapping_hash ~ '^[0-9a-f]{64}$'),
  note text check (note is null or char_length(note) <= 200)
);
comment on table public.pnp_install_serials is 'PnP 설치 시리얼. 해시만 저장. service_role·대시보드 전용. 만료 90일 뒤 자동 삭제.';
comment on column public.pnp_install_serials.pharmacy_label is '약국 표시명. 환자·개인 정보를 넣지 않는다.';
comment on column public.pnp_install_serials.license_verified is '약사 면허를 확인했으면 true. 대시보드에서 직접 켠다.';
comment on column public.pnp_install_serials.agreement_confirmed is '업체 협약·약사 동의·개인정보 검토가 끝났으면 true. 켜기 전에는 샘플 전용.';

create table if not exists public.pnp_install_events (
  id bigint generated always as identity primary key,
  serial_id uuid not null references public.pnp_install_serials(id) on delete cascade,
  created_at timestamptz not null default now(),
  step text not null check (step in ('redeem','detect','schema','mapping','approve','verify','error')),
  ok boolean not null,
  detail jsonb not null default '{}'::jsonb check (pg_column_size(detail) <= 2048)
);
create index if not exists pnp_install_events_serial_idx on public.pnp_install_events (serial_id, created_at);

-- 잘못된 시리얼 입력 횟수 제한용(IP 해시만 보관, 2일 뒤 삭제)
create table if not exists public.pnp_install_failures (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  ip_hash text not null check (char_length(ip_hash) between 8 and 64)
);
create index if not exists pnp_install_failures_idx on public.pnp_install_failures (ip_hash, created_at);

alter table public.pnp_install_serials enable row level security;
alter table public.pnp_install_events enable row level security;
alter table public.pnp_install_failures enable row level security;
revoke all on public.pnp_install_serials, public.pnp_install_events, public.pnp_install_failures from anon, authenticated;

-- 시리얼 입력 정규화: 대문자·구분 기호 제거 후 MEDIT-XXXX-XXXX-XXXX 꼴로 맞춘다. 형식이 아니면 null.
create or replace function public.pnp_normalize_serial(p text)
returns text language sql immutable set search_path = '' as $$
  select case when length(r) = 17 and left(r, 5) = 'MEDIT'
              then 'MEDIT-' || substr(r, 6, 4) || '-' || substr(r, 10, 4) || '-' || substr(r, 14, 4)
              else null end
  from (select upper(regexp_replace(coalesce(p, ''), '[^A-Za-z0-9]', '', 'g')) as r) t
$$;

-- 시리얼 발급(관리자 전용). 원문은 반환값으로 한 번만 나온다.
-- 사용 예: select public.pnp_issue_serial('○○약국', 'serial', 14);
create or replace function public.pnp_issue_serial(
  p_label text,
  p_delivery text default 'serial',
  p_days int default 14,
  p_license boolean default false,
  p_agreement boolean default false,
  p_note text default null
) returns text
language plpgsql security definer set search_path = '' as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';  -- 0/O/1/I 제외, 32자
  bytes bytea;
  raw text := '';
  s text;
  i int;
begin
  if p_label is null or char_length(btrim(p_label)) not between 1 and 60 then
    raise exception 'pharmacy_label은 1~60자여야 합니다';
  end if;
  if p_delivery not in ('serial','link','llm') then
    raise exception 'delivery는 serial, link, llm 중 하나';
  end if;
  if p_days is null or p_days not between 1 and 90 then
    raise exception 'days는 1~90';
  end if;
  bytes := extensions.gen_random_bytes(12);
  for i in 0..11 loop
    raw := raw || substr(alphabet, (get_byte(bytes, i) % 32) + 1, 1);   -- 256 % 32 = 0 이라 편향 없음
  end loop;
  s := 'MEDIT-' || substr(raw, 1, 4) || '-' || substr(raw, 5, 4) || '-' || substr(raw, 9, 4);
  insert into public.pnp_install_serials
    (serial_hash, serial_hint, pharmacy_label, delivery, license_verified, agreement_confirmed, expires_at, note)
  values
    (encode(extensions.digest(s, 'sha256'), 'hex'), substr(raw, 9, 4), btrim(p_label), p_delivery,
     coalesce(p_license, false), coalesce(p_agreement, false), now() + make_interval(days => p_days), p_note);
  return s;
end $$;

-- 보고 내용 정리: 단계별로 허용된 키와 형식만 남기고 나머지는 버린다.
create or replace function public.pnp_clean_detail(p_step text, p jsonb)
returns jsonb language plpgsql immutable set search_path = '' as $$
declare
  o jsonb := '{}'::jsonb;
  arr jsonb;
  n numeric;
begin
  if p is null or jsonb_typeof(p) <> 'object' then return o; end if;

  if p_step = 'detect' then
    if jsonb_typeof(p->'programs') = 'array' then
      select coalesce(jsonb_agg(to_jsonb(e)), '[]'::jsonb) into arr
      from (select e from jsonb_array_elements_text(p->'programs') e where char_length(e) between 1 and 40 limit 5) q;
      o := o || jsonb_build_object('programs', arr);
    end if;
    if jsonb_typeof(p->'dsn_count') = 'number' then
      o := o || jsonb_build_object('dsn_count', least(greatest((p->>'dsn_count')::numeric, 0), 200)::int);
    end if;
    if jsonb_typeof(p->'os') = 'string' and char_length(p->>'os') <= 20 then
      o := o || jsonb_build_object('os', p->>'os');
    end if;

  elsif p_step = 'schema' then
    if jsonb_typeof(p->'tables') = 'number' then
      o := o || jsonb_build_object('tables', least(greatest((p->>'tables')::numeric, 0), 100000)::int);
    end if;
    if jsonb_typeof(p->'columns') = 'number' then
      o := o || jsonb_build_object('columns', least(greatest((p->>'columns')::numeric, 0), 1000000)::int);
    end if;
    if jsonb_typeof(p->'engine') = 'string' and (p->>'engine') ~ '^[a-z0-9_.-]{1,20}$' then
      o := o || jsonb_build_object('engine', p->>'engine');
    end if;
    if jsonb_typeof(p->'sample') = 'boolean' then
      o := o || jsonb_build_object('sample', (p->>'sample')::boolean);
    end if;

  elsif p_step in ('mapping','verify') then
    if jsonb_typeof(p->'fields') = 'array' then
      select coalesce(jsonb_agg(to_jsonb(e)), '[]'::jsonb) into arr
      from (select e from jsonb_array_elements_text(p->'fields') e where e ~ '^[a-z_]{1,30}$' limit 12) q;
      o := o || jsonb_build_object('fields', arr);
    end if;
    if p_step = 'mapping' then
      if jsonb_typeof(p->'coverage') = 'number' then
        n := least(greatest((p->>'coverage')::numeric, 0), 1);
        o := o || jsonb_build_object('coverage', round(n, 2));
      end if;
      if jsonb_typeof(p->'mapping_hash') = 'string' and (p->>'mapping_hash') ~ '^[0-9a-f]{64}$' then
        o := o || jsonb_build_object('mapping_hash', p->>'mapping_hash');
      end if;
    else
      if jsonb_typeof(p->'sample_rows') = 'number' then
        o := o || jsonb_build_object('sample_rows', least(greatest((p->>'sample_rows')::numeric, 0), 1000)::int);
      end if;
    end if;

  elsif p_step = 'approve' then
    if jsonb_typeof(p->'mapping_hash') = 'string' and (p->>'mapping_hash') ~ '^[0-9a-f]{64}$' then
      o := o || jsonb_build_object('mapping_hash', p->>'mapping_hash');
    end if;

  elsif p_step = 'error' then
    if jsonb_typeof(p->'code') = 'string' and (p->>'code') ~ '^[a-z0-9_]{1,40}$' then
      o := o || jsonb_build_object('code', p->>'code');
    end if;
  end if;

  return o;
end $$;

-- 시리얼 확인. p_consume=false 이면 사용 횟수를 올리지 않는다(웹 페이지의 확인용).
create or replace function public.pnp_redeem(p_serial text, p_consume boolean default true)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  s text := public.pnp_normalize_serial(p_serial);
  r public.pnp_install_serials;
begin
  if s is null then return jsonb_build_object('ok', false, 'error', 'invalid'); end if;

  select * into r from public.pnp_install_serials
   where serial_hash = encode(extensions.digest(s, 'sha256'), 'hex')
   for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'invalid'); end if;
  if r.status = 'revoked' then return jsonb_build_object('ok', false, 'error', 'revoked'); end if;
  if r.expires_at < now() then return jsonb_build_object('ok', false, 'error', 'expired'); end if;
  if not r.license_verified then return jsonb_build_object('ok', false, 'error', 'license_pending'); end if;

  if p_consume then
    if r.redeem_count >= r.max_redeems then return jsonb_build_object('ok', false, 'error', 'limit'); end if;
    update public.pnp_install_serials
       set redeem_count = redeem_count + 1,
           last_seen_at = now(),
           claimed_at = coalesce(claimed_at, now()),
           status = case when status = 'issued' then 'claimed' else status end
     where id = r.id
     returning * into r;
    insert into public.pnp_install_events (serial_id, step, ok, detail) values (r.id, 'redeem', true, '{}'::jsonb);
  else
    update public.pnp_install_serials set last_seen_at = now() where id = r.id;
  end if;

  return jsonb_build_object(
    'ok', true,
    'pharmacy_label', r.pharmacy_label,
    'serial_hint', r.serial_hint,
    'delivery', r.delivery,
    'mode', case when r.agreement_confirmed then 'live-ready' else 'sample-only' end,
    'status', r.status,
    'expires_at', r.expires_at,
    'redeems_left', greatest(r.max_redeems - r.redeem_count, 0)
  );
end $$;

-- 단계 보고. 허용된 키만 저장하고, 상태 전이 순서를 지킨다.
create or replace function public.pnp_report(p_serial text, p_step text, p_ok boolean, p_detail jsonb default '{}'::jsonb)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  s text := public.pnp_normalize_serial(p_serial);
  r public.pnp_install_serials;
  d jsonb;
  h text;
  new_status text;
begin
  if s is null then return jsonb_build_object('ok', false, 'error', 'invalid'); end if;
  if p_step is null or p_step not in ('detect','schema','mapping','approve','verify','error') then
    return jsonb_build_object('ok', false, 'error', 'step');
  end if;

  select * into r from public.pnp_install_serials
   where serial_hash = encode(extensions.digest(s, 'sha256'), 'hex')
   for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'invalid'); end if;
  if r.status = 'revoked' then return jsonb_build_object('ok', false, 'error', 'revoked'); end if;
  if r.expires_at < now() then return jsonb_build_object('ok', false, 'error', 'expired'); end if;
  if not r.license_verified then return jsonb_build_object('ok', false, 'error', 'license_pending'); end if;
  if r.status = 'issued' then return jsonb_build_object('ok', false, 'error', 'not_redeemed'); end if;

  d := public.pnp_clean_detail(p_step, p_detail);
  new_status := r.status;

  if p_ok then
    if p_step = 'mapping' then
      h := d->>'mapping_hash';
      if h is null then return jsonb_build_object('ok', false, 'error', 'mapping_hash'); end if;
      update public.pnp_install_serials
         set mapping_hash = h, approved_at = null, status = 'mapping', last_seen_at = now()
       where id = r.id;
      new_status := 'mapping';
    elsif p_step = 'approve' then
      h := d->>'mapping_hash';
      if r.mapping_hash is null or h is distinct from r.mapping_hash then
        return jsonb_build_object('ok', false, 'error', 'hash_mismatch');
      end if;
      update public.pnp_install_serials
         set status = 'approved', approved_at = now(), last_seen_at = now()
       where id = r.id;
      new_status := 'approved';
    elsif p_step = 'verify' then
      if r.status not in ('approved','verified') then
        return jsonb_build_object('ok', false, 'error', 'not_approved');
      end if;
      update public.pnp_install_serials set status = 'verified', last_seen_at = now() where id = r.id;
      new_status := 'verified';
    else
      update public.pnp_install_serials set last_seen_at = now() where id = r.id;
    end if;
  else
    update public.pnp_install_serials set last_seen_at = now() where id = r.id;
  end if;

  insert into public.pnp_install_events (serial_id, step, ok, detail) values (r.id, p_step, coalesce(p_ok, false), d);
  return jsonb_build_object('ok', true, 'status', new_status);
end $$;

-- 함수 실행 권한: service_role(Edge Function)만. 대시보드 SQL 편집기(postgres)는 소유자라 그대로 쓸 수 있다.
revoke all on function public.pnp_normalize_serial(text) from public, anon, authenticated;
revoke all on function public.pnp_issue_serial(text, text, int, boolean, boolean, text) from public, anon, authenticated;
revoke all on function public.pnp_clean_detail(text, jsonb) from public, anon, authenticated;
revoke all on function public.pnp_redeem(text, boolean) from public, anon, authenticated;
revoke all on function public.pnp_report(text, text, boolean, jsonb) from public, anon, authenticated;
grant execute on function public.pnp_normalize_serial(text) to service_role;
grant execute on function public.pnp_issue_serial(text, text, int, boolean, boolean, text) to service_role;
grant execute on function public.pnp_clean_detail(text, jsonb) to service_role;
grant execute on function public.pnp_redeem(text, boolean) to service_role;
grant execute on function public.pnp_report(text, text, boolean, jsonb) to service_role;

-- 대시보드에서 보기 쉬운 뷰 (읽기 전용). 면허·협약 확인 칸은 pnp_install_serials 표에서 직접 켠다.
create or replace view public."설치_시리얼_목록"
with (security_invoker = true) as
select
  to_char(created_at at time zone 'Asia/Seoul', 'YYYY-MM-DD HH24:MI') as "발급시각",
  pharmacy_label as "약국",
  'MEDIT-····-····-' || serial_hint as "시리얼(끝 4자리)",
  case delivery when 'serial' then '시리얼' when 'link' then '링크' when 'llm' then 'Claude(LLM)' end as "전달방식",
  case when license_verified then '확인' else '대기' end as "면허확인",
  case when agreement_confirmed then '완료(실연동 가능)' else '미완료(샘플 전용)' end as "협약·동의·검토",
  case status when 'issued' then '발급' when 'claimed' then '사용 시작' when 'mapping' then '매핑 초안'
              when 'approved' then '약사 승인' when 'verified' then '설정 완료' when 'revoked' then '폐기' end as "진행",
  redeem_count || '/' || max_redeems as "사용횟수",
  to_char(expires_at at time zone 'Asia/Seoul', 'YYYY-MM-DD') as "만료일",
  to_char(last_seen_at at time zone 'Asia/Seoul', 'YYYY-MM-DD HH24:MI') as "최근접속",
  id
from public.pnp_install_serials
order by created_at desc;

create or replace view public."설치_진행_기록"
with (security_invoker = true) as
select
  to_char(e.created_at at time zone 'Asia/Seoul', 'YYYY-MM-DD HH24:MI:SS') as "시각",
  s.pharmacy_label as "약국",
  case e.step when 'redeem' then '시리얼 확인' when 'detect' then '프로그램 확인' when 'schema' then '구조 확인'
              when 'mapping' then '매핑 초안' when 'approve' then '약사 승인' when 'verify' then '샘플 검증'
              when 'error' then '오류' end as "단계",
  case when e.ok then '성공' else '실패' end as "결과",
  e.detail as "내용"
from public.pnp_install_events e
join public.pnp_install_serials s on s.id = e.serial_id
order by e.created_at desc;

revoke all on public."설치_시리얼_목록", public."설치_진행_기록" from public, anon, authenticated;

-- 보관: 만료 90일 뒤 시리얼(과 기록)을 삭제, 실패 기록은 2일 뒤 삭제. 매일 03:27(KST).
select cron.schedule(
  'purge-pnp-install',
  '27 18 * * *',
  $$
    delete from public.pnp_install_serials where expires_at < now() - interval '90 days';
    delete from public.pnp_install_failures where created_at < now() - interval '2 days';
  $$
);
