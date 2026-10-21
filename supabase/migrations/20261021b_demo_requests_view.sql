-- 신청 목록 보기용 뷰. 대시보드 Table Editor에서 "신청_목록"을 열어 확인한다.
-- demo/pilot 신청만 보이고, 테스트 행(.invalid, qa-)과 허브(meeting) 행은 제외한다.
-- security_invoker + 권한 회수: anon/authenticated는 읽을 수 없다. 대시보드(service role)에서만 열린다.
create or replace view public."신청_목록"
with (security_invoker = true) as
select
  to_char(created_at at time zone 'Asia/Seoul', 'YYYY-MM-DD HH24:MI') as "접수시각",
  case kind when 'demo' then '데모' when 'pilot' then '시범 이용' else kind end as "유형",
  name           as "이름",
  org            as "소속",
  email          as "이메일",
  phone          as "전화",
  preferred_date as "희망일",
  preferred_slot as "시간대",
  message        as "문의",
  status         as "처리상태",
  case when notified_at is null then '아니오' else '예' end as "알림발송",
  to_char(purge_after at time zone 'Asia/Seoul', 'YYYY-MM-DD') as "삭제예정일",
  id
from public.demo_requests
where kind in ('demo','pilot')
  and email not like '%.invalid'
  and email not like 'qa-%'
order by created_at desc;

revoke all on public."신청_목록" from public, anon, authenticated;
