import React, {useEffect} from 'react';
import {Box, Text, useApp} from 'ink';
import CourseListView from '../components/course-list.js';
import {CanvasClient} from '../api/client.js';
import {listCourses, getCourse} from '../api/courses.js';
import {getConfig, isConfigured} from '../config/store.js';
import {outputJson} from '../utils/formatter.js';
import {t} from '../i18n/index.js';

interface Props {
	courseId?: string;
	json?: boolean;
}

export default function CoursesCommand({courseId, json}: Props) {
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
					const course = await getCourse(client, Number(courseId));
					outputJson(course);
				} else {
					const courses = await listCourses(client);
					outputJson(courses);
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
		<CourseListView
			onBack={() => {
				exit();
			}}
		/>
	);
}
