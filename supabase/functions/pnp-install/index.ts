// MedIT PnP 설치 시리얼 확인 · 진행 보고 함수
// - 공개 호출(verify_jwt=false). 시리얼(60비트 무작위)이 열쇠이고, 오입력 횟수 제한과 출처 제한을 함께 둔다.
// - 브라우저(홈페이지의 설치 페이지)는 Origin 이 허용 목록에 있을 때만, 설치 프로그램(CLI)은 Origin 없이 호출한다.
// - 모든 판단은 DB 함수(pnp_redeem, pnp_report)가 한다. 이 함수는 입력 크기·출처·횟수만 거른다.
// - 환자 정보는 받지 않는다. 보고 내용(detail)은 DB 함수가 허용된 키만 남기고 버린다.
import { createClient } from "npm:@supabase/supabase-js@2";

const ALLOWED_ORIGINS = ["https://hyunjeongshin83.github.io"];
const MAX_FAILS_PER_10MIN = 12;
const INSTALLER_VERSION = "1.0.0";

// 설치 프로그램이 매핑할 수 있는 항목. pii=true 는 "협약·동의·검토 완료(live-ready)" 단계에서만 허용한다.
const FIELDS = [
  { key: "drug_name", label: "약품명", required: true, pii: false },
  { key: "dose_per_time", label: "1회 투약량", required: true, pii: false },
  { key: "times_per_day", label: "1일 투약 횟수", required: true, pii: false },
  { key: "days", label: "투약 일수", required: true, pii: false },
  { key: "dispensed_on", label: "조제일", required: true, pii: false },
  { key: "usage_note", label: "복용법 메모", required: false, pii: false },
  { key: "patient_name", label: "환자 이름", required: false, pii: true },
  { key: "patient_phone", label: "환자 전화(안내 발송용)", required: false, pii: true },
];

const STATUS_BY_ERROR: Record<string, number> = {
  invalid: 404,
  revoked: 410,
  expired: 410,
  license_pending: 403,
  limit: 429,
  not_redeemed: 409,
  hash_mismatch: 409,
  not_approved: 409,
};

async function sha256hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const originOk = origin === null || ALLOWED_ORIGINS.includes(origin);
  const cors = {
    "Access-Control-Allow-Origin": origin && originOk ? origin : ALLOWED_ORIGINS[0],
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
  if (!originOk) return json({ ok: false, error: "origin" }, 403);

  const len = Number(req.headers.get("content-length") ?? "0");
  if (len > 4096) return json({ ok: false, error: "too_large" }, 413);

  let b: Record<string, unknown>;
  try {
    b = await req.json();
  } catch {
    return json({ ok: false, error: "json" }, 400);
  }

  const action = b.action;
  if (action !== "check" && action !== "redeem" && action !== "report") {
    return json({ ok: false, error: "action" }, 400);
  }
  const serial = typeof b.serial === "string" ? b.serial.slice(0, 40) : "";
  if (!serial) return json({ ok: false, error: "invalid" }, 404);

  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { persistSession: false },
    });

    // 오입력 횟수 제한: IP 해시 기준 10분에 12번
    const ip = (req.headers.get("x-forwarded-for") ?? req.headers.get("cf-connecting-ip") ?? "unknown")
      .split(",")[0].trim();
    const ipHash = (await sha256hex(ip + ":pnp-install")).slice(0, 32);
    const since = new Date(Date.now() - 10 * 60e3).toISOString();
    const fails = await sb.from("pnp_install_failures").select("id", { count: "exact", head: true })
      .eq("ip_hash", ipHash).gte("created_at", since);
    if (fails.error) throw fails.error;
    if ((fails.count ?? 0) >= MAX_FAILS_PER_10MIN) return json({ ok: false, error: "rate_limited" }, 429);

    let res;
    if (action === "report") {
      const step = typeof b.step === "string" ? b.step.slice(0, 20) : "";
      const detail = b.detail && typeof b.detail === "object" && !Array.isArray(b.detail) ? b.detail : {};
      res = await sb.rpc("pnp_report", { p_serial: serial, p_step: step, p_ok: b.ok === true, p_detail: detail });
    } else {
      res = await sb.rpc("pnp_redeem", { p_serial: serial, p_consume: action === "redeem" });
    }
    if (res.error) throw res.error;
    const out = res.data as Record<string, unknown>;

    if (out.ok !== true) {
      if (out.error === "invalid") await sb.from("pnp_install_failures").insert({ ip_hash: ipHash });
      return json(out, STATUS_BY_ERROR[String(out.error)] ?? 400);
    }
    if (action !== "report") {
      out.installer_version = INSTALLER_VERSION;
      out.fields = FIELDS;
    }
    return json(out);
  } catch (e) {
    console.error("pnp-install failed", e instanceof Error ? e.message : e);
    return json({ ok: false, error: "server" }, 500);
  }
});
