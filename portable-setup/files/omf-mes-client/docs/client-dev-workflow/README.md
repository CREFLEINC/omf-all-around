# 클라이언트 개발 워크플로

> 3차 통합 작업에서는 저장소 루트 기준 `docs/client-dev-workflow/integration.md`를 먼저 읽는다. 아래 종전 운영 절차는 통합 모드에 적용하지 않으며 기술 참고와 이전 업무 이력으로 보존한다.

통합 모드 설정: `pnpm workflow:bootstrap --mode integration --tool both`. 확인: `pnpm workflow:check`. 통합 모드에서 팀 번호·GitHub 이슈·기존 업무 상태 파일은 착수 조건이 아니다. 생성 타입과 목 도구의 계약 입력은 별도로 유지한다.

종전 모드의 업무 규칙과 절차의 유일한 정본은 [클라이언트 개발 워크플로 V3](multi-agent-team-workflow-v3.md)다.

AI 도구별 `AGENTS.md`와 `CLAUDE.md`는 저장소가 관리하지 않는다. 새 워크트리에서 다음 명령으로 필요한 로컬 어댑터를 생성한 뒤, 생성 파일의 `개인별 AI 도구 설정` 구역에 본인의 노하우를 추가한다.

```bash
pnpm workflow:bootstrap --tool <codex|claude|both>
```

부트스트랩 실행 파일: `tools/workflow/bootstrap.mjs`

계획·요청·완료 보고를 작성할 때는 `templates/`의 양식을 사용한다. 양식은 업무 규칙의 정본이 아니며 V3 워크플로를 보조한다.
