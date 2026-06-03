import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { execFileSync, spawnSync } from 'child_process';
import { promises as fs } from 'fs';
import { existsSync } from 'fs';
import os from 'os';
import path from 'path';

const scriptsDir = path.resolve('assets', 'skills', 'opensuper', 'scripts');

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function getGitBashCandidates(): string[] {
  if (process.platform !== 'win32') return [];

  const whereGit = spawnSync('where', ['git'], { encoding: 'utf-8' });
  const gitPaths = `${whereGit.stdout || ''}\n${whereGit.stderr || ''}`
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const candidates: string[] = [];
  for (const gitPath of gitPaths) {
    const gitRoot = path.dirname(path.dirname(gitPath));
    candidates.push(path.join(gitRoot, 'bin', 'bash.exe'));
    candidates.push(path.join(gitRoot, 'usr', 'bin', 'bash.exe'));
  }

  return unique(candidates).filter((candidate) => existsSync(candidate));
}

function probeBash(command: string) {
  const result = spawnSync(command, ['-lc', 'uname -s'], { encoding: 'utf-8' });
  return {
    error: result.error,
    status: result.status,
    stdout: (result.stdout || '').trim(),
  };
}

function resolveBashCommand() {
  const candidates: string[] = [];
  if (process.env.OPENSUPER_BASH) candidates.push(process.env.OPENSUPER_BASH);
  if (process.platform === 'win32') candidates.push(...getGitBashCandidates());
  candidates.push('bash');

  for (const candidate of unique(candidates)) {
    const probe = probeBash(candidate);
    if (probe.error) continue;
    if (probe.status === 0 && probe.stdout) {
      return { command: candidate, uname: probe.stdout };
    }
  }

  return { command: process.env.OPENSUPER_BASH || 'bash', uname: '' };
}

const { command: bashCommand, uname: bashUname } = resolveBashCommand();
const hasUsableBash = bashUname.length > 0;
const isGitBash = /^(MINGW|MSYS|CYGWIN)/.test(bashUname);

function toBashPath(filePath: string): string {
  const resolved = path.resolve(filePath).replace(/\\/g, '/');
  const driveMatch = resolved.match(/^([A-Za-z]):\/(.*)$/);
  if (!driveMatch) return resolved;
  if (process.platform === 'win32' && isGitBash) {
    return `/${driveMatch[1].toLowerCase()}/${driveMatch[2]}`;
  }
  return `/mnt/${driveMatch[1].toLowerCase()}/${driveMatch[2]}`;
}

function runBash(cwd: string, script: string, args: string[] = []) {
  return spawnSync(bashCommand, [toBashPath(script), ...args], {
    cwd,
    encoding: 'utf-8',
  });
}

async function writeFile(filePath: string, content: string) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content);
}

async function createChange(tmpDir: string, name: string, yaml: string, tasks = '- [x] done\n') {
  const changeDir = path.join(tmpDir, 'openspec', 'changes', name);
  await fs.mkdir(changeDir, { recursive: true });
  await writeFile(path.join(changeDir, '.opensuper.yaml'), yaml);
  await writeFile(path.join(changeDir, 'proposal.md'), 'proposal\n');
  await writeFile(path.join(changeDir, 'design.md'), 'design\n');
  await writeFile(path.join(changeDir, 'tasks.md'), tasks);
  return changeDir;
}

describe.skipIf(!hasUsableBash)('opensuper shell scripts', () => {
  let tmpDir: string;
  let guardScript: string;
  let stateScript: string;

  beforeEach(async () => {
    tmpDir = path.join(os.tmpdir(), `opensuper-scripts-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await fs.mkdir(tmpDir, { recursive: true });
    const tmpScriptsDir = path.join(tmpDir, 'scripts');
    await fs.mkdir(tmpScriptsDir, { recursive: true });
    for (const name of ['opensuper-archive.sh', 'opensuper-guard.sh', 'opensuper-state.sh', 'opensuper-yaml-validate.sh']) {
      const content = await fs.readFile(path.join(scriptsDir, name), 'utf-8');
      await fs.writeFile(path.join(tmpScriptsDir, name), content.replace(/\r\n/g, '\n'));
    }
    guardScript = path.join(tmpScriptsDir, 'opensuper-guard.sh');
    stateScript = path.join(tmpScriptsDir, 'opensuper-state.sh');
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });

  it('initializes a new change directory with workflow defaults', async () => {
    const result = runBash(tmpDir, stateScript, ['init', 'new-full-change', 'full']);
    const yaml = await fs.readFile(
      path.join(tmpDir, 'openspec', 'changes', 'new-full-change', '.opensuper.yaml'),
      'utf-8',
    );

    expect(result.status).toBe(0);
    expect(yaml).toContain('workflow: full');
    expect(yaml).toContain('phase: open');
    expect(yaml).toContain('verification_report: null');
    expect(yaml).toContain('branch_status: pending');
  }, 20_000);

  it('blocks build phase when the project build command fails', async () => {
    await createChange(
      tmpDir,
      'broken-build',
      [
        'workflow: full',
        'phase: build',
        'build_mode: executing-plans',
        'isolation: branch',
        'verify_mode: null',
        'design_doc: null',
        'plan: null',
        'verify_result: pending',
        'verified_at: null',
        'archived: false',
        '',
      ].join('\n'),
    );
    await writeFile(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({ scripts: { build: 'node -e "process.exit(1)"' } }),
    );

    const result = runBash(tmpDir, guardScript, ['broken-build', 'build']);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('[FAIL] Build passes');
  }, 20_000);

  it('blocks build completion until isolation and build mode are selected', async () => {
    await createChange(
      tmpDir,
      'missing-build-decisions',
      [
        'workflow: full',
        'phase: build',
        'build_mode: null',
        'isolation: null',
        'verify_mode: null',
        'design_doc: null',
        'plan: null',
        'verify_result: pending',
        'verified_at: null',
        'archived: false',
        '',
      ].join('\n'),
    );
    await writeFile(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({ scripts: { build: 'node -e "process.exit(0)"' } }),
    );

    const guard = runBash(tmpDir, guardScript, ['missing-build-decisions', 'build']);
    const transition = runBash(tmpDir, stateScript, ['transition', 'missing-build-decisions', 'build-complete']);

    expect(guard.status).not.toBe(0);
    expect(guard.stderr).toContain('[FAIL] isolation selected');
    expect(guard.stderr).toContain('[FAIL] build_mode selected');
    expect(guard.stderr).toContain('Next: ask the user to choose branch or worktree');
    expect(guard.stderr).toContain('Next: ask the user to choose an implementation mode');
    expect(transition.status).not.toBe(0);
    expect(transition.stderr).toContain('isolation must be branch or worktree');
  }, 20_000);

  it('rejects direct build mode for full workflow without explicit override', async () => {
    await createChange(
      tmpDir,
      'direct-full',
      [
        'workflow: full',
        'phase: build',
        'build_mode: direct',
        'isolation: branch',
        'verify_mode: null',
        'design_doc: null',
        'plan: null',
        'verify_result: pending',
        'verified_at: null',
        'archived: false',
        '',
      ].join('\n'),
    );
    await writeFile(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({ scripts: { build: 'node -e "process.exit(0)"' } }),
    );

    const result = runBash(tmpDir, guardScript, ['direct-full', 'build']);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('[FAIL] build_mode allowed for workflow');
    expect(result.stderr).toContain('direct is only allowed for hotfix/tweak');
    expect(result.stderr).toContain('Next: switch build_mode to executing-plans or subagent-driven-development');
  }, 20_000);

  it('prints actionable remediation for unfinished tasks', async () => {
    await createChange(
      tmpDir,
      'unfinished-tasks',
      [
        'workflow: full',
        'phase: build',
        'build_mode: executing-plans',
        'isolation: branch',
        'verify_mode: null',
        'design_doc: null',
        'plan: null',
        'verify_result: pending',
        'verified_at: null',
        'archived: false',
        '',
      ].join('\n'),
      ['- [x] done', '- [ ] finish guard remediation'].join('\n'),
    );
    await writeFile(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({ scripts: { build: 'node -e "process.exit(0)"' } }),
    );

    const result = runBash(tmpDir, guardScript, ['unfinished-tasks', 'build']);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('[FAIL] tasks.md all tasks checked');
    expect(result.stderr).toContain('Unfinished tasks:');
    expect(result.stderr).toContain('finish guard remediation');
    expect(result.stderr).toContain('Next: complete or explicitly remove unfinished tasks');
  }, 20_000);

  it('rejects direct build mode for full workflow during state transition', async () => {
    await createChange(
      tmpDir,
      'direct-full-transition',
      [
        'workflow: full',
        'phase: build',
        'build_mode: direct',
        'isolation: branch',
        'verify_mode: null',
        'design_doc: null',
        'plan: null',
        'verify_result: pending',
        'verified_at: null',
        'archived: false',
        '',
      ].join('\n'),
    );

    const result = runBash(tmpDir, stateScript, ['transition', 'direct-full-transition', 'build-complete']);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('build_mode=direct is only allowed for hotfix/tweak');
  });

  it('allows direct build mode for full workflow with explicit override', async () => {
    await createChange(
      tmpDir,
      'direct-full-override',
      [
        'workflow: full',
        'phase: build',
        'build_mode: direct',
        'direct_override: true',
        'isolation: branch',
        'verify_mode: null',
        'design_doc: null',
        'plan: null',
        'verify_result: pending',
        'verified_at: null',
        'archived: false',
        '',
      ].join('\n'),
    );
    await writeFile(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({ scripts: { build: 'node -e "process.exit(0)"' } }),
    );

    const result = runBash(tmpDir, guardScript, ['direct-full-override', 'build']);

    expect(result.status).toBe(0);
    expect(result.stderr).toContain('[PASS] build_mode allowed for workflow');
  }, 20_000);

  it('runs configured build command and prints its failure output', async () => {
    await createChange(
      tmpDir,
      'configured-build',
      [
        'workflow: full',
        'phase: build',
        'build_mode: executing-plans',
        'isolation: branch',
        'verify_mode: null',
        'build_command: node build-check.js',
        'design_doc: null',
        'plan: null',
        'verify_result: pending',
        'verified_at: null',
        'archived: false',
        '',
      ].join('\n'),
    );
    await writeFile(path.join(tmpDir, 'build-check.js'), 'console.error("configured failure"); process.exit(1);\n');
    await writeFile(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({ scripts: { build: 'node -e "process.exit(0)"' } }),
    );

    const result = runBash(tmpDir, guardScript, ['configured-build', 'build']);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('configured failure');
  }, 20_000);

  it('preserves configured command values with sed replacement metacharacters', async () => {
    const command = 'node -e "console.log(\'a&b|c\')"';
    await createChange(
      tmpDir,
      'command-metacharacters',
      [
        'workflow: full',
        'phase: build',
        'build_mode: executing-plans',
        'isolation: branch',
        'verify_mode: null',
        'design_doc: null',
        'plan: null',
        'verify_result: pending',
        'verified_at: null',
        'archived: false',
        '',
      ].join('\n'),
    );

    const set = runBash(tmpDir, stateScript, ['set', 'command-metacharacters', 'build_command', command]);
    const get = runBash(tmpDir, stateScript, ['get', 'command-metacharacters', 'build_command']);

    expect(set.status).toBe(0);
    expect(get.stdout.trim()).toBe(command);
  });

  it('keeps shell scripts portable across GNU and BSD sed', async () => {
    for (const name of ['opensuper-state.sh', 'opensuper-archive.sh', 'opensuper-guard.sh', 'opensuper-yaml-validate.sh']) {
      const content = await fs.readFile(path.join(tmpDir, 'scripts', name), 'utf-8');

      expect(content).not.toMatch(/\bsed\s+-i(?:\s|$)/);
    }
  });

  it('keeps optional YAML field reads safe under pipefail', async () => {
    for (const name of ['opensuper-state.sh', 'opensuper-guard.sh']) {
      const content = await fs.readFile(path.join(tmpDir, 'scripts', name), 'utf-8');

      expect(content).toMatch(/grep "\^\$\{field\}:" "\$[a-z_]+".*\|\| true\)/);
    }
  });

  it('guards bash uname detection when bash cannot be spawned', async () => {
    const files = [path.resolve('scripts', 'run-bats.js'), path.resolve('test', 'ts', 'opensuper-scripts.test.ts')];

    for (const file of files) {
      const content = await fs.readFile(file, 'utf-8');

      expect(content).toContain(".stdout || ''");
    }
  });

  it('uses root-level build command config before inferred build commands', async () => {
    await createChange(
      tmpDir,
      'root-configured-build',
      [
        'workflow: full',
        'phase: build',
        'build_mode: executing-plans',
        'isolation: branch',
        'verify_mode: null',
        'design_doc: null',
        'plan: null',
        'verify_result: pending',
        'verified_at: null',
        'archived: false',
        '',
      ].join('\n'),
    );
    await writeFile(path.join(tmpDir, 'opensuper.yaml'), 'build_command: node root-build-check.js\n');
    await writeFile(path.join(tmpDir, 'root-build-check.js'), 'console.error("root configured failure"); process.exit(1);\n');
    await writeFile(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({ scripts: { build: 'node -e "process.exit(0)"' } }),
    );

    const result = runBash(tmpDir, guardScript, ['root-configured-build', 'build']);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('root configured failure');
  }, 20_000);

  it('runs configured verify command before archiving', async () => {
    await createChange(
      tmpDir,
      'configured-verify',
      [
        'workflow: full',
        'phase: verify',
        'build_mode: executing-plans',
        'isolation: branch',
        'verify_mode: full',
        'verify_command: node verify-check.js',
        'design_doc: null',
        'plan: null',
        'verify_result: pending',
        'verification_report: docs/superpowers/reports/configured-verify.md',
        'branch_status: handled',
        'verified_at: null',
        'archived: false',
        '',
      ].join('\n'),
    );
    await writeFile(path.join(tmpDir, 'docs', 'superpowers', 'reports', 'configured-verify.md'), 'PASS\n');
    await writeFile(path.join(tmpDir, 'verify-check.js'), 'console.error("verify configured failure"); process.exit(1);\n');
    await writeFile(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({ scripts: { build: 'node -e "process.exit(0)"' } }),
    );

    const result = runBash(tmpDir, guardScript, ['configured-verify', 'verify']);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('verify configured failure');
  }, 20_000);

  it('validates archive completeness after the change has moved into archive', async () => {
    await createChange(
      tmpDir,
      path.join('archive', '2026-05-21-done-change'),
      [
        'workflow: full',
        'phase: archive',
        'build_mode: executing-plans',
        'isolation: branch',
        'verify_mode: light',
        'design_doc: null',
        'plan: null',
        'verify_result: pass',
        'verified_at: 2026-05-21',
        'archived: true',
        '',
      ].join('\n'),
    );

    const result = runBash(tmpDir, guardScript, ['2026-05-21-done-change', 'archive']);

    expect(result.status).toBe(0);
    expect(result.stderr).toContain('ALL CHECKS PASSED');
  });

  it('reports accurate archive step counts when syncing and annotating', async () => {
    const archiveScript = path.join(tmpDir, 'scripts', 'opensuper-archive.sh');
    await createChange(
      tmpDir,
      'ready-to-archive',
      [
        'workflow: full',
        'phase: archive',
        'build_mode: executing-plans',
        'isolation: branch',
        'verify_mode: full',
        'design_doc: docs/superpowers/specs/ready-design.md',
        'plan: docs/superpowers/plans/ready-plan.md',
        'verify_result: pass',
        'verification_report: docs/superpowers/reports/ready.md',
        'branch_status: handled',
        'verified_at: 2026-05-21',
        'archived: false',
        '',
      ].join('\n'),
    );
    await writeFile(path.join(tmpDir, 'docs', 'superpowers', 'specs', 'ready-design.md'), 'design\n');
    await writeFile(path.join(tmpDir, 'docs', 'superpowers', 'plans', 'ready-plan.md'), 'plan\n');
    await writeFile(path.join(tmpDir, 'docs', 'superpowers', 'reports', 'ready.md'), 'PASS\n');
    await writeFile(
      path.join(tmpDir, 'openspec', 'changes', 'ready-to-archive', 'specs', 'capability', 'spec.md'),
      'delta spec\n',
    );

    const result = runBash(tmpDir, archiveScript, ['ready-to-archive']);

    expect(result.status).toBe(0);
    expect(result.stderr).toContain('Archive complete. 7/7 steps succeeded.');
  }, 20_000);

  it('uses plan base-ref to scale verification after changes have been committed', async () => {
    execFileSync('git', ['init'], { cwd: tmpDir, stdio: 'ignore' });
    execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: tmpDir });
    execFileSync('git', ['config', 'user.name', 'Test User'], { cwd: tmpDir });
    await writeFile(path.join(tmpDir, 'README.md'), 'base\n');
    execFileSync('git', ['add', '.'], { cwd: tmpDir });
    execFileSync('git', ['commit', '-m', 'base'], { cwd: tmpDir, stdio: 'ignore' });
    const baseRef = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: tmpDir, encoding: 'utf-8' }).trim();

    await createChange(
      tmpDir,
      'large-change',
      [
        'workflow: full',
        'phase: verify',
        'build_mode: executing-plans',
        'isolation: branch',
        'verify_mode: null',
        'design_doc: null',
        'plan: docs/superpowers/plans/large-change.md',
        'verify_result: pending',
        'verified_at: null',
        'archived: false',
        '',
      ].join('\n'),
      ['- [x] task 1', '- [x] task 2', '- [x] task 3'].join('\n'),
    );
    await writeFile(
      path.join(tmpDir, 'docs', 'superpowers', 'plans', 'large-change.md'),
      ['---', 'change: large-change', `base-ref: ${baseRef}`, '---', ''].join('\n'),
    );
    for (let i = 1; i <= 6; i += 1) {
      await writeFile(path.join(tmpDir, 'src', `file-${i}.txt`), `change ${i}\n`);
    }
    execFileSync('git', ['add', '.'], { cwd: tmpDir });
    execFileSync('git', ['commit', '-m', 'large change'], { cwd: tmpDir, stdio: 'ignore' });

    const result = runBash(tmpDir, stateScript, ['scale', 'large-change']);
    const mode = runBash(tmpDir, stateScript, ['get', 'large-change', 'verify_mode']);

    expect(result.status).toBe(0);
    expect(mode.stdout.trim()).toBe('full');
  }, 20_000);

  it('transitions full workflow from open to design', async () => {
    await createChange(
      tmpDir,
      'full-change',
      [
        'workflow: full',
        'phase: open',
        'build_mode: null',
        'isolation: null',
        'verify_mode: null',
        'design_doc: null',
        'plan: null',
        'verify_result: pending',
        'verified_at: null',
        'archived: false',
        '',
      ].join('\n'),
    );

    const result = runBash(tmpDir, stateScript, ['transition', 'full-change', 'open-complete']);
    const phase = runBash(tmpDir, stateScript, ['get', 'full-change', 'phase']);

    expect(result.status).toBe(0);
    expect(phase.stdout.trim()).toBe('design');
  });

  it('transitions preset workflows from open directly to build', async () => {
    await createChange(
      tmpDir,
      'tweak-change',
      [
        'workflow: tweak',
        'phase: open',
        'build_mode: direct',
        'isolation: branch',
        'verify_mode: light',
        'design_doc: null',
        'plan: null',
        'verify_result: pending',
        'verified_at: null',
        'archived: false',
        '',
      ].join('\n'),
    );

    const result = runBash(tmpDir, stateScript, ['transition', 'tweak-change', 'open-complete']);
    const phase = runBash(tmpDir, stateScript, ['get', 'tweak-change', 'phase']);

    expect(result.status).toBe(0);
    expect(phase.stdout.trim()).toBe('build');
  });

  it('transitions verify-pass and verify-fail through script-owned fields', async () => {
    await createChange(
      tmpDir,
      'verify-change',
      [
        'workflow: full',
        'phase: verify',
        'build_mode: executing-plans',
        'isolation: branch',
        'verify_mode: full',
        'design_doc: null',
        'plan: null',
        'verify_result: pending',
        'verification_report: null',
        'branch_status: pending',
        'verified_at: null',
        'archived: false',
        '',
      ].join('\n'),
    );

    const fail = runBash(tmpDir, stateScript, ['transition', 'verify-change', 'verify-fail']);
    const failedPhase = runBash(tmpDir, stateScript, ['get', 'verify-change', 'phase']);
    const failedResult = runBash(tmpDir, stateScript, ['get', 'verify-change', 'verify_result']);
    const failedBranchStatus = runBash(tmpDir, stateScript, ['get', 'verify-change', 'branch_status']);

    expect(fail.status).toBe(0);
    expect(failedPhase.stdout.trim()).toBe('build');
    expect(failedResult.stdout.trim()).toBe('fail');
    expect(failedBranchStatus.stdout.trim()).toBe('pending');

    runBash(tmpDir, stateScript, ['set', 'verify-change', 'phase', 'verify']);
    runBash(tmpDir, stateScript, ['set', 'verify-change', 'verify_result', 'pending']);
    await writeFile(path.join(tmpDir, 'docs', 'superpowers', 'reports', 'verify-change.md'), 'PASS\n');
    runBash(
      tmpDir,
      stateScript,
      ['set', 'verify-change', 'verification_report', 'docs/superpowers/reports/verify-change.md'],
    );
    runBash(tmpDir, stateScript, ['set', 'verify-change', 'branch_status', 'handled']);

    const pass = runBash(tmpDir, stateScript, ['transition', 'verify-change', 'verify-pass']);
    const passedPhase = runBash(tmpDir, stateScript, ['get', 'verify-change', 'phase']);
    const passedResult = runBash(tmpDir, stateScript, ['get', 'verify-change', 'verify_result']);
    const verifiedAt = runBash(tmpDir, stateScript, ['get', 'verify-change', 'verified_at']);

    expect(pass.status).toBe(0);
    expect(passedPhase.stdout.trim()).toBe('archive');
    expect(passedResult.stdout.trim()).toBe('pass');
    expect(verifiedAt.stdout.trim()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  }, 20_000);

  it('blocks verify guard when verification evidence is missing', async () => {
    await createChange(
      tmpDir,
      'guard-verify',
      [
        'workflow: full',
        'phase: verify',
        'build_mode: executing-plans',
        'isolation: branch',
        'verify_mode: light',
        'design_doc: null',
        'plan: null',
        'verify_result: pending',
        'verification_report: null',
        'branch_status: pending',
        'verified_at: null',
        'archived: false',
        '',
      ].join('\n'),
    );
    await writeFile(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({ scripts: { build: 'node -e "process.exit(0)"' } }),
    );

    const result = runBash(tmpDir, guardScript, ['guard-verify', 'verify', '--apply']);
    const phase = runBash(tmpDir, stateScript, ['get', 'guard-verify', 'phase']);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('[FAIL] verification_report exists');
    expect(result.stderr).toContain('[FAIL] branch_status=handled');
    expect(phase.stdout.trim()).toBe('verify');
  }, 20_000);

  it('lets verify guard apply transition after verification and branch evidence are recorded', async () => {
    await createChange(
      tmpDir,
      'guard-verify',
      [
        'workflow: full',
        'phase: verify',
        'build_mode: executing-plans',
        'isolation: branch',
        'verify_mode: light',
        'design_doc: null',
        'plan: null',
        'verify_result: pending',
        'verification_report: docs/superpowers/reports/guard-verify.md',
        'branch_status: handled',
        'verified_at: null',
        'archived: false',
        '',
      ].join('\n'),
    );
    await writeFile(path.join(tmpDir, 'docs', 'superpowers', 'reports', 'guard-verify.md'), 'PASS\n');
    await writeFile(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({ scripts: { build: 'node -e "process.exit(0)"' } }),
    );

    const result = runBash(tmpDir, guardScript, ['guard-verify', 'verify', '--apply']);
    const phase = runBash(tmpDir, stateScript, ['get', 'guard-verify', 'phase']);
    const verifyResult = runBash(tmpDir, stateScript, ['get', 'guard-verify', 'verify_result']);

    expect(result.status).toBe(0);
    expect(phase.stdout.trim()).toBe('archive');
    expect(verifyResult.stdout.trim()).toBe('pass');
  }, 20_000);

  it('rejects invalid transition from the wrong phase', async () => {
    await createChange(
      tmpDir,
      'wrong-phase',
      [
        'workflow: full',
        'phase: open',
        'build_mode: null',
        'isolation: null',
        'verify_mode: null',
        'design_doc: null',
        'plan: null',
        'verify_result: pending',
        'verified_at: null',
        'archived: false',
        '',
      ].join('\n'),
    );

    const result = runBash(tmpDir, stateScript, ['transition', 'wrong-phase', 'build-complete']);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('expected phase build');
  });

  it('marks archived changes through transition in the archive directory', async () => {
    await createChange(
      tmpDir,
      path.join('archive', '2026-05-21-done-change'),
      [
        'workflow: full',
        'phase: archive',
        'build_mode: executing-plans',
        'isolation: branch',
        'verify_mode: full',
        'design_doc: null',
        'plan: null',
        'verify_result: pass',
        'verified_at: 2026-05-21',
        'archived: false',
        '',
      ].join('\n'),
    );

    const result = runBash(tmpDir, stateScript, ['transition', '2026-05-21-done-change', 'archived']);
    const archived = runBash(tmpDir, stateScript, ['get', '2026-05-21-done-change', 'archived']);

    expect(result.status).toBe(0);
    expect(archived.stdout.trim()).toBe('true');
  });
});
