/**
 * Issue Tracker Integration
 * Link commits to Jira, Linear, GitHub Issues, Asana, etc.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { trpc } from '@/trpc/client';
import { useAppStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import {
	ExternalLink,
	Link,
	Unlink,
	Search,
	Plus,
	Check,
	X,
	Loader2,
	GitPullRequest,
	LayoutGrid,
	Package,
	ListTodo,
	CheckCircle2,
	AlertCircle,
	Clock,
	Globe,
} from 'lucide-react';
import { toast } from 'sonner';

// Issue types
type IssueProvider = 'github' | 'jira' | 'linear' | 'asana' | 'trello' | 'clickup' | 'notion';

interface Issue {
	id: string;
	key: string;
	title: string;
	description?: string;
	status: 'open' | 'in_progress' | 'closed' | 'done';
	provider: IssueProvider;
	url: string;
	labels?: string[];
	assignee?: string;
	priority?: 'low' | 'medium' | 'high' | 'urgent';
}

interface IssueLink {
	commitHash: string;
	issueKey: string;
	provider: IssueProvider;
	addedAt: number;
}

interface IssueTrackerConfig {
	providers: {
		[ key in IssueProvider ]?: {
			enabled: boolean;
			apiKey?: string;
			domain?: string;
			projectKey?: string;
		};
	};
	autoDetect: boolean;
	patterns: string[];
}

export const PROVIDER_CONFIG: Record<IssueProvider, { name: string; icon: React.ReactNode; color: string }> = {
	github: { name: 'GitHub', icon: <GitPullRequest className="h-4 w-4" />, color: 'text-gray-700 dark:text-gray-300' },
	jira: { name: 'Jira', icon: <ListTodo className="h-4 w-4" />, color: 'text-blue-600' },
	linear: { name: 'Linear', icon: <Package className="h-4 w-4" />, color: 'text-indigo-600' },
	asana: { name: 'Asana', icon: <CheckCircle2 className="h-4 w-4" />, color: 'text-orange-600' },
	trello: { name: 'Trello', icon: <LayoutGrid className="h-4 w-4" />, color: 'text-blue-500' },
	clickup: { name: 'ClickUp', icon: <ListTodo className="h-4 w-4" />, color: 'text-pink-600' },
	notion: { name: 'Notion', icon: <Globe className="h-4 w-4" />, color: 'text-gray-800' },
};

export const STATUS_CONFIG: Record<Issue['status'], { color: string; icon: React.ReactNode }> = {
	open: { color: 'text-amber-600 bg-amber-100 dark:bg-amber-900/30', icon: <AlertCircle className="h-3 w-3" /> },
	in_progress: { color: 'text-blue-600 bg-blue-100 dark:bg-blue-900/30', icon: <Clock className="h-3 w-3" /> },
	closed: { color: 'text-green-600 bg-green-100 dark:bg-green-900/30', icon: <CheckCircle2 className="h-3 w-3" /> },
	done: { color: 'text-purple-600 bg-purple-100 dark:bg-purple-900/30', icon: <CheckCircle2 className="h-3 w-3" /> },
};

const STORAGE_KEY = 'git-graph-issue-tracker';

// Mock issue fetcher (in production, would call actual APIs)
function fetchIssues(provider: IssueProvider, query: string): Promise<Issue[]> {
	// Simulated API response
	return new Promise((resolve) => {
		setTimeout(() => {
			const mockIssues: Issue[] = [
				{
					id: '1',
					key: `${provider.toUpperCase()}-123`,
					title: `Sample issue matching "${query}"`,
					status: 'open',
					provider,
					url: `https://${provider}.example.com/issue/123`,
					labels: ['bug', 'priority-high'],
				},
				{
					id: '2',
					key: `${provider.toUpperCase()}-456`,
					title: `Another issue about ${query}`,
					status: 'in_progress',
					provider,
					url: `https://${provider}.example.com/issue/456`,
					labels: ['feature'],
				},
			];
			resolve(query ? mockIssues : []);
		}, 300);
	});
}

// Detect issue keys in commit message
export function detectIssueKeys(message: string, patterns: string[]): string[] {
	const keys: string[] = [];
	
	for (const pattern of patterns) {
		const regex = new RegExp(pattern, 'gi');
		const matches = message.match(regex);
		if (matches) {
			keys.push(...matches);
		}
	}
	
	return [...new Set(keys)];
}

export function IssueTrackerPanel({
	commitHash,
	commitMessage,
}: {
	commitHash: string;
	commitMessage: string;
}) {
	const { activeRepo } = useAppStore();
	const [config, setConfig] = useState<IssueTrackerConfig>(() => {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (stored) {
			try {
				return JSON.parse(stored);
			} catch {}
		}
		return {
			providers: {
				github: { enabled: true },
				jira: { enabled: false },
				linear: { enabled: false },
			},
			autoDetect: true,
			patterns: [
				'[A-Z]{2,10}-[0-9]+', // Jira style: PROJ-123
				'#\\d+', // GitHub style: #123
				'[A-Z]{2,4}[0-9]+', // Linear style: ENG123
			],
		};
	});

	const [searchQuery, setSearchQuery] = useState('');
	const [searchResults, setSearchResults] = useState<Issue[]>([]);
	const [isSearching, setIsSearching] = useState(false);
	const [linkedIssues, setLinkedIssues] = useState<IssueLink[]>([]);
	const [showSearch, setShowSearch] = useState(false);

	// Save config
	useEffect(() => {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
	}, [config]);

	// Auto-detect issues from commit message
	const detectedKeys = useMemo(() => {
		if (!config.autoDetect) return [];
		return detectIssueKeys(commitMessage, config.patterns);
	}, [commitMessage, config.autoDetect, config.patterns]);

	// Search issues
	const handleSearch = useCallback(async () => {
		if (!searchQuery.trim()) {
			setSearchResults([]);
			return;
		}

		setIsSearching(true);
		try {
			const enabledProviders = Object.entries(config.providers)
				.filter(([_, p]) => p.enabled)
				.map(([key]) => key as IssueProvider);

			const results = await Promise.all(
				enabledProviders.map(p => fetchIssues(p, searchQuery))
			);

			setSearchResults(results.flat());
		} catch (error) {
			toast.error('Failed to search issues');
		} finally {
			setIsSearching(false);
		}
	}, [searchQuery, config.providers]);

	// Link issue to commit
	const handleLinkIssue = useCallback((issue: Issue) => {
		const link: IssueLink = {
			commitHash,
			issueKey: issue.key,
			provider: issue.provider,
			addedAt: Date.now(),
		};

		setLinkedIssues(prev => {
			if (prev.some(l => l.issueKey === issue.key)) return prev;
			return [...prev, link];
		});

		// In production, would save to git notes or external storage
		toast.success(`Linked ${issue.key}`);
		setShowSearch(false);
		setSearchQuery('');
		setSearchResults([]);
	}, [commitHash]);

	// Unlink issue
	const handleUnlinkIssue = useCallback((issueKey: string) => {
		setLinkedIssues(prev => prev.filter(l => l.issueKey !== issueKey));
		toast.success(`Unlinked ${issueKey}`);
	}, []);

	// Get issue details
	const getIssueFromLink = useCallback((link: IssueLink): Issue => {
		return {
			id: link.issueKey,
			key: link.issueKey,
			title: `Issue ${link.issueKey}`,
			status: 'open',
			provider: link.provider,
			url: `https://${link.provider}.example.com/issue/${link.issueKey}`,
		};
	}, []);

	return (
		<div className="border rounded-lg overflow-hidden">
			<div className="px-3 py-2 bg-muted/50 border-b flex items-center justify-between">
				<span className="text-sm font-medium flex items-center gap-2">
					<Link className="h-4 w-4" />
					Linked Issues
				</span>
				<Button
					variant="ghost"
					size="sm"
					className="h-6"
					onClick={() => setShowSearch(!showSearch)}
				>
					<Plus className="h-4 w-4" />
				</Button>
			</div>

			{/* Search */}
			{showSearch && (
				<div className="p-3 border-b bg-muted/30 space-y-2">
					<div className="flex items-center gap-2">
						<div className="relative flex-1">
							<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
							<Input
								placeholder="Search issues..."
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
								onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
								className="pl-9"
							/>
						</div>
						<Button size="sm" onClick={handleSearch} disabled={isSearching}>
							{isSearching ? (
								<Loader2 className="h-4 w-4 animate-spin" />
							) : (
								<Search className="h-4 w-4" />
							)}
						</Button>
					</div>

					{searchResults.length > 0 && (
						<ScrollArea className="h-40">
							<div className="space-y-1">
								{searchResults.map(issue => (
									<div
										key={issue.id}
										className="flex items-center gap-2 p-2 rounded hover:bg-accent/50 cursor-pointer"
										onClick={() => handleLinkIssue(issue)}
									>
										<span className={PROVIDER_CONFIG[issue.provider].color}>
											{PROVIDER_CONFIG[issue.provider].icon}
										</span>
										<code className="text-xs">{issue.key}</code>
										<span className="text-sm truncate flex-1">{issue.title}</span>
										<Badge variant="outline" className={`text-xs ${STATUS_CONFIG[issue.status].color}`}>
											{STATUS_CONFIG[issue.status].icon}
										</Badge>
									</div>
								))}
							</div>
						</ScrollArea>
					)}
				</div>
			)}

			{/* Detected issues */}
			{detectedKeys.length > 0 && (
				<div className="px-3 py-2 border-b bg-blue-50 dark:bg-blue-900/20">
					<p className="text-xs text-muted-foreground mb-1">Detected in commit message:</p>
					<div className="flex flex-wrap gap-1">
						{detectedKeys.map(key => (
							<Badge key={key} variant="secondary" className="text-xs">
								{key}
							</Badge>
						))}
					</div>
				</div>
			)}

			{/* Linked issues */}
			<div className="p-3">
				{linkedIssues.length === 0 && detectedKeys.length === 0 ? (
					<p className="text-sm text-muted-foreground text-center py-4">
						No issues linked
					</p>
				) : (
					<div className="space-y-2">
						{linkedIssues.map(link => {
							const issue = getIssueFromLink(link);
							const providerConfig = PROVIDER_CONFIG[issue.provider];
							const statusConfig = STATUS_CONFIG[issue.status];

							return (
								<div
									key={link.issueKey}
									className="flex items-center gap-3 p-2 rounded hover:bg-accent/30"
								>
									<span className={providerConfig.color}>
										{providerConfig.icon}
									</span>
									<code className="text-sm font-mono">{issue.key}</code>
									<Badge variant="outline" className={`text-xs ${statusConfig.color}`}>
										{statusConfig.icon}
									</Badge>
									<div className="flex-1" />
									<Button
										variant="ghost"
										size="sm"
										className="h-6 w-6 p-0"
										onClick={() => window.open(issue.url, '_blank')}
									>
										<ExternalLink className="h-3 w-3" />
									</Button>
									<Button
										variant="ghost"
										size="sm"
										className="h-6 w-6 p-0 text-red-600"
										onClick={() => handleUnlinkIssue(link.issueKey)}
									>
										<Unlink className="h-3 w-3" />
									</Button>
								</div>
							);
						})}
					</div>
				)}
			</div>
		</div>
	);
}

// Issue Tracker Settings Dialog
export function IssueTrackerSettings({
	open,
	onOpenChange,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const [config, setConfig] = useState<IssueTrackerConfig>(() => {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (stored) {
			try {
				return JSON.parse(stored);
			} catch {}
		}
		return {
			providers: {
				github: { enabled: true },
				jira: { enabled: false },
				linear: { enabled: false },
			},
			autoDetect: true,
			patterns: ['[A-Z]{2,10}-[0-9]+', '#\\d+'],
		};
	});

	const handleToggleProvider = (provider: IssueProvider) => {
		setConfig(prev => ({
			...prev,
			providers: {
				...prev.providers,
				[provider]: {
					...prev.providers[provider],
					enabled: !prev.providers[provider]?.enabled,
				},
			},
		}));
	};

	const handleSave = () => {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
		toast.success('Settings saved');
		onOpenChange(false);
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-md">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<Link className="h-5 w-5" />
						Issue Tracker Integration
					</DialogTitle>
				</DialogHeader>

				<div className="space-y-6">
					{/* Providers */}
					<div>
						<p className="text-sm font-medium mb-3">Enabled Providers</p>
						<div className="space-y-2">
							{(Object.keys(PROVIDER_CONFIG) as IssueProvider[]).map(provider => {
								const cfg = PROVIDER_CONFIG[provider];
								const isEnabled = config.providers[provider]?.enabled;

								return (
									<div
										key={provider}
										className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer ${
											isEnabled ? 'border-primary bg-primary/5' : ''
										}`}
										onClick={() => handleToggleProvider(provider)}
									>
										<div className="flex items-center gap-3">
											<span className={cfg.color}>{cfg.icon}</span>
											<span className="font-medium">{cfg.name}</span>
										</div>
										{isEnabled && <Check className="h-4 w-4 text-primary" />}
									</div>
								);
							})}
						</div>
					</div>

					{/* Auto-detect */}
					<div className="flex items-center justify-between">
						<div>
							<p className="font-medium">Auto-detect issues</p>
							<p className="text-sm text-muted-foreground">
								Find issue keys in commit messages
							</p>
						</div>
						<Button
							variant={config.autoDetect ? 'default' : 'outline'}
							size="sm"
							onClick={() => setConfig(prev => ({ ...prev, autoDetect: !prev.autoDetect }))}
						>
							{config.autoDetect ? 'On' : 'Off'}
						</Button>
					</div>

					{/* Patterns */}
					<div>
						<p className="text-sm font-medium mb-2">Detection Patterns</p>
						<div className="space-y-1 text-sm">
							<code className="block bg-muted px-2 py-1 rounded">[A-Z]{'{2,10}'}-[0-9]+</code>
							<p className="text-muted-foreground">Jira style: PROJ-123</p>
							<code className="block bg-muted px-2 py-1 rounded mt-2">#\d+</code>
							<p className="text-muted-foreground">GitHub style: #123</p>
						</div>
					</div>
				</div>

				<div className="flex justify-end gap-2 pt-4 border-t">
					<Button variant="ghost" onClick={() => onOpenChange(false)}>
						Cancel
					</Button>
					<Button onClick={handleSave}>
						Save Settings
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	);
}

export default IssueTrackerPanel;
