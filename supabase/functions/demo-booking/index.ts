// MedIT 예약 안내 페이지(medit-booking.html)용 함수
// - 신청자가 받은 비밀 주소(access_token)로 자기 신청을 보고, 일정을 고르고, 계약 상담 답변을 남긴다.
// - 공개 호출(verify_jwt=false). 대신 출처 제한, 토큰 확인, 입력 목록 검증, 활동 횟수 제한으로 막는다.
//   ※ verify_jwt 는 반드시 false 여야 한다. 배포 뒤엔 항상 토큰 없이 한 번 부르자.
// - DB 쓰기는 service_role 로만. demo_requests·demo_request_events 는 RLS 가 켜져 있고 정책이 없다.
// - 돌려주는 값에는 이메일·전화번호를 넣지 않는다 (이름, 소속, 일정, 상담 답변만).
// - 일정 후보의 기준은 demo_open_dates (운영자가 is_open 으로 열고 닫는다). 다른 신청이 이미 고른 시간은 뺀다.
// - 일정을 골라도 status 는 바꾸지 않는다. status 가 new 여야 접수 알림·자동 회신 작업이 돌기 때문이다.
import { createClient } from "npm:@supabase/supabase-js@2";

const ALLOWED_ORIGINS = ["https://hyunjeongshin83.github.io"];
const SLOTS: Record<string, string> = {
  am: "오전 (10~12시)",
  pm1: "오후 (1~3시)",
  pm2: "오후 (3~5시)",
};
const WRITTEN = "서면으로 먼저 협의";
const INTEREST = [
  "시범 이용(체험판)",
  "약사용 화면 정식 도입 검토",
  "약국 프로그램·POS 연동 협의",
  "제휴·공동 개발·기타 협력",
  "아직 잘 모르겠어요",
];
const ORG_TYPES = ["약국(개인)", "약국(체인·다점포)", "병원·의원", "약국 프로그램·POS 업체", "제약사·기관", "기타"];
const TIMINGS = ["바로 시작하고 싶어요", "1~3개월 안", "알아보는 중이에요"];
const CONCERNS = [
  "비용·계약 방식",
  "환자 개인정보 처리",
  "약사 책임 범위·검증 방식",
  "약국 프로그램 연동",
  "데이터 출처·저작권",
  "관련 법령·규제",
  "기타",
];
const CONSENT_VERSION = "2026-10-27.2"; // 개인정보 처리방침 전면 개정(수탁자·국외 이전·AI 보조 처리 고지)과 상담 동의 문구 2차
// 주민등록번호·외국인등록번호처럼 보이는 숫자는 받지 않는다 (개인정보 보호법 제24조의2)
const LOOKS_LIKE_ID_NUMBER = /(^|[^0-9])\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])[\s-]?[1-8]\d{6}($|[^0-9])/;
const MAX_EVENTS_PER_DAY = 40;
const LEAD_DAYS = 2; // 오늘로부터 이만큼 뒤부터 고를 수 있다 (자동 회신 작업과 같은 기준)

const clean = (v: unknown, max: number): string =>
  typeof v === "string"
    // deno-lint-ignore no-control-regex
    ? v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim().slice(0, max)
    : "";

const svc = () =>
  createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });

const kstToday = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
const addDays = (ymd: string, n: number) =>
  new Date(Date.parse(ymd + "T00:00:00Z") + n * 86400e3).toISOString().slice(0, 10);

// 목록에서 고른 값만 통과시킨다 (목록에 없는 값은 버린다)
const pickMany = (v: unknown, allowed: string[], max: number): string[] | null => {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const x of v.slice(0, max)) {
    if (typeof x !== "string" || !allowed.includes(x)) return null;
    if (!out.includes(x)) out.push(x);
  }
  return out;
};

Deno.serve(async (req) => {
  const origin = req.headers.get("origin") ?? "";
  const okOrigin = ALLOWED_ORIGINS.includes(origin);
  const cors = {
    "Access-Control-Allow-Origin": okOrigin ? origin : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
  const json = (b: unknown, status = 200) =>
    new Response(JSON.stringify(b), {
      status,
      headers: { ...cors, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
    });

  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return json({ ok: false, error: "method" }, 405);
  if (!okOrigin) return json({ ok: false, error: "origin" }, 403);

  const len = Number(req.headers.get("content-length") ?? "0");
  if (len > 8192) return json({ ok: false, error: "too_large" }, 413);

  let b: Record<string, unknown>;
  try {
    b = await req.json();
  } catch {
    return json({ ok: false, error: "json" }, 400);
  }

  const action = clean(b.action, 12);
  if (!["get", "pick", "consult"].includes(action)) return json({ ok: false, error: "invalid", field: "action" }, 400);

  const token = clean(b.token, 40);
  if (!/^[0-9a-f]{32}$/.test(token)) return json({ ok: false, error: "not_found" }, 404);

  try {
    const sb = svc();
    const { data: r, error: e1 } = await sb
      .from("demo_requests")
      .select("id, kind, name, org, status, preferred_date, preferred_slot, picked_date, picked_slot, consult, consult_at")
      .eq("access_token", token)
      .in("kind", ["demo", "pilot"])
      .maybeSingle();
    if (e1) throw e1;
    if (!r) return json({ ok: false, error: "not_found" }, 404);

    // 이 신청의 하루 활동 횟수 제한
    const since24 = new Date(Date.now() - 24 * 3600e3).toISOString();
    const minDate = addDays(kstToday(), LEAD_DAYS);

    // 지금 열려 있는 일정. 다른 신청이 이미 고른 시간은 뺀다.
    const loadOpen = async () => {
      const [open, taken] = await Promise.all([
        sb.from("demo_open_dates").select("open_date, slot").eq("is_open", true).gte("open_date", minDate)
          .order("open_date").order("slot").limit(120),
        sb.from("demo_requests").select("picked_date, picked_slot").not("picked_date", "is", null)
          .gte("picked_date", minDate).neq("status", "declined").neq("id", r.id)
          .not("email", "like", "%.invalid").not("email", "like", "qa-%") // 자동 점검 행은 일정을 막지 않는다
          .limit(500),
      ]);
      if (open.error) throw open.error;
      if (taken.error) throw taken.error;
      const takenSet = new Set((taken.data ?? []).map((t) => `${t.picked_date}|${t.picked_slot}`));
      return (open.data ?? [])
        .filter((o) => SLOTS[o.slot] && !takenSet.has(`${o.open_date}|${SLOTS[o.slot]}`))
        .map((o) => ({ date: o.open_date as string, slot: o.slot as string }));
    };

    if (action === "get") {
      const open = await loadOpen();
      return json({
        ok: true,
        request: {
          kind: r.kind,
          name: r.name,
          org: r.org,
          preferred_date: r.preferred_date,
          preferred_slot: r.preferred_slot,
          picked_date: r.picked_date,
          picked_slot: r.picked_slot,
          consult: r.consult,
          consult_at: r.consult_at,
        },
        open,
        slots: SLOTS,
      });
    }

    const { count, error: e2 } = await sb
      .from("demo_request_events")
      .select("id", { count: "exact", head: true })
      .eq("request_id", r.id)
      .gte("created_at", since24);
    if (e2) throw e2;
    if ((count ?? 0) >= MAX_EVENTS_PER_DAY) return json({ ok: false, error: "rate_limited" }, 429);

    const logEvent = async (kind: "pick" | "consult", data: unknown) => {
      const { error } = await sb.from("demo_request_events").insert({ request_id: r.id, kind, data });
      if (error) throw error;
    };

    if (action === "pick") {
      const slotKey = clean(b.slot, 10);
      if (slotKey === "written") {
        const { error } = await sb.from("demo_requests")
          .update({ picked_date: null, picked_slot: WRITTEN, picked_at: new Date().toISOString() }).eq("id", r.id);
        if (error) throw error;
        await logEvent("pick", { slot: WRITTEN });
        return json({ ok: true, picked: { date: null, slot: "written", label: WRITTEN } });
      }
      const date = clean(b.date, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !SLOTS[slotKey]) {
        return json({ ok: false, error: "invalid", field: "slot" }, 400);
      }
      const open = await loadOpen();
      if (!open.some((o) => o.date === date && o.slot === slotKey)) {
        // 그새 다른 분이 고르셨거나 닫힌 일정 — 새 목록을 같이 보낸다
        return json({ ok: false, error: "unavailable", open }, 409);
      }
      const { error } = await sb.from("demo_requests")
        .update({ picked_date: date, picked_slot: SLOTS[slotKey], picked_at: new Date().toISOString() }).eq("id", r.id);
      if (error) throw error;
      await logEvent("pick", { date, slot: SLOTS[slotKey] });
      return json({ ok: true, picked: { date, slot: slotKey, label: SLOTS[slotKey] } });
    }

    // action === "consult"
    // 상담 답변은 처음 신청 때 받은 항목 밖의 정보라서, 개인정보 처리방침 안내와 함께 별도 동의를 받는다
    if (b.consent !== true) return json({ ok: false, error: "invalid", field: "consent" }, 400);
    const a = (typeof b.answers === "object" && b.answers) ? b.answers as Record<string, unknown> : {};
    const interest = pickMany(a.interest, INTEREST, 5);
    const concerns = pickMany(a.concerns, CONCERNS, 7);
    if (interest === null) return json({ ok: false, error: "invalid", field: "interest" }, 400);
    if (concerns === null) return json({ ok: false, error: "invalid", field: "concerns" }, 400);
    if (interest.length < 1) return json({ ok: false, error: "invalid", field: "interest" }, 400);

    const orgType = clean(a.org_type, 40);
    if (orgType && !ORG_TYPES.includes(orgType)) return json({ ok: false, error: "invalid", field: "org_type" }, 400);
    const timing = clean(a.timing, 40);
    if (timing && !TIMINGS.includes(timing)) return json({ ok: false, error: "invalid", field: "timing" }, 400);
    const program = clean(a.program, 60);
    const notes = clean(a.notes, 600);
    if (LOOKS_LIKE_ID_NUMBER.test(notes) || LOOKS_LIKE_ID_NUMBER.test(program)) {
      return json({ ok: false, error: "sensitive" }, 400);
    }

    const consult = {
      interest,
      org_type: orgType || null,
      program: program || null,
      timing: timing || null,
      concerns,
      notes: notes || null,
      consent_version: CONSENT_VERSION,
    };
    const { error } = await sb.from("demo_requests")
      .update({ consult, consult_at: new Date().toISOString() }).eq("id", r.id);
    if (error) throw error;
    await logEvent("consult", { interest });
    return json({ ok: true });
  } catch (e) {
    console.error("demo-booking failed", e instanceof Error ? e.message : e);
    return json({ ok: false, error: "server" }, 500);
  }
});
