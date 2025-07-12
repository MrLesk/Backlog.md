import React from 'react';

interface NavigationProps {
    projectName: string;
}

const Navigation: React.FC<NavigationProps> = ({projectName}) => {
    return (
        <nav className="px-8 h-18 border-b border-gray-200">
            <div className="h-full flex items-center gap-2">
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
        </nav>
    );
};

export default Navigation;