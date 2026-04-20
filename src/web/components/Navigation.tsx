import React from 'react';
import ThemeToggle from './ThemeToggle';
import ProjectTabs from './ProjectTabs';
import type { ProjectSummary } from '../lib/api';

interface NavigationProps {
    projectName: string;
    projects: ProjectSummary[];
    currentProject: string | null;
    onProjectChange: (projectKey: string) => void;
}

const Navigation: React.FC<NavigationProps> = ({projectName, projects, currentProject, onProjectChange}) => {
    return (
        <nav className="px-8 py-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 transition-colors duration-200">
            <div className="space-y-3">
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">{projectName || 'Loading...'}</h1>
                        <span className="text-sm text-gray-500 dark:text-gray-400">powered by</span>
                        <a
                            href="https://backlog.md"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-stone-600 hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-300 hover:underline transition-colors duration-200"
                        >
                            Backlog.md
                        </a>
                    </div>
                    <ThemeToggle />
                </div>
                <ProjectTabs
                    projects={projects}
                    currentProject={currentProject}
                    onProjectChange={onProjectChange}
                />
            </div>
        </nav>
    );
};

export default Navigation;
