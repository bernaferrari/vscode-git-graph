/**
 * Commit History Filters
 * Filter commits by author, date range, file path, message search
 */

import {
	Search,
	User,
	CalendarDays,
	X,
	FileText,
	RotateCcw,
} from 'lucide-react';
import { useState, useMemo } from 'react';

import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useAppStore } from '@/lib/store';
import { trpc } from '@/trpc/client';

export interface CommitFilter {
	author?: string;
	dateFrom?: Date;
	dateTo?: Date;
	filePath?: string;
	search?: string;
}

interface CommitHistoryFiltersProps {
	filters: CommitFilter;
	onChange: (filters: CommitFilter) => void;
}

function buildFilters(current: CommitFilter, patch: Partial<Record<keyof CommitFilter, string | Date | undefined>>): CommitFilter {
	const next: CommitFilter = { ...current };

	if ('author' in patch) {
		if (typeof patch.author === 'string' && patch.author.trim()) {
			next.author = patch.author.trim();
		} else {
			delete next.author;
		}
	}

	if ('dateFrom' in patch) {
		if (patch.dateFrom instanceof Date) {
			next.dateFrom = patch.dateFrom;
		} else {
			delete next.dateFrom;
		}
	}

	if ('dateTo' in patch) {
		if (patch.dateTo instanceof Date) {
			next.dateTo = patch.dateTo;
		} else {
			delete next.dateTo;
		}
	}

	if ('filePath' in patch) {
		if (typeof patch.filePath === 'string' && patch.filePath.trim()) {
			next.filePath = patch.filePath.trim();
		} else {
			delete next.filePath;
		}
	}

	if ('search' in patch) {
		if (typeof patch.search === 'string' && patch.search.trim()) {
			next.search = patch.search.trim();
		} else {
			delete next.search;
		}
	}

	return next;
}

export function CommitHistoryFilters({ filters, onChange }: CommitHistoryFiltersProps) {
	const { activeRepo } = useAppStore();
	const [localSearch, setLocalSearch] = useState(filters.search ?? '');

	const { data: authorsData } = trpc.git.statistics.useQuery(
		{ repo: activeRepo ?? '', since: '-1y' },
		{ enabled: !!activeRepo }
	);

	const authors = useMemo(() => {
		const list = new Set<string>();
		(authorsData?.authors ?? []).forEach((author: { name: string }) => list.add(author.name));
		return Array.from(list).sort();
	}, [authorsData?.authors]);

	const hasFilters = filters.author || filters.dateFrom || filters.dateTo || filters.filePath || filters.search;

	const clearFilters = () => {
		onChange({});
		setLocalSearch('');
	};

	const handleSearch = () => {
		onChange(buildFilters(filters, { search: localSearch }));
	};

	return (
		<div className="flex items-center gap-2">
			<div className="relative flex-1 max-w-[200px]">
				<Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
				<Input
					placeholder="Search commits..."
					value={localSearch}
					onChange={(e) => { setLocalSearch(e.target.value); }}
					onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
					className="h-7 pl-7 pr-7 text-xs"
				/>
				{localSearch && (
					<Button
						variant="ghost"
						size="sm"
						className="absolute right-1 top-1/2 -translate-y-1/2 h-5 w-5 p-0"
						onClick={() => {
							setLocalSearch('');
							onChange(buildFilters(filters, { search: '' }));
						}}
					>
						<X className="h-3 w-3" />
					</Button>
				)}
			</div>

			<Popover>
				<PopoverTrigger asChild>
					<Button variant="outline" size="sm" className="h-7 px-2">
						<User className="h-3 w-3 mr-1" />
						{filters.author || 'Author'}
					</Button>
				</PopoverTrigger>
				<PopoverContent className="w-64 p-0" align="start">
					<div className="p-2 border-b">
						<Input
							placeholder="Filter authors..."
							className="h-7 text-xs"
						/>
					</div>
					<div className="max-h-48 overflow-auto">
						<Button
							variant="ghost"
							size="sm"
							className="w-full justify-start h-7 px-2"
							onClick={() => { onChange(buildFilters(filters, { author: '' })); }}
						>
							Any Author
						</Button>
						{authors.map((author) => (
							<Button
								key={author}
								variant={filters.author === author ? 'secondary' : 'ghost'}
								size="sm"
								className="w-full justify-start h-7 px-2"
								onClick={() => { onChange(buildFilters(filters, { author })); }}
							>
								{author}
							</Button>
						))}
					</div>
				</PopoverContent>
			</Popover>

			<Popover>
				<PopoverTrigger asChild>
					<Button variant="outline" size="sm" className="h-7 px-2">
						<CalendarDays className="h-3 w-3 mr-1" />
						{filters.dateFrom || filters.dateTo ? 'Date' : 'Date'}
					</Button>
				</PopoverTrigger>
				<PopoverContent className="w-auto p-0" align="start">
					<div className="p-2 space-y-2">
						<div className="text-xs font-medium">Date Range</div>
						<div className="flex gap-2">
							<div>
								<div className="text-[10px] text-muted-foreground mb-1">From</div>
								<Calendar
									mode="single"
									selected={filters.dateFrom}
									onSelect={(date) => { onChange(buildFilters(filters, { dateFrom: date ?? undefined })); }}
									className="rounded-md border"
								/>
							</div>
							<div>
								<div className="text-[10px] text-muted-foreground mb-1">To</div>
								<Calendar
									mode="single"
									selected={filters.dateTo}
									onSelect={(date) => { onChange(buildFilters(filters, { dateTo: date ?? undefined })); }}
									className="rounded-md border"
								/>
							</div>
						</div>
						<Button
							variant="ghost"
							size="sm"
							className="w-full h-7 text-xs"
							onClick={() => { onChange(buildFilters(filters, { dateFrom: undefined, dateTo: undefined })); }}
						>
							Clear Dates
						</Button>
					</div>
				</PopoverContent>
			</Popover>

			<Popover>
				<PopoverTrigger asChild>
					<Button variant="outline" size="sm" className="h-7 px-2">
						<FileText className="h-3 w-3 mr-1" />
						{filters.filePath ? filters.filePath.split('/').pop() : 'File'}
					</Button>
				</PopoverTrigger>
				<PopoverContent className="w-64 p-2" align="start">
					<div className="text-xs font-medium mb-2">Filter by File Path</div>
					<Input
						placeholder="src/components/..."
						value={filters.filePath ?? ''}
						onChange={(e) => { onChange(buildFilters(filters, { filePath: e.target.value })); }}
						className="h-7 text-xs"
					/>
				</PopoverContent>
			</Popover>

			{hasFilters && (
				<Button variant="ghost" size="sm" className="h-7 px-2" onClick={clearFilters}>
					<RotateCcw className="h-3 w-3 mr-1" />
					Clear
				</Button>
			)}
		</div>
	);
}
