import React, {useState} from 'react';
import {Box, Text, useInput, useApp} from 'ink';
import CourseListView from '../components/course-list.js';
import GradeTableView from '../components/grade-table.js';
import QuizResultsView from '../components/quiz-results.js';
import FileBrowserView from '../components/file-browser.js';
import LanguageSelectView from '../components/language-select.js';
import SetupCommand from './setup.js';
import {getConfig, isConfigured, getLanguageConfig} from '../config/store.js';
import {getTranslations, type SupportedLanguage} from '../i18n/index.js';

type View =
	| 'menu'
	| 'courses'
	| 'grades'
	| 'quizzes'
	| 'files'
	| 'language'
	| 'setup';

interface MenuItem {
	label: string;
	description: string;
	value: View | 'exit';
}

export default function InteractiveApp() {
	const {exit} = useApp();
	const [lang, setLang] = useState<SupportedLanguage>(getLanguageConfig());
	const [view, setView] = useState<View>('menu');
	const [selectedIndex, setSelectedIndex] = useState(0);

	const strings = getTranslations(lang);

	const menuItems: MenuItem[] = [
		{
			label: strings.menu.itemCourses,
			description: strings.menu.descCourses,
			value: 'courses',
		},
		{
			label: strings.menu.itemGrades,
			description: strings.menu.descGrades,
			value: 'grades',
		},
		{
			label: strings.menu.itemQuizzes,
			description: strings.menu.descQuizzes,
			value: 'quizzes',
		},
		{
			label: strings.menu.itemFiles,
			description: strings.menu.descFiles,
			value: 'files',
		},
		{
			label: strings.menu.itemLanguage,
			description: strings.menu.descLanguage,
			value: 'language',
		},
		{
			label: strings.menu.itemSetup,
			description: strings.menu.descSetup,
			value: 'setup',
		},
		{
			label: strings.menu.itemExit,
			description: strings.menu.descExit,
			value: 'exit',
		},
	];

	useInput((input, key) => {
		if (view !== 'menu') return;

		if (key.upArrow) {
			setSelectedIndex(prev => (prev > 0 ? prev - 1 : menuItems.length - 1));
		}

		if (key.downArrow) {
			setSelectedIndex(prev => (prev < menuItems.length - 1 ? prev + 1 : 0));
		}

		if (key.return) {
			const item = menuItems[selectedIndex];
			if (!item) return;

			if (item.value === 'exit') {
				exit();
				return;
			}

			setView(item.value);
		}

		if (input === 'q') {
			exit();
		}
	});

	if (!isConfigured() && view !== 'setup') {
		return (
			<SetupCommand
				onComplete={() => {
					setView('menu');
				}}
			/>
		);
	}

	if (view === 'menu') {
		const config = getConfig();
		return (
			<Box flexDirection="column" padding={1}>
				<Box marginBottom={1} flexDirection="column">
					<Box>
						<Text bold color="cyan">
							{strings.menu.title}
						</Text>
						<Text> — </Text>
						<Text color="green">{strings.menu.modeSubtitle}</Text>
					</Box>
					<Text dimColor>
						{strings.menu.connectedDomain}:{' '}
						{config.domain || strings.menu.unconfigured}
					</Text>
				</Box>

				<Text dimColor>{'─'.repeat(60)}</Text>

				<Box flexDirection="column" marginY={1}>
					{menuItems.map((item, index) => {
						const isSelected = index === selectedIndex;
						return (
							<Box key={item.value} flexDirection="column" marginBottom={1}>
								<Box>
									<Text
										color={isSelected ? 'cyan' : undefined}
										bold={isSelected}
									>
										{isSelected ? ' > ' : '   '}
										{item.label}
									</Text>
								</Box>
								{isSelected && (
									<Box paddingLeft={5}>
										<Text dimColor>↳ {item.description}</Text>
									</Box>
								)}
							</Box>
						);
					})}
				</Box>

				<Text dimColor>{'─'.repeat(60)}</Text>
				<Text dimColor>{strings.menu.navHint}</Text>
			</Box>
		);
	}

	if (view === 'courses') {
		return (
			<CourseListView
				onBack={() => {
					setView('menu');
				}}
			/>
		);
	}

	if (view === 'grades') {
		return (
			<GradeTableView
				onBack={() => {
					setView('menu');
				}}
			/>
		);
	}

	if (view === 'quizzes') {
		return (
			<QuizResultsView
				onBack={() => {
					setView('menu');
				}}
			/>
		);
	}

	if (view === 'files') {
		return (
			<FileBrowserView
				onBack={() => {
					setView('menu');
				}}
			/>
		);
	}

	if (view === 'language') {
		return (
			<LanguageSelectView
				onBack={() => {
					setView('menu');
				}}
				onLanguageChanged={newLang => {
					setLang(newLang);
				}}
			/>
		);
	}

	if (view === 'setup') {
		return (
			<SetupCommand
				onComplete={() => {
					setView('menu');
				}}
			/>
		);
	}

	return null;
}
