import React from 'react';
import {Box, Text} from 'ink';
import {formatBytes} from '../utils/formatter.js';
import {t} from '../i18n/index.js';
import type {DownloadProgress} from '../utils/download.js';

interface Props {
	downloads: DownloadProgress[];
	totalFiles: number;
	completedFiles: number;
}

export default function DownloadProgressView({
	downloads,
	totalFiles,
	completedFiles,
}: Props) {
	const strings = t();
	const pct =
		totalFiles > 0 ? Math.round((completedFiles / totalFiles) * 100) : 0;
	const barWidth = 30;
	const filled = Math.round((pct / 100) * barWidth);
	const bar = '█'.repeat(filled) + '░'.repeat(barWidth - filled);

	return (
		<Box flexDirection="column" padding={1}>
			<Box marginBottom={1}>
				<Text bold>[{strings.files.downloadingTitle}] </Text>
				<Text color={completedFiles === totalFiles ? 'green' : 'cyan'}>
					[{completedFiles}/{totalFiles}]
				</Text>
			</Box>

			<Text>
				{bar} {pct}%
			</Text>

			{downloads
				.filter(d => d.status === 'downloading')
				.slice(0, 5)
				.map(d => (
					<Box key={d.fileId}>
						<Text color="yellow">↓ </Text>
						<Text>{d.fileName} </Text>
						<Text dimColor>
							({formatBytes(d.bytesDownloaded)}/{formatBytes(d.totalBytes)})
						</Text>
					</Box>
				))}
		</Box>
	);
}
