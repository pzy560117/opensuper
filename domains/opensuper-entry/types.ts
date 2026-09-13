import type { RecordedCommandCheck } from '../opensuper-classic/classic-command-checks.js';
import type { NativePortableStatusProjection } from '../opensuper-native/native-portable-status.js';
import type { NativeStatusProjection } from '../opensuper-native/native-types.js';

export type OpenSuperWorkflow = 'native' | 'classic';

export type InitWorkflowSelection = OpenSuperWorkflow | 'both';

export type OpenSuperEntrySkill = 'opensuper-native' | 'opensuper-classic';

export type OpenSuperEntryResolutionSource =
  'project-config' | 'global-config' | 'built-in-default' | 'legacy-project' | 'legacy-fallback';

export interface OpenSuperEntryResolution {
  workflow: OpenSuperWorkflow;
  skill: OpenSuperEntrySkill;
  source: OpenSuperEntryResolutionSource;
}

export interface ChangeStatus {
  name: string;
  opensuperManaged: boolean;
  archiveReady: boolean;
  recommendedArchiveCommand: string;
  workflow: string | null;
  phase: string | null;
  buildMode: string | null;
  isolation: string | null;
  boundBranch: string | null;
  verifyMode: string | null;
  verifyResult: string | null;
  designDoc: string | null;
  plan: string | null;
  tasksCompleted: number;
  tasksTotal: number;
  nextCommand: string | null;
  currentStep: string | null;
  runtimeMode: string | null;
  runtimeEval: {
    stepId: string;
    passed: boolean;
    requiredEvidence: string[];
    missingEvidence: string[];
  } | null;
  commandChecks: {
    build: RecordedCommandCheck | null;
    verify: RecordedCommandCheck | null;
  } | null;
  error?: string;
}

export interface NativeChangeStatusError {
  name: string;
  error: string;
}

export interface OpenSuperProjectStatus {
  schema: 'opensuper.status.v2';
  defaultEntry: OpenSuperEntryResolution | { error: string };
  workflows: {
    native: {
      changes: Array<
        NativeStatusProjection | NativePortableStatusProjection | NativeChangeStatusError
      >;
      error?: string;
    };
    classic: { changes: ChangeStatus[]; error?: string };
  };
  unmanagedOpenSpec: ChangeStatus[];
}
