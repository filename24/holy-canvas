import React, {useEffect} from 'react';
import {Box, Text, useApp} from 'ink';
import FileBrowserView from '../components/file-browser.js';
import {CanvasClient} from '../api/client.js';
import {listCourses} from '../api/courses.js';
import {listCourseFiles, listCourseFolders} from '../api/files.js';
import {getConfig, isConfigured} from '../config/store.js';
import {outputJson} from '../utils/formatter.js';
import {t} from '../i18n/index.js';

interface Props {
	course?: string;
	all?: boolean;
	sync?: boolean;
	dest?: string;
	json?: boolean;
}

export default function FilesCommand({
	course,
	all = false,
	sync = false,
	dest = './canvas-files',
	json = false,
}: Props) {
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
				const courses: Array<{id: number; name: string}> = course
					? [{id: Number(course), name: `Course #${course}`}]
					: await listCourses(client);

				const results = [];
				for (const c of courses) {
					try {
						const files = await listCourseFiles(client, c.id);
						const folders = await listCourseFolders(client, c.id);
						results.push({
							courseId: c.id,
							courseName: c.name,
							fileCount: files.length,
							files,
							folders,
						});
					} catch {
						// Skip inaccessible course
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
	}, [course, all, json, exit]);

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
		<FileBrowserView
			courseId={course ? Number(course) : undefined}
			all={all}
			sync={sync}
			dest={dest}
			onBack={() => {
				exit();
			}}
		/>
	);
}
