# 클라이언트 3종 실동작 테스트 운영 지식

REG-ALL-01(2026-09-14~15)·PLAN-WO-01(2026-09-15) 실행에서 실측으로 확인한 것들. **반복해서 막히지 않도록 여기부터 읽는다.**
추정이 아니라 전부 그 실행에서 재현·확인한 내용이다. 근거는 `evidence/REG-ALL-01/`에 있다.

---

## 1. Android 에뮬레이터 — 가려지면 멎는다

### 증상

`adb shell`이 무응답(rc=142)이 되고 `get-state`는 `device`인데 `qemu-system-aarch64` CPU가 **0.0%** 로 떨어진다. `adb reconnect` 후에도 `device offline`이 지속된다. WebView 개발자 도구 포워드도 끊긴다.

### 원인

**에뮬레이터 창이 다른 창에 가려지면 macOS가 절전(App Nap)시킨다.** REG-ALL-01에서 두 번 발생했다.

| 회차 | 가린 것 | 복구 계기 |
|---|---|---|
| 1 | POP kiosk 전체화면 | POP 종료 후 창이 드러남 |
| 2 | 다른 앱 창 | 창 상태 변화 |

두 번 다 창이 드러나자 CPU가 올라오고 `adb`가 살아났다. POP 특정 문제가 아니다.

### 해결 — 창 없이 띄운다 (검증됨)

```sh
adb emu kill                       # 기존 인스턴스 정상 종료
~/Library/Android/sdk/emulator/emulator -avd <AVD> -no-window -netdelay none -netspeed full
adb wait-for-device
```

- **창이 없으면 가려질 수도, App Nap 대상이 될 수도 없다.** 원인 자체가 사라진다.
- AVD 데이터(설치 앱)는 유지된다.
- **헤드리스에서도 카메라가 동작한다.** virtualscene 후면 카메라가 열려 미리보기가 `adb screencap`에 찍혔다. QR 촬영 검증이 제약되지 않는다.
- 조작·캡처는 `adb`와 WebView CDP로 그대로 된다. 사람이 화면을 직접 볼 수 없다는 것만 다르다.

### 시도했으나 쓸 수 없던 것

- `defaults write <bundle id> NSAppSleepDisabled` — **에뮬레이터에 bundle identifier가 없다.** System Events가 "missing value"를 돌려주고 `~/Library/Android/sdk/emulator` 아래에 `.app`·`Info.plist`가 없다. `com.google.android.emulator`는 존재하지 않는 이름이다.
- `osascript`로 창 앞으로 가져오기 — assistive access 거부(-25211).
- 사람이 창 배치를 유지 — 주의력에 기대는 대책이라 또 실패한다.

### 그 밖의 에뮬레이터 주의

- **`uiautomator dump`가 멈출 수 있다.** 타임아웃을 짧게 걸고, 막히면 `adb screencap` + CDP DOM 조회로 대체한다. 같은 곳에서 두 번 막히면 중단하고 원인을 본다.
- `timeout` 명령이 macOS 기본 셸에 없다. 백그라운드 + `kill` 또는 `until` 루프를 쓴다.

---

## 2. 모바일 앱 — 시작 조건과 금지 사항

### ⛔ 절대 쓰지 말 것

**`apps/mobile/scripts/emulator-register.sh` / `.mjs`**
가짜 토큰을 보관소에 직접 넣어 등록 절차를 통째로 우회한다. 스크립트 머리말에 "이것은 지름길이다"라고 적혀 있다. 이걸 쓰면 시나리오가 통과해도 **아무것도 검증하지 못한다.**

**`emulator-run.sh`** (권한 거절 경로를 검증할 때)
설치 직후 `pm grant`로 CAMERA 권한을 자동 부여한다. 거절 경로 검증이 무의미해진다. `adb install`만 쓴다.

**`adb install -g`** — 같은 이유로 `-g`를 붙이지 않는다.

### 시작 조건을 반드시 초기화한다

```sh
adb uninstall com.crefle.omfmes.mobile      # 데이터·권한 이력까지 지운다
adb install <APK>                            # -g 없이
```

권한 이력이 남으면 `prompt-with-rationale` 상태라 "첫 요청" 경로를 타지 않는다. 앱 데이터가 남으면 SecureStorage의 이전 토큰 때문에 등록 화면을 건너뛴다.

### 토큰을 에뮬레이터로 옮기기

```sh
adb -s <기기> shell input text "$(pbpaste)"
```

- JWT 문자 집합(`[A-Za-z0-9_-.]`)에는 셸 이스케이프 문제가 없다. 233자 완전 일치 확인(약 30자/초).
- ⛔ **클립보드 공유 + `KEYCODE_PASTE`(279)는 동작하지 않는다.** 실측으로 배제했다.
- 값을 `echo`하거나 `set -x` 하지 않는다. 앱 입력 칸은 `type=password`라 `uiautomator`로 읽히지 않으니, 확인이 필요하면 WebView 개발자 도구로 `value.length`만 본다.

### 요청 관찰 — Capacitor 8 네이티브 HTTP

브리지 콘솔 로그만 보면 **HTTP 요청이 안 잡힌다.** Capacitor 8의 네이티브 HTTP는 WebView → `https://localhost/_capacitor_http_interceptor_?u=<원래 URL>` 경로를 탄다. 관찰 도구가 이 인터셉터 URL을 잡도록 해야 한다.

### 서버 주소

- 에뮬레이터: **`http://10.0.2.2:3100/api`** (`apps/mobile/scripts/emulator-env.sh:13`이 정한 관례)
- 실기기: Mac LAN 주소(예: `http://192.168.x.x:3100/api`)
- 주소는 **빌드 시점 `VITE_API_BASE_URL`에 구워진다**(`apps/mobile/src/app/api.ts:12`). `MOBILE_API_PROXY_TARGET`은 브라우저 개발 서버 프록시용이라 APK와 무관하다.
- ⚠ `VITE_API_BASE_URL`을 주지 않으면 **기본값이 목 서버(`127.0.0.1:4010`)** 다. 빠뜨리면 목으로 검증하고 통과시키게 된다.
- ⛔ `adb reverse` + `localhost`는 쓰지 않는다. 사설망 조건을 피해 가서 로컬 네트워크 권한 결함(아래 §5)을 못 본다.
- CORS 때문에 네이티브 HTTP가 필요하다(`CAP_NATIVE_HTTP=1`). WebView fetch는 앱 출처 `https://localhost`가 서버 `CORS_ORIGINS`에 없어 막힌다.

### APK 빌드

```sh
JAVA_HOME=/opt/homebrew/opt/openjdk@21
ANDROID_HOME=$HOME/Library/Android/sdk
VITE_API_BASE_URL=http://10.0.2.2:3100/api pnpm --filter @omf-mes/mobile build
CAP_ALLOW_CLEARTEXT_HTTP=1 CAP_NATIVE_HTTP=1 pnpm exec cap sync android
./gradlew assembleDebug
```

- **JDK 21이 필수다.** Gradle Java 툴체인이 `languageVersion=21` 설치본을 요구하고(`@capacitor/camera`) **JDK 25로 대체하지 않는다.** Android Studio 번들 JBR(25)로는 실패한다.
  - 오류: `Cannot find a Java installation … matching: {languageVersion=21…}`
  - 거부 주체는 AGP가 아니라 Gradle 툴체인이다. Gradle·AGP 구성 단계는 JBR 25로도 통과하므로 오해하기 쉽다.
- `cap sync`를 빼고 `gradlew`만 돌리면 `capacitor-cordova-android-plugins`가 없어 실패한다. 순서를 지킨다.
- `ANDROID_HOME` 실제 위치는 `~/Library/Android/sdk`다. `emulator-env.sh:8`의 기본값(`/opt/homebrew/share/android-commandlinetools`)과 다르므로 명시한다.

---

## 3. POP (Electron) — 직접 조작

### 개발 모드는 창 모드로 뜬다 (2026-09-15 변경)

`window-options.ts`가 `isDev`로 창 모양을 가른다. 배포본은 키오스크(`kiosk`·`fullscreen`·`frame:false`·`resizable:false`), 개발 모드는 창 모드다. 보안 축(`contextIsolation`·`nodeIntegration`·`sandbox`·`webSecurity`)은 개발 모드에서도 잠긴 채다.

이 변경 전에는 개발 모드에서도 1920×1200 전체(메뉴바·독 포함)를 덮어 다른 창과 번갈아 조작할 수 없었고, **에뮬레이터를 가려 멎게 했다**(§1).

### 기동 — 순서를 지켜야 한다

```sh
env -u VITE_API_BASE_URL pnpm --filter @omf-mes/web build:pop      # 기본값 pop://app/api 로 빌드
POP_API_TARGET=http://localhost:3100 pnpm --filter @omf-mes/pop build
cd apps/pop && POP_API_TARGET=http://localhost:3100 \
  ./node_modules/electron/dist/Electron.app/Contents/MacOS/Electron . --remote-debugging-port=9223
```

- ⚠ `pnpm --filter @omf-mes/pop dev`는 **인자를 넘길 수 없어 CDP에 쓸 수 없다.** 바이너리를 직접 띄운다.
- `build:pop`은 `VITE_API_BASE_URL`을 **비워야** 기본값으로 빌드된다(`vite.pop.config.ts:71-76`).
- `POP_API_TARGET`에 `/api`를 붙이지 않는다. 셸이 `/api/` 요청을 이 주소로 중계한다. 이 값은 esbuild가 빌드 시점에 넣는다.

### CDP 조작 (검증됨)

Electron 38.8.6 / Chrome 140 / Protocol 1.3, 타깃 `page "OMF-MES POP" pop://app/`.
DOM 조회, `Input.dispatchMouseEvent` 실제 클릭, `Input.insertText` 입력(React 제어 입력에 정상 반영), `Page.captureScreenshot` 모두 된다.

- 종료: 브라우저 CDP 엔드포인트에 `Browser.close`(정상 종료 code 0). 응답하지 않으면 SIGTERM → SIGKILL.
- `Browser.getWindowForTarget`은 Electron에서 지원하지 않는다.
- 셸 브리지 `window.pop`으로 관찰 가능: `deviceToken`(get/set), `cache`, `outbox`, `printers`, `rendition`.

### 시작 조건 초기화

```
~/Library/Application Support/@omf-mes/pop/
  secure/device-token.bin   ← 보관 토큰. 있으면 미등록 시작 조건 위반
  pop.sqlite                ← 작업자 명부 캐시 + outbox
```

**`pop.sqlite`를 반드시 지운다.** 명부 캐시가 남으면 명부 수신에 실패해도 사번 확인이 통과해 **실패를 통과로 판정하게 된다.** `outbox`가 0이면 잃을 것이 없고 POP이 다시 만든다.

확실하게 하려면 userData 전체를 지우고 지운 목록을 증거에 남긴다.

### 알려진 성질

- POP는 **앱을 켤 때마다** 보관 토큰으로 `confirm-registration`을 다시 호출한다. 서버가 멱등이라 확인 시각·`version_no`가 바뀌지 않는다(REG-ALL-01 S19에서 재기동 2회로 확인).
- 보관 토큰은 서버가 거절할 때만(`malformed`/`rejected`/`foreign`/`wrong-type`) 스스로 폐기한다. "단말 재등록" 버튼은 보관 토큰을 지우지 않는다.
- 기동 때마다 `GET /api/app/sessions/current`가 401로 한 번 나간다(관리자 세션 조회). 흐름 영향 없음.
- 토큰은 macOS 키체인(safeStorage)에 보관한다. 확인 창은 뜨지 않았다.

---

## 4. 관리자 웹

```sh
cd apps/web && VITE_API_BASE_URL=/api VITE_API_PROXY_TARGET=http://localhost:3100 \
  pnpm exec vite --port 5173 --strictPort
```

- ⚠ **`VITE_API_BASE_URL=/api`가 필수다.** 없으면 기본값이 목 서버(`127.0.0.1:4010`)다(`apps/web/src/app/api.ts:9`).
- ⚠ LISTEN이 **`[::1]:5173`(IPv6)뿐**이다. `http://localhost:5173`으로만 붙고 `127.0.0.1:5173`으로는 안 된다.
- 서버 `.env`의 `CORS_ORIGINS`가 `http://localhost:5173`이므로 포트를 바꾸면 서버 설정도 함께 바꿔야 한다.
- 환경변수는 셸로만 준다. `.env` 파일을 만들지 않는다.
- 조작은 **전용 프로필 헤드리스 Chrome + CDP**로 한다. 사용자 브라우저를 건드리지 않는다. 새 실행에서는 **새 프로필**을 써야 이전 세션이 물려 오지 않는다.
- ⚠ 헤드리스 `--dump-dom --virtual-time-budget` 방식은 "로그인 상태를 확인하는 중입니다."에서 멈춘다(가상 시간이 네트워크를 기다리지 않음). 실시간 CDP로 봐야 한다.
- ⛔ **Chrome 프로필을 증거에 복사하지 않는다.** 관리자 세션 쿠키가 들어 있다.

---

## 5. 서버·DB

### 서버 로그에 4xx가 남지 않는다

요청 로깅 미들웨어·인터셉터가 없고 `ErrorResponseFilter`는 **처리되지 않은 예외(500)만** 기록한다(`src/common/errors/error.filter.ts:61-68`). 400/401/403/404/409는 응답만 하고 사라진다.

→ **status 증거는 클라이언트 쪽에서 잡아야 한다.** 실패 경로 검증은 클라이언트 네트워크 기록이 유일한 근거다. 사후 복원이 불가능하다.

서버 쪽 보완 관찰은 DB 폴링이다 — `mdm.terminal`의 `token_version`·`registered_token_version`·`registration_confirmed_at`·`version_no` 변화.

### watch 모드

서버가 `nest start --watch`로 뜨면 **src를 저장하는 순간 재컴파일·재기동**된다(`dist/main` PID가 바뀐다). 시나리오 실행 중에는 src를 저장하지 않는다. 실행 코드와 검증 코드가 어긋난다.

수정 후에는 **실행 코드 = 작업트리**를 확인한다 — dist에 반영됐는지, dist보다 새로운 src가 0건인지.

### E2E 전용 DB

⛔ **`pnpm test:e2e`를 그냥 돌리면 시나리오 DB `omf_mes`가 오염된다**(`test/global-setup.ts:16`이 기본 `DATABASE_URL`을 쓴다).

```sh
docker compose exec -T postgres createdb -U omf omf_mes_e2e
DATABASE_URL="postgresql://omf:omf@localhost:5432/omf_mes_e2e?schema=public" pnpm exec prisma migrate deploy
DATABASE_URL="..." pnpm db:seed
DATABASE_URL="..." pnpm test:e2e -- <스위트>
```

dotenv는 이미 있는 환경변수를 덮지 않는다. **실행 전 `current_database()`로 대상을 확인**하고, 아니면 중단한다.

### 시나리오 DB 초기화 — 복원보다 선별 삭제

REG-ALL-01에서 단말만 만들고 업무 데이터를 만들지 않았다면 **백업 복원이 불필요하다.**

```sql
BEGIN; DELETE FROM mdm.terminal WHERE terminal_code LIKE '<접두사>%'; COMMIT;
```

복원은 시드와 권한까지 되돌려 재적용·재부여가 따라온다. 먼저 **참조 FK의 대상 테이블이 비어 있는지** 확인한다(REG-ALL-01에서는 17개 전부 0건이었다).

단, `terminal_id` 시퀀스는 되돌아가지 않으므로 **다음 실행의 id가 달라진다.** 이전 실행의 id를 재사용하지 않는다.

### contracts:generate가 src에 쓴다

`scripts/contracts/generate.mjs`가 `src/contracts/*.d.ts`를 **매번 다시 쓴다**(내용이 같아도 mtime이 바뀌어 watch가 재기동한다). "src 저장 금지"와 충돌한다.

→ 검증 목적이면 **임시 디렉터리로 생성해 `src/contracts`와 바이트 비교**한다. drift 0을 직접 증명하면서 src를 건드리지 않는다. `KNOWN_BROKEN`(logistics)은 `generate.mjs`와 똑같이 건너뛴다.

### 필수 검사 명령

**서버** (CI `.github/workflows/ci.yml:40-57`)
```
prisma generate → contracts:generate → eslint "{src,test}/**/*.ts" --max-warnings=0
→ typecheck → test → (e2e, omf_mes_e2e) → contracts:drift
```
⛔ `pnpm lint`는 `--fix`가 붙어 있어 쓰지 않는다.

**클라이언트** (CI는 build·push 전용이라 저장소 스크립트가 필수 범위)
```
pnpm typecheck    # pnpm -r typecheck
pnpm test         # workflow:repo-check → test:workflow → pnpm -r test
pnpm dep:check
```
`check:generated`는 2026-09-15 상류 `da30b8cd`가 스크립트를 지워 필수 목록에서 뺐다(WIP-CHAIN-01 착수 시 확인).
`pnpm test`에 `workflow:repo-check`가 묶여 있다 — 로컬 전용 자료가 추적되면 막는 검사다.

---

## 6. Android 17 로컬 네트워크 권한 (2026-09-15 수정)

`targetSdk 37` 앱은 **`ACCESS_LOCAL_NETWORK`가 런타임에 부여돼야** 사설망(10/8, 192.168/16 등) 서버에 연결된다. manifest 선언만으로는 부족하다.

증상이 오해를 부른다 — 요청이 **약 2분 15초** 대기 후 `Failed to connect`로 끝나고 화면에는 "오프라인"만 뜬다. 네트워크 경로나 cleartext 문제로 보이기 쉽다.

진단은 **UID별 대조**가 빠르다.
```sh
adb shell toybox nc -z 10.0.2.2 3100                      # shell UID → OPEN
adb shell run-as <패키지> toybox nc -z 10.0.2.2 3100       # 앱 UID → Timeout
adb shell run-as <패키지> toybox nc -z 8.8.8.8 53          # 앱 UID, 공인 → OPEN
```
앱 UID만 사설망이 막히면 이 권한 문제다. Capacitor·쿠키와 무관하다.

**설계 결정 20 ①이 사내망 평문 운영이므로 실제 배포에 영향이 있다.** 도메인 대상 빌드나 Android 17 이전 기기에서는 드러나지 않는다.

권한은 OS에서 **"근처 기기"**(en "Nearby devices" / vi "Thiết bị ở gần")로 표시된다. 안내 문구는 이 이름을 써야 작업자가 설정에서 찾을 수 있다.

⚠ Android는 **두 번 거절하면 다시 묻지 않는다.** 거절 경로를 검증할 때는 **한 번만** 거절한다. 카메라 권한도 같다.

⚠ 권한 창이 겹치면 두 번째가 묻지도 않고 거절된다. ShellGate가 첫 답을 받을 때까지 화면을 세워 순차 표시를 보장한다.

---

## 7. 증거 보존

- 경로는 `evidence/<시나리오-ID>/<실행-ID>/`. **이전 실행 증거를 덮어쓰지 않는다.** 재시도는 `<단계>-<시도>-*.png`로 번호를 올린다.
- 캡처는 initial과 final에만 보존한다. 중간 재검증(recheck)은 로그·응답 중심.
- **세션 스크래치패드는 세션이 끝나면 사라진다.** 로그·조작 도구를 `evidence/` 아래로 `cp -p` 복사하고 sha256으로 무결성을 확인한다.
- ⛔ 증거에 넣지 않는 것: 토큰 원문, 비밀번호, 쿠키, **Chrome 프로필**(세션 쿠키 포함), 대용량 APK(sha256·빌드 조건만 기록).
- 계속 쓰이는 로그 파일(서버 로그 등)은 **스냅샷**임을 README에 명시한다.
- 비밀값 스캔이 빈 결과를 내면 **검사가 동작하는지부터 확인**한다(양성 대조). 빈 결과와 검사 실패는 다르다.

---

## 8. 반복해서 겪은 함정 요약

| 함정 | 결과 | 대응 |
|---|---|---|
| 에뮬레이터가 가려짐 | 무응답, 작업 중단 2회 | `-no-window` 기동 |
| POP kiosk가 화면 독점 | 에뮬레이터 정지, 조작 불가 | 개발 모드 창 모드(2026-09-15 수정) |
| `VITE_API_BASE_URL` 누락 | 목 서버로 검증하고 통과할 뻔 | 명시 필수 |
| `adb reverse` 우회 | 사설망 결함을 못 봄 | 실제 사설망 주소 사용 |
| `emulator-register.sh` | 등록 절차 전체 우회 | 사용 금지 |
| `-g` 설치 | 권한 거절 경로 무의미 | `-g` 없이 |
| `pop.sqlite` 잔존 | 명부 수신 실패를 가림 | 삭제 |
| 클립보드 공유 붙여넣기 | 동작 안 함 | `adb shell input text` |
| 브리지 콘솔만 관찰 | 네이티브 HTTP 요청 누락 | 인터셉터 URL 관찰 |
| 서버 로그로 4xx 추적 | 기록이 없음 | 클라이언트에서 status 수집 |
| `pnpm test:e2e` 그냥 실행 | 시나리오 DB 오염 | 전용 DB로 덮어쓰기 |
| 스크립트가 없는데 `0` 반환 | 미실행을 통과로 오인 | 실행 여부를 따로 확인 |
| 성공 토스트 위에 포인터가 머묾 | 다음 버튼 클릭 무반응 | elementFromPoint로 가림 확인, 토스트 close |
| 창고 관리수준 "창고" | Location 등록 불가 | 관리수준 "구역"으로 변경 후 등록 |
| BOM 구성품 공정 미매핑 | 출고요청·피킹 0건(조용히) | 라우팅 확정 후 구성품마다 등록 공정 지정 |
| POP 재기동 즉시 | 9223 충돌, CDP 없이 기동 | 포트 빈 것 확인 후 기동 |
| 타 세션 부하 루프 | 빌드·테스트 지연, OOM | 시작 전 CPU 점검, 기록 |
| 모바일 스캔 칸에 `adb input text` | 키 입력이 조각으로 잘려 "SEE"·"D-S230-0003" 불일치 판정 | 직접 입력 칸에 CDP로 값 일괄 설정 후 「넣기」 |
| 고정 하단 바가 버튼을 덮음 | 「이 라인 피킹」 중앙 탭이 비활성 바에 떨어짐 | 스크롤 후 `elementFromPoint`로 겹침 확인, 버튼 윗부분 탭 |
| 빌드 명령 뒤 `\| tail` | gradle 실패 종료 코드가 가려져 낡은 APK 설치 | `set -o pipefail` 또는 종료 코드를 따로 잡고 sha256 대조 |
| 서버 재기동 | 관리자 웹 세션 소실(API 401/PERMISSION_DENIED) | 재기동 뒤 operator로 재로그인 |
| 홈 마지막 타일이 화면 끝에 걸림 | 탭이 등록되지 않음 | 스크롤 후 탭 |

---

## 9. 관리자 웹 CDP 조작 — PLAN-WO-01에서 추가로 확인한 것

- **성공 토스트가 버튼을 덮는다.** 디자인 시스템 토스트는 hover/focus 중 자동 소멸 타이머를 멈춘다. CDP 클릭은 포인터를 그 자리에 두므로 우하단 버튼을 누른 뒤 뜬 토스트 위에 포인터가 머물러 영원히 남고, 같은 자리의 다음 버튼 클릭이 무반응이 된다. 클릭 전에 `document.elementFromPoint`로 가림 여부를 확인하고, 가려졌으면 토스트 close를 먼저 누른다(W-02-04는 D5 수정으로 W/O 전환 시 토스트를 거둔다).
- **`type=date` 입력은 `Input.insertText`로 안 들어간다.** 네이티브 value setter + `input`/`change` 이벤트로 넣고 결과 값을 읽어 확인한다. 달력 팝업이 있는 필드(계획일)는 팝업의 날짜 셀을 클릭하면 된다.
- **aria-label만 있는 입력(표 편집 행)** 은 label 기반 찾기가 실패한다. `[aria-label="…"]` 셀렉터로 위치를 잡고 클릭 후 insertText.
- **같은 문구의 버튼이 여럿**(헤더 "저장"과 표 "저장", 확인 다이얼로그의 "확정"/"전개 확정") — 첫 매치가 아니라 마지막 가시 요소 또는 활성(enabled) 요소를 골라야 한다. 확인 다이얼로그는 인라인 패널로 뜨는 경우가 있어 `[role=dialog]`로 잡히지 않는다.
- 필터 폼과 등록 폼의 같은 label(예: "공장")이 겹치면 n번째 label 또는 컨트롤 id로 지정한다. React 자동 id(`_r_x_`)는 화면 재렌더 후 바뀌므로 매번 다시 찾는다.
- **operator 재시작 시 보관 토큰이 사라진다.** 토큰 발급·입력은 한 프로세스 수명 안에서 끝낸다. 재시작 뒤 NET_LOG 파일은 이어 붙지만 `net.since` 카운터는 0부터다.

## 10. 기준정보 준비 함정 (PLAN-WO-01)

- **창고 관리수준이 "창고"면 UI에서 Location을 등록할 수 없다**("관리수준이 창고이면 Location을 등록하지 않습니다"). 시드 창고 전부가 WAREHOUSE라 준비 단계에서 대상 창고의 관리수준을 "구역"으로 바꾼 뒤 위치를 만든다.
- **BOM 구성품에 라우팅 공정을 매핑하지 않으면 배포가 출고요청·피킹 라인을 만들지 않는다**(조용히 건너뜀). 라우팅 확정 후 `master-data/item-extended-attrs` BOM 탭에서 구성품마다 "등록 공정"을 지정한다.
- 라우팅 화면에 `:set-default`가 없다. Rev를 하나만 만들면 W-02-02가 자동 선택한다. "선후행 설정"도 미구현이라 W/O 의존관계는 0건이 정상이다.
- `worker_qualification`이 비어 있으면 4M 검증이 경고(WARN)를 내지만 배포는 막지 않는다(BLOCK만 차단).
- 배포 채번(W/O·MIR·PK)은 서버 UTC 날짜다. 한국 새벽에 돌리면 전날 날짜가 붙는다.

## 11. 환경 함정 (PLAN-WO-01)

- **다른 세션이 남긴 부하 루프**(`while :; do :; done` ×10, 각 60% CPU)가 같은 머신에 떠 있으면 에뮬레이터·빌드·vitest가 느려지고 `pnpm test`가 메모리 부족으로 죽을 수 있다. 시작 전에 `ps -eo pid,pcpu,comm | awk '$2>50'`로 확인한다. 남의 세션 프로세스는 죽이지 말고 기록한다.
- **`pnpm test`(web+mobile vitest 동시)가 OOM으로 중단**되면 같은 범위를 `--workspace-concurrency=1` + web 단독(`--maxWorkers=4`)으로 나눠 돌리고, 나눈 사실과 범위 동일성을 기록한다.
- **POP 재기동 시 9223 포트 충돌.** `Browser.close` 직후 바로 띄우면 이전 프로세스가 아직 포트를 쥐고 있어 새 인스턴스가 CDP 없이 뜬다. 종료 후 `lsof -iTCP:9223`으로 빈 것을 확인하고 띄운다.
- 시나리오 간 DB 되돌리기는 **선별 삭제 SQL**(FK 전수 확인, 기대 건수 불일치 시 롤백, dry-run→apply)로 한다. 채번 카운터는 되돌리지 않으므로 final 번호가 이어진다(0003~).

## 12. 모바일 조작 함정 (PICK-ISSUE-01)

- **스캔 칸(`use-scan-field`)은 키 입력을 조각 단위로 평가한다.** `adb shell input text`는 문자를 여러 묶음으로 보내므로 앞 묶음("SEE")이 먼저 판정돼 "이 라인의 LOT 이 아닙니다"가 뜨고 나머지("D-S230-0003")가 다시 판정된다. 실제 스캐너는 값을 한 번에 넣으므로 제품 결함이 아니다. 조작은 「직접 입력」을 연 뒤 CDP(`mobile-observer` 9313 `/eval`)로 네이티브 value setter + `input` 이벤트를 써서 값을 일괄 설정하고 「넣기」를 실제 탭한다(`evidence/PICK-ISSUE-01/client/tools/pickline.sh`).
- **고정 하단 바(「출고 확정」·「입고 확정」)가 스크롤 전 상태에서 위 버튼을 일부 덮는다.** `uiautomator` bounds 중앙 탭이 바에 떨어져 무반응이 된다. 스와이프로 끝까지 내린 뒤 CDP `elementFromPoint`로 겹침이 없는지 확인하고 버튼 상단 쪽을 탭한다(D3로 클라이언트 수정 배정).
- **숫자 키패드 「0」이 화면 아래로 밀려 탭이 실패**해도 `mob.sh tap`은 조용히 실패한다. 자리마다 `tapped` 응답을 확인하고 실패 시 스크롤 후 재시도한다. 입력 후 CDP로 `input.value`를 읽어 대조한다.
- **서버(nest watch) 재기동은 관리자 웹 세션을 지운다.** 담당이 src를 바꾸면 헤드리스 Chrome의 API 호출이 `PERMISSION_DENIED "로그인이 필요합니다"`로 바뀐다. 시연 전 `fetch` 상태 코드로 확인하고 `typeInto("아이디")`·`typeAdminPassword("비밀번호")`로 재로그인한다.
- 에뮬레이터를 `-no-window`로 재기동하면 스냅샷 부팅으로 앱·SecureStorage 토큰이 남는다. 앱 프로세스가 바뀌면 `adb forward tcp:9444 localabstract:webview_devtools_remote_<pid>`를 다시 걸고 observer를 재기동해야 `/eval`이 새 WebView에 붙는다.
## 13. 조작 함정 (WIP-CHAIN-01)

### POP

- **스캔 칸 Enter 는 `text` 를 함께 보내야 폼이 제출된다.** CDP `Input.dispatchMouseEvent` 로 값을 넣은
  뒤 `Input.dispatchKeyEvent{type:'keyDown', key:'Enter', code:'Enter', windowsVirtualKeyCode:13}` 만
  보내면 아무 일도 일어나지 않는다. **`text: "\r"` 을 함께 실어야** 문자 입력으로 해석돼 제출이 돈다
  (`keyDown` → `char` → `keyUp` 순서로 보내도 된다). 값만 넣고 Enter 가 먹지 않아 「스캔이 안 된다」로
  오판하기 쉬운 자리다.
- **POP 새로고침은 주소를 유지한다.** `Page.reload` 하면 `pop://app/pop/...` 그대로 다시 서고, 화면이
  다시 그려지는 사이에 보낸 키패드 입력이 **엉뚱한 칸**(직전 화면의 포커스 자리)에 들어간다. 새로고침
  뒤에는 ① 화면 텍스트로 어느 화면인지 확인하고 ② 목표 입력칸을 클릭해 포커스를 잡은 뒤 입력한다.
- **셸이 명령형(RAW) 인쇄를 할 수 있는지 먼저 묻는다.** `window.pop.printers.capabilities()` 가
  `{raw:false}` 면(현재 macOS) 화면은 `png` 를 요청하고 가상 큐로 찍는다. `{raw:true}`(Windows)면
  `tspl` 이다. 인쇄가 「보낼 프린터를 찾을 수 없다」로 멎으면 이 값부터 본다(WIP-CHAIN-01 D6).
- **중계 응답은 이제 `Cache-Control: no-store` 로 온다**(D4). 그 전에는 렌더러가 `pop://app/api/...`
  응답을 디스크 캐시에 두고 **셸을 다시 띄워도** 옛 값을 내줬다 — 단말 권한을 DB 에서 고쳤는데 화면이
  안 바뀌면 옛 빌드인지부터 확인한다. 급할 때의 확인법은 `?_=Date.now()` 를 붙여 보거나 CDP
  `Network.clearBrowserCache` 다.
- **CDP `Page.navigate` 가 같은 주소로는 응답하지 않을 수 있다.** 같은 URL 로 이동을 보내면 명령이
  끝나지 않아 스크립트가 멎는다. 주소가 이미 목표면 이동을 건너뛰고, 필요하면 `Runtime.evaluate` 로
  `location.replace(...)` 를 쓴다.

### 모바일

- **타일이 화면 밖이면 탭이 조용히 빗나간다.** 홈 화면의 업무 타일은 목록이 길어 아래쪽 항목이
  뷰포트 밖에 있고, `uiautomator` bounds 로 계산한 좌표를 탭하면 다른 것이 눌리거나 아무 일도
  일어나지 않는다. **CDP 로 `scrollIntoView({block:'center'})` 한 뒤** bounds 를 **다시 읽어** 탭한다.
- **`uiautomator dump` 는 첫 회가 비거나 낡은 내용을 준다.** 화면 전환 직후 한 번은 버리고 다시 뜬다
  (또는 `adb shell uiautomator dump /dev/tty` 를 두 번 부른다). 첫 회 결과로 좌표를 잡으면 이전 화면의
  자리를 누른다.

### 공통

- 위 두 가지(스캔 Enter·타일 스크롤)는 **제품 결함이 아니라 조작 방식의 문제다.** 실기 스캐너와 사람 손은
  같은 문제를 겪지 않는다 — 증거에는 「조작 대체」로 표기한다.

- **관리자 웹 W-02-08 W/O 진행현황은 계획 시작일 범위를 항상 실어 조회한다** — 계획 시작일이 비어 있는 W/O(전개 직후 4M 배정 전)는 조회되지 않는다. 진행 상태 확인은 W-02-05 W/O 마감의 「마감 상태 = 진행」 조회로 한다(WIP-CHAIN-01 S13).

## 14. 실기기·환경 함정 (ISSUE-QR-01, 2026-09-16)

### USB 실기기(에뮬레이터 대체)

- **에뮬레이터는 메모리를 크게 먹는다(qemu 약 0.9GB + 부하).** 머신이 빠듯하면 USB 실기기로 바꾼다. `adb devices` 에 `unauthorized` 면 기기 화면의 「USB 디버깅 허용」을 눌러야 한다.
- **실기기는 `10.0.2.2` 를 쓸 수 없다.** APK 를 `VITE_API_BASE_URL=http://127.0.0.1:3100/api` 로 굽고 `adb -s <serial> reverse tcp:3100 tcp:3100` 을 건다 — Wi-Fi 없이 USB 만으로 이 Mac 의 서버에 닿는다. **adb 데몬이 재시작되면 reverse 가 사라진다**(`* daemon started successfully` 가 보이면 다시 건다). 기기에서 `curl http://127.0.0.1:3100/api/health` 로 확인.
- **서명이 다른 기존 앱이 있으면 `install -r` 이 `INSTALL_FAILED_UPDATE_INCOMPATIBLE` 로 막힌다.** `adb uninstall <pkg>` 뒤 새로 설치한다(앱 데이터도 함께 지워진다).
- 실기기의 야간 모드는 `adb shell cmd uimode night` 로 보고 `night no` 로 끈다.

### 관리자 웹 vite 는 프록시 주소가 필요하다

- `apps/web/.env.local` 이 없으면 vite 가 `/api` 프록시 없이 떠서 **`/api/*` 가 SPA index.html 로 떨어진다**(GET 은 HTML 200, POST 는 404 빈 본문). 화면에는 「서버에 닿지 못해…」·「서버 오류」만 뜬다. `VITE_API_PROXY_TARGET=http://localhost:3100 VITE_API_BASE_URL=/api pnpm --filter @omf-mes/web dev --port 5173` 으로 띄운다. 확인은 `curl -X POST localhost:5173/api/app/sessions` 가 401(JSON)인지.

### macOS 가상 프린터 큐

- `lpadmin -m raw` 는 **macOS 에서 더는 안 된다**(`Raw queues are no longer supported`). 검증된 것은 `lpadmin -p OMF-VIRTUAL-LABEL -E -v socket://127.0.0.1:9100 -m drv:///sample.drv/generic.ppd` + `lpoptions -d OMF-VIRTUAL-LABEL`. 장치 주소에 아무것도 없어 실제 출력은 없고 스풀 성공으로 끝난다.
- POP 셸은 인쇄 전에 렌디션을 `~/Library/Application Support/@omf-mes/pop/renditions/*.png` 로 먼저 저장한다 — 라벨 이미지 증거는 여기서 수거한다(`logs/print.log` 도 함께).

### 헤드리스 Chrome 에서 클립보드로 토큰 받기

- W-CO-06 「등록 코드 복사」는 `navigator.clipboard.writeText` 라 헤드리스에서는 권한이 없다. CDP `Browser.grantPermissions({origin:'http://localhost:5173', permissions:['clipboardReadWrite','clipboardSanitizedWrite']})` 를 먼저 준다. 토큰 원문은 operator 메모리에만 두고 기록하지 않는다.

### 렌더러가 실제로 받은 응답을 보는 법

- 화면이 「불러오지 못했습니다」만 말할 때 원인은 **CDP `Network.enable` + `Network.responseReceived` 로 잡는다**(`scratchpad/pop-netcap.mjs` 패턴: 버튼 클릭 → 4xx 본문 `Network.getResponseBody`). 헤더는 읽지 않는다. 렌더러에서 `fetch('/api/…')` 를 직접 부르면 단말 토큰이 붙지 않아 401 만 나오므로 진단에 쓰지 않는다.
- 이번에 이렇게 잡은 것 둘: ① `issuedAtFrom` 에 date-time 을 보내 400(`must match format "date"`) — 계약 `format: date` 는 `YYYY-MM-DD`, UTC 절단이 아니라 현지 날짜로. ② `targetIds=1,2,3`(계약 explode false) 을 서버 단말 범위 검사가 id 하나로 읽어 401 — 가드 순서상 계약 검증기의 쉼표 분해가 뒤에 돌기 때문(서버 D7).

### 메모리 압박

- 부하 루프·vitest 반복이 다른 세션에서 돌면 load average 100 이상이 되고 **서버 watch 프로세스가 OS 에 정리된다.** 시나리오 실행 중에는 서버를 `pnpm build` → `node dist/main.js` 로 띄운다(프로세스 1개, tsc watch 없음, RSS 약 300MB). 이때 소스 수정은 반영되지 않으므로 결함 수정 뒤 빌드·프로세스 교체(약 40초 끊김)가 필요하다.
- 전체 web 시험(1.9만 건)은 부하 중에는 돌리지 않고, 사용자 직접 테스트가 급하면 빌드를 먼저 한다 — 필수 검증은 완료 판정 조건이지 수동 테스트 착수 조건이 아니다.

### 담당 세션이 멈춘 것처럼 보일 때

- 담당 세션이 「진행 중」이라 보고했는데 해당 작업트리에서 도는 프로세스가 0건이면 백그라운드 셸이 끝났거나 통보를 놓친 것이다. `ps` 로 확인하고 포그라운드로 다시 돌리게 한다. 상대경로 로그 리다이렉션이 `cd` 뒤에 실패해 조각 시험이 한 번도 돌지 않은 사례가 있었다(절대경로로).

### 시드 데이터로 만든 자재·위치 QR

- 자재 LOT QR 은 **LOT 번호 원문**, 위치 QR 은 **위치 코드 원문**이다(통보 277 · 모바일 `useLocationByCode`). 시험용 이미지는 cv2 `QRCodeEncoder` 로 만들고 `QRCodeDetector` 로 되읽어 대조한다(`scratchpad/make-qr.py`, `qrdecode.py`). 출고 QR 은 접두어 있는 `OMF-GIL|<goodsIssueLineId>|<출고번호>|<라인번호>` 라 서로 섞이지 않는다.
