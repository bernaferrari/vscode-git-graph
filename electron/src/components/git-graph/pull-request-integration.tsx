/**
 * Pull Request Integration
 * Create, view, and manage PRs for GitHub, GitLab, Bitbucket
 */

import { useState, useEffect } from 'react';
import { trpc } from '@/trpc/client';
import { useAppStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogFooter,
} from '@/components/ui/dialog';
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from '@/components/ui/tabs';
import {
	GitPullRequest,
	GitBranch,
	Plus,
	ExternalLink,
	Check,
	X,
	Clock,
	MessageSquare,
	Loader2,
	Github,
	Gitlab,
	Settings,
	AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';

interface PullRequest {
	id: number;
	number: number;
	title: string;
	body: string;
	state: 'open' | 'closed' | 'merged';
	author: string;
	createdAt: string;
	updatedAt: string;
	head: { ref: string; sha: string };
	base: { ref: string; sha: string };
	draft: boolean;
	mergeable?: boolean | null;
	reviewStatus?: 'approved' | 'changes_requested' | 'pending';
	webUrl: string;
}

interface PRProvider {
	name: 'github' | 'gitlab' | 'bitbucket';
	host: string;
	connected: boolean;
}

interface PullRequestIntegrationProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export function PullRequestIntegration({ open, onOpenChange }: PullRequestIntegrationProps) {
	const { activeRepo } = useAppStore();
	const [activeTab, setActiveTab] = useState<'list' | 'create' | 'settings'>('list');
	const [selectedPR, setSelectedPR] = useState<PullRequest | null>(null);
	
	// Create PR form state
	const [prTitle, setPrTitle] = useState('');
	const [prBody, setPrBody] = useState('');
	const [prHead, setPrHead] = useState('');
	const [prBase, setPrBase] = useState('main');
	const [prDraft, setPrDraft] = useState(false);

	// Get remote info
	const { data: remoteData } = trpc.git.remotes.useQuery(
		{ repo: activeRepo ?? '' },
		{ enabled: !!activeRepo && open }
	);

	// Get branches for dropdown
	const { data: branchData } = trpc.git.branches.useQuery(
		{ repo: activeRepo ?? '' },
		{ enabled: !!activeRepo && open }
	);

	// Detect PR provider from remote URL
	const provider = detectProvider(remoteData?.remotes?.find(r => r.name === 'origin')?.url);

	// Fetch PRs (simulated - would need actual API integration)
	const { data: prData, isLoading, refetch } = trpc.git.listPullRequests.useQuery(
		{ repo: activeRepo ?? '', provider: provider?.name ?? 'github' },
		{ enabled: !!activeRepo && open && activeTab === 'list' }
	);

	// Create PR mutation
	const createPRMutation = trpc.git.createPullRequest.useMutation({
		onSuccess: () => {
			toast.success('Pull request created successfully');
			setActiveTab('list');
			refetch();
			resetForm();
		},
		onError: (error) => {
			toast.error('Failed to create pull request', { description: error.message });
		},
	});

	const resetForm = () => {
		setPrTitle('');
		setPrBody('');
		setPrHead('');
		setPrBase('main');
		setPrDraft(false);
	};

	const handleCreatePR = () => {
		if (!prTitle || !prHead || !prBase) {
			toast.error('Please fill in all required fields');
			return;
		}

		createPRMutation.mutate({
			repo: activeRepo ?? '',
			provider: provider?.name ?? 'github',
			title: prTitle,
			body: prBody,
			head: prHead,
			base: prBase,
			draft: prDraft,
		});
	};

	const formatDate = (dateStr: string) => {
		const date = new Date(dateStr);
		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

		if (diffDays === 0) return 'Today';
		if (diffDays === 1) return 'Yesterday';
		if (diffDays < 7) return `${diffDays} days ago`;
		return date.toLocaleDateString();
	};

	const getStateColor = (state: string) => {
		switch (state) {
			case 'open': return 'bg-green-100 text-green-700';
			case 'closed': return 'bg-red-100 text-red-700';
			case 'merged': return 'bg-purple-100 text-purple-700';
			default: return 'bg-gray-100 text-gray-700';
		}
	};

	const getProviderIcon = (name: string) => {
		switch (name) {
			case 'github': return <Github className="h-4 w-4" />;
			case 'gitlab': return <Gitlab className="h-4 w-4" />;
			default: return <GitPullRequest className="h-4 w-4" />;
		}
	};

	const branches = branchData?.branches ?? [];
	const pullRequests = prData?.pullRequests ?? [];

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-4xl max-h-[90vh] flex flex-col ui-surface">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<GitPullRequest className="h-5 w-5" />
						Pull Requests
						{provider && (
							<Badge variant="outline" className="ml-2">
								{getProviderIcon(provider.name)}
								<span className="ml-1 capitalize">{provider.name}</span>
							</Badge>
						)}
					</DialogTitle>
				</DialogHeader>

				<Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} className="flex-1 flex flex-col">
					<TabsList className="grid w-full grid-cols-3">
						<TabsTrigger value="list">Open PRs</TabsTrigger>
						<TabsTrigger value="create">Create PR</TabsTrigger>
						<TabsTrigger value="settings">Settings</TabsTrigger>
					</TabsList>

					<TabsContent value="list" className="flex-1 mt-4">
						{isLoading ? (
							<div className="flex items-center justify-center py-8">
								<Loader2 className="h-6 w-6 animate-spin" />
							</div>
						) : !provider ? (
							<div className="text-center py-8">
								<AlertCircle className="h-12 w-12 mx-auto mb-4 text-amber-500" />
								<h3 className="font-medium mb-2">No Remote Detected</h3>
								<p className="text-sm text-muted-foreground mb-4">
									Add a remote origin to enable pull request integration.
								</p>
								<Button variant="outline" onClick={() => setActiveTab('settings')}>
									<Settings className="h-4 w-4 mr-2" />
									Configure
								</Button>
							</div>
						) : pullRequests.length === 0 ? (
							<div className="text-center py-8">
								<GitPullRequest className="h-12 w-12 mx-auto mb-4 opacity-50" />
								<h3 className="font-medium mb-2">No Pull Requests</h3>
								<p className="text-sm text-muted-foreground mb-4">
									There are no open pull requests for this repository.
								</p>
								<Button onClick={() => setActiveTab('create')}>
									<Plus className="h-4 w-4 mr-2" />
									Create Pull Request
								</Button>
							</div>
						) : (
							<ScrollArea className="flex-1">
								<div className="space-y-2">
									{pullRequests.map((pr) => (
										<div
											key={pr.id}
											className="p-4 rounded-lg border hover:bg-accent/50 cursor-pointer"
											onClick={() => setSelectedPR(pr)}
										>
											<div className="flex items-start gap-3">
												<div className={`flex items-center justify-center w-8 h-8 rounded-full ${
													pr.state === 'open' ? 'bg-green-100' :
													pr.state === 'merged' ? 'bg-purple-100' : 'bg-red-100'
												}`}>
													<GitPullRequest className={`h-4 w-4 ${
														pr.state === 'open' ? 'text-green-600' :
														pr.state === 'merged' ? 'text-purple-600' : 'text-red-600'
													}`} />
												</div>
												<div className="flex-1 min-w-0">
													<div className="flex items-center gap-2 mb-1">
														<span className="font-medium">#{pr.number}</span>
														<span className="truncate">{pr.title}</span>
														{pr.draft && (
															<Badge variant="outline" className="text-xs">Draft</Badge>
														)}
													</div>
													<div className="flex items-center gap-3 text-xs text-muted-foreground">
														<span className={`px-1.5 py-0.5 rounded text-xs ${getStateColor(pr.state)}`}>
															{pr.state}
														</span>
														<span>{pr.head.ref} → {pr.base.ref}</span>
														<span>by {pr.author}</span>
														<span>{formatDate(pr.createdAt)}</span>
													</div>
												</div>
												<Button
													variant="ghost"
													size="sm"
													onClick={(e) => {
														e.stopPropagation();
														window.open(pr.webUrl, '_blank');
													}}
												>
													<ExternalLink className="h-4 w-4" />
												</Button>
											</div>
										</div>
									))}
								</div>
							</ScrollArea>
						)}
					</TabsContent>

					<TabsContent value="create" className="flex-1 mt-4">
						<div className="space-y-4">
							<div className="grid grid-cols-2 gap-4">
								<div>
									<label className="text-sm font-medium mb-1.5 block">From Branch</label>
									<select
										className="w-full h-9 rounded-md border bg-transparent px-3 py-1 text-sm"
										value={prHead}
										onChange={(e) => setPrHead(e.target.value)}
									>
										<option value="">Select branch...</option>
										{branches.map((b) => (
											<option key={b.name} value={b.name}>{b.name}</option>
										))}
									</select>
								</div>
								<div>
									<label className="text-sm font-medium mb-1.5 block">Into Branch</label>
									<select
										className="w-full h-9 rounded-md border bg-transparent px-3 py-1 text-sm"
										value={prBase}
										onChange={(e) => setPrBase(e.target.value)}
									>
										{branches.filter(b => b.name === 'main' || b.name === 'master' || b.name === 'develop').map((b) => (
											<option key={b.name} value={b.name}>{b.name}</option>
										))}
									</select>
								</div>
							</div>

							<div>
								<label className="text-sm font-medium mb-1.5 block">Title *</label>
								<Input
									placeholder="Add a title for your pull request"
									value={prTitle}
									onChange={(e) => setPrTitle(e.target.value)}
								/>
							</div>

							<div>
								<label className="text-sm font-medium mb-1.5 block">Description</label>
								<Textarea
									placeholder="Describe your changes..."
									value={prBody}
									onChange={(e) => setPrBody(e.target.value)}
									className="min-h-[150px]"
								/>
							</div>

							<div className="flex items-center gap-2">
								<input
									type="checkbox"
									id="draft"
									checked={prDraft}
									onChange={(e) => setPrDraft(e.target.checked)}
									className="rounded"
								/>
								<label htmlFor="draft" className="text-sm">Create as draft</label>
							</div>

							<div className="flex justify-end gap-2 pt-4">
								<Button variant="outline" onClick={resetForm}>
									Clear
								</Button>
								<Button
									onClick={handleCreatePR}
									disabled={!prTitle || !prHead || createPRMutation.isPending}
								>
									{createPRMutation.isPending ? (
										<Loader2 className="h-4 w-4 mr-2 animate-spin" />
									) : (
										<GitPullRequest className="h-4 w-4 mr-2" />
									)}
									Create Pull Request
								</Button>
							</div>
						</div>
					</TabsContent>

					<TabsContent value="settings" className="flex-1 mt-4">
						<div className="space-y-6">
							<div>
								<h3 className="font-medium mb-2">Provider Configuration</h3>
								<p className="text-sm text-muted-foreground mb-4">
									Configure your Git hosting provider for pull request integration.
								</p>

								<div className="space-y-3">
									{(['github', 'gitlab', 'bitbucket'] as const).map((p) => (
										<div
											key={p}
											className={`p-4 rounded-lg border cursor-pointer transition-colors ${
												provider?.name === p ? 'border-primary bg-accent/50' : 'hover:bg-accent/30'
											}`}
										>
											<div className="flex items-center gap-3">
												{getProviderIcon(p)}
												<div className="flex-1">
													<span className="font-medium capitalize">{p}</span>
													<p className="text-xs text-muted-foreground">
														{provider?.name === p ? 'Detected from remote' : 'Not configured'}
													</p>
												</div>
												{provider?.name === p && (
													<Badge variant="outline">
														<Check className="h-3 w-3 mr-1 text-green-600" />
														Active
													</Badge>
												)}
											</div>
										</div>
									))}
								</div>
							</div>

							<div>
								<h3 className="font-medium mb-2">Authentication</h3>
								<p className="text-sm text-muted-foreground mb-4">
									To create and manage pull requests, you need to authenticate with your Git provider.
								</p>
								<Button variant="outline">
									<Settings className="h-4 w-4 mr-2" />
									Configure Token
								</Button>
							</div>
						</div>
					</TabsContent>
				</Tabs>
			</DialogContent>
		</Dialog>
	);
}

// Helper to detect provider from remote URL
function detectProvider(remoteUrl?: string): PRProvider | null {
	if (!remoteUrl) return null;

	const url = remoteUrl.toLowerCase();
	
	if (url.includes('github.com') || url.includes('github.com:')) {
		return { name: 'github', host: 'github.com', connected: true };
	}
	if (url.includes('gitlab.com') || url.includes('gitlab.com:')) {
		return { name: 'gitlab', host: 'gitlab.com', connected: true };
	}
	if (url.includes('bitbucket.org') || url.includes('bitbucket.org:')) {
		return { name: 'bitbucket', host: 'bitbucket.org', connected: true };
	}

	// Check for self-hosted instances
	if (url.includes('gitlab')) {
		return { name: 'gitlab', host: extractHost(url), connected: false };
	}
	if (url.includes('gitea') || url.includes('gogs')) {
		return { name: 'github', host: extractHost(url), connected: false }; // Use GitHub-compatible API
	}

	return null;
}

function extractHost(url: string): string {
	const match = url.match(/@([^:]+):|https?:\/\/([^\/]+)/);
	return match ? (match[1] || match[2]) : '';
}

export default PullRequestIntegration;
