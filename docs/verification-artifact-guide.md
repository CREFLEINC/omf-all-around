# OMF MES 개선 검증 Artifact 작성 가이드

개발이 끝난 개선 항목을 **직접 조작해 검증하고, 그 결과를 한 장의 웹 페이지(claude.ai Artifact)로 정리**하는 방법이다.
누가 만들어도 구성과 판정 기준이 같도록 정한 규칙이다. 사람이 직접 쓰든 Claude Code 에 맡기든 이 문서를 기준으로 한다.

- 이 가이드로 만든 실제 페이지(「OMF MES 개선 검증」)는 고객 정보가 들어 있어 팀 안에서만 따로 공유한다.
- 바로 시작하려면 §0 을 확인하고 [부록 A 시작 템플릿](#부록-a-시작-템플릿)을 복사해 `index.html` 로 저장한다.
- 이 문서의 예(화면 코드 `W-02-03`, `4M`, `W/O`, 요구 번호 `C27` 등)는 OMF MES 프로젝트의 것이다. 다른 프로젝트에서는 그 프로젝트의 이름으로 바꿔 읽는다.

---

## 0. 시작 전 준비

### 0-1. 꼭 있어야 하는 것

| 항목 | 값 (OMF MES 기준) |
|---|---|
| 이슈 저장소 | 요구 번호·이슈 번호가 있는 곳 — GitHub `CREFLEINC/omf-all-around` |
| 저장소 | client `omf-mes-client` (관리웹·POP·모바일) · server `omf-mes-server` |
| 필요한 도구 | Claude Code (팀 claude.ai 계정으로 로그인 — Artifact 게시에 필요) · Node.js·pnpm · Python 3 + Playwright (`pip install playwright && playwright install chromium`) |
| 단위 시험 명령 | client: `pnpm --filter @omf-mes/web exec vitest run <경로>` · server: `npx jest <경로>` |
| 기본 주소 | 관리웹 `:5173` · POP `:5174` · API `:3100` (health: `/api/health`) |

### 0-2. 각자 정하는 것 (선택)

아래 다섯 가지는 사람마다 쓰는 방식이 달라도 된다. 쓰는 것이 있으면 기록(정본 기록 또는 Artifact) 맨 앞에 적어 두고, 없으면 «없을 때» 대로 한다. 페이지 머리말의 `meta` 줄에 무엇을 쓰는지 한 번 밝혀 두면 읽는 사람이 헷갈리지 않는다.

| 항목 | 쓸 때 | 없을 때 |
|---|---|---|
| **정본 기록** — 검증 결과·발견·남은 데이터를 먼저 적어 두는 자기 기록 (Obsidian·Notion·사내 위키 등 무엇이든) | 결과를 거기에 먼저 적고 Artifact 로 옮긴다. 둘이 다르면 그 기록이 기준 | **Artifact 가 곧 기록이다.** 결과를 Artifact 에 바로 적는다 |
| **개발 계획** — 이슈별 순서·예상 시간이 적힌 문서 | 현황 표 «계획 요일» 을 그 순서·시간으로 채운다 (§5) | 현황 표에서 «계획 요일» 칸을 빼거나, 검증한 날짜를 적는다 |
| **시험 서버** — 검증할 커밋이 떠 있는 곳 (자기 PC 든 팀 서버든) | 주소와 «누가 체크아웃을 바꾸는지» 를 적는다 | 자기 PC 에서 직접 띄운다 — 이 문서의 «시험 서버» 는 그 PC 를 뜻한다. 이때도 검증하는 동안 체크아웃을 바꾸지 않는다 |
| **시험 계정** — 로그인할 계정과 비밀번호 받는 곳 | 비밀번호는 정한 환경변수 이름(예: `MES_ADMIN_PASSWORD`)으로만 쓴다 | 자기 시험 환경의 관리자 계정을 쓴다. 비밀번호를 스크립트·기록에 직접 쓰지 않는 것은 같다 |
| **역할 담당** — 개발·검증·데이터를 누가 맡는지 (§2) | 사람 이름이나 Claude Code 세션 이름을 적는다 | 혼자 다 해도 된다. 다만 판정은 개발한 사람이 아닌 쪽(다른 사람이나 별도 Claude Code 세션)이 적는다 |

이 문서에서 «기록» 이라고 하면 **정본 기록을 쓰면 그 기록, 안 쓰면 Artifact** 를 뜻한다.

---

## 1. 이 페이지가 하는 일

| 보여 주는 것 | 왜 |
|---|---|
| 주차별 개선 항목과 상태 | 무엇이 끝났고 무엇이 남았는지 한눈에 |
| 항목마다 «기존 동작 → 기대 동작 → 실제 확인 결과» | 개발자의 설명이 아니라 직접 조작한 결과로 판정 |
| 기존·개선 화면 비교 | 화면이 어떻게 바뀌었는지 말없이 전달 |
| 검증 중 발견한 문제, 남은 시험 데이터 | 후속 조치와 데이터 정리의 근거 |

Artifact 와 정본 기록의 관계는 §0-2 를 따른다.

---

## 2. 역할

사람이 맡아도 되고 Claude Code 세션이 맡아도 되며, 한 사람이 여러 역할을 맡아도 된다(§0-2). 단, **개발한 쪽은 자기 결과의 판정을 적지 않는다.** 혼자 개발과 검증을 다 해야 하면 검증은 별도의 Claude Code 세션에 맡기고, 개발한 쪽은 판정 칸에 `pill wait` 「판정 대기」 를 둔다.

- 개발 담당이 따로 없으면 완료 알림 대신 **PR 의 마지막 커밋**을 검증 대상으로 하고, 회신 단계는 건너뛴다.
- 데이터 담당이 따로 없으면 직접 하되, 바꾸기 전에 백업하고 전후 값을 「남은 시험 데이터」 표에 적는다.

| 역할 | 하는 일 | 하지 않는 일 |
|---|---|---|
| 개발 담당 | 이슈별 브랜치(git worktree)에서 개발 → PR → 검증할 커밋을 **시험 서버**(§0-2)에 체크아웃하고 재빌드·마이그레이션까지 마친 뒤 **완료 알림** | 검증 중 시험 서버의 체크아웃 변경 |
| 검증 담당 | 데이터 준비 → 기존 화면 캡처 → 직접 조작·API 로 확인 → 기록·Artifact 작성 → **검증 완료 회신** | 코드 수정, SQL 로 DB 직접 쓰기 |
| 데이터 담당 | 시험 데이터 생성·변경·원복 (변경 전 백업, 전후 값 회신) | — |

- 검증 담당도 **API 로 시험 데이터를 만드는 것은 된다**(화면 조작으로 생기는 데이터 포함). 만든 것은 「남은 시험 데이터」 표에 적는다. API 로 만들 수 없는 상태(일부러 깨진 데이터 등)만 데이터 담당에게 요청한다.
- 자기 권한으로 막힌 작업을 다른 담당에게 넘길 때는 (책임자가 있으면) 책임자에게도 알린다.

### 완료 알림에 넣을 것 (개발 → 검증)

1. 대상 커밋 — `server = <해시>`, `client = <해시>`, PR 번호
2. 재시작·마이그레이션 여부 (마이그레이션 이름)
3. 기존 동작 → 기대 동작 (번호를 붙여 항목별로)
4. 확인 경로 (화면 코드·메뉴·URL) 와 필요한 데이터
5. 알려진 문제 (예: main 에서도 실패하는 테스트)

### 데이터 요청 형식 (검증 → 데이터)

```
1. 무엇을: 대상 테이블·ID 또는 화면 기준 상태 (데이터 담당은 API 로 되면 API 로, 안 되는 것만 SQL 로)
2. 왜: 이슈 번호와 확인할 화면·응답
3. 되돌리기: 끝난 뒤 원복할지
```

---

## 3. 검증 한 건의 순서

| 단계 | 할 일 | 남길 것 |
|---|---|---|
| 1 | 검증 대상 커밋(완료 알림 또는 PR 마지막 커밋)이 시험 서버 체크아웃과 같은지, 서버 health 확인 | 커밋 해시 |
| 2 | 필요한 데이터 준비 (직접 API 로, 또는 데이터 담당에게 요청 §2) | 요청·회신 내용 |
| 3 | **기존 화면 먼저 캡처.** 시험 서버를 개선 코드로 바꾸기 전이면 그대로 찍고, 이미 바뀌었으면 개선 전 커밋(병합 전이면 `origin/main`, 병합 후면 병합 직전 커밋)을 임시 포트에 띄워 같은 데이터·같은 조작으로 찍는다 (§7-3) | `shots/<이슈>-<무엇>-before.png` |
| 4 | 화면 조작과 값 확인 (§4) | 단계별 결과와 시간 |
| 5 | 서버 검사는 API 로 정상·오류 경우를 모두 | 상태 코드, 오류 `field`·`code`·메시지 |
| 6 | 관련 단위 시험 실행(§0-1 명령), 추가된 주석 리뷰(§9) | 통과 건수·시간, 지적 |
| 7 | 새로 발견한 문제는 기록에 발견 번호를 붙여 적는다. 번호는 기록(또는 Artifact 「검증 중 발견」 표)의 마지막 F 번호 다음 — 한 페이지를 여럿이 같이 쓰면 먼저 적은 사람이 번호를 가진다 | F 번호 |
| 8 | 기록·Artifact 갱신(§5~§8) → (개발 담당이 따로 있으면) **검증 완료**와 결과·리뷰 메모·Artifact URL 회신 | — |
| 9 | PR 이 병합되면 리뷰 반영분을 main 에서 다시 확인하고 «병합» 표시 | 병합 커밋 |

---

## 4. 확인 방법

### 4-1. 무엇으로 확인하나

| 확인할 것 | 쓰는 것 | 결과 표 «방법» 칸 |
|---|---|---|
| 화면 이동, 버튼 누르기 | Playwright(Python) 스크립트 — 사람이 하는 조작을 그대로 재현 | `스크립트` |
| 칸에 들어간 값, 목록 건수, 날짜 | 같은 스크립트로 화면 값을 직접 읽는다 | `스크립트` |
| 저장 결과, 서버 검사 | API 호출 (curl 등) | `API` |
| 데이터 담당이 바꾼 상태에서의 동작 | 데이터 변경 뒤 API·스크립트 | `데이터 변경 → API` |
| 회귀 | 단위 시험 | (표 아래 `note` 에) |

- 숫자·날짜·개수는 반드시 화면 값이나 API 응답으로 단언한다. 도구가 «완료» 라고 판단한 것만으로 통과라고 쓰지 않는다.
- (선택) AI 가 목표를 받아 브라우저를 대신 조작하는 도구를 쓸 수 있다(이 문서는 특정 도구를 전제하지 않는다). 쓸 때는 **성공 조건(화면에 보여야 할 셀렉터)을 꼭 주고**, 도구가 멈추면(성공 조건 미확인·진행 불가·사람 확인 필요) 우회하지 말고 화면 구조부터 본다. 원인이 화면 구조(이름 없는 버튼 등)이면 그 단계만 스크립트로 하고 화면 구조 문제는 발견으로 적는다. 결과 표 «방법» 칸에는 `브라우저 자동화` 로 적는다.

### 4-2. 시간 기록

단계마다 걸린 시간을 적는다. 스크립트의 시작·끝 시각(자동화 도구를 쓰면 그 도구가 보고한 시간)을 쓴다. 시간을 재려고 대기(sleep)를 넣거나 조작 순서를 바꾸지 않는다. 표의 «시간» 칸에 `s` 단위로.

### 4-3. 비밀값

비밀번호·토큰은 환경변수로만 넘긴다. 명령·스크립트·기록·캡처에 값이 보이면 안 된다. 브라우저 자동화의 기록(trace) 파일은 저장소에 올리지 않는다.

### 4-4. 자주 걸리는 곳 (OMF MES 기준, 코드는 Python Playwright)

| 증상 | 원인 → 대처 |
|---|---|
| 쓰기 API 400 「Idempotency-Key 헤더가 필요합니다」 | 모든 쓰기 요청에 `Idempotency-Key` (UUID) 헤더 |
| 확정·수정 400 「If-Match 헤더가 필요합니다」 | 상세 조회 응답의 `ETag` 값을 `If-Match` 헤더로 |
| 수정 API 가 필수 칸 누락으로 400 | PUT 은 전체 본문이다 — 상세를 읽어 필요한 칸을 모두 싣는다 |
| zsh 에서 URL 이 `…/3onfirm` 처럼 깨짐 | `$ID:confirm` 의 `:c` 를 변수 수식어로 읽음 → `${ID}:confirm` |
| 파이썬 스크립트가 시작부터 import 오류 | 파일 이름이 표준 모듈과 같음(`inspect.py` 등) → 이름을 바꾸고 `python -I` 로 실행 |
| 날짜를 못 고름 | 달력 칸이 이름 없는 셀 → `td[data-date="2026-10-20"]` 로 직접 지정 |
| 확인 창 버튼을 못 누름 | 바깥 버튼과 확인 창 버튼 이름이 같음 → 대화상자 안에서 찾는다 `get_by_role('dialog').last.get_by_role('button', name=…)` |
| 선택 목록에 값이 안 들어감 | 네이티브 select 가 아닌 버튼형 콤보 → 콤보를 눌러 펼친 뒤 `get_by_role('option')` 을 누른다 |
| 체크박스 클릭이 가로막힘 | 장식 요소가 클릭을 가로챔 → `check(force=True)` |
| 새로 추가한 줄의 라벨 번호가 예상과 다름 | 기존 줄 수에 따라 번호가 바뀜 → 정규식 `^신규 계획 \d+ 계획일$` + `.last` |
| 선택 칸에 「알 수 없음」 | 선택 목록이 첫 페이지만 불러와 이름을 못 찾음 — 데이터 문제가 아닐 수 있음 |
| 날짜 경계(자정 전후) 확인 | 브라우저 시간대 지정(`timezone_id`) + 시계 고정(`page.clock.install`) |
| 로그인이 풀림 | 시험 계정(§0-2)으로 다시 로그인한다. 스크립트는 로그인 상태를 저장한 브라우저 프로필(`launch_persistent_context`)을 쓰면 매번 로그인하지 않아도 된다 |

---

## 5. 페이지 구성 (순서 고정)

```
머리말           제목 · 한 줄 설명 · 갱신일 · 검증 기간 · 정본 기록: 쓰는 곳 이름 또는 「이 페이지」
주차 현황         (계획 요일) | 이슈 | 요구 | 내용 | 화면 | 범위 | 상태   + 상태 집계
이슈 섹션 × N     진행 순서대로 (이슈 번호 순이 아님)
검증 중 발견      F-NN 표
남은 시험 데이터   공유 DB 에 남긴 것
검증 방식         이 페이지가 어떻게 만들어졌는지
```

- «요구» 칸은 고객 요구 번호(OMF MES: `C27`, `S21` 등 — 이슈 본문에 있다).
- «계획 요일» 은 개발 계획(§0-2)을 쓸 때만 둔다. 계획의 예상 시간을 하루 8시간씩 월요일부터 차례로 배정해 나온 요일이고, 실제 날짜가 다르면 상태에 `(금 10/16)` 처럼 실제 날을 붙인다. 계획이 없으면 이 칸을 빼거나 «검증일» 로 바꾼다.
- «주차» 는 계획이 있으면 계획의 주차, 없으면 검증한 주(월~금)다.
- 새 주차가 시작되면 현황 표를 주차별로 하나 더 만든다. 지난 주 표는 지우지 않는다.
- 이슈 번호 칸은 해당 섹션으로 링크한다: `<td class="mono"><a href="#s-93">#93</a></td>`

---

## 6. 이슈 섹션

### 6-1. 뼈대

```html
<section class="issue" aria-labelledby="s-93">
  <div class="issue-head">
    <span class="no">#93 · C27</span>
    <h2 id="s-93">4M 화면 기본 위치 카드 — W-02-03 · W-05-12</h2>
    <span class="pill pass">통과 · 병합</span>
  </div>
  <dl class="facts">
    <div><dt>무엇이 바뀌나</dt><dd>사용자가 보는 변화로 한두 문장</dd></div>
    <div><dt>검증 코드</dt><dd class="mono">server 55c97d2 · client 7f9de10 → 병합 5c8fd75 · d684beb</dd></div>
    <div><dt>시험 데이터</dt><dd>생산오더 → 계획 → W/O 번호 순으로</dd></div>
  </dl>
  <h3>기존 동작 (main)</h3>
  <ul><li>…</li></ul>
  <h3>개선 후</h3>
  <div class="scroll"><table>…결과 표(§6-2)…</table></div>
  <details class="compare">…화면 비교(§7)…</details>
  <p class="note">단위 시험: … 통과(… s). 리뷰 메모: …</p>
</section>
```

- `id` 는 `s-<이슈번호>`. 커밋 해시는 7자리로 통일한다.
- 제목은 `<기능 이름> — <화면 코드>`. 화면을 따라가는 흐름이면 `W-02-02 → W-02-03 → W-02-04`.
- 단계가 나뉜 이슈는 섹션 하나 안에 `<h3>3단계 — …</h3>` 로 단계별 표와 비교를 이어 붙인다.
- 같은 이슈를 다시 검증하면 기존 줄을 지우지 말고 «1차 → 재검증» 이 보이게 고친다.

### 6-2. 결과 표

```html
<div class="scroll"><table>
  <thead><tr><th>확인</th><th>방법</th><th>결과</th><th>시간</th><th>판정</th></tr></thead>
  <tbody>
    <tr><td>다른 공장 위치 넣기</td><td>API</td><td>400 「이 공장의 위치가 아닙니다.」</td>
        <td class="time">&lt;1 s</td><td><span class="pill pass">통과</span></td></tr>
  </tbody>
</table></div>
```

| 칸 | 쓰는 법 |
|---|---|
| 확인 | 기대 동작을 짧게. «라인 지정 계획 확정», «다른 공장 위치 넣기» |
| 방법 | §4-1 표의 «방법» 칸 값 중 하나 |
| 결과 | **관찰한 값 그대로.** 상태 코드, 화면 문구(「」), 건수, 날짜 |
| 시간 | `13 s` · `<1 s` · `—`(잴 수 없음). 한 번의 실행으로 여러 줄을 확인했으면 같은 값을 반복 |
| 판정 | 상태 표시 (§6-3) |

- 확인하지 못한 항목도 지우지 않는다. `미확인` 으로 남기고 이유(데이터 없음, 권한 막힘 등)를 쓴다.
- 기존·개선을 한 표에서 견줄 때는 `확인 | 기존 | 개선 | 시간 | 판정` 으로 칸을 바꿔도 된다.

### 6-3. 상태 표시 — 네 가지 (+ 표시 없음)

| 클래스 | 표시 글자 예 | 언제 |
|---|---|---|
| `pill pass` | `통과` / `통과 · 병합` / `수정 확인` / `반영 확인` | 기대대로 동작함을 확인 |
| `pill warn` | `버그` / `참고` / `의도 확인 중` / `1~3단계 통과 · ④⑤ 남음` | 결함, 판단이 필요한 차이, 일부만 끝남 |
| `pill skip` | `미확인` | 데이터·권한 때문에 확인 못 함 |
| `pill wait` | `대기` / `판정 대기` | 아직 검증 전, 또는 개발한 쪽이 적어 둔 판정 전 줄 |
| (표시 없음) | — | 판정이 의미 없는 줄 |

빨강(실패)은 쓰지 않는다. 결함은 `warn` + `버그` 로 쓰고 발견 번호를 붙인다. 고쳐지면 `pass` + `수정 확인` 으로 바꾼다.

### 6-4. 문장

- 사용자가 화면에서 보는 말로 쓴다. 코드 이름은 근거가 필요할 때만 `code` 로.
- 화면 문구·버튼 이름은 화면 그대로 「」 안에.
- 차이는 «기존: … → 개선: …» 한 줄로.
- 리뷰 메모는 «차단 아님» 여부를 밝히고, 반영되면 `반영 확인` 으로 바꾼다.
- 작업자 이름·사번·연락처 같은 개인정보는 쓰지 않는다.

---

## 7. 화면 비교

### 7-1. 구조

이슈 섹션 안의 `<details class="compare">` 를 펼치면 비교 항목마다 **[기존] [개선] 버튼으로 전환**된다. 처음에는 개선 쪽이 보인다.

```html
<details class="compare">
  <summary>화면 비교</summary>
  <div class="compare-body">
    <div class="cmp" id="c93a">
      <div class="cmp-head"><span class="cmp-title">W-02-03 위치 카드</span>
        <span class="seg" role="group" aria-label="W-02-03 위치 카드 화면 전환">
          <button type="button" data-show="b" aria-pressed="false">기존</button>
          <button type="button" data-show="a" aria-pressed="true">개선</button></span></div>
      <div class="frame" data-side="b" hidden><img src="shots/93-4m-location-before.png" alt="W-02-03 위치 카드 — 기존" loading="lazy"></div>
      <div class="frame" data-side="a"><img src="shots/93-4m-location-after.png" alt="W-02-03 위치 카드 — 개선" loading="lazy"></div>
      <p class="cmp-note">기존: 카드 이름 「Material」 → 개선: 「Location」</p>
    </div>
  </div>
</details>
```

- 전환 스크립트는 템플릿 맨 끝에 하나만 있다. 비교 항목을 늘려도 스크립트는 그대로 둔다.
- `id` 는 `c<이슈><a, b, c…>` — 페이지 안에서 겹치지 않게.
- 기존 캡처가 없으면 그림 대신 이유를 쓴다:
  `<div class="frame noshot" data-side="b" hidden>기존 캡처 없음 (기존에는 일괄 배포가 없음)</div>`

### 7-2. 캡처 규칙

| 규칙 | 내용 |
|---|---|
| 파일명 | `<이슈>-<무엇>-before.png` / `-after.png` (예: `92-4m-plan-night-after.png`). 단계가 나뉘면 `74c-…` 처럼 접미 |
| 같은 조건 | 같은 데이터·같은 조작·같은 창 크기로 기존과 개선을 찍는다. 부득이 다른 데이터를 쓰면 `cmp-note` 에 밝힌다 |
| 잘라 내기 | 전체 화면이 아니라 바뀐 카드·표·목록만. 카드 제목까지 들어가게 (Playwright `screenshot(clip=…)`) |
| 펼친 상태 | 선택 목록·달력처럼 펼쳐야 보이는 것은 펼친 상태로 (입력칸과 목록을 한 장에) |
| 시간대 | 공장 시각과 다른 시간대의 브라우저로 찍으면 시각 처리 차이가 드러난다 (OMF MES: 공장 베트남 UTC+7, 브라우저 한국 UTC+9) |
| 개인정보 | 작업자 이름·사번이 보이는 캡처는 넣지 않거나 가린다 |
| 크기 | 그림 한 장은 수백 KB 이내. 전체 페이지 캡처는 피한다 |

### 7-3. 시험 서버가 이미 개선 코드일 때 (OMF MES client 기준)

시험 서버의 체크아웃은 건드리지 않고, **이전 커밋을 별도 폴더(git worktree)로 꺼내 임시 포트에 띄운다.** API·DB 는 지금 것을 그대로 쓴다.

```bash
cd <client 저장소>
BEFORE=$(git rev-parse <개선이 들어간 병합 커밋>^1)      # 병합 후: 병합 직전 main
# BEFORE=origin/main                                   # 병합 전이면 이것
git worktree add --detach ../verify-before $BEFORE
cp apps/web/.env.local ../verify-before/apps/web/        # 로컬 API 주소 설정
cd ../verify-before && pnpm install --frozen-lockfile --prefer-offline
pnpm --filter @omf-mes/web dev --port 5191 --strictPort &
# … http://localhost:5191 에서 같은 조작으로 캡처 …
kill $(lsof -ti tcp:5191 -sTCP:LISTEN)
cd <client 저장소> && git worktree remove ../verify-before --force
```

- 이 방법은 **화면(client) 변경**에만 맞다. 서버 동작이 바뀐 개선은 옛 화면만으로 기존 동작을 재현할 수 없고, 옛 화면이 새 API 와 맞지 않아 깨질 수도 있다. 그럴 때는 «기존 캡처 없음 (서버 변경)» 으로 쓴다.
- 로그인: 쿠키로 로그인하는 앱(OMF MES 관리웹)은 쿠키가 포트를 가리지 않아 원래 포트에서 로그인한 브라우저 상태로 들어간다. 토큰을 브라우저 저장소에 두는 앱이면 임시 포트에서 다시 로그인한다.
- 데이터는 개선 후 상태라 «화면 차이»만 보인다. 이 점을 페이지의 「검증 방식」에 적는다.
- 임시 서버는 캡처가 끝나면 바로 내린다.

---

## 8. 게시

Claude Code 에서 게시한다(§0-1 — 팀 claude.ai 계정으로 로그인). 사람이 HTML 을 직접 썼어도 게시는 Claude Code 에 말로 맡긴다.

| 상황 | Claude 에게 이렇게 말한다 |
|---|---|
| 새 페이지 | «`index.html` 을 Artifact 로 게시해 줘. 그림은 `shots/` 에 있어» → URL 이 생긴다. 이후 같은 파일로 다시 게시하면 같은 URL 이 유지된다 |
| 남이 만든 페이지를 이어 쓸 때 | 먼저 소유자에게 Share 메뉴에서 **편집 권한**을 받는다. 그다음 «이 URL 을 읽어 줘» → 편집 가능(writer)으로 나오는지 확인 → 받은 내용 위에 고쳐 «이 URL 로 다시 게시해 줘». URL 을 지정하지 않거나 편집 권한이 없으면 새 페이지가 따로 생긴다 |
| 그림을 넣을 때 | «`index.html` 이 있는 폴더 기준으로 `shots/` 의 새 그림만 같이 올려 줘». 이미 올린 그림은 다시 보내지 않아도 남는다. **보내지 않은 그림은 페이지에 나오지 않는다** |
| 작은 고침 | «이 문장만 바꿔서 다시 게시해 줘» |

- 게시할 때 바꾼 내용을 짧은 이름으로 남긴다 (`#93 검증 추가`, `F-37 수정 확인`).
- 새 페이지는 비공개로 만들어진다. 공유 범위는 소유자가 Share 메뉴에서 바꾼다. 「링크가 있는 사람」으로 열어 두면 게시하는 즉시 보는 사람에게 바뀐 내용이 보인다.
- 로컬 브라우저로 `index.html` 을 열면 게시본과 다르게 보인다(문서 머리가 게시할 때 붙기 때문). 확인은 게시한 페이지에서 한다.
- 정본 기록을 따로 쓰면, 게시 뒤 그 기록과 숫자·상태가 같은지 한 번 대조한다.

---

## 9. 주석 리뷰 기준

검증 리뷰에서 새로 추가된 주석을 이 기준으로 본다.

- 주석에는 «왜» 와 지켜야 할 제약만. 코드가 무엇을 하는지는 쓰지 않는다.
- 이슈·PR 번호, 작업 경위, «이전엔 ~였다» 같은 이력은 커밋 메시지로. 예외: 우회 코드·TODO 처럼 제거 조건을 알려 줄 때.
- 코드가 바뀌면 틀려지는 숫자(개수)는 쓰지 않는다.
- 다른 코드를 가리킬 땐 이슈 번호 대신 파일·함수·테스트 이름으로.

client·server 저장소에서 각각 실행한다:

```bash
B=$(git merge-base HEAD origin/main)
git diff $B HEAD -- '*.ts' '*.tsx' ':!*.test.*' ':!*.spec.ts' | grep -E "^\+\s*(//|/?\*)" | grep -E "#[0-9]|이전|였다|[0-9]+ ?(개|건|곳)"
```

걸린 줄은 사람이 다시 읽고 판단한다 (시험 데이터 설명처럼 괜찮은 경우도 있다).

---

## 10. 마감 점검표

- [ ] 검증 대상 커밋 = 시험 서버 체크아웃
- [ ] 데이터 준비 → 기존 화면 캡처 (또는 「기존 캡처 없음」 + 이유)
- [ ] 기대 동작마다 결과 표 한 줄 (미확인 포함)
- [ ] 숫자·날짜·개수는 API·화면 값으로 확인한 것
- [ ] 단계별 시간
- [ ] 단위 시험 건수·시간, 주석 리뷰
- [ ] 새 발견은 F-NN 으로 페이지 「검증 중 발견」 표에 (정본 기록을 쓰면 거기에도)
- [ ] 만든·바꾼 데이터를 「남은 시험 데이터」 표에 (원복했으면 원복했다고)
- [ ] 주차 현황 상태·집계 갱신
- [ ] 정본 기록을 쓰면: 기록 먼저, Artifact 나중 — 두 곳 숫자 일치
- [ ] (개발 담당이 따로 있으면) «검증 완료» 회신 (결과 · 미확인 · 리뷰 메모)
- [ ] 게시 URL 을 기록과 회신에 넣었다
- [ ] 임시 서버·worktree 정리, 캡처에 개인정보 없음

## 11. 인계 (담당이 바뀔 때)

- [ ] Artifact URL 과 편집 권한 (Share 에서 다음 담당에게)
- [ ] 정본 기록을 썼다면 그 위치(받는 사람이 열 수 있는지 확인)와 마지막 F 번호 — 개인 노트였다면 필요한 내용을 Artifact 에 옮겨 둔다
- [ ] 진행 중 이슈와, 검증 대상이 됐는데(완료 알림·PR) 아직 검증 안 한 것
- [ ] 남은 시험 데이터와 원복 약속
- [ ] 띄워 둔 임시 서버·worktree (없으면 «없음»)

---

## 부록 A. 시작 템플릿

아래를 `index.html` 로 저장하고 옆에 `shots/` 폴더를 만든다. `<!doctype>`·`<html>`·`<body>` 는 게시할 때 자동으로 붙으므로 쓰지 않는다. `{{ }}` 자리만 채우고, 섹션은 §6·§7 의 조각을 복사해 늘린다.

**디자인은 템플릿 그대로.** 색·글꼴·간격은 맨 위 `:root` 토큰에 모여 있고, 밝은·어두운 테마가 모두 정의돼 있다. 새 요소도 템플릿 `<style>` 에 이미 있는 클래스만으로 만든다. 색 값을 직접 쓰지 않는다 — 어두운 테마에서 글자가 안 보이게 된다.

```html
<title>{{프로젝트}} 개선 검증</title>
<!-- 아래 meta 와 .wrap 의 좌우 padding 은 휴대폰 화면 가장자리 처리용이다. 건드리지 않는다 -->
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+KR:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap">
<style>
:root{
  --bg:#f5f7f9; --surface:#ffffff; --fg:#17212b; --muted:#5b6977; --line:#d9e0e7; --accent:#1f5f8b;
  --pass:#1d7a46; --pass-bg:#e5f4ea; --warn:#9a6200; --warn-bg:#fdf1dc; --skip:#66717c; --skip-bg:#eceff2; --wait-bg:#eef3f8;
  --font-body:"IBM Plex Sans KR",-apple-system,"Apple SD Gothic Neo","Malgun Gothic",sans-serif;
  --font-mono:"IBM Plex Mono",ui-monospace,SFMono-Regular,Menlo,monospace;
}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){
  --bg:#11171d; --surface:#18212a; --fg:#e4eaf0; --muted:#97a5b3; --line:#2b3743; --accent:#7db7e0;
  --pass:#6fd39a; --pass-bg:#173326; --warn:#f0b955; --warn-bg:#3a2c12; --skip:#a3adb7; --skip-bg:#232d37; --wait-bg:#1b2733; color-scheme:dark}}
:root[data-theme="dark"]{
  --bg:#11171d; --surface:#18212a; --fg:#e4eaf0; --muted:#97a5b3; --line:#2b3743; --accent:#7db7e0;
  --pass:#6fd39a; --pass-bg:#173326; --warn:#f0b955; --warn-bg:#3a2c12; --skip:#a3adb7; --skip-bg:#232d37; --wait-bg:#1b2733; color-scheme:dark}
body{background:var(--bg);color:var(--fg);font-family:var(--font-body);font-size:15px;line-height:1.6}
.wrap{max-width:1080px;margin:0 auto;padding-block:32px 64px;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px));display:flex;flex-direction:column;gap:40px}
h1,h2,h3{text-wrap:balance;margin:0;line-height:1.3}
h1{font-size:28px;font-weight:700} h2{font-size:20px;font-weight:700} h3{font-size:16px;font-weight:600}
p{margin:0;max-width:68ch}
.eyebrow{font-size:12px;letter-spacing:.06em;color:var(--muted);font-weight:600}
.mono,code{font-family:var(--font-mono);font-size:.88em}
code{background:var(--wait-bg);padding:1px 5px;border-radius:4px;word-break:break-all}
header{display:flex;flex-direction:column;gap:10px}
.meta{display:flex;flex-wrap:wrap;gap:6px 20px;color:var(--muted);font-size:13px}
section{display:flex;flex-direction:column;gap:16px}
.scroll{overflow-x:auto;border:1px solid var(--line);border-radius:8px;background:var(--surface)}
table{border-collapse:collapse;width:100%;font-size:14px}
th,td{text-align:left;vertical-align:top;padding:9px 12px;border-bottom:1px solid var(--line)}
th{font-size:12px;color:var(--muted);font-weight:600;letter-spacing:.03em;background:var(--bg);white-space:nowrap}
tr:last-child td{border-bottom:0}
td.day{white-space:nowrap;font-variant-numeric:tabular-nums;color:var(--muted);font-size:13px}
td.num,td.time{font-variant-numeric:tabular-nums;white-space:nowrap;font-family:var(--font-mono);font-size:13px}
.pill{display:inline-block;font-size:12px;font-weight:600;padding:2px 9px;border-radius:999px;white-space:nowrap}
.pass{color:var(--pass);background:var(--pass-bg)} .warn{color:var(--warn);background:var(--warn-bg)}
.skip{color:var(--skip);background:var(--skip-bg)} .wait{color:var(--muted);background:var(--wait-bg)}
.tally{display:flex;flex-wrap:wrap;gap:8px}
.issue{display:flex;flex-direction:column;gap:14px;padding-top:8px;border-top:2px solid var(--fg)}
.issue-head{display:flex;flex-wrap:wrap;align-items:baseline;gap:8px 14px}
.issue-head .no{font-family:var(--font-mono);font-weight:500;color:var(--accent)}
.facts{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:10px 24px;font-size:14px}
.facts div{min-width:0} .facts dt{font-size:12px;color:var(--muted);font-weight:600} .facts dd{margin:0} dl{margin:0}
ul{margin:0;padding-left:20px;display:flex;flex-direction:column;gap:6px;max-width:80ch}
.note{font-size:14px;color:var(--muted)}
.compare{border:1px solid var(--line);border-radius:8px;background:var(--surface)}
.compare>summary{cursor:pointer;padding:10px 14px;font-weight:600;list-style:none;display:flex;align-items:center;gap:8px}
.compare>summary::-webkit-details-marker{display:none}
.compare>summary::before{content:"▶";font-size:11px;color:var(--accent);transition:transform .15s}
.compare[open]>summary::before{transform:rotate(90deg)}
.compare-body{display:flex;flex-direction:column;gap:22px;padding:4px 14px 16px}
.cmp{display:flex;flex-direction:column;gap:8px;min-width:0}
.cmp-head{display:flex;flex-wrap:wrap;align-items:center;gap:8px 14px;justify-content:space-between}
.cmp-title{font-size:14px;font-weight:600}
.seg{display:inline-flex;border:1px solid var(--line);border-radius:6px;overflow:hidden}
.seg button{font:inherit;font-size:13px;padding:4px 14px;border:0;background:var(--surface);color:var(--muted);cursor:pointer}
.seg button+button{border-left:1px solid var(--line)}
.seg button[aria-pressed="true"]{background:var(--accent);color:var(--surface);font-weight:600}
.frame{border:1px solid var(--line);border-radius:6px;background:var(--bg);padding:10px;overflow-x:auto}
.frame img{display:block;max-width:100%;height:auto;margin:0 auto;border-radius:4px}
.noshot{padding:28px 12px;text-align:center;color:var(--muted);font-size:13px}
.cmp-note{font-size:13px;color:var(--muted)}
@media (prefers-reduced-motion:reduce){.compare>summary::before{transition:none}}
a{color:var(--accent)}
:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
@media (max-width:600px){h1{font-size:23px}th,td{padding:8px 10px}}
</style>

<div class="wrap">
  <header>
    <span class="eyebrow">{{고객사}} · {{프로젝트}} 개선 {{N}}주차</span>
    <h1>{{프로젝트}} 개선 검증</h1>
    <p>개발이 끝난 개선을 시험 환경에서 직접 조작해 확인한 결과입니다. 이슈 번호는 {{이슈 저장소}} 기준입니다.</p>
    <div class="meta"><span>갱신 {{YYYY-MM-DD}}</span><span>검증 기간 {{시작}} ~ {{끝}}</span><span>정본 기록: {{쓰는 곳 이름 또는 「이 페이지」}}</span></div>
  </header>

  <section aria-labelledby="s-status">
    <h2 id="s-status">{{N}}주차 현황</h2>
    <div class="tally"><span class="pill pass">통과 0</span><span class="pill warn">일부·버그 0</span><span class="pill skip">미확인 0</span><span class="pill wait">대기 0</span></div>
    <!-- 계획 요일 칸은 개발 계획을 쓸 때만 둔다 (§5). 없으면 이 칸과 각 줄의 td.day 를 지우거나 «검증일» 로 바꾼다 -->
    <div class="scroll"><table>
      <thead><tr><th>계획 요일</th><th>이슈</th><th>요구</th><th>내용</th><th>화면</th><th>범위</th><th>상태</th></tr></thead>
      <tbody>
        <tr><td class="day">월 {{MM/DD}} · {{h}}h</td><td class="mono"><a href="#s-{{번호}}">#{{번호}}</a></td><td>{{요구 번호}}</td><td>{{내용}}</td><td>{{화면 코드}}</td><td>{{server+client}}</td><td><span class="pill wait">대기</span></td></tr>
      </tbody>
    </table></div>
  </section>

  <!-- 이슈 섹션: §6-1 뼈대를 복사해 진행 순서대로 붙인다 -->

  <section aria-labelledby="s-find">
    <h2 id="s-find">검증 중 발견</h2>
    <div class="scroll"><table>
      <thead><tr><th>ID</th><th>화면</th><th>내용</th><th>처리</th></tr></thead>
      <tbody><tr><td class="mono">F-{{NN}}</td><td>{{화면}}</td><td>{{무엇이 어떻게 틀렸나}}</td><td><span class="pill warn">{{처리 상태}}</span></td></tr></tbody>
    </table></div>
  </section>

  <section aria-labelledby="s-data">
    <h2 id="s-data">남은 시험 데이터</h2>
    <div class="scroll"><table>
      <thead><tr><th>구분</th><th>값</th><th>상태</th></tr></thead>
      <tbody><tr><td>{{생산오더}}</td><td class="mono">{{번호 (id)}}</td><td>{{상태}}</td></tr></tbody>
    </table></div>
  </section>

  <section aria-labelledby="s-how">
    <h2 id="s-how">검증 방식</h2>
    <ul>
      <li>{{자기 방식 — 예: 개발은 별도 브랜치에서 하고, 검증할 커밋만 시험 서버에 올린다}}</li>
      <li>화면은 스크립트로 조작하고, 숫자·시각·상태는 화면 값과 API 응답으로 단언한다.</li>
      <li>화면 비교의 기존 화면은 개선 전 코드에서 찍었다. 이전 커밋 화면을 임시로 띄워 찍은 것은 지금 데이터로 찍었으므로 화면 차이만 보인다.</li>
    </ul>
  </section>
</div>

<script>
document.querySelectorAll('.cmp').forEach(function (c) {
  c.querySelectorAll('.seg button').forEach(function (b) {
    b.addEventListener('click', function () {
      var side = b.dataset.show;
      c.querySelectorAll('.seg button').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
      c.querySelectorAll('.frame').forEach(function (f) { f.hidden = f.dataset.side !== side; });
    });
  });
});
</script>
```
