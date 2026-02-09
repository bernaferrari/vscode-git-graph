/**
 * Git Graph Branch Dropdown
 * Uses Shadcn select component for branch selection
 */

import { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';

interface BranchOption {
	name: string;
	value: string;
	isRemote?: boolean;
	isCurrent?: boolean;
	remote?: string;
}

interface BranchDropdownProps {
	branches: BranchOption[];
	selectedBranches: string[];
	multiple?: boolean;
	placeholder?: string;
	onChange: (values: string[]) => void;
}

export function BranchDropdown({
	branches,
	selectedBranches,
	multiple = false,
	placeholder = 'Select branch...',
	onChange,
}: BranchDropdownProps) {
	const [filter, setFilter] = useState('');
	const [isOpen, setIsOpen] = useState(false);

	const filteredBranches = useMemo(() => {
		if (!filter) return branches;
		const lowerFilter = filter.toLowerCase();
		return branches.filter((b) =>
			b.name.toLowerCase().includes(lowerFilter)
		);
	}, [branches, filter]);

	const localBranches = filteredBranches.filter((b) => !b.isRemote);
	const remoteBranches = filteredBranches.filter((b) => b.isRemote);

	const handleSelect = (value: string) => {
		if (multiple) {
			// For multiple selection
			if (value === '__all__') {
				onChange(['__all__']);
			} else {
				const current = selectedBranches.filter((v) => v !== '__all__');
				if (current.includes(value)) {
					onChange(current.filter((v) => v !== value));
				} else {
					onChange([...current, value]);
				}
			}
		} else {
			onChange([value]);
			setIsOpen(false);
		}
	};

	const displayValue = useMemo(() => {
		if (selectedBranches.length === 0) return placeholder;
		if (multiple && selectedBranches.includes('__all__')) return 'Show All';
		if (selectedBranches.length === 1) {
			const branch = branches.find((b) => b.value === selectedBranches[0]);
			return branch?.name ?? selectedBranches[0];
		}
		return `${selectedBranches.length} branches selected`;
	}, [selectedBranches, branches, placeholder, multiple]);

	return (
		<div className="relative">
			<Button
				variant="outline"
				onClick={() => setIsOpen(!isOpen)}
				className="w-full justify-between"
			>
				<span className="truncate">{displayValue}</span>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="16"
					height="16"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					strokeWidth="2"
					strokeLinecap="round"
					strokeLinejoin="round"
					className={`ml-2 transition-transform ${isOpen ? 'rotate-180' : ''}`}
				>
					<polyline points="6 9 12 15 18 9" />
				</svg>
			</Button>

			{isOpen && (
				<div className="absolute top-full left-0 right-0 z-50 mt-1 rounded-md border bg-popover shadow-lg">
					{/* Filter Input */}
					<div className="p-2 border-b">
						<Input
							value={filter}
							onChange={(e) => setFilter(e.target.value)}
							placeholder="Filter branches..."
							className="h-8"
							autoFocus
						/>
					</div>

					<ScrollArea className="max-h-64">
						<div className="p-1">
							{/* Show All option for multiple selection */}
							{multiple && (
								<>
									<BranchDropdownItem
										name="Show All"
										value="__all__"
										selected={selectedBranches.includes('__all__')}
										onClick={() => handleSelect('__all__')}
									/>
									<Separator className="my-1" />
								</>
							)}

							{/* Local Branches */}
							{localBranches.length > 0 && (
								<>
									<div className="px-2 py-1 text-xs text-muted-foreground font-medium">
										Local
									</div>
									{localBranches.map((branch) => (
										<BranchDropdownItem
											key={branch.value}
											{...branch}
											selected={
												selectedBranches.includes(branch.value) ||
												(multiple && selectedBranches.includes('__all__'))
											}
											onClick={() => handleSelect(branch.value)}
										/>
									))}
								</>
							)}

							{/* Remote Branches */}
							{remoteBranches.length > 0 && (
								<>
									{localBranches.length > 0 && <Separator className="my-1" />}
									<div className="px-2 py-1 text-xs text-muted-foreground font-medium">
										Remote
									</div>
									{remoteBranches.map((branch) => (
										<BranchDropdownItem
											key={branch.value}
											{...branch}
											selected={
												selectedBranches.includes(branch.value) ||
												(multiple && selectedBranches.includes('__all__'))
											}
											onClick={() => handleSelect(branch.value)}
										/>
									))}
								</>
							)}

							{filteredBranches.length === 0 && (
								<div className="px-2 py-3 text-center text-sm text-muted-foreground">
									No branches found
								</div>
							)}
						</div>
					</ScrollArea>
				</div>
			)}
		</div>
	);
}

interface BranchDropdownItemProps {
	name: string;
	value: string;
	selected: boolean;
	isCurrent?: boolean;
	onClick: () => void;
}

function BranchDropdownItem({
	name,
	selected,
	isCurrent,
	onClick,
}: BranchDropdownItemProps) {
	return (
		<button
			onClick={onClick}
			className={`w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-sm hover:bg-accent ${
				selected ? 'bg-accent/50' : ''
			}`}
		>
			{selected && (
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="14"
					height="14"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					strokeWidth="2"
					strokeLinecap="round"
					strokeLinejoin="round"
					className="shrink-0"
				>
					<polyline points="20 6 9 17 4 12" />
				</svg>
			)}
			<span className={`truncate ${!selected ? 'pl-5' : ''}`}>
				{name}
				{isCurrent && (
					<Badge variant="secondary" className="ml-2 text-xs">
						current
					</Badge>
				)}
			</span>
		</button>
	);
}
