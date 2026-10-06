import type {CanvasClient} from './client.js';
import type {Quiz, QuizSubmission} from '../types/canvas.js';

export async function listQuizzes(
	client: CanvasClient,
	courseId: number,
): Promise<Quiz[]> {
	return client.getAll<Quiz>(`/courses/${courseId}/quizzes`);
}

export async function getMyQuizSubmission(
	client: CanvasClient,
	courseId: number,
	quizId: number,
): Promise<QuizSubmission[]> {
	const result = await client.get<{quiz_submissions: QuizSubmission[]}>(
		`/courses/${courseId}/quizzes/${quizId}/submission`,
		{'include[]': 'quiz'},
	);
	return result.quiz_submissions;
}
