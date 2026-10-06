#!/usr/bin/env node
import React from 'react';
import {render} from 'ink';
import {Command} from 'commander';
import InteractiveApp from './commands/interactive.js';
import SetupCommand from './commands/setup.js';
import CoursesCommand from './commands/courses.js';
import GradesCommand from './commands/grades.js';
import QuizzesCommand from './commands/quizzes.js';
import FilesCommand from './commands/files.js';
import {isConfigured, getLanguageConfig} from './config/store.js';
import {setLanguage, isSupportedLanguage} from './i18n/index.js';

// Initialize default language from store
setLanguage(getLanguageConfig());

const program = new Command();

program
	.name('holy-canvas')
	.description(
		'Canvas LMS terminal client — browse courses, grades, quizzes, and download files (alias: hcvs)',
	)
	.version('1.0.0');

// Global options
program.option('--json', 'JSON output mode (for AI agents & scripts)');
program.option(
	'--lang <lang>',
	'Display language (en: English, ko: 한국어, es: Español, ja: 日本語, zh: 中文)',
);

program.hook('preAction', () => {
	const opts = program.opts();
	const lang = opts['lang'] as string | undefined;
	if (lang && isSupportedLanguage(lang)) {
		setLanguage(lang);
	} else {
		setLanguage(getLanguageConfig());
	}
});

// Subcommand: setup
program
	.command('setup')
	.description('Configure Canvas institution domain and API access token')
	.action(() => {
		render(<SetupCommand />);
	});

// Subcommand: courses
program
	.command('courses')
	.description('List enrolled courses or view specific course details')
	.option('--id <courseId>', 'View details for a specific course ID')
	.action(options => {
		const json = Boolean(program.opts()['json']);
		render(<CoursesCommand courseId={options.id} json={json} />);
	});

// Subcommand: grades
program
	.command('grades')
	.description('View course grades and current/final scores')
	.option('--course <courseId>', 'Filter grades by specific course ID')
	.action(options => {
		const json = Boolean(program.opts()['json']);
		render(<GradesCommand courseId={options.course} json={json} />);
	});

// Subcommand: quizzes
program
	.command('quizzes')
	.description('View quiz submissions and scores')
	.option('--course <courseId>', 'Filter quizzes by specific course ID')
	.action(options => {
		const json = Boolean(program.opts()['json']);
		render(<QuizzesCommand courseId={options.course} json={json} />);
	});

// Subcommand: files
program
	.command('files')
	.description('Download or synchronize course files')
	.option('--course <courseId>', 'Target a specific course ID')
	.option('--all', 'Download files across all enrolled courses')
	.option('--sync', 'Download only new or modified files (sync mode)')
	.option('--dest <path>', 'Destination directory path', './canvas-files')
	.action(options => {
		const json = Boolean(program.opts()['json']);
		render(
			<FilesCommand
				course={options.course}
				all={options.all}
				sync={options.sync}
				dest={options.dest}
				json={json}
			/>,
		);
	});

// Default action (no subcommand given)
program.action(() => {
	if (!isConfigured()) {
		render(<SetupCommand />);
		return;
	}

	render(<InteractiveApp />);
});

program.parse(process.argv);
