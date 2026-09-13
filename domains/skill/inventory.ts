import { findPreferredSkills, type FoundSkillSource } from './find.js';

export type SkillInventoryStatus = 'available' | 'ambiguous' | 'missing';

export interface SkillInventoryItem {
  name: string;
  description: string;
  capabilityGroup: string;
  sources: FoundSkillSource[];
  hashes: string[];
  status: SkillInventoryStatus;
  duplicateInstall: boolean;
  recommended: boolean;
  reason: string;
}

const RECOMMENDED = new Set([
  'brainstorming',
  'writing-plans',
  'systematic-debugging',
  'test-driven-development',
  'verification-before-completion',
  'requesting-code-review',
]);

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function groupFor(name: string, description: string): string {
  const text = `${name} ${description}`.toLowerCase();
  if (text.includes('brainstorm') || text.includes('intent') || text.includes('clarif')) {
    return 'discovery';
  }
  if (text.includes('plan') || text.includes('tdd') || text.includes('implement')) {
    return 'planning';
  }
  if (text.includes('debug') || text.includes('fix')) return 'debugging';
  if (text.includes('review')) return 'review';
  if (text.includes('verify') || text.includes('completion')) return 'verification';
  if (text.includes('skill')) return 'skill-authoring';
  return 'other';
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort(compareText);
}

export async function buildSkillInventory(options: {
  projectRoot: string;
  homeDir?: string;
  builtinRoot?: string;
}): Promise<SkillInventoryItem[]> {
  const found = await findPreferredSkills({
    projectRoot: options.projectRoot,
    homeDir: options.homeDir,
    builtinRoot: options.builtinRoot,
    preferences: null,
  });

  return found
    .map((skill): SkillInventoryItem => {
      const hashes = uniqueSorted(skill.sources.map((source) => source.hash));
      const first = skill.sources[0];
      const status =
        skill.sources.length === 0 ? 'missing' : hashes.length > 1 ? 'ambiguous' : 'available';
      const duplicateInstall = skill.sources.length > 1 && hashes.length === 1;
      const recommended = RECOMMENDED.has(skill.query);
      return {
        name: skill.query,
        description: first?.description ?? '',
        capabilityGroup: groupFor(skill.query, first?.description ?? ''),
        sources: skill.sources,
        hashes,
        status,
        duplicateInstall,
        recommended,
        reason: recommended
          ? 'Recommended default Skill for OpenSuper-style guided workflows.'
          : 'Discovered from supported local Skill roots.',
      };
    })
    .sort((left, right) => compareText(left.name, right.name));
}
