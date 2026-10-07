import type {CanvasClient} from './client.js';
import type {CanvasFile, Folder} from '../types/canvas.js';

interface ExternalToolSummary {
	id: number;
	name?: string;
	url?: string;
}

interface LearningXItemContentData {
	_id?: string;
	content_id?: string;
	content_type?: string;
	view_url?: string;
	thumbnail_url?: string;
	file_name?: string;
	title?: string;
	total_file_size?: number;
	original_file_length?: number;
	updated_at?: string;
	created_at?: string;
	last_updated_date?: string;
	registered_date?: string;
}

interface LearningXModuleItem {
	module_item_id: number;
	title: string;
	content_type: string;
	content_id: number;
	content_data?: {
		item_content_type?: string;
		item_content_id?: string;
		item_content_data?: LearningXItemContentData;
	};
}

interface LearningXModule {
	module_id: number;
	title: string;
	module_items?: LearningXModuleItem[];
}

function getCanvasOrigin(client: CanvasClient): string {
	const raw = client.getDomain();
	return raw.startsWith('http') ? raw : `https://${raw}`;
}

async function findModuleBuilderToolId(
	client: CanvasClient,
	courseId: number,
): Promise<number> {
	try {
		const tools = await client.getAll<ExternalToolSummary>(
			`/courses/${courseId}/external_tools`,
			{include_parents: 'true'},
		);
		const mbTool = tools.find(t => {
			const u = t.url?.toLowerCase() ?? '';
			const n = t.name?.toLowerCase() ?? '';
			return (
				u.includes('modulebuilder') ||
				u.includes('learningx') ||
				n.includes('강의콘텐츠') ||
				n.includes('주차학습')
			);
		});
		if (mbTool) {
			return mbTool.id;
		}
	} catch {
		// Fallback to default
	}

	return 297;
}

async function getLearningXToken(
	client: CanvasClient,
	courseId: number,
): Promise<string | null> {
	const origin = getCanvasOrigin(client);
	const toolId = await findModuleBuilderToolId(client, courseId);

	let launchUrl: string;
	try {
		const launchRes = await client.get<{url: string}>(
			`/courses/${courseId}/external_tools/sessionless_launch`,
			{
				id: String(toolId),
				url: `${origin}/learningx/lti/modulebuilder`,
			},
		);
		launchUrl = launchRes.url;
	} catch {
		return null;
	}

	try {
		const htmlRes = await fetch(launchUrl, {
			headers: {'User-Agent': 'Mozilla/5.0'},
		});
		const html = await htmlRes.text();
		const formActionMatch = /action="([^"]+)"/.exec(html);
		if (!formActionMatch) return null;

		const formAction = formActionMatch[1]!;
		const inputMatches = [
			...html.matchAll(/name="([^"]+)"[^>]*value="([^"]*)"/g),
		];
		const formData = new URLSearchParams();
		for (const match of inputMatches) {
			formData.append(match[1]!, match[2]!);
		}

		const postRes = await fetch(formAction, {
			method: 'POST',
			headers: {
				'User-Agent': 'Mozilla/5.0',
				'Content-Type': 'application/x-www-form-urlencoded',
			},
			body: formData.toString(),
		});

		const rawCookies = postRes.headers.get('set-cookie') ?? '';
		const m = /xn_api_token=([^;]+)/.exec(rawCookies);
		return m ? m[1]! : null;
	} catch {
		return null;
	}
}

async function resolveAssetDownloadUrl(
	icd: LearningXItemContentData,
	assetId: string,
): Promise<string> {
	let lcmsHost = 'lcms.skku.edu';
	if (icd.thumbnail_url) {
		try {
			lcmsHost = new URL(icd.thumbnail_url).host;
		} catch {
			// Ignore URL parse error
		}
	} else if (icd.view_url) {
		try {
			lcmsHost = new URL(icd.view_url).host;
		} catch {
			// Ignore URL parse error
		}
	}

	let downloadUrl = `https://${lcmsHost}/CommonsCore2/v2/services/download/${assetId}`;
	try {
		const metaRes = await fetch(
			`https://${lcmsHost}/CommonsCore2/v2/contents/${assetId}`,
			{
				headers: {'User-Agent': 'Mozilla/5.0'},
			},
		);
		if (metaRes.ok) {
			const metaJson = (await metaRes.json()) as {
				result?: {download_url?: string};
			};
			if (metaJson.result?.download_url) {
				downloadUrl = metaJson.result.download_url;
			}
		}
	} catch {
		// Use default downloadUrl fallback
	}

	return downloadUrl;
}

function extractAssetId(icd: LearningXItemContentData): string {
	if (icd.thumbnail_url) {
		const thumbMatch = /\/contents\/([\da-fA-F-]+)(?:\.[a-zA-Z\d]+)?/.exec(
			icd.thumbnail_url,
		);
		if (thumbMatch) return thumbMatch[1]!;
	}

	return icd._id ?? icd.content_id ?? '';
}

async function buildLearningXFile(
	item: LearningXModuleItem,
	moduleId: number,
	origin: string,
): Promise<CanvasFile | null> {
	const icd = item.content_data?.item_content_data;
	if (!icd) return null;

	const contentType = icd.content_type?.toLowerCase();
	if (contentType !== 'pdf' && contentType !== 'file') {
		return null;
	}

	const assetId = extractAssetId(icd);
	const downloadUrl = assetId
		? await resolveAssetDownloadUrl(icd, assetId)
		: icd.view_url ?? '';

	const fileName = icd.file_name ?? item.title;
	const size = icd.total_file_size ?? icd.original_file_length ?? 0;
	const updatedAt =
		icd.updated_at ?? icd.last_updated_date ?? new Date().toISOString();
	const createdAt =
		icd.created_at ?? icd.registered_date ?? new Date().toISOString();

	return {
		id: Number(item.content_id) || Math.floor(Math.random() * 1_000_000),
		display_name: fileName,
		filename: fileName,
		url: downloadUrl,
		size,
		'content-type':
			contentType === 'pdf' ? 'application/pdf' : 'application/octet-stream',
		updated_at: updatedAt,
		created_at: createdAt,
		folder_id: moduleId,
		download_headers: {
			Referer: `${origin}/`,
		},
	};
}

export async function listLearningXFilesAndFolders(
	client: CanvasClient,
	courseId: number,
): Promise<{files: CanvasFile[]; folders: Folder[]}> {
	const origin = getCanvasOrigin(client);
	const xnToken = await getLearningXToken(client, courseId);
	if (!xnToken) {
		return {files: [], folders: []};
	}

	let modulesData: LearningXModule[] = [];
	try {
		const modulesRes = await fetch(
			`${origin}/learningx/api/v1/courses/${courseId}/modules`,
			{
				headers: {
					Authorization: `Bearer ${xnToken}`,
					Accept: 'application/json',
				},
			},
		);
		if (!modulesRes.ok) return {files: [], folders: []};

		modulesData = (await modulesRes.json()) as LearningXModule[];
	} catch {
		return {files: [], folders: []};
	}

	const files: CanvasFile[] = [];
	const folders: Folder[] = [];

	for (const m of modulesData) {
		folders.push({
			id: m.module_id,
			name: m.title,
			full_name: m.title,
			parent_folder_id: null,
			files_count: 0,
			folders_count: 0,
			updated_at: new Date().toISOString(),
		});

		for (const item of m.module_items ?? []) {
			const file = await buildLearningXFile(item, m.module_id, origin);
			if (file) {
				files.push(file);
				folders[folders.length - 1]!.files_count++;
			}
		}
	}

	return {files, folders};
}
