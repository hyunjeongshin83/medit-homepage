// 카카오톡 채널 '메디아이티' AI 안내 도우미 (카카오 오픈빌더 스킬 서버)
// - 호출 주소: https://xaclqvveppvccdpebzsz.supabase.co/functions/v1/kakao-bot?k=<SKILL_TOKEN>
// - verify_jwt 는 반드시 false 여야 한다(카카오가 호출하므로 Supabase 로그인 토큰이 없다).
//   대신 주소 뒤 ?k= 토큰을 직접 확인한다. 배포 뒤엔 항상 토큰 없이 한 번 불러 401 이 나오는지 확인하자.
// - 비밀값(Supabase 대시보드 > Edge Functions > Secrets 에 직접 입력):
//     SKILL_TOKEN        스킬 주소 뒤에 붙이는 임의의 긴 문자열
//     ANTHROPIC_API_KEY  Anthropic Console 에서 만든 API 키
//     CLAUDE_MODEL       (선택) 기본값 claude-haiku-5-5
// - 로직은 core.ts, 안내 내용과 답변 규칙은 knowledge.ts.
import { handle } from "./core.ts";

Deno.serve((req: Request) =>
  handle(
    req,
    {
      SKILL_TOKEN: Deno.env.get("SKILL_TOKEN") ?? undefined,
      ANTHROPIC_API_KEY: Deno.env.get("ANTHROPIC_API_KEY") ?? undefined,
      CLAUDE_MODEL: Deno.env.get("CLAUDE_MODEL") ?? undefined,
    },
    {
      fetch,
      waitUntil: (p: Promise<unknown>) => {
        // deno-lint-ignore no-explicit-any
        const rt = (globalThis as any).EdgeRuntime;
        if (rt && typeof rt.waitUntil === "function") rt.waitUntil(p);
        else p.catch(() => {});
      },
    },
  )
);
