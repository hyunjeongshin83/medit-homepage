# 데모 예약 접수 (Supabase)

홈페이지의 "데모 예약 · 시범 이용 신청" 양식이 보내는 내용을 받는 백엔드입니다.

| 항목 | 값 |
| --- | --- |
| 프로젝트 | CampusTownHub (`xaclqvveppvccdpebzsz`, 도쿄 리전) |
| 테이블 | `public.demo_requests` (RLS 켬, 정책 없음) |
| 함수 | `demo-request` (verify_jwt 꺼짐, 출처 제한) |
| 호출 주소 | `https://xaclqvveppvccdpebzsz.supabase.co/functions/v1/demo-request` |
| 보관 | 접수 3개월 뒤 매일 03:17(KST) 자동 삭제 (`pg_cron`) |

## 구조
- 브라우저는 함수만 호출합니다. 테이블에는 직접 접근할 수 없습니다.
- 함수는 `https://hyunjeongshin83.github.io` 출처만 허용하고, 입력 검증, 허니팟, 같은 이메일 하루 3건, 전체 시간당 40건 제한을 적용합니다.
- 함수 안의 `SUPABASE_SERVICE_ROLE_KEY`는 Supabase가 자동으로 넣어 줍니다. 홈페이지 코드에는 어떤 키도 들어 있지 않습니다.

## 다른 프로젝트로 옮기려면
1. 새 프로젝트에서 `migrations/20261018_medit_demo_requests.sql`을 실행합니다.
2. `functions/demo-request/index.ts`를 `demo-request`라는 이름으로 배포합니다 (JWT 검증 끔).
3. `index.html`, `medit-en.html`의 `EP` 주소(스크립트 안 `functions/v1/demo-request` 앞부분)를 새 프로젝트 주소로 바꿉니다.

## 접수 내용 보기
Supabase 대시보드 > Table Editor > `demo_requests`. 처리한 건은 `status`를 `contacted`, `scheduled`, `done`, `declined`로 바꿔 두세요.

## 새 신청 알림
- 예약작업 "MedIT 데모 예약 신청 알림"이 매일 오전 8시~밤 10시, 2시간마다(12분) `notified_at`이 비어 있고 `status = 'new'`인 행을 확인합니다.
- 대상은 `kind`가 `demo`·`pilot`인 행뿐입니다. `meeting`은 캠퍼스타운 허브의 미팅 예약과 6시간마다 도는 자동 점검 행이라 제외합니다.
- 있으면 이메일(hyunjeong.shin@sookmyung.ac.kr)로 신청 내용을 보내고, 카카오톡 "나에게 보내기"와 앱 푸시로는 건수와 희망일만 알립니다. 하나라도 전송에 성공한 행에만 `notified_at`을 채웁니다.
- 이름·이메일·전화·문의 내용은 카카오톡에 담지 않습니다.
- 마이그레이션: `migrations/20261018b_demo_requests_notified_at.sql`

## 같은 테이블을 쓰는 다른 기능
- 캠퍼스타운 허브의 미팅 예약(`kind = 'meeting'`)이 같은 함수와 테이블을 씁니다. 배포된 함수 코드가 최신본이며 이 폴더의 사본과 다를 수 있습니다.
- 접수 함수는 `purge_after`를 180일로 넣습니다. 처리방침은 3개월이므로 `migrations/20261021_demo_requests_purge_policy.sql`의 트리거가 demo·pilot 행을 3개월로 덮어씁니다.
- 함수를 다시 배포할 때 `verify_jwt`가 꺼져 있어야 합니다. 배포 뒤 토큰 없이 한 번 호출해 확인하세요.
