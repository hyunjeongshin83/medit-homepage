-- 처리방침(3개월 뒤 자동 삭제)을 접수 함수 코드와 무관하게 DB에서 지킨다.
-- 접수 함수가 purge_after를 180일로 넣어도 demo·pilot은 3개월로 덮어쓴다. meeting(허브)은 그대로 둔다.
create or replace function public.demo_requests_purge_policy()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.kind in ('demo', 'pilot') then
    new.purge_after := now() + interval '3 months';
  end if;
  return new;
end;
$$;

revoke all on function public.demo_requests_purge_policy() from public, anon, authenticated;

create or replace trigger demo_requests_purge_policy
  before insert on public.demo_requests
  for each row execute function public.demo_requests_purge_policy();
