import { memo } from 'react';

const AmbiguousIdNotice = memo(function AmbiguousIdNotice({ message }: { message: string }) {
    return (
        <div className="flex-1 flex items-center justify-center p-8">
            <div
                role="alert"
                className="w-full max-w-xl rounded-lg border border-amber-300 bg-amber-50 p-6 dark:border-amber-700 dark:bg-amber-950 transition-colors duration-200"
            >
                <h2 className="text-lg font-semibold text-amber-900 dark:text-amber-100">
                    This ID matches more than one file
                </h2>
                <pre className="mt-3 whitespace-pre-wrap break-words font-mono text-sm text-amber-900 dark:text-amber-100">
                    {message}
                </pre>
            </div>
        </div>
    );
});

export default AmbiguousIdNotice;
