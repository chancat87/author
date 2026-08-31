const SETTINGS_ACTION_MODES = new Set(['append', 'merge', 'replace', 'ask']);
const UNSAFE_OBJECT_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

// These fields describe one current value. Appending text would produce invalid
// values such as "18\n19", so conservative merging keeps the old value and asks.
const SINGLE_VALUE_FIELDS = new Set([
    'title', 'name', 'role', 'age', 'gender', 'status', 'genre', 'style', 'tone',
    'pov', 'targetAudience', 'currentHolder', 'dangerLevel', 'objectType', 'rank',
]);

function isPlainObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isEmptyValue(value) {
    if (value === null || value === undefined) return true;
    if (typeof value === 'string') return value.trim() === '';
    if (Array.isArray(value)) return value.length === 0;
    if (isPlainObject(value)) return Object.keys(value).length === 0;
    return false;
}

function normalizedText(value) {
    return String(value).trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}

function stableValueKey(value) {
    if (Array.isArray(value)) {
        return `[${value.map(item => stableValueKey(item)).join(',')}]`;
    }
    if (isPlainObject(value)) {
        return `{${Object.keys(value).filter(key => !UNSAFE_OBJECT_KEYS.has(key)).sort().map(key => (
            `${JSON.stringify(key)}:${stableValueKey(value[key])}`
        )).join(',')}}`;
    }
    return JSON.stringify(value);
}

function cloneValue(value) {
    if (Array.isArray(value)) return value.map(item => cloneValue(item));
    if (isPlainObject(value)) {
        return Object.fromEntries(
            Object.entries(value)
                .filter(([key]) => !UNSAFE_OBJECT_KEYS.has(key))
                .map(([key, item]) => [key, cloneValue(item)]),
        );
    }
    return value;
}

function exactValuesEqual(left, right) {
    return stableValueKey(left) === stableValueKey(right);
}

function valuesEqual(left, right) {
    if (typeof left === 'string' && typeof right === 'string') {
        return normalizedText(left) === normalizedText(right);
    }
    return stableValueKey(left) === stableValueKey(right);
}

function mergeArrays(previous, incoming) {
    const seen = new Set();
    return [...previous, ...incoming].filter(item => {
        const key = stableValueKey(item);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

function mergeText(previous, incoming) {
    const oldText = String(previous).trim();
    const newText = String(incoming).trim();
    const normalizedOld = normalizedText(oldText);
    const normalizedNew = normalizedText(newText);

    if (!normalizedNew || normalizedOld.includes(normalizedNew)) return oldText;
    // If the proposed text already contains the complete old value, it is a
    // lossless consolidation and can be used directly without duplication.
    if (normalizedNew.includes(normalizedOld)) return newText;
    return `${oldText}\n${newText}`;
}

function mergeValue(key, previous, incoming, mode) {
    if (isEmptyValue(previous)) {
        return { value: incoming, kind: 'added', conflict: false };
    }
    if (isEmptyValue(incoming) || valuesEqual(previous, incoming)) {
        return { value: previous, kind: 'unchanged', conflict: false };
    }
    if (mode === 'replace') {
        return { value: incoming, kind: 'replaced', conflict: false };
    }
    if (Array.isArray(previous) && Array.isArray(incoming)) {
        return { value: mergeArrays(previous, incoming), kind: 'merged', conflict: false };
    }
    if (isPlainObject(previous) && isPlainObject(incoming)) {
        const nested = createSettingsContentPlan(previous, incoming, mode);
        return {
            value: nested.content,
            kind: nested.changed ? 'merged' : 'unchanged',
            conflict: nested.conflictFields.length > 0,
        };
    }
    if (typeof previous === 'string' && typeof incoming === 'string') {
        if (SINGLE_VALUE_FIELDS.has(key)) {
            return { value: previous, kind: 'conflict', conflict: true };
        }
        const value = mergeText(previous, incoming);
        return {
            value,
            kind: value === previous ? 'unchanged' : 'appended',
            conflict: false,
        };
    }

    // Booleans, numbers and mismatched types cannot be safely appended.
    return { value: previous, kind: 'conflict', conflict: true };
}

export function normalizeSettingsActionMode(action = {}) {
    if (action.action === 'append') return 'append';
    if (SETTINGS_ACTION_MODES.has(action.mode)) return action.mode;
    // Legacy update actions did not describe whether replacement was intended.
    // Treat them as ambiguous so existing user content is never overwritten.
    if (action.action === 'update') return 'ask';
    return 'append';
}

export function createSettingsContentPlan(existing = {}, incoming = {}, requestedMode = 'append') {
    const safeExisting = isPlainObject(existing) ? cloneValue(existing) : {};
    const safeIncoming = isPlainObject(incoming) ? cloneValue(incoming) : {};
    const mode = SETTINGS_ACTION_MODES.has(requestedMode) ? requestedMode : 'append';
    const mergeMode = mode === 'ask' ? 'append' : mode;
    const content = { ...safeExisting };
    const fields = [];

    for (const [key, incomingValue] of Object.entries(safeIncoming)) {
        const previousValue = safeExisting[key];
        const result = mergeValue(key, previousValue, incomingValue, mergeMode);
        content[key] = result.value;
        fields.push({
            key,
            previous: previousValue,
            incoming: incomingValue,
            result: result.value,
            kind: result.kind,
            conflict: result.conflict,
            overlaps: !isEmptyValue(previousValue) && !valuesEqual(previousValue, incomingValue),
        });
    }

    const overlapFields = fields.filter(field => field.overlaps).map(field => field.key);
    const conflictFields = fields.filter(field => field.conflict).map(field => field.key);
    const changed = fields.some(field => !valuesEqual(field.previous, field.result));

    return {
        mode,
        content,
        fields,
        overlapFields,
        conflictFields,
        changed,
        requiresReview: overlapFields.length > 0 && (
            mode === 'ask' || mode === 'replace' || conflictFields.length > 0
        ),
    };
}

export function createSettingsUndoPatch(previous = {}, applied = {}) {
    const safePrevious = isPlainObject(previous) ? previous : {};
    const safeApplied = isPlainObject(applied) ? applied : {};
    const keys = new Set([...Object.keys(safePrevious), ...Object.keys(safeApplied)]);
    const fields = [];

    for (const key of keys) {
        const previousExists = Object.hasOwn(safePrevious, key);
        const appliedExists = Object.hasOwn(safeApplied, key);
        const previousValue = safePrevious[key];
        const appliedValue = safeApplied[key];
        if (previousExists === appliedExists && exactValuesEqual(previousValue, appliedValue)) continue;
        fields.push({
            key,
            previousExists,
            previous: cloneValue(previousValue),
            appliedExists,
            applied: cloneValue(appliedValue),
        });
    }

    return { fields };
}

function restorePrevious(field) {
    return field.previousExists
        ? { changed: true, remove: false, value: cloneValue(field.previous) }
        : { changed: true, remove: true };
}

function revertArrayAppend(current, field) {
    if (!field.previousExists || !field.appliedExists) return null;
    if (!Array.isArray(field.previous) || !Array.isArray(field.applied) || !Array.isArray(current)) return null;

    const previousKeys = new Set(field.previous.map(item => stableValueKey(item)));
    if (!field.previous.every(item => field.applied.some(candidate => exactValuesEqual(candidate, item)))) return null;
    const introducedKeys = new Set(
        field.applied
            .filter(item => !previousKeys.has(stableValueKey(item)))
            .map(item => stableValueKey(item)),
    );
    if (introducedKeys.size === 0) return null;

    const value = current.filter(item => !introducedKeys.has(stableValueKey(item)));
    if (value.length === current.length) return null;
    return { changed: true, remove: false, value };
}

function revertTextAppend(current, field) {
    if (!field.appliedExists || typeof field.applied !== 'string' || typeof current !== 'string') return null;
    const previous = field.previousExists && typeof field.previous === 'string'
        ? field.previous.trim()
        : '';
    const applied = field.applied.trim();

    if (!previous) {
        if (current.startsWith(`${applied}\n`)) {
            return { changed: true, remove: false, value: current.slice(applied.length + 1) };
        }
        return null;
    }
    if (!applied.startsWith(`${previous}\n`)) return null;

    const appended = applied.slice(previous.length + 1);
    if (!appended) return null;
    if (current.startsWith(`${applied}\n`)) {
        return {
            changed: true,
            remove: false,
            value: `${previous}${current.slice(applied.length)}`,
        };
    }

    const marker = `\n${appended}`;
    const markerIndex = current.indexOf(marker);
    if (markerIndex < 0) return null;
    return {
        changed: true,
        remove: false,
        value: `${current.slice(0, markerIndex)}${current.slice(markerIndex + marker.length)}`,
    };
}

function revertNestedObject(current, field) {
    if (!field.previousExists || !field.appliedExists) return null;
    if (!isPlainObject(field.previous) || !isPlainObject(field.applied) || !isPlainObject(current)) return null;
    const nestedPatch = createSettingsUndoPatch(field.previous, field.applied);
    const nested = applySettingsUndoPatch(current, nestedPatch);
    if (nested.revertedFields.length === 0) return null;
    return {
        changed: true,
        remove: false,
        value: nested.content,
        preserved: nested.preservedFields.length > 0,
    };
}

function revertField(currentExists, current, field) {
    if (currentExists === field.appliedExists && (
        !currentExists || exactValuesEqual(current, field.applied)
    )) {
        return restorePrevious(field);
    }

    const nested = revertNestedObject(current, field);
    if (nested) return nested;
    const array = revertArrayAppend(current, field);
    if (array) return array;
    const text = revertTextAppend(current, field);
    if (text) return text;
    return { changed: false, preserved: true };
}

export function applySettingsUndoPatch(current = {}, patch = {}) {
    const safeCurrent = isPlainObject(current) ? current : {};
    const content = { ...safeCurrent };
    const revertedFields = [];
    const preservedFields = [];

    for (const field of patch.fields || []) {
        const currentExists = Object.hasOwn(content, field.key);
        const result = revertField(currentExists, content[field.key], field);
        if (!result.changed) {
            preservedFields.push(field.key);
            continue;
        }
        if (result.remove) delete content[field.key];
        else content[field.key] = result.value;
        revertedFields.push(field.key);
        if (result.preserved) preservedFields.push(field.key);
    }

    return { content, revertedFields, preservedFields };
}

export function canUndoCreatedSettingsNode(current = {}, createdSnapshot = {}) {
    if (!isPlainObject(current) || !isPlainObject(createdSnapshot)) return false;
    const currentState = {
        name: current.name,
        content: isPlainObject(current.content) ? current.content : {},
    };
    const createdState = {
        name: createdSnapshot.name,
        content: isPlainObject(createdSnapshot.content) ? createdSnapshot.content : {},
    };
    return createSettingsUndoPatch(createdState, currentState).fields.length === 0;
}

export function dismissSettingsActionCard(message = {}, actionKey = '') {
    if (!actionKey) return { ...message };
    const dismissedActions = Array.isArray(message._dismissedActions)
        ? message._dismissedActions
        : [];
    return {
        ...message,
        _dismissedActions: [...new Set([...dismissedActions, actionKey])],
    };
}
