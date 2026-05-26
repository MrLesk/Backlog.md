import React, { useState, useEffect, useMemo } from 'react';
import { apiClient } from '../lib/api';
import { SuccessToast } from './SuccessToast';
import type { BacklogConfig, BoardConfig, StatusCallbackCapabilities } from '../../types';
import { buildBoardEditorRows, type BoardEditorRow } from '../../utils/build-board-editor-rows';

const Settings: React.FC = () => {
	const [config, setConfig] = useState<BacklogConfig | null>(null);
	const [originalConfig, setOriginalConfig] = useState<BacklogConfig | null>(null);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [showSuccess, setShowSuccess] = useState(false);
	const [statuses, setStatuses] = useState<string[]>([]);
	const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
	const [callbackCapabilities, setCallbackCapabilities] = useState<StatusCallbackCapabilities | null>(null);

	useEffect(() => {
		loadConfig();
		loadStatuses();
		loadCallbackCapabilities();
	}, []);

	const loadCallbackCapabilities = async () => {
		try {
			const status = await apiClient.checkStatus();
			if (status.statusCallbackCapabilities) {
				setCallbackCapabilities(status.statusCallbackCapabilities);
			}
		} catch {
			// Capability surface is optional UX; missing it is not a blocker for saving.
		}
	};

	const loadConfig = async () => {
		try {
			setLoading(true);
			const data = await apiClient.fetchConfig();
			setConfig(data);
			setOriginalConfig(data);
			setError(null);
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to load configuration');
		} finally {
			setLoading(false);
		}
	};

	const loadStatuses = async () => {
		try {
			const data = await apiClient.fetchStatuses();
			setStatuses(data);
		} catch (err) {
			console.error('Failed to load statuses:', err);
		}
	};

	const handleInputChange = (field: keyof BacklogConfig, value: any) => {
		if (!config) return;
		
		setConfig({
			...config,
			[field]: value
		});

		// Clear validation error for this field
		if (validationErrors[field]) {
			setValidationErrors({
				...validationErrors,
				[field]: ''
			});
		}
	};

	const normalizeDefinitionOfDone = (items: string[] | undefined): string[] | undefined => {
		const normalized = (items ?? []).map((item) => item.trim()).filter((item) => item.length > 0);
		return normalized.length > 0 ? normalized : undefined;
	};

	const validateConfig = (): boolean => {
		const errors: Record<string, string> = {};

		if (!config) return false;

		// Validate project name
		if (!config.projectName.trim()) {
			errors.projectName = 'Project name is required';
		}

		// Validate port number
		if (config.defaultPort && (config.defaultPort < 1 || config.defaultPort > 65535)) {
			errors.defaultPort = 'Port must be between 1 and 65535';
		}


		setValidationErrors(errors);
		return Object.keys(errors).length === 0;
	};

	const handleSave = async () => {
		if (!config || !validateConfig()) return;

		try {
			setSaving(true);
			const normalizedConfig = {
				...config,
				definitionOfDone: normalizeDefinitionOfDone(config.definitionOfDone),
			};
			await apiClient.updateConfig(normalizedConfig);
			setConfig(normalizedConfig);
			setOriginalConfig(normalizedConfig);
			setShowSuccess(true);
			setTimeout(() => setShowSuccess(false), 3000);
			setError(null);
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to save configuration');
		} finally {
			setSaving(false);
		}
	};

	const handleCancel = () => {
		setConfig(originalConfig);
		setValidationErrors({});
	};

	const hasUnsavedChanges = JSON.stringify(config) !== JSON.stringify(originalConfig);

	if (loading) {
		return (
			<div className="container mx-auto px-4 py-8">
				<div className="flex items-center justify-center py-12">
					<div className="text-lg text-gray-600 dark:text-gray-300">Loading settings...</div>
				</div>
			</div>
		);
	}

	if (!config) {
		return (
			<div className="container mx-auto px-4 py-8">
				<div className="flex items-center justify-center py-12">
					<div className="text-red-600 dark:text-red-400">Failed to load configuration</div>
				</div>
			</div>
		);
	}

	return (
		<div className="container mx-auto px-4 py-8 transition-colors duration-200">
			<div className="max-w-4xl mx-auto">
				<h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-8">Settings</h1>

				{error && (
					<div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg">
						<p className="text-sm text-red-700 dark:text-red-400">{error}</p>
					</div>
				)}

				<div className="space-y-8">
					{/* Project Settings */}
					<div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
						<h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Project Settings</h2>
						<div className="space-y-4">
							<div>
								<label htmlFor="projectName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
									Project Name
								</label>
								<input
									id="projectName"
									type="text"
									value={config.projectName}
									onChange={(e) => handleInputChange('projectName', e.target.value)}
									className={`w-full px-3 py-2 border rounded-lg text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-stone-500 dark:focus:ring-stone-400 transition-colors duration-200 ${
										validationErrors.projectName 
											? 'border-red-500 dark:border-red-400' 
											: 'border-gray-300 dark:border-gray-600'
									}`}
								/>
								{validationErrors.projectName && (
									<p className="mt-1 text-sm text-red-600 dark:text-red-400">{validationErrors.projectName}</p>
								)}
							</div>

							<div>
								<label htmlFor="dateFormat" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
									Date Format
								</label>
								<select
									id="dateFormat"
									value={config.dateFormat}
									onChange={(e) => handleInputChange('dateFormat', e.target.value)}
									className="w-full h-10 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-stone-500 dark:focus:ring-stone-400 transition-colors duration-200"
								>
									<option value="yyyy-mm-dd">yyyy-mm-dd</option>
									<option value="dd/mm/yyyy">dd/mm/yyyy</option>
									<option value="mm/dd/yyyy">mm/dd/yyyy</option>
								</select>
							</div>
						</div>
					</div>

					{/* Board Columns */}
					<BoardColumnsSection
						statuses={config.statuses}
						board={config.board}
						onChange={(next) => handleInputChange('board', next)}
					/>

					{/* Workflow Settings */}
					<div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
						<h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Workflow Settings</h2>
						<div className="space-y-4">
							<div>
								<label className="flex items-center justify-between">
									<div>
										<span className="text-sm font-medium text-gray-700 dark:text-gray-300">Auto Commit</span>
										<p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
											Automatically commit changes to Git after task operations
										</p>
									</div>
									<div className="relative inline-flex items-center cursor-pointer">
										<input
											type="checkbox"
											checked={config.autoCommit}
											onChange={(e) => handleInputChange('autoCommit', e.target.checked)}
											className="sr-only peer"
										/>
										<div className="w-11 h-6 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-circle peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-circle after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500"></div>
									</div>
								</label>
							</div>

							<div>
								<label className="flex items-center justify-between">
									<div>
										<span className="text-sm font-medium text-gray-700 dark:text-gray-300">Remote Operations</span>
										<p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
											Fetch tasks information from remote branches
										</p>
									</div>
									<div className="relative inline-flex items-center cursor-pointer">
										<input
											type="checkbox"
											checked={config.remoteOperations}
											onChange={(e) => handleInputChange('remoteOperations', e.target.checked)}
											className="sr-only peer"
										/>
										<div className="w-11 h-6 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-circle peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-circle after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500"></div>
									</div>
								</label>
							</div>

							<div>
								<label htmlFor="defaultStatus" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
									Default Status
								</label>
								<select
									id="defaultStatus"
									value={config.defaultStatus}
									onChange={(e) => handleInputChange('defaultStatus', e.target.value)}
									className="w-full h-10 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-stone-500 dark:focus:ring-stone-400 transition-colors duration-200"
								>
									{statuses.map(status => (
										<option key={status} value={status}>{status}</option>
									))}
								</select>
								<p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
									Default status for new tasks
								</p>
							</div>

							<div>
								<label htmlFor="defaultEditor" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
									Default Editor
								</label>
								<input
									id="defaultEditor"
									type="text"
									value={config.defaultEditor}
									onChange={(e) => handleInputChange('defaultEditor', e.target.value)}
									className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-stone-500 dark:focus:ring-stone-400 transition-colors duration-200"
									placeholder="e.g., vim, nano, code"
								/>
								<p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
									Editor command to use for editing tasks (overrides EDITOR environment variable)
								</p>
							</div>
						</div>
					</div>

					{/* Status Change Callback */}
					<div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
						<h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Status Change Callback</h2>
						<p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
							Shell command run whenever a task's status changes. Receives <code className="text-xs">$TASK_ID</code>,{' '}
							<code className="text-xs">$OLD_STATUS</code>, <code className="text-xs">$NEW_STATUS</code>, and{' '}
							<code className="text-xs">$TASK_TITLE</code> as environment variables. Per-task overrides live on each
							task's "Advanced" panel.
						</p>
						<div className="space-y-4">
							<div>
								<label
									htmlFor="onStatusChange"
									className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
								>
									Command
								</label>
								<textarea
									id="onStatusChange"
									rows={3}
									value={config.onStatusChange ?? ''}
									onChange={(e) => handleInputChange('onStatusChange', e.target.value || undefined)}
									placeholder={`if [ "$NEW_STATUS" = "In Progress" ]; then claude "Task $TASK_ID has been assigned to you. Please implement it." & fi`}
									className="w-full px-3 py-2 font-mono text-sm border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-stone-500 dark:focus:ring-stone-400 transition-colors duration-200"
								/>
								<p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
									Leave empty to disable.
								</p>
							</div>

							<div>
								<label
									htmlFor="shell"
									className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
								>
									Shell
								</label>
								<select
									id="shell"
									value={config.shell ?? 'auto'}
									onChange={(e) => handleInputChange('shell', e.target.value === 'auto' ? undefined : e.target.value)}
									className="w-full h-10 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-stone-500 dark:focus:ring-stone-400 transition-colors duration-200"
								>
									<option value="auto">auto (recommended)</option>
									{(
										[
											{ value: 'sh', label: 'sh' },
											{ value: 'bash', label: 'bash' },
											{ value: 'cmd', label: 'cmd (Windows)' },
											{ value: 'pwsh', label: 'pwsh (PowerShell 7+)' },
											{ value: 'powershell', label: 'powershell (Windows PowerShell)' },
										] as const
									).map((opt) => {
										const availability = callbackCapabilities?.shellAvailability?.[opt.value];
										const installed = availability !== false;
										return (
											<option key={opt.value} value={opt.value} disabled={!installed}>
												{opt.label}{!installed ? ' — not installed' : ''}
											</option>
										);
									})}
								</select>
								<p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
									Interpreter used to execute the command. <code className="text-xs">auto</code> picks <code className="text-xs">sh</code> on POSIX and prefers <code className="text-xs">sh.exe</code> on Windows (falling back to <code className="text-xs">cmd.exe</code> if not installed). Note: env-var syntax depends on the shell —{' '}
									<code className="text-xs">$TASK_ID</code> on sh/bash, <code className="text-xs">%TASK_ID%</code> on cmd,{' '}
									<code className="text-xs">$env:TASK_ID</code> on PowerShell.
								</p>
								{config.shell &&
									callbackCapabilities?.shellAvailability?.[config.shell] === false && (
										<p className="mt-2 text-sm text-amber-700 dark:text-amber-300">
											The selected shell <code className="text-xs">{config.shell}</code> is not installed on the server. Status-change hooks will fail until you switch to one of the available shells.
										</p>
									)}
							</div>

							{callbackCapabilities && (
								<div
									className={`p-3 rounded-md text-sm border ${
										callbackCapabilities.willFallbackToCmd
											? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700 text-amber-800 dark:text-amber-200'
											: 'bg-gray-50 dark:bg-gray-900/40 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300'
									}`}
								>
									<div className="font-medium mb-1">Server runtime</div>
									<div className="text-xs">
										Platform: <code>{callbackCapabilities.platform}</code>
										<span className="mx-2">·</span>
										Resolved: <code>{callbackCapabilities.resolvedShell.join(' ')}</code>
									</div>
									{callbackCapabilities.willFallbackToCmd && (
										<div className="text-xs mt-2">
											No POSIX <code>sh</code> found on the server. Commands will execute through <code>cmd.exe</code>; POSIX syntax in the command above may not work. Install Git for Windows or change the shell setting.
										</div>
									)}
								</div>
							)}
						</div>
					</div>

					{/* Definition of Done Defaults */}
					<div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
						<h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Definition of Done Defaults</h2>
						<p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
							These checklist items are added to new tasks by default.
						</p>
						<div className="space-y-3">
							{(config.definitionOfDone ?? []).map((item, index) => (
								<div key={`definition-of-done-${index}`} className="flex items-center gap-2">
									<input
										type="text"
										value={item}
										onChange={(e) => {
											const next = [...(config.definitionOfDone ?? [])];
											next[index] = e.target.value;
											handleInputChange('definitionOfDone', next);
										}}
										className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-stone-500 dark:focus:ring-stone-400 transition-colors duration-200"
										placeholder="Checklist item"
									/>
									<button
										type="button"
										onClick={() => {
											const next = (config.definitionOfDone ?? []).filter((_, idx) => idx !== index);
											handleInputChange('definitionOfDone', next);
										}}
										className="px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:underline"
									>
										Remove
									</button>
								</div>
							))}
							<button
								type="button"
								onClick={() => handleInputChange('definitionOfDone', [...(config.definitionOfDone ?? []), ""])}
								className="inline-flex items-center px-3 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
							>
								+ Add item
							</button>
						</div>
					</div>

					{/* Web UI Settings */}
					<div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
						<h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Web UI Settings</h2>
						<div className="space-y-4">
							<div>
								<label htmlFor="defaultPort" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
									Default Port
								</label>
								<input
									id="defaultPort"
									type="number"
									min="1"
									max="65535"
									value={config.defaultPort || 6420}
									onChange={(e) => handleInputChange('defaultPort', parseInt(e.target.value) || 6420)}
									className={`w-full px-3 py-2 border rounded-lg text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-stone-500 dark:focus:ring-stone-400 transition-colors duration-200 ${
										validationErrors.defaultPort 
											? 'border-red-500 dark:border-red-400' 
											: 'border-gray-300 dark:border-gray-600'
									}`}
								/>
								{validationErrors.defaultPort && (
									<p className="mt-1 text-sm text-red-600 dark:text-red-400">{validationErrors.defaultPort}</p>
								)}
							</div>

							<div>
								<label className="flex items-center justify-between">
									<div>
										<span className="text-sm font-medium text-gray-700 dark:text-gray-300">Auto Open Browser</span>
										<p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
											Automatically open browser when starting web UI
										</p>
									</div>
									<div className="relative inline-flex items-center cursor-pointer">
										<input
											type="checkbox"
											checked={config.autoOpenBrowser}
											onChange={(e) => handleInputChange('autoOpenBrowser', e.target.checked)}
											className="sr-only peer"
										/>
										<div className="w-11 h-6 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-circle peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-circle after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500"></div>
									</div>
								</label>
							</div>
						</div>
					</div>

					{/* Advanced Settings */}
					<div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
						<h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Advanced Settings</h2>
						<div className="space-y-4">
							<div>
								<label htmlFor="maxColumnWidth" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
									Max Column Width
								</label>
								<input
									id="maxColumnWidth"
									type="number"
									min="20"
									max="200"
									value={config.maxColumnWidth}
									onChange={(e) => handleInputChange('maxColumnWidth', parseInt(e.target.value) || 80)}
									className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-stone-500 dark:focus:ring-stone-400 transition-colors duration-200"
								/>
								<p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
									Maximum width for text columns in CLI output
								</p>
							</div>

							<div>
								<label htmlFor="taskResolutionStrategy" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
									Task Resolution Strategy
								</label>
								<select
									id="taskResolutionStrategy"
									value={config.taskResolutionStrategy}
									onChange={(e) => handleInputChange('taskResolutionStrategy', e.target.value as 'most_recent' | 'most_progressed')}
									className="w-full h-10 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-stone-500 dark:focus:ring-stone-400 transition-colors duration-200"
								>
									<option value="most_recent">Most Recent</option>
									<option value="most_progressed">Most Progressed</option>
								</select>
								<p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
									Strategy for resolving conflicts when tasks exist in multiple branches
								</p>
							</div>

							<div>
								<label htmlFor="zeroPaddedIds" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
									Zero-Padded IDs
								</label>
								<input
									id="zeroPaddedIds"
									type="number"
									min="0"
									max="10"
									value={config.zeroPaddedIds || 0}
									onChange={(e) => handleInputChange('zeroPaddedIds', parseInt(e.target.value) || 0)}
									className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-stone-500 dark:focus:ring-stone-400 transition-colors duration-200"
								/>
								<p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
									Number of digits for ID padding (0 = disabled, 3 = task-001, 4 = task-0001)
								</p>
							</div>

							<div>
								<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
									Task Prefix <span className="text-gray-400 dark:text-gray-500 font-normal">(read-only)</span>
								</label>
								<input
									type="text"
									value={(config.prefixes?.task || 'task').toUpperCase()}
									disabled
									className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 cursor-not-allowed"
								/>
								<p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
									Set during initialization. Cannot be changed to avoid breaking existing task IDs.
								</p>
							</div>
						</div>
					</div>

					{/* Save/Cancel Buttons */}
						<div className="flex items-center justify-end space-x-4">
							<button
								onClick={handleCancel}
								disabled={!hasUnsavedChanges || saving}
								className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-stone-500 dark:focus:ring-stone-400 disabled:opacity-50 transition-colors duration-200"
							>
								Cancel
							</button>
							<button
								onClick={handleSave}
								disabled={!hasUnsavedChanges || saving}
								className="px-4 py-2 bg-blue-500 dark:bg-blue-600 text-white rounded-lg hover:bg-blue-600 dark:hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:focus:ring-blue-500 disabled:opacity-50 transition-colors duration-200"
							>
								{saving ? 'Saving...' : 'Save Changes'}
							</button>
						</div>
				</div>
			</div>

			{/* Success Toast */}
			{showSuccess && (
				<SuccessToast
					message="Settings saved successfully!"
					onDismiss={() => setShowSuccess(false)}
				/>
			)}
		</div>
	);
};

export default Settings;

interface BoardColumnsSectionProps {
	statuses: string[];
	board?: BoardConfig;
	onChange: (next: BoardConfig | undefined) => void;
}

/**
 * Editor for the optional `board.columns` config. Lists every status as a
 * row; users toggle visibility, drag to reorder, and set a color per
 * column. When all statuses are visible in their declared order and no
 * colors are set, the section emits `board: undefined` so the on-disk
 * config stays clean (matches the back-compat invariant).
 */
const BoardColumnsSection: React.FC<BoardColumnsSectionProps> = ({ statuses, board, onChange }) => {
	// Row derivation is extracted to a pure helper so the hide-all reload
	// contract is unit-testable without React. See
	// src/utils/build-board-editor-rows.ts for the documented contract.
	const initialRows = useMemo(() => buildBoardEditorRows(statuses, board), [statuses, board]);

	const [rows, setRows] = useState<BoardEditorRow[]>(initialRows);
	const [dragIndex, setDragIndex] = useState<number | null>(null);

	// Re-derive when the upstream config changes (e.g. after Save).
	useEffect(() => {
		setRows(initialRows);
	}, [initialRows]);

	const emit = (next: BoardEditorRow[]) => {
		setRows(next);
		const visibleColumns = next.filter((row) => row.visible);
		const allVisibleInOrder =
			visibleColumns.length === statuses.length &&
			visibleColumns.every((row, i) => row.status === statuses[i] && !row.color);
		if (allVisibleInOrder) {
			// Back to defaults — drop board: from the config entirely.
			onChange(undefined);
			return;
		}
		onChange({
			columns: visibleColumns.map((row) => (row.color ? { status: row.status, color: row.color } : { status: row.status })),
		});
	};

	const moveRow = (from: number, to: number) => {
		if (from === to || from < 0 || to < 0 || from >= rows.length || to >= rows.length) return;
		const next = rows.slice();
		const [moved] = next.splice(from, 1);
		if (!moved) return;
		next.splice(to, 0, moved);
		emit(next);
	};

	const handleDragStart = (index: number) => (event: React.DragEvent<HTMLDivElement>) => {
		setDragIndex(index);
		event.dataTransfer.effectAllowed = 'move';
		// Some browsers require setData for the drag to register.
		event.dataTransfer.setData('text/plain', String(index));
	};

	const handleDragOver = (index: number) => (event: React.DragEvent<HTMLDivElement>) => {
		if (dragIndex === null || dragIndex === index) return;
		event.preventDefault();
		event.dataTransfer.dropEffect = 'move';
	};

	const handleDrop = (index: number) => (event: React.DragEvent<HTMLDivElement>) => {
		event.preventDefault();
		if (dragIndex === null) return;
		moveRow(dragIndex, index);
		setDragIndex(null);
	};

	const handleDragEnd = () => setDragIndex(null);

	const toggleVisible = (index: number) => {
		const next = rows.slice();
		const row = next[index];
		if (!row) return;
		next[index] = { ...row, visible: !row.visible };
		emit(next);
	};

	const setColor = (index: number, color: string | undefined) => {
		const next = rows.slice();
		const row = next[index];
		if (!row) return;
		next[index] = { ...row, color: color && color.trim() ? color : undefined };
		emit(next);
	};

	const resetToDefaults = () => onChange(undefined);

	const hasCustomization =
		rows.some((row) => !row.visible || (row.color && row.color.length > 0)) ||
		rows.some((row, i) => row.status !== statuses[i]);

	return (
		<div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
			<div className="flex items-center justify-between mb-1">
				<h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Board Columns</h2>
				{hasCustomization && (
					<button
						type="button"
						onClick={resetToDefaults}
						className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
					>
						Reset to defaults
					</button>
				)}
			</div>
			<p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
				Reorder kanban columns, hide statuses you don't want on the board, and pick a column color.
				Hidden statuses stay reachable from list views — only the board hides them.
			</p>
			<div className="space-y-1">
				{rows.map((row, index) => (
					<div
						key={row.status}
						draggable
						onDragStart={handleDragStart(index)}
						onDragOver={handleDragOver(index)}
						onDrop={handleDrop(index)}
						onDragEnd={handleDragEnd}
						className={`flex items-center gap-3 px-3 py-2 rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 ${
							dragIndex === index ? 'opacity-50' : ''
						} ${!row.visible ? 'opacity-60' : ''}`}
					>
						<span
							aria-hidden="true"
							title="Drag to reorder"
							className="cursor-grab select-none text-gray-400 dark:text-gray-500"
						>
							⋮⋮
						</span>
						<div className="flex flex-col">
							<button
								type="button"
								onClick={() => moveRow(index, index - 1)}
								disabled={index === 0}
								aria-label={`Move ${row.status} up`}
								title="Move up"
								className="px-1 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 disabled:opacity-30 disabled:cursor-not-allowed leading-none"
							>
								▲
							</button>
							<button
								type="button"
								onClick={() => moveRow(index, index + 1)}
								disabled={index === rows.length - 1}
								aria-label={`Move ${row.status} down`}
								title="Move down"
								className="px-1 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 disabled:opacity-30 disabled:cursor-not-allowed leading-none"
							>
								▼
							</button>
						</div>
						<label className="flex items-center gap-2 cursor-pointer">
							<input
								type="checkbox"
								checked={row.visible}
								onChange={() => toggleVisible(index)}
								className="rounded text-blue-600 focus:ring-blue-500"
								aria-label={`Show ${row.status} column on the board`}
							/>
							<span className="text-sm text-gray-700 dark:text-gray-300">Show</span>
						</label>
						<span className="flex-1 text-sm font-medium text-gray-900 dark:text-gray-100">{row.status}</span>
						<div className="flex items-center gap-2">
							<input
								type="color"
								value={row.color ?? '#9ca3af'}
								onChange={(event) => setColor(index, event.target.value)}
								disabled={!row.visible}
								className="h-7 w-10 cursor-pointer rounded border border-gray-300 dark:border-gray-600 disabled:cursor-not-allowed disabled:opacity-50"
								aria-label={`Color for ${row.status}`}
								title={`Color for ${row.status}`}
							/>
							{row.color && row.visible && (
								<button
									type="button"
									onClick={() => setColor(index, undefined)}
									className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
									title="Clear color"
								>
									Clear
								</button>
							)}
						</div>
					</div>
				))}
				{rows.length === 0 && (
					<p className="text-sm text-gray-500 dark:text-gray-400">No statuses configured yet.</p>
				)}
				{rows.length > 0 && rows.every((row) => !row.visible) && (
					<p className="mt-3 text-sm text-amber-600 dark:text-amber-400">
						All columns are hidden — the kanban board will be empty. Tasks remain accessible from the All Tasks
						view. Uncheck "Show" on at least one column or click "Reset to defaults" to restore the standard
						board.
					</p>
				)}
			</div>
		</div>
	);
};
