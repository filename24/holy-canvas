import type {CanvasClient} from './client.js';
import type {Announcement} from '../types/canvas.js';

export async function listAnnouncements(
	client: CanvasClient,
	courseIds: number[],
): Promise<Announcement[]> {
	const params: Record<string, string> = {};
	for (const id of courseIds) {
		params['context_codes[]'] = `course_${id}`;
	}

	return client.getAll<Announcement>('/announcements', params);
}
