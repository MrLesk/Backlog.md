import { AsyncLocalStorage } from "node:async_hooks";
import { spawn } from "node:child_process";
import { mkdtemp, open, readFile, realpath, rename, rm, stat, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, isAbsolute, join, relative } from "node:path";
import { createInterface } from "node:readline";
import { $ } from "bun";
import type { BacklogConfig } from "../types/index.ts";
import {
	type AutomaticCommitOperation,
	buildAutomaticCommitMessage,
	createAutomaticCommitOperation,
} from "./automatic-commit-message.ts";

type GitPathContext = {
	repoRoot: string;
	relativePath: string;
};

type GitConfigLoader = () => Promise<BacklogConfig | null>;

export interface GitBranchTip {
	name: string;
	commit: string;
	current: boolean;
}

export interface GitTreeEntry {
	path: string;
	objectId: string;
}

export interface GitIndexEntry {
	mode: string;
	objectId: string;
	stage: number;
}

export type GitAutomaticCommitIntent = "new" | "start-owned" | "amend-own";

export interface GitCommitOptions {
	automaticCommitIntent?: GitAutomaticCommitIntent;
	operation?: AutomaticCommitOperation | readonly AutomaticCommitOperation[];
}

export type GitOperationConfig = Readonly<
	Pick<BacklogConfig, "filesystemOnly" | "bypassGitHooks" | "remoteOperations">
>;

export interface GitCommitResult {
	commitId: string;
	previousCommitId: string | null;
	amended: boolean;
	ownershipRecorded: boolean;
}

type OwnedCommit = {
	commitId: string;
	branchRef: string;
	reflogSnapshot: string;
	parents: string[];
	authorEnv: Record<string, string>;
	message: string;
};

const AUTOMATIC_COMMIT_REFLOG_MARKER = "backlog:auto-commit/v1";

class SelectedPathConflictError extends Error {
	constructor() {
		super("Git selected paths changed concurrently before the commit could be finalized");
		this.name = "SelectedPathConflictError";
	}
}

class ReferenceTransactionVetoError extends Error {
	constructor(error: unknown) {
		const message = error instanceof Error ? error.message : String(error);
		super(`Reference-transaction prepared hook rejected the ref update: ${message}`);
		this.name = "ReferenceTransactionVetoError";
	}
}

function indexEntriesEqual(left: readonly GitIndexEntry[], right: readonly GitIndexEntry[]): boolean {
	return (
		left.length === right.length &&
		left.every(
			(entry, index) =>
				entry.mode === right[index]?.mode &&
				entry.objectId === right[index]?.objectId &&
				entry.stage === right[index]?.stage,
		)
	);
}

function parseIndexEntries(output: string): GitIndexEntry[] {
	return output
		.split("\0")
		.filter(Boolean)
		.flatMap((record) => {
			const tabIndex = record.indexOf("\t");
			if (tabIndex < 0) return [];
			const [mode, objectId, stageText] = record.slice(0, tabIndex).split(" ");
			const stage = Number(stageText);
			if (!mode || !objectId || !Number.isInteger(stage)) return [];
			return [{ mode, objectId, stage }];
		});
}

export class GitOperations {
	private projectRoot: string;
	private config: BacklogConfig | null = null;
	private readonly configLoader?: GitConfigLoader;
	private readonly operationConfigContext = new AsyncLocalStorage<{ config: GitOperationConfig | null }>();
	private hookRunSupported?: boolean;

	constructor(projectRoot: string, config: BacklogConfig | null = null, configLoader?: GitConfigLoader) {
		this.projectRoot = projectRoot;
		this.config = config;
		this.configLoader = configLoader;
	}

	setConfig(config: BacklogConfig | null): void {
		this.config = config;
	}

	async withConfig<T>(config: GitOperationConfig | null, action: () => Promise<T>): Promise<T> {
		return await this.operationConfigContext.run({ config }, action);
	}

	private operationConfig(): GitOperationConfig | BacklogConfig | null {
		const context = this.operationConfigContext.getStore();
		return context ? context.config : this.config;
	}

	private async loadConfigIfNeeded(): Promise<void> {
		if (this.operationConfigContext.getStore() || this.config || !this.configLoader) {
			return;
		}
		try {
			this.config = await this.configLoader();
		} catch {
			this.config = null;
		}
	}

	async isRepository(cwd = this.projectRoot): Promise<boolean> {
		await this.loadConfigIfNeeded();
		if (this.operationConfig()?.filesystemOnly) {
			return false;
		}
		return await isGitRepository(cwd);
	}

	async addFile(filePath: string): Promise<void> {
		const context = await this.getPathContext(filePath);
		if (context) {
			await this.execGit(["add", context.relativePath], { cwd: context.repoRoot });
			return;
		}
		if (!(await this.isRepository())) {
			return;
		}

		// Convert absolute paths to relative paths from project root to avoid Windows encoding issues
		const relativePath = relative(this.projectRoot, filePath).replace(/\\/g, "/");
		await this.execGit(["add", relativePath]);
	}

	async addFiles(filePaths: string[]): Promise<void> {
		if (filePaths.length === 0 || !(await this.isRepository())) {
			return;
		}
		// Convert absolute paths to relative paths from project root to avoid Windows encoding issues
		const relativePaths = filePaths.map((filePath) => relative(this.projectRoot, filePath).replace(/\\/g, "/"));
		await this.execGit(["add", ...relativePaths]);
	}

	async commitTaskChange(
		taskId: string,
		message: string,
		filePath?: string,
		options: GitCommitOptions = {},
	): Promise<GitCommitResult | null> {
		const commitMessage = `${taskId} - ${message}`;
		if (filePath) {
			return await this.commitFiles(commitMessage, [filePath], undefined, options);
		}
		const args = ["commit", "-m", commitMessage];
		if (this.operationConfig()?.bypassGitHooks) {
			args.push("--no-verify");
		}
		const repoRoot = filePath ? (await this.getPathContext(filePath))?.repoRoot : undefined;
		if (!(await this.isRepository(repoRoot ?? this.projectRoot))) {
			return null;
		}
		await this.execGit(args, { cwd: repoRoot });
		return null;
	}

	async commitChanges(message: string, repoRoot?: string | null): Promise<void> {
		if (!(await this.isRepository(repoRoot ?? this.projectRoot))) {
			return;
		}
		const args = ["commit", "-m", message];
		if (this.operationConfig()?.bypassGitHooks) {
			args.push("--no-verify");
		}
		await this.execGit(args, { cwd: repoRoot ?? undefined });
	}

	async commitFiles(
		message: string,
		filePaths: string[],
		repoRoot?: string | null,
		options: GitCommitOptions = {},
	): Promise<GitCommitResult | null> {
		const uniqueFilePaths = Array.from(new Set(filePaths.map((path) => path.trim()).filter((path) => path.length > 0)));
		if (uniqueFilePaths.length === 0) return null;

		const resolvedRepoRoot =
			repoRoot ?? (await this.getPathContext(uniqueFilePaths[0] ?? ""))?.repoRoot ?? this.projectRoot;
		if (!(await this.isRepository(resolvedRepoRoot))) return null;
		const relativePaths: string[] = [];
		for (const filePath of uniqueFilePaths) {
			const relativePath = await this.getRelativePathForRepo(filePath, resolvedRepoRoot);
			relativePaths.push(relativePath ?? filePath);
		}
		const uniqueRelativePaths = Array.from(new Set(relativePaths.filter((path) => path.length > 0)));
		if (uniqueRelativePaths.length === 0) return null;

		const { stdout: stagedForPaths } = await this.execGit(
			["diff", "--name-only", "--cached", "--", ...uniqueRelativePaths],
			{ cwd: resolvedRepoRoot, readOnly: true },
		);
		if (!stagedForPaths.trim()) return null;

		await this.assertNoCommitOperationInProgress(resolvedRepoRoot);
		let ownedEntries = new Map<string, GitIndexEntry[]>();
		for (const relativePath of uniqueRelativePaths) {
			ownedEntries.set(relativePath, await this.getIndexEntries(join(resolvedRepoRoot, relativePath)));
		}
		let commitEntries = ownedEntries;

		const temporaryDirectory = await mkdtemp(join(tmpdir(), "backlog-git-commit-"));
		const temporaryIndexEnv = { GIT_INDEX_FILE: join(temporaryDirectory, "index") };
		const messagePath = join(temporaryDirectory, "message");
		try {
			const signCommit = await this.shouldSignCommit(resolvedRepoRoot);
			const intent = options.automaticCommitIntent ?? "new";
			const rollingOperation = options.operation ?? message;
			const initialHead = await this.resolveHead(resolvedRepoRoot);
			let selectedPathBaseHead = initialHead;
			await this.populateTemporaryIndex(resolvedRepoRoot, temporaryIndexEnv, initialHead, commitEntries);
			if (!this.operationConfig()?.bypassGitHooks) {
				await this.runCommitHook("pre-commit", [], resolvedRepoRoot, temporaryIndexEnv);
			}
			commitEntries = await this.readSelectedIndexEntries(uniqueRelativePaths, resolvedRepoRoot, temporaryIndexEnv);
			let lastHeadUpdateError: Error | undefined;

			for (let attempt = 1; attempt <= 3; attempt += 1) {
				await this.assertNoCommitOperationInProgress(resolvedRepoRoot);
				const baseHead = await this.resolveHead(resolvedRepoRoot);
				const baseBranchRef = await this.getCurrentBranchRef(resolvedRepoRoot);
				if (
					baseHead !== selectedPathBaseHead &&
					!(await this.selectedTreeEntriesMatch(resolvedRepoRoot, selectedPathBaseHead, baseHead, uniqueRelativePaths))
				) {
					throw new SelectedPathConflictError();
				}
				selectedPathBaseHead = baseHead;
				let ownedCommit =
					intent === "amend-own" && baseHead
						? await this.getOwnedCommit(resolvedRepoRoot, baseHead, baseBranchRef)
						: null;
				let commitMessage: string;
				if (intent === "new") {
					commitMessage = `${message.replace(/\n+$/, "")}\n`;
				} else {
					let automaticMessage = buildAutomaticCommitMessage(rollingOperation, ownedCommit?.message);
					if (!automaticMessage && ownedCommit) {
						ownedCommit = null;
						automaticMessage = buildAutomaticCommitMessage(rollingOperation);
					}
					if (!automaticMessage) throw new Error("Automatic commit message must have a non-empty subject");
					commitMessage = automaticMessage.message;
				}
				if (!commitMessage.split("\n", 1)[0]?.trim()) {
					throw new Error("Automatic commit message must have a non-empty subject");
				}

				await writeFile(messagePath, commitMessage);
				await this.runCommitHook("prepare-commit-msg", [messagePath, "message"], resolvedRepoRoot, temporaryIndexEnv);
				if (!this.operationConfig()?.bypassGitHooks) {
					await this.runCommitHook("commit-msg", [messagePath], resolvedRepoRoot, temporaryIndexEnv);
				}
				await this.assertNoCommitOperationInProgress(resolvedRepoRoot);
				if (ownedCommit) await this.assertOwnedCommitUnchanged(resolvedRepoRoot, ownedCommit);

				await this.populateTemporaryIndex(resolvedRepoRoot, temporaryIndexEnv, baseHead, commitEntries);
				const { stdout: treeOutput } = await this.execGit(["write-tree"], {
					cwd: resolvedRepoRoot,
					env: temporaryIndexEnv,
				});
				const treeId = treeOutput.trim();
				if (baseHead) {
					const { stdout: baseTreeOutput } = await this.execGit(["rev-parse", `${baseHead}^{tree}`], {
						cwd: resolvedRepoRoot,
						readOnly: true,
					});
					if (treeId === baseTreeOutput.trim()) {
						throw new Error("No staged changes to commit for the selected paths");
					}
				}

				const parents = ownedCommit?.parents ?? (baseHead ? [baseHead] : []);
				const commitArgs = ["commit-tree", ...(signCommit ? ["-S"] : []), treeId];
				for (const parent of parents) commitArgs.push("-p", parent);
				commitArgs.push("-F", messagePath);
				const { stdout: commitOutput } = await this.execGit(commitArgs, {
					cwd: resolvedRepoRoot,
					env: { ...temporaryIndexEnv, ...ownedCommit?.authorEnv },
				});
				const commitId = commitOutput.trim();

				for (const relativePath of uniqueRelativePaths) {
					const reconciled = await this.restoreIndexEntriesIfMatches(
						join(resolvedRepoRoot, relativePath),
						ownedEntries.get(relativePath) ?? [],
						commitEntries.get(relativePath) ?? [],
					);
					if (!reconciled) {
						throw new Error(`Git index changed before the selected commit could be finalized: ${relativePath}`);
					}
				}
				ownedEntries = commitEntries;

				try {
					await this.assertNoCommitOperationInProgress(resolvedRepoRoot);
					if (ownedCommit) await this.assertOwnedCommitUnchanged(resolvedRepoRoot, ownedCommit);
					const finalMessage = await Bun.file(messagePath).text();
					const subject = finalMessage.split("\n", 1)[0]?.trim() || "automatic commit";
					const reflogMessage =
						intent === "new" ? `commit: ${subject}` : `${AUTOMATIC_COMMIT_REFLOG_MARKER} ${subject}`;
					const validateMutationState = async (): Promise<void> => {
						await this.assertNoCommitOperationInProgress(resolvedRepoRoot);
						for (const relativePath of uniqueRelativePaths) {
							const currentEntries = await this.getIndexEntries(join(resolvedRepoRoot, relativePath));
							if (!indexEntriesEqual(currentEntries, commitEntries.get(relativePath) ?? [])) {
								throw new Error(`Git index changed before the selected commit could be finalized: ${relativePath}`);
							}
						}
					};
					await this.updateHeadRef(
						resolvedRepoRoot,
						baseBranchRef,
						baseHead,
						commitId,
						reflogMessage,
						async () => {
							await validateMutationState();
							if (ownedCommit) await this.assertOwnedCommitUnchanged(resolvedRepoRoot, ownedCommit);
						},
						ownedCommit && baseBranchRef
							? async () => {
									await validateMutationState();
									if (await this.isCommitShared(resolvedRepoRoot, ownedCommit.commitId, baseBranchRef)) {
										throw new Error("Owned Backlog commit became shared during finalization");
									}
								}
							: undefined,
					);
					await this.runCommitHook("post-commit", [], resolvedRepoRoot, {}).catch(() => undefined);
					if (ownedCommit) {
						await this.runCommitHook(
							"post-rewrite",
							["amend"],
							resolvedRepoRoot,
							{},
							`${ownedCommit.commitId} ${commitId}\n`,
						).catch(() => undefined);
					}
					const ownershipRecorded =
						intent !== "new" && baseBranchRef
							? await this.hasOwnershipEvidence(resolvedRepoRoot, baseBranchRef, commitId)
							: false;
					return {
						commitId,
						previousCommitId: baseHead,
						amended: ownedCommit !== null,
						ownershipRecorded,
					};
				} catch (error) {
					lastHeadUpdateError = error instanceof Error ? error : new Error(String(error));
					if (error instanceof ReferenceTransactionVetoError) throw error;
					if ((await this.resolveHead(resolvedRepoRoot)) === baseHead) throw lastHeadUpdateError;
				}
			}

			throw new Error(`Git HEAD kept changing while committing selected paths: ${lastHeadUpdateError?.message}`);
		} finally {
			await rm(temporaryDirectory, { recursive: true, force: true }).catch(() => undefined);
		}
	}

	/**
	 * Advance the exact HEAD identity observed by the CAS attempt without allowing
	 * a same-OID detached/branch switch to redirect the update. The real index and
	 * HEAD locks are acquired in Git order before the caller revalidates every
	 * mutation-sensitive invariant. A synthetic per-worktree context shares the
	 * repository's common refs but has an unrelated HEAD, allowing named-branch
	 * update-ref to run without trying to reacquire the leased worktree HEAD.
	 */
	private async updateHeadRef(
		repoRoot: string,
		branchRef: string | null,
		expectedCommit: string | null,
		newCommit: string,
		reflogMessage: string,
		validateLease: () => Promise<void>,
		validateNamedUpdate?: () => Promise<void>,
	): Promise<void> {
		const { stdout: headPathOutput } = await this.execGit(["rev-parse", "--git-path", "HEAD"], {
			cwd: repoRoot,
			readOnly: true,
		});
		const configuredHeadPath = headPathOutput.trim();
		if (!configuredHeadPath) throw new Error("Git did not report a HEAD path");
		const headPath = isAbsolute(configuredHeadPath) ? configuredHeadPath : join(repoRoot, configuredHeadPath);
		const { stdout: indexPathOutput } = await this.execGit(["rev-parse", "--git-path", "index"], {
			cwd: repoRoot,
			readOnly: true,
		});
		const configuredIndexPath = indexPathOutput.trim();
		if (!configuredIndexPath) throw new Error("Git did not report an index path");
		const indexPath = isAbsolute(configuredIndexPath) ? configuredIndexPath : join(repoRoot, configuredIndexPath);
		const { stdout: commonDirectoryOutput } = await this.execGit(["rev-parse", "--git-common-dir"], {
			cwd: repoRoot,
			readOnly: true,
		});
		const configuredCommonDirectory = commonDirectoryOutput.trim();
		if (!configuredCommonDirectory) throw new Error("Git did not report a common directory");
		const commonDirectory = isAbsolute(configuredCommonDirectory)
			? configuredCommonDirectory
			: join(repoRoot, configuredCommonDirectory);
		const indexLockPath = `${indexPath}.lock`;
		const headLockPath = `${headPath}.lock`;
		const refUpdateDirectory = await mkdtemp(join(tmpdir(), "backlog-git-ref-update-"));
		const hooksDisabledEnv = {
			GIT_CONFIG_COUNT: "1",
			GIT_CONFIG_KEY_0: "core.hooksPath",
			GIT_CONFIG_VALUE_0: join(refUpdateDirectory, "disabled-hooks"),
		};
		const referenceName = branchRef ?? "HEAD";
		const referenceTransactionInput = `${expectedCommit ?? "0".repeat(newCommit.length)} ${newCommit} ${referenceName}\n`;
		let updated = false;
		let referenceTransactionSucceeded = false;
		let replacedDetachedHead = false;
		try {
			const indexLock = await open(indexLockPath, "wx");
			try {
				const headLock = await open(headLockPath, "wx");
				try {
					const validateHeadAndLease = async (): Promise<void> => {
						if ((await this.getCurrentBranchRef(repoRoot)) !== branchRef) {
							throw new Error("Git HEAD identity changed before the selected commit could be finalized");
						}
						if ((await this.resolveHead(repoRoot)) !== expectedCommit) {
							throw new Error("Git HEAD changed before the selected commit could be finalized");
						}
						await validateLease();
					};
					await validateHeadAndLease();
					let referenceTransactionPending = true;
					try {
						try {
							await this.runCommitHook("reference-transaction", ["prepared"], repoRoot, {}, referenceTransactionInput);
						} catch (error) {
							await this.runCommitHook(
								"reference-transaction",
								["aborted"],
								repoRoot,
								{},
								referenceTransactionInput,
							).catch(() => undefined);
							referenceTransactionPending = false;
							throw new ReferenceTransactionVetoError(error);
						}
						await validateHeadAndLease();
						if (branchRef) {
							await Promise.all([
								writeFile(join(refUpdateDirectory, "commondir"), `${commonDirectory}\n`),
								writeFile(join(refUpdateDirectory, "HEAD"), "ref: refs/backlog/ref-update-context\n"),
							]);
							await this.updateBranchRefTransaction(
								repoRoot,
								refUpdateDirectory,
								branchRef,
								expectedCommit,
								newCommit,
								reflogMessage,
								hooksDisabledEnv,
								async () => {
									// `prepare` owns the target ref lock. Rechecking the complete
									// lease here closes same-OID reflog ABA between the real hook
									// validation and the final branch movement.
									await validateHeadAndLease();
									if (validateNamedUpdate) await validateNamedUpdate();
								},
							);
							if (validateNamedUpdate) {
								try {
									await validateNamedUpdate();
								} catch (error) {
									await this.execGit(
										[
											"update-ref",
											"-m",
											"reset: Backlog finalization lease invalidated",
											branchRef,
											expectedCommit ?? "",
											newCommit,
										],
										{ cwd: repoRoot, env: { ...hooksDisabledEnv, GIT_DIR: refUpdateDirectory } },
									);
									throw error;
								}
							}
						} else {
							const currentHead = (await readFile(headPath, "utf8")).trim();
							if (!expectedCommit || currentHead !== expectedCommit) {
								throw new Error("Detached Git HEAD changed before the selected commit could be finalized");
							}
							await headLock.writeFile(`${newCommit}\n`);
							await headLock.sync();
							await headLock.close();
							await rename(headLockPath, headPath);
							replacedDetachedHead = true;
						}
						updated = true;
						referenceTransactionPending = false;
						referenceTransactionSucceeded = true;
					} catch (error) {
						if (referenceTransactionPending) {
							await this.runCommitHook(
								"reference-transaction",
								["aborted"],
								repoRoot,
								{},
								referenceTransactionInput,
							).catch(() => undefined);
						}
						throw error;
					}
				} finally {
					await headLock.close().catch(() => undefined);
					if (!replacedDetachedHead) await unlink(headLockPath).catch(() => undefined);
				}
			} finally {
				await indexLock.close().catch(() => undefined);
				await unlink(indexLockPath).catch(() => undefined);
			}
		} finally {
			await rm(refUpdateDirectory, { recursive: true, force: true }).catch(() => undefined);
		}
		// The protected update writes a branch reflog (named) or HEAD itself
		// (detached). Restore the normal worktree HEAD reflog with an OID no-op.
		if (updated && (await this.resolveHead(repoRoot)) === newCommit) {
			await this.execGit(["update-ref", "-m", reflogMessage, "HEAD", newCommit, newCommit], {
				cwd: repoRoot,
				env: hooksDisabledEnv,
			}).catch(() => undefined);
		}
		if (referenceTransactionSucceeded) {
			await this.runCommitHook("reference-transaction", ["committed"], repoRoot, {}, referenceTransactionInput).catch(
				() => undefined,
			);
		}
	}

	/**
	 * Prepare a hook-suppressed update-ref transaction and keep its target-ref
	 * lock held while the caller revalidates branch ownership and mutation state.
	 * This is the only boundary that can distinguish an expected-OID CAS from an
	 * old→other→old reflog ABA in the last window before branch movement.
	 */
	private async updateBranchRefTransaction(
		repoRoot: string,
		gitDirectory: string,
		branchRef: string,
		expectedCommit: string | null,
		newCommit: string,
		reflogMessage: string,
		hooksDisabledEnv: Record<string, string>,
		validatePreparedUpdate: () => Promise<void>,
	): Promise<void> {
		const subprocess = spawn("git", ["update-ref", "--stdin", "-m", reflogMessage], {
			cwd: repoRoot,
			env: { ...process.env, ...hooksDisabledEnv, GIT_DIR: gitDirectory },
			stdio: ["pipe", "pipe", "pipe"],
		});
		let stderr = "";
		subprocess.stderr.setEncoding("utf8");
		subprocess.stderr.on("data", (chunk: string) => {
			stderr += chunk;
		});
		const responses = createInterface({ input: subprocess.stdout, crlfDelay: Number.POSITIVE_INFINITY })[
			Symbol.asyncIterator
		]();
		const closed = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve, reject) => {
			subprocess.once("error", reject);
			subprocess.once("close", (code, signal) => resolve({ code, signal }));
		});
		let transactionPrepared = false;
		let transactionFinished = false;
		let failure: unknown;

		const sendAndExpect = async (command: string, expectedResponse: string): Promise<void> => {
			if (!subprocess.stdin.write(`${command}\n`)) {
				await new Promise<void>((resolve) => subprocess.stdin.once("drain", resolve));
			}
			const response = await responses.next();
			if (response.done || response.value !== expectedResponse) {
				throw new Error(
					`Git update-ref transaction rejected ${command}: ${response.done ? "no response" : response.value}`,
				);
			}
		};

		try {
			await sendAndExpect("start", "start: ok");
			if (
				!subprocess.stdin.write(`update ${branchRef} ${newCommit} ${expectedCommit ?? "0".repeat(newCommit.length)}\n`)
			) {
				await new Promise<void>((resolve) => subprocess.stdin.once("drain", resolve));
			}
			await sendAndExpect("prepare", "prepare: ok");
			transactionPrepared = true;
			await validatePreparedUpdate();
			await sendAndExpect("commit", "commit: ok");
			transactionFinished = true;
		} catch (error) {
			failure = error;
			if (transactionPrepared && !transactionFinished) {
				await sendAndExpect("abort", "abort: ok").catch(() => undefined);
				transactionFinished = true;
			}
		} finally {
			subprocess.stdin.end();
		}

		const result = await closed;
		if (failure) throw failure;
		if (result.code !== 0) {
			const termination = result.signal ? `signal ${result.signal}` : `exit code ${result.code}`;
			throw new Error(`Git update-ref transaction failed (${termination}): ${stderr.trim()}`);
		}
	}

	private async selectedTreeEntriesMatch(
		repoRoot: string,
		beforeCommit: string | null,
		afterCommit: string | null,
		relativePaths: string[],
	): Promise<boolean> {
		const readEntries = async (commit: string | null): Promise<string> => {
			if (!commit) return "";
			const { stdout } = await this.execGit(["ls-tree", "-r", "-z", "--full-tree", commit, "--", ...relativePaths], {
				cwd: repoRoot,
				readOnly: true,
			});
			return stdout;
		};
		const [beforeEntries, afterEntries] = await Promise.all([readEntries(beforeCommit), readEntries(afterCommit)]);
		return beforeEntries === afterEntries;
	}

	private async getCurrentBranchRef(repoRoot: string): Promise<string | null> {
		const { stdout } = await this.execGit(["symbolic-ref", "--quiet", "HEAD"], {
			cwd: repoRoot,
			readOnly: true,
			acceptedExitCodes: [1],
		});
		const branchRef = stdout.trim();
		return branchRef.startsWith("refs/heads/") ? branchRef : null;
	}

	/**
	 * Ownership evidence format: the newest branch reflog entry must point to the
	 * candidate SHA and its subject must start with AUTOMATIC_COMMIT_REFLOG_MARKER.
	 * The two newest entries are snapshotted while planning a replacement so an
	 * away-and-back update cannot preserve eligibility through the same SHA.
	 */
	private async readOwnershipEvidence(
		repoRoot: string,
		branchRef: string,
		candidate: string,
	): Promise<{ reflogSnapshot: string } | null> {
		const { stdout } = await this.execGit(["reflog", "show", "-2", "--format=%H%x00%gs", branchRef], {
			cwd: repoRoot,
			readOnly: true,
			acceptedExitCodes: [1, 128],
		});
		const reflogSnapshot = stdout.replace(/\n$/, "");
		const firstLine = reflogSnapshot.split("\n", 1)[0];
		if (!firstLine) return null;
		const fields = firstLine.split("\0");
		if (
			fields.length !== 2 ||
			fields[0] !== candidate ||
			!(fields[1] === AUTOMATIC_COMMIT_REFLOG_MARKER || fields[1]?.startsWith(`${AUTOMATIC_COMMIT_REFLOG_MARKER} `))
		) {
			return null;
		}
		return { reflogSnapshot };
	}

	private async hasOwnershipEvidence(repoRoot: string, branchRef: string, candidate: string): Promise<boolean> {
		return (await this.readOwnershipEvidence(repoRoot, branchRef, candidate)) !== null;
	}

	private async refsContaining(repoRoot: string, candidate: string, prefix: string): Promise<string[]> {
		const { stdout } = await this.execGit(["for-each-ref", `--contains=${candidate}`, "--format=%(refname)", prefix], {
			cwd: repoRoot,
			readOnly: true,
		});
		return stdout
			.split("\n")
			.map((ref) => ref.trim())
			.filter(Boolean);
	}

	private async isCommitShared(repoRoot: string, candidate: string, currentBranchRef: string): Promise<boolean> {
		if ((await this.refsContaining(repoRoot, candidate, "refs/remotes")).length > 0) return true;
		const otherBranches = (await this.refsContaining(repoRoot, candidate, "refs/heads")).filter(
			(ref) => ref !== currentBranchRef,
		);
		return otherBranches.length > 0 || (await this.refsContaining(repoRoot, candidate, "refs/tags")).length > 0;
	}

	private async getOwnedCommit(
		repoRoot: string,
		candidate: string,
		expectedBranchRef?: string | null,
	): Promise<OwnedCommit | null> {
		const branchRef = expectedBranchRef === undefined ? await this.getCurrentBranchRef(repoRoot) : expectedBranchRef;
		if (!branchRef) return null;
		const evidence = await this.readOwnershipEvidence(repoRoot, branchRef, candidate);
		if (!evidence) return null;

		const { stdout: parentOutput } = await this.execGit(["rev-list", "--parents", "-n", "1", candidate], {
			cwd: repoRoot,
			readOnly: true,
		});
		const [, ...parents] = parentOutput.trim().split(/\s+/);
		if (parents.length > 1) return null;
		if (await this.isCommitShared(repoRoot, candidate, branchRef)) return null;

		const { stdout: authorOutput } = await this.execGit(["show", "-s", "--format=%an%x00%ae%x00%aI", candidate], {
			cwd: repoRoot,
			readOnly: true,
		});
		const [authorName, authorEmail, authorDate] = authorOutput.replace(/\n$/, "").split("\0");
		if (!authorName || !authorEmail || !authorDate) return null;
		const { stdout: commitObject } = await this.execGit(["cat-file", "commit", candidate], {
			cwd: repoRoot,
			readOnly: true,
		});
		const messageOffset = commitObject.indexOf("\n\n");
		if (messageOffset < 0) return null;
		const commitMessage = commitObject.slice(messageOffset + 2);
		return {
			commitId: candidate,
			branchRef,
			reflogSnapshot: evidence.reflogSnapshot,
			parents,
			authorEnv: {
				GIT_AUTHOR_NAME: authorName,
				GIT_AUTHOR_EMAIL: authorEmail,
				GIT_AUTHOR_DATE: authorDate,
			},
			message: commitMessage,
		};
	}

	private async assertOwnedCommitUnchanged(repoRoot: string, expected: OwnedCommit): Promise<void> {
		const current = await this.getOwnedCommit(repoRoot, expected.commitId);
		if (!current || current.branchRef !== expected.branchRef || current.reflogSnapshot !== expected.reflogSnapshot) {
			throw new Error("Owned Backlog commit eligibility changed during Git hooks; refusing to rewrite it");
		}
	}

	private async assertNoCommitOperationInProgress(repoRoot: string): Promise<void> {
		const operationMarkers = [
			{ path: "MERGE_HEAD", name: "merge" },
			{ path: "rebase-merge", name: "rebase" },
			{ path: "rebase-apply", name: "rebase" },
			{ path: "CHERRY_PICK_HEAD", name: "cherry-pick" },
			{ path: "REVERT_HEAD", name: "revert" },
		] as const;

		for (const marker of operationMarkers) {
			const { stdout } = await this.execGit(["rev-parse", "--git-path", marker.path], {
				cwd: repoRoot,
				readOnly: true,
			});
			const configuredPath = stdout.trim();
			if (!configuredPath) continue;
			const markerPath = isAbsolute(configuredPath) ? configuredPath : join(repoRoot, configuredPath);
			if (await stat(markerPath).catch(() => null)) {
				throw new Error(`Cannot auto-commit selected files while a Git ${marker.name} is in progress`);
			}
		}
	}

	private async resolveHead(repoRoot: string): Promise<string | null> {
		try {
			const { stdout } = await this.execGit(["rev-parse", "--verify", "HEAD"], { cwd: repoRoot, readOnly: true });
			return stdout.trim() || null;
		} catch {
			return null;
		}
	}

	private async shouldSignCommit(repoRoot: string): Promise<boolean> {
		const { stdout } = await this.execGit(["config", "--bool", "--get", "commit.gpgSign"], {
			cwd: repoRoot,
			readOnly: true,
			acceptedExitCodes: [1],
		});
		return stdout.trim() === "true";
	}

	private async readSelectedIndexEntries(
		relativePaths: readonly string[],
		repoRoot: string,
		env: Record<string, string>,
	): Promise<Map<string, GitIndexEntry[]>> {
		const entries = new Map<string, GitIndexEntry[]>();
		for (const relativePath of relativePaths) {
			const { stdout } = await this.execGit(["ls-files", "-s", "-z", "--", relativePath], {
				cwd: repoRoot,
				readOnly: true,
				env,
			});
			entries.set(relativePath, parseIndexEntries(stdout));
		}
		return entries;
	}

	private async populateTemporaryIndex(
		repoRoot: string,
		env: Record<string, string>,
		baseHead: string | null,
		selectedEntries: ReadonlyMap<string, readonly GitIndexEntry[]>,
	): Promise<void> {
		await this.execGit(baseHead ? ["read-tree", baseHead] : ["read-tree", "--empty"], { cwd: repoRoot, env });
		for (const [relativePath, entries] of selectedEntries) {
			await this.execGit(["update-index", "--force-remove", "--", relativePath], { cwd: repoRoot, env });
			if (entries.length === 0) continue;
			await this.execGit(["update-index", "-z", "--index-info"], {
				cwd: repoRoot,
				env,
				input: entries.map((entry) => `${entry.mode} ${entry.objectId} ${entry.stage}\t${relativePath}\0`).join(""),
			});
		}
	}

	private async runCommitHook(
		hook: string,
		args: readonly string[],
		repoRoot: string,
		env: Record<string, string>,
		input?: string,
	): Promise<void> {
		const hookEnv = { ...env, GIT_EDITOR: ":" };
		if (await this.supportsHookRun(repoRoot)) {
			const stdinDirectory = input === undefined ? null : await mkdtemp(join(tmpdir(), "backlog-git-hook-stdin-"));
			try {
				const stdinPath = stdinDirectory ? join(stdinDirectory, "stdin") : null;
				if (stdinPath) await writeFile(stdinPath, input ?? "");
				await this.execGit(
					[
						"hook",
						"run",
						"--ignore-missing",
						...(stdinPath ? [`--to-stdin=${stdinPath}`] : []),
						hook,
						...(args.length > 0 ? ["--", ...args] : []),
					],
					{ cwd: repoRoot, env: hookEnv },
				);
			} finally {
				if (stdinDirectory) await rm(stdinDirectory, { recursive: true, force: true }).catch(() => undefined);
			}
			return;
		}
		await this.runLegacyCommitHook(hook, args, repoRoot, hookEnv, input);
	}

	private async supportsHookRun(repoRoot: string): Promise<boolean> {
		if (this.hookRunSupported !== undefined) return this.hookRunSupported;
		try {
			const { stdout } = await this.execGit(["version"], { cwd: repoRoot, readOnly: true });
			const match = stdout.match(/git version (\d+)\.(\d+)/);
			const major = Number(match?.[1]);
			const minor = Number(match?.[2]);
			this.hookRunSupported =
				Number.isInteger(major) && Number.isInteger(minor) && (major > 2 || (major === 2 && minor >= 36));
		} catch {
			this.hookRunSupported = false;
		}
		return this.hookRunSupported;
	}

	private async runLegacyCommitHook(
		hook: string,
		args: readonly string[],
		repoRoot: string,
		env: Record<string, string>,
		input?: string,
	): Promise<void> {
		const { stdout } = await this.execGit(["rev-parse", "--git-path", `hooks/${hook}`], {
			cwd: repoRoot,
			readOnly: true,
		});
		const configuredPath = stdout.trim();
		const hookPath = isAbsolute(configuredPath) ? configuredPath : join(repoRoot, configuredPath);
		const hookStat = await stat(hookPath).catch((error) => {
			if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
			throw error;
		});
		if (!hookStat) return;
		if (!hookStat.isFile() || (process.platform !== "win32" && (hookStat.mode & 0o111) === 0)) return;

		await this.execGit(["-c", 'alias.backlog-run-hook=!f() { "$@" 1>&2; }; f', "backlog-run-hook", hookPath, ...args], {
			cwd: repoRoot,
			env,
			input,
		});
	}

	async resetIndex(repoRoot?: string | null): Promise<void> {
		if (!(await this.isRepository(repoRoot ?? this.projectRoot))) {
			return;
		}
		// Reset the staging area without affecting working directory
		await this.execGit(["reset", "HEAD"], { cwd: repoRoot ?? undefined });
	}

	async resetPaths(filePaths: string[], repoRoot?: string | null): Promise<void> {
		const uniqueFilePaths = Array.from(new Set(filePaths.map((path) => path.trim()).filter((path) => path.length > 0)));
		if (uniqueFilePaths.length === 0) {
			return;
		}

		const resolvedRepoRoot =
			repoRoot ?? (await this.getPathContext(uniqueFilePaths[0] ?? ""))?.repoRoot ?? this.projectRoot;
		if (!(await this.isRepository(resolvedRepoRoot))) {
			return;
		}
		const relativePaths: string[] = [];
		for (const filePath of uniqueFilePaths) {
			const relativePath = await this.getRelativePathForRepo(filePath, resolvedRepoRoot);
			relativePaths.push(relativePath ?? filePath);
		}
		const uniqueRelativePaths = Array.from(new Set(relativePaths.filter((path) => path.length > 0)));
		if (uniqueRelativePaths.length === 0) {
			return;
		}

		await this.execGit(["reset", "HEAD", "--", ...uniqueRelativePaths], { cwd: resolvedRepoRoot });
	}

	async getIndexEntries(filePath: string): Promise<GitIndexEntry[]> {
		const context = await this.getPathContext(filePath);
		if (!context || !(await this.isRepository(context.repoRoot))) {
			return [];
		}
		const { stdout } = await this.execGit(["ls-files", "-s", "-z", "--", context.relativePath], {
			cwd: context.repoRoot,
			readOnly: true,
		});
		return parseIndexEntries(stdout);
	}

	async restoreIndexEntriesIfMatches(
		filePath: string,
		expectedEntries: readonly GitIndexEntry[],
		restoreEntries: readonly GitIndexEntry[],
	): Promise<boolean> {
		const context = await this.getPathContext(filePath);
		if (!context || !(await this.isRepository(context.repoRoot))) {
			return false;
		}
		const currentEntries = await this.getIndexEntries(filePath);
		if (!indexEntriesEqual(currentEntries, expectedEntries)) {
			return false;
		}
		if (indexEntriesEqual(currentEntries, restoreEntries)) {
			return true;
		}

		const objectIdLength = expectedEntries[0]?.objectId.length ?? restoreEntries[0]?.objectId.length ?? 40;
		const zeroObjectId = "0".repeat(objectIdLength);
		const records = [`0 ${zeroObjectId}\t${context.relativePath}\0`];
		for (const entry of restoreEntries) {
			records.push(`${entry.mode} ${entry.objectId} ${entry.stage}\t${context.relativePath}\0`);
		}
		await this.execGit(["update-index", "-z", "--index-info"], {
			cwd: context.repoRoot,
			input: records.join(""),
		});
		return true;
	}

	async commitStagedChanges(message: string, repoRoot?: string | null): Promise<void> {
		if (!(await this.isRepository(repoRoot ?? this.projectRoot))) {
			return;
		}
		// Check if there are any staged changes before committing
		const { stdout: status } = await this.execGit(["status", "--porcelain"], { cwd: repoRoot ?? undefined });
		const hasStagedChanges = status.split("\n").some((line) => line.match(/^[AMDRC]/));

		if (!hasStagedChanges) {
			throw new Error("No staged changes to commit");
		}

		const args = ["commit", "-m", message];
		if (this.operationConfig()?.bypassGitHooks) {
			args.push("--no-verify");
		}
		await this.execGit(args, { cwd: repoRoot ?? undefined });
	}

	async retryGitOperation<T>(operation: () => Promise<T>, operationName: string, maxRetries = 3): Promise<T> {
		let lastError: Error | undefined;

		for (let attempt = 1; attempt <= maxRetries; attempt++) {
			try {
				return await operation();
			} catch (error) {
				lastError = error instanceof Error ? error : new Error(String(error));

				if (process.env.DEBUG) {
					console.warn(
						`Git operation '${operationName}' failed on attempt ${attempt}/${maxRetries}:`,
						lastError.message,
					);
				}

				// Don't retry on the last attempt
				if (attempt === maxRetries) {
					break;
				}

				// Wait briefly before retrying (exponential backoff)
				await new Promise((resolve) => setTimeout(resolve, 2 ** (attempt - 1) * 100));
			}
		}

		throw new Error(`Git operation '${operationName}' failed after ${maxRetries} attempts: ${lastError?.message}`);
	}

	async getStatus(): Promise<string> {
		if (!(await this.isRepository())) {
			return "";
		}
		const { stdout } = await this.execGit(["status", "--porcelain"], { readOnly: true });
		return stdout;
	}

	async isClean(): Promise<boolean> {
		const status = await this.getStatus();
		return status.trim() === "";
	}

	async getCurrentBranch(): Promise<string> {
		if (!(await this.isRepository())) {
			return "";
		}
		const { stdout } = await this.execGit(["branch", "--show-current"], { readOnly: true });
		return stdout.trim();
	}

	async getRepositoryRoot(cwd = this.projectRoot): Promise<string | null> {
		return await this.resolveRepoRoot(cwd);
	}

	async listWorktreePaths(): Promise<string[]> {
		if (!(await this.isRepository())) {
			return [];
		}
		try {
			const { stdout } = await this.execGit(["worktree", "list", "--porcelain"], { readOnly: true });
			return stdout
				.split("\n")
				.map((line) => line.trimEnd())
				.filter((line) => line.startsWith("worktree "))
				.map((line) => line.slice("worktree ".length))
				.filter(Boolean);
		} catch {
			return [];
		}
	}

	async hasUncommittedChanges(): Promise<boolean> {
		const status = await this.getStatus();
		return status.trim() !== "";
	}

	async getLastCommitMessage(): Promise<string> {
		if (!(await this.isRepository())) {
			return "";
		}
		const { stdout } = await this.execGit(["log", "-1", "--pretty=format:%s"], { readOnly: true });
		return stdout.trim();
	}

	async fetch(remote = "origin"): Promise<void> {
		// Check if remote operations are disabled
		if (this.operationConfig()?.remoteOperations === false) {
			if (process.env.DEBUG) {
				console.warn("Remote operations are disabled in config. Skipping fetch.");
			}
			return;
		}

		// Preflight: skip if repository has no remotes configured
		const hasRemotes = await this.hasAnyRemote();
		if (!hasRemotes) {
			// No remotes configured; silently skip fetch. A consolidated warning is shown during init if applicable.
			return;
		}

		try {
			// Use --prune to remove dead refs and reduce later scans
			await this.execGit(["fetch", remote, "--prune", "--quiet"]);
		} catch (error) {
			// Check if this is a network-related error
			if (this.isNetworkError(error)) {
				// Don't show console warnings - let the calling code handle user messaging
				if (process.env.DEBUG) {
					console.warn(`Network error details: ${error}`);
				}
				return;
			}
			// Re-throw non-network errors
			throw error;
		}
	}

	private isNetworkError(error: unknown): boolean {
		if (typeof error === "string") {
			return this.containsNetworkErrorPattern(error);
		}
		if (error instanceof Error) {
			return this.containsNetworkErrorPattern(error.message);
		}
		return false;
	}

	private containsNetworkErrorPattern(message: string): boolean {
		const networkErrorPatterns = [
			"could not resolve host",
			"connection refused",
			"network is unreachable",
			"timeout",
			"no route to host",
			"connection timed out",
			"temporary failure in name resolution",
			"operation timed out",
		];

		const lowerMessage = message.toLowerCase();
		return networkErrorPatterns.some((pattern) => lowerMessage.includes(pattern));
	}
	async addAndCommitTaskFile(
		taskId: string,
		filePath: string,
		action: "create" | "update" | "archive",
		onStaged?: (entries: GitIndexEntry[]) => void,
		options: GitCommitOptions = {},
	): Promise<GitCommitResult | null> {
		const actionMessages = {
			create: `Create task ${taskId}`,
			update: `Update task ${taskId}`,
			archive: `Archive task ${taskId}`,
		};
		const actionVerbs = { create: "Create", update: "Update", archive: "Archive" } as const;
		const message = actionMessages[action];
		const commitOptions: GitCommitOptions = {
			...options,
			operation: options.operation ?? createAutomaticCommitOperation(message, actionVerbs[action], "task", [taskId]),
		};

		const context = await this.getPathContext(filePath);
		const repoRoot = context?.repoRoot ?? this.projectRoot;
		if (!(await this.isRepository(repoRoot))) {
			return null;
		}
		const pathForAdd = context?.relativePath ?? relative(this.projectRoot, filePath).replace(/\\/g, "/");
		const expectedWorkingHash = await this.hashFile(filePath);
		const initialIndexEntries = await this.getIndexEntries(filePath);
		let expectedIndexEntries = initialIndexEntries;
		let lastError: Error | undefined;

		for (let attempt = 1; attempt <= 3; attempt += 1) {
			if ((await this.hashFile(filePath)) !== expectedWorkingHash) {
				throw lastError ?? new Error(`Task file changed before it could be committed: ${filePath}`);
			}
			try {
				await this.execGit(["add", pathForAdd], { cwd: repoRoot });
				expectedIndexEntries = await this.getIndexEntries(filePath);
				onStaged?.(expectedIndexEntries);
				return await this.commitFiles(message, [filePath], repoRoot, commitOptions);
			} catch (error) {
				lastError = error instanceof Error ? error : new Error(String(error));
				if (error instanceof SelectedPathConflictError || error instanceof ReferenceTransactionVetoError) throw error;
				if (attempt === 3) break;
				const workingOwned = (await this.hashFile(filePath)) === expectedWorkingHash;
				const indexOwned = indexEntriesEqual(await this.getIndexEntries(filePath), expectedIndexEntries);
				if (!workingOwned || !indexOwned) throw lastError;
				await new Promise((resolve) => setTimeout(resolve, 2 ** (attempt - 1) * 100));
			}
		}

		throw new Error(`Git operation 'commit task file ${filePath}' failed after 3 attempts: ${lastError?.message}`);
	}

	async stageBacklogDirectory(backlogDir = "backlog"): Promise<string | null> {
		const context = await this.getPathContext(backlogDir);
		if (context) {
			const pathForAdd = context.relativePath === "." ? "." : context.relativePath;
			await this.execGit(["add", pathForAdd], { cwd: context.repoRoot });
			return context.repoRoot;
		}
		if (!(await this.isRepository())) {
			return null;
		}

		await this.execGit(["add", `${backlogDir}/`]);
		return null;
	}

	async stageFiles(filePaths: string[], repoRoot?: string | null): Promise<string | null> {
		const uniqueFilePaths = Array.from(new Set(filePaths.map((path) => path.trim()).filter((path) => path.length > 0)));
		if (uniqueFilePaths.length === 0) {
			return null;
		}

		const resolvedRepoRoot =
			repoRoot ?? (await this.getPathContext(uniqueFilePaths[0] ?? ""))?.repoRoot ?? this.projectRoot;
		if (!(await this.isRepository(resolvedRepoRoot))) {
			return null;
		}

		const relativePaths: string[] = [];
		for (const filePath of uniqueFilePaths) {
			const relativePath = await this.getRelativePathForRepo(filePath, resolvedRepoRoot);
			if (!relativePath) {
				throw new Error(`Cannot stage a path outside the Git repository: ${filePath}`);
			}
			const exists = await stat(join(resolvedRepoRoot, relativePath)).catch(() => null);
			const { stdout: tracked } = exists
				? { stdout: relativePath }
				: await this.execGit(["ls-files", "--cached", "-z", "--", relativePath], {
						cwd: resolvedRepoRoot,
						readOnly: true,
					});
			if (exists || tracked) relativePaths.push(relativePath);
		}
		const uniqueRelativePaths = Array.from(new Set(relativePaths));
		if (uniqueRelativePaths.length > 0) {
			await this.execGit(["add", "--all", "--", ...uniqueRelativePaths], { cwd: resolvedRepoRoot });
		}
		return resolvedRepoRoot === this.projectRoot ? null : resolvedRepoRoot;
	}

	async stageFileMove(fromPath: string, toPath: string): Promise<string | null> {
		return await this.stageFiles([fromPath, toPath]);
	}

	async listRemoteBranches(remote = "origin"): Promise<string[]> {
		try {
			// Fast-path: if no remotes, return empty
			if (!(await this.hasAnyRemote())) return [];
			const { stdout } = await this.execGit(["branch", "-r", "--format=%(refname:short)"], { readOnly: true });
			return stdout
				.split("\n")
				.map((l) => l.trim())
				.filter(Boolean)
				.filter((branch) => branch.startsWith(`${remote}/`))
				.map((branch) => branch.substring(`${remote}/`.length));
		} catch {
			// If remote doesn't exist or other error, return empty array
			return [];
		}
	}

	/**
	 * List remote branches that have been active within the specified days
	 * Much faster than listRemoteBranches for filtering old branches
	 */
	async listRecentRemoteBranches(daysAgo: number, remote = "origin"): Promise<string[]> {
		try {
			// Fast-path: if no remotes, return empty
			if (!(await this.hasAnyRemote())) return [];
			const { stdout } = await this.execGit(
				["for-each-ref", "--format=%(refname:short)|%(committerdate:iso8601)", `refs/remotes/${remote}`],
				{ readOnly: true },
			);
			const since = Date.now() - daysAgo * 24 * 60 * 60 * 1000;
			return (
				stdout
					.split("\n")
					.map((l) => l.trim())
					.filter(Boolean)
					.map((line) => {
						const [ref, iso] = line.split("|");
						return { ref, t: Date.parse(iso || "") };
					})
					.filter((x) => Number.isFinite(x.t) && x.t >= since && x.ref)
					.map((x) => x.ref?.replace(`${remote}/`, ""))
					// Filter out invalid/ambiguous entries that would normalize to empty or "origin"
					.filter((b): b is string => Boolean(b))
					.filter((b) => b !== "HEAD" && b !== remote && b !== `${remote}`)
			);
		} catch {
			return [];
		}
	}

	async listRecentBranches(daysAgo: number): Promise<string[]> {
		return (await this.listRecentBranchTips(daysAgo)).map((tip) => tip.name);
	}

	/**
	 * List recent branch names and immutable tips in one Git process.
	 * The result is sorted so callers can use it as a stable ref fingerprint.
	 */
	async listRecentBranchTips(daysAgo: number): Promise<GitBranchTip[]> {
		await this.loadConfigIfNeeded();
		if (this.operationConfig()?.filesystemOnly) {
			return [];
		}
		try {
			const since = Date.now() - daysAgo * 24 * 60 * 60 * 1000;

			// Build refs to check based on remoteOperations config
			const refs = ["refs/heads"];
			if (this.operationConfig()?.remoteOperations !== false) {
				refs.push("refs/remotes/origin");
			}

			// Get local and remote branches with commit dates
			const { stdout } = await this.execGit(
				["for-each-ref", "--format=%(HEAD)%00%(refname:short)%00%(objectname)%00%(committerdate:unix)", ...refs],
				{ readOnly: true },
			);

			return stdout
				.split("\n")
				.map((line) => line.trim())
				.filter(Boolean)
				.map((line) => {
					const [head, name, commit, timestamp] = line.split("\0");
					return { name, commit, current: head === "*", timestamp: Number(timestamp) * 1000 };
				})
				.filter(
					(entry): entry is GitBranchTip & { timestamp: number } =>
						Boolean(entry.name && entry.commit) &&
						entry.name !== "origin/HEAD" &&
						Number.isFinite(entry.timestamp) &&
						entry.timestamp >= since,
				)
				.map(({ name, commit, current }) => ({ name, commit, current }))
				.sort((left, right) => left.name.localeCompare(right.name));
		} catch {
			// Fallback to all branches if the command fails
			const branches = await this.listAllBranches();
			const currentBranch = await this.getCurrentBranch();
			const tips = await Promise.all(
				branches.map(async (name) => {
					const commit = await this.resolveCommit(name);
					return commit ? { name, commit, current: name === currentBranch } : null;
				}),
			);
			return tips
				.filter((tip): tip is GitBranchTip => tip !== null)
				.sort((left, right) => left.name.localeCompare(right.name));
		}
	}

	async listLocalBranches(): Promise<string[]> {
		if (!(await this.isRepository())) {
			return [];
		}
		try {
			const { stdout } = await this.execGit(["branch", "--format=%(refname:short)"], { readOnly: true });
			return stdout
				.split("\n")
				.map((l) => l.trim())
				.filter(Boolean);
		} catch {
			return [];
		}
	}

	async listAllBranches(_remote = "origin"): Promise<string[]> {
		if (!(await this.isRepository())) {
			return [];
		}
		try {
			// Use -a flag only if remote operations are enabled
			const branchArgs =
				this.operationConfig()?.remoteOperations === false
					? ["branch", "--format=%(refname:short)"]
					: ["branch", "-a", "--format=%(refname:short)"];

			const { stdout } = await this.execGit(branchArgs, { readOnly: true });
			return stdout
				.split("\n")
				.map((l) => l.trim())
				.filter(Boolean)
				.filter((b) => !b.includes("HEAD"));
		} catch {
			return [];
		}
	}

	/**
	 * Returns true if the current repository has any remotes configured
	 */
	async hasAnyRemote(): Promise<boolean> {
		if (!(await this.isRepository())) {
			return false;
		}
		try {
			const { stdout } = await this.execGit(["remote"], { readOnly: true });
			return (
				stdout
					.split("\n")
					.map((s) => s.trim())
					.filter(Boolean).length > 0
			);
		} catch {
			return false;
		}
	}

	/**
	 * Returns true if a specific remote exists (default: origin)
	 */
	async hasRemote(remote = "origin"): Promise<boolean> {
		if (!(await this.isRepository())) {
			return false;
		}
		try {
			const { stdout } = await this.execGit(["remote"], { readOnly: true });
			return stdout.split("\n").some((r) => r.trim() === remote);
		} catch {
			return false;
		}
	}

	async listFilesInTree(ref: string, path: string): Promise<string[]> {
		if (!(await this.isRepository())) {
			return [];
		}
		const { stdout } = await this.execGit(["ls-tree", "-r", "--name-only", "-z", ref, "--", path], { readOnly: true });
		return stdout.split("\0").filter(Boolean);
	}

	async listTreeEntries(ref: string, path: string): Promise<GitTreeEntry[]> {
		if (!(await this.isRepository())) {
			return [];
		}
		const { stdout } = await this.execGit(["ls-tree", "-r", "-z", ref, "--", path], { readOnly: true });
		const entries: GitTreeEntry[] = [];
		for (const record of stdout.split("\0")) {
			if (!record) continue;
			const separatorIndex = record.indexOf("\t");
			if (separatorIndex < 0) continue;
			const metadata = record.slice(0, separatorIndex).split(" ");
			const objectId = metadata[2];
			const entryPath = record.slice(separatorIndex + 1);
			if (!objectId || !entryPath) continue;
			entries.push({ path: entryPath, objectId });
		}
		return entries;
	}

	async hashFile(filePath: string): Promise<string | null> {
		await this.loadConfigIfNeeded();
		if (this.operationConfig()?.filesystemOnly) {
			return null;
		}
		try {
			const context = await this.getPathContext(filePath);
			if (!context) return null;
			const { stdout } = await this.execGit(
				["hash-object", `--path=${context.relativePath}`, "--", context.relativePath],
				{ cwd: context.repoRoot, readOnly: true },
			);
			return stdout.trim() || null;
		} catch {
			return null;
		}
	}
	async showFile(ref: string, filePath: string): Promise<string> {
		if (!(await this.isRepository())) {
			return "";
		}
		const { stdout } = await this.execGit(["show", `${ref}:${filePath}`], { readOnly: true });
		return stdout;
	}

	/**
	 * Resolve a ref (branch name, tag, remote-tracking ref, ...) to its immutable
	 * commit SHA. Returns null when the ref cannot be resolved.
	 *
	 * Used to pin cross-branch task hydration to a fixed commit: the task index is
	 * built (ls-tree) and the content fetched (git show) in two separate steps that
	 * can be seconds apart on large repos. If the branch is deleted, renamed or moved
	 * in between, `git show <branch>:<path>` fails ("failed to stat ...") and the task
	 * is silently dropped. Resolving the SHA up front and hydrating via
	 * `git show <sha>:<path>` makes the second step immune to ref movement.
	 */
	async resolveCommit(ref: string): Promise<string | null> {
		if (!(await this.isRepository())) {
			return null;
		}
		try {
			const { stdout } = await this.execGit(
				["rev-parse", "--verify", "--quiet", "--end-of-options", `${ref}^{commit}`],
				{
					readOnly: true,
				},
			);
			const sha = stdout.trim();
			return sha || null;
		} catch {
			return null;
		}
	}
	/**
	 * Build a map of file -> last modified date for all files in a directory in one git log pass
	 * Much more efficient than individual getFileLastModifiedTime calls
	 * Returns a Map of filePath -> Date
	 */
	async getBranchLastModifiedMap(ref: string, dir: string, sinceDays?: number): Promise<Map<string, Date>> {
		const out = new Map<string, Date>();
		if (!(await this.isRepository())) {
			return out;
		}

		try {
			// Build args with optional --since filter
			const args = [
				"log",
				"--pretty=format:%ct%x00", // Unix timestamp + NUL for bulletproof parsing
				"--name-only",
				"-z", // Null-delimited for safety
			];

			if (sinceDays) {
				args.push(`--since=${sinceDays}.days`);
			}

			args.push(ref, "--", dir);

			// Null-delimited to be safe with filenames
			const { stdout } = await this.execGit(args, { readOnly: true });

			// Parse null-delimited output
			// Format is: timestamp\0 file1\0 file2\0 ... timestamp\0 file1\0 ...
			const parts = stdout.split("\0").filter(Boolean);
			let i = 0;

			while (i < parts.length) {
				const timestampStr = parts[i]?.trim();
				if (timestampStr && /^\d+$/.test(timestampStr)) {
					// This is a timestamp, files follow until next timestamp
					const epoch = Number(timestampStr);
					const date = new Date(epoch * 1000);
					i++;

					// Process files until we hit another timestamp or end
					// Check if next part looks like a timestamp (digits only)
					while (i < parts.length && parts[i] && !/^\d+$/.test(parts[i]?.trim() || "")) {
						const file = parts[i]?.trim();
						// First time we see a file is its last modification
						if (file && !out.has(file)) {
							out.set(file, date);
						}
						i++;
					}
				} else {
					// Skip unexpected content
					i++;
				}
			}
		} catch (error) {
			// If the command fails, return empty map
			console.error(`Failed to get branch last modified map for ${ref}:${dir}`, error);
		}

		return out;
	}

	async getFileLastModifiedBranch(filePath: string): Promise<string | null> {
		if (!(await this.isRepository())) {
			return null;
		}
		try {
			// Get the hash of the last commit that touched the file
			const { stdout: commitHash } = await this.execGit(["log", "-1", "--format=%H", "--", filePath], {
				readOnly: true,
			});
			if (!commitHash) return null;

			// Find all branches that contain this commit
			const { stdout: branches } = await this.execGit([
				"branch",
				"-a",
				"--contains",
				commitHash.trim(),
				"--format=%(refname:short)",
			]);

			if (!branches) return "main"; // Default to main if no specific branch found

			// Prefer non-remote branches and 'main' or 'master'
			const branchList = branches
				.split("\n")
				.map((b) => b.trim())
				.filter(Boolean);
			const mainBranch = branchList.find((b) => b === "main" || b === "master");
			if (mainBranch) return mainBranch;

			const nonRemote = branchList.find((b) => !b.startsWith("remotes/"));
			return nonRemote || branchList[0] || "main";
		} catch {
			return null;
		}
	}

	private async execGit(
		args: string[],
		options?: {
			readOnly?: boolean;
			cwd?: string;
			input?: string;
			env?: Record<string, string>;
			acceptedExitCodes?: readonly number[];
		},
	): Promise<{ stdout: string; stderr: string }> {
		// Use Bun.spawn so we can explicitly control stdio behaviour on Windows. When running
		// under the MCP stdio transport, delegating to git with inherited stdin can deadlock.
		const env = {
			...process.env,
			...(options?.readOnly ? { GIT_OPTIONAL_LOCKS: "0" } : {}),
			...options?.env,
		} as Record<string, string>;

		const subprocess = Bun.spawn(["git", ...args], {
			cwd: options?.cwd ?? this.projectRoot,
			stdin: options?.input === undefined ? "ignore" : "pipe",
			stdout: "pipe",
			stderr: "pipe",
			env,
		});
		if (options?.input !== undefined && subprocess.stdin) {
			subprocess.stdin.write(options.input);
			await subprocess.stdin.end();
		}

		const stdoutPromise = subprocess.stdout ? new Response(subprocess.stdout).text() : Promise.resolve("");
		const stderrPromise = subprocess.stderr ? new Response(subprocess.stderr).text() : Promise.resolve("");
		const [exitCode, stdout, stderr] = await Promise.all([subprocess.exited, stdoutPromise, stderrPromise]);

		if (exitCode !== 0 && !options?.acceptedExitCodes?.includes(exitCode)) {
			throw new Error(`Git command failed (exit code ${exitCode}): git ${args.join(" ")}\n${stderr}`);
		}

		return { stdout, stderr };
	}

	private async getPathContext(targetPath: string): Promise<GitPathContext | null> {
		const absolutePath = isAbsolute(targetPath) ? targetPath : join(this.projectRoot, targetPath);
		const resolvedPath = await realpath(absolutePath).catch(() => null);
		if (resolvedPath) {
			return this.buildContext(resolvedPath);
		}

		const resolvedDir = await realpath(dirname(absolutePath)).catch(() => null);
		if (!resolvedDir) return null;
		const reconstructedPath = join(resolvedDir, basename(absolutePath));
		return this.buildContext(reconstructedPath, resolvedDir);
	}

	private async getRelativePathForRepo(targetPath: string, repoRoot: string): Promise<string | null> {
		const absolutePath = isAbsolute(targetPath) ? targetPath : join(this.projectRoot, targetPath);
		const resolvedPath = await realpath(absolutePath).catch(() => null);
		const pathForRelative = resolvedPath ?? (await this.resolveMissingPath(absolutePath));
		if (!pathForRelative) return null;

		const relativePath = this.normalizeGitPath(relative(repoRoot, pathForRelative));
		if (!relativePath || relativePath.startsWith("..")) return null;
		return relativePath === "" ? "." : relativePath;
	}

	private async resolveRepoRoot(startDir: string): Promise<string | null> {
		await this.loadConfigIfNeeded();
		if (this.operationConfig()?.filesystemOnly) {
			return null;
		}
		try {
			const { stdout } = await this.execGit(["rev-parse", "--show-toplevel"], { readOnly: true, cwd: startDir });
			const root = stdout.trim();
			return root.length > 0 ? root : null;
		} catch {
			return null;
		}
	}

	private async resolveMissingPath(absolutePath: string): Promise<string | null> {
		const resolvedDir = await realpath(dirname(absolutePath)).catch(() => null);
		if (!resolvedDir) return null;
		return join(resolvedDir, basename(absolutePath));
	}

	private async buildContext(resolvedPath: string, resolvedDirHint?: string): Promise<GitPathContext | null> {
		let cwd = resolvedDirHint;
		if (!cwd) {
			const stats = await stat(resolvedPath).catch(() => null);
			if (!stats) {
				cwd = dirname(resolvedPath);
			} else {
				cwd = stats.isDirectory() ? resolvedPath : dirname(resolvedPath);
			}
		}

		const repoRoot = cwd ? await this.resolveRepoRoot(cwd) : null;
		if (!repoRoot) return null;

		const relativePath = this.normalizeGitPath(relative(repoRoot, resolvedPath));
		if (!relativePath || relativePath.startsWith("..")) return null;
		return { repoRoot, relativePath: relativePath === "" ? "." : relativePath };
	}

	private normalizeGitPath(pathValue: string): string {
		return pathValue.replace(/\\/g, "/");
	}
}

export async function isGitRepository(projectRoot: string): Promise<boolean> {
	try {
		const subprocess = Bun.spawn(["git", "rev-parse", "--git-dir"], {
			cwd: projectRoot,
			stdin: "ignore",
			stdout: "ignore",
			stderr: "ignore",
		});

		return (await subprocess.exited) === 0;
	} catch {
		return false;
	}
}

export async function initializeGitRepository(projectRoot: string): Promise<void> {
	try {
		await $`git init`.cwd(projectRoot).quiet();
	} catch (error) {
		throw new Error(`Failed to initialize git repository: ${error}`);
	}
}
