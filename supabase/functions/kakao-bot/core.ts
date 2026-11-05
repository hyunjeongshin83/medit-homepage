// 카카오톡 채널 '메디아이티' AI 안내 도우미 — 카카오 오픈빌더 스킬 서버의 핵심 로직.
// - 홈페이지 안내 내용(knowledge.ts)만 근거로 Claude 가 답한다.
// - 카카오 스킬은 5초 안에 응답해야 하므로 콜백 방식(useCallback)을 쓴다:
//   즉시 "준비 중" 응답을 돌려주고, 답이 만들어지면 callbackUrl 로 최종 말풍선을 보낸다.
// - 대화 내용은 저장하지 않고 로그에도 남기지 않는다. 카카오 이용자 식별값은 Claude 에 보내지 않는다.
// - 이 파일은 런타임에 의존하지 않는다(Deno·Node 모두에서 시험 가능). index.ts 가 Deno 에 연결한다.
import { KNOWLEDGE, RULES } from "./knowledge.ts";

export interface Env {
  SKILL_TOKEN?: string; // 스킬 주소 뒤 ?k= 값과 같아야 한다. 없으면 모든 요청을 거절한다.
  ANTHROPIC_API_KEY?: string;
  CLAUDE_MODEL?: string;
}
export interface Deps {
  fetch: typeof fetch;
  waitUntil: (p: Promise<unknown>) => void;
}

const DEFAULT_MODEL = "claude-haiku-5-5";
const MAX_INPUT = 300; // 질문은 300자까지만 Claude 에 보낸다
const MAX_ANSWER = 700; // 안내 문구를 붙이기 전 답변 길이 상한
const SYNC_TIMEOUT_MS = 3800; // 콜백이 없을 때(봇테스트) 카카오 제한 5초 안에 끝내기 위한 한도
const CALLBACK_TIMEOUT_MS = 25000;
const RATE_LIMIT = 6; // 한 이용자가 60초에 물을 수 있는 횟수(실행 환경 하나 기준, 보조 장치)
const RATE_WINDOW_MS = 60000;

const HOME = "https://hyunjeongshin83.github.io/medit-homepage/";
const AI_NOTE = "\n\n※ AI가 홈페이지 안내 내용으로 답했어요. 의학 상담이 아닙니다.";
const WAIT_TEXT = "AI가 홈페이지 안내 내용으로 답을 준비하고 있어요. 잠시만 기다려 주세요.";
const FALLBACK =
  "지금은 답변을 만들지 못했어요. 홈페이지(" + HOME + ")를 보시거나 hyunjeong.shin@sookmyung.ac.kr 로 문의해 주세요. 환자 정보와 건강 정보는 적지 마세요.";
const EMPTY_TEXT = "궁금한 점을 글로 적어 주세요. 환자 정보와 건강 정보는 적지 마세요.";
const BUSY_TEXT = "질문이 짧은 시간에 많이 들어왔어요. 잠시 뒤에 다시 물어봐 주세요.";
const EMERGENCY_TEXT =
  "급한 상황이면 지금 바로 119에 연락해 주세요. 마음이 많이 힘드시면 자살예방 상담전화 109(24시간)에 연락하실 수 있어요. " +
  "이 채널은 응급·진단·처방 상담을 할 수 없습니다. 의약품 부작용 상담은 1644-6223(한국의약품안전관리원)입니다.\n\n※ 자동 안내 문구입니다.";
// 응급·위기 표현은 AI를 거치지 않고 고정 문구로만 안내한다.
const EMERGENCY_RE =
  /(응급|119|숨이\s*(안|막|차)|호흡\s*곤란|의식\s*(이\s*)?(없|잃)|쓰러|경련|가슴\s*통증|자살|죽고\s*싶|목숨|극단적)/;

const QUICK_REPLIES = [
  { label: "서비스 소개", action: "message", messageText: "MedIT은 어떤 서비스인가요?" },
  { label: "시범 이용 신청", action: "message", messageText: "약국 시범 이용은 어떻게 신청하나요?" },
  { label: "개인정보 처리", action: "message", messageText: "개인정보는 어떻게 처리되나요?" },
  { label: "문의 방법", action: "message", messageText: "문의는 어떻게 하나요?" },
];

const recent = new Map<string, number[]>(); // 메모리에만 두며 저장하지 않는다

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

export function template(text: string) {
  return {
    version: "2.0",
    template: {
      outputs: [{ simpleText: { text: text.slice(0, 1000) } }],
      quickReplies: QUICK_REPLIES,
    },
  };
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

function validCallbackUrl(v: unknown): string | null {
  if (typeof v !== "string" || v.length > 2000) return null;
  try {
    const u = new URL(v);
    const h = u.hostname;
    if (u.protocol !== "https:") return null;
    if (!h.includes(".") || h === "localhost" || /^[0-9.]+$/.test(h) || h.includes(":")) return null;
    return u.toString();
  } catch {
    return null;
  }
}

function tooFast(userId: string, now: number): boolean {
  if (!userId) return false;
  const list = (recent.get(userId) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  if (list.length >= RATE_LIMIT) {
    recent.set(userId, list);
    return true;
  }
  list.push(now);
  recent.set(userId, list);
  if (recent.size > 2000) {
    for (const [k, v] of recent) if (!v.some((t) => now - t < RATE_WINDOW_MS)) recent.delete(k);
  }
  return false;
}

export function cleanAnswer(t: string): string {
  let s = t
    .replace(/\r/g, "")
    .replace(/\*\*|__|`+/g, "")
    .replace(/^\s{0,3}#{1,6}\s*/gm, "")
    .replace(/^\s*[-*•]\s+/gm, "· ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (s.length > MAX_ANSWER) {
    s = s.slice(0, MAX_ANSWER);
    const i = Math.max(s.lastIndexOf("요."), s.lastIndexOf("다."), s.lastIndexOf("."), s.lastIndexOf("\n"));
    if (i > 200) s = s.slice(0, i + 1);
  }
  return s;
}

async function askClaude(env: Env, deps: Deps, question: string, signal: AbortSignal): Promise<string | null> {
  const res = await deps.fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": env.ANTHROPIC_API_KEY as string,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: env.CLAUDE_MODEL || DEFAULT_MODEL,
      max_tokens: 500,
      system: [{ type: "text", text: RULES + "\n\n" + KNOWLEDGE, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: "[이용자 질문]\n" + question }],
    }),
    signal,
  });
  if (!res.ok) {
    console.log(JSON.stringify({ ev: "claude_http", status: res.status })); // 내용은 남기지 않는다
    return null;
  }
  const j = await res.json();
  const text = Array.isArray(j?.content)
    ? j.content.filter((b: { type?: string }) => b?.type === "text").map((b: { text?: string }) => b.text ?? "").join("")
    : "";
  return text.trim() ? text : null;
}

async function answer(env: Env, deps: Deps, question: string, ms: number): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const raw = await askClaude(env, deps, question, ctrl.signal);
    const cleaned = raw ? cleanAnswer(raw) : "";
    return cleaned ? cleaned + AI_NOTE : FALLBACK;
  } catch {
    console.log(JSON.stringify({ ev: "claude_error" }));
    return FALLBACK;
  } finally {
    clearTimeout(timer);
  }
}

async function postCallback(deps: Deps, url: string, text: string): Promise<void> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10000);
  try {
    const r = await deps.fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(template(text)),
      signal: ctrl.signal,
    });
    console.log(JSON.stringify({ ev: "callback", status: r.status }));
  } catch {
    console.log(JSON.stringify({ ev: "callback_error" }));
  } finally {
    clearTimeout(timer);
  }
}

export async function handle(req: Request, env: Env, deps: Deps): Promise<Response> {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  // 1) 스킬 주소 토큰 확인 — 토큰이 설정되지 않았으면 모든 요청을 거절한다(안전 쪽으로 닫음)
  if (!env.SKILL_TOKEN) return json({ error: "not_configured" }, 503);
  const given = new URL(req.url).searchParams.get("k") ?? "";
  if (!safeEqual(given, env.SKILL_TOKEN)) return json({ error: "unauthorized" }, 401);

  // 2) 요청 읽기
  let body: any;
  try {
    const raw = await req.text();
    if (raw.length > 30000) return json({ error: "too_large" }, 413);
    body = JSON.parse(raw);
  } catch {
    return json({ error: "bad_request" }, 400);
  }
  const ur = body?.userRequest ?? {};
  const q = (typeof ur.utterance === "string" ? ur.utterance : "").replace(/\s+/g, " ").trim().slice(0, MAX_INPUT);
  const userId = typeof ur?.user?.id === "string" ? ur.user.id : "";

  // 3) 고정 응답으로 끝나는 경우 (Claude 를 부르지 않음)
  if (!q) return json(template(EMPTY_TEXT));
  if (EMERGENCY_RE.test(q)) return json(template(EMERGENCY_TEXT));
  if (!env.ANTHROPIC_API_KEY) {
    console.log(JSON.stringify({ ev: "no_api_key" }));
    return json(template(FALLBACK));
  }
  if (tooFast(userId, Date.now())) return json(template(BUSY_TEXT));

  // 4) 콜백 방식: 즉시 대기 응답 → 뒤에서 답을 만들어 callbackUrl 로 보낸다
  const cb = validCallbackUrl(ur.callbackUrl);
  if (cb) {
    deps.waitUntil(
      (async () => {
        const text = await answer(env, deps, q, CALLBACK_TIMEOUT_MS);
        await postCallback(deps, cb, text);
      })(),
    );
    return json({ version: "2.0", useCallback: true, data: { text: WAIT_TEXT } });
  }

  // 5) 콜백이 없으면(봇테스트 등) 바로 답한다. 시간이 모자라면 안내 문구로 대신한다.
  return json(template(await answer(env, deps, q, SYNC_TIMEOUT_MS)));
}
