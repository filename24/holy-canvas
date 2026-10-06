import React, {useState, useEffect} from 'react';
import {Box, Text, useInput} from 'ink';
import {CanvasClient} from '../api/client.js';
import {listCourses} from '../api/courses.js';
import {listQuizzes, getMyQuizSubmission} from '../api/quizzes.js';
import {getConfig} from '../config/store.js';
import {truncate, formatDate} from '../utils/formatter.js';
import {t} from '../i18n/index.js';

interface QuizRow {
	courseName: string;
	quizTitle: string;
	score: string;
	pointsPossible: number;
	finishedAt: string;
}

interface Props {
	courseId?: number | null;
	onBack: () => void;
}

export default function QuizResultsView({courseId, onBack}: Props) {
	const [rows, setRows] = useState<QuizRow[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [progress, setProgress] = useState('');
	const strings = t();

	useInput((input, key) => {
		if (key.escape || input === 'q') {
			onBack();
		}
	});

	useEffect(() => {
		async function fetchQuizzes() {
			try {
				const config = getConfig();
				const client = new CanvasClient(config);

				const currentStrings = t();
				let courses: Array<{id: number; name: string}>;
				if (courseId) {
					courses = [{id: courseId, name: `Course #${courseId}`}];
				} else {
					setProgress(currentStrings.quizzes.loading);
					courses = await listCourses(client);
				}

				const allRows: QuizRow[] = [];
				for (const course of courses) {
					try {
						setProgress(
							`${currentStrings.quizzes.loadingCourse} ${course.name}...`,
						);
						const quizzes = await listQuizzes(client, course.id);

						for (const quiz of quizzes) {
							try {
								const submissions = await getMyQuizSubmission(
									client,
									course.id,
									quiz.id,
								);
								for (const sub of submissions) {
									allRows.push({
										courseName: course.name,
										quizTitle: quiz.title,
										score:
											sub.kept_score?.toString() ??
											sub.score?.toString() ??
											'—',
										pointsPossible: quiz.points_possible,
										finishedAt: formatDate(sub.finished_at),
									});
								}
							} catch {
								// No submission for this quiz
							}
						}
					} catch {
						// Skip courses with no quiz access
					}
				}

				setRows(allRows);
			} catch (err: any) {
				setError(err.message);
			} finally {
				setLoading(false);
			}
		}

		void fetchQuizzes();
	}, [courseId]);

	if (loading) {
		return (
			<Box padding={1} flexDirection="column">
				<Box>
					<Text color="yellow">... </Text>
					<Text>{strings.quizzes.loading}</Text>
				</Box>
				{progress ? <Text dimColor>{progress}</Text> : null}
			</Box>
		);
	}

	if (error) {
		return (
			<Box flexDirection="column" padding={1}>
				<Text color="red">
					[{strings.common.error}] {error}
				</Text>
				<Text dimColor>{strings.common.backHint}</Text>
			</Box>
		);
	}

	return (
		<Box flexDirection="column" padding={1}>
			<Text bold color="cyan">
				{strings.quizzes.title}
			</Text>
			<Text> </Text>

			{rows.length === 0 ? (
				<Text color="yellow">{strings.quizzes.empty}</Text>
			) : (
				<>
					<Box>
						<Box width={25}>
							<Text bold dimColor>
								{strings.quizzes.colCourse}
							</Text>
						</Box>
						<Box width={25}>
							<Text bold dimColor>
								{strings.quizzes.colQuiz}
							</Text>
						</Box>
						<Box width={15}>
							<Text bold dimColor>
								{strings.quizzes.colScore}
							</Text>
						</Box>
						<Box width={20}>
							<Text bold dimColor>
								{strings.quizzes.colFinishedAt}
							</Text>
						</Box>
					</Box>
					<Text dimColor>{'─'.repeat(85)}</Text>

					{rows.map((row, i) => (
						<Box key={i}>
							<Box width={25}>
								<Text>{truncate(row.courseName, 23)}</Text>
							</Box>
							<Box width={25}>
								<Text>{truncate(row.quizTitle, 23)}</Text>
							</Box>
							<Box width={15}>
								<Text color={row.score !== '—' ? 'green' : 'yellow'}>
									{row.score}/{row.pointsPossible}
								</Text>
							</Box>
							<Box width={20}>
								<Text dimColor>{row.finishedAt}</Text>
							</Box>
						</Box>
					))}
				</>
			)}

			<Text> </Text>
			<Text dimColor>{strings.common.backHint}</Text>
		</Box>
	);
}
