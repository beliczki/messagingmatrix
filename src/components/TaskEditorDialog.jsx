import React from 'react';
import { X, Trash2, Mail, Clock } from 'lucide-react';

const TaskEditorDialog = ({
  editingTask,
  setEditingTask,
  onSave,
  onDelete,
  buckets
}) => {
  if (!editingTask) return null;

  const handleSave = () => {
    onSave(editingTask);
    setEditingTask(null);
  };

  const handleDelete = () => {
    if (window.confirm('Are you sure you want to delete this task?')) {
      onDelete(editingTask.id);
      setEditingTask(null);
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority?.toLowerCase()) {
      case 'high':
        return 'bg-red-50 border-red-200';
      case 'medium':
        return 'bg-yellow-50 border-yellow-200';
      case 'low':
        return 'bg-green-50 border-green-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between rounded-t-lg">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-semibold">Edit Task</h2>
            {editingTask.status === 'completed' && (
              <span className="px-3 py-1 bg-green-100 text-green-700 rounded text-sm font-medium">
                Completed
              </span>
            )}
          </div>
          <button
            onClick={() => setEditingTask(null)}
            className="p-1 hover:bg-gray-100 rounded"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
            <input
              type="text"
              value={editingTask.title || ''}
              onChange={(e) => setEditingTask({ ...editingTask, title: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter task title"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={editingTask.description || ''}
              onChange={(e) => setEditingTask({ ...editingTask, description: e.target.value })}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter task description"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
              <select
                value={editingTask.priority || 'Medium'}
                onChange={(e) => setEditingTask({ ...editingTask, priority: e.target.value })}
                className={`w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent ${getPriorityColor(editingTask.priority)}`}
              >
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bucket</label>
              <select
                value={editingTask.bucket || 'backlog'}
                onChange={(e) => setEditingTask({ ...editingTask, bucket: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {buckets.map(bucket => (
                  <option key={bucket.id} value={bucket.id}>
                    {bucket.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
            <input
              type="date"
              value={editingTask.dueDate || ''}
              onChange={(e) => setEditingTask({ ...editingTask, dueDate: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {editingTask.from && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <Mail size={14} className="inline mr-1" />
                From
              </label>
              <input
                type="text"
                value={editingTask.from}
                disabled
                className="w-full px-3 py-2 border border-gray-300 rounded bg-gray-50 text-gray-500 cursor-not-allowed"
              />
            </div>
          )}

          {editingTask.source && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Source</label>
              <input
                type="text"
                value={editingTask.source}
                disabled
                className="w-full px-3 py-2 border border-gray-300 rounded bg-gray-50 text-gray-500 cursor-not-allowed"
              />
            </div>
          )}

          {editingTask.createdAt && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <Clock size={14} className="inline mr-1" />
                Created
              </label>
              <input
                type="text"
                value={new Date(editingTask.createdAt).toLocaleString()}
                disabled
                className="w-full px-3 py-2 border border-gray-300 rounded bg-gray-50 text-gray-500 cursor-not-allowed"
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t bg-white px-6 py-4 flex items-center justify-between shrink-0 rounded-b-lg">
          <button
            onClick={handleDelete}
            className="flex items-center gap-2 px-4 py-2 border border-red-300 text-red-600 rounded hover:bg-red-50 transition-colors"
          >
            <Trash2 size={16} />
            Delete Task
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setEditingTask(null)}
              className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
              Save & Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TaskEditorDialog;
