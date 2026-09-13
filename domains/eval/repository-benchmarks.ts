import { resolveRepositoryEvalWorkspace } from './index.js';

export function resolveBenchmarkPaths() {
  const workspace = resolveRepositoryEvalWorkspace();
  return {
    contextCompression: `${workspace.root}/local/tests`,
    contextExecution: `${workspace.root}/local/tests`,
    regressionBaseline: `${workspace.root}/local/regression_baseline.json`,
  };
}
