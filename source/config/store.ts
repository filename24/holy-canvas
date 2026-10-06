import Conf from 'conf';
import type {CanvasConfig} from '../types/canvas.js';
import type {SupportedLanguage} from '../i18n/types.js';

interface ConfigSchema {
	domain: string;
	token: string;
	language: SupportedLanguage;
}

const config = new Conf<ConfigSchema>({
	projectName: 'holy-canvas',
	schema: {
		domain: {type: 'string', default: ''},
		token: {type: 'string', default: ''},
		language: {type: 'string', default: 'en'},
	},
});

export function getConfig(): CanvasConfig {
	return {
		domain: config.get('domain'),
		token: config.get('token'),
		language: config.get('language') ?? 'en',
	};
}

export function setConfig(domain: string, token: string): void {
	config.set('domain', domain);
	config.set('token', token);
}

export function setLanguageConfig(lang: SupportedLanguage): void {
	config.set('language', lang);
}

export function getLanguageConfig(): SupportedLanguage {
	return config.get('language') ?? 'en';
}

export function isConfigured(): boolean {
	return Boolean(config.get('domain') && config.get('token'));
}

export function clearConfig(): void {
	config.clear();
}

export {config};
