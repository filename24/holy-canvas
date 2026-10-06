import {en} from './en.js';
import {ko} from './ko.js';
import {es} from './es.js';
import {ja} from './ja.js';
import {zh} from './zh.js';
import type {SupportedLanguage, Translations} from './types.js';

export interface LanguageInfo {
	code: SupportedLanguage;
	name: string;
	nativeName: string;
	flag: string;
}

export const SUPPORTED_LANGUAGES: LanguageInfo[] = [
	{code: 'en', name: 'English', nativeName: 'English (US/UK)', flag: '[EN]'},
	{code: 'ko', name: 'Korean', nativeName: '한국어', flag: '[KO]'},
	{code: 'es', name: 'Spanish', nativeName: 'Español', flag: '[ES]'},
	{code: 'ja', name: 'Japanese', nativeName: '日本語', flag: '[JA]'},
	{code: 'zh', name: 'Chinese', nativeName: '简体中文', flag: '[ZH]'},
];

const dictionaries: Record<SupportedLanguage, Translations> = {
	en,
	ko,
	es,
	ja,
	zh,
};

let currentLanguage: SupportedLanguage = 'en';

export function setLanguage(lang: SupportedLanguage): void {
	if (dictionaries[lang]) {
		currentLanguage = lang;
	}
}

export function getLanguage(): SupportedLanguage {
	return currentLanguage;
}

export function getTranslations(
	lang: SupportedLanguage = currentLanguage,
): Translations {
	return dictionaries[lang] ?? en;
}

export function t(): Translations {
	return dictionaries[currentLanguage] ?? en;
}

export function isSupportedLanguage(lang: string): lang is SupportedLanguage {
	return SUPPORTED_LANGUAGES.some(l => l.code === lang);
}

export * from './types.js';
