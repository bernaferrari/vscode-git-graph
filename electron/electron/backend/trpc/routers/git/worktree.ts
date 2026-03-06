export interface ParsedWorktreeRecord {
	path: string;
	headSha: string | null;
	branchRef: string | null;
	detached: boolean;
	bare: boolean;
	locked: boolean;
	lockReason: string | null;
	prunable: boolean;
	prunableReason: string | null;
}

export function parseWorktreePorcelainRecords(output: string | null): ParsedWorktreeRecord[] {
	const lines = (output ?? '').split('\n');
	const records: ParsedWorktreeRecord[] = [];
	let current: ParsedWorktreeRecord | null = null;

	const pushCurrent = () => {
		if (current?.path) {
			records.push(current);
		}
		current = null;
	};

	for (const rawLine of lines) {
		const line = rawLine.trimEnd();
		if (!line) {
			pushCurrent();
			continue;
		}

		if (line.startsWith('worktree ')) {
			pushCurrent();
			current = {
				path: line.slice('worktree '.length),
				headSha: null,
				branchRef: null,
				detached: false,
				bare: false,
				locked: false,
				lockReason: null,
				prunable: false,
				prunableReason: null,
			};
			continue;
		}

		if (!current) {
			continue;
		}

		if (line.startsWith('HEAD ')) {
			current.headSha = line.slice('HEAD '.length) || null;
			continue;
		}

		if (line.startsWith('branch ')) {
			current.branchRef = line.slice('branch '.length) || null;
			continue;
		}

		if (line === 'detached') {
			current.detached = true;
			continue;
		}

		if (line === 'bare') {
			current.bare = true;
			continue;
		}

		if (line.startsWith('locked')) {
			current.locked = true;
			current.lockReason = line.slice('locked'.length).trim() || null;
			continue;
		}

		if (line.startsWith('prunable')) {
			current.prunable = true;
			current.prunableReason = line.slice('prunable'.length).trim() || null;
		}
	}

	pushCurrent();
	return records;
}
