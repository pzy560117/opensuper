import { execSync } from 'child_process';

import type { InstallScope } from './types.js';

const SKILLS_AGENT_MAP: Record<string, string> = {
  claude: 'claude-code',
  cursor: 'cursor',
  codex: 'codex',
  opencode: 'opencode',
  windsurf: 'windsurf',
  cline: 'cline',
  roocode: 'roo-code',
  continue: 'continue',
  'github-copilot': 'github-copilot',
  gemini: 'gemini',
  'amazon-q': 'amazon-q',
  qwen: 'qwen',
  kilocode: 'kilo-code',
  auggie: 'augment',
  kiro: 'kiro',
  lingma: 'lingma',
  junie: 'junie',
  codebuddy: 'codebuddy',
  costrict: 'costrict',
  crush: 'crush',
  factory: 'factory',
  iflow: 'iflow',
  pi: 'pi',
  qoder: 'qoder',
  antigravity: 'antigravity',
  bob: 'bob',
  forgecode: 'forge',
  trae: 'trae',
};

const VALID_PLATFORM_IDS = new Set(Object.keys(SKILLS_AGENT_MAP));

async function installSuperpowersForPlatforms(
  projectPath: string,
  scope: InstallScope,
  platformIds: string[],
): Promise<'installed' | 'failed' | 'skipped'> {
  const unknownIds = platformIds.filter((id) => !VALID_PLATFORM_IDS.has(id));
  if (unknownIds.length > 0) {
    throw new Error(`Unknown platform IDs: ${unknownIds.join(', ')}`);
  }

  const agentNames = platformIds.map((id) => SKILLS_AGENT_MAP[id]).filter(Boolean);

  if (agentNames.length === 0) {
    console.error(`    No valid agent names resolved for platforms: ${platformIds.join(', ')}`);
    return 'failed';
  }

  try {
    const flags = ['-y', scope === 'global' ? '-g' : '', `--agent ${agentNames.join(',')}`]
      .filter(Boolean)
      .join(' ');

    execSync(`npx skills add obra/superpowers ${flags}`, {
      cwd: projectPath,
      stdio: 'pipe',
      timeout: 120_000,
    });
    return 'installed';
  } catch (error) {
    console.error(`    Superpowers install failed: ${(error as Error).message}`);
    return 'failed';
  }
}

export { installSuperpowersForPlatforms, SKILLS_AGENT_MAP };
