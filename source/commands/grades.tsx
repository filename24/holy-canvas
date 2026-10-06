import React, {useEffect} from 'react';
import {Box, Text, useApp} from 'ink';
import GradeTableView from '../components/grade-table.js';
import {CanvasClient} from '../api/client.js';
import {listCourses} from '../api/courses.js';
import {getCourseGrades} from '../api/grades.js';
import {getConfig, isConfigured} from '../config/store.js';
import {outputJson} from '../utils/formatter.js';
import {t} from '../i18n/index.js';

interface Props {
	courseId?: string;
	json?: boolean;
}

export default function GradesCommand({courseId, json}: Props) {
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
				if (courseId) {
					const enrollments = await getCourseGrades(client, Number(courseId));
					outputJson(enrollments);
				} else {
					const courses = await listCourses(client);
					const results = [];
					for (const course of courses) {
						try {
							const enrollments = await getCourseGrades(client, course.id);
							results.push({
								courseId: course.id,
								courseName: course.name,
								enrollments,
							});
						} catch {
							// Skip inaccessible courses
						}
					}

					outputJson(results);
				}
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
		<GradeTableView
			courseId={courseId ? Number(courseId) : null}
			onBack={() => {
				exit();
			}}
		/>
	);
}
