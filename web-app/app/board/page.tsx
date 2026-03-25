"use client";

import React, { Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Board from "@/components/Board";
import { useAppContext } from "@/contexts/AppContext";

function BoardContent() {
	const { tasks, config, isLoading, refreshData, openEditTask, openNewTask } = useAppContext();
	const searchParams = useSearchParams();
	const router = useRouter();
	const highlightTaskId = searchParams.get("task");

	const handleEditTask = (task: import("@/types").Task) => {
		openEditTask(task);
		router.replace(`/board?task=${task.id}`, { scroll: false });
	};

	return (
		<Board
			tasks={tasks}
			statuses={config.statuses}
			isLoading={isLoading}
			highlightTaskId={highlightTaskId}
			onEditTask={handleEditTask}
			onNewTask={() => openNewTask(false)}
			onRefreshData={refreshData}
		/>
	);
}

export default function BoardPage() {
	return (
		<Suspense fallback={null}>
			<BoardContent />
		</Suspense>
	);
}
