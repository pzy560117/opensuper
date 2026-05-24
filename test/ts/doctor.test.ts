import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { doctorCommand } from '../../src/commands/doctor.js';

describe('doctor command', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = path.join(os.tmpdir(), `opensuper-doctor-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await fs.mkdir(tmpDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('accepts current opensuper state fields in JSON output', async () => {
    const changeDir = path.join(tmpDir, 'openspec', 'changes', 'current-state');
    await fs.mkdir(changeDir, { recursive: true });
    await fs.writeFile(
      path.join(changeDir, '.opensuper.yaml'),
      [
        'workflow: full',
        'phase: verify',
        'build_mode: executing-plans',
        'isolation: branch',
        'verify_mode: full',
        'verify_result: pending',
        'design_doc: docs/superpowers/specs/current-state.md',
        'plan: docs/superpowers/plans/current-state.md',
        'verification_report: docs/superpowers/reports/current-state.md',
        'branch_status: handled',
        'verified_at: null',
        'archived: false',
        '',
      ].join('\n'),
    );

    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    let json = '';
    try {
      await doctorCommand(tmpDir, { json: true });
      json = log.mock.calls.map((call) => call.join(' ')).join('\n');
    } finally {
      log.mockRestore();
    }

    const results = JSON.parse(json).results as Array<{ check: string; status: string }>;
    expect(results.find((result) => result.check === '.opensuper.yaml: current-state')).toMatchObject({
      status: 'pass',
    });
  });
});
