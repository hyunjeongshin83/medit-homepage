// MedIT 홈페이지 데모 예약 · 약국 시범 이용 신청 · 캠퍼스타운 허브 미팅 예약 접수 함수
// - 공개 호출(verify_jwt=false). 대신 출처 제한, 입력 검증, 허니팟, 접수 횟수 제한으로 막는다.
//   ※ verify_jwt 는 반드시 false 여야 한다 — 로그인 없는 바깥 분이 신청하는 길이다.
//   (2026-10-21) 배포 도구가 이 값을 true 로 되돌리는 사고가 있었다. 배포 뒤엔 항상 토큰 없이 한 번 부르자.
// - DB 쓰기는 service_role 로만 한다. 이 키는 Supabase가 함수 안에 자동 주입하며 브라우저로 나가지 않는다.
// - (2026-10-21) 미팅 예약(kind=meeting) 추가. 운영자가 앱 안에서 신청을 보고 처리 표시를 할 수 있도록
//   list·mark 두 갈래를 더했다. 그 둘은 로그인 토큰을 요구하고, hub_members 명부에 있는 사람만 통과한다.
//   demo_requests 는 RLS 가 켜져 있고 정책이 없어 브라우저에서는 못 읽는다 — 그래서 함수를 통한다.
// - (2026-10-21 v3) 두 가지를 고쳤다.
//   (1) demo_requests_kind_check 가 demo·pilot 만 허용해 meeting 저장이 500 으로 떨어지고 있었다.
//       제약을 늘려 고쳤다 (마이그레이션 demo_requests_allow_meeting_kind).
//       접수 거절 경로만 점검했기 때문에 못 잡았다 — 이제 실제로 들어가는지도 점검한다.
//   (2) 그 점검이 6시간마다 행을 남긴다. 운영자 목록에서는 QA_EMAIL 행을 빼고,
//       모든 행에 purge_after 를 넣어 나중에 지울 수 있게 했다.
// - (2026-10-27 v5) 데모·시범 신청이 저장되면 그 신청의 예약 안내 페이지용 비밀 주소(token)를 함께 돌려준다.
//   페이지와 일정·상담 저장은 demo-booking 함수가 맡는다. 그 밖의 동작은 v4 와 같다.
import { createClient } from "npm:@supabase/supabase-js@2";

const ALLOWED_ORIGINS = ["https://hyunjeongshin83.github.io"];
const CONSENT_VERSION = "2026-10-18";
// 자동 점검이 쓰는 주소. 이 주소로 들어온 신청은 운영자 목록에 보이지 않는다.
// .invalid 는 어디에도 닿지 않는 예약된 도메인이라 실제 사람의 주소와 겹치지 않는다.
const QA_EMAIL = "qa-auto@campustownhub.invalid";
const PURGE_DAYS = 180;
const SLOTS: Record<string, string> = {
  am: "오전 (10~12시)",
  pm1: "오후 (1~3시)",
  pm2: "오후 (3~5시)",
  written: "서면으로 먼저 협의",
};
const MAX_PER_EMAIL_PER_DAY = 3;
const MAX_PER_HOUR_TOTAL = 40;
const MIN_FILL_MS = 1500;

const clean = (v: unknown, max: number): string =>
  typeof v === "string"
    // deno-lint-ignore no-control-regex
    ? v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim().slice(0, max)
    : "";

const svc = () =>
  createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });

// 명부에 있는 사람인지 — 신청 내용에는 바깥 분의 이름·연락처가 들어 있어 아무나 보면 안 된다
async function member(req: Request): Promise<{ ok: boolean; uid?: string }> {
  const token = req.headers.get("x-user-token") || "";
  if (!token) return { ok: false };
  const anon = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    auth: { persistSession: false },
  });
  const { data, error } = await anon.auth.getUser(token);
  if (error || !data?.user) return { ok: false };
  const { data: row } = await svc().from("hub_members").select("uid").eq("uid", data.user.id).maybeSingle();
  return row ? { ok: true, uid: data.user.id } : { ok: false };
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin") ?? "";
  const okOrigin = ALLOWED_ORIGINS.includes(origin);
  const cors = {
    "Access-Control-Allow-Origin": okOrigin ? origin : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type, x-user-token",
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

  // ── 운영자용: 신청 목록 보기 ─────────────────────────────────
  if (b.action === "list") {
    const m = await member(req);
    if (!m.ok) return json({ ok: false, error: "forbidden" }, 403);
    const { data, error } = await svc()
      .from("demo_requests")
      .select("id, created_at, kind, name, org, email, phone, preferred_date, preferred_slot, message, status")
      .eq("kind", "meeting")
      .neq("email", QA_EMAIL)          // 자동 점검이 남긴 행은 운영자 눈에 띄지 않게
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) return json({ ok: false, error: "server" }, 500);
    return json({ ok: true, items: data ?? [] });
  }

  // ── 운영자용: 처리 표시 ──────────────────────────────────────
  if (b.action === "mark") {
    const m = await member(req);
    if (!m.ok) return json({ ok: false, error: "forbidden" }, 403);
    const id = clean(b.id, 40);
    const status = b.status === "done" ? "done" : b.status === "declined" ? "declined" : "";
    if (!id || !status) return json({ ok: false, error: "invalid" }, 400);
    const { error } = await svc().from("demo_requests").update({ status }).eq("id", id).eq("kind", "meeting");
    if (error) return json({ ok: false, error: "server" }, 500);
    return json({ ok: true });
  }

  // ── 바깥 분의 신청 접수 ──────────────────────────────────────
  // 허니팟: 사람 눈에 보이지 않는 칸에 값이 있으면 봇. 저장하지 않고 성공처럼 응답한다.
  if (clean(b.website, 200)) return json({ ok: true });

  const elapsed = Number(b.elapsed_ms);
  if (!Number.isFinite(elapsed) || elapsed < MIN_FILL_MS) return json({ ok: false, error: "too_fast" }, 429);

  const kind = b.kind === "pilot" ? "pilot" : b.kind === "demo" ? "demo" : b.kind === "meeting" ? "meeting" : "";
  if (!kind) return json({ ok: false, error: "invalid", field: "kind" }, 400);

  const name = clean(b.name, 60);
  if (!name) return json({ ok: false, error: "invalid", field: "name" }, 400);

  const email = clean(b.email, 120).toLowerCase();
  if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/.test(email)) {
    return json({ ok: false, error: "invalid", field: "email" }, 400);
  }

  const org = clean(b.org, 100) || null;
  if (kind === "pilot" && !org) return json({ ok: false, error: "invalid", field: "org" }, 400);
  if (kind === "meeting" && !org) return json({ ok: false, error: "invalid", field: "org" }, 400);

  const phoneRaw = clean(b.phone, 30);
  if (phoneRaw && !/^[0-9+\-() ]{8,20}$/.test(phoneRaw)) {
    return json({ ok: false, error: "invalid", field: "phone" }, 400);
  }
  const phone = phoneRaw || null;

  // 희망 날짜: 오늘(한국 시간)부터 90일 이내
  let preferred_date: string | null = null;
  const d = clean(b.preferred_date, 10);
  if (d) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
    const t = m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : NaN;
    const kstToday = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
    const t0 = Date.parse(kstToday + "T00:00:00Z");
    const ok = m && !Number.isNaN(t) && new Date(t).toISOString().slice(0, 10) === d &&
      t >= t0 && t <= t0 + 90 * 86400e3;
    if (!ok) return json({ ok: false, error: "invalid", field: "preferred_date" }, 400);
    preferred_date = d;
  }
  // 미팅 예약은 날짜를 반드시 받는다 — 없으면 언제 만날지 정할 수 없다
  if (kind === "meeting" && !preferred_date) {
    return json({ ok: false, error: "invalid", field: "preferred_date" }, 400);
  }

  const slotKey = clean(b.preferred_slot, 10);
  if (slotKey && !(slotKey in SLOTS)) return json({ ok: false, error: "invalid", field: "preferred_slot" }, 400);
  const preferred_slot = slotKey ? SLOTS[slotKey] : null;
  if (kind === "meeting" && !preferred_slot) {
    return json({ ok: false, error: "invalid", field: "preferred_slot" }, 400);
  }

  const message = clean(b.message, 1000) || null;

  if (b.consent !== true) return json({ ok: false, error: "invalid", field: "consent" }, 400);

  try {
    const sb = svc();

    const since24 = new Date(Date.now() - 24 * 3600e3).toISOString();
    const since1h = new Date(Date.now() - 3600e3).toISOString();
    const [perEmail, perHour] = await Promise.all([
      sb.from("demo_requests").select("id", { count: "exact", head: true }).eq("email", email).gte("created_at", since24),
      sb.from("demo_requests").select("id", { count: "exact", head: true }).gte("created_at", since1h),
    ]);
    if (perEmail.error || perHour.error) throw perEmail.error ?? perHour.error;
    if ((perEmail.count ?? 0) >= MAX_PER_EMAIL_PER_DAY || (perHour.count ?? 0) >= MAX_PER_HOUR_TOTAL) {
      return json({ ok: false, error: "rate_limited" }, 429);
    }

    const { data: ins, error } = await sb.from("demo_requests").insert({
      kind, name, org, email, phone, preferred_date, preferred_slot, message,
      consent_version: CONSENT_VERSION,
      purge_after: new Date(Date.now() + PURGE_DAYS * 86400e3).toISOString(),
    }).select("access_token").single();
    if (error) throw error;
    // 데모·시범 신청에만 예약 안내 페이지 주소용 token 을 돌려준다 (미팅 예약은 v4 와 같은 응답)
    return json(kind === "meeting" ? { ok: true } : { ok: true, token: ins?.access_token ?? null });
  } catch (e) {
    console.error("demo-request failed", e instanceof Error ? e.message : e);
    return json({ ok: false, error: "server" }, 500);
  }
});
