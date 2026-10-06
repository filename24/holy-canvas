import React, {useState, useEffect} from 'react';
import {Box, Text, useInput} from 'ink';
import {CanvasClient} from '../api/client.js';
import {listCourses} from '../api/courses.js';
import {getConfig} from '../config/store.js';
import {truncate} from '../utils/formatter.js';
import {t} from '../i18n/index.js';
import type {Course} from '../types/canvas.js';

interface Props {
	onBack: () => void;
	onSelectCourse?: (courseId: number) => void;
}

export default function CourseListView({onBack, onSelectCourse}: Props) {
	const [courses, setCourses] = useState<Course[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [selectedIndex, setSelectedIndex] = useState(0);
	const strings = t();

	useEffect(() => {
		const config = getConfig();
		const client = new CanvasClient(config);
		listCourses(client)
			.then(data => {
				setCourses(data);
			})
			.catch((err: Error) => {
				setError(err.message);
			})
			.finally(() => {
				setLoading(false);
			});
	}, []);

	useInput((input, key) => {
		if (key.escape || input === 'q') {
			onBack();
			return;
		}

		if (key.upArrow) {
			setSelectedIndex(prev => Math.max(0, prev - 1));
		}

		if (key.downArrow) {
			setSelectedIndex(prev => Math.min(courses.length - 1, prev + 1));
		}

		if (key.return && courses[selectedIndex] && onSelectCourse) {
			onSelectCourse(courses[selectedIndex]!.id);
		}
	});

	if (loading) {
		return (
			<Box padding={1}>
				<Text color="yellow">... </Text>
				<Text>{strings.courses.loading}</Text>
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

	if (courses.length === 0) {
		return (
			<Box flexDirection="column" padding={1}>
				<Text color="yellow">{strings.courses.empty}</Text>
				<Text dimColor>{strings.common.backHint}</Text>
			</Box>
		);
	}

	return (
		<Box flexDirection="column" padding={1}>
			<Text bold color="cyan">
				{strings.courses.title} ({courses.length})
			</Text>
			<Text> </Text>

			{/* Table header */}
			<Box>
				<Box width={4}>
					<Text bold dimColor>
						{strings.courses.colIndex}
					</Text>
				</Box>
				<Box width={40}>
					<Text bold dimColor>
						{strings.courses.colName}
					</Text>
				</Box>
				<Box width={15}>
					<Text bold dimColor>
						{strings.courses.colCode}
					</Text>
				</Box>
				<Box width={12}>
					<Text bold dimColor>
						{strings.courses.colStatus}
					</Text>
				</Box>
			</Box>

			{/* Divider */}
			<Text dimColor>{'─'.repeat(71)}</Text>

			{/* Table rows */}
			{courses.map((course, index) => (
				<Box key={course.id}>
					<Box width={4}>
						<Text color={index === selectedIndex ? 'cyan' : undefined}>
							{index === selectedIndex ? '>' : ' '}
							{index + 1}
						</Text>
					</Box>
					<Box width={40}>
						<Text
							color={index === selectedIndex ? 'cyan' : undefined}
							bold={index === selectedIndex}
						>
							{truncate(course.name, 38)}
						</Text>
					</Box>
					<Box width={15}>
						<Text dimColor>{truncate(course.course_code, 13)}</Text>
					</Box>
					<Box width={12}>
						<Text
							color={course.workflow_state === 'available' ? 'green' : 'yellow'}
						>
							{course.workflow_state === 'available'
								? strings.common.statusActive
								: course.workflow_state}
						</Text>
					</Box>
				</Box>
			))}

			<Text> </Text>
			<Text dimColor>{strings.courses.navHint}</Text>
		</Box>
	);
}
