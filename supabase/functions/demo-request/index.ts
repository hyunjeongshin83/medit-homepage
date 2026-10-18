// MedIT 홈페이지 데모 예약 · 약국 시범 이용 신청 접수 함수
// - 공개 호출(verify_jwt=false). 대신 출처 제한, 입력 검증, 허니팟, 접수 횟수 제한으로 막는다.
// - DB 쓰기는 service_role 로만 한다. 이 키는 Supabase가 함수 안에 자동 주입하며 브라우저로 나가지 않는다.
import { createClient } from "npm:@supabase/supabase-js@2";

const ALLOWED_ORIGINS = ["https://hyunjeongshin83.github.io"];
const CONSENT_VERSION = "2026-10-18";
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

  // 허니팟: 사람 눈에 보이지 않는 칸에 값이 있으면 봇. 저장하지 않고 성공처럼 응답한다.
  if (clean(b.website, 200)) return json({ ok: true });

  const elapsed = Number(b.elapsed_ms);
  if (!Number.isFinite(elapsed) || elapsed < MIN_FILL_MS) return json({ ok: false, error: "too_fast" }, 429);

  const kind = b.kind === "pilot" ? "pilot" : b.kind === "demo" ? "demo" : "";
  if (!kind) return json({ ok: false, error: "invalid", field: "kind" }, 400);

  const name = clean(b.name, 60);
  if (!name) return json({ ok: false, error: "invalid", field: "name" }, 400);

  const email = clean(b.email, 120).toLowerCase();
  if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/.test(email)) {
    return json({ ok: false, error: "invalid", field: "email" }, 400);
  }

  const org = clean(b.org, 100) || null;
  if (kind === "pilot" && !org) return json({ ok: false, error: "invalid", field: "org" }, 400);

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

  const slotKey = clean(b.preferred_slot, 10);
  if (slotKey && !(slotKey in SLOTS)) return json({ ok: false, error: "invalid", field: "preferred_slot" }, 400);
  const preferred_slot = slotKey ? SLOTS[slotKey] : null;

  const message = clean(b.message, 1000) || null;

  if (b.consent !== true) return json({ ok: false, error: "invalid", field: "consent" }, 400);

  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { persistSession: false },
    });

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

    const { error } = await sb.from("demo_requests").insert({
      kind, name, org, email, phone, preferred_date, preferred_slot, message,
      consent_version: CONSENT_VERSION,
    });
    if (error) throw error;
    return json({ ok: true });
  } catch (e) {
    console.error("demo-request failed", e instanceof Error ? e.message : e);
    return json({ ok: false, error: "server" }, 500);
  }
});
