"use client";

import React, { useCallback, useState } from "react";
import type { Task } from "@/types";
import { apiClient } from "@/lib/api";
import { AppProvider, useAppContext } from "@/contexts/AppContext";
import Navigation from "./Navigation";
import SideNavigation from "./SideNavigation";
import TaskDetailsModal from "./TaskDetailsModal";
import { SuccessToast } from "./SuccessToast";

function Shell({ children }: { children: React.ReactNode }) {
	const { tasks, docs, decisions, config, isLoading, refreshData } = useAppContext();
	const [showModal, setShowModal] = useState(false);
	const [editingTask, setEditingTask] = useState<Task | undefined>(undefined);
	const [isDraftMode, setIsDraftMode] = useState(false);
	const [showSuccessToast, setShowSuccessToast] = useState(false);

	const handleTaskSaved = async () => {
		await refreshData();
		setShowSuccessToast(true);
		setTimeout(() => setShowSuccessToast(false), 3000);
	};

	const handleTaskSubmit = async (taskData: Partial<Task>) => {
		await apiClient.createTask({
			title: taskData.title || "",
			description: taskData.description,
			status: taskData.status,
			priority: taskData.priority,
			labels: taskData.labels,
			assignee: taskData.assignee,
			dependencies: taskData.dependencies,
			implementationPlan: taskData.implementationPlan,
			implementationNotes: taskData.implementationNotes,
			acceptanceCriteria: taskData.acceptanceCriteriaItems?.map((c) => ({
				text: c.text,
				checked: c.checked,
			})),
			isDraft: isDraftMode,
		});
		await refreshData();
	};

	const handleArchiveTask = async () => {
		if (!editingTask) return;
		await apiClient.archiveTask(editingTask.id);
		await refreshData();
	};

	return (
		<div className="h-screen bg-gray-50 dark:bg-gray-950 flex flex-col transition-colors duration-200">
			<Navigation projectName={config.projectName} />
			<div className="flex flex-1 min-h-0">
				<SideNavigation tasks={tasks} docs={docs} decisions={decisions} isLoading={isLoading} />
				<main className="flex-1 overflow-y-auto overflow-x-hidden p-6">{children}</main>
			</div>

			<TaskDetailsModal
				task={editingTask}
				isOpen={showModal}
				onClose={() => {
					setShowModal(false);
					setEditingTask(undefined);
				}}
				onSaved={handleTaskSaved}
				onSubmit={handleTaskSubmit}
				onArchive={handleArchiveTask}
				availableStatuses={config.statuses}
				isDraftMode={isDraftMode}
			/>

			{showSuccessToast && (
				<SuccessToast
					message="Saved successfully"
					onDismiss={() => setShowSuccessToast(false)}
					icon={
						<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M5 13l4 4L19 7"
							/>
						</svg>
					}
				/>
			)}
		</div>
	);
}

export default function AppShell({ children }: { children: React.ReactNode }) {
	const [showModal, setShowModal] = useState(false);
	const [editingTask, setEditingTask] = useState<Task | undefined>(undefined);
	const [isDraftMode, setIsDraftMode] = useState(false);

	const handleOpenModal = useCallback((task?: Task, draft = false) => {
		setEditingTask(task);
		setIsDraftMode(draft);
		setShowModal(true);
	}, []);

	// We need to thread the modal open callback down into Shell via context
	// Use a two-layer approach: AppProvider manages data, Shell manages UI
	return (
		<AppProvider onOpenModal={handleOpenModal}>
			<ShellInner
				showModal={showModal}
				editingTask={editingTask}
				isDraftMode={isDraftMode}
				onClose={() => {
					setShowModal(false);
					setEditingTask(undefined);
				}}
			>
				{children}
			</ShellInner>
		</AppProvider>
	);
}

function ShellInner({
	children,
	showModal,
	editingTask,
	isDraftMode,
	onClose,
}: {
	children: React.ReactNode;
	showModal: boolean;
	editingTask?: Task;
	isDraftMode: boolean;
	onClose: () => void;
}) {
	const { tasks, docs, decisions, config, isLoading, refreshData } = useAppContext();
	const [showSuccessToast, setShowSuccessToast] = useState(false);

	const handleTaskSaved = async () => {
		await refreshData();
		setShowSuccessToast(true);
		setTimeout(() => setShowSuccessToast(false), 3000);
	};

	const handleTaskSubmit = async (taskData: Partial<Task>) => {
		await apiClient.createTask({
			title: taskData.title || "",
			description: taskData.description,
			status: taskData.status,
			priority: taskData.priority,
			labels: taskData.labels,
			assignee: taskData.assignee,
			dependencies: taskData.dependencies,
			implementationPlan: taskData.implementationPlan,
			implementationNotes: taskData.implementationNotes,
			acceptanceCriteria: taskData.acceptanceCriteriaItems?.map((c) => ({
				text: c.text,
				checked: c.checked,
			})),
			isDraft: isDraftMode,
		});
		await refreshData();
	};

	const handleArchiveTask = async () => {
		if (!editingTask) return;
		await apiClient.archiveTask(editingTask.id);
		await refreshData();
	};

	return (
		<div className="h-screen bg-gray-50 dark:bg-gray-950 flex flex-col transition-colors duration-200">
			<Navigation projectName={config.projectName} />
			<div className="flex flex-1 min-h-0">
				<SideNavigation tasks={tasks} docs={docs} decisions={decisions} isLoading={isLoading} />
				<main className="flex-1 overflow-y-auto overflow-x-hidden p-6">{children}</main>
			</div>

			<TaskDetailsModal
				task={editingTask}
				isOpen={showModal}
				onClose={onClose}
				onSaved={handleTaskSaved}
				onSubmit={handleTaskSubmit}
				onArchive={handleArchiveTask}
				availableStatuses={config.statuses}
				isDraftMode={isDraftMode}
			/>

			{showSuccessToast && (
				<SuccessToast
					message="Saved successfully"
					onDismiss={() => setShowSuccessToast(false)}
					icon={
						<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M5 13l4 4L19 7"
							/>
						</svg>
					}
				/>
			)}
		</div>
	);
}
