import React, { useEffect, useState } from 'react';
import type { AgentConfig } from '../../types';

interface AgentsSectionProps {
	agents: AgentConfig[];
	onChange: (next: AgentConfig[]) => void;
}

const INPUT_CLS =
	'w-full h-9 px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-stone-500 dark:focus:ring-stone-400 focus:border-transparent transition-colors duration-200';

/**
 * Editor for the `agents:` config block. Each row has an alias (friendly
 * name shown in the UI and stored in tasks) and a binary (the CLI command
 * the dispatcher launches). Users can add/remove rows; order is preserved.
 */
const AgentsSection: React.FC<AgentsSectionProps> = ({ agents, onChange }) => {
	const [rows, setRows] = useState<AgentConfig[]>(agents);

	useEffect(() => {
		setRows(agents);
	}, [agents]);

	const emit = (next: AgentConfig[]) => {
		setRows(next);
		onChange(
			next
				.filter((r) => r.alias.trim() && r.binary.trim())
				.map((r) => ({
					alias: r.alias,
					binary: r.binary,
					...(r.model?.trim() ? { model: r.model.trim() } : {}),
					...(r.effort?.trim() ? { effort: r.effort.trim() } : {}),
				})),
		);
	};

	const update = (index: number, field: keyof AgentConfig, value: string) => {
		emit(rows.map((r, i) => (i === index ? { ...r, [field]: value } : r)));
	};

	const addRow = () => emit([...rows, { alias: '', binary: '' }]);

	const removeRow = (index: number) => emit(rows.filter((_, i) => i !== index));

	return (
		<div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
			<div className="flex items-center justify-between mb-1">
				<h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Agents</h2>
				<button
					type="button"
					onClick={addRow}
					className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
				>
					+ Add agent
				</button>
			</div>
			<p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
				Give each AI agent a friendly alias and map it to the CLI binary. Tasks will show a
				dropdown to pick from these names instead of a free-text field. Model and effort are
				optional and apply to <code>claude</code> agents only (e.g. run coders/reviewers on
				<code> sonnet</code> to save quota).
			</p>
			{rows.length === 0 && (
				<p className="text-sm text-gray-400 dark:text-gray-500">
					No agents configured — task fields will use free-text input.
				</p>
			)}
			<div className="space-y-2">
				<div className="grid grid-cols-[1fr_auto_1fr_1fr_1fr_auto] gap-2 items-center text-xs text-gray-500 dark:text-gray-400 px-1 mb-1">
					<span>Alias (shown in UI + stored in task)</span>
					<span />
					<span>Binary (CLI command to launch)</span>
					<span>Model (optional, claude)</span>
					<span>Effort (optional, claude)</span>
					<span />
				</div>
				{rows.map((row, index) => (
					<div
						key={index}
						className="grid grid-cols-[1fr_auto_1fr_1fr_1fr_auto] gap-2 items-center"
					>
						<input
							type="text"
							value={row.alias}
							onChange={(e) => update(index, 'alias', e.target.value)}
							placeholder="e.g. Claudio"
							aria-label="Agent alias"
							className={INPUT_CLS}
						/>
						<span className="text-gray-400 dark:text-gray-500 text-sm text-center">→</span>
						<input
							type="text"
							value={row.binary}
							onChange={(e) => update(index, 'binary', e.target.value)}
							placeholder="e.g. claude"
							aria-label="Agent binary"
							className={INPUT_CLS}
						/>
						<input
							type="text"
							value={row.model ?? ''}
							onChange={(e) => update(index, 'model', e.target.value)}
							placeholder="e.g. sonnet"
							aria-label="Agent model"
							className={INPUT_CLS}
						/>
						<input
							type="text"
							value={row.effort ?? ''}
							onChange={(e) => update(index, 'effort', e.target.value)}
							placeholder="e.g. high"
							aria-label="Agent effort"
							className={INPUT_CLS}
						/>
						<button
							type="button"
							onClick={() => removeRow(index)}
							className="text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors px-1"
							aria-label={`Remove agent ${row.alias || String(index)}`}
							title="Remove"
						>
							✕
						</button>
					</div>
				))}
			</div>
		</div>
	);
};

export default AgentsSection;
