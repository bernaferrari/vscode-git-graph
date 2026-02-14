/**
 * Commit Signing UI
 * GPG/SSH key selection for signed commits
 */

import { useState, useEffect } from 'react';
import { trpc } from '@/trpc/client';
import { useAppStore } from '@/lib/store';
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { AlertCircle, Key, Shield, Check, X } from 'lucide-react';

interface CommitSigningProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export function CommitSigningDialog({ open, onOpenChange }: CommitSigningProps) {
	const { activeRepo } = useAppStore();
	const [signingEnabled, setSigningEnabled] = useState(false);
	const [signingMethod, setSigningMethod] = useState<'gpg' | 'ssh'>('gpg');
	const [selectedKey, setSelectedKey] = useState<string>('');
	const [gpgKeys, setGpgKeys] = useState<Array<{ id: string; name: string; email: string }>>([]);
	const [sshKeys, setSshKeys] = useState<Array<{ id: string; path: string }>>([]);
	const [loading, setLoading] = useState(false);

	const { data: signingConfig } = trpc.git.getSigningConfig.useQuery(
		{ repo: activeRepo ?? '' },
		{ enabled: !!activeRepo && open }
	);

	useEffect(() => {
		if (signingConfig) {
			setSigningEnabled(signingConfig.enabled ?? false);
			setSigningMethod((signingConfig.method as 'gpg' | 'ssh') ?? 'gpg');
			setSelectedKey(signingConfig.key ?? '');
		}
	}, [signingConfig]);

	const handleSave = async () => {
		setLoading(true);
		try {
			// In a real implementation, this would call the backend to save the config
			await trpc.git.setSigningConfig.mutate({
				repo: activeRepo ?? '',
				enabled: signingEnabled,
				method: signingMethod,
				key: selectedKey,
			});
			onOpenChange(false);
		} catch (error) {
			console.error('Failed to save signing config:', error);
		} finally {
			setLoading(false);
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md ui-surface">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<Key className="h-5 w-5" />
						Commit Signing
					</DialogTitle>
				</DialogHeader>

				<div className="space-y-4 py-4">
					<div className="flex items-center justify-between">
						<div className="space-y-0.5">
							<Label htmlFor="signing-toggle">Enable Signing</Label>
							<p className="text-xs text-muted-foreground">
								Sign commits to verify authenticity
							</p>
						</div>
						<Switch
							id="signing-toggle"
							checked={signingEnabled}
							onCheckedChange={setSigningEnabled}
						/>
					</div>

					{signingEnabled && (
						<>
							<div className="space-y-2">
								<Label>Signing Method</Label>
								<Select
									value={signingMethod}
									onValueChange={(v) => setSigningMethod(v as 'gpg' | 'ssh')}
								>
									<SelectTrigger>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="gpg">
											<div className="flex items-center gap-2">
												<Shield className="h-4 w-4" />
												GPG Key
											</div>
										</SelectItem>
										<SelectItem value="ssh">
											<div className="flex items-center gap-2">
												<Key className="h-4 w-4" />
												SSH Key
											</div>
										</SelectItem>
									</SelectContent>
								</Select>
							</div>

							<div className="space-y-2">
								<Label>
									{signingMethod === 'gpg' ? 'GPG Key' : 'SSH Key'}
								</Label>
								<Select value={selectedKey} onValueChange={setSelectedKey}>
									<SelectTrigger>
										<SelectValue placeholder={`Select a ${signingMethod.toUpperCase()} key`} />
									</SelectTrigger>
									<SelectContent>
										{signingMethod === 'gpg' ? (
											gpgKeys.length > 0 ? (
												gpgKeys.map((key) => (
													<SelectItem key={key.id} value={key.id}>
														{key.name} ({key.email})
													</SelectItem>
												))
											) : (
												<SelectItem value="no-keys" disabled>
													No GPG keys found
												</SelectItem>
											)
										) : (
											sshKeys.length > 0 ? (
												sshKeys.map((key) => (
													<SelectItem key={key.id} value={key.id}>
														{key.path}
													</SelectItem>
												))
											) : (
												<SelectItem value="no-keys" disabled>
													No SSH keys found
												</SelectItem>
											)
										)}
									</SelectContent>
								</Select>
							</div>

							<div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
								<AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5" />
								<div className="text-xs text-amber-700 dark:text-amber-300">
									<p className="font-medium">Note:</p>
									<p>
										Make sure your {signingMethod.toUpperCase()} key is properly configured
										and added to your Git hosting provider for verified commits.
									</p>
								</div>
							</div>
						</>
					)}
				</div>

				<DialogFooter className="ui-toolbar">
					<Button variant="outline" onClick={() => onOpenChange(false)}>
						Cancel
					</Button>
					<Button onClick={handleSave} disabled={loading}>
						{loading ? (
							<span className="flex items-center gap-2">
								<span className="animate-spin">⏳</span>
								Saving...
							</span>
						) : (
							<span className="flex items-center gap-2">
								<Check className="h-4 w-4" />
								Save
							</span>
						)}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
