import React, { useEffect, useState } from "react";
import { useI18n } from "../hooks/useI18n";
import { DEFAULT_INIT_CONFIG } from "../../constants/index.ts";
import { apiClient } from "../lib/api";

type IntegrationMode = "mcp" | "cli" | "none";
type McpClient = "claude" | "codex" | "gemini" | "guide";
type AgentFile = "CLAUDE.md" | "AGENTS.md" | "GEMINI.md" | ".github/copilot-instructions.md";
type BacklogDirectoryChoice = "backlog" | ".backlog" | "custom";
type ConfigLocationChoice = "folder" | "root";

interface AdvancedConfig {
	checkActiveBranches: boolean;
	remoteOperations: boolean;
	activeBranchDays: number;
	bypassGitHooks: boolean;
	autoCommit: boolean;
	zeroPaddedIds: number | null;
	taskPrefix: string;
	defaultEditor: string;
	defaultPort: number;
	autoOpenBrowser: boolean;
}

interface InitializationScreenProps {
	onInitialized: () => void;
}

type WizardStep = "projectName" | "integrationMode" | "mcpClients" | "agentFiles" | "advancedConfig" | "summary";

const InitializationScreen: React.FC<InitializationScreenProps> = ({ onInitialized }) => {
	const { t } = useI18n();
	// Wizard state
	const [currentStep, setCurrentStep] = useState<WizardStep>("projectName");

	// Form data
	const [projectName, setProjectName] = useState("");
	const [integrationMode, setIntegrationMode] = useState<IntegrationMode | null>(null);
	const [selectedMcpClients, setSelectedMcpClients] = useState<McpClient[]>([]);
	const [selectedAgentFiles, setSelectedAgentFiles] = useState<AgentFile[]>([]);
	const [installClaudeAgent, setInstallClaudeAgent] = useState(false);
	const [showAdvancedConfig, setShowAdvancedConfig] = useState(false);
	const [backlogDirectorySource, setBacklogDirectorySource] = useState<BacklogDirectoryChoice>("backlog");
	const [backlogDirectory, setBacklogDirectory] = useState("backlog");
	const [configLocation, setConfigLocation] = useState<ConfigLocationChoice>("folder");
	const [rootConfigPath, setRootConfigPath] = useState<string | null>(null);
	const [advancedConfig, setAdvancedConfig] = useState<AdvancedConfig>({
		checkActiveBranches: DEFAULT_INIT_CONFIG.checkActiveBranches,
		remoteOperations: DEFAULT_INIT_CONFIG.remoteOperations,
		activeBranchDays: DEFAULT_INIT_CONFIG.activeBranchDays,
		bypassGitHooks: DEFAULT_INIT_CONFIG.bypassGitHooks,
		autoCommit: DEFAULT_INIT_CONFIG.autoCommit,
		zeroPaddedIds: DEFAULT_INIT_CONFIG.zeroPaddedIds ?? null,
		taskPrefix: "",
		defaultEditor: DEFAULT_INIT_CONFIG.defaultEditor ?? "",
		defaultPort: DEFAULT_INIT_CONFIG.defaultPort,
		autoOpenBrowser: DEFAULT_INIT_CONFIG.autoOpenBrowser,
	});

	// UI state
	const [isInitializing, setIsInitializing] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [mcpSetupResults, setMcpSetupResults] = useState<Record<string, string>>({});

	const normalizeRelativeBacklogDirectory = (value: string): string | null => {
		const trimmed = value.trim();
		if (!trimmed) return null;
		if (/^(?:[a-zA-Z]:)?[\\/]/.test(trimmed)) return null;
		const normalized = trimmed.replace(/\\/g, "/").replace(/\/+$/g, "");
		if (!normalized || normalized === "." || normalized === ".." || normalized.startsWith("../")) {
			return null;
		}
		return normalized;
	};

	useEffect(() => {
		const loadBacklogDirectoryDefaults = async () => {
			try {
				const status = await apiClient.checkStatus();
				if (status.initialized) {
					return;
				}
				const suggestedSource = status.backlogDirectorySource ?? "backlog";
				const suggestedDirectory = status.backlogDirectory ?? "backlog";
				setRootConfigPath(status.rootConfigPath ?? null);
				setBacklogDirectorySource(suggestedSource);
				setBacklogDirectory(suggestedDirectory);
				setConfigLocation(status.configLocation ?? (suggestedSource === "custom" ? "root" : "folder"));
			} catch {
				// Keep built-in defaults when status lookup fails.
			}
		};
		void loadBacklogDirectoryDefaults();
	}, []);

	const handleNext = () => {
		setError(null);
		switch (currentStep) {
			case "projectName":
				if (!projectName.trim()) {
					setError(t.init.projectNameRequired);
					return;
				}
				setCurrentStep("integrationMode");
				break;
			case "integrationMode":
				if (!integrationMode) {
					setError(t.init.selectIntegrationMode);
					return;
				}
				if (integrationMode === "mcp") {
					setCurrentStep("mcpClients");
				} else if (integrationMode === "cli") {
					setCurrentStep("agentFiles");
				} else {
					setCurrentStep("advancedConfig");
				}
				break;
			case "mcpClients":
				setCurrentStep("advancedConfig");
				break;
			case "agentFiles":
				setCurrentStep("advancedConfig");
				break;
			case "advancedConfig":
				setCurrentStep("summary");
				break;
		}
	};

	const handleBack = () => {
		setError(null);
		switch (currentStep) {
			case "integrationMode":
				setCurrentStep("projectName");
				break;
			case "mcpClients":
				setCurrentStep("integrationMode");
				break;
			case "agentFiles":
				setCurrentStep("integrationMode");
				break;
			case "advancedConfig":
				if (integrationMode === "mcp") {
					setCurrentStep("mcpClients");
				} else if (integrationMode === "cli") {
					setCurrentStep("agentFiles");
				} else {
					setCurrentStep("integrationMode");
				}
				break;
			case "summary":
				setCurrentStep("advancedConfig");
				break;
		}
	};

	const handleInitialize = async () => {
		setIsInitializing(true);
		setError(null);
		setMcpSetupResults({});

		try {
			const normalizedBacklogDirectory =
				backlogDirectorySource === "custom"
					? normalizeRelativeBacklogDirectory(backlogDirectory) ?? backlogDirectory
					: backlogDirectory;
			await apiClient.initializeProject({
				projectName: projectName.trim(),
				backlogDirectory: normalizedBacklogDirectory,
				backlogDirectorySource,
				configLocation,
				integrationMode: integrationMode || "none",
				mcpClients: integrationMode === "mcp" ? selectedMcpClients : undefined,
				agentInstructions: integrationMode === "cli" ? selectedAgentFiles : undefined,
				installClaudeAgent: integrationMode === "cli" ? installClaudeAgent : undefined,
				advancedConfig: showAdvancedConfig
					? {
							...advancedConfig,
							zeroPaddedIds: advancedConfig.zeroPaddedIds || undefined,
							taskPrefix: advancedConfig.taskPrefix || undefined,
							defaultEditor: advancedConfig.defaultEditor || undefined,
						}
					: undefined,
			});
			onInitialized();
		} catch (err) {
			setError(err instanceof Error ? err.message : t.init.failedToInitialize);
			setIsInitializing(false);
		}
	};

	const toggleMcpClient = (client: McpClient) => {
		setSelectedMcpClients((prev) =>
			prev.includes(client) ? prev.filter((c) => c !== client) : [...prev, client],
		);
	};

	const toggleAgentFile = (file: AgentFile) => {
		setSelectedAgentFiles((prev) =>
			prev.includes(file) ? prev.filter((f) => f !== file) : [...prev, file],
		);
	};

	const renderStepIndicator = () => {
		const steps = ["Project", "Integration", "Setup", "Config", "Initialize"];
		const stepMap: Record<WizardStep, number> = {
			projectName: 0,
			integrationMode: 1,
			mcpClients: 2,
			agentFiles: 2,
			advancedConfig: 3,
			summary: 4,
		};
		const currentIndex = stepMap[currentStep];

		return (
			<div className="flex justify-center mb-8">
				{steps.map((step, index) => (
					<div key={step} className="flex items-center">
						<div
							className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
								index <= currentIndex
									? "bg-blue-500 dark:bg-blue-600 text-white"
									: "bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
							}`}
						>
							{index + 1}
						</div>
						{index < steps.length - 1 && (
							<div
								className={`w-12 h-1 mx-1 ${
									index < currentIndex
										? "bg-blue-500 dark:bg-blue-600"
										: "bg-gray-200 dark:bg-gray-700"
								}`}
							/>
						)}
					</div>
				))}
			</div>
		);
	};

	const renderProjectNameStep = () => (
		<div>
			<h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">{t.init.projectName}</h2>
			<p className="text-gray-600 dark:text-gray-400 mb-6">
				{t.init.projectNameDescription}
			</p>
			<input
				type="text"
				value={projectName}
				onChange={(e) => setProjectName(e.target.value)}
				placeholder={t.init.projectNamePlaceholder}
				className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:focus:ring-blue-500 transition-colors duration-200"
				autoFocus
			/>
		</div>
	);

	const renderIntegrationModeStep = () => (
		<div>
			<h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">{t.init.integrationMode}</h2>
			<p className="text-gray-600 dark:text-gray-400 mb-6">
				{t.init.integrationModeDescription}
			</p>
			<div className="space-y-3">
				<label
					className={`flex items-start p-4 border rounded-lg cursor-pointer transition-colors ${
						integrationMode === "mcp"
							? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
							: "border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/50"
					}`}
				>
					<input
						type="radio"
						name="integrationMode"
						value="mcp"
						checked={integrationMode === "mcp"}
						onChange={() => setIntegrationMode("mcp")}
						className="mt-1 mr-3"
					/>
					<div>
						<div className="font-medium text-gray-900 dark:text-gray-100">
							{t.init.mcpConnector}
						</div>
						<div className="text-sm text-gray-500 dark:text-gray-400">
							{t.init.mcpConnectorDesc}
						</div>
					</div>
				</label>

				<label
					className={`flex items-start p-4 border rounded-lg cursor-pointer transition-colors ${
						integrationMode === "cli"
							? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
							: "border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/50"
					}`}
				>
					<input
						type="radio"
						name="integrationMode"
						value="cli"
						checked={integrationMode === "cli"}
						onChange={() => setIntegrationMode("cli")}
						className="mt-1 mr-3"
					/>
					<div>
						<div className="font-medium text-gray-900 dark:text-gray-100">
							{t.init.cliCommands}
						</div>
						<div className="text-sm text-gray-500 dark:text-gray-400">
							{t.init.cliCommandsDesc}
						</div>
					</div>
				</label>

				<label
					className={`flex items-start p-4 border rounded-lg cursor-pointer transition-colors ${
						integrationMode === "none"
							? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
							: "border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/50"
					}`}
				>
					<input
						type="radio"
						name="integrationMode"
						value="none"
						checked={integrationMode === "none"}
						onChange={() => setIntegrationMode("none")}
						className="mt-1 mr-3"
					/>
					<div>
						<div className="font-medium text-gray-900 dark:text-gray-100">{t.init.skipForNow}</div>
						<div className="text-sm text-gray-500 dark:text-gray-400">
							{t.init.skipForNowDesc}
						</div>
					</div>
				</label>
			</div>
		</div>
	);

	const renderMcpClientsStep = () => (
		<div>
			<h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">{t.init.mcpClientsTitle}</h2>
			<p className="text-gray-600 dark:text-gray-400 mb-6">
				{t.init.mcpClientSetupDesc}
			</p>
			<div className="space-y-3">
				{[
					{ id: "claude" as McpClient, label: t.init.mcpClients.claude, description: t.init.mcpClients.claudeDesc },
					{ id: "codex" as McpClient, label: t.init.mcpClients.codex, description: t.init.mcpClients.codexDesc },
					{ id: "gemini" as McpClient, label: t.init.mcpClients.gemini, description: t.init.mcpClients.geminiDesc },
					{
						id: "guide" as McpClient,
						label: t.init.mcpClients.manual,
						description: t.init.mcpClients.manualDesc,
					},
				].map((client) => (
					<label
						key={client.id}
						className={`flex items-start p-4 border rounded-lg cursor-pointer transition-colors ${
							selectedMcpClients.includes(client.id)
								? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
								: "border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/50"
						}`}
					>
						<input
							type="checkbox"
							checked={selectedMcpClients.includes(client.id)}
							onChange={() => toggleMcpClient(client.id)}
							className="mt-1 mr-3"
						/>
						<div>
							<div className="font-medium text-gray-900 dark:text-gray-100">{client.label}</div>
							<div className="text-sm text-gray-500 dark:text-gray-400">{client.description}</div>
						</div>
					</label>
				))}
			</div>
			{selectedMcpClients.length === 0 && (
				<p className="mt-4 text-sm text-amber-600 dark:text-amber-400">
					💡 {t.init.selectAtLeastOneMcp}
				</p>
			)}
		</div>
	);

	const renderAgentFilesStep = () => (
		<div>
			<h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">{t.init.agentFiles}</h2>
			<p className="text-gray-600 dark:text-gray-400 mb-6">
				{t.init.agentFilesDescription}
			</p>
			<div className="space-y-3">
				{[
					{ id: "CLAUDE.md" as AgentFile, label: t.init.agentFilesLabels.claudeMd, description: t.init.agentFilesLabels.claudeMdDesc },
					{
						id: "AGENTS.md" as AgentFile,
						label: t.init.agentFilesLabels.agentsMd,
						description: t.init.agentFilesLabels.agentsMdDesc,
					},
					{ id: "GEMINI.md" as AgentFile, label: t.init.agentFilesLabels.geminiMd, description: t.init.agentFilesLabels.geminiMdDesc },
					{
						id: ".github/copilot-instructions.md" as AgentFile,
						label: t.init.agentFilesLabels.copilot,
						description: t.init.agentFilesLabels.copilotDesc,
					},
				].map((file) => (
					<label
						key={file.id}
						className={`flex items-start p-4 border rounded-lg cursor-pointer transition-colors ${
							selectedAgentFiles.includes(file.id)
								? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
								: "border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/50"
						}`}
					>
						<input
							type="checkbox"
							checked={selectedAgentFiles.includes(file.id)}
							onChange={() => toggleAgentFile(file.id)}
							className="mt-1 mr-3"
						/>
						<div>
							<div className="font-medium text-gray-900 dark:text-gray-100">{file.label}</div>
							<div className="text-sm text-gray-500 dark:text-gray-400">{file.description}</div>
						</div>
					</label>
				))}
			</div>

			<div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
				<label className="flex items-start cursor-pointer">
					<input
						type="checkbox"
						checked={installClaudeAgent}
						onChange={(e) => setInstallClaudeAgent(e.target.checked)}
						className="mt-1 mr-3"
					/>
					<div>
						<div className="font-medium text-gray-900 dark:text-gray-100">
							{t.init.installClaudeAgent}
						</div>
						<div className="text-sm text-gray-500 dark:text-gray-400">
							{t.init.installClaudeAgentDesc}
						</div>
					</div>
				</label>
			</div>
		</div>
	);

	const renderAdvancedConfigStep = () => (
		<div>
			<h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">{t.init.advancedSettings}</h2>

			<div className="mb-6">
				<h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">{t.init.backlogFolder}</h3>
				<div className="space-y-3">
					{([
						{
							id: "backlog" as BacklogDirectoryChoice,
							label: "backlog/",
							description: t.init.backlogFolderDesc("backlog"),
						},
						{
							id: ".backlog" as BacklogDirectoryChoice,
							label: ".backlog/",
							description: t.init.backlogFolderDesc(".backlog"),
						},
						{
							id: "custom" as BacklogDirectoryChoice,
							label: t.init.customPath,
							description: t.init.customPathDesc(rootConfigPath ?? "backlog.config.yml"),
						},
					]).map((option) => (
						<label
							key={option.id}
							className={`flex items-start p-4 border rounded-lg cursor-pointer transition-colors ${
								backlogDirectorySource === option.id
									? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
									: "border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/50"
							}`}
						>
							<input
								type="radio"
								name="backlogDirectorySource"
								value={option.id}
								checked={backlogDirectorySource === option.id}
								onChange={() => {
									setBacklogDirectorySource(option.id);
									if (option.id !== "custom") {
										setBacklogDirectory(option.id);
									}
									if (option.id === "custom") {
										setConfigLocation("root");
									}
								}}
								className="mt-1 mr-3"
							/>
							<div>
								<div className="font-medium text-gray-900 dark:text-gray-100">{option.label}</div>
								<div className="text-sm text-gray-500 dark:text-gray-400">{option.description}</div>
							</div>
						</label>
					))}
				</div>
				{backlogDirectorySource === "custom" && (
					<div className="mt-4">
						<label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">
							{t.init.projectRelativeBacklogDirectory}
						</label>
						<input
							type="text"
							value={backlogDirectory}
							onChange={(e) => setBacklogDirectory(e.target.value)}
							placeholder={t.init.backlogDirectoryPlaceholder}
							className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700"
						/>
						<p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
							{t.init.pathStoredIn(rootConfigPath ?? "backlog.config.yml")}
						</p>
					</div>
				)}
				{backlogDirectorySource !== "custom" && (
					<div className="mt-4">
						<label className="block text-sm text-gray-700 dark:text-gray-300 mb-3">{t.init.configLocation}</label>
						<div className="space-y-3">
							{([
								{
									id: "folder" as ConfigLocationChoice,
									label: `${backlogDirectory}/config.yml`,
									description: t.init.storeConfigInsideFolder,
								},
								{
									id: "root" as ConfigLocationChoice,
									label: "backlog.config.yml",
									description: t.init.storeConfigInRoot,
								},
							]).map((option) => (
								<label
									key={option.id}
									className={`flex items-start p-4 border rounded-lg cursor-pointer transition-colors ${
										configLocation === option.id
											? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
											: "border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/50"
									}`}
								>
									<input
										type="radio"
										name="configLocation"
										value={option.id}
										checked={configLocation === option.id}
										onChange={() => setConfigLocation(option.id)}
										className="mt-1 mr-3"
									/>
									<div>
										<div className="font-medium text-gray-900 dark:text-gray-100">{option.label}</div>
										<div className="text-sm text-gray-500 dark:text-gray-400">{option.description}</div>
									</div>
								</label>
							))}
						</div>
					</div>
				)}
			</div>

			<label className="flex items-center mb-6 cursor-pointer">
				<input
					type="checkbox"
					checked={showAdvancedConfig}
					onChange={(e) => setShowAdvancedConfig(e.target.checked)}
					className="mr-3"
				/>
				<span className="text-gray-700 dark:text-gray-300">{t.init.configureAdvanced}</span>
			</label>

			{showAdvancedConfig && (
				<div className="space-y-6 border-t border-gray-200 dark:border-gray-700 pt-6">
					{/* Branch Settings */}
					<div>
						<h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">{t.init.branchSettings}</h3>
						<div className="space-y-3">
							<label className="flex items-center cursor-pointer">
								<input
									type="checkbox"
									checked={advancedConfig.checkActiveBranches}
									onChange={(e) =>
										setAdvancedConfig((prev) => ({
											...prev,
											checkActiveBranches: e.target.checked,
											remoteOperations: e.target.checked ? prev.remoteOperations : false,
										}))
									}
									className="mr-3"
								/>
								<div>
									<span className="text-gray-900 dark:text-gray-100">{t.init.checkAcrossBranches}</span>
									<p className="text-xs text-gray-500 dark:text-gray-400">
										{t.init.checkAcrossBranchesDesc}
									</p>
								</div>
							</label>

							{advancedConfig.checkActiveBranches && (
								<>
									<label className="flex items-center cursor-pointer ml-6">
										<input
											type="checkbox"
											checked={advancedConfig.remoteOperations}
											onChange={(e) =>
												setAdvancedConfig((prev) => ({ ...prev, remoteOperations: e.target.checked }))
											}
											className="mr-3"
										/>
										<div>
											<span className="text-gray-900 dark:text-gray-100">{t.init.includeRemoteBranches}</span>
											<p className="text-xs text-gray-500 dark:text-gray-400">
												{t.init.includeRemoteBranchesDesc}
											</p>
										</div>
									</label>

									<div className="ml-6">
										<label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">
											{t.init.activeBranchDays}
										</label>
										<input
											type="number"
											value={advancedConfig.activeBranchDays}
											onChange={(e) =>
												setAdvancedConfig((prev) => ({
													...prev,
													activeBranchDays: Number.parseInt(e.target.value) || 30,
												}))
											}
											min={1}
											max={365}
											className="w-24 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700"
										/>
									</div>
								</>
							)}
						</div>
					</div>

					{/* Git Settings */}
					<div>
						<h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">{t.init.gitSettings}</h3>
						<div className="space-y-3">
							<label className="flex items-center cursor-pointer">
								<input
									type="checkbox"
									checked={advancedConfig.autoCommit}
									onChange={(e) =>
										setAdvancedConfig((prev) => ({ ...prev, autoCommit: e.target.checked }))
									}
									className="mr-3"
								/>
								<div>
									<span className="text-gray-900 dark:text-gray-100">{t.init.autoCommit}</span>
									<p className="text-xs text-gray-500 dark:text-gray-400">
										{t.init.autoCommitDesc}
									</p>
								</div>
							</label>

							<label className="flex items-center cursor-pointer">
								<input
									type="checkbox"
									checked={advancedConfig.bypassGitHooks}
									onChange={(e) =>
										setAdvancedConfig((prev) => ({ ...prev, bypassGitHooks: e.target.checked }))
									}
									className="mr-3"
								/>
								<div>
									<span className="text-gray-900 dark:text-gray-100">{t.init.bypassGitHooks}</span>
									<p className="text-xs text-gray-500 dark:text-gray-400">
										{t.init.bypassGitHooksDesc}
									</p>
								</div>
							</label>
						</div>
					</div>

					{/* ID Formatting */}
					<div>
						<h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">{t.init.idFormatting}</h3>
						<label className="flex items-center cursor-pointer">
							<input
								type="checkbox"
								checked={advancedConfig.zeroPaddedIds !== null}
								onChange={(e) =>
									setAdvancedConfig((prev) => ({
										...prev,
										zeroPaddedIds: e.target.checked ? 3 : null,
									}))
								}
								className="mr-3"
							/>
							<div>
								<span className="text-gray-900 dark:text-gray-100">{t.init.zeroPaddedIds}</span>
								<p className="text-xs text-gray-500 dark:text-gray-400">
									{t.init.zeroPaddedIdsDesc}
								</p>
							</div>
						</label>
						{advancedConfig.zeroPaddedIds !== null && (
							<div className="ml-6 mt-2">
								<label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">
									{t.init.numberOfDigits}
								</label>
								<input
									type="number"
									value={advancedConfig.zeroPaddedIds}
									onChange={(e) =>
										setAdvancedConfig((prev) => ({
											...prev,
											zeroPaddedIds: Number.parseInt(e.target.value) || 3,
										}))
									}
									min={1}
									max={10}
									className="w-24 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700"
								/>
							</div>
						)}

						{/* Task Prefix */}
						<div className="mt-4">
							<label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">
								{t.init.taskPrefix}
							</label>
							<input
								type="text"
								value={advancedConfig.taskPrefix}
								onChange={(e) =>
									setAdvancedConfig((prev) => ({
										...prev,
										taskPrefix: e.target.value.replace(/[^a-zA-Z]/g, ""),
									}))
								}
								placeholder={t.init.taskPrefixPlaceholder}
								className="w-32 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700"
							/>
							<p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
								{t.init.taskPrefixHint}
							</p>
						</div>
					</div>

					{/* Editor */}
					<div>
						<h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">{t.init.editor}</h3>
						<input
							type="text"
							value={advancedConfig.defaultEditor}
							onChange={(e) =>
								setAdvancedConfig((prev) => ({ ...prev, defaultEditor: e.target.value }))
							}
							placeholder={t.init.editorPlaceholder}
							className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700"
						/>
						<p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
							{t.init.leaveBlankForDefault}
						</p>
					</div>

					{/* Web UI Settings */}
					<div>
						<h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">{t.init.webUi}</h3>
						<div className="space-y-3">
							<div>
								<label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">
									{t.init.defaultPort}
								</label>
								<input
									type="number"
									value={advancedConfig.defaultPort}
									onChange={(e) =>
										setAdvancedConfig((prev) => ({
											...prev,
											defaultPort: Number.parseInt(e.target.value) || 6420,
										}))
									}
									min={1}
									max={65535}
									className="w-32 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700"
								/>
							</div>

							<label className="flex items-center cursor-pointer">
								<input
									type="checkbox"
									checked={advancedConfig.autoOpenBrowser}
									onChange={(e) =>
										setAdvancedConfig((prev) => ({ ...prev, autoOpenBrowser: e.target.checked }))
									}
									className="mr-3"
								/>
								<span className="text-gray-900 dark:text-gray-100">{t.init.autoOpenBrowser}</span>
							</label>
						</div>
					</div>
				</div>
			)}
		</div>
	);

	const renderSummaryStep = () => (
		<div>
			<h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">{t.init.ready}</h2>
			<p className="text-gray-600 dark:text-gray-400 mb-6">{t.init.review}</p>

			<div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 space-y-3 text-sm">
				<div className="flex justify-between">
					<span className="text-gray-600 dark:text-gray-400">{t.init.labels.projectName}</span>
					<span className="font-medium text-gray-900 dark:text-gray-100">{projectName}</span>
				</div>
				<div className="flex justify-between">
					<span className="text-gray-600 dark:text-gray-400">{t.init.labels.integrationMode}</span>
					<span className="font-medium text-gray-900 dark:text-gray-100">
						{integrationMode === "mcp"
							? t.init.mcpConnector
							: integrationMode === "cli"
								? t.init.cliCommands
								: t.common.none}
					</span>
				</div>
				<div className="flex justify-between">
					<span className="text-gray-600 dark:text-gray-400">{t.init.labels.backlogDirectory}</span>
					<span className="font-medium text-gray-900 dark:text-gray-100">{backlogDirectory}</span>
				</div>
				<div className="flex justify-between">
					<span className="text-gray-600 dark:text-gray-400">{t.init.labels.configLocation}</span>
					<span className="font-medium text-gray-900 dark:text-gray-100">
						{configLocation === "root" ? "backlog.config.yml" : `${backlogDirectory}/config.yml`}
					</span>
				</div>
				{integrationMode === "mcp" && selectedMcpClients.length > 0 && (
					<div className="flex justify-between">
						<span className="text-gray-600 dark:text-gray-400">{t.init.mcpClientsLabel}</span>
						<span className="font-medium text-gray-900 dark:text-gray-100">
							{selectedMcpClients.join(", ")}
						</span>
					</div>
				)}
				{integrationMode === "cli" && selectedAgentFiles.length > 0 && (
					<div className="flex justify-between">
						<span className="text-gray-600 dark:text-gray-400">{t.init.labels.agentFiles}</span>
						<span className="font-medium text-gray-900 dark:text-gray-100">
							{selectedAgentFiles.length} {t.common.files}
						</span>
					</div>
				)}
				{integrationMode === "cli" && installClaudeAgent && (
					<div className="flex justify-between">
						<span className="text-gray-600 dark:text-gray-400">{t.init.labels.claudeAgent}</span>
						<span className="font-medium text-green-600 dark:text-green-400">{t.init.labels.willBeInstalled}</span>
					</div>
				)}
				<div className="flex justify-between">
					<span className="text-gray-600 dark:text-gray-400">{t.init.labels.advancedConfig}</span>
					<span className="font-medium text-gray-900 dark:text-gray-100">
						{showAdvancedConfig ? t.init.customized : t.init.defaults}
					</span>
				</div>
				{showAdvancedConfig && advancedConfig.taskPrefix && (
					<div className="flex justify-between">
						<span className="text-gray-600 dark:text-gray-400">{t.init.labels.taskPrefix}</span>
						<span className="font-medium text-gray-900 dark:text-gray-100">
							{advancedConfig.taskPrefix.toUpperCase()}
						</span>
					</div>
				)}
			</div>

			{Object.keys(mcpSetupResults).length > 0 && (
				<div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
					<h3 className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-2">{t.init.setupProgress}</h3>
					{Object.entries(mcpSetupResults).map(([client, result]) => (
						<div key={client} className="text-sm text-blue-700 dark:text-blue-400">
							{client}: {result}
						</div>
					))}
				</div>
			)}
		</div>
	);

	const renderCurrentStep = () => {
		switch (currentStep) {
			case "projectName":
				return renderProjectNameStep();
			case "integrationMode":
				return renderIntegrationModeStep();
			case "mcpClients":
				return renderMcpClientsStep();
			case "agentFiles":
				return renderAgentFilesStep();
			case "advancedConfig":
				return renderAdvancedConfigStep();
			case "summary":
				return renderSummaryStep();
		}
	};

	const canProceed = () => {
		switch (currentStep) {
			case "projectName":
				return projectName.trim().length > 0;
			case "integrationMode":
				return integrationMode !== null;
			case "mcpClients":
				return true; // Can proceed with no selection
			case "agentFiles":
				return true; // Can proceed with no selection
			case "advancedConfig":
				return backlogDirectorySource !== "custom" || normalizeRelativeBacklogDirectory(backlogDirectory) !== null;
			case "summary":
				return true;
		}
	};

	return (
		<div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900 transition-colors duration-200 p-4">
			<div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 max-w-2xl w-full">
				{/* Header */}
				<div className="text-center mb-6">
					<div className="inline-flex items-center justify-center w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full mb-3">
						<svg
							className="w-6 h-6 text-blue-600 dark:text-blue-400"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
							/>
						</svg>
					</div>
					<h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">{t.init.title}</h1>
				</div>

				{/* Step Indicator */}
				{renderStepIndicator()}

				{/* Error Message */}
				{error && (
					<div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg">
						<p className="text-sm text-red-700 dark:text-red-400">{error}</p>
					</div>
				)}

				{/* Current Step Content */}
				<div className="mb-8">{renderCurrentStep()}</div>

				{/* Navigation Buttons */}
				<div className="flex justify-between">
						<button
							type="button"
							onClick={handleBack}
							disabled={currentStep === "projectName" || isInitializing}
							className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 transition-colors duration-200"
						>
							{t.common.back}
						</button>

					{currentStep === "summary" ? (
							<button
								type="button"
								onClick={handleInitialize}
								disabled={isInitializing}
								className="px-6 py-2 bg-blue-500 dark:bg-blue-600 text-white rounded-lg hover:bg-blue-600 dark:hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:focus:ring-blue-500 disabled:opacity-50 transition-colors duration-200 font-medium"
							>
								{isInitializing ? (
									<span className="flex items-center">
										<svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
										<circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
										<path
											className="opacity-75"
											fill="currentColor"
											d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
										/>
									</svg>
									{t.common.loading}
								</span>
							) : (
								t.init.initializeProject
							)}
						</button>
					) : (
							<button
								type="button"
								onClick={handleNext}
								disabled={!canProceed()}
								className="px-6 py-2 bg-blue-500 dark:bg-blue-600 text-white rounded-lg hover:bg-blue-600 dark:hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:focus:ring-blue-500 disabled:opacity-50 transition-colors duration-200 font-medium"
							>
								{t.common.next}
							</button>
					)}
				</div>
			</div>
		</div>
	);
};

export default InitializationScreen;
