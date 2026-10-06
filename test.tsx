import test from 'ava';
import {CanvasClient, CanvasApiError} from './source/api/client.js';
import {formatBytes, formatDate, truncate} from './source/utils/formatter.js';
import {buildFolderPaths, sanitizeFolderName} from './source/utils/download.js';
import {planSync, planSyncItems} from './source/utils/sync.js';
import {computeScrollWindow} from './source/utils/scroll.js';
import {
	setConfig,
	getConfig,
	isConfigured,
	clearConfig,
	setLanguageConfig,
	getLanguageConfig,
} from './source/config/store.js';
import {
	SUPPORTED_LANGUAGES,
	setLanguage,
	getLanguage,
	getTranslations,
	t as i18nT,
	isSupportedLanguage,
	type SupportedLanguage,
} from './source/i18n/index.js';
import type {Folder, CanvasFile} from './source/types/canvas.js';

// --- Formatter Tests ---
test('formatBytes handles zero and small values', t => {
	t.is(formatBytes(0), '0.0 B');
	t.is(formatBytes(500), '500.0 B');
});

test('formatBytes formats KB, MB, and GB accurately', t => {
	t.is(formatBytes(1024), '1.0 KB');
	t.is(formatBytes(1024 * 1024 * 5.5), '5.5 MB');
	t.is(formatBytes(1024 * 1024 * 1024 * 2), '2.0 GB');
});

test('truncate shortens strings with ellipsis', t => {
	t.is(truncate('Hello World', 20), 'Hello World');
	t.is(truncate('Hello World, this is a long text', 10), 'Hello Wor…');
});

test('formatDate handles null and ISO dates', t => {
	t.is(formatDate(null), '—');
	const formatted = formatDate('2024-01-15T12:00:00Z');
	t.true(formatted.includes('2024'));
});

// --- CanvasClient Unit Tests ---
test('CanvasClient normalizes trailing slashes in domain', t => {
	const client1 = new CanvasClient({
		domain: 'https://canvas.school.edu/',
		token: 'tok123',
	});
	t.is(client1.getDomain(), 'https://canvas.school.edu');

	const client2 = new CanvasClient({
		domain: 'https://canvas.school.edu///',
		token: 'tok123',
	});
	t.is(client2.getDomain(), 'https://canvas.school.edu');
});

test('CanvasApiError contains status and message', t => {
	const err = new CanvasApiError(401, 'Unauthorized');
	t.is(err.status, 401);
	t.is(err.body, 'Unauthorized');
	t.is(err.name, 'CanvasApiError');
});

test('CanvasClient.validate handles successful response', async t => {
	const origFetch = globalThis.fetch;
	globalThis.fetch = async () =>
		new Response(JSON.stringify({id: 123, name: 'Test Student'}), {
			status: 200,
			headers: {'Content-Type': 'application/json'},
		});

	try {
		const client = new CanvasClient({
			domain: 'https://canvas.test.edu',
			token: 'tok',
		});
		const result = await client.validate();
		t.true(result.valid);
		t.is(result.user?.name, 'Test Student');
	} finally {
		globalThis.fetch = origFetch;
	}
});

test('CanvasClient.validate handles 401 unauthorized response', async t => {
	const origFetch = globalThis.fetch;
	globalThis.fetch = async () => new Response('Unauthorized', {status: 401});

	try {
		const client = new CanvasClient({
			domain: 'https://canvas.test.edu',
			token: 'invalid',
		});
		const result = await client.validate();
		t.false(result.valid);
		t.is(result.error, '토큰이 유효하지 않습니다.');
	} finally {
		globalThis.fetch = origFetch;
	}
});

test('CanvasClient.getAll follows Link header pagination', async t => {
	const origFetch = globalThis.fetch;
	let callCount = 0;
	globalThis.fetch = async () => {
		callCount++;
		if (callCount === 1) {
			return new Response(JSON.stringify([{id: 1}, {id: 2}]), {
				status: 200,
				headers: {
					'Content-Type': 'application/json',
					Link: '<https://canvas.test.edu/api/v1/courses?page=2>; rel="next"',
				},
			});
		}

		return new Response(JSON.stringify([{id: 3}]), {
			status: 200,
			headers: {'Content-Type': 'application/json'},
		});
	};

	try {
		const client = new CanvasClient({
			domain: 'https://canvas.test.edu',
			token: 'tok',
		});
		const items = await client.getAll<{id: number}>('/courses');
		t.is(items.length, 3);
		t.deepEqual(items, [{id: 1}, {id: 2}, {id: 3}]);
		t.is(callCount, 2);
	} finally {
		globalThis.fetch = origFetch;
	}
});

// --- Folder Path & Sync Tests ---
test('buildFolderPaths creates relative folder paths correctly', t => {
	const folders: Folder[] = [
		{
			id: 1,
			name: 'root',
			full_name: 'course files',
			parent_folder_id: null,
			files_count: 0,
			folders_count: 1,
			updated_at: '2024-01-01',
		},
		{
			id: 2,
			name: 'Week 1',
			full_name: 'course files/Week 1',
			parent_folder_id: 1,
			files_count: 2,
			folders_count: 0,
			updated_at: '2024-01-01',
		},
		{
			id: 3,
			name: 'Slides',
			full_name: 'course files/Week 1/Slides',
			parent_folder_id: 2,
			files_count: 1,
			folders_count: 0,
			updated_at: '2024-01-01',
		},
	];

	const paths = buildFolderPaths(folders);
	t.is(paths.get(1), '');
	t.is(paths.get(2), 'Week 1');
	t.is(paths.get(3), 'Week 1/Slides');
});

test('planSync plans downloads for nonexistent local files', async t => {
	const files: CanvasFile[] = [
		{
			id: 101,
			display_name: 'syllabus.pdf',
			filename: 'syllabus.pdf',
			url: 'https://download/1',
			size: 2048,
			'content-type': 'application/pdf',
			updated_at: '2024-01-01T00:00:00Z',
			created_at: '2024-01-01T00:00:00Z',
			folder_id: 2,
		},
	];

	const folderPaths = new Map<number, string>([[2, 'Week 1']]);
	const plan = await planSync(files, '/tmp/nonexistent-sync-test', folderPaths);

	t.is(plan.toDownload.length, 1);
	t.is(plan.upToDate.length, 0);
	t.is(plan.totalSize, 2048);
});

// --- Config Store Tests ---
test.serial('config store gets, sets, checks and clears settings', t => {
	clearConfig();
	t.false(isConfigured());

	setConfig('https://canvas.test.ac.kr', 'secret_token_123');
	t.true(isConfigured());

	const loaded = getConfig();
	t.is(loaded.domain, 'https://canvas.test.ac.kr');
	t.is(loaded.token, 'secret_token_123');

	clearConfig();
	t.false(isConfigured());
});

// --- Sanitize and Multi-Course Sync Tests ---
test('sanitizeFolderName cleans illegal path characters', t => {
	t.is(sanitizeFolderName('컴퓨터/구조: 01 분반*?'), '컴퓨터_구조_ 01 분반__');
	t.is(sanitizeFolderName('  CS101  '), 'CS101');
	t.is(sanitizeFolderName(''), 'course');
});

test('planSyncItems plans downloads across multiple courses', async t => {
	const items = [
		{
			file: {
				id: 201,
				display_name: 'lec1.pdf',
				filename: 'lec1.pdf',
				url: 'https://download/201',
				size: 1024,
				'content-type': 'application/pdf',
				updated_at: '2024-01-01T00:00:00Z',
				created_at: '2024-01-01T00:00:00Z',
				folder_id: 1,
			},
			destPath: '/tmp/nonexistent-multi/Course1/lec1.pdf',
			courseName: 'Course 1',
		},
		{
			file: {
				id: 202,
				display_name: 'lec2.pdf',
				filename: 'lec2.pdf',
				url: 'https://download/202',
				size: 2048,
				'content-type': 'application/pdf',
				updated_at: '2024-01-01T00:00:00Z',
				created_at: '2024-01-01T00:00:00Z',
				folder_id: 2,
			},
			destPath: '/tmp/nonexistent-multi/Course2/lec2.pdf',
			courseName: 'Course 2',
		},
	];

	const plan = await planSyncItems(items);
	t.is(plan.toDownload.length, 2);
	t.is(plan.upToDate.length, 0);
	t.is(plan.totalSize, 3072);
});

// --- Scroll Window Tests ---
test('computeScrollWindow handles total items smaller than maxVisible', t => {
	const win = computeScrollWindow(2, 5, 10);
	t.is(win.startIndex, 0);
	t.is(win.endIndex, 5);
	t.false(win.hasPrev);
	t.false(win.hasNext);
});

test('computeScrollWindow scrolls and computes indicators accurately', t => {
	// At top of a long list
	const topWin = computeScrollWindow(0, 50, 10);
	t.is(topWin.startIndex, 0);
	t.is(topWin.endIndex, 10);
	t.false(topWin.hasPrev);
	t.true(topWin.hasNext);
	t.is(topWin.nextCount, 40);

	// In the middle
	const midWin = computeScrollWindow(20, 50, 10);
	t.is(midWin.startIndex, 15);
	t.is(midWin.endIndex, 25);
	t.true(midWin.hasPrev);
	t.true(midWin.hasNext);
	t.is(midWin.prevCount, 15);
	t.is(midWin.nextCount, 25);

	// At bottom
	const botWin = computeScrollWindow(49, 50, 10);
	t.is(botWin.startIndex, 40);
	t.is(botWin.endIndex, 50);
	t.true(botWin.hasPrev);
	t.false(botWin.hasNext);
	t.is(botWin.prevCount, 40);
});

// --- i18n Tests ---
test.serial('i18n default language is English', t => {
	setLanguage('en');
	t.is(getLanguage(), 'en');
	t.is(i18nT().menu.title, '🎓 Canvas LMS CLI');
	t.is(i18nT().menu.itemCourses, '📖 View Courses');
	t.is(i18nT().common.loading, 'Loading...');
});

test.serial('i18n supports all 5 languages and switches correctly', t => {
	const expectedCodes: SupportedLanguage[] = ['en', 'ko', 'es', 'ja', 'zh'];
	t.deepEqual(
		SUPPORTED_LANGUAGES.map(l => l.code),
		expectedCodes,
	);

	// Korean
	setLanguage('ko');
	t.is(getLanguage(), 'ko');
	t.is(i18nT().menu.itemCourses, '📖 수업 목록 보기');
	t.is(i18nT().common.loading, '로딩 중...');

	// Spanish
	setLanguage('es');
	t.is(getLanguage(), 'es');
	t.is(i18nT().menu.itemCourses, '📖 Ver Cursos');
	t.is(i18nT().common.loading, 'Cargando...');

	// Japanese
	setLanguage('ja');
	t.is(getLanguage(), 'ja');
	t.is(i18nT().menu.itemCourses, '📖 コース一覧を表示');
	t.is(i18nT().common.loading, '読み込み中...');

	// Chinese
	setLanguage('zh');
	t.is(getLanguage(), 'zh');
	t.is(i18nT().menu.itemCourses, '📖 查看课程列表');
	t.is(i18nT().common.loading, '加载中...');

	// Reset back to English
	setLanguage('en');
	t.is(getLanguage(), 'en');
});

test('i18n getTranslations returns specified dictionary with fallback', t => {
	const koDict = getTranslations('ko');
	t.is(koDict.menu.itemGrades, '📊 성적 확인');

	const esDict = getTranslations('es');
	t.is(esDict.menu.itemGrades, '📊 Consultar Calificaciones');

	const jaDict = getTranslations('ja');
	t.is(jaDict.menu.itemGrades, '📊 成績を確認');

	const zhDict = getTranslations('zh');
	t.is(zhDict.menu.itemGrades, '📊 查看成绩');

	// Fallback to English for unknown language code
	const fallbackDict = getTranslations('fr' as unknown as SupportedLanguage);
	t.is(fallbackDict.menu.itemGrades, '📊 Check Grades');
});

test('isSupportedLanguage validates language codes correctly', t => {
	t.true(isSupportedLanguage('en'));
	t.true(isSupportedLanguage('ko'));
	t.true(isSupportedLanguage('es'));
	t.true(isSupportedLanguage('ja'));
	t.true(isSupportedLanguage('zh'));

	t.false(isSupportedLanguage('fr'));
	t.false(isSupportedLanguage('de'));
	t.false(isSupportedLanguage(''));
});

test.serial('config store persists and retrieves language preference', t => {
	setLanguageConfig('es');
	t.is(getLanguageConfig(), 'es');

	setLanguageConfig('ja');
	t.is(getLanguageConfig(), 'ja');

	setLanguageConfig('ko');
	t.is(getLanguageConfig(), 'ko');

	setLanguageConfig('zh');
	t.is(getLanguageConfig(), 'zh');

	setLanguageConfig('en');
	t.is(getLanguageConfig(), 'en');
});
