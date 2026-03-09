import { instanceStore } from '@/app/backend/store';

export interface CodeReviewProgress {
	lastActive: number;
	lastViewedFile: string | null;
	remainingFiles: string[];
}

function getCodeReviewStore(): Record<string, Record<string, CodeReviewProgress>> {
	const current = instanceStore.get('codeReviews');
	return current && typeof current === 'object' ? current : {};
}

export function getCodeReviewProgress(repo: string, reviewId: string): CodeReviewProgress | null {
	return getCodeReviewStore()[repo]?.[reviewId] ?? null;
}

export function updateCodeReviewProgress(
	repo: string,
	reviewId: string,
	patch: Partial<CodeReviewProgress>
): CodeReviewProgress {
	const currentStore = getCodeReviewStore();
	const repoReviews = currentStore[repo] ?? {};
	const current = repoReviews[reviewId] ?? {
		lastActive: 0,
		lastViewedFile: null,
		remainingFiles: [],
	};
	const next = {
		...current,
		...patch,
		lastActive: Date.now(),
	};

	instanceStore.set('codeReviews', {
		...currentStore,
		[repo]: {
			...repoReviews,
			[reviewId]: next,
		},
	});

	return next;
}

export function resetCodeReviewProgress(repo: string, reviewId: string): void {
	const currentStore = getCodeReviewStore();
	const repoReviews = currentStore[repo] ?? {};
	if (!(reviewId in repoReviews)) {
		return;
	}

	const { [reviewId]: _removed, ...rest } = repoReviews;
	instanceStore.set('codeReviews', {
		...currentStore,
		[repo]: rest,
	});
}
