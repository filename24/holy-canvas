import React, {useState} from 'react';
import {Box, Text, useInput} from 'ink';
import {
	SUPPORTED_LANGUAGES,
	setLanguage,
	t,
	type SupportedLanguage,
} from '../i18n/index.js';
import {setLanguageConfig, getLanguageConfig} from '../config/store.js';

interface Props {
	onBack: () => void;
	onLanguageChanged?: (lang: SupportedLanguage) => void;
}

export default function LanguageSelectView({onBack, onLanguageChanged}: Props) {
	const currentLang = getLanguageConfig();
	const initialIndex = SUPPORTED_LANGUAGES.findIndex(
		l => l.code === currentLang,
	);
	const [selectedIndex, setSelectedIndex] = useState(
		initialIndex >= 0 ? initialIndex : 0,
	);
	const [savedText, setSavedText] = useState('');

	useInput((input, key) => {
		if (key.escape || input === 'q') {
			onBack();
			return;
		}

		if (key.upArrow) {
			setSelectedIndex(prev =>
				prev > 0 ? prev - 1 : SUPPORTED_LANGUAGES.length - 1,
			);
		}

		if (key.downArrow) {
			setSelectedIndex(prev =>
				prev < SUPPORTED_LANGUAGES.length - 1 ? prev + 1 : 0,
			);
		}

		if (key.return) {
			const selected = SUPPORTED_LANGUAGES[selectedIndex];
			if (selected) {
				setLanguageConfig(selected.code);
				setLanguage(selected.code);
				setSavedText(t().language.saved);
				onLanguageChanged?.(selected.code);
				setTimeout(() => {
					onBack();
				}, 600);
			}
		}
	});

	const strings = t();

	return (
		<Box flexDirection="column" padding={1}>
			<Text bold color="cyan">
				{strings.language.title}
			</Text>
			<Text dimColor>{strings.language.selectPrompt}</Text>
			<Text> </Text>

			{SUPPORTED_LANGUAGES.map((lang, index) => {
				const isSelected = index === selectedIndex;
				const isCurrent = lang.code === currentLang;

				return (
					<Box key={lang.code}>
						<Text color={isSelected ? 'cyan' : undefined} bold={isSelected}>
							{isSelected ? '> ' : '  '}
							{lang.flag} {lang.nativeName} ({lang.name})
							{isCurrent ? <Text color="green"> [Current]</Text> : null}
						</Text>
					</Box>
				);
			})}

			<Text> </Text>
			{savedText ? (
				<Text color="green" bold>
					[OK] {savedText}
				</Text>
			) : (
				<Text dimColor>↑↓ Navigate · Enter Select · ESC/q Back</Text>
			)}
		</Box>
	);
}
