import React, {useState, useEffect} from 'react';
import {Box, Text, useInput} from 'ink';
import {CanvasClient} from '../api/client.js';
import {listCourses} from '../api/courses.js';
import {getCourseGrades} from '../api/grades.js';
import {getConfig} from '../config/store.js';
import {truncate} from '../utils/formatter.js';
import {t} from '../i18n/index.js';

interface GradeRow {
	courseName: string;
	currentScore: string;
	finalScore: string;
	currentGrade: string;
	finalGrade: string;
}

interface Props {
	courseId?: number | null;
	onBack: () => void;
}

export default function GradeTableView({courseId, onBack}: Props) {
	const [grades, setGrades] = useState<GradeRow[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const strings = t();

	useInput((input, key) => {
		if (key.escape || input === 'q') {
			onBack();
		}
	});

	useEffect(() => {
		async function fetchGrades() {
			try {
				const config = getConfig();
				const client = new CanvasClient(config);

				const courses: Array<{id: number; name: string}> = courseId
					? [{id: courseId, name: `Course #${courseId}`}]
					: await listCourses(client);

				const allGrades: GradeRow[] = [];
				for (const course of courses) {
					try {
						const enrollments = await getCourseGrades(client, course.id);
						for (const enrollment of enrollments) {
							if (enrollment.grades) {
								allGrades.push({
									courseName: course.name,
									currentScore:
										enrollment.grades.current_score?.toString() ?? '—',
									finalScore: enrollment.grades.final_score?.toString() ?? '—',
									currentGrade: enrollment.grades.current_grade ?? '—',
									finalGrade: enrollment.grades.final_grade ?? '—',
								});
							}
						}
					} catch {
						// Skip courses with no grade access
					}
				}

				setGrades(allGrades);
			} catch (err: any) {
				setError(err.message);
			} finally {
				setLoading(false);
			}
		}

		void fetchGrades();
	}, [courseId]);

	if (loading) {
		return (
			<Box padding={1}>
				<Text color="yellow">... </Text>
				<Text>{strings.grades.loading}</Text>
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
				{strings.grades.title}
			</Text>
			<Text> </Text>

			{grades.length === 0 ? (
				<Text color="yellow">{strings.grades.empty}</Text>
			) : (
				<>
					{/* Header */}
					<Box>
						<Box width={35}>
							<Text bold dimColor>
								{strings.grades.colCourse}
							</Text>
						</Box>
						<Box width={12}>
							<Text bold dimColor>
								{strings.grades.colCurrentScore}
							</Text>
						</Box>
						<Box width={12}>
							<Text bold dimColor>
								{strings.grades.colFinalScore}
							</Text>
						</Box>
						<Box width={10}>
							<Text bold dimColor>
								{strings.grades.colCurrentGrade}
							</Text>
						</Box>
						<Box width={10}>
							<Text bold dimColor>
								{strings.grades.colFinalGrade}
							</Text>
						</Box>
					</Box>
					<Text dimColor>{'─'.repeat(79)}</Text>

					{grades.map((grade, i) => (
						<Box key={i}>
							<Box width={35}>
								<Text>{truncate(grade.courseName, 33)}</Text>
							</Box>
							<Box width={12}>
								<Text color={grade.currentScore !== '—' ? 'green' : 'yellow'}>
									{grade.currentScore}
								</Text>
							</Box>
							<Box width={12}>
								<Text>{grade.finalScore}</Text>
							</Box>
							<Box width={10}>
								<Text>{grade.currentGrade}</Text>
							</Box>
							<Box width={10}>
								<Text>{grade.finalGrade}</Text>
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
