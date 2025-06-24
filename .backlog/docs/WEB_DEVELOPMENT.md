# Web Interface Development Guide

This guide covers developing the React-based web interface for Backlog.md.

## Architecture Overview

The web interface is built with modern React and embedded into the CLI executable for zero-dependency deployment.

### Tech Stack

- **Frontend**: React 19 with TypeScript
- **UI Framework**: shadcn/ui + Radix UI primitives
- **Styling**: Tailwind CSS v4
- **State Management**: React Query (TanStack Query)
- **Drag & Drop**: @dnd-kit
- **Forms**: React Hook Form + Zod validation
- **Build Tool**: Vite 7
- **HTTP Server**: Bun.serve() (embedded in CLI)

### Project Structure

```
src/web/
├── src/
│   ├── components/          # React components
│   │   ├── ui/             # shadcn/ui base components
│   │   ├── KanbanBoard/    # Kanban board module
│   │   ├── TaskList.tsx    # Task table view
│   │   ├── TaskDetail.tsx  # Task detail modal
│   │   └── TaskForm.tsx    # Task create/edit form
│   ├── lib/
│   │   ├── api.ts          # API client functions
│   │   ├── mockData.ts     # Development mock data
│   │   └── utils.ts        # Utility functions
│   ├── App.tsx             # Main application component
│   └── main.tsx            # React entry point
├── package.json            # Web app dependencies
├── vite.config.ts          # Vite configuration
└── tailwind.config.js      # Tailwind configuration
```

## Development Setup

### Prerequisites

- Bun runtime (latest version)
- Node.js 18+ (for compatibility)

### Getting Started

1. **Clone and install dependencies**:
   ```bash
   git clone <repository>
   cd Backlog.md
   bun install
   ```

2. **Start development servers**:
   ```bash
   # Terminal 1: Start CLI server (backend API)
   bun src/cli.ts serve --no-open
   
   # Terminal 2: Start web dev server (frontend)
   cd src/web
   bun run dev
   ```

3. **Access the interface**:
   - Web dev server: http://localhost:5173
   - CLI server API: http://localhost:3000/api/*

### API Integration

The web interface connects to the CLI server's API endpoints:

```typescript
// Example API client usage
import { getTasks, createTask, updateTask } from './lib/api';

// Fetch all tasks
const tasks = await getTasks();

// Create a new task
const newTask = await createTask({
  title: 'New Feature',
  description: 'Implement new functionality',
  status: 'To Do'
});

// Update task status
await updateTask('task-1', { status: 'In Progress' });
```

## Component Development

### Adding shadcn/ui Components

1. **Install new components**:
   ```bash
   cd src/web
   npx shadcn-ui@latest add button dialog form
   ```

2. **Use in your components**:
   ```tsx
   import { Button } from '@/components/ui/button';
   import { Dialog, DialogContent } from '@/components/ui/dialog';
   
   export function MyComponent() {
     return (
       <Dialog>
         <DialogContent>
           <Button variant="default">Save</Button>
         </DialogContent>
       </Dialog>
     );
   }
   ```

### Custom Hook Patterns

Create reusable hooks for common functionality:

```tsx
// hooks/useTasks.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getTasks, updateTask } from '@/lib/api';

export function useTasks() {
  return useQuery({
    queryKey: ['tasks'],
    queryFn: getTasks,
  });
}

export function useUpdateTask() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, data }) => updateTask(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}
```

### Form Validation

Use Zod schemas for consistent validation:

```tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

const taskSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  status: z.enum(['To Do', 'In Progress', 'Done']),
});

export function TaskForm() {
  const form = useForm({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      title: '',
      description: '',
      status: 'To Do',
    },
  });
  
  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      {/* Form fields */}
    </form>
  );
}
```

## Testing

### Component Testing

Use Bun's built-in test runner:

```bash
cd src/web
bun test
```

Example test:

```tsx
// components/__tests__/TaskCard.test.tsx
import { render, screen } from '@testing-library/react';
import { TaskCard } from '../TaskCard';

test('renders task title', () => {
  const task = {
    id: 'task-1',
    title: 'Test Task',
    status: 'To Do',
  };
  
  render(<TaskCard task={task} />);
  expect(screen.getByText('Test Task')).toBeInTheDocument();
});
```

### API Integration Testing

Test API integration using the actual CLI server:

```typescript
// __tests__/api.test.ts
import { getTasks, createTask } from '../lib/api';

test('should fetch tasks from API', async () => {
  const tasks = await getTasks();
  expect(Array.isArray(tasks)).toBe(true);
});
```

## Build and Deployment

### Production Build

```bash
# Build optimized web assets
cd src/web
bun run build

# Generate embedded assets module
bun scripts/generate-embedded-assets.ts

# Build CLI with embedded web interface
bun run build:cli
```

### Build Optimization

The Vite configuration includes:

- **Code Splitting**: Separate chunks for vendors, UI libraries, etc.
- **Tree Shaking**: Remove unused code
- **Minification**: Compress JavaScript and CSS
- **Asset Hashing**: Cache-busting filenames

### Asset Embedding

Web assets are embedded into the CLI executable using a TypeScript module generation approach:

1. Vite builds optimized assets to `dist/`
2. `scripts/generate-embedded-assets.ts` scans files and creates TypeScript module at `src/server/embedded-assets.ts`
3. CLI build includes the embedded assets module
4. Server serves assets from memory at runtime

This approach provides better control and reliability than Bun's native embedding features.

## Performance Optimization

### React Query Configuration

```tsx
// Setup efficient caching and background updates
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      cacheTime: 10 * 60 * 1000, // 10 minutes
      refetchOnWindowFocus: false,
    },
  },
});
```

### Code Splitting

Split large features into separate bundles:

```tsx
// Lazy load heavy components
const TaskAnalytics = lazy(() => import('./TaskAnalytics'));

function App() {
  return (
    <Suspense fallback={<Loading />}>
      <TaskAnalytics />
    </Suspense>
  );
}
```

### Bundle Analysis

Analyze bundle size:

```bash
cd src/web
bun run build --analyze
```

## Common Patterns

### Error Handling

```tsx
function TaskList() {
  const { data: tasks, error, isLoading } = useTasks();
  
  if (isLoading) return <Loading />;
  if (error) return <ErrorMessage error={error} />;
  
  return (
    <div>
      {tasks.map(task => (
        <TaskCard key={task.id} task={task} />
      ))}
    </div>
  );
}
```

### Responsive Design

Use Tailwind's responsive utilities:

```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  {/* Content adapts to screen size */}
</div>
```

### Drag and Drop

Implement drag and drop with @dnd-kit:

```tsx
import { DndContext, closestCenter } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';

function KanbanBoard() {
  const handleDragEnd = (event) => {
    // Handle task movement between columns
  };
  
  return (
    <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
        {/* Sortable items */}
      </SortableContext>
    </DndContext>
  );
}
```

## Troubleshooting

### Common Issues

**API Connection Errors**: Ensure the CLI server is running on the expected port

**Asset Loading Issues**: Verify the embedded assets were generated correctly

**TypeScript Errors**: Check that all dependencies are installed and up to date

**Build Failures**: Clear `node_modules` and reinstall dependencies

### Debug Mode

Enable development mode for detailed logging:

```bash
NODE_ENV=development bun src/cli.ts serve
```

## Contributing

1. **Follow the existing code style** using Biome formatter and linter
2. **Write tests** for new components and functionality  
3. **Update documentation** when adding new features
4. **Test across browsers** to ensure compatibility

For questions or issues, refer to the main project documentation or open an issue on GitHub.