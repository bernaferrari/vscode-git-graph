/**
 * Commit Signing Configuration
 */

import { useState, useEffect } from 'react';
import { trpc } from '@/trpc/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface SigningConfigProps {
	repo: string;
}

export function SigningConfig({ repo }: SigningConfigProps) {
	const utils = trpc.useUtils();
	const { data: signingStatus } = trpc.git.signing.status.useQuery(
		{ repo },
		{ enabled: !!repo }
	);

	const setSigningMutation = trpc.git.signing.configure.useMutation({
		onSuccess: () => utils.git.signing.status.invalidate(),
	});

	const [signingEnabled, setSigningEnabled] = useState(false);
	const [signingMethod, setSigningMethod] = useState<'gpg' | 'ssh'>('gpg');
	const [signingKey, setSigningKey] = useState('');
	const [gpgProgram, setGpgProgram] = useState('');
	const [allowedSignersFile, setAllowedSignersFile] = useState('');

	useEffect(() => {
		if (signingStatus) {
			setSigningEnabled(signingStatus.enabled ?? false);
			setSigningMethod((signingStatus.method as 'gpg' | 'ssh') ?? 'gpg');
			setSigningKey(signingStatus.key ?? '');
			setGpgProgram(signingStatus.gpgProgram ?? '');
			setAllowedSignersFile(signingStatus.allowedSignersFile ?? '');
		}
	}, [signingStatus]);

	const handleSave = (global: boolean) => {
		setSigningMutation.mutate({
			repo,
			enabled: signingEnabled,
			method: signingMethod,
			key: signingKey || undefined,
			gpgProgram: gpgProgram || undefined,
			allowedSignersFile: signingMethod === 'ssh' ? allowedSignersFile || undefined : undefined,
			global,
		});
	};

	const gpgKeys = signingStatus?.gpgKeys ?? [];
	const sshKeys = signingStatus?.sshKeys ?? [];
	const hasSigningKey = signingKey.trim().length > 0;
	const canSave = !signingEnabled || hasSigningKey;

	return (
		<Card>
			<CardHeader className="pb-2">
				<CardTitle className="text-sm flex items-center justify-between">
					<span>Commit Signing</span>
					{signingEnabled && (
						<span className="text-xs text-green-600">Enabled</span>
					)}
				</CardTitle>
			</CardHeader>
			<CardContent className="space-y-4">
				{/* Enable signing */}
				<div className="flex items-center justify-between">
					<Label className="text-xs">Sign commits</Label>
					<Switch
						checked={signingEnabled}
						onCheckedChange={setSigningEnabled}
					/>
				</div>

				{signingEnabled && (
					<>
						{/* Signing method */}
						<div className="space-y-2">
							<Label className="text-xs">Signing Method</Label>
							<Select
								value={signingMethod}
								onValueChange={(v) => v && setSigningMethod(v as 'gpg' | 'ssh')}
							>
								<SelectTrigger className="h-8">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="gpg">GPG</SelectItem>
									<SelectItem value="ssh">SSH</SelectItem>
								</SelectContent>
							</Select>
						</div>

						{/* GPG specific options */}
						{signingMethod === 'gpg' && (
							<>
								<div className="space-y-2">
									<Label className="text-xs">GPG Key</Label>
									{gpgKeys.length > 0 ? (
										<Select
											value={signingKey}
											onValueChange={(v) => v && setSigningKey(v)}
										>
											<SelectTrigger className="h-8">
												<SelectValue placeholder="Select a GPG key..." />
											</SelectTrigger>
											<SelectContent>
												{gpgKeys.map((key: { id: string; userId: string }) => (
													<SelectItem key={key.id} value={key.id}>
														{key.id.slice(-16)} - {key.userId}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									) : (
										<Input
											value={signingKey}
											onChange={(e) => setSigningKey(e.target.value)}
											placeholder="Enter GPG key ID..."
											className="h-8"
										/>
									)}
								</div>

								<div className="space-y-2">
									<Label className="text-xs">GPG Program (optional)</Label>
									<Input
										value={gpgProgram}
										onChange={(e) => setGpgProgram(e.target.value)}
										placeholder="/usr/bin/gpg"
										className="h-8"
									/>
								</div>
							</>
						)}

						{/* SSH specific options */}
						{signingMethod === 'ssh' && (
							<>
								{sshKeys.length > 0 && (
									<div className="space-y-2">
										<Label className="text-xs">Discovered SSH Public Keys</Label>
										<Select
											value={signingKey}
											onValueChange={(v) => v && setSigningKey(v)}
										>
											<SelectTrigger className="h-8">
												<SelectValue placeholder="Select an SSH key..." />
											</SelectTrigger>
											<SelectContent>
												{sshKeys.map((key: { path: string; fileName: string; algorithm: string; comment?: string | null; fingerprint?: string | null }) => (
													<SelectItem key={key.path} value={key.path}>
														{key.fileName} ({key.algorithm})
														{key.comment ? ` - ${key.comment}` : ''}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</div>
								)}

								<div className="space-y-2">
									<Label className="text-xs">SSH Public Key Path</Label>
									<Input
										value={signingKey}
										onChange={(e) => setSigningKey(e.target.value)}
										placeholder="~/.ssh/id_ed25519.pub"
										className="h-8"
									/>
								</div>

								<div className="space-y-2">
									<Label className="text-xs">Allowed Signers File (optional)</Label>
									<Input
										value={allowedSignersFile}
										onChange={(e) => setAllowedSignersFile(e.target.value)}
										placeholder="~/.config/git/allowed_signers"
										className="h-8"
									/>
								</div>

								<p className="text-xs text-muted-foreground">
									Use an allowed signers file to verify SSH-signed commits locally.
								</p>
							</>
						)}
					</>
				)}

				{/* Save buttons */}
				<div className="flex gap-2">
					<Button
						size="sm"
						onClick={() => handleSave(false)}
						disabled={setSigningMutation.isPending || !canSave}
					>
						Save for Repo
					</Button>
					<Button
						variant="outline"
						size="sm"
						onClick={() => handleSave(true)}
						disabled={setSigningMutation.isPending || !canSave}
					>
						Save Global
					</Button>
				</div>

				{signingEnabled && !hasSigningKey && (
					<Alert variant="destructive">
						<AlertDescription className="text-xs">
							A signing key is required while commit signing is enabled.
						</AlertDescription>
					</Alert>
				)}

				{signingStatus?.error && (
					<Alert variant="destructive">
						<AlertDescription className="text-xs">
							{signingStatus.error}
						</AlertDescription>
					</Alert>
				)}
			</CardContent>
		</Card>
	);
}
