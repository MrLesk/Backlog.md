import React from 'react';

interface NavigationProps {
  onNewTask: () => void;
  projectName: string;
}

const Navigation: React.FC<NavigationProps> = ({ onNewTask, projectName }) => {
  return (
    <nav className="bg-white border-b border-gray-200">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between py-4">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-gray-900">{projectName || 'Loading...'}</h1>
            <span className="text-sm text-gray-500">powered by</span>
            <a 
              href="https://backlog.md" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-sm text-blue-600 hover:text-blue-700 hover:underline"
            >
              Backlog.md
            </a>
          </div>
          <div className="flex items-center gap-2">
            <button 
              className="inline-flex items-center px-4 py-2 bg-blue-500 text-white text-sm font-medium rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-400 transition-colors cursor-pointer" 
              onClick={onNewTask}
            >
              + New Task
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navigation;