import React, { useState } from "react";
import { DEFAULT_INIT_CONFIG } from "../../constants/index.ts";
import { apiClient } from "../lib/api";

type IntegrationMode = "mcp" | "cli" | "none";
type McpClient = "claude" | "codex" | "gemini" | "guide";
type AgentFile = "CLAUDE.md" | "AGENTS.md" | "GEMINI.md" | ".github/copilot-instructions.md";

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
	// Wizard state
	const [currentStep, setCurrentStep] = useState<WizardStep>("projectName");

	// Form data
	const [projectName, setProjectName] = useState("");
	const [integrationMode, setIntegrationMode] = useState<IntegrationMode | null>(null);
	const [selectedMcpClients, setSelectedMcpClients] = useState<McpClient[]>([]);
	const [selectedAgentFiles, setSelectedAgentFiles] = useState<AgentFile[]>([]);
	const [installClaudeAgent, setInstallClaudeAgent] = useState(false);
	const [showAdvancedConfig, setShowAdvancedConfig] = useState(false);
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

	const handleNext = () => {
		setError(null);
		switch (currentStep) {
			case "projectName":
				if (!projectName.trim()) {
					setError("Project name is required");
					return;
				}
				setCurrentStep("integrationMode");
				break;
			case "integrationMode":
				if (!integrationMode) {
					setError("Please select an integration mode");
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
			await apiClient.initializeProject({
				projectName: projectName.trim(),
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
			setError(err instanceof Error ? err.message : "Failed to initialize project");
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
			<h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">Project Name</h2>
			<p className="text-gray-600 dark:text-gray-400 mb-6">
				Enter a name for your project. This will be displayed in the UI and used for identification.
			</p>
			<input
				type="text"
				value={projectName}
				onChange={(e) => setProjectName(e.target.value)}
				placeholder="My Awesome Project"
				className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:focus:ring-blue-500 transition-colors duration-200"
				autoFocus
			/>
		</div>
	);

	const renderIntegrationModeStep = () => (
		<div>
			<h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">AI Integration Mode</h2>
			<p className="text-gray-600 dark:text-gray-400 mb-6">
				How would you like your AI tools to connect to Backlog.md?
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
							MCP Connector (Recommended)
						</div>
						<div className="text-sm text-gray-500 dark:text-gray-400">
							For Claude Code, Codex, Gemini CLI, Kiro, Cursor, etc. Agents learn the Backlog.md workflow through
							MCP tools, resources, and prompts.
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
							CLI Commands (Broader Compatibility)
						</div>
						<div className="text-sm text-gray-500 dark:text-gray-400">
							Agents will use Backlog.md by invoking CLI commands directly. Creates instruction files for
							various AI tools.
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
						<div className="font-medium text-gray-900 dark:text-gray-100">Skip for Now</div>
						<div className="text-sm text-gray-500 dark:text-gray-400">
							Continue without setting up AI integration. You can configure this later.
						</div>
					</div>
				</label>
			</div>
		</div>
	);

	const renderMcpClientsStep = () => (
		<div>
			<h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">MCP Client Setup</h2>
			<p className="text-gray-600 dark:text-gray-400 mb-6">
				Select the AI tools you want to configure for MCP integration. The setup will run automatically.
			</p>
			<div className="space-y-3">
				{[
					{ id: "claude" as McpClient, label: "Claude Code", description: "Anthropic's Claude Code editor" },
					{ id: "codex" as McpClient, label: "OpenAI Codex", description: "OpenAI's Codex CLI" },
					{ id: "gemini" as McpClient, label: "Gemini CLI", description: "Google's Gemini Code Assist CLI" },
					{
						id: "guide" as McpClient,
						label: "Manual Setup Guide",
						description: "Opens documentation for manual configuration",
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
					💡 Select at least one option to configure MCP integration, or go back to choose a different mode.
				</p>
			)}
		</div>
	);

	const renderAgentFilesStep = () => (
		<div>
			<h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">Agent Instruction Files</h2>
			<p className="text-gray-600 dark:text-gray-400 mb-6">
				Select which instruction files to create for CLI-based AI tools.
			</p>
			<div className="space-y-3">
				{[
					{ id: "CLAUDE.md" as AgentFile, label: "CLAUDE.md", description: "Claude Code instructions" },
					{
						id: "AGENTS.md" as AgentFile,
						label: "AGENTS.md",
						description: "Codex, Cursor, Zed, Warp, Aider, RooCode, etc.",
					},
					{ id: "GEMINI.md" as AgentFile, label: "GEMINI.md", description: "Google Gemini Code Assist CLI" },
					{
						id: ".github/copilot-instructions.md" as AgentFile,
						label: "Copilot Instructions",
						description: "GitHub Copilot",
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
							Install Claude Code Backlog.md Agent
						</div>
						<div className="text-sm text-gray-500 dark:text-gray-400">
							Adds configuration under .claude/agents/ for enhanced Claude Code integration
						</div>
					</div>
				</label>
			</div>
		</div>
	);

	const renderAdvancedConfigStep = () => (
		<div>
			<h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">Advanced Settings</h2>

			<label className="flex items-center mb-6 cursor-pointer">
				<input
					type="checkbox"
					checked={showAdvancedConfig}
					onChange={(e) => setShowAdvancedConfig(e.target.checked)}
					className="mr-3"
				/>
				<span className="text-gray-700 dark:text-gray-300">Configure advanced settings now</span>
			</label>

			{showAdvancedConfig && (
				<div className="space-y-6 border-t border-gray-200 dark:border-gray-700 pt-6">
					{/* Branch Settings */}
					<div>
						<h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Branch Settings</h3>
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
									<span className="text-gray-900 dark:text-gray-100">Check task states across branches</span>
									<p className="text-xs text-gray-500 dark:text-gray-400">
										Ensures accurate task tracking across branches
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
											<span className="text-gray-900 dark:text-gray-100">Include remote branches</span>
											<p className="text-xs text-gray-500 dark:text-gray-400">
												Required for accessing tasks from remote repos
											</p>
										</div>
									</label>

									<div className="ml-6">
										<label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">
											Active branch days
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
						<h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Git Settings</h3>
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
									<span className="text-gray-900 dark:text-gray-100">Auto-commit changes</span>
									<p className="text-xs text-gray-500 dark:text-gray-400">
										Creates commits automatically after CLI changes
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
									<span className="text-gray-900 dark:text-gray-100">Bypass git hooks</span>
									<p className="text-xs text-gray-500 dark:text-gray-400">
										Use --no-verify flag to skip pre-commit hooks
									</p>
								</div>
							</label>
						</div>
					</div>

					{/* ID Formatting */}
					<div>
						<h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">ID Formatting</h3>
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
								<span className="text-gray-900 dark:text-gray-100">Zero-padded IDs</span>
								<p className="text-xs text-gray-500 dark:text-gray-400">
									Example: task-001 instead of task-1
								</p>
							</div>
						</label>
						{advancedConfig.zeroPaddedIds !== null && (
							<div className="ml-6 mt-2">
								<label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">
									Number of digits
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
								Task prefix
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
								placeholder="task"
								className="w-32 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700"
							/>
							<p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
								Letters only. Cannot be changed later. Examples: JIRA, BUG, ISSUE
							</p>
						</div>
					</div>

					{/* Editor */}
					<div>
						<h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Editor</h3>
						<input
							type="text"
							value={advancedConfig.defaultEditor}
							onChange={(e) =>
								setAdvancedConfig((prev) => ({ ...prev, defaultEditor: e.target.value }))
							}
							placeholder="e.g., code --wait, vim, nano"
							className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700"
						/>
						<p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
							Leave blank to use system default
						</p>
					</div>

					{/* Web UI Settings */}
					<div>
						<h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Web UI</h3>
						<div className="space-y-3">
							<div>
								<label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">
									Default port
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
								<span className="text-gray-900 dark:text-gray-100">Auto-open browser</span>
							</label>
						</div>
					</div>
				</div>
			)}
		</div>
	);

	const renderSummaryStep = () => (
		<div>
			<h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">Ready to Initialize</h2>
			<p className="text-gray-600 dark:text-gray-400 mb-6">Review your configuration before initializing:</p>

			<div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 space-y-3 text-sm">
				<div className="flex justify-between">
					<span className="text-gray-600 dark:text-gray-400">Project Name:</span>
					<span className="font-medium text-gray-900 dark:text-gray-100">{projectName}</span>
				</div>
				<div className="flex justify-between">
					<span className="text-gray-600 dark:text-gray-400">Integration Mode:</span>
					<span className="font-medium text-gray-900 dark:text-gray-100">
						{integrationMode === "mcp"
							? "MCP Connector"
							: integrationMode === "cli"
								? "CLI Commands"
								: "None"}
					</span>
				</div>
				{integrationMode === "mcp" && selectedMcpClients.length > 0 && (
					<div className="flex justify-between">
						<span className="text-gray-600 dark:text-gray-400">MCP Clients:</span>
						<span className="font-medium text-gray-900 dark:text-gray-100">
							{selectedMcpClients.join(", ")}
						</span>
					</div>
				)}
				{integrationMode === "cli" && selectedAgentFiles.length > 0 && (
					<div className="flex justify-between">
						<span className="text-gray-600 dark:text-gray-400">Agent Files:</span>
						<span className="font-medium text-gray-900 dark:text-gray-100">
							{selectedAgentFiles.length} files
						</span>
					</div>
				)}
				{integrationMode === "cli" && installClaudeAgent && (
					<div className="flex justify-between">
						<span className="text-gray-600 dark:text-gray-400">Claude Agent:</span>
						<span className="font-medium text-green-600 dark:text-green-400">Will be installed</span>
					</div>
				)}
				<div className="flex justify-between">
					<span className="text-gray-600 dark:text-gray-400">Advanced Config:</span>
					<span className="font-medium text-gray-900 dark:text-gray-100">
						{showAdvancedConfig ? "Customized" : "Defaults"}
					</span>
				</div>
				{showAdvancedConfig && advancedConfig.taskPrefix && (
					<div className="flex justify-between">
						<span className="text-gray-600 dark:text-gray-400">Task Prefix:</span>
						<span className="font-medium text-gray-900 dark:text-gray-100">
							{advancedConfig.taskPrefix.toUpperCase()}
						</span>
					</div>
				)}
			</div>

			{Object.keys(mcpSetupResults).length > 0 && (
				<div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
					<h3 className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-2">Setup Progress:</h3>
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
				return true;
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
					<h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Initialize Backlog.md</h1>
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
							Back
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
									Initializing...
								</span>
							) : (
								"Initialize Project"
							)}
						</button>
					) : (
							<button
								type="button"
								onClick={handleNext}
								disabled={!canProceed()}
								className="px-6 py-2 bg-blue-500 dark:bg-blue-600 text-white rounded-lg hover:bg-blue-600 dark:hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:focus:ring-blue-500 disabled:opacity-50 transition-colors duration-200 font-medium"
							>
								Next
							</button>
					)}
				</div>
			</div>
		</div>
	);
};

export default InitializationScreen;
