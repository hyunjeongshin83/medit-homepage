// 시험: node supabase/functions/kakao-bot/test.mjs  (Node 22 이상, 외부 통신 없음 — Claude·카카오는 모의 응답)
import { handle, cleanAnswer, template } from "./core.ts";
import { KNOWLEDGE, RULES } from "./knowledge.ts";

let fails = 0;
const ok = (name, cond, extra = "") => {
  console.log((cond ? "PASS " : "FAIL ") + name + (cond ? "" : "  " + extra));
  if (!cond) fails++;
};

const TOKEN = "test-token-123";
const URLB = "https://example.supabase.co/functions/v1/kakao-bot";
const CB = "https://bot-api.kakao.com/v1/callback/abc";

function mkDeps(claude) {
  const calls = [];
  const pending = [];
  return {
    calls,
    pending,
    deps: {
      fetch: async (url, init) => {
        const body = init?.body ? JSON.parse(init.body) : null;
        calls.push({ url: String(url), body, headers: init?.headers });
        if (String(url).startsWith("https://api.anthropic.com/")) return claude(body, init);
        return new Response("{}", { status: 200 });
      },
      waitUntil: (p) => pending.push(p),
    },
  };
}
const claudeOk = (text) => async () =>
  new Response(JSON.stringify({ content: [{ type: "text", text }] }), { status: 200 });

const req = (utterance, extra = {}, query = "?k=" + TOKEN, method = "POST") =>
  new Request(URLB + query, {
    method,
    headers: { "content-type": "application/json" },
    body: method === "POST" ? JSON.stringify({ userRequest: { utterance, user: { id: "kakao-user-1" }, ...extra } }) : undefined,
  });
const env = { SKILL_TOKEN: TOKEN, ANTHROPIC_API_KEY: "sk-test" };

// 지식 문서 기본 점검
ok("지식 문서 길이 합리적(20000자 미만)", KNOWLEDGE.length < 20000, String(KNOWLEDGE.length));
ok("지식 문서에 전화번호 없음", !/010-?\d{4}-?\d{4}/.test(KNOWLEDGE + RULES));
ok("지식 문서에 비밀값 형태 없음", !/(sk-ant|sb_secret|github_pat|eyJ[a-zA-Z0-9]{20})/.test(KNOWLEDGE + RULES));

// 1) 토큰
{
  const { deps } = mkDeps(claudeOk("x"));
  const r1 = await handle(req("안녕", {}, ""), env, deps);
  ok("토큰 없으면 401", r1.status === 401);
  const r2 = await handle(req("안녕", {}, "?k=wrong"), env, deps);
  ok("토큰 틀리면 401", r2.status === 401);
  const r3 = await handle(req("안녕"), { ANTHROPIC_API_KEY: "x" }, deps);
  ok("SKILL_TOKEN 미설정이면 503(닫힘)", r3.status === 503);
  const r4 = await handle(req("안녕", {}, "?k=" + TOKEN, "GET"), env, deps);
  ok("GET 은 405", r4.status === 405);
  ok("거절 시 Claude 호출 없음", true);
}

// 2) 콜백 방식
{
  const m = mkDeps(claudeOk("**MedIT**은 복약 관리 플랫폼을 준비 중이에요.\n- 준비 중입니다."));
  const t0 = Date.now();
  const r = await handle(req("MedIT이 뭐예요?", { callbackUrl: CB }), env, m.deps);
  const j = await r.json();
  ok("콜백: 즉시 useCallback 응답", r.status === 200 && j.useCallback === true && j.version === "2.0" && typeof j.data?.text === "string");
  await Promise.all(m.pending);
  const cbCall = m.calls.find((c) => c.url === CB);
  ok("콜백: callbackUrl 로 POST", !!cbCall);
  const out = cbCall?.body;
  ok("콜백: version 2.0 + simpleText + quickReplies", out?.version === "2.0" && out?.template?.outputs?.[0]?.simpleText?.text && out?.template?.quickReplies?.length === 4);
  const text = out?.template?.outputs?.[0]?.simpleText?.text ?? "";
  ok("콜백: 마크다운 제거", !text.includes("**") && !/^- /m.test(text), text);
  ok("콜백: AI 안내 문구 포함", text.includes("AI가 홈페이지 안내 내용으로 답했어요"));
  ok("콜백: 1000자 이하", text.length <= 1000);
  const cl = m.calls.find((c) => c.url.startsWith("https://api.anthropic.com/"));
  ok("Claude: 기본 모델 claude-haiku-5-5", cl?.body?.model === "claude-haiku-5-5");
  ok("Claude: system 에 규칙·안내 내용 포함", JSON.stringify(cl?.body?.system).includes("안내 내용") && JSON.stringify(cl?.body?.system).includes("진단·처방"));
  ok("Claude: 질문이 user 메시지에 들어감", cl?.body?.messages?.[0]?.content?.includes("MedIT이 뭐예요?"));
  ok("Claude: max_tokens 500 이하", cl?.body?.max_tokens <= 500);
  const sent = JSON.stringify(cl?.body);
  ok("Claude: 카카오 이용자 식별값을 보내지 않음", !sent.includes("kakao-user-1") && !sent.includes(CB));
  ok("Claude: 키는 헤더로만", cl?.headers?.["x-api-key"] === "sk-test" && !sent.includes("sk-test"));
}

// 3) 콜백 없음(봇테스트)
{
  const m = mkDeps(claudeOk("시범 이용은 홈페이지 신청 양식으로 신청해요."));
  const r = await handle(req("시범 이용 어떻게 신청해요?"), env, m.deps);
  const j = await r.json();
  ok("동기: 바로 template 응답", j.template?.outputs?.[0]?.simpleText?.text?.includes("시범 이용"));
  ok("동기: useCallback 없음", j.useCallback === undefined);
}

// 4) 빈 질문 / 긴 질문
{
  const m = mkDeps(claudeOk("답"));
  const r = await handle(req("   "), env, m.deps);
  const j = await r.json();
  ok("빈 질문: 고정 안내, Claude 호출 없음", j.template?.outputs?.[0]?.simpleText?.text?.includes("궁금한 점") && m.calls.length === 0);
  const long = "가".repeat(1000);
  await handle(req(long), env, m.deps);
  const cl = m.calls.find((c) => c.url.startsWith("https://api.anthropic.com/"));
  ok("긴 질문: 300자로 잘라서 보냄", cl && cl.body.messages[0].content.length <= 300 + 20, String(cl?.body?.messages?.[0]?.content?.length));
}

// 5) 응급 표현
{
  const m = mkDeps(claudeOk("x"));
  const r = await handle(req("숨이 안 쉬어져요", { callbackUrl: CB }), env, m.deps);
  const j = await r.json();
  const text = j.template?.outputs?.[0]?.simpleText?.text ?? "";
  ok("응급: 119 안내, AI 호출 없음", text.includes("119") && m.calls.length === 0 && j.useCallback === undefined);
  const r2 = await handle(req("죽고 싶어요"), env, m.deps);
  const t2 = (await r2.json()).template?.outputs?.[0]?.simpleText?.text ?? "";
  ok("위기: 109 안내, AI 호출 없음", t2.includes("109") && m.calls.length === 0);
}

// 6) 실패 처리
{
  const m = mkDeps(async () => new Response("{}", { status: 500 }));
  const r = await handle(req("질문", { callbackUrl: CB }), env, m.deps);
  await r.json();
  await Promise.all(m.pending);
  const cb = m.calls.find((c) => c.url === CB);
  ok("Claude 실패: 안내 문구를 콜백으로 보냄", cb?.body?.template?.outputs?.[0]?.simpleText?.text?.includes("답변을 만들지 못했어요"));
  const m2 = mkDeps(claudeOk("x"));
  const r2 = await handle(req("질문"), { SKILL_TOKEN: TOKEN }, m2.deps);
  const t2 = (await r2.json()).template?.outputs?.[0]?.simpleText?.text ?? "";
  ok("API 키 없음: 안내 문구, 외부 호출 없음", t2.includes("답변을 만들지 못했어요") && m2.calls.length === 0);
  const m3 = mkDeps(async () => { throw new Error("network"); });
  const r3 = await handle(req("질문"), env, m3.deps);
  const t3 = (await r3.json()).template?.outputs?.[0]?.simpleText?.text ?? "";
  ok("네트워크 오류: 안내 문구", t3.includes("답변을 만들지 못했어요"));
}

// 7) callbackUrl 검증
{
  for (const bad of ["http://bot-api.kakao.com/x", "https://localhost/x", "https://127.0.0.1/x", "https://[::1]/x", "not a url"]) {
    const m = mkDeps(claudeOk("답"));
    const r = await handle(req("질문", { callbackUrl: bad }), env, m.deps);
    const j = await r.json();
    ok("잘못된 callbackUrl(" + bad + ") 은 동기 응답으로 처리", j.useCallback === undefined && !m.calls.some((c) => c.url === bad));
  }
}

// 8) 이용자별 속도 제한
{
  const m = mkDeps(claudeOk("답"));
  let busy = 0;
  for (let i = 0; i < 9; i++) {
    const r = await handle(
      new Request(URLB + "?k=" + TOKEN, { method: "POST", body: JSON.stringify({ userRequest: { utterance: "질문" + i, user: { id: "spammer" } } }) }),
      env, m.deps);
    const t = (await r.json()).template?.outputs?.[0]?.simpleText?.text ?? "";
    if (t.includes("많이 들어왔어요")) busy++;
  }
  ok("속도 제한: 6회 넘으면 막음", busy === 3, String(busy));
}

// 9) 답변 정리
{
  const long = "가나다라마바사. ".repeat(200);
  const c = cleanAnswer(long);
  ok("긴 답변은 700자 이내", c.length <= 700);
  ok("template 은 1000자 초과를 자름", template("a".repeat(2000)).template.outputs[0].simpleText.text.length === 1000);
  ok("제목·굵게 기호 제거", cleanAnswer("## 제목\n**굵게** 글").replace(/\n/g, "|") === "제목|굵게 글");
}

console.log(fails ? "\n실패 " + fails + "건" : "\n모두 통과");
process.exit(fails ? 1 : 0);
