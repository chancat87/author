import assert from 'node:assert/strict';
import test from 'node:test';

import {
    buildChapterSynopsisText,
    normalizeChapterSynopsis,
} from '../app/lib/chapter-synopsis.js';

test('structured story-memory fields survive v1 normalization', () => {
    const source = {
        schemaVersion: 1,
        summary: '章节摘要',
        events: [{ eventId: 'event-1', text: '主角离开故乡', actors: ['hero'], effects: ['journey-started'] }],
        entityDeltas: [{ entityId: 'hero', before: { location: 'home' }, after: { location: 'road' } }],
        foreshadowing: [{ hookId: 'hook-1', description: '神秘来信', status: 'open' }],
        timelineRefs: [{ eventId: 'event-1', order: 1 }],
        spoilerLevel: 2,
    };

    const normalized = normalizeChapterSynopsis(source);
    assert.deepEqual(normalized.events, source.events);
    assert.deepEqual(normalized.entityDeltas, source.entityDeltas);
    assert.deepEqual(normalized.foreshadowing, source.foreshadowing);
    assert.deepEqual(normalized.timelineRefs, source.timelineRefs);
    assert.equal(normalized.spoilerLevel, 2);
    assert.notEqual(normalized.events[0], source.events[0]);
    assert.match(buildChapterSynopsisText(normalized), /主角离开故乡/);
});

test('unknown future synopsis schemas retain unknown fields without v1 defaults', () => {
    const future = {
        schemaVersion: 7,
        summary: '未来摘要',
        events: [{ eventId: 'future-event', causes: ['cause-1'] }],
        futureLedger: { revision: 42, opaque: ['keep', { nested: true }] },
    };
    const normalized = normalizeChapterSynopsis(future);
    assert.deepEqual(normalized, future);
    assert.equal('spoilerLevel' in normalized, false);
    assert.notEqual(normalized.futureLedger, future.futureLedger);
});
