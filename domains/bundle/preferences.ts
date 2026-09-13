import {
  readProjectSkillPreferences,
  skillPreferenceEntries,
  type NormalizedSkillPreferences,
  type SkillPreferenceWarning,
} from '../skill/preferences.js';

export interface BundleSkillPreferences {
  names: string[];
  preferences: NormalizedSkillPreferences;
  path: string;
  hash: string;
  warnings: SkillPreferenceWarning[];
}

export async function readBundleSkillPreferences(
  projectRoot: string,
): Promise<BundleSkillPreferences | null> {
  const projectPreferences = await readProjectSkillPreferences(projectRoot);
  if (!projectPreferences) return null;
  return {
    names: skillPreferenceEntries(projectPreferences.preferences).map((entry) => entry.query),
    preferences: projectPreferences.preferences,
    path: projectPreferences.path,
    hash: projectPreferences.hash,
    warnings: projectPreferences.warnings,
  };
}

export async function readSkillPreferences(projectRoot: string): Promise<string[] | null> {
  return (await readBundleSkillPreferences(projectRoot))?.names ?? null;
}
