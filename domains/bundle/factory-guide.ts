import path from 'path';
import { buildSkillInventory, type SkillInventoryItem } from '../skill/inventory.js';
import {
  readProjectSkillPreferences,
  skillPreferencesPath,
  type ProjectSkillPreferences,
} from '../skill/preferences.js';
import { buildBundleResumeSummary, type BundleResumeSummary } from './next-action.js';
import { listBundleAuthoringStatesReadOnly } from './state.js';

export interface BundleFactoryGuide {
  schemaVersion: 1;
  projectRoot: string;
  firstRun: boolean;
  preference: {
    state: 'missing' | 'present' | 'invalid';
    path: string;
    mode: 'advisory' | 'strict' | null;
    hash: string | null;
    prefer: string[];
    require: string[];
    warnings: unknown[];
    error: string | null;
  };
  inventory: {
    total: number;
    recommended: SkillInventoryItem[];
    ambiguous: SkillInventoryItem[];
    duplicateInstalls: SkillInventoryItem[];
    groups: Record<string, string[]>;
  };
  resumable: BundleResumeSummary[];
  nextQuestions: string[];
  userMessage: {
    title: string;
    summary: string;
    nextStep: string;
  };
}

function groups(items: SkillInventoryItem[]): Record<string, string[]> {
  return items.reduce<Record<string, string[]>>((acc, item) => {
    acc[item.capabilityGroup] = [...(acc[item.capabilityGroup] ?? []), item.name];
    return acc;
  }, {});
}

async function readPreferencesSafely(projectRoot: string): Promise<{
  value: ProjectSkillPreferences | null;
  error: string | null;
}> {
  try {
    return { value: await readProjectSkillPreferences(projectRoot), error: null };
  } catch (error) {
    return { value: null, error: (error as Error).message };
  }
}

export async function buildBundleFactoryGuide(options: {
  projectRoot: string;
  homeDir?: string;
  builtinRoot?: string;
}): Promise<BundleFactoryGuide> {
  const projectRoot = path.resolve(options.projectRoot);
  const [preferencesResult, inventory, states] = await Promise.all([
    readPreferencesSafely(projectRoot),
    buildSkillInventory({
      projectRoot,
      homeDir: options.homeDir,
      builtinRoot: options.builtinRoot,
    }),
    listBundleAuthoringStatesReadOnly(projectRoot),
  ]);
  const preferences = preferencesResult.value;
  const resumable = states
    .filter((state) => Boolean(state.factory) && !state.ready)
    .map((state) =>
      buildBundleResumeSummary(state, {
        currentPreferenceHash: preferences?.hash ?? null,
      }),
    );
  const recommended = inventory.filter((item) => item.recommended);
  const ambiguous = inventory.filter((item) => item.status === 'ambiguous');
  const duplicateInstalls = inventory.filter((item) => item.duplicateInstall);
  const hasPreferences = Boolean(preferences);
  const hasInvalidPreferences = Boolean(preferencesResult.error);
  const hasResumable = resumable.length > 0;

  return {
    schemaVersion: 1,
    projectRoot,
    firstRun: !hasPreferences && !hasInvalidPreferences && !hasResumable,
    preference: {
      state: hasInvalidPreferences ? 'invalid' : hasPreferences ? 'present' : 'missing',
      path: preferences?.path ?? skillPreferencesPath(projectRoot),
      mode: preferences?.preferences.mode ?? null,
      hash: preferences?.hash ?? null,
      prefer: preferences?.preferences.prefer ?? [],
      require: preferences?.preferences.require ?? [],
      warnings: preferences?.warnings ?? [],
      error: preferencesResult.error,
    },
    inventory: {
      total: inventory.length,
      recommended,
      ambiguous,
      duplicateInstalls,
      groups: groups(inventory),
    },
    resumable,
    nextQuestions: [
      'What Skill do you want to create or optimize?',
      'Which discovered Skills should OpenSuper prefer?',
      'Should OpenSuper save these preferences to .opensuper/skill-preferences.yaml?',
      'May OpenSuper generate scripts, rules, and hooks as the control plane?',
    ],
    userMessage: hasInvalidPreferences
      ? {
          title: 'Fix project Skill preferences',
          summary: `Saved project preferences in .opensuper/skill-preferences.yaml are invalid: ${preferencesResult.error}`,
          nextStep:
            'Open .opensuper/skill-preferences.yaml, fix the error, then run /opensuper-any again.',
        }
      : hasResumable
        ? {
            title: 'Resume /opensuper-any',
            summary: `Found ${resumable.length} unfinished Skill creation flow(s).`,
            nextStep:
              'Resume one flow before starting a new Skill unless the user explicitly starts over.',
          }
        : hasPreferences
          ? {
              title: 'Start with saved project preferences',
              summary: `Using ${preferences!.preferences.prefer.length + preferences!.preferences.require.length} saved Skill preference(s).`,
              nextStep: 'Ask for the Skill goal, then build a composition proposal.',
            }
          : {
              title: 'Start with /opensuper-any',
              summary: 'No project Skill preferences are saved yet.',
              nextStep:
                'Show discovered recommended Skills and ask whether to save project preferences.',
            },
  };
}
