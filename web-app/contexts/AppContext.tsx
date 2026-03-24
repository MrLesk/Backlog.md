"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { BacklogConfig, Decision, Document, Task } from "@/types";
import { apiClient } from "@/lib/api";

interface AppContextValue {
	tasks: Task[];
	docs: Document[];
	decisions: Decision[];
	config: BacklogConfig;
	isLoading: boolean;
	refreshData: () => Promise<void>;
	openEditTask: (task: Task) => void;
	openNewTask: (draft?: boolean) => void;
}

const AppContext = createContext<AppContextValue | undefined>(undefined);

export function useAppContext(): AppContextValue {
	const ctx = useContext(AppContext);
	if (!ctx) throw new Error("useAppContext must be used within AppProvider");
	return ctx;
}

const DEFAULT_CONFIG: BacklogConfig = {
	projectName: "My Project",
	statuses: ["To Do", "In Progress", "Done"],
	labels: [],
	milestones: [],
	defaultStatus: "To Do",
};

interface Props {
	children: React.ReactNode;
	onOpenModal: (task?: Task, draft?: boolean) => void;
}

export function AppProvider({ children, onOpenModal }: Props) {
	const [tasks, setTasks] = useState<Task[]>([]);
	const [docs, setDocs] = useState<Document[]>([]);
	const [decisions, setDecisions] = useState<Decision[]>([]);
	const [config, setConfig] = useState<BacklogConfig>(DEFAULT_CONFIG);
	const [isLoading, setIsLoading] = useState(true);

	const refreshData = useCallback(async () => {
		try {
			const [freshTasks, freshDocs, freshDecisions, freshConfig] = await Promise.all([
				apiClient.fetchTasks(),
				apiClient.fetchDocs(),
				apiClient.fetchDecisions(),
				apiClient.fetchConfig(),
			]);
			setTasks(freshTasks);
			setDocs(freshDocs);
			setDecisions(freshDecisions);
			setConfig(freshConfig);
		} catch (err) {
			console.error("Failed to refresh data:", err);
		}
	}, []);

	useEffect(() => {
		setIsLoading(true);
		refreshData().finally(() => setIsLoading(false));
	}, [refreshData]);

	// SSE for soft real-time updates
	useEffect(() => {
		let es: EventSource | null = null;
		let retryTimeout: ReturnType<typeof setTimeout> | null = null;

		const connect = () => {
			es = new EventSource("/api/events");
			es.onmessage = () => refreshData();
			es.onerror = () => {
				es?.close();
				retryTimeout = setTimeout(connect, 5000);
			};
		};

		connect();
		return () => {
			es?.close();
			if (retryTimeout) clearTimeout(retryTimeout);
		};
	}, [refreshData]);

	const openEditTask = useCallback(
		(task: Task) => onOpenModal(task, false),
		[onOpenModal],
	);

	const openNewTask = useCallback(
		(draft = false) => onOpenModal(undefined, draft),
		[onOpenModal],
	);

	return (
		<AppContext.Provider
			value={{ tasks, docs, decisions, config, isLoading, refreshData, openEditTask, openNewTask }}
		>
			{children}
		</AppContext.Provider>
	);
}
