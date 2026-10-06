import type {CanvasClient} from './client.js';
import type {Enrollment, AssignmentAnalytics} from '../types/canvas.js';

export async function getCourseGrades(
	client: CanvasClient,
	courseId: number,
): Promise<Enrollment[]> {
	return client.getAll<Enrollment>(`/courses/${courseId}/enrollments`, {
		user_id: 'self',
	});
}

export async function getAssignmentScores(
	client: CanvasClient,
	courseId: number,
	userId: number | string = 'self',
): Promise<AssignmentAnalytics[]> {
	return client.get<AssignmentAnalytics[]>(
		`/courses/${courseId}/analytics/users/${userId}/assignments`,
	);
}
