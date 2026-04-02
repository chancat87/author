/**
 * 集中管理仓库地址和法律文档 URL 生成逻辑
 * 修改仓库名/镜像地址时只需改这一处
 */

export const REPO = {
    github: 'https://github.com/YuanShiJiLoong/author',
    gitee: 'https://gitee.com/yuanshijilong/author',
};

/** 支持的法律文档语言列表 */
export const LEGAL_LANGUAGES = [
    { code: 'zh', label: '🇨🇳 中文', privacy: '隐私政策', terms: '服务条款' },
    { code: 'en', label: '🇬🇧 English', privacy: 'Privacy Policy', terms: 'Terms of Service' },
    { code: 'ru', label: '🇷🇺 Русский', privacy: 'Политика конфиденциальности', terms: 'Условия использования' },
    { code: 'ar', label: '🇵🇸 العربية', privacy: 'سياسة الخصوصية', terms: 'شروط الخدمة' },
];

/**
 * 生成法律文档的完整 URL
 * @param {'github'|'gitee'} platform - 平台
 * @param {'PRIVACY'|'TERMS'} docType - 文档类型
 * @param {string} lang - 语言代码 (en/zh/ru/ar)
 * @returns {string} 完整 URL
 */
export function legalDocUrl(platform, docType, lang) {
    const suffix = lang === 'en' ? '' : `.${lang}`;
    return `${REPO[platform]}/blob/main/${docType}${suffix}.md`;
}
