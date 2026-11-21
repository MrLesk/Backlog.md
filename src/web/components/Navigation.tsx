import React from 'react';
import { BranchIndexingIndicator } from './BranchIndexingIndicator';
import ThemeToggle from './ThemeToggle';

interface NavigationProps {
    projectName: string;
    loadingMessage?: string | null;
    onOpenMenu?: () => void;
}

const Navigation: React.FC<NavigationProps> = ({ projectName, loadingMessage, onOpenMenu }) => {
    return (
        <nav className="relative h-14 shrink-0 px-2 lg:h-18 lg:px-8 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 transition-colors duration-200">
            <div className="h-full flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                    {onOpenMenu && (
                        <button
                            type="button"
                            onClick={onOpenMenu}
                            aria-label="Open navigation"
                            aria-haspopup="dialog"
                            aria-controls="backlog-navigation"
                            className="flex size-11 shrink-0 items-center justify-center rounded-lg text-gray-700 hover:bg-gray-100 focus-visible:outline-2 dark:text-gray-200 dark:hover:bg-gray-800"
                        >
                            <svg aria-hidden="true" className="size-6" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                <path d="M3 6h18M3 12h18M3 18h18" strokeWidth="2" strokeLinecap="round" />
                            </svg>
                        </button>
                    )}
                    <h1 className="truncate text-xl font-bold text-gray-900 dark:text-gray-100" title={projectName}>{projectName || 'Loading...'}</h1>
                    <span className="hidden shrink-0 text-sm text-gray-500 dark:text-gray-400 lg:inline">powered by</span>
                    <a
                        href="https://backlog.md"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hidden shrink-0 text-sm text-stone-600 lg:inline hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-300 hover:underline transition-colors duration-200"
                    >
                        Backlog.md
                    </a>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                    <BranchIndexingIndicator message={loadingMessage} />
                    <ThemeToggle />
                </div>
            </div>
        </nav>
    );
};

export default Navigation;
