import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';

const sha = 'a'.repeat(40);

test('prebuilt image validation accepts only a loaded image for the exact commit', () => {
  const directory = mkdtempSync(join(tmpdir(), 'nexus-ci-image-'));
  try {
    writeFileSync(join(directory, 'docker'), `#!/usr/bin/env bash
[[ "$1 $2 $3" == 'image inspect --format' ]] || exit 99
[[ "\${5}" == "nexus-ci:$GITHUB_SHA" ]] || exit 98
[[ \${FAKE_IMAGE_PRESENT:-true} == true ]] || exit 1
printf '%s\\n' "$FAKE_REVISION"
`, { mode: 0o700 });
    const validate = (changes = {}) => spawnSync('bash', ['scripts/validate-ci-image.sh'], {
      encoding: 'utf8',
      env: {
        PATH: `${directory}:${process.env.PATH}`,
        GITHUB_SHA: sha,
        NEXUS_CI_PREBUILT_IMAGE: `nexus-ci:${sha}`,
        FAKE_REVISION: sha,
        ...changes,
      },
    });
    const result = validate();
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), `nexus-ci:${sha}`);
    for (const changes of [
      { GITHUB_SHA: '' },
      { GITHUB_SHA: 'abcdef' },
      { NEXUS_CI_PREBUILT_IMAGE: 'nexus-ci:latest' },
      { NEXUS_CI_PREBUILT_IMAGE: `nexus-ci:${'b'.repeat(40)}` },
      { FAKE_REVISION: '' },
      { FAKE_REVISION: 'b'.repeat(40) },
      { FAKE_IMAGE_PRESENT: 'false' },
    ]) {
      const refused = validate(changes);
      assert.notEqual(refused.status, 0, JSON.stringify(changes));
      assert.equal(refused.stdout, '', 'Invalid artifacts must not return an image tag');
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
