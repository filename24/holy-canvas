import type {CanvasClient} from './client.js';
import {listLearningXFilesAndFolders} from './learningx.js';
import type {CanvasFile, Folder} from '../types/canvas.js';

export async function listCourseFiles(
	client: CanvasClient,
	courseId: number,
): Promise<CanvasFile[]> {
	try {
		const files = await client.getAll<CanvasFile>(
			`/courses/${courseId}/files`,
			{
				sort: 'updated_at',
				order: 'desc',
			},
		);
		if (files.length > 0) {
			return files;
		}

		// If 0 standard files, check LearningX lecture content
		const lx = await listLearningXFilesAndFolders(client, courseId);
		return lx.files.length > 0 ? lx.files : files;
	} catch (error: unknown) {
		// When standard Files tab is locked (401) or unavailable, fallback to LearningX
		try {
			const lx = await listLearningXFilesAndFolders(client, courseId);
			if (lx.files.length > 0) {
				return lx.files;
			}
		} catch {
			// Ignore fallback error and rethrow original
		}

		throw error instanceof Error ? error : new Error(String(error));
	}
}

export async function listCourseFolders(
	client: CanvasClient,
	courseId: number,
): Promise<Folder[]> {
	try {
		const folders = await client.getAll<Folder>(`/courses/${courseId}/folders`);
		if (folders.some(f => f.files_count > 0)) {
			return folders;
		}

		const lx = await listLearningXFilesAndFolders(client, courseId);
		return lx.folders.length > 0 ? lx.folders : folders;
	} catch (error: unknown) {
		try {
			const lx = await listLearningXFilesAndFolders(client, courseId);
			if (lx.folders.length > 0) {
				return lx.folders;
			}
		} catch {
			// Ignore fallback error and rethrow original
		}

		throw error instanceof Error ? error : new Error(String(error));
	}
}

export async function listAllCourseFilesAndFolders(
	client: CanvasClient,
	courseId: number,
): Promise<{files: CanvasFile[]; folders: Folder[]}> {
	let files: CanvasFile[] = [];
	let folders: Folder[] = [];

	try {
		files = await client.getAll<CanvasFile>(`/courses/${courseId}/files`, {
			sort: 'updated_at',
			order: 'desc',
		});
		folders = await client.getAll<Folder>(`/courses/${courseId}/folders`);
	} catch {
		// Standard files tab might be locked
	}

	try {
		const lx = await listLearningXFilesAndFolders(client, courseId);
		if (lx.files.length > 0) {
			files = [...files, ...lx.files];
			folders = [...folders, ...lx.folders];
		}
	} catch {
		// Ignore LearningX error if not a LearningX institution
	}

	return {files, folders};
}
