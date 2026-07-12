import { execFileSync } from 'child_process';
import { isCommandAvailable, getNpmExecutable } from './openspec.js';
import { printCommandErrorDetails } from './command-error.js';

import type { InstallScope } from './types.js';

async function ensureCodegraphCli(projectPath: string): Promise<boolean> {
  if (isCommandAvailable('codegraph')) {
    return true;
  }

  console.log('    Installing CodeGraph CLI...');
  try {
    execFileSync(getNpmExecutable(), ['install', '-g', '@colbymchenry/codegraph'], {
      cwd: projectPath,
      stdio: 'inherit',
      timeout: 180_000,
      shell: process.platform === 'win32',
    });
    return isCommandAvailable('codegraph');
  } catch (error) {
    console.error(`    Failed to install CodeGraph CLI: ${(error as Error).message}`);
    printCommandErrorDetails(error);
    return false;
  }
}

async function installCodegraph(
  projectPath: string,
  scope: InstallScope,
): Promise<'installed' | 'failed' | 'skipped'> {
  const cliReady = await ensureCodegraphCli(projectPath);
  if (!cliReady) {
    console.error(
      '    CodeGraph CLI not available. Install manually: npm install -g @colbymchenry/codegraph',
    );
    return 'failed';
  }

  try {
    console.log('    Running: codegraph install --yes');
    execFileSync('codegraph', ['install', '--yes'], {
      cwd: projectPath,
      stdio: 'inherit',
      timeout: 120_000,
      shell: process.platform === 'win32',
    });
  } catch (error) {
    console.error(`    CodeGraph install failed: ${(error as Error).message}`);
    printCommandErrorDetails(error);
    return 'failed';
  }

  if (scope === 'project') {
    try {
      console.log('    Running: codegraph init -i');
      execFileSync('codegraph', ['init', '-i'], {
        cwd: projectPath,
        stdio: 'inherit',
        timeout: 300_000,
        shell: process.platform === 'win32',
      });
    } catch (error) {
      console.error(`    CodeGraph init failed: ${(error as Error).message}`);
      printCommandErrorDetails(error);
      return 'failed';
    }
  }

  return 'installed';
}

export { installCodegraph };
