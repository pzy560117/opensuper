import { runOpenSuperEntryRuntime } from './entry-runtime.js';

process.exitCode = await runOpenSuperEntryRuntime(process.argv.slice(2));
