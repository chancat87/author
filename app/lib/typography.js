export const WRITING_FONT_STORAGE_KEY = 'author-writing-font-family';

export const WRITING_FONT_FAMILIES = [
    {
        key: 'songti',
        label: '宋体',
        labelKey: 'preferences.writingFontSongti',
        value: '"SimSun", "Songti SC", "STSong", "Noto Serif SC", "Source Han Serif SC", "Microsoft YaHei", serif',
    },
    {
        key: 'heiti',
        label: '黑体',
        labelKey: 'preferences.writingFontHeiti',
        value: '"Noto Sans SC", "Microsoft YaHei", "PingFang SC", "Heiti SC", sans-serif',
    },
    {
        key: 'kaiti',
        label: '楷体',
        labelKey: 'preferences.writingFontKaiti',
        value: '"KaiTi", "Kaiti SC", "STKaiti", "SimKai", "SimSun", serif',
    },
    {
        key: 'fangsong',
        label: '仿宋',
        labelKey: 'preferences.writingFontFangsong',
        value: '"FangSong", "STFangsong", "FangSong_GB2312", "SimSun", serif',
    },
    {
        key: 'serif',
        label: 'Serif',
        labelKey: 'preferences.writingFontSerif',
        value: '"Noto Serif SC", "Source Han Serif SC", "Songti SC", "SimSun", "STSong", serif',
    },
    {
        key: 'mono',
        label: 'Monospace',
        labelKey: 'preferences.writingFontMono',
        value: '"NSimSun", "SimSun", "SF Mono", "Cascadia Code", "Consolas", monospace',
    },
];

export const DEFAULT_WRITING_FONT_FAMILY = WRITING_FONT_FAMILIES[0].value;

export function normalizeWritingFontFamily(value) {
    return WRITING_FONT_FAMILIES.some(font => font.value === value)
        ? value
        : DEFAULT_WRITING_FONT_FAMILY;
}
