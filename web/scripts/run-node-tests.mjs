// Runs every node:test file under src/ (anything named *.test.ts that is NOT
// inside a __tests__ folder — those are vitest/jsdom suites). Keeping this a
// glob means a new test file can't be silently left out of `npm test`.
import { spawnSync } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const root = new URL('../src', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const files = [];

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name === '__tests__' || name === 'node_modules') continue;
      walk(full);
    } else if (name.endsWith('.test.ts')) {
      files.push(full);
    }
  }
}

walk(root);
files.sort();

if (files.length === 0) {
  console.error('run-node-tests: no *.test.ts files found under src/');
  process.exit(1);
}

console.log(`run-node-tests: ${files.length} files`);
for (const f of files) console.log(`  ${relative(process.cwd(), f).split(sep).join('/')}`);

const result = spawnSync(
  process.execPath,
  ['--test', '--experimental-strip-types', ...files],
  { stdio: 'inherit' },
);
process.exit(result.status ?? 1);
