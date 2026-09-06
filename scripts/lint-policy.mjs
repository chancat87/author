import path from 'node:path';

export function warningCounts(results, root) {
    const counts = {};
    for (const result of results) {
        const file = path.relative(root, result.filePath).replaceAll('\\', '/');
        for (const message of result.messages) {
            if (message.severity !== 1) continue;
            const key = JSON.stringify([file, message.ruleId, message.message.split('\n')[0]]);
            counts[key] = (counts[key] || 0) + 1;
        }
    }
    return Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
}

export function evaluateLint(results, baseline, root) {
    if (baseline.version !== 1 || !baseline.warnings || Object.values(baseline.warnings).some(n => !Number.isInteger(n) || n < 1)) {
        throw new Error('Invalid lint baseline.');
    }
    const warnings = warningCounts(results, root);
    const errors = results.reduce((n, result) => n + result.errorCount + (result.fatalErrorCount || 0), 0);
    const increased = Object.entries(warnings).filter(([key, count]) => count > (baseline.warnings[key] || 0));
    // Reductions must also be recorded, so a later change cannot reuse old headroom.
    const reduced = Object.entries(baseline.warnings).filter(([key, count]) => (warnings[key] || 0) < count);
    return { errors, warnings, increased, reduced, passed: errors === 0 && increased.length === 0 && reduced.length === 0 };
}

export function baselineIncreases(current, previous) {
    return Object.entries(current.warnings).filter(([key, count]) => count > (previous.warnings[key] || 0));
}
