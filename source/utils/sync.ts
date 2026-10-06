import {stat} from 'node:fs/promises';
import {join} from 'node:path';
import type {CanvasFile} from '../types/canvas.js';
import type {DownloadItem} from './download.js';

export interface SyncPlan {
	toDownload: CanvasFile[];
	upToDate: CanvasFile[];
	totalSize: number;
}

export interface ItemsSyncPlan {
	toDownload: DownloadItem[];
	upToDate: DownloadItem[];
	totalSize: number;
}

export async function planSync(
	files: CanvasFile[],
	destDir: string,
	folderPaths: Map<number, string>,
): Promise<SyncPlan> {
	const toDownload: CanvasFile[] = [];
	const upToDate: CanvasFile[] = [];

	for (const file of files) {
		const folderPath = folderPaths.get(file.folder_id) ?? '';
		const localPath = join(destDir, folderPath, file.display_name);

		try {
			const localStat = await stat(localPath);
			const remoteDate = new Date(file.updated_at);
			if (localStat.mtime >= remoteDate && localStat.size === file.size) {
				upToDate.push(file);
				continue;
			}
		} catch {
			// File doesn't exist locally
		}

		toDownload.push(file);
	}

	return {
		toDownload,
		upToDate,
		totalSize: toDownload.reduce((sum, f) => sum + f.size, 0),
	};
}

export async function planSyncItems(
	items: DownloadItem[],
): Promise<ItemsSyncPlan> {
	const toDownload: DownloadItem[] = [];
	const upToDate: DownloadItem[] = [];

	for (const item of items) {
		try {
			const localStat = await stat(item.destPath);
			const remoteDate = new Date(item.file.updated_at);
			if (localStat.mtime >= remoteDate && localStat.size === item.file.size) {
				upToDate.push(item);
				continue;
			}
		} catch {
			// File doesn't exist locally
		}

		toDownload.push(item);
	}

	return {
		toDownload,
		upToDate,
		totalSize: toDownload.reduce((sum, item) => sum + item.file.size, 0),
	};
}
