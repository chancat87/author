import assert from 'node:assert/strict';
import test from 'node:test';
import { fingerprint, mergeItemsIntoLocal } from '../app/lib/custom-sync-core.js';

const row = (id, content) => ({ id, content });
const remote = (value, serverSeq) => ({ itemId: value.id, value, serverSeq });
const baseline = values => Object.fromEntries(values.map(value => [value.id, { hash: fingerprint(value) }]));

for (const kind of ['chapter', 'settings_node', 'memory_group']) {
    test(`${kind}: multiple revisions apply the highest server sequence without mistaking it for a local edit`, () => {
        const initial = row('one', 'initial');
        const latest = row('one', 'latest');
        const items = [remote(latest, 10), remote(row('one', 'middle'), 9)];
        const result = mergeItemsIntoLocal(kind, [initial], items, baseline([initial]));
        assert.deepEqual(result, { changed: true, value: [latest] });
        assert.deepEqual(initial, row('one', 'initial'));
        assert.equal(items[0].serverSeq, 10);
    });

    test(`${kind}: a create/update/delete batch leaves no resurrected item`, () => {
        const result = mergeItemsIntoLocal(kind, [], [
            remote(row('one', 'new'), 1), remote(row('one', 'updated'), 2),
            { itemId: 'one', deleted: true, serverSeq: 3 },
        ]);
        assert.deepEqual(result.value, []);
    });

    test(`${kind}: an unsent local deletion survives incoming live revisions`, () => {
        const initial = row('one', 'initial');
        const result = mergeItemsIntoLocal(kind, [], [remote(row('one', 'remote edit'), 2)], baseline([initial]));
        assert.deepEqual(result, { changed: false, value: [] });
    });

    test(`${kind}: local edits survive update/delete batches while unrelated changes apply`, () => {
        const initial = row('one', 'initial');
        const local = row('one', 'new local draft');
        const other = row('two', 'unchanged');
        const updatedOther = row('two', 'remote update');
        const result = mergeItemsIntoLocal(kind, [local, other], [
            remote(row('one', 'remote edit'), 2), { itemId: 'one', deleted: true, serverSeq: 3 },
            remote(updatedOther, 4),
        ], baseline([initial, other]));
        assert.deepEqual(result.value, [local, updatedOther]);
    });

    test(`${kind}: a remote recreation after an acknowledged deletion can be restored`, () => {
        const recreated = row('one', 'recreated remotely');
        assert.deepEqual(mergeItemsIntoLocal(kind, [], [remote(recreated, 4)], { one: { deleted: true } }).value, [recreated]);
    });

    test(`${kind}: force-rebuilding a tombstone-only key produces an empty array`, () => {
        assert.deepEqual(mergeItemsIntoLocal(kind, undefined, [{ itemId: 'one', deleted: true, serverSeq: 3 }]).value, []);
    });
}

test('merge preserves local order, appends new items, and respects numeric sequence strings', () => {
    const local = [row('b', 'b'), row('a', 'a')];
    const latest = row('a', 'latest');
    const added = row('c', 'new');
    assert.deepEqual(mergeItemsIntoLocal('chapter', local, [remote(latest, '10'), remote(row('a', 'older'), '9'), remote(added, '11')], baseline(local)).value, [local[0], latest, added]);
});

test('works-index mirroring uses numeric server sequence order', () => {
    const latest = [{ id: 'work-new' }];
    const result = mergeItemsIntoLocal('works_index', [], [
        { itemId: '_index', serverSeq: '10', value: latest },
        { itemId: '_index', serverSeq: '9', value: [{ id: 'old' }] },
    ]);
    assert.deepEqual(result.value, latest);
});
