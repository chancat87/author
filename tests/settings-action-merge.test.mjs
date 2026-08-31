import test from 'node:test';
import assert from 'node:assert/strict';

import {
    applySettingsUndoPatch,
    canUndoCreatedSettingsNode,
    createSettingsContentPlan,
    createSettingsUndoPatch,
    dismissSettingsActionCard,
    normalizeSettingsActionMode,
} from '../app/lib/settings-action-merge.js';

test('a newly created settings item is only removable while it remains unchanged', () => {
    const createdSnapshot = {
        name: '测试角色',
        content: { personality: '谨慎' },
    };

    assert.equal(canUndoCreatedSettingsNode({
        id: 'role-1',
        name: '测试角色',
        content: { personality: '谨慎' },
    }, createdSnapshot), true);
    assert.equal(canUndoCreatedSettingsNode({
        id: 'role-1',
        name: '测试角色',
        content: { personality: '谨慎', notes: '后来手动添加' },
    }, createdSnapshot), false);
});

test('legacy updates require review instead of silently replacing content', () => {
    assert.equal(normalizeSettingsActionMode({ action: 'update' }), 'ask');
    assert.equal(normalizeSettingsActionMode({ action: 'append' }), 'append');
    assert.equal(normalizeSettingsActionMode({ action: 'update', mode: 'replace' }), 'replace');
    const plan = createSettingsContentPlan(
        { personality: '谨慎、多疑，但重视同伴', background: '来自旧城区' },
        { personality: '第五章表现出对同伴的依赖' },
        'ask',
    );

    assert.equal(plan.requiresReview, true);
    assert.equal(
        plan.content.personality,
        '谨慎、多疑，但重视同伴\n第五章表现出对同伴的依赖',
    );
    assert.equal(plan.content.background, '来自旧城区');
});

test('append preserves prose, avoids duplicates and merges arrays', () => {
    const plan = createSettingsContentPlan(
        { notes: '善于观察', skills: ['写作', '调查'] },
        { notes: '善于观察', skills: ['调查', '推理'] },
        'append',
    );

    assert.equal(plan.content.notes, '善于观察');
    assert.deepEqual(plan.content.skills, ['写作', '调查', '推理']);
    assert.equal(plan.requiresReview, false);
});

test('single-value conflicts keep the old value until the user chooses replace', () => {
    const safePlan = createSettingsContentPlan({ age: '18' }, { age: '19' }, 'append');
    assert.equal(safePlan.content.age, '18');
    assert.deepEqual(safePlan.conflictFields, ['age']);
    assert.equal(safePlan.requiresReview, true);

    const replacePlan = createSettingsContentPlan({ age: '18' }, { age: '19' }, 'replace');
    assert.equal(replacePlan.content.age, '19');
    assert.equal(replacePlan.requiresReview, true);
});

test('replace changes only supplied fields and keeps unrelated settings', () => {
    const plan = createSettingsContentPlan(
        { personality: '旧性格', background: '旧背景' },
        { personality: '新性格' },
        'replace',
    );

    assert.deepEqual(plan.content, {
        personality: '新性格',
        background: '旧背景',
    });
});

test('new fields can be applied directly without a review prompt', () => {
    const plan = createSettingsContentPlan(
        { personality: '谨慎' },
        { notes: '第五章新增信息' },
        'ask',
    );

    assert.equal(plan.requiresReview, false);
    assert.equal(plan.content.notes, '第五章新增信息');
});

test('undoing one of several cards only reverts fields changed by that card', () => {
    const original = {
        personality: '温和',
        skills: ['写作'],
        age: '20',
    };

    const personalityPlan = createSettingsContentPlan(original, { personality: '谨慎' }, 'append');
    const personalityUndo = createSettingsUndoPatch(original, personalityPlan.content);
    const skillsPlan = createSettingsContentPlan(personalityPlan.content, { skills: ['调查'] }, 'append');
    const skillsUndo = createSettingsUndoPatch(personalityPlan.content, skillsPlan.content);
    const notesPlan = createSettingsContentPlan(skillsPlan.content, { notes: '观察细致' }, 'append');

    const afterPersonalityUndo = applySettingsUndoPatch(notesPlan.content, personalityUndo);
    assert.deepEqual(afterPersonalityUndo.content, {
        personality: '温和',
        skills: ['写作', '调查'],
        age: '20',
        notes: '观察细致',
    });

    const afterSkillsUndo = applySettingsUndoPatch(afterPersonalityUndo.content, skillsUndo);
    assert.deepEqual(afterSkillsUndo.content, {
        personality: '温和',
        skills: ['写作'],
        age: '20',
        notes: '观察细致',
    });
});

test('undoing an earlier text append preserves text appended by a later card', () => {
    const original = { personality: '温和' };
    const cautiousPlan = createSettingsContentPlan(original, { personality: '谨慎' }, 'append');
    const cautiousUndo = createSettingsUndoPatch(original, cautiousPlan.content);
    const calmPlan = createSettingsContentPlan(cautiousPlan.content, { personality: '冷静' }, 'append');

    const result = applySettingsUndoPatch(calmPlan.content, cautiousUndo);
    assert.equal(result.content.personality, '温和\n冷静');
    assert.deepEqual(result.preservedFields, []);
});

test('undo preserves a scalar field when it was changed again after applying the card', () => {
    const original = { status: '学生' };
    const replaced = createSettingsContentPlan(original, { status: '教师' }, 'replace');
    const undo = createSettingsUndoPatch(original, replaced.content);

    const result = applySettingsUndoPatch({ status: '校长' }, undo);
    assert.equal(result.content.status, '校长');
    assert.deepEqual(result.revertedFields, []);
    assert.deepEqual(result.preservedFields, ['status']);
});

test('removing a suggestion card preserves the applied role and its undo record', () => {
    const actionKey = 'message-1-v0-action-0';
    const role = {
        id: 'message-1',
        content: 'role suggestion',
        _appliedActions: [actionKey],
        _settingsActionUndos: {
            [actionKey]: { kind: 'create', nodeId: 'role-1', workId: 'work-1' },
        },
    };

    const result = dismissSettingsActionCard(role, actionKey);

    assert.deepEqual(result._dismissedActions, [actionKey]);
    assert.deepEqual(result._appliedActions, [actionKey]);
    assert.deepEqual(result._settingsActionUndos, role._settingsActionUndos);
    assert.equal(result.content, role.content);
});

test('untrusted settings JSON cannot inject prototype properties', () => {
    const incoming = JSON.parse(`{
        "personality":"谨慎",
        "__proto__":{"polluted":true},
        "constructor":{"prototype":{"polluted":true}},
        "notes":{"prototype":{"polluted":true},"visible":"保留"}
    }`);

    const plan = createSettingsContentPlan({}, incoming, 'append');

    assert.equal(Object.getPrototypeOf(plan.content), Object.prototype);
    assert.equal(Object.hasOwn(plan.content, '__proto__'), false);
    assert.equal(Object.hasOwn(plan.content, 'constructor'), false);
    assert.equal(plan.content.polluted, undefined);
    assert.deepEqual(plan.content.notes, { visible: '保留' });
    assert.equal({}.polluted, undefined);
});
