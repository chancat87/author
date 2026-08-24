export const CHAPTER_SYNOPSIS_SCHEMA_VERSION = 1;

const DEFAULT_SYNOPSIS = {
    schemaVersion: CHAPTER_SYNOPSIS_SCHEMA_VERSION,
    summary: '',
    beats: [],
    events: [],
    endingState: '',
    continuityNotes: [],
    openThreads: [],
    entityDeltas: [],
    foreshadowing: [],
    timelineRefs: [],
    spoilerLevel: 'chapter',
    locked: false,
    source: 'manual',
    generatedAt: '',
    updatedAt: '',
};

function cleanString(value) {
    return typeof value === 'string' ? value.trim() : '';
}

function cleanStringArray(value) {
    if (Array.isArray(value)) {
        return value
            .map(item => {
                if (typeof item === 'string') return item.trim();
                if (item && typeof item === 'object') {
                    const text = item.text || item.name || item.description || item.summary || '';
                    return typeof text === 'string' ? text.trim() : '';
                }
                return '';
            })
            .filter(Boolean);
    }
    if (typeof value === 'string') {
        return value
            .split(/\n+/)
            .map(line => line.replace(/^[-*\u2022\d.、\s]+/, '').trim())
            .filter(Boolean);
    }
    return [];
}

function cloneData(value) {
    if (Array.isArray(value)) return value.map(cloneData);
    if (value && typeof value === 'object') {
        return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, cloneData(item)]));
    }
    return value;
}

function cleanStructuredArray(value) {
    if (typeof value === 'string') return cleanStringArray(value);
    if (!Array.isArray(value)) return [];
    return value
        .map(item => {
            if (typeof item === 'string') return item.trim();
            if (item && typeof item === 'object') return cloneData(item);
            return null;
        })
        .filter(item => item !== null && item !== '');
}

function projectTextArray(value) {
    return cleanStringArray(value);
}

export function stripChapterHtml(html) {
    if (!html) return '';
    return String(html)
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n')
        .replace(/<[^>]*>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

export function normalizeChapterSynopsis(value) {
    if (!value) return { ...DEFAULT_SYNOPSIS };
    if (typeof value === 'string') {
        return { ...DEFAULT_SYNOPSIS, summary: value.trim() };
    }

    const data = value && typeof value === 'object' ? value : {};
    const schemaVersion = Number(data.schemaVersion) || CHAPTER_SYNOPSIS_SCHEMA_VERSION;
    if (schemaVersion > CHAPTER_SYNOPSIS_SCHEMA_VERSION) {
        // A newer client owns this schema. Preserve every known and unknown
        // field instead of destructively coercing it into the v1 view model.
        return cloneData(data);
    }
    return {
        ...DEFAULT_SYNOPSIS,
        ...data,
        schemaVersion,
        summary: cleanString(data.summary || data.synopsis || data.text),
        beats: cleanStructuredArray(data.beats),
        events: cleanStructuredArray(data.events),
        endingState: cleanString(data.endingState || data.ending || data.finalState),
        continuityNotes: cleanStructuredArray(data.continuityNotes || data.continuity || data.nextChapterNotes),
        openThreads: cleanStructuredArray(data.openThreads || data.openQuestions || data.unresolved || data.pendingThreads),
        entityDeltas: cleanStructuredArray(data.entityDeltas || data.entities || data.characterChanges),
        foreshadowing: cleanStructuredArray(data.foreshadowing),
        timelineRefs: cleanStructuredArray(data.timelineRefs || data.timeline),
        spoilerLevel: typeof data.spoilerLevel === 'number'
            ? data.spoilerLevel
            : (cleanString(data.spoilerLevel) || 'chapter'),
        locked: !!data.locked,
        source: cleanString(data.source) || 'manual',
        generatedAt: cleanString(data.generatedAt),
        updatedAt: cleanString(data.updatedAt),
    };
}

function getSynopsisValue(value) {
    if (!value || typeof value !== 'object') return value;
    if (value.synopsis || value.chapterSynopsis) return value.synopsis || value.chapterSynopsis;
    if (value.id || value.title || value.content != null || value.type) return value.summary;
    return value;
}

export function getChapterSynopsis(chapter) {
    return normalizeChapterSynopsis(getSynopsisValue(chapter));
}

export function hasChapterSynopsis(chapterOrSynopsis) {
    const synopsis = normalizeChapterSynopsis(getSynopsisValue(chapterOrSynopsis));
    return !!(
        synopsis.summary ||
        projectTextArray(synopsis.beats).length ||
        projectTextArray(synopsis.events).length ||
        synopsis.endingState ||
        projectTextArray(synopsis.continuityNotes).length ||
        projectTextArray(synopsis.openThreads).length ||
        projectTextArray(synopsis.entityDeltas).length ||
        projectTextArray(synopsis.foreshadowing).length ||
        projectTextArray(synopsis.timelineRefs).length
    );
}

export function buildChapterSynopsisText(chapterOrSynopsis) {
    const synopsis = normalizeChapterSynopsis(getSynopsisValue(chapterOrSynopsis));
    const normalizedBeats = projectTextArray(synopsis.beats);
    const normalizedEvents = projectTextArray(synopsis.events);
    const normalizedContinuity = projectTextArray(synopsis.continuityNotes);
    const normalizedDeltas = projectTextArray(synopsis.entityDeltas);
    const normalizedThreads = projectTextArray(synopsis.openThreads);
    const normalizedForeshadowing = projectTextArray(synopsis.foreshadowing);
    const timelineRefs = projectTextArray(synopsis.timelineRefs);
    const beats = normalizedBeats.length ? normalizedBeats : normalizedEvents;
    const continuityNotes = normalizedContinuity.length ? normalizedContinuity : normalizedDeltas;
    const openThreads = normalizedThreads.length ? normalizedThreads : normalizedForeshadowing;
    const sections = [];
    if (synopsis.summary) sections.push(synopsis.summary);
    if (beats.length) sections.push(`关键情节：\n${beats.map(item => `- ${item}`).join('\n')}`);
    if (synopsis.endingState) sections.push(`结尾状态：${synopsis.endingState}`);
    if (continuityNotes.length) sections.push(`续写注意：\n${continuityNotes.map(item => `- ${item}`).join('\n')}`);
    if (openThreads.length) sections.push(`待回收信息：\n${openThreads.map(item => `- ${item}`).join('\n')}`);
    if (!normalizedContinuity.length && timelineRefs.length) {
        sections.push(`时间/顺序线索：\n${timelineRefs.map(item => `- ${item}`).join('\n')}`);
    }
    return sections.join('\n\n').trim();
}

export function buildChapterSynopsisBriefText(chapterOrSynopsis) {
    const synopsis = normalizeChapterSynopsis(getSynopsisValue(chapterOrSynopsis));
    const normalizedBeats = projectTextArray(synopsis.beats);
    const normalizedEvents = projectTextArray(synopsis.events);
    const normalizedContinuity = projectTextArray(synopsis.continuityNotes);
    const normalizedDeltas = projectTextArray(synopsis.entityDeltas);
    const normalizedThreads = projectTextArray(synopsis.openThreads);
    const normalizedForeshadowing = projectTextArray(synopsis.foreshadowing);
    const beats = normalizedBeats.length ? normalizedBeats : normalizedEvents;
    const continuityNotes = normalizedContinuity.length ? normalizedContinuity : normalizedDeltas;
    const openThreads = normalizedThreads.length ? normalizedThreads : normalizedForeshadowing;
    const sections = [];
    if (synopsis.summary) sections.push(synopsis.summary);
    if (beats.length) sections.push(`情节：${beats.join('；')}`);
    if (synopsis.endingState) sections.push(`结尾：${synopsis.endingState}`);
    if (continuityNotes.length) sections.push(`续写注意：${continuityNotes.join('；')}`);
    if (openThreads.length) sections.push(`待回收：${openThreads.join('；')}`);
    return sections.join('\n').trim();
}

export function parseGeneratedSynopsis(text) {
    const raw = String(text || '').trim();
    if (!raw) return normalizeChapterSynopsis();

    const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const candidate = (jsonMatch ? jsonMatch[1] : raw).trim();

    try {
        return normalizeChapterSynopsis(JSON.parse(candidate));
    } catch {
        const firstJson = candidate.indexOf('{');
        const lastJson = candidate.lastIndexOf('}');
        if (firstJson !== -1 && lastJson > firstJson) {
            try {
                return normalizeChapterSynopsis(JSON.parse(candidate.slice(firstJson, lastJson + 1)));
            } catch {
                // Fall through to plain-text summary.
            }
        }
    }

    return normalizeChapterSynopsis({ summary: raw });
}
