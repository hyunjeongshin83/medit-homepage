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

## PnP 설치 (시리얼 발급·확인·진행 기록)

약국에 설치 프로그램을 전달하는 기능입니다. 환자 정보는 받지 않습니다.

- 구성: 설치 화면 `medit-install.html` → 함수 `supabase/functions/pnp-install` → 표 3개(`pnp_install_serials`, `pnp_install_events`, `pnp_install_failures`)와 함수(`pnp_issue_serial`, `pnp_redeem`, `pnp_report`). 설치 프로그램은 `install/medit-pnp.py`(Python 표준 라이브러리만 사용)이고, 같은 폴더의 `.sha256`으로 무결성을 확인합니다.
- 표는 모두 행 단위 보안을 켜고 정책을 두지 않았습니다. 함수는 service_role만 실행할 수 있습니다.
- 시리얼(`MEDIT-XXXX-XXXX-XXXX`)은 해시로만 저장합니다. 발급할 때 한 번만 보이므로 바로 전달하세요.
- 발급(SQL 편집기): `select public.pnp_issue_serial('○○약국', 'serial', 14, false, false, '메모');` (약국명, 전달 방식 `serial`·`link`·`llm`, 만료 일수 1~90, 면허 확인 여부, 협약·동의 확인 여부, 메모). 면허·협약 칸은 확인한 뒤 `pnp_install_serials` 표에서 켭니다.
- 열쇠 두 개
  - `license_verified`: 약사 면허를 확인했을 때만 true. false이면 설치를 시작할 수 없습니다.
  - `agreement_confirmed`: 업체 협약, 약사 동의, 개인정보 검토가 끝났을 때만 true. false이면 샘플 구조(`--sample`)만 쓸 수 있고, 실제 약국 프로그램의 구조 읽기(`--vendor-ok`)는 막힙니다.
- 진행 단계: issued → claimed → mapping → approved → verified (취소는 revoked). 진행 기록은 허용된 키만 남기고 나머지는 서버에서 버립니다.
- 보기: `설치_시리얼_목록`, `설치_진행_기록`
- 환자 데이터 읽기·전송(`sync`)은 잠겨 있습니다. 협약·동의·개인정보 검토 뒤에 구현합니다.
- 적용 방식: `migrations/20261021c_pnp_install.sql`을 표, 함수 두 묶음, 보기로 나누어 적용했습니다. 이 파일의 마지막에 있는 오래된 기록 정리 작업(cron)은 아직 적용하지 않았습니다. 적용 전까지 기록은 자동으로 지워지지 않습니다.
- 오입력 제한: 같은 접속지에서 10분에 12번 잘못 입력하면 막힙니다. 허용 출처는 홈페이지 주소 하나와 출처 표시가 없는 설치 프로그램입니다.
