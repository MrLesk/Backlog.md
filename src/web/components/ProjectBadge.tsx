import type React from 'react';

const PROJECT_BADGE_PALETTES = [
  'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  'bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-900/40 dark:text-fuchsia-300',
  'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300',
  'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
  'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
] as const;

function getPaletteIndex(project: string, availableProjects?: string[]): number {
  const normalized = project.trim().toLowerCase();
  if (availableProjects && availableProjects.length > 0) {
    const configuredIndex = availableProjects.findIndex((p) => p.trim().toLowerCase() === normalized);
    if (configuredIndex >= 0) {
      return configuredIndex % PROJECT_BADGE_PALETTES.length;
    }
  }

  let hash = 0;
  for (const character of normalized) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  }
  return hash % PROJECT_BADGE_PALETTES.length;
}

interface ProjectBadgeProps {
  project?: string;
  availableProjects?: string[];
  className?: string;
}

const ProjectBadge: React.FC<ProjectBadgeProps> = ({ project, availableProjects, className = '' }) => {
  const label = project?.trim();
  if (!label) {
    return null;
  }

  return (
    <span
      data-task-project={label}
      title={`Project: ${label}`}
      className={`inline-flex max-w-full items-center rounded-full px-2 py-0.5 text-[10px] font-semibold leading-4 ${PROJECT_BADGE_PALETTES[getPaletteIndex(label, availableProjects)]} ${className}`}
    >
      <span className="truncate">{label}</span>
    </span>
  );
};

export default ProjectBadge;
