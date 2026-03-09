import { randomUUID } from 'node:crypto';
import { z } from 'zod';

import { instanceStore } from '@/app/backend/store';

export const auditEntrySchema = z.object({
	id: z.string().min(1),
	timestamp: z.number(),
	scope: z.enum(['git', 'review', 'system', 'policy']),
	action: z.string().min(1),
	repo: z.string().nullable(),
	status: z.enum(['success', 'failed', 'info']),
	summary: z.string().min(1),
	details: z.string().optional(),
	metadata: z.record(z.string(), z.unknown()).optional(),
});

export type AuditEntry = z.infer<typeof auditEntrySchema>;

export interface CreateAuditEntryInput {
	scope: AuditEntry['scope'];
	action: string;
	repo?: string | null;
	status?: AuditEntry['status'];
	summary: string;
	details?: string;
	metadata?: Record<string, unknown>;
}

export function listAuditEntries(repo?: string | null, limit: number = 100): AuditEntry[] {
	return (instanceStore.get('auditLog') ?? [])
		.map((entry) => auditEntrySchema.safeParse(entry))
		.filter((result): result is { success: true; data: AuditEntry } => result.success)
		.map((result) => result.data)
		.filter((entry) => (repo ? entry.repo === repo : true))
		.sort((a, b) => b.timestamp - a.timestamp)
		.slice(0, limit);
}

export function appendAuditEntry(input: CreateAuditEntryInput): AuditEntry {
	const nextEntry: AuditEntry = {
		id: `audit-${randomUUID()}`,
		timestamp: Date.now(),
		scope: input.scope,
		action: input.action,
		repo: input.repo ?? null,
		status: input.status ?? 'info',
		summary: input.summary,
		...(input.details ? { details: input.details } : {}),
		...(input.metadata ? { metadata: input.metadata } : {}),
	};
	instanceStore.set('auditLog', [nextEntry, ...listAuditEntries(undefined, 1000)].slice(0, 1000));
	return nextEntry;
}

export function clearAuditEntries(): void {
	instanceStore.set('auditLog', []);
}
