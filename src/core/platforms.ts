/**
 * Platform Definitions
 *
 * Supported AI coding platforms, mirroring OpenSpec's AI_TOOLS config.
 * Reference: OpenSpec/src/core/config.ts
 */

export interface Platform {
  id: string;
  name: string;
  skillsDir: string;
  detectionPaths?: string[];
  openspecToolId: string;
}

export const PLATFORMS: Platform[] = [
  { id: 'claude', name: 'Claude Code', skillsDir: '.claude', openspecToolId: 'claude' },
  { id: 'cursor', name: 'Cursor', skillsDir: '.cursor', openspecToolId: 'cursor' },
  { id: 'codex', name: 'Codex', skillsDir: '.codex', openspecToolId: 'codex' },
  { id: 'opencode', name: 'OpenCode', skillsDir: '.opencode', openspecToolId: 'opencode' },
  { id: 'windsurf', name: 'Windsurf', skillsDir: '.windsurf', openspecToolId: 'windsurf' },
  { id: 'cline', name: 'Cline', skillsDir: '.cline', openspecToolId: 'cline' },
  { id: 'roocode', name: 'RooCode', skillsDir: '.roo', openspecToolId: 'roocode' },
  { id: 'continue', name: 'Continue', skillsDir: '.continue', openspecToolId: 'continue' },
  {
    id: 'github-copilot',
    name: 'GitHub Copilot',
    skillsDir: '.github',
    detectionPaths: [
      '.github/copilot-instructions.md',
      '.github/instructions',
      '.github/prompts',
      '.github/skills',
    ],
    openspecToolId: 'github-copilot',
  },
  { id: 'gemini', name: 'Gemini CLI', skillsDir: '.gemini', openspecToolId: 'gemini' },
  { id: 'amazon-q', name: 'Amazon Q Developer', skillsDir: '.amazonq', openspecToolId: 'amazon-q' },
  { id: 'qwen', name: 'Qwen Code', skillsDir: '.qwen', openspecToolId: 'qwen' },
  { id: 'kilocode', name: 'Kilo Code', skillsDir: '.kilocode', openspecToolId: 'kilocode' },
  { id: 'auggie', name: 'Auggie (Augment CLI)', skillsDir: '.augment', openspecToolId: 'auggie' },
  { id: 'kiro', name: 'Kiro', skillsDir: '.kiro', openspecToolId: 'kiro' },
  { id: 'lingma', name: 'Lingma', skillsDir: '.lingma', openspecToolId: 'lingma' },
  { id: 'junie', name: 'Junie', skillsDir: '.junie', openspecToolId: 'junie' },
  { id: 'codebuddy', name: 'CodeBuddy Code', skillsDir: '.codebuddy', openspecToolId: 'codebuddy' },
  { id: 'costrict', name: 'CoStrict', skillsDir: '.cospec', openspecToolId: 'costrict' },
  { id: 'crush', name: 'Crush', skillsDir: '.crush', openspecToolId: 'crush' },
  { id: 'factory', name: 'Factory Droid', skillsDir: '.factory', openspecToolId: 'factory' },
  { id: 'iflow', name: 'iFlow', skillsDir: '.iflow', openspecToolId: 'iflow' },
  { id: 'pi', name: 'Pi', skillsDir: '.pi', openspecToolId: 'pi' },
  { id: 'qoder', name: 'Qoder', skillsDir: '.qoder', openspecToolId: 'qoder' },
  { id: 'antigravity', name: 'Antigravity', skillsDir: '.agent', openspecToolId: 'antigravity' },
  { id: 'bob', name: 'Bob Shell', skillsDir: '.bob', openspecToolId: 'bob' },
  { id: 'forgecode', name: 'ForgeCode', skillsDir: '.forge', openspecToolId: 'forgecode' },
  { id: 'trae', name: 'Trae', skillsDir: '.trae', openspecToolId: 'trae' },
];
