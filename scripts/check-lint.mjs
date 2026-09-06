import { ESLint } from 'eslint';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { git, repositoryFiles } from './repository-files.mjs';
import { baselineIncreases, evaluateLint } from './lint-policy.mjs';

const root = process.cwd();
const eslint = new ESLint();
const candidates = repositoryFiles(root).filter(file => /\.(?:[cm]?js|jsx|tsx?|mts|cts)$/.test(file) && existsSync(file));
const files = [];
for (const file of candidates) if (!await eslint.isPathIgnored(file)) files.push(file);
if (!files.length) throw new Error('No source files were selected for lint.');
const results = await eslint.lintFiles(files);
const baseline = JSON.parse(readFileSync(path.join(root, 'scripts/lint-baseline.json'), 'utf8'));
const status = evaluateLint(results, baseline, root);
const requestedBase = process.env.LINT_BASE_SHA;
if (requestedBase && !/^[a-f0-9]{40}$/.test(requestedBase)) throw new Error('LINT_BASE_SHA must be a full commit SHA.');
const base = requestedBase && !/^0+$/.test(requestedBase) ? requestedBase : 'HEAD';
const baselinePath = 'scripts/lint-baseline.json';
if (git(root, ['ls-tree', '--name-only', base, '--', baselinePath]).trim()) {
    const previous = JSON.parse(git(root, ['show', `${base}:${baselinePath}`]));
    const raised = baselineIncreases(baseline, previous);
    if (raised.length) {
        console.error(`Lint baseline was increased against ${base}: ${raised.map(([key]) => key).join(', ')}`);
        status.passed = false;
    }
} else console.log('Initializing the lint baseline: comparison commit has no baseline yet.');
const formatter = await eslint.loadFormatter('stylish');
const diagnostics = formatter.format(results);
if (diagnostics) console.log(diagnostics);
for (const [key, count] of status.increased) console.error(`New/increased warning: ${key} (${count})`);
for (const [key] of status.reduced) console.error(`Warning fixed: lower this baseline entry in scripts/lint-baseline.json: ${key}`);
console.log(`Lint gate: ${files.length} files, ${status.errors} errors, ${Object.values(status.warnings).reduce((a, b) => a + b, 0)} warnings; ${status.passed ? 'passed' : 'failed'}.`);
if (!status.passed) process.exitCode = 1;
