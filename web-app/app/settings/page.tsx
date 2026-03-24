"use client";

import React, { useEffect, useState } from "react";
import type { BacklogConfig } from "@/types";
import { apiClient } from "@/lib/api";
import { useAppContext } from "@/contexts/AppContext";
import ChipInput from "@/components/ChipInput";

export default function SettingsPage() {
	const { config, refreshData } = useAppContext();
	const [form, setForm] = useState<BacklogConfig>(config);
	const [saving, setSaving] = useState(false);
	const [saved, setSaved] = useState(false);

	useEffect(() => {
		setForm(config);
	}, [config]);

	const handleSave = async () => {
		setSaving(true);
		try {
			await apiClient.updateConfig(form);
			await refreshData();
			setSaved(true);
			setTimeout(() => setSaved(false), 2500);
		} finally {
			setSaving(false);
		}
	};

	const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
		<div className="space-y-1.5">
			<label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>
			{children}
		</div>
	);

	return (
		<div className="max-w-2xl space-y-6">
			<h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Settings</h2>

			<div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 space-y-5">
				<Field label="Project Name">
					<input
						type="text"
						value={form.projectName}
						onChange={(e) => setForm((f) => ({ ...f, projectName: e.target.value }))}
						className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
					/>
				</Field>

				<Field label="Statuses (one per line)">
					<textarea
						rows={4}
						value={form.statuses.join("\n")}
						onChange={(e) =>
							setForm((f) => ({
								...f,
								statuses: e.target.value
									.split("\n")
									.map((s) => s.trim())
									.filter(Boolean),
							}))
						}
						className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono transition-colors"
					/>
					<p className="text-xs text-gray-400 dark:text-gray-500">
						Each line becomes a Kanban column. First status is the default for new tasks.
					</p>
				</Field>

				<Field label="Labels">
					<ChipInput
						name="labels"
						label=""
						value={form.labels}
						onChange={(v) => setForm((f) => ({ ...f, labels: v }))}
						placeholder="Type label and press Enter"
					/>
				</Field>

				<Field label="Milestones">
					<ChipInput
						name="milestones"
						label=""
						value={form.milestones}
						onChange={(v) => setForm((f) => ({ ...f, milestones: v }))}
						placeholder="Type milestone and press Enter"
					/>
				</Field>
			</div>

			<div className="flex items-center gap-3">
				<button
					onClick={handleSave}
					disabled={saving}
					className="px-6 py-2 bg-blue-500 text-white text-sm font-medium rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-400 transition-colors disabled:opacity-50 cursor-pointer"
				>
					{saving ? "Saving…" : "Save Settings"}
				</button>
				{saved && <span className="text-sm text-green-600 dark:text-green-400">Saved!</span>}
			</div>
		</div>
	);
}
