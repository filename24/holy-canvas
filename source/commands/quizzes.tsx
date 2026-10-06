import React, {useEffect} from 'react';
import {Box, Text, useApp} from 'ink';
import QuizResultsView from '../components/quiz-results.js';
import {CanvasClient} from '../api/client.js';
import {listCourses} from '../api/courses.js';
import {listQuizzes, getMyQuizSubmission} from '../api/quizzes.js';
import {getConfig, isConfigured} from '../config/store.js';
import {outputJson} from '../utils/formatter.js';
import {t} from '../i18n/index.js';
import type {QuizSubmission} from '../types/canvas.js';

interface Props {
	courseId?: string;
	json?: boolean;
}

export default function QuizzesCommand({courseId, json}: Props) {
	const {exit} = useApp();

	useEffect(() => {
		if (!json) return;

		async function runJson() {
			if (!isConfigured()) {
				outputJson({
					error: `${t().setup.needSetup} ${t().setup.runSetupHint}`,
				});
				exit();
				return;
			}

			try {
				const client = new CanvasClient(getConfig());
				const courses: Array<{id: number; name: string}> = courseId
					? [{id: Number(courseId), name: `Course #${courseId}`}]
					: await listCourses(client);

				const results = [];
				for (const course of courses) {
					try {
						const quizzes = await listQuizzes(client, course.id);
						const quizList = [];
						for (const quiz of quizzes) {
							let submissions: QuizSubmission[] = [];
							try {
								submissions = await getMyQuizSubmission(
									client,
									course.id,
									quiz.id,
								);
							} catch {
								// No submission
							}

							quizList.push({
								...quiz,
								submissions,
							});
						}

						results.push({
							courseId: course.id,
							courseName: course.name,
							quizzes: quizList,
						});
					} catch {
						// Skip course with no quiz access
					}
				}

				outputJson(results);
			} catch (err: any) {
				outputJson({error: err.message});
			} finally {
				exit();
			}
		}

		void runJson();
	}, [courseId, json, exit]);

	if (json) {
		return null;
	}

	if (!isConfigured()) {
		return (
			<Box flexDirection="column" padding={1}>
				<Text color="yellow">{t().setup.needSetup}</Text>
				<Text dimColor>{t().setup.runSetupHint}</Text>
			</Box>
		);
	}

	return (
		<QuizResultsView
			courseId={courseId ? Number(courseId) : null}
			onBack={() => {
				exit();
			}}
		/>
	);
}
