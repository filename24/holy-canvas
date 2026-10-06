import type {CanvasClient} from './client.js';
import type {Course} from '../types/canvas.js';

export async function listCourses(client: CanvasClient): Promise<Course[]> {
	return client.getAll<Course>('/courses', {
		enrollment_state: 'active',
		'include[]': 'total_scores',
	});
}

export async function getCourse(
	client: CanvasClient,
	courseId: number,
): Promise<Course> {
	return client.get<Course>(`/courses/${courseId}`, {
		'include[]': 'syllabus_body',
	});
}
