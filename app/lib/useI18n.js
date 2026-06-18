'use client';

import { useAppStore } from '../store/useAppStore';
import en from '../locales/en.json';
import zh from '../locales/zh.json';
import ru from '../locales/ru.json';

const translations = { en, zh, ru };
const FALLBACK_LANGUAGES = ['en', 'zh'];

export function useI18n() {
    // Default to 'zh' if language is null initially
    const language = useAppStore(state => state.language) || 'zh';

    const readPath = (lang, keys) => {
        let current = translations[lang];
        if (!current) return undefined;
        for (const key of keys) {
            if (current === undefined || current[key] === undefined) return undefined;
            current = current[key];
        }
        return current;
    };

    const t = (path, params = {}) => {
        const keys = path.split('.');
        const fallbackChain = [language, ...FALLBACK_LANGUAGES.filter(lang => lang !== language)];
        for (const lang of fallbackChain) {
            const value = readPath(lang, keys);
            if (value !== undefined) {
                return typeof value === 'string'
                    ? value.replace(/\{(\w+)\}/g, (match, key) => (params[key] ?? match))
                    : value;
            }
        }

        console.warn(`Translation missing for key: ${path} in lang: ${language}`);
        return path;
    };

    const text = (zhText, enText, ruText = enText) => {
        if (language === 'en') return enText;
        if (language === 'ru') return ruText || enText;
        return zhText;
    };

    return { t, text, language };
}
