import React, {useState, useEffect, memo, useCallback} from 'react';
import {useParams, useNavigate, useSearchParams} from 'react-router-dom';
import {apiClient} from '../lib/api';
import MDEditor from '@uiw/react-md-editor';
import {type Document} from '../../types';
import ErrorBoundary from '../components/ErrorBoundary';
import {SuccessToast} from './SuccessToast';
import { useTheme } from '../contexts/ThemeContext';
import { sanitizeUrlTitle } from '../utils/urlHelpers';

// Custom MDEditor wrapper for proper height handling
const MarkdownEditor = memo(function MarkdownEditor({
	value,
	onChange,
	isEditing
}: {
    value: string;
    onChange?: (val: string | undefined) => void;
    isEditing: boolean;
    isReadonly?: boolean;
}) {
    const { theme } = useTheme();
    if (!isEditing) {
        // Preview mode - just show the rendered markdown without editor UI
        return (
            <div
                className="prose prose-sm max-w-none w-full p-6 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
                data-color-mode={theme}>
                <MDEditor.Markdown source={value}/>
            </div>
        );
    }

    // Edit mode - show full editor that fills the available space
    return (
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:bg-gray-800 w-full flex flex-col" style={{ minHeight: '500px', height: '70vh' }}>
            <MDEditor
                value={value}
                onChange={onChange}
                preview="edit"
                height="100%"
                hideToolbar={false}
                data-color-mode={theme}
                textareaProps={{
                    placeholder: 'Write your documentation here...',
                    style: {
                        fontSize: '14px',
                        resize: 'none'
                    }
                }}
            />
        </div>
    );
});

// Utility function to add doc prefix for API calls
const addDocPrefix = (id: string): string => {
    return id.startsWith('doc-') ? id : `doc-${id}`;
};

interface DocumentationDetailProps {
    docs: Document[];
    onRefreshData: () => Promise<void>;
}

export default function DocumentationDetail({docs, onRefreshData}: DocumentationDetailProps) {
    const {id, title} = useParams<{ id: string; title: string }>();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const [document, setDocument] = useState<Document | null>(null);
    const [content, setContent] = useState<string>('');
    const [originalContent, setOriginalContent] = useState<string>('');
    const [docTitle, setDocTitle] = useState<string>('');
    const [originalDocTitle, setOriginalDocTitle] = useState<string>('');
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [, setError] = useState<Error | null>(null);
    const [saveError, setSaveError] = useState<Error | null>(null);
    const [isNewDocument, setIsNewDocument] = useState(false);
    const [showSaveSuccess, setShowSaveSuccess] = useState(false);

    useEffect(() => {
        if (id === 'new') {
            // Handle new document creation
            setIsNewDocument(true);
            setIsEditing(true);
            setIsLoading(false);
            setDocTitle('');
            setOriginalDocTitle('');
            setContent('');
            setOriginalContent('');
        } else if (id) {
            setIsNewDocument(false);
            setIsEditing(false); // Ensure we start in preview mode for existing documents
            loadDocContent();
        }
    }, [id, docs]);

    // Check for edit query parameter to start in edit mode
    useEffect(() => {
        if (searchParams.get('edit') === 'true') {
            setIsEditing(true);
            // Remove the edit parameter from URL
            setSearchParams(params => {
                params.delete('edit');
                return params;
            });
        }
    }, [searchParams, setSearchParams]);

    const loadDocContent = useCallback(async () => {
        if (!id) return;

        try {
            setIsLoading(true);
            setError(null);
            // Find document from props
            const prefixedId = addDocPrefix(id);
            const doc = docs.find(d => d.id === prefixedId);
            
            // Always try to fetch the document from API, whether we found it in docs or not
            // This ensures deep linking works even before the parent component loads the docs array
            try {
                const fullDoc = await apiClient.fetchDoc(prefixedId);
                setContent(fullDoc.body || '');
                setOriginalContent(fullDoc.body || '');
                setDocTitle(fullDoc.title || '');
                setOriginalDocTitle(fullDoc.title || '');
                // Update document state with full data
                setDocument(fullDoc);
            } catch (fetchError) {
                // If fetch fails and we don't have the doc in props, show error
                if (!doc) {
                    setError(new Error(`Document with ID "${prefixedId}" not found`));
                    console.error('Failed to load document:', fetchError);
                } else {
                    // We have basic info from props even if fetch failed
                    setDocument(doc);
                    setDocTitle(doc.title || '');
                    setOriginalDocTitle(doc.title || '');
                }
            }
        } catch (err) {
            const error = err instanceof Error ? err : new Error('Failed to load document');
            setError(error);
            console.error('Failed to load document:', error);
        } finally {
            setIsLoading(false);
        }
    }, [id, docs]);

    const handleSave = useCallback(async () => {
        if (!docTitle.trim()) {
            setSaveError(new Error('Document title is required'));
            return;
        }

        try {
            setIsSaving(true);
            setSaveError(null);

            if (isNewDocument) {
                // Create new document
                const result = await apiClient.createDoc(docTitle, content);
                // Refresh data and navigate to the new document
                await onRefreshData();
                // Show success toast
                setShowSaveSuccess(true);
                setTimeout(() => setShowSaveSuccess(false), 4000);
                // Exit edit mode and navigate to the new document
                setIsEditing(false);
                setIsNewDocument(false);
                // Use the returned document ID for navigation
                const documentId = result.id.replace('doc-', ''); // Remove prefix for URL
                navigate(`/documentation/${documentId}/${sanitizeUrlTitle(docTitle)}`);
            } else {
                // Update existing document
                if (!id) return;
                await apiClient.updateDoc(addDocPrefix(id), content);
                // Refresh data from parent
                await onRefreshData();
                // Show success toast
                setShowSaveSuccess(true);
                setTimeout(() => setShowSaveSuccess(false), 4000);
                // Exit edit mode and navigate to document detail page (this will load in preview mode)
                setIsEditing(false);
                navigate(`/documentation/${id}/${sanitizeUrlTitle(docTitle)}`);
            }
        } catch (err) {
            const error = err instanceof Error ? err : new Error('Failed to save document');
            setSaveError(error);
            console.error('Failed to save document:', error);
        } finally {
            setIsSaving(false);
        }
    }, [id, docTitle, content, isNewDocument, onRefreshData, navigate, loadDocContent]);

    const handleEdit = () => {
        setIsEditing(true);
    };

    const handleCancelEdit = () => {
        if (isNewDocument) {
            // Navigate back for new documents
            navigate('/documentation');
        } else {
            // Revert changes for existing documents
            setContent(originalContent);
            setDocTitle(originalDocTitle);
            setIsEditing(false);
        }
    };

    const hasChanges = content !== originalContent || docTitle !== originalDocTitle;

    if (!id) {
        return (
            <div className="flex-1 flex items-center justify-center p-8">
                <div className="text-center">
                    <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor"
                         viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                    </svg>
                    <h3 className="mt-2 text-sm font-medium text-gray-900">No document selected</h3>
                    <p className="mt-1 text-sm text-gray-500">Select a document from the sidebar to view its
                        content.</p>
                </div>
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <div className="text-gray-500">Loading...</div>
            </div>
        );
    }

    return (
        <ErrorBoundary>
            <div className="h-full bg-white dark:bg-gray-900 flex flex-col transition-colors duration-200">
                {/* Header Section - Confluence/Linear Style */}
                <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 transition-colors duration-200">
                    <div className="max-w-4xl mx-auto px-8 py-6">
                        <div className="flex items-start justify-between mb-6">
                            <div className="flex-1">
                                {isEditing ? (
                                    <input
                                        type="text"
                                        value={docTitle}
                                        onChange={(e) => setDocTitle(e.target.value)}
                                        className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2 w-full bg-transparent border border-gray-300 dark:border-gray-600 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent transition-colors duration-200"
                                        placeholder="Document title"
                                    />
                                ) : (
                                    <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2 transition-colors duration-200">
                                        {docTitle || document?.title || (title ? decodeURIComponent(title) : `Document ${id}`)}
                                    </h1>
                                )}
                                <div className="flex items-center space-x-6 text-sm text-gray-500 dark:text-gray-400 transition-colors duration-200">
                                    <div className="flex items-center space-x-2">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                                  d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a.997.997 0 01-1.414 0l-7-7A1.997 1.997 0 013 12V7a4 4 0 014-4z"/>
                                        </svg>
                                        <span>ID: {document?.id || `doc-${id}`}</span>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                                  d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/>
                                        </svg>
                                        <span>Documentation</span>
                                    </div>
                                    {document?.createdDate && (
                                        <div className="flex items-center space-x-2">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor"
                                                 viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                                      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                                            </svg>
                                            <span>Created: {document.createdDate}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center space-x-3 ml-6">
                                {!isEditing ? (
                                    <button
                                        onClick={handleEdit}
                                        className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:ring-offset-2 dark:focus:ring-offset-gray-900 transition-colors duration-200"
                                    >
                                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor"
                                             viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                                        </svg>
                                        Edit
                                    </button>
                                ) : (
                                    <div className="flex items-center space-x-2">
                                        <button
                                            onClick={handleCancelEdit}
                                            className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 dark:focus:ring-gray-400 focus:ring-offset-2 dark:focus:ring-offset-gray-900 transition-colors duration-200 cursor-pointer"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={handleSave}
                                            disabled={!hasChanges || isSaving}
                                            className={`inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-900 transition-colors duration-200 ${
                                                hasChanges && !isSaving
                                                    ? 'bg-blue-600 dark:bg-blue-600 text-white hover:bg-blue-700 dark:hover:bg-blue-700 focus:ring-blue-500 dark:focus:ring-blue-400 cursor-pointer'
                                                    : 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                                            }`}
                                        >
                                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor"
                                                 viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                                      d="M5 13l4 4L19 7"/>
                                            </svg>
                                            {isSaving ? 'Saving...' : 'Save'}
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Content Section */}
                <div className="flex-1 overflow-auto bg-gray-50 dark:bg-gray-800 transition-colors duration-200">
                    <div className="py-8 px-8">
                        <MarkdownEditor
                            value={content}
                            onChange={(val) => setContent(val || '')}
                            isEditing={isEditing}
                        />
                    </div>
                </div>

                {/* Save Error Alert */}
                {saveError && (
                    <div className="border-t border-red-200 bg-red-50 px-8 py-3">
                        <div className="flex items-center space-x-3">
                            <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.464 0L4.35 16.5c-.77.833.192 2.5 1.732 2.5z"/>
                            </svg>
                            <span className="text-sm text-red-700">Failed to save: {saveError.message}</span>
                            <button
                                onClick={() => setSaveError(null)}
                                className="ml-auto text-red-700 hover:text-red-900"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                          d="M6 18L18 6M6 6l12 12"/>
                                </svg>
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Save Success Toast */}
            {showSaveSuccess && (
                <SuccessToast
                    message={`Document "${docTitle}" saved successfully!`}
                    onDismiss={() => setShowSaveSuccess(false)}
                    icon={
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                        </svg>
                    }
                />
            )}
        </ErrorBoundary>
    );
}