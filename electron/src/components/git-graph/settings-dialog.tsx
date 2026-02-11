/**
 * Settings/Preferences Dialog
 * Comprehensive app configuration
 */

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from '@/components/ui/tabs';
import {
	Settings,
	Globe,
	Palette,
	Keyboard,
	Bell,
	Shield,
	HardDrive,
	GitBranch,
	Check,
	Loader2,
	RotateCcw,
} from 'lucide-react';
import { toast } from 'sonner';

interface AppSettings {
	// General
	confirmDestructiveActions: boolean;
	autoFetchInterval: number;
	checkForUpdates: boolean;
	launchAtStartup: boolean;
	
	// Appearance
	theme: 'light' | 'dark' | 'system';
	graphTheme: 'default' | 'colorful' | 'minimal';
	commitMessageLength: number;
	showAvatars: boolean;
	showRelativeDates: boolean;
	dateFormat: 'relative' | 'iso' | 'locale';
	
	// Editor
	commitTemplate: string;
	autoSignCommits: boolean;
	defaultBranch: string;
	mergeTool: string;
	
	// Notifications
	notifyOnPush: boolean;
	notifyOnPull: boolean;
	notifyOnMerge: boolean;
	soundEnabled: boolean;
	
	// Performance
	maxCommits: number;
	enableVirtualization: boolean;
	lazyLoadImages: boolean;
	
	// Privacy
	telemetryEnabled: boolean;
	crashReports: boolean;
}

const DEFAULT_SETTINGS: AppSettings = {
	confirmDestructiveActions: true,
	autoFetchInterval: 5,
	checkForUpdates: true,
	launchAtStartup: false,
	theme: 'system',
	graphTheme: 'default',
	commitMessageLength: 72,
	showAvatars: true,
	showRelativeDates: true,
	dateFormat: 'relative',
	commitTemplate: '',
	autoSignCommits: false,
	defaultBranch: 'main',
	mergeTool: '',
	notifyOnPush: true,
	notifyOnPull: true,
	notifyOnMerge: true,
	soundEnabled: false,
	maxCommits: 1000,
	enableVirtualization: true,
	lazyLoadImages: true,
	telemetryEnabled: false,
	crashReports: true,
};

const STORAGE_KEY = 'git-graph-settings';

export function useSettings() {
	const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);

	useEffect(() => {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (stored) {
			try {
				setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(stored) });
			} catch {
				setSettings(DEFAULT_SETTINGS);
			}
		}
	}, []);

	useEffect(() => {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
	}, [settings]);

	const updateSetting = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
		setSettings(prev => ({ ...prev, [key]: value }));
	};

	const resetSettings = () => {
		setSettings(DEFAULT_SETTINGS);
		toast.success('Settings reset to defaults');
	};

	return { settings, updateSetting, resetSettings };
}

interface SettingsDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
	const { settings, updateSetting, resetSettings } = useSettings();
	const [activeTab, setActiveTab] = useState('general');

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<Settings className="h-5 w-5" />
						Settings
					</DialogTitle>
				</DialogHeader>

				<Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
					<TabsList className="grid grid-cols-6 w-full">
						<TabsTrigger value="general">General</TabsTrigger>
						<TabsTrigger value="appearance">Appearance</TabsTrigger>
						<TabsTrigger value="editor">Editor</TabsTrigger>
						<TabsTrigger value="notifications">Notify</TabsTrigger>
						<TabsTrigger value="performance">Performance</TabsTrigger>
						<TabsTrigger value="privacy">Privacy</TabsTrigger>
					</TabsList>

					<ScrollArea className="flex-1 mt-4">
						<TabsContent value="general" className="space-y-6 m-0">
							<SettingsSection title="General" icon={<Settings className="h-4 w-4" />}>
								<SettingRow
									label="Confirm destructive actions"
									description="Ask for confirmation before destructive operations"
								>
									<Switch
										checked={settings.confirmDestructiveActions}
										onCheckedChange={(v) => updateSetting('confirmDestructiveActions', v)}
									/>
								</SettingRow>
								<SettingRow
									label="Auto-fetch interval"
									description="Automatically fetch from remotes (minutes, 0 to disable)"
								>
									<Input
										type="number"
										min={0}
										max={60}
										className="w-20"
										value={settings.autoFetchInterval}
										onChange={(e) => updateSetting('autoFetchInterval', parseInt(e.target.value) || 0)}
									/>
								</SettingRow>
								<SettingRow
									label="Check for updates"
									description="Automatically check for app updates"
								>
									<Switch
										checked={settings.checkForUpdates}
										onCheckedChange={(v) => updateSetting('checkForUpdates', v)}
									/>
								</SettingRow>
								<SettingRow
									label="Launch at startup"
									description="Start Git Graph when you log in"
								>
									<Switch
										checked={settings.launchAtStartup}
										onCheckedChange={(v) => updateSetting('launchAtStartup', v)}
									/>
								</SettingRow>
							</SettingsSection>
						</TabsContent>

						<TabsContent value="appearance" className="space-y-6 m-0">
							<SettingsSection title="Theme" icon={<Palette className="h-4 w-4" />}>
								<SettingRow label="Color theme" description="Choose light, dark, or follow system">
									<select
										className="h-9 rounded-md border bg-transparent px-3 py-1 text-sm"
										value={settings.theme}
										onChange={(e) => updateSetting('theme', e.target.value as typeof settings.theme)}
									>
										<option value="system">System</option>
										<option value="light">Light</option>
										<option value="dark">Dark</option>
									</select>
								</SettingRow>
								<SettingRow label="Graph theme" description="Visual style for commit graph">
									<select
										className="h-9 rounded-md border bg-transparent px-3 py-1 text-sm"
										value={settings.graphTheme}
										onChange={(e) => updateSetting('graphTheme', e.target.value as typeof settings.graphTheme)}
									>
										<option value="default">Default</option>
										<option value="colorful">Colorful</option>
										<option value="minimal">Minimal</option>
									</select>
								</SettingRow>
							</SettingsSection>

							<SettingsSection title="Display" icon={<Globe className="h-4 w-4" />}>
								<SettingRow
									label="Show avatars"
									description="Display author avatars in commits"
								>
									<Switch
										checked={settings.showAvatars}
										onCheckedChange={(v) => updateSetting('showAvatars', v)}
									/>
								</SettingRow>
								<SettingRow
									label="Show relative dates"
									description="Use '2 days ago' instead of full dates"
								>
									<Switch
										checked={settings.showRelativeDates}
										onCheckedChange={(v) => updateSetting('showRelativeDates', v)}
									/>
								</SettingRow>
								<SettingRow label="Date format" description="How to display dates">
									<select
										className="h-9 rounded-md border bg-transparent px-3 py-1 text-sm"
										value={settings.dateFormat}
										onChange={(e) => updateSetting('dateFormat', e.target.value as typeof settings.dateFormat)}
									>
										<option value="relative">Relative</option>
										<option value="iso">ISO (YYYY-MM-DD)</option>
										<option value="locale">Locale</option>
									</select>
								</SettingRow>
								<SettingRow
									label="Commit message length"
									description="Max characters before truncating (0 = no limit)"
								>
									<Input
										type="number"
										min={0}
										max={200}
										className="w-20"
										value={settings.commitMessageLength}
										onChange={(e) => updateSetting('commitMessageLength', parseInt(e.target.value) || 0)}
									/>
								</SettingRow>
							</SettingsSection>
						</TabsContent>

						<TabsContent value="editor" className="space-y-6 m-0">
							<SettingsSection title="Commit" icon={<GitBranch className="h-4 w-4" />}>
								<SettingRow
									label="Default branch name"
									description="Name for new repositories' default branch"
								>
									<Input
										className="w-32"
										value={settings.defaultBranch}
										onChange={(e) => updateSetting('defaultBranch', e.target.value)}
									/>
								</SettingRow>
								<SettingRow
									label="Auto-sign commits"
									description="Automatically sign commits with GPG/SSH key"
								>
									<Switch
										checked={settings.autoSignCommits}
										onCheckedChange={(v) => updateSetting('autoSignCommits', v)}
									/>
								</SettingRow>
								<SettingRow
									label="Commit template"
									description="Default template for new commit messages"
								>
									<textarea
										className="w-full h-20 rounded-md border bg-transparent px-3 py-2 text-sm resize-none"
										placeholder="feat: &#10;&#10;"
										value={settings.commitTemplate}
										onChange={(e) => updateSetting('commitTemplate', e.target.value)}
									/>
								</SettingRow>
							</SettingsSection>

							<SettingsSection title="External Tools" icon={<HardDrive className="h-4 w-4" />}>
								<SettingRow
									label="Merge tool"
									description="External tool for resolving merge conflicts"
								>
									<Input
										className="w-48"
										placeholder="e.g., code --wait"
										value={settings.mergeTool}
										onChange={(e) => updateSetting('mergeTool', e.target.value)}
									/>
								</SettingRow>
							</SettingsSection>
						</TabsContent>

						<TabsContent value="notifications" className="space-y-6 m-0">
							<SettingsSection title="Notifications" icon={<Bell className="h-4 w-4" />}>
								<SettingRow
									label="Push notifications"
									description="Notify when push completes"
								>
									<Switch
										checked={settings.notifyOnPush}
										onCheckedChange={(v) => updateSetting('notifyOnPush', v)}
									/>
								</SettingRow>
								<SettingRow
									label="Pull notifications"
									description="Notify when pull completes"
								>
									<Switch
										checked={settings.notifyOnPull}
										onCheckedChange={(v) => updateSetting('notifyOnPull', v)}
									/>
								</SettingRow>
								<SettingRow
									label="Merge notifications"
									description="Notify when merge completes"
								>
									<Switch
										checked={settings.notifyOnMerge}
										onCheckedChange={(v) => updateSetting('notifyOnMerge', v)}
									/>
								</SettingRow>
								<SettingRow
									label="Sound effects"
									description="Play sounds for notifications"
								>
									<Switch
										checked={settings.soundEnabled}
										onCheckedChange={(v) => updateSetting('soundEnabled', v)}
									/>
								</SettingRow>
							</SettingsSection>
						</TabsContent>

						<TabsContent value="performance" className="space-y-6 m-0">
							<SettingsSection title="Performance" icon={<HardDrive className="h-4 w-4" />}>
								<SettingRow
									label="Max commits to load"
									description="Limit commits loaded for large repos"
								>
									<Input
										type="number"
										min={100}
										max={10000}
										step={100}
										className="w-24"
										value={settings.maxCommits}
										onChange={(e) => updateSetting('maxCommits', parseInt(e.target.value) || 1000)}
									/>
								</SettingRow>
								<SettingRow
									label="Enable virtualization"
									description="Use virtual scrolling for better performance"
								>
									<Switch
										checked={settings.enableVirtualization}
										onCheckedChange={(v) => updateSetting('enableVirtualization', v)}
									/>
								</SettingRow>
								<SettingRow
									label="Lazy load images"
									description="Defer loading images until needed"
								>
									<Switch
										checked={settings.lazyLoadImages}
										onCheckedChange={(v) => updateSetting('lazyLoadImages', v)}
									/>
								</SettingRow>
							</SettingsSection>
						</TabsContent>

						<TabsContent value="privacy" className="space-y-6 m-0">
							<SettingsSection title="Privacy" icon={<Shield className="h-4 w-4" />}>
								<SettingRow
									label="Usage telemetry"
									description="Send anonymous usage data to help improve the app"
								>
									<Switch
										checked={settings.telemetryEnabled}
										onCheckedChange={(v) => updateSetting('telemetryEnabled', v)}
									/>
								</SettingRow>
								<SettingRow
									label="Crash reports"
									description="Automatically send crash reports"
								>
									<Switch
										checked={settings.crashReports}
										onCheckedChange={(v) => updateSetting('crashReports', v)}
									/>
								</SettingRow>
							</SettingsSection>
						</TabsContent>
					</ScrollArea>
				</Tabs>

				<div className="flex items-center justify-between pt-4 border-t">
					<Button variant="outline" onClick={resetSettings}>
						<RotateCcw className="h-4 w-4 mr-2" />
						Reset to Defaults
					</Button>
					<Button onClick={() => onOpenChange(false)}>
						Done
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	);
}

function SettingsSection({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
	return (
		<div className="space-y-4">
			<div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
				{icon}
				{title}
			</div>
			<div className="space-y-3 pl-6">
				{children}
			</div>
		</div>
	);
}

function SettingRow({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) {
	return (
		<div className="flex items-center justify-between py-2">
			<div className="flex-1 pr-4">
				<div className="text-sm font-medium">{label}</div>
				{description && (
					<div className="text-xs text-muted-foreground">{description}</div>
				)}
			</div>
			<div className="shrink-0">
				{children}
			</div>
		</div>
	);
}

export default SettingsDialog;
