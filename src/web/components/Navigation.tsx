import React from 'react';
import { BranchIndexingIndicator } from './BranchIndexingIndicator';
import ThemeToggle from './ThemeToggle';

interface NavigationProps {
    projectName: string;
    loadingMessage?: string | null;
    onOpenMenu?: () => void;
}

/** The header row at the top of the content panel. */
const Navigation: React.FC<NavigationProps> = ({ projectName, loadingMessage, onOpenMenu }) => {
    return (
        <nav className="relative h-14 shrink-0 px-2 lg:h-12 lg:px-5 border-b border-line-soft transition-colors duration-200">
            <div className="h-full flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                    {onOpenMenu && (
                        <button
                            type="button"
                            onClick={onOpenMenu}
                            aria-label="Open navigation"
                            aria-haspopup="dialog"
                            aria-controls="backlog-navigation"
                            className="flex size-11 shrink-0 items-center justify-center rounded-control text-ink-2 hover:bg-hover hover:text-ink focus-ring"
                        >
                            <svg aria-hidden="true" className="size-6" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                <path d="M3 6h18M3 12h18M3 18h18" strokeWidth="2" strokeLinecap="round" />
                            </svg>
                        </button>
                    )}
                    <h1 className="truncate text-base font-semibold text-ink" title={projectName}>{projectName || 'Loading...'}</h1>
                    <span className="hidden shrink-0 text-sm text-ink-3 lg:inline">powered by</span>
                    <a
                        href="https://backlog.md"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hidden shrink-0 text-sm text-accent-text lg:inline hover:underline focus-ring"
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
