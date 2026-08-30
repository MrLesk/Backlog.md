import type React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  buildDependencyTree,
  type DependencyDirection,
  type DependencyGraph,
  type DependencyGraphNode,
  type DependencyTreeNode,
  depthInDirection,
  nodesInDirection,
} from '../../utils/dependency-graph.ts';
import { createUrlPath } from '../utils/urlHelpers';

/**
 * Keep an in-app task link on the page the reader is already on: opening a dependency from the
 * board should stay on the board rather than jumping to the task list. A deep link from outside
 * still resolves, because both routes open the same task.
 */
function useTaskHref(): (id: string, title: string | null) => string {
  const location = useLocation();
  const basePath = location.pathname.startsWith('/board') ? '/board' : '/tasks';
  return (id, title) => `${createUrlPath(basePath, id, title ?? '')}${location.search}`;
}


const DIRECTIONS: Array<{ direction: DependencyDirection; heading: string }> = [
  { direction: 'dependencies', heading: 'Depends on' },
  { direction: 'dependents', heading: 'Dependents' },
];

const BADGE_CLASS = 'shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-medium';

const NodeBadge: React.FC<{ node: DependencyGraphNode }> = ({ node }) => {
  if (node.state === 'missing') {
    return (
      <span className={`${BADGE_CLASS} bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300`}>
        Unknown ID
      </span>
    );
  }
  if (node.state === 'ambiguous') {
    return (
      <span className={`${BADGE_CLASS} bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300`}>
        Ambiguous ID
      </span>
    );
  }
  if (node.completed) {
    return (
      <span className={`${BADGE_CLASS} bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300`}>
        Completed
      </span>
    );
  }
  return (
    <span className={`${BADGE_CLASS} bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300`}>
      {node.status}
    </span>
  );
};

const REPEAT_LABELS: Record<NonNullable<DependencyTreeNode['repeat']>, string> = {
  cycle: 'Cycle',
  repeat: 'Shown above',
};

const NodeRow: React.FC<{ entry: DependencyTreeNode; direction: DependencyDirection }> = ({ entry, direction }) => {
  const { node } = entry;
  const taskHref = useTaskHref();
  const label = `${node.id}${node.title ? ` - ${node.title}` : ''}`;

  return (
    <div
      className="flex flex-wrap items-center gap-2 py-0.5"
      data-dependency-node={node.id}
      data-dependency-direction={direction}
      data-dependency-state={node.state}
    >
      {node.state === 'resolved' ? (
        <Link
          to={taskHref(node.id, node.title)}
          className="min-w-0 break-words text-sm text-gray-900 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-gray-100"
          aria-label={`Open ${label}`}
        >
          <span className="font-mono text-xs text-gray-500 dark:text-gray-400">{node.id}</span>
          {node.title ? <span className="ml-2">{node.title}</span> : null}
        </Link>
      ) : (
        <span className="min-w-0 break-words font-mono text-xs text-gray-500 dark:text-gray-400">{node.id}</span>
      )}
      <NodeBadge node={node} />
      {entry.repeat ? (
        <span className={`${BADGE_CLASS} bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400`}>
          {REPEAT_LABELS[entry.repeat]}
        </span>
      ) : null}
    </div>
  );
};

const TreeList: React.FC<{ entries: DependencyTreeNode[]; direction: DependencyDirection; nested: boolean }> = ({
  entries,
  direction,
  nested,
}) => (
  <ul className={nested ? 'ml-2 border-l border-gray-200 pl-3 dark:border-gray-700' : 'space-y-0.5'}>
    {entries.map((entry) => (
      <li key={entry.node.id}>
        <NodeRow entry={entry} direction={direction} />
        {entry.children.length > 0 ? (
          <TreeList entries={entry.children} direction={direction} nested />
        ) : null}
      </li>
    ))}
  </ul>
);

/**
 * The dependency context around the open task, rendered as nested lists so the shape is carried by
 * real structure a screen reader can announce rather than by drawn characters. Each node appears
 * once; a diamond or a cycle is marked instead of repeated.
 */
export const DependencyGraphSection: React.FC<{ graph: DependencyGraph }> = ({ graph }) => {
  const resolved = graph;

  const sections = DIRECTIONS.map(({ direction, heading }) => {
    const reached = nodesInDirection(resolved, direction);
    return {
      direction,
      heading,
      reached,
      direct: reached.filter((node) => depthInDirection(node, direction) === 1).length,
      tree: buildDependencyTree(resolved, direction),
    };
  }).filter((section) => section.reached.length > 0);

  if (sections.length === 0) return null;

  return (
    <div className="space-y-4" data-dependency-graph>
      {sections.map((section) => (
        <section key={section.direction} aria-label={`${section.heading} (${section.reached.length})`}>
          <div className="mb-1 flex items-baseline justify-between gap-2">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              {section.heading}
            </h4>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {`${section.direct} direct, ${section.reached.length} total`}
            </span>
          </div>
          <TreeList entries={section.tree} direction={section.direction} nested={false} />
        </section>
      ))}
    </div>
  );
};

export default DependencyGraphSection;
