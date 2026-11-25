import type React from 'react';
import {
  buildDependencyTree,
  type DependencyDirection,
  type DependencyGraph,
  type DependencyGraphNode,
  type DependencyTreeNode,
  depthInDirection,
  nodesInDirection,
} from '../../utils/dependency-graph.ts';
import { useBrowserAccess } from '../contexts/BrowserAccessContext';
import { useTaskIdIndex } from '../contexts/TaskIdIndexContext';
import { resolveTaskReference } from '../utils/task-id-links';
import TaskLink from './TaskLink';

const DIRECTIONS: Array<{ direction: DependencyDirection; heading: string }> = [
  { direction: 'dependencies', heading: 'Depends on' },
  { direction: 'dependents', heading: 'Dependents' },
];

const BADGE_CLASS = 'shrink-0 rounded-chip px-1.5 py-0.5 text-[11px] font-medium';

const NodeBadge: React.FC<{ node: DependencyGraphNode }> = ({ node }) => {
  if (node.state === 'missing') {
    return (
      <span className={`${BADGE_CLASS} bg-you-bg text-you`}>
        Unknown ID
      </span>
    );
  }
  if (node.state === 'ambiguous') {
    return (
      <span className={`${BADGE_CLASS} bg-you-bg text-you`}>
        Ambiguous ID
      </span>
    );
  }
  if (node.completed) {
    return (
      <span className={`${BADGE_CLASS} bg-surface-2 text-ink`}>
        Completed
      </span>
    );
  }
  return (
    <span className={`${BADGE_CLASS} bg-surface-2 text-ink-2`}>
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
  const { canWrite } = useBrowserAccess();
  const tasks = useTaskIdIndex();
  const canOpen = node.state === 'resolved' && (canWrite || Boolean(resolveTaskReference(tasks, node.id)));
  const label = `${node.id}${node.title ? ` - ${node.title}` : ''}`;

  return (
    <div
      className="flex flex-wrap items-center gap-2 py-0.5"
      data-dependency-node={node.id}
      data-dependency-direction={direction}
      data-dependency-state={node.state}
    >
      {canOpen ? (
        <TaskLink
          task={{ id: node.id, title: node.title ?? '' }}
          className="min-w-0 break-words rounded-[4px] text-sm text-ink hover:underline focus-ring"
          aria-label={`Open ${label}`}
        >
          <span className="font-mono text-xs text-ink-3">{node.id}</span>
          {node.title ? <span className="ml-2">{node.title}</span> : null}
        </TaskLink>
      ) : (
        <span className="min-w-0 break-words font-mono text-xs text-ink-3">{node.id}</span>
      )}
      <NodeBadge node={node} />
      {entry.repeat ? (
        <span className={`${BADGE_CLASS} bg-surface-2 text-ink-3`}>
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
  <ul className={nested ? 'ml-2 border-l border-line pl-3' : 'space-y-0.5'}>
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
            <h4 className="text-xs font-semibold text-ink-2">
              {section.heading}
            </h4>
            <span className="font-mono text-[11.5px] text-ink-3">
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
