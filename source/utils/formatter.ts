export function outputJson(data: unknown): void {
	console.log(JSON.stringify(data, null, 2));
}

export function formatBytes(bytes: number): string {
	const units = ['B', 'KB', 'MB', 'GB'];
	let i = 0;
	let size = bytes;
	while (size >= 1024 && i < units.length - 1) {
		size /= 1024;
		i++;
	}

	return `${size.toFixed(1)} ${units[i]!}`;
}

export function formatDate(isoString: string | null): string {
	if (!isoString) return '—';
	return new Date(isoString).toLocaleDateString('ko-KR', {
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
	});
}

export function truncate(str: string, maxLength: number): string {
	if (str.length <= maxLength) return str;
	return str.slice(0, maxLength - 1) + '…';
}
