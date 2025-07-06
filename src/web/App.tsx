import React, { useState } from 'react';
import Board from './components/Board';
import Navigation from './components/Navigation';
import Modal from './components/Modal';
import TaskForm from './components/TaskForm';
import { Task } from './types/task';
import { apiClient } from './lib/api';

function App() {
  const [showModal, setShowModal] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [statuses, setStatuses] = useState<string[]>([]);
  const [projectName, setProjectName] = useState<string>('');

  React.useEffect(() => {
    const loadData = async () => {
      try {
        const [statusesData, configData] = await Promise.all([
          apiClient.fetchStatuses(),
          apiClient.fetchConfig()
        ]);
        setStatuses(statusesData);
        setProjectName(configData.projectName);
      } catch (error) {
        console.error('Failed to load data:', error);
      }
    };
    loadData();
  }, []);

  // Update document title when project name changes
  React.useEffect(() => {
    if (projectName) {
      document.title = `${projectName} - Task Management`;
    }
  }, [projectName]);

  const handleNewTask = () => {
    setEditingTask(null);
    setShowModal(true);
  };

  const handleEditTask = (task: Task) => {
    setEditingTask(task);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingTask(null);
  };

  const handleSubmitTask = async (taskData: Partial<Task>) => {
    try {
      if (editingTask) {
        await apiClient.updateTask(editingTask.id, taskData);
      } else {
        await apiClient.createTask(taskData);
      }
      handleCloseModal();
      window.location.reload();
    } catch (error) {
      console.error('Failed to save task:', error);
    }
  };

  const handleArchiveTask = async (taskId: string) => {
    try {
      await apiClient.archiveTask(taskId);
      handleCloseModal();
      window.location.reload();
    } catch (error) {
      console.error('Failed to archive task:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation onNewTask={handleNewTask} projectName={projectName} />
      <main className="container mx-auto px-4 py-8">
        <Board onEditTask={handleEditTask} />
      </main>
      
      <Modal
        isOpen={showModal}
        onClose={handleCloseModal}
        title={editingTask ? `Edit Task ${editingTask.id.replace('task-', '')}` : 'Create New Task'}
      >
        <TaskForm
          task={editingTask || undefined}
          onSubmit={handleSubmitTask}
          onCancel={handleCloseModal}
          onArchive={editingTask ? () => handleArchiveTask(editingTask.id) : undefined}
          availableStatuses={statuses}
        />
      </Modal>
    </div>
  );
}

export default App;