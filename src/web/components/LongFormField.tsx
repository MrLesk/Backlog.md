import React from "react";
import MermaidMarkdown from "./MermaidMarkdown";
import WysiwygEditor from "./WysiwygEditor";

/**
 * A long-form Markdown field that edits where it sits.
 *
 * This is how vibe-kanban's issue panel works: there is no Edit button and no
 * modal-wide edit mode. The rendered text carries `cursor-text`, clicking it
 * swaps in the editor, and Escape or clicking away commits. See
 * KanbanIssuePanel.tsx, which sets isDescriptionEditing on click.
 *
 * Commit only fires when the text actually changed, so opening a field and
 * leaving it alone never writes to disk. That matters more here than it does
 * upstream, because the Markdown round trip through Lexical is not byte-exact
 * (see WysiwygEditor for the measurements).
 */

interface Props {
	value: string;
	onCommit: (next: string) => void | Promise<void>;
	/** Shown in place of the text when the field is empty and not being edited. */
	emptyLabel: string;
	placeholder?: string;
	readOnly?: boolean;
	/** Passed to the Markdown preview so it renders in the current theme. */
	colorMode: string;
	minHeight?: string;
	ariaLabel: string;
	/** Open in the editor straight away, for a task that does not exist yet. */
	startEditing?: boolean;
}

export const LongFormField: React.FC<Props> = ({
	value,
	onCommit,
	emptyLabel,
	placeholder,
	readOnly = false,
	colorMode,
	minHeight,
	ariaLabel,
	startEditing = false,
}) => {
	const [editing, setEditing] = React.useState(startEditing);
	const [draft, setDraft] = React.useState(value);

	// Keep the draft in step with the task while the field is at rest, so a
	// refresh from the server is not thrown away.
	React.useEffect(() => {
		if (!editing) setDraft(value);
	}, [editing, value]);

	const commit = React.useCallback(() => {
		setEditing(false);
		if (draft !== value) void onCommit(draft);
	}, [draft, onCommit, value]);

	if (editing) {
		return (
			<WysiwygEditor
				value={draft}
				onChange={setDraft}
				onEscape={commit}
				onBlur={commit}
				autoFocus={!startEditing}
				placeholder={placeholder}
				minHeight={minHeight}
				ariaLabel={ariaLabel}
			/>
		);
	}

	const open = () => {
		if (!readOnly) setEditing(true);
	};

	return (
		<div
			className={`-mx-1 rounded-md px-1 py-0.5 ${
				readOnly ? "" : "cursor-text hover:bg-gray-100/60 dark:hover:bg-gray-800/60"
			}`}
			role={readOnly ? undefined : "button"}
			tabIndex={readOnly ? undefined : 0}
			aria-label={readOnly ? undefined : `Edit ${ariaLabel}`}
			onClick={open}
			onKeyDown={(event) => {
				if (readOnly) return;
				if (event.key === "Enter" || event.key === " ") {
					event.preventDefault();
					open();
				}
			}}
		>
			{value ? (
				<div className="prose prose-sm !max-w-none wmde-markdown" data-color-mode={colorMode}>
					<MermaidMarkdown source={value} />
				</div>
			) : (
				<div className="text-sm text-gray-500 dark:text-gray-400">{emptyLabel}</div>
			)}
		</div>
	);
};

export default LongFormField;
