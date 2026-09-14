import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { bootstrap, bootstrapErrors, INTEGRATION_SOURCE, WORKFLOW_SOURCE } from './bootstrap.mjs';

test('통합 모드는 팀 번호 없이 생성하고 종전 규칙 재주입과 오래된 사본을 감지한다', () => {
  const root = fixture();
  const source = path.join(root, INTEGRATION_SOURCE);
  writeFileSync(source, '# Integration\nCurrent rules\n');
  bootstrap(root, { tool: 'both', mode: 'integration' });
  assert.deepEqual(bootstrapErrors(root), []);
  assert.throws(() => bootstrap(root, { tool: 'both', team: '5' }), /통합 모드/);
  writeFileSync(source, '# Integration\nNew rules\n');
  assert.equal(bootstrapErrors(root).length, 2);
  bootstrap(root, { tool: 'both', mode: 'integration' });
  assert.deepEqual(bootstrapErrors(root), []);
  writeFileSync(path.join(root, 'CLAUDE.md'), '# Legacy\n');
  assert.ok(bootstrapErrors(root).some((error) => error.includes('CLAUDE.md')));
});

test('통합 전환 시 기존 개인 지침을 암묵적으로 덮어쓰지 않는다', () => {
  const root = fixture();
  writeFileSync(path.join(root, INTEGRATION_SOURCE), '# Integration\n');
  writeFileSync(path.join(root, 'CLAUDE.md'), 'Personal notes\n');
  assert.throws(() => bootstrap(root, { tool: 'both', mode: 'integration' }), /백업/);
  assert.equal(existsSync(path.join(root, 'AGENTS.md')), false);
  assert.equal(readFileSync(path.join(root, 'CLAUDE.md'), 'utf8'), 'Personal notes\n');
});

function fixture() {
  const root = mkdtempSync(path.join(tmpdir(), 'workflow-bootstrap-'));
  const source = path.join(root, WORKFLOW_SOURCE);
  mkdirSync(path.dirname(source), { recursive: true });
  writeFileSync(source, '# workflow\n\nmandatory rule\n');
  return root;
}

test('선택한 AI 도구의 로컬 어댑터를 생성한다', () => {
  const root = fixture();
  bootstrap(root, { tool: 'codex' });
  const content = readFileSync(path.join(root, 'AGENTS.md'), 'utf8');
  assert.match(content, /"tool":"codex"/);
  assert.doesNotMatch(content, /"team"|현재 담당/);
  assert.deepEqual(bootstrapErrors(root), []);
});

test('팀 번호를 주면 어댑터를 만들지 않고 거부한다', () => {
  const root = fixture();
  assert.throws(() => bootstrap(root, { tool: 'codex', team: '5' }), /팀 번호는 더 이상/);
  assert.equal(existsSync(path.join(root, 'AGENTS.md')), false);
});

test('재생성할 때 개인 설정을 보존하고 관리 블록을 갱신한다', () => {
  const root = fixture();
  bootstrap(root, { tool: 'claude' });
  const target = path.join(root, 'CLAUDE.md');
  writeFileSync(
    target,
    readFileSync(target, 'utf8').replace(
      '## 개인별 AI 도구 설정',
      '개인 구역 앞 메모\n\n## 개인별 AI 도구 설정',
    ),
  );
  writeFileSync(path.join(root, WORKFLOW_SOURCE), '# workflow\n\nupdated mandatory rule\n');
  bootstrap(root, { tool: 'claude' });
  const content = readFileSync(target, 'utf8');
  assert.match(content, /updated mandatory rule/);
  assert.match(content, /개인 구역 앞 메모/);
  assert.deepEqual(bootstrapErrors(root), []);
});

test('출처 불명 파일은 force 없이는 덮어쓰지 않는다', () => {
  const root = fixture();
  const target = path.join(root, 'AGENTS.md');
  writeFileSync(target, '직접 작성한 기존 파일\n');
  assert.throws(() => bootstrap(root, { tool: 'codex' }), /검증된 부트스트랩 생성물이 아닙니다/);
  assert.equal(readFileSync(target, 'utf8'), '직접 작성한 기존 파일\n');
  bootstrap(root, { tool: 'codex', force: true });
  assert.match(readFileSync(target, 'utf8'), /workflow-bootstrap/);
});

test('both는 Codex와 Claude 어댑터를 함께 생성한다', () => {
  const root = fixture();
  bootstrap(root, { tool: 'both' });
  assert.equal(existsSync(path.join(root, 'AGENTS.md')), true);
  assert.equal(existsSync(path.join(root, 'CLAUDE.md')), true);
  assert.deepEqual(bootstrapErrors(root), []);
});

test('정본과 다른 관리 블록을 감지한다', () => {
  const root = fixture();
  bootstrap(root, { tool: 'codex' });
  const target = path.join(root, 'AGENTS.md');
  writeFileSync(target, readFileSync(target, 'utf8').replace('mandatory rule', 'changed rule'));
  assert.ok(bootstrapErrors(root).some((error) => error.includes('관리 워크플로')));
});
