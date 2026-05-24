#!/usr/bin/env node

import { execFileSync } from 'child_process';
import { existsSync, rmSync } from 'fs';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

const runTsc = (args = []) => {
  const tscPath = require.resolve('typescript/bin/tsc');
  execFileSync(process.execPath, [tscPath, ...args], { stdio: 'inherit' });
};

console.log('Building OpenSuper...\n');

if (existsSync('dist')) {
  console.log('Cleaning dist directory...');
  rmSync('dist', { recursive: true, force: true });
}

console.log('Compiling TypeScript...');
try {
  runTsc(['--version']);
  runTsc();
  console.log('\nBuild completed successfully!');
} catch (error) {
  console.error('\nBuild failed!');
  process.exit(1);
}
