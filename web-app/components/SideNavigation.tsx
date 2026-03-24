"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import React, { useState } from "react";
import type { Decision, Document, Task } from "@/types";

interface Props {
	tasks: Task[];
	docs: Document[];
	decisions: Decision[];
	isLoading: boolean;
}

const Icons = {
	Board: () => (
		<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth={2}
				d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2"
			/>
		</svg>
	),
	List: () => (
		<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth={2}
				d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
			/>
		</svg>
	),
	Draft: () => (
		<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth={2}
				d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
			/>
		</svg>
	),
	Docs: () => (
		<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth={2}
				d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
			/>
		</svg>
	),
	Decisions: () => (
		<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth={2}
				d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
			/>
		</svg>
	),
	Settings: () => (
		<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth={2}
				d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
			/>
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth={2}
				d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
			/>
		</svg>
	),
	Chevron: ({ open }: { open: boolean }) => (
		<svg
			className={`w-4 h-4 transition-transform ${open ? "rotate-90" : ""}`}
			fill="none"
			stroke="currentColor"
			viewBox="0 0 24 24"
		>
			<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
		</svg>
	),
};

function NavItem({
	href,
	icon,
	label,
	badge,
}: {
	href: string;
	icon: React.ReactNode;
	label: string;
	badge?: number;
}) {
	const pathname = usePathname();
	const isActive = pathname === href || (href !== "/" && pathname.startsWith(href));

	return (
		<Link
			href={href}
			className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-150 ${
				isActive
					? "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
					: "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100"
			}`}
		>
			<span className="flex-shrink-0">{icon}</span>
			<span className="flex-1">{label}</span>
			{badge !== undefined && badge > 0 && (
				<span className="ml-auto inline-flex items-center justify-center px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
					{badge}
				</span>
			)}
		</Link>
	);
}

export default function SideNavigation({ tasks, docs, decisions, isLoading }: Props) {
	const [docsOpen, setDocsOpen] = useState(true);
	const [decisionsOpen, setDecisionsOpen] = useState(false);

	const taskCount = tasks.length;
	const draftCount = tasks.filter((t) => t.isDraft).length;

	return (
		<aside className="w-64 flex-shrink-0 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 flex flex-col transition-colors duration-200">
			<div className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
				{/* Main nav */}
				<NavItem href="/board" icon={<Icons.Board />} label="Board" />
				<NavItem href="/tasks" icon={<Icons.List />} label="All Tasks" badge={taskCount} />
				{draftCount > 0 && (
					<NavItem href="/drafts" icon={<Icons.Draft />} label="Drafts" badge={draftCount} />
				)}

				{/* Docs section */}
				<div className="pt-2">
					<button
						onClick={() => setDocsOpen((o) => !o)}
						className="flex items-center gap-2 w-full px-3 py-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
					>
						<Icons.Chevron open={docsOpen} />
						Documents
						{docs.length > 0 && (
							<span className="ml-auto text-xs font-normal normal-case">{docs.length}</span>
						)}
					</button>
					{docsOpen && (
						<div className="ml-4 mt-1 space-y-0.5">
							<NavItem href="/docs" icon={<Icons.Docs />} label="All Documents" />
							{!isLoading &&
								docs.slice(0, 10).map((doc) => (
									<Link
										key={doc.id}
										href={`/docs/${doc.id}`}
										className="flex items-center gap-2 px-3 py-1.5 rounded-md text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100 transition-colors truncate"
									>
										<span className="truncate">{doc.title}</span>
									</Link>
								))}
						</div>
					)}
				</div>

				{/* Decisions section */}
				<div className="pt-1">
					<button
						onClick={() => setDecisionsOpen((o) => !o)}
						className="flex items-center gap-2 w-full px-3 py-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
					>
						<Icons.Chevron open={decisionsOpen} />
						Decisions
						{decisions.length > 0 && (
							<span className="ml-auto text-xs font-normal normal-case">{decisions.length}</span>
						)}
					</button>
					{decisionsOpen && (
						<div className="ml-4 mt-1 space-y-0.5">
							<NavItem href="/decisions" icon={<Icons.Decisions />} label="All Decisions" />
							{!isLoading &&
								decisions.slice(0, 10).map((d) => (
									<Link
										key={d.id}
										href={`/decisions/${d.id}`}
										className="flex items-center gap-2 px-3 py-1.5 rounded-md text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100 transition-colors truncate"
									>
										<span className="truncate">{d.title}</span>
									</Link>
								))}
						</div>
					)}
				</div>
			</div>

			{/* Settings at bottom */}
			<div className="px-3 py-3 border-t border-gray-200 dark:border-gray-700">
				<NavItem href="/settings" icon={<Icons.Settings />} label="Settings" />
			</div>
		</aside>
	);
}
