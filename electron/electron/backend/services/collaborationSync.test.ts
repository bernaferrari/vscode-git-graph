import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

const fetchMock = vi.fn();
global.fetch = fetchMock as typeof fetch;

const collaborationBundleSchema = z.object({
	version: z.literal(2),
	exportedAt: z.number(),
	workspaceShares: z.array(z.unknown()),
	patchShelf: z.array(z.unknown()),
	comments: z.array(z.unknown()).default([]),
	assignments: z.array(z.unknown()).default([]),
});

vi.mock('@/app/backend/store/collaboration', () => ({
	collaborationBundleSchema,
	parseCollaborationBundle: (input: unknown) => collaborationBundleSchema.parse(input),
}));

const { buildCollaborationEventStreamUrl, requestCollaborationHealth, requestCollaborationSync } = await import('./collaborationSync');

const baseBundle = {
	version: 2 as const,
	exportedAt: 1_710_000_000_000,
	workspaceShares: [],
	patchShelf: [],
	comments: [],
	assignments: [],
};

function makeJsonResponse(body: unknown): Response {
	return {
		ok: true,
		status: 200,
		statusText: 'OK',
		json: () => Promise.resolve(body),
		text: () => Promise.resolve(JSON.stringify(body)),
	} as unknown as Response;
}

describe('collaboration sync service', () => {
	beforeEach(() => {
		fetchMock.mockReset();
	});

	it('sends push sync requests with auth and member headers', async () => {
		fetchMock.mockResolvedValue(makeJsonResponse({ ok: true }));

		const result = await requestCollaborationSync({
			endpointUrl: 'https://sync.example.com',
			authToken: '  team-token  ',
			timeoutMs: 5_000,
			projectId: 'desktop-app',
			direction: 'push',
			actor: 'ada',
			memberId: ' ada@example.com ',
			memberApiKey: ' api-key ',
			bundle: baseBundle,
		});

		expect(result).toBeNull();
		const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
		expect(url.toString()).toBe('https://sync.example.com/');
		expect(init.method).toBe('POST');
		expect(init.headers).toEqual(
			expect.objectContaining({
				Accept: 'application/json',
				'Content-Type': 'application/json',
				Authorization: 'Bearer team-token',
				'X-Collaboration-Member': 'ada@example.com',
				'X-Collaboration-Member-Key': 'api-key',
			})
		);
		expect(init.body).toBe(
			JSON.stringify({
				projectId: 'desktop-app',
				direction: 'push',
				bundle: baseBundle,
				actor: 'ada',
			})
		);
	});

	it('parses pull responses and hydrates optional bundle fields', async () => {
		fetchMock.mockResolvedValue(
			makeJsonResponse({
				bundle: {
					version: 2,
					exportedAt: 1_710_000_000_500,
					workspaceShares: [],
					patchShelf: [],
				},
			})
		);

		const pulled = await requestCollaborationSync({
			endpointUrl: 'https://sync.example.com',
			authToken: '',
			timeoutMs: 5_000,
			projectId: 'desktop-app',
			direction: 'pull',
			bundle: baseBundle,
		});

		expect(pulled).toEqual({
			version: 2,
			exportedAt: 1_710_000_000_500,
			workspaceShares: [],
			patchShelf: [],
			comments: [],
			assignments: [],
		});
	});

	it('returns health payloads from remote sync servers', async () => {
		fetchMock.mockResolvedValue(
			makeJsonResponse({
				ok: true,
				version: '0.1.0',
				projectCount: 4,
			})
		);

		await expect(
			requestCollaborationHealth({
				endpointUrl: 'https://sync.example.com',
				authToken: 'token',
				timeoutMs: 3_000,
			})
		).resolves.toEqual({
			ok: true,
			version: '0.1.0',
			projectCount: 4,
		});
	});

	it('throws when pull/roundtrip sync does not return a bundle', async () => {
		fetchMock.mockResolvedValue(makeJsonResponse({ ok: true }));

		await expect(
			requestCollaborationSync({
				endpointUrl: 'https://sync.example.com',
				authToken: '',
				timeoutMs: 5_000,
				projectId: 'desktop-app',
				direction: 'roundtrip',
				bundle: baseBundle,
			})
		).rejects.toThrow('did not return a bundle');
	});

	it('builds event stream urls with trimmed member id', () => {
		const url = buildCollaborationEventStreamUrl({
			endpointUrl: 'https://sync.example.com',
			authToken: '',
			timeoutMs: 5_000,
			projectId: 'desktop-app',
			memberId: '  ada@example.com  ',
		});

		expect(url).toBe('https://sync.example.com/events?projectId=desktop-app&memberId=ada%40example.com');
	});
});
