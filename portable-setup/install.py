#!/usr/bin/env python3
"""Restore reviewed local harness files. Default: check only, no writes."""
import argparse
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import sys
from datetime import datetime, timezone

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent


def digest(data):
    return hashlib.sha256(data).hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--client', type=Path, required=True)
    parser.add_argument('--server', type=Path, required=True)
    parser.add_argument('--apply', action='store_true', help='Back up and write after all checks pass')
    args = parser.parse_args()
    manifest = json.loads((HERE / 'manifest.json').read_text())
    roots = {'omf-mes-client': args.client.resolve(), 'omf-mes-server': args.server.resolve()}
    if roots['omf-mes-client'] == roots['omf-mes-server']:
        raise ValueError('Client and server must be different repositories')
    workflow = (ROOT / 'OMF_ALL_ROUNDER_WORKFLOW.md').read_bytes()
    hook = ('<!-- final-routine-portable -->\n'
            '파이널 루틴 작업은 먼저 `.final-routine/WORKFLOW.md`를 읽는다. '
            '해당 문서의 최신 운영 절차는 아래 과거 운영 지침보다 우선한다. '
            '기존 기술 지식은 유지한다.\n\n').encode()
    plan, conflicts = [], []
    for repo, metadata in manifest['repositories'].items():
        target_root = roots[repo]
        top = subprocess.check_output(['git', '-C', str(target_root), 'rev-parse', '--show-toplevel'], text=True).strip()
        if Path(top).resolve() != target_root:
            raise ValueError(f'Not a repository root: {target_root}')
        print(f'{repo}: source snapshot {metadata["head"][:8]}; product commits are NOT installed')
        entries = list(metadata['files']) + [{'path': '.final-routine/WORKFLOW.md', 'base_sha256': None}]
        for entry in entries:
            rel = Path(entry['path'])
            if rel.is_absolute() or '..' in rel.parts:
                raise ValueError('Unsafe manifest path')
            target = target_root / rel
            if target.is_symlink() or target.resolve() != target_root / rel:
                raise ValueError(f'Symlink target refused: {target}')
            if rel.as_posix() == '.final-routine/WORKFLOW.md':
                data, original = workflow, workflow
            else:
                original = (HERE / 'files' / repo / rel).read_bytes()
                if digest(original) != entry['sha256']:
                    raise ValueError(f'Package checksum mismatch: {repo}/{rel}')
                data = hook + original if rel.as_posix() in ('AGENTS.md', 'CLAUDE.md') else original
            current = target.read_bytes() if target.is_file() else None
            if target.exists() and not target.is_file():
                conflicts.append(f'{repo}/{rel}: not a regular file')
                continue
            if current == data:
                continue
            if current is not None and current != original and digest(current) != entry['base_sha256']:
                conflicts.append(f'{repo}/{rel}: differs from source baseline; merge manually')
                continue
            plan.append((repo, rel, target, data, current is not None))
    for repo, rel, _, _, existed in plan:
        print(f'{"UPDATE" if existed else "CREATE"} {repo}/{rel}')
    if conflicts:
        print('\n'.join(conflicts), file=sys.stderr)
        print('No files changed. Resolve differences with the new-PC agent; no force option.', file=sys.stderr)
        return 2
    if not args.apply:
        print(f'Check passed: {len(plan)} files. Add --apply to back up and install.')
        return 0
    if not plan:
        print('Already installed; no changes.')
        return 0
    backup = ROOT / 'backups' / ('portable-' + datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ'))
    backup.mkdir(parents=True)
    records = []
    # Back up every existing target before the first write.
    for repo, rel, target, _, existed in plan:
        if existed:
            saved = backup / repo / rel
            saved.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(target, saved)
        records.append({'repository': str(roots[repo]), 'path': str(rel), 'existed': existed})
    (backup / 'restore-manifest.json').write_text(json.dumps(records, ensure_ascii=False, indent=2))
    for _, _, target, data, _ in plan:
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)
    print(f'Installed {len(plan)} files. Backups: {backup}')
    print('No Git staging, product commits, environment variables, DB or servers were changed.')
    return 0


if __name__ == '__main__':
    try:
        sys.exit(main())
    except (OSError, ValueError, subprocess.CalledProcessError) as error:
        print(f'Cannot install: {error}', file=sys.stderr)
        sys.exit(1)
