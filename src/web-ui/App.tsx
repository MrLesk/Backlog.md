import React from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

function App() {
	return (
		<div className="p-8">
			<div className="container mx-auto">
				<div className="header mb-8">
					<div className="flex items-center gap-4 mb-4">
						<img src="./logo.png" alt="Backlog.md Logo" className="w-12 h-12" />
						<h1 className="text-4xl font-bold">Backlog.md</h1>
					</div>
					<p className="text-gray-600">Task Management Dashboard</p>
				</div>
				
				<div className="toolbar flex gap-4 mb-6">
					<input 
						type="text" 
						id="searchInput" 
						className="px-4 py-2 border rounded-lg flex-1" 
						placeholder="Search tasks..."
					/>
					<select id="statusFilter" className="px-4 py-2 border rounded-lg">
						<option value="">All Statuses</option>
					</select>
					<select id="assigneeFilter" className="px-4 py-2 border rounded-lg">
						<option value="">All Assignees</option>
					</select>
					<button className="px-4 py-2 bg-blue-500 text-white rounded-lg">
						Refresh
					</button>
					<button className="px-4 py-2 bg-gray-500 text-white rounded-lg">
						List View
					</button>
				</div>
				
				<div id="board" className="board">
					<div className="loading">Loading tasks...</div>
				</div>
			</div>
		</div>
	);
}

const container = document.getElementById("root");
if (container) {
	const root = createRoot(container);
	root.render(<App />);
}