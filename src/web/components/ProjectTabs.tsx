import React from 'react';
import type { ProjectSummary } from '../lib/api';

interface ProjectTabsProps {
  projects: ProjectSummary[];
  currentProject: string | null;
  onProjectChange: (projectKey: string) => void;
}

const ProjectTabs: React.FC<ProjectTabsProps> = ({ projects, currentProject, onProjectChange }) => {
  if (projects.length <= 1) {
    return null;
  }

  return (
    <div className="overflow-x-auto">
      <div className="inline-flex min-w-full gap-2" role="tablist" aria-label="Projects">
        {projects.map((project) => {
          const isActive = project.key === currentProject;
          return (
            <button
              key={project.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onProjectChange(project.key)}
              className={`px-3 py-1.5 rounded-full border text-sm font-medium whitespace-nowrap transition-colors duration-200 ${
                isActive
                  ? 'border-stone-900 bg-stone-900 text-white dark:border-stone-200 dark:bg-stone-200 dark:text-stone-900'
                  : 'border-gray-300 bg-white text-gray-700 hover:border-stone-400 hover:text-stone-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:border-stone-500 dark:hover:text-stone-100'
              }`}
            >
              {project.projectName || project.key}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default ProjectTabs;
