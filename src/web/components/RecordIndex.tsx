import { Link, useOutletContext } from "react-router-dom";
import { createRecordUrlPath, type RecordListPath } from "../utils/urlHelpers";

interface RecordIndexProps {
	title: string;
	path: RecordListPath;
	records: readonly { id: string; title: string }[];
	emptyMessage: string;
}

export default function RecordIndex({ title, path, records, emptyMessage }: RecordIndexProps) {
	const load = useOutletContext<{ isLoading: boolean; error?: Error | null } | null>();
	let message = emptyMessage;
	if (load?.isLoading) message = "Loading…";
	if (load?.error) message = "Unable to load this list.";

	return (
		<section className="mx-auto max-w-4xl px-4 py-6 sm:px-8">
			<h2 className="mb-4 text-2xl font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
			{records.length > 0 ? (
				<ul className="divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white dark:divide-gray-700 dark:border-gray-700 dark:bg-gray-900">
					{records.map((record) => (
						<li key={record.id}>
							<Link
								className="flex min-h-11 items-center px-4 py-2 text-sm text-blue-700 hover:underline dark:text-blue-400"
								to={createRecordUrlPath(path, record)}
							>
								<span className="wrap-anywhere">{record.title}</span>
							</Link>
						</li>
					))}
				</ul>
			) : (
				<p className="text-sm text-gray-600 dark:text-gray-400">{message}</p>
			)}
		</section>
	);
}
