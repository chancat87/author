import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';
import { baselineIncreases, evaluateLint, warningCounts } from '../scripts/lint-policy.mjs';
import { verifyArchive } from '../scripts/security/gitleaks.mjs';

const root = path.resolve('synthetic-project');
const result = (file, messages, errorCount = 0) => ({ filePath: path.join(root, file), messages, errorCount });
const warning = { severity: 1, ruleId: 'synthetic-rule', message: 'Synthetic warning', line: 1 };
const original = [result('app.js', [warning])];
const baseline = { version: 1, warnings: warningCounts(original, root) };

test('unchanged warnings survive line shifts but new files cannot borrow warning budget', () => {
    assert.equal(evaluateLint([result('app.js', [{ ...warning, line: 90 }])], baseline, root).passed, true);
    assert.equal(evaluateLint([result('other.js', [warning])], baseline, root).passed, false);
});

test('new rules and increased warning counts fail even with no lint errors', () => {
    assert.equal(evaluateLint([result('app.js', [warning, warning])], baseline, root).passed, false);
    assert.equal(evaluateLint([result('app.js', [{ ...warning, ruleId: 'another-rule' }])], baseline, root).passed, false);
});

test('errors always fail and fixed warnings require lowering the baseline', () => {
    assert.equal(evaluateLint([result('app.js', [warning], 1)], baseline, root).passed, false);
    assert.equal(evaluateLint([], baseline, root).reduced.length, 1);
    assert.equal(evaluateLint([], { version: 1, warnings: {} }, root).passed, true);
});

test('download checksum mismatch fails before an executable can be installed', () => {
    assert.throws(() => verifyArchive(Buffer.from('synthetic corrupted archive'), '0'.repeat(64)), /SHA-256 mismatch/);
});

test('raising the baseline cannot hide a newly introduced warning', () => {
    const increased = { version: 1, warnings: warningCounts([result('app.js', [warning, warning])], root) };
    assert.equal(evaluateLint([result('app.js', [warning, warning])], increased, root).passed, true);
    assert.equal(baselineIncreases(increased, baseline).length, 1);
    assert.equal(baselineIncreases({ version: 1, warnings: {} }, baseline).length, 0);
});
