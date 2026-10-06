import {createWriteStream} from 'node:fs';
import {mkdir} from 'node:fs/promises';
import {dirname, join} from 'node:path';
import type {CanvasFile, Folder} from '../types/canvas.js';

export interface DownloadProgress {
	fileId: number;
	fileName: string;
	bytesDownloaded: number;
	totalBytes: number;
	status: 'downloading' | 'complete' | 'error' | 'skipped';
}

export type ProgressCallback = (progress: DownloadProgress) => void;

export interface DownloadItem {
	file: CanvasFile;
	destPath: string;
	courseName?: string;
}

export function sanitizeFolderName(name: string): string {
	return name.replace(/[/\\?%*:|"<>]/g, '_').trim() || 'course';
}

export async function downloadFile(
	file: CanvasFile,
	destPath: string,
	token: string,
	onProgress?: ProgressCallback,
): Promise<void> {
	await mkdir(dirname(destPath), {recursive: true});

	const response = await fetch(file.url, {
		headers: {Authorization: `Bearer ${token}`},
		redirect: 'follow',
	});

	if (!response.ok || !response.body) {
		onProgress?.({
			fileId: file.id,
			fileName: file.display_name,
			bytesDownloaded: 0,
			totalBytes: file.size,
			status: 'error',
		});
		return;
	}

	const writer = createWriteStream(destPath);
	const reader = response.body.getReader();
	let bytesDownloaded = 0;

	try {
		while (true) {
			const {done, value} = await reader.read();
			if (done) break;
			writer.write(Buffer.from(value));
			bytesDownloaded += value.byteLength;
			onProgress?.({
				fileId: file.id,
				fileName: file.display_name,
				bytesDownloaded,
				totalBytes: file.size,
				status: 'downloading',
			});
		}

		writer.end();
		onProgress?.({
			fileId: file.id,
			fileName: file.display_name,
			bytesDownloaded,
			totalBytes: file.size,
			status: 'complete',
		});
	} catch {
		writer.end();
		onProgress?.({
			fileId: file.id,
			fileName: file.display_name,
			bytesDownloaded,
			totalBytes: file.size,
			status: 'error',
		});
	}
}

export function buildFolderPaths(folders: Folder[]): Map<number, string> {
	const folderPaths = new Map<number, string>();
	for (const folder of folders) {
		const cleanPath = folder.full_name.replace(/^course files\/?/, '');
		folderPaths.set(folder.id, cleanPath);
	}

	return folderPaths;
}

export async function downloadFilesList(
	items: DownloadItem[],
	token: string,
	onProgress?: ProgressCallback,
	concurrency = 3,
): Promise<void> {
	const queue = [...items];

	const worker = async () => {
		while (queue.length > 0) {
			const item = queue.shift();
			if (!item) break;
			await downloadFile(item.file, item.destPath, token, onProgress);
		}
	};

	const workers = Array.from(
		{length: Math.min(concurrency, items.length)},
		() => worker(),
	);
	await Promise.all(workers);
}

export async function downloadCourseFiles(
	files: CanvasFile[],
	folderPaths: Map<number, string>,
	destDir: string,
	token: string,
	onProgress?: ProgressCallback,
	concurrency = 3,
): Promise<void> {
	const items: DownloadItem[] = files.map(file => {
		const folderPath = folderPaths.get(file.folder_id) ?? '';
		const destPath = join(destDir, folderPath, file.display_name);
		return {file, destPath};
	});

	await downloadFilesList(items, token, onProgress, concurrency);
}
