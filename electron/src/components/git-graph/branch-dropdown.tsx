/**
 * Git Graph Branch Dropdown
 * Clean popover-based branch selector
 */

import { useState, useMemo, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from '@/components/ui/popover';
import {
	Check,
	ChevronDown,
	GitBranch,
	Globe,
	Search,
	X,
} from 'lucide-react';

interface BranchOption {
	name: string;
	value: string;
	isRemote?: boolean;
	isCurrent?: boolean;
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
	const [open, setOpen] = useState(false);
	const [filter, setFilter] = useState('');
	const inputRef = useRef<HTMLInputElement>(null);

	// Focus input when opened
	useEffect(() => {
		if (open) {
			setTimeout(() => inputRef.current?.focus(), 0);
		} else {
			setFilter('');
		}
	}, [open]);

	// Filter branches
	const filteredBranches = useMemo(() => {
		if (!filter) return branches;
		const lowerFilter = filter.toLowerCase();
		return branches.filter((b) =>
			b.name.toLowerCase().includes(lowerFilter)
		);
	}, [branches, filter]);

	// Separate local and remote
	const localBranches = filteredBranches.filter((b) => !b.isRemote);
	const remoteBranches = filteredBranches.filter((b) => b.isRemote);

	// Handle selection - DON'T reorder, just toggle
	const handleSelect = (value: string) => {
		if (multiple) {
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
			setOpen(false);
		}
	};

	// Check if a specific branch is selected (not when "all" is selected)
	const isSelected = (value: string) => {
		// When "all" is selected, don't show individual items as selected
		if (multiple && selectedBranches.includes('__all__')) {
			return false;
		}
		return selectedBranches.includes(value);
	};

	// Check if "all" is selected
	const isAllSelected = multiple && selectedBranches.includes('__all__');

	// Display value
	const displayValue = useMemo(() => {
		if (selectedBranches.length === 0) return placeholder;
		if (multiple && selectedBranches.includes('__all__')) return 'All branches';
		if (selectedBranches.length === 1) {
			const branch = branches.find((b) => b.value === selectedBranches[0]);
			return branch?.name ?? selectedBranches[0];
		}
		return `${selectedBranches.length} branches`;
	}, [selectedBranches, branches, placeholder, multiple]);

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button
					variant="outline"
					size="sm"
					className="h-7 min-w-[140px] justify-between text-xs font-normal"
				>
					<span className="truncate">{displayValue}</span>
					<ChevronDown className="h-3.5 w-3.5 opacity-50 ml-2" />
				</Button>
			</PopoverTrigger>
			<PopoverContent 
				className="w-72 p-0" 
				align="start"
				sideOffset={4}
			>
				{/* Search */}
				<div className="p-2 border-b">
					<div className="relative">
						<Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
						<Input
							ref={inputRef}
							value={filter}
							onChange={(e) => setFilter(e.target.value)}
							placeholder="Filter branches..."
							className="h-8 pl-8 text-sm"
						/>
						{filter && (
							<Button
								variant="ghost"
								size="sm"
								className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 p-0"
								onClick={() => setFilter('')}
							>
								<X className="h-3 w-3" />
							</Button>
						)}
					</div>
				</div>

				<ScrollArea className="h-[300px]">
					<div className="py-1">
						{/* Show All option for multiple */}
						{multiple && (
							<>
								<BranchItem
									name="All branches"
									icon={<GitBranch className="h-4 w-4" />}
									selected={isAllSelected}
									onClick={() => handleSelect('__all__')}
								/>
								<div className="h-px bg-border mx-2 my-1" />
							</>
						)}

						{/* Local Branches */}
						{localBranches.length > 0 && (
							<>
								<div className="px-3 py-1.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
									Local
								</div>
								{localBranches.map((branch) => (
									<BranchItem
										key={branch.value}
										name={branch.name}
										icon={<GitBranch className="h-4 w-4" />}
										selected={isSelected(branch.value)}
										isCurrent={branch.isCurrent}
										onClick={() => handleSelect(branch.value)}
									/>
								))}
							</>
						)}

						{/* Remote Branches */}
						{remoteBranches.length > 0 && (
							<>
								{localBranches.length > 0 && <div className="h-px bg-border mx-2 my-1" />}
								<div className="px-3 py-1.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
									Remote
								</div>
								{remoteBranches.map((branch) => (
									<BranchItem
										key={branch.value}
										name={branch.name}
										icon={<Globe className="h-4 w-4" />}
										selected={isSelected(branch.value)}
										onClick={() => handleSelect(branch.value)}
									/>
								))}
							</>
						)}

						{filteredBranches.length === 0 && (
							<div className="px-3 py-6 text-center text-sm text-muted-foreground">
								No branches found
							</div>
						)}
					</div>
				</ScrollArea>
			</PopoverContent>
		</Popover>
	);
}

interface BranchItemProps {
	name: string;
	icon: React.ReactNode;
	selected: boolean;
	isCurrent?: boolean;
	onClick: () => void;
}

function BranchItem({ name, icon, selected, isCurrent, onClick }: BranchItemProps) {
	return (
		<button
			onClick={onClick}
			className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm transition-colors rounded-sm ${
				selected
					? 'bg-primary text-primary-foreground'
					: 'hover:bg-accent'
			}`}
		>
			<span className={selected ? 'text-primary-foreground' : 'text-muted-foreground'}>
				{icon}
			</span>
			<span className={`flex-1 text-left truncate ${isCurrent ? 'font-semibold' : ''}`}>
				{name}
			</span>
			{selected && (
				<Check className="h-4 w-4" />
			)}
		</button>
	);
}

export default BranchDropdown;
