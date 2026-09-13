import path from 'path';
import { fileURLToPath } from 'url';
import { runOpenSuperBundleCompatibilityBenchmark } from '../../dist/domains/bundle/compatibility-benchmark.js';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDirectory, '..', '..');
const result = await runOpenSuperBundleCompatibilityBenchmark({ repoRoot });
console.log(JSON.stringify(result, null, 2));

if (
  [
    result.skillContractRate,
    result.ruleContractRate,
    result.hookContractRate,
    result.referenceContractRate,
    result.pathContractRate,
  ].some((rate) => rate !== 1)
) {
  process.exitCode = 1;
}
