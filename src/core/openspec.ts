import { execSync } from 'child_process';
import { PLATFORMS } from './platforms.js';

import type { InstallScope } from './types.js';

const VALID_TOOL_IDS = new Set(PLATFORMS.map((p) => p.openspecToolId));

function isCommandAvailable(command: string): boolean {
  try {
    const checkCmd = process.platform === 'win32' ? `where ${command}` : `which ${command}`;
    execSync(checkCmd, { stdio: 'pipe', timeout: 10_000 });
    return true;
  } catch {
    return false;
  }
}

async function ensureOpenSpecCli(scope: InstallScope, projectPath: string): Promise<boolean> {
  if (isCommandAvailable('openspec')) {
    return true;
  }

  console.log(`    Installing OpenSpec CLI...`);
  try {
    const npmCmd =
      scope === 'global'
        ? 'npm install -g @fission-ai/openspec@latest'
        : 'npm install @fission-ai/openspec@latest';
    execSync(npmCmd, { cwd: projectPath, stdio: 'pipe', timeout: 120_000 });
    return isCommandAvailable('openspec');
  } catch (error) {
    console.error(`    Failed to install OpenSpec CLI: ${(error as Error).message}`);
    return false;
  }
}

async function installOpenSpec(
  projectPath: string,
  toolIds: string[],
  scope: InstallScope,
): Promise<'installed' | 'failed' | 'skipped'> {
  const cliReady = await ensureOpenSpecCli(scope, projectPath);
  if (!cliReady) {
    console.error(
      `    OpenSpec CLI not available. Install manually: npm install -g @fission-ai/openspec@latest`,
    );
    return 'failed';
  }

  const unknownIds = toolIds.filter((id) => !VALID_TOOL_IDS.has(id));
  if (unknownIds.length > 0) {
    throw new Error(`Unknown tool IDs: ${unknownIds.join(', ')}`);
  }

  try {
    const flags = ['--tools', toolIds.join(','), scope === 'global' ? '--global' : '']
      .filter(Boolean)
      .join(' ');

    execSync(`openspec init ${flags}`, {
      cwd: projectPath,
      stdio: 'pipe',
      timeout: 120_000,
    });
    return 'installed';
  } catch (error) {
    console.error(`    OpenSpec init failed: ${(error as Error).message}`);
    return 'failed';
  }
}

export { installOpenSpec, isCommandAvailable };
