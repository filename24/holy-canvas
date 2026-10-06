import type {CanvasClient} from './client.js';
import type {CanvasFile, Folder} from '../types/canvas.js';

export async function listCourseFiles(
	client: CanvasClient,
	courseId: number,
): Promise<CanvasFile[]> {
	return client.getAll<CanvasFile>(`/courses/${courseId}/files`, {
		sort: 'updated_at',
		order: 'desc',
	});
}

export async function listCourseFolders(
	client: CanvasClient,
	courseId: number,
): Promise<Folder[]> {
	return client.getAll<Folder>(`/courses/${courseId}/folders`);
}
