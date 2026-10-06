import React, {useState, useEffect, useCallback} from 'react';
import {join} from 'node:path';
import {Box, Text, useInput, useStdout} from 'ink';
import {CanvasClient} from '../api/client.js';
import {listCourses} from '../api/courses.js';
import {listCourseFiles, listCourseFolders} from '../api/files.js';
import {getConfig} from '../config/store.js';
import {formatBytes, truncate} from '../utils/formatter.js';
import {computeScrollWindow} from '../utils/scroll.js';
import {
	buildFolderPaths,
	downloadFilesList,
	sanitizeFolderName,
	type DownloadItem,
} from '../utils/download.js';
import {planSyncItems} from '../utils/sync.js';
import {t} from '../i18n/index.js';
import type {Course, CanvasFile} from '../types/canvas.js';

type Phase =
	| 'select-course'
	| 'loading-files'
	| 'select-files'
	| 'loading-all'
	| 'confirm-all'
	| 'downloading'
	| 'done';

interface Props {
	onBack: () => void;
	courseId?: number;
	sync?: boolean;
	all?: boolean;
	dest?: string;
}

export default function FileBrowserView({
	onBack,
	courseId,
	sync = false,
	all = false,
	dest = './canvas-files',
}: Props) {
	const {stdout} = useStdout();
	const [termRows, setTermRows] = useState(stdout?.rows ?? 24);
	const strings = t();

	useEffect(() => {
		if (!stdout) return;
		const onResize = () => {
			setTermRows(stdout.rows ?? 24);
		};

		stdout.on('resize', onResize);
		return () => {
			stdout.off('resize', onResize);
		};
	}, [stdout]);

	const initialPhase: Phase = (() => {
		if (courseId) return 'loading-files';
		if (all) return 'loading-all';
		return 'select-course';
	})();

	const [phase, setPhase] = useState<Phase>(initialPhase);
	const [syncMode, setSyncMode] = useState<boolean>(sync);
	const [courses, setCourses] = useState<Course[]>([]);
	const [selectedCourseIndex, setSelectedCourseIndex] = useState(0);

	// Single course files state
	const [files, setFiles] = useState<CanvasFile[]>([]);
	const [selectedFileIndices, setSelectedFileIndices] = useState<Set<number>>(
		new Set(),
	);
	const [fileIndex, setFileIndex] = useState(0);

	// Multi-course items state
	const [allDownloadItems, setAllDownloadItems] = useState<DownloadItem[]>([]);
	const [loadingProgressText, setLoadingProgressText] = useState('');

	// Download progress state
	const [downloadStatus, setDownloadStatus] = useState('');
	const [completedCount, setCompletedCount] = useState(0);
	const [totalCount, setTotalCount] = useState(0);
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);

	// Helper to load files from all courses
	const loadAllCoursesFiles = useCallback(
		async (courseList: Course[]) => {
			setPhase('loading-all');
			setLoading(true);
			const config = getConfig();
			const client = new CanvasClient(config);
			const items: DownloadItem[] = [];

			try {
				for (let i = 0; i < courseList.length; i++) {
					const c = courseList[i]!;
					setLoadingProgressText(
						`[${i + 1}/${courseList.length}] ${c.name} — ${
							t().files.loadingAllFiles
						}`,
					);

					try {
						const cFiles = await listCourseFiles(client, c.id);
						const cFolders = await listCourseFolders(client, c.id);
						const folderPaths = buildFolderPaths(cFolders);
						const courseDir = join(dest, sanitizeFolderName(c.name));

						for (const f of cFiles) {
							const subFolder = folderPaths.get(f.folder_id) ?? '';
							const destPath = join(courseDir, subFolder, f.display_name);
							items.push({
								file: f,
								destPath,
								courseName: c.name,
							});
						}
					} catch {
						// Inaccessible course, continue to next
					}
				}

				setAllDownloadItems(items);
				setPhase('confirm-all');
			} catch (err: any) {
				setError(err.message);
			} finally {
				setLoading(false);
			}
		},
		[dest],
	);

	// Initial load of courses
	useEffect(() => {
		const config = getConfig();
		const client = new CanvasClient(config);
		listCourses(client)
			.then(courseList => {
				setCourses(courseList);
				if (all) {
					void loadAllCoursesFiles(courseList);
				} else if (!courseId) {
					setLoading(false);
				}
			})
			.catch((err: Error) => {
				setError(err.message);
				setLoading(false);
			});
	}, [all, courseId, loadAllCoursesFiles]);

	// Load files for single selected course
	useEffect(() => {
		if (phase === 'loading-files' && courseId) {
			const config = getConfig();
			const client = new CanvasClient(config);
			listCourseFiles(client, courseId)
				.then(fileList => {
					setFiles(fileList);
					setSelectedFileIndices(new Set(fileList.map((_, i) => i)));
					setPhase('select-files');
				})
				.catch((err: Error) => {
					setError(err.message);
				})
				.finally(() => {
					setLoading(false);
				});
		}
	}, [phase, courseId]);

	useInput((input, key) => {
		if (key.escape || input === 'q') {
			if (phase === 'select-files' || phase === 'confirm-all') {
				setPhase('select-course');
				return;
			}

			onBack();
			return;
		}

		// Phase 1: select-course
		if (phase === 'select-course') {
			const totalOptions = courses.length + 1;
			const maxVisibleCourses = Math.max(5, termRows - 8);

			if (key.pageUp) {
				setSelectedCourseIndex(prev => Math.max(0, prev - maxVisibleCourses));
			}

			if (key.pageDown) {
				setSelectedCourseIndex(prev =>
					Math.min(totalOptions - 1, prev + maxVisibleCourses),
				);
			}

			if (key.upArrow) {
				setSelectedCourseIndex(prev =>
					prev > 0 ? prev - 1 : totalOptions - 1,
				);
			}

			if (key.downArrow) {
				setSelectedCourseIndex(prev =>
					prev < totalOptions - 1 ? prev + 1 : 0,
				);
			}

			if (key.return) {
				if (selectedCourseIndex === 0) {
					// "모든 강의 전체 다운로드" selected
					void loadAllCoursesFiles(courses);
				} else {
					const selected = courses[selectedCourseIndex - 1];
					if (selected) {
						setPhase('loading-files');
						setLoading(true);
						const config = getConfig();
						const client = new CanvasClient(config);
						listCourseFiles(client, selected.id)
							.then(fileList => {
								setFiles(fileList);
								setSelectedFileIndices(new Set(fileList.map((_, i) => i)));
								setPhase('select-files');
							})
							.catch((err: Error) => {
								setError(err.message);
							})
							.finally(() => {
								setLoading(false);
							});
					}
				}
			}
		}

		// Phase 2: select-files (single course)
		if (phase === 'select-files') {
			const maxVisibleFiles = Math.max(5, termRows - 9);

			if (key.pageUp) {
				setFileIndex(prev => Math.max(0, prev - maxVisibleFiles));
			}

			if (key.pageDown) {
				setFileIndex(prev =>
					Math.min(files.length - 1, prev + maxVisibleFiles),
				);
			}

			if (key.upArrow) {
				setFileIndex(prev => Math.max(0, prev - 1));
			}

			if (key.downArrow) {
				setFileIndex(prev => Math.min(files.length - 1, prev + 1));
			}

			if (input === ' ') {
				setSelectedFileIndices(prev => {
					const next = new Set(prev);
					if (next.has(fileIndex)) {
						next.delete(fileIndex);
					} else {
						next.add(fileIndex);
					}

					return next;
				});
			}

			if (input === 'a') {
				if (selectedFileIndices.size === files.length) {
					setSelectedFileIndices(new Set());
				} else {
					setSelectedFileIndices(new Set(files.map((_, i) => i)));
				}
			}

			if (input === 's') {
				setSyncMode(prev => !prev);
			}

			if (input === 'd' || key.return) {
				void startSingleCourseDownload();
			}
		}

		// Phase 3: confirm-all (all courses)
		if (phase === 'confirm-all') {
			if (input === ' ' || input === 's') {
				setSyncMode(prev => !prev);
			}

			if (key.return || input === 'd') {
				void startAllCoursesDownload();
			}
		}
	});

	const startSingleCourseDownload = async () => {
		const selectedFiles = files.filter((_, i) => selectedFileIndices.has(i));
		if (selectedFiles.length === 0) return;

		setPhase('downloading');
		const config = getConfig();
		const client = new CanvasClient(config);
		const currentCourse = courseId
			? courses.find(c => c.id === courseId)
			: courses[selectedCourseIndex - 1];
		const cid = currentCourse?.id ?? courseId;
		if (!cid) return;

		try {
			const folders = await listCourseFolders(client, cid);
			const folderPaths = buildFolderPaths(folders);
			const courseDir = join(
				dest,
				sanitizeFolderName(currentCourse?.name ?? String(cid)),
			);

			const downloadItems: DownloadItem[] = selectedFiles.map(f => {
				const sub = folderPaths.get(f.folder_id) ?? '';
				return {
					file: f,
					destPath: join(courseDir, sub, f.display_name),
					courseName: currentCourse?.name,
				};
			});

			let finalItems = downloadItems;
			if (syncMode) {
				const plan = await planSyncItems(downloadItems);
				finalItems = plan.toDownload;
			}

			setTotalCount(finalItems.length);
			setCompletedCount(0);

			if (finalItems.length === 0) {
				setPhase('done');
				return;
			}

			await downloadFilesList(finalItems, config.token, progress => {
				setDownloadStatus(
					`${progress.fileName} (${formatBytes(
						progress.bytesDownloaded,
					)}/${formatBytes(progress.totalBytes)})`,
				);
				if (progress.status === 'complete' || progress.status === 'error') {
					setCompletedCount(prev => prev + 1);
				}
			});

			setPhase('done');
		} catch (err: any) {
			setError(err.message);
		}
	};

	const startAllCoursesDownload = async () => {
		if (allDownloadItems.length === 0) return;

		setPhase('downloading');
		const config = getConfig();

		try {
			let finalItems = allDownloadItems;
			if (syncMode) {
				const plan = await planSyncItems(allDownloadItems);
				finalItems = plan.toDownload;
			}

			setTotalCount(finalItems.length);
			setCompletedCount(0);

			if (finalItems.length === 0) {
				setPhase('done');
				return;
			}

			await downloadFilesList(finalItems, config.token, progress => {
				setDownloadStatus(
					`${progress.fileName} (${formatBytes(
						progress.bytesDownloaded,
					)}/${formatBytes(progress.totalBytes)})`,
				);
				if (progress.status === 'complete' || progress.status === 'error') {
					setCompletedCount(prev => prev + 1);
				}
			});

			setPhase('done');
		} catch (err: any) {
			setError(err.message);
		}
	};

	if (error) {
		return (
			<Box flexDirection="column" padding={1}>
				<Text color="red">
					❌ {strings.common.error}: {error}
				</Text>
				<Text dimColor>{strings.common.backHint}</Text>
			</Box>
		);
	}

	if (loading && phase === 'select-course') {
		return (
			<Box padding={1}>
				<Text color="yellow">⏳ </Text>
				<Text>{strings.courses.loading}</Text>
			</Box>
		);
	}

	if (phase === 'loading-all') {
		return (
			<Box padding={1} flexDirection="column">
				<Box>
					<Text color="yellow">⏳ </Text>
					<Text bold>{strings.files.loadingAllFiles}</Text>
				</Box>
				{loadingProgressText ? (
					<Text dimColor>{loadingProgressText}</Text>
				) : null}
			</Box>
		);
	}

	if (phase === 'select-course') {
		const totalOptions = courses.length + 1;
		const maxVisibleCourses = Math.max(5, termRows - 8);
		const courseWindow = computeScrollWindow(
			selectedCourseIndex,
			totalOptions,
			maxVisibleCourses,
		);

		return (
			<Box flexDirection="column" padding={1}>
				<Box>
					<Text bold color="cyan">
						{strings.files.title}
					</Text>
					<Text dimColor> ({courses.length})</Text>
				</Box>
				<Text dimColor>{strings.files.subtitle}</Text>
				<Text> </Text>

				{courseWindow.hasPrev && (
					<Text dimColor>
						{' '}
						▲ ... {courseWindow.prevCount} {strings.files.moreAbove}
					</Text>
				)}

				{Array.from(
					{length: courseWindow.endIndex - courseWindow.startIndex},
					(_, offset) => {
						const optIndex = courseWindow.startIndex + offset;
						const isSelected = selectedCourseIndex === optIndex;
						if (optIndex === 0) {
							return (
								<Box key="all-courses">
									<Text
										color={isSelected ? 'yellow' : 'cyan'}
										bold={isSelected}
									>
										{isSelected ? '❯ ' : '  '}
										{strings.files.allCoursesOption} ({courses.length})
									</Text>
								</Box>
							);
						}

						const course = courses[optIndex - 1]!;
						return (
							<Box key={course.id}>
								<Text color={isSelected ? 'cyan' : undefined} bold={isSelected}>
									{isSelected ? '❯ ' : '  '}
									{optIndex}. {truncate(course.name, 45)}
									<Text dimColor> ({course.course_code})</Text>
								</Text>
							</Box>
						);
					},
				)}

				{courseWindow.hasNext && (
					<Text dimColor>
						{' '}
						▼ ... {courseWindow.nextCount} {strings.files.moreBelow}
					</Text>
				)}

				<Text> </Text>
				<Text dimColor>
					↑↓/PgUp/PgDn ({selectedCourseIndex + 1}/{totalOptions}) · Enter ·{' '}
					{strings.common.backHint}
				</Text>
			</Box>
		);
	}

	if (phase === 'confirm-all') {
		const totalSize = allDownloadItems.reduce(
			(sum, item) => sum + item.file.size,
			0,
		);

		return (
			<Box flexDirection="column" padding={1}>
				<Text bold color="cyan">
					{strings.files.allCoursesConfirmTitle}
				</Text>
				<Text dimColor>{'─'.repeat(60)}</Text>
				<Text>
					• {strings.files.targetCoursesCount}:{' '}
					<Text bold color="green">
						{courses.length}
					</Text>
				</Text>
				<Text>
					• {strings.files.collectedFilesCount}:{' '}
					<Text bold color="green">
						{allDownloadItems.length}
					</Text>{' '}
					({formatBytes(totalSize)})
				</Text>
				<Text>
					• {strings.files.saveLocation}: <Text color="yellow">{dest}/</Text>
				</Text>
				<Text>
					• {strings.files.syncModeLabel}:{' '}
					{syncMode ? (
						<Text color="green" bold>
							{strings.files.syncModeOn}
						</Text>
					) : (
						<Text color="yellow">{strings.files.syncModeOff}</Text>
					)}
				</Text>
				<Text dimColor>{'─'.repeat(60)}</Text>
				<Text dimColor>{strings.files.confirmNavHint}</Text>
			</Box>
		);
	}

	if (phase === 'select-files') {
		const totalSize = files
			.filter((_, i) => selectedFileIndices.has(i))
			.reduce((sum, f) => sum + f.size, 0);

		const maxVisibleFiles = Math.max(5, termRows - 9);
		const fileWindow = computeScrollWindow(
			fileIndex,
			files.length,
			maxVisibleFiles,
		);
		const visibleFiles = files.slice(
			fileWindow.startIndex,
			fileWindow.endIndex,
		);

		return (
			<Box flexDirection="column" padding={1}>
				<Box>
					<Text bold color="cyan">
						{strings.files.selectFilesTitle}
					</Text>
					<Text>
						{' '}
						({selectedFileIndices.size}/{files.length}, {formatBytes(totalSize)}
						)
					</Text>
				</Box>
				<Text dimColor>
					{strings.files.syncModeLabel}:{' '}
					{syncMode ? (
						<Text color="green">[ON]</Text>
					) : (
						<Text dimColor>[OFF]</Text>
					)}{' '}
					(s)
				</Text>
				<Text> </Text>

				{fileWindow.hasPrev && (
					<Text dimColor>
						{' '}
						▲ ... {fileWindow.prevCount} {strings.files.moreAbove}
					</Text>
				)}

				{visibleFiles.map((file, offset) => {
					const actualIndex = fileWindow.startIndex + offset;
					const isSelected = actualIndex === fileIndex;
					const isChecked = selectedFileIndices.has(actualIndex);

					return (
						<Box key={file.id}>
							<Text color={isSelected ? 'cyan' : undefined} bold={isSelected}>
								{isSelected ? '❯' : ' '}
								{isChecked ? ' ☑ ' : ' ☐ '}
								{truncate(file.display_name, 45)}
								<Text dimColor> ({formatBytes(file.size)})</Text>
							</Text>
						</Box>
					);
				})}

				{fileWindow.hasNext && (
					<Text dimColor>
						{' '}
						▼ ... {fileWindow.nextCount} {strings.files.moreBelow}
					</Text>
				)}

				<Text> </Text>
				<Text dimColor>
					{strings.files.selectFilesNavHint} ({fileIndex + 1}/{files.length})
				</Text>
			</Box>
		);
	}

	if (phase === 'downloading') {
		const pct =
			totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
		const barWidth = 30;
		const filled = Math.round((pct / 100) * barWidth);
		const bar = '█'.repeat(filled) + '░'.repeat(barWidth - filled);

		return (
			<Box flexDirection="column" padding={1}>
				<Text bold color="cyan">
					{strings.files.downloadingTitle}
				</Text>
				<Text> </Text>
				<Text>
					{bar} {pct}% ({completedCount}/{totalCount})
				</Text>
				<Text dimColor>{downloadStatus}</Text>
			</Box>
		);
	}

	if (phase === 'done') {
		return (
			<Box flexDirection="column" padding={1}>
				<Text color="green" bold>
					{strings.files.downloadComplete}
				</Text>
				<Text>
					{completedCount} {strings.files.filesSavedIn} {dest}/
				</Text>
				<Text> </Text>
				<Text dimColor>{strings.common.backHint}</Text>
			</Box>
		);
	}

	return null;
}
