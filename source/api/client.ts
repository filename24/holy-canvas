import type {CanvasConfig} from '../types/canvas.js';

export class CanvasApiError extends Error {
	constructor(public status: number, public body: string) {
		super(`Canvas API Error (${status}): ${body}`);
		this.name = 'CanvasApiError';
	}
}

export class CanvasClient {
	private readonly domain: string;
	private readonly token: string;

	constructor(config: CanvasConfig) {
		this.domain = config.domain.replace(/\/+$/, '');
		this.token = config.token;
	}

	getDomain(): string {
		return this.domain;
	}

	getToken(): string {
		return this.token;
	}

	async get<T>(path: string, params?: Record<string, string>): Promise<T> {
		const url = new URL(`/api/v1${path}`, this.domain);
		if (params) {
			for (const [key, value] of Object.entries(params)) {
				url.searchParams.append(key, value);
			}
		}

		const response = await fetch(url.toString(), {
			headers: {
				Authorization: `Bearer ${this.token}`,
				Accept: 'application/json',
			},
		});

		if (!response.ok) {
			throw new CanvasApiError(response.status, await response.text());
		}

		return response.json() as Promise<T>;
	}

	async getAll<T>(path: string, params?: Record<string, string>): Promise<T[]> {
		const results: T[] = [];
		const initialUrl = new URL(`/api/v1${path}`, this.domain);
		initialUrl.searchParams.set('per_page', '100');
		if (params) {
			for (const [key, value] of Object.entries(params)) {
				initialUrl.searchParams.append(key, value);
			}
		}

		let nextUrl: string | null = initialUrl.toString();

		while (nextUrl) {
			const response = await fetch(nextUrl, {
				headers: {
					Authorization: `Bearer ${this.token}`,
					Accept: 'application/json',
				},
			});

			if (!response.ok) {
				throw new CanvasApiError(response.status, await response.text());
			}

			const data = (await response.json()) as T[];
			results.push(...data);
			nextUrl = this.parseNextLink(response.headers.get('link'));
		}

		return results;
	}

	async validate(): Promise<{valid: boolean; user?: any; error?: string}> {
		try {
			const user = await this.get<any>('/users/self/profile');
			return {valid: true, user};
		} catch (error) {
			if (error instanceof CanvasApiError) {
				if (error.status === 401) {
					return {valid: false, error: '토큰이 유효하지 않습니다.'};
				}

				if (error.status === 404) {
					return {
						valid: false,
						error: '해당 도메인에서 Canvas API를 찾을 수 없습니다.',
					};
				}
			}

			return {
				valid: false,
				error: '도메인에 연결할 수 없습니다. URL을 확인해주세요.',
			};
		}
	}

	private parseNextLink(linkHeader: string | null): string | null {
		if (!linkHeader) return null;
		const match = /<([^>]+)>;\s*rel="next"/.exec(linkHeader);
		return match ? match[1]! : null;
	}
}
