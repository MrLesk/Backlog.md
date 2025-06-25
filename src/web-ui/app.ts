// Import the CSS exactly like test-bun
import "./styles.css";

// Global state
let allTasks: any[] = [];
let allStatuses: string[] = [];
let filteredTasks: any[] = [];
let draggedTask: any = null;

// Initialize the application
async function loadBoard() {
	try {
		const response = await fetch("/api/board");
		const data = await response.json();

		if (data.success) {
			allTasks = data.data.tasks;
			allStatuses = data.data.statuses;
			filteredTasks = [...allTasks];
			setupFilters();
			renderBoard();
		} else {
			showError("Failed to load board data");
		}
	} catch (error) {
		showError("Error connecting to server");
	}
}

// Setup filter dropdowns
function setupFilters() {
	const statusFilter = document.getElementById(
		"statusFilter",
	) as HTMLSelectElement;
	const assigneeFilter = document.getElementById(
		"assigneeFilter",
	) as HTMLSelectElement;

	// Clear existing options (except "All")
	statusFilter.innerHTML = '<option value="">All Statuses</option>';
	assigneeFilter.innerHTML = '<option value="">All Assignees</option>';

	// Populate status filter
	allStatuses.forEach((status) => {
		const option = document.createElement("option");
		option.value = status;
		option.textContent = status;
		statusFilter.appendChild(option);
	});

	// Populate assignee filter
	const assignees = [
		...new Set(allTasks.flatMap((task) => task.assignee || [])),
	];
	assignees.forEach((assignee) => {
		if (assignee) {
			const option = document.createElement("option");
			option.value = assignee;
			option.textContent = assignee;
			assigneeFilter.appendChild(option);
		}
	});

	// Add event listeners
	document
		.getElementById("searchInput")
		?.addEventListener("input", applyFilters);
	statusFilter.addEventListener("change", applyFilters);
	assigneeFilter.addEventListener("change", applyFilters);
}

// Apply search and filters
function applyFilters() {
	const searchTerm = (
		document.getElementById("searchInput") as HTMLInputElement
	).value.toLowerCase();
	const statusFilter = (
		document.getElementById("statusFilter") as HTMLSelectElement
	).value;
	const assigneeFilter = (
		document.getElementById("assigneeFilter") as HTMLSelectElement
	).value;

	filteredTasks = allTasks.filter((task) => {
		const matchesSearch =
			!searchTerm ||
			task.title.toLowerCase().includes(searchTerm) ||
			task.id.toLowerCase().includes(searchTerm) ||
			(task.description && task.description.toLowerCase().includes(searchTerm));

		const matchesStatus = !statusFilter || task.status === statusFilter;

		const matchesAssignee =
			!assigneeFilter ||
			(task.assignee && task.assignee.includes(assigneeFilter));

		return matchesSearch && matchesStatus && matchesAssignee;
	});

	renderBoard();
}

// Render the Kanban board
function renderBoard() {
	const boardEl = document.getElementById("board") as HTMLDivElement;
	boardEl.innerHTML = "";

	allStatuses.forEach((status) => {
		const column = document.createElement("div");
		column.className = "column";
		column.setAttribute("data-status", status);

		// Setup drop target
		setupDropTarget(column, status);

		const statusTasks = filteredTasks.filter((task) => task.status === status);

		const header = document.createElement("h3");
		header.innerHTML = `${status} <span class="task-count">${statusTasks.length}</span>`;
		column.appendChild(header);

		statusTasks.forEach((task) => {
			const taskEl = createTaskElement(task);
			column.appendChild(taskEl);
		});

		boardEl.appendChild(column);
	});
}

// Create a task element
function createTaskElement(task: any) {
	const taskEl = document.createElement("div");
	taskEl.className = "task";
	taskEl.setAttribute("data-task-id", task.id);
	taskEl.draggable = true;

	// Add priority indicator
	if (task.priority) {
		const indicator = document.createElement("div");
		indicator.className = `priority-indicator priority-${task.priority}`;
		taskEl.appendChild(indicator);
	}

	// Task header with ID
	const headerEl = document.createElement("div");
	headerEl.className = "task-header";
	const idEl = document.createElement("span");
	idEl.className = "task-id";
	idEl.textContent = task.id;
	headerEl.appendChild(idEl);
	taskEl.appendChild(headerEl);

	// Task title
	const title = document.createElement("h4");
	title.textContent = task.title;
	taskEl.appendChild(title);

	// Task description (truncated)
	if (task.description) {
		const desc = document.createElement("p");
		desc.textContent =
			task.description.substring(0, 100) +
			(task.description.length > 100 ? "..." : "");
		taskEl.appendChild(desc);
	}

	// Task footer with labels and assignee
	const footer = document.createElement("div");
	footer.className = "task-footer";

	const labelsEl = document.createElement("div");
	labelsEl.className = "task-labels";
	if (task.labels && task.labels.length > 0) {
		task.labels.forEach((label: string) => {
			const labelEl = document.createElement("span");
			labelEl.className = "task-label";
			labelEl.textContent = label;
			labelsEl.appendChild(labelEl);
		});
	}
	footer.appendChild(labelsEl);

	if (task.assignee && task.assignee.length > 0) {
		const assigneeEl = document.createElement("div");
		assigneeEl.className = "task-assignee";
		assigneeEl.textContent = task.assignee.join(", ");
		footer.appendChild(assigneeEl);
	}

	taskEl.appendChild(footer);

	// Add event listeners
	setupTaskDragAndDrop(taskEl, task);
	taskEl.addEventListener("click", () => openTaskModal(task));

	return taskEl;
}

// Setup drag and drop for tasks
function setupTaskDragAndDrop(taskEl: HTMLDivElement, task: any) {
	taskEl.addEventListener("dragstart", (e) => {
		draggedTask = task;
		taskEl.classList.add("dragging");
		e.dataTransfer!.effectAllowed = "move";
	});

	taskEl.addEventListener("dragend", () => {
		taskEl.classList.remove("dragging");
		draggedTask = null;
	});
}

// Setup drop target for columns
function setupDropTarget(column: HTMLDivElement, status: string) {
	column.addEventListener("dragover", (e) => {
		e.preventDefault();
		column.classList.add("drag-over");
	});

	column.addEventListener("dragleave", () => {
		column.classList.remove("drag-over");
	});

	column.addEventListener("drop", async (e) => {
		e.preventDefault();
		column.classList.remove("drag-over");

		if (draggedTask && draggedTask.status !== status) {
			await updateTaskStatus(draggedTask.id, status);
		}
	});
}

// Update task status via API
async function updateTaskStatus(taskId: string, newStatus: string) {
	try {
		const response = await fetch(`/api/tasks/${taskId}`, {
			method: "PUT",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ status: newStatus }),
		});

		if (response.ok) {
			// Update local state
			const task = allTasks.find((t) => t.id === taskId);
			if (task) {
				task.status = newStatus;
				applyFilters(); // Re-render with current filters
			}
		} else {
			showError("Failed to update task status");
		}
	} catch (error) {
		showError("Error updating task");
	}
}

// Task detail modal functions
async function openTaskModal(task: any) {
	(
		document.getElementById("modalTaskTitle") as HTMLHeadingElement
	).textContent = task.title;

	// Populate metadata
	const metaEl = document.getElementById("modalTaskMeta") as HTMLDivElement;
	metaEl.innerHTML = `
		<div class="meta-item">
			<div class="meta-label">ID</div>
			<div class="meta-value">${task.id}</div>
		</div>
		<div class="meta-item">
			<div class="meta-label">Status</div>
			<div class="meta-value">${task.status}</div>
		</div>
		<div class="meta-item">
			<div class="meta-label">Priority</div>
			<div class="meta-value">${task.priority || "None"}</div>
		</div>
		<div class="meta-item">
			<div class="meta-label">Assignee</div>
			<div class="meta-value">${task.assignee && task.assignee.length > 0 ? task.assignee.join(", ") : "Unassigned"}</div>
		</div>
		<div class="meta-item">
			<div class="meta-label">Labels</div>
			<div class="meta-value">${task.labels && task.labels.length > 0 ? task.labels.join(", ") : "None"}</div>
		</div>
		<div class="meta-item">
			<div class="meta-label">Created</div>
			<div class="meta-value">${task.createdDate || "Unknown"}</div>
		</div>
	`;

	// Populate description with basic markdown rendering
	const descEl = document.getElementById(
		"modalTaskDescription",
	) as HTMLDivElement;
	descEl.innerHTML = renderMarkdown(
		task.description || "No description provided.",
	);

	document.getElementById("taskModal")?.classList.add("show");
}

function closeTaskModal() {
	document.getElementById("taskModal")?.classList.remove("show");
}

// Basic markdown rendering
function renderMarkdown(text: string) {
	return text
		.replace(/^### (.+)$/gm, "<h3>$1</h3>")
		.replace(/^## (.+)$/gm, "<h3>$1</h3>")
		.replace(/^# (.+)$/gm, "<h3>$1</h3>")
		.replace(/^- (.+)$/gm, "<li>$1</li>")
		.replace(/(<li>.*<\/li>)/gs, "<ul>$1</ul>")
		.replace(/\n\n/g, "</p><p>")
		.replace(/^(.+)$/gm, "<p>$1</p>")
		.replace(/<p><h/g, "<h")
		.replace(/<\/h3><\/p>/g, "</h3>")
		.replace(/<p><ul>/g, "<ul>")
		.replace(/<\/ul><\/p>/g, "</ul>");
}

// Utility functions
function refreshBoard() {
	loadBoard();
}

function toggleView() {
	// Placeholder for list view toggle
	alert("List view not implemented yet");
}

function showError(message: string) {
	const boardEl = document.getElementById("board") as HTMLDivElement;
	boardEl.innerHTML = `<div class="loading" style="color: #dc2626;">${message}</div>`;
}

// Close modal when clicking outside
document.getElementById("taskModal")?.addEventListener("click", (e) => {
	if ((e.target as HTMLElement).id === "taskModal") {
		closeTaskModal();
	}
});

// Close modal with Escape key
document.addEventListener("keydown", (e) => {
	if (e.key === "Escape") {
		closeTaskModal();
	}
});

// Set up global functions for HTML event handlers
(window as any).refreshBoard = refreshBoard;
(window as any).toggleView = toggleView;
(window as any).closeTaskModal = closeTaskModal;

// Load board on page load
loadBoard();
