import React, { useState, useEffect, useRef } from 'react';
import { RefreshCw, CheckCircle, Circle, Clock, Trash2, Mail, AlertCircle, Filter, List, LayoutGrid } from 'lucide-react';
import PageHeader, { getButtonStyle } from './PageHeader';
import ClaudeChat from './ClaudeChat';
import TaskEditorDialog from './TaskEditorDialog';

const Tasks = ({ onMenuToggle, currentModuleName, lookAndFeel }) => {
  const claudeChatRef = useRef(null);
  const [tasks, setTasks] = useState([]);
  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [filterText, setFilterText] = useState('');
  const [viewMode, setViewMode] = useState('card'); // 'list' or 'card'
  const [processedEmailUids, setProcessedEmailUids] = useState([]);
  const [draggedTask, setDraggedTask] = useState(null);
  const [editingTask, setEditingTask] = useState(null);

  // Load tasks from server on mount
  useEffect(() => {
    loadTasks();
    loadProcessedEmails();
  }, []);

  // Save tasks to server whenever they change (debounced)
  useEffect(() => {
    if (tasks.length >= 0) {
      const timer = setTimeout(() => {
        saveTasks();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [tasks]);

  const loadTasks = async () => {
    try {
      const response = await fetch('http://localhost:3003/api/tasks');
      if (response.ok) {
        const data = await response.json();
        setTasks(data.tasks || []);
      }
    } catch (err) {
      console.error('Error loading tasks:', err);
    }
  };

  const saveTasks = async () => {
    try {
      await fetch('http://localhost:3003/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tasks })
      });
    } catch (err) {
      console.error('Error saving tasks:', err);
    }
  };

  const loadProcessedEmails = async () => {
    try {
      const response = await fetch('http://localhost:3003/api/processed-emails');
      if (response.ok) {
        const data = await response.json();
        setProcessedEmailUids(data.processedEmails || []);
      }
    } catch (err) {
      console.error('Error loading processed emails:', err);
    }
  };

  const markEmailsAsProcessed = async (emailUids) => {
    try {
      const response = await fetch('http://localhost:3003/api/processed-emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailUids })
      });
      if (response.ok) {
        const data = await response.json();
        setProcessedEmailUids(data.processedEmails || []);
      }
    } catch (err) {
      console.error('Error marking emails as processed:', err);
    }
  };

  const handleFetchAndConvert = async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch emails
      const response = await fetch('http://localhost:3003/api/emails?limit=10&unseenOnly=true');
      if (!response.ok) {
        throw new Error('Failed to fetch emails');
      }
      const data = await response.json();
      const fetchedEmails = data.emails || [];
      setEmails(fetchedEmails);

      // Filter out already processed emails
      const newEmails = fetchedEmails.filter(email => !processedEmailUids.includes(email.uid));

      if (newEmails.length === 0) {
        setError('No new emails to process (all emails already converted to tasks)');
        setLoading(false);
        return;
      }

      // Convert new emails to tasks
      const convertResponse = await fetch('http://localhost:3003/api/emails/convert-to-tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emails: newEmails }),
      });

      if (!convertResponse.ok) {
        throw new Error('Failed to convert emails to tasks');
      }

      const convertData = await convertResponse.json();
      const newTasks = convertData.tasks || [];

      // Add new tasks to existing tasks
      setTasks(prev => [...newTasks, ...prev]);

      // Mark these emails as processed
      const emailUidsToMark = newEmails.map(e => e.uid);
      await markEmailsAsProcessed(emailUidsToMark);

    } catch (err) {
      setError(err.message);
      console.error('Error fetching/converting emails:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleTaskStatus = (taskId) => {
    setTasks(prev =>
      prev.map(task =>
        task.id === taskId
          ? { ...task, status: task.status === 'completed' ? 'pending' : 'completed' }
          : task
      )
    );
  };

  const moveTaskToBucket = (taskId, newBucket) => {
    setTasks(prev =>
      prev.map(task =>
        task.id === taskId
          ? { ...task, bucket: newBucket }
          : task
      )
    );
  };

  const deleteTask = (taskId) => {
    setTasks(prev => prev.filter(task => task.id !== taskId));
  };

  const updateTask = (updatedTask) => {
    setTasks(prev => prev.map(t => t.id === updatedTask.id ? updatedTask : t));
  };

  const buckets = [
    { id: 'backlog', name: 'Backlog', description: 'All ideas and requests', color: 'bg-gray-100 border-gray-300' },
    { id: 'planning', name: 'Planning', description: 'Items being scoped/briefed', color: 'bg-blue-50 border-blue-300' },
    { id: 'production', name: 'In Production', description: 'Active work', color: 'bg-yellow-50 border-yellow-300' },
    { id: 'review', name: 'Review', description: 'Under review, Approved', color: 'bg-purple-50 border-purple-300' },
    { id: 'dead', name: 'Dead', description: 'Discontinued tasks', color: 'bg-red-50 border-red-300' }
  ];

  const getPriorityColor = (priority) => {
    switch (priority?.toLowerCase()) {
      case 'high':
        return 'text-red-600 bg-red-50 border-red-200';
      case 'medium':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'low':
        return 'text-green-600 bg-green-50 border-green-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return null;
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return null;
    }
  };

  const filteredTasks = tasks.filter(task => {
    if (!filterText.trim()) return true;

    const searchableText = [
      task.title,
      task.description,
      task.priority,
      task.from,
      task.source,
      task.status
    ].filter(Boolean).join(' ').toLowerCase();

    const filterLower = filterText.toLowerCase();

    // Support 'and' / 'or' operators like in CreativeLibrary
    if (filterLower.includes(' or ')) {
      const orTerms = filterLower.split(' or ').map(t => t.trim()).filter(t => t.length > 0);
      return orTerms.some(term => {
        if (term.includes(' and ')) {
          const andTerms = term.split(' and ').map(t => t.trim()).filter(t => t.length > 0);
          return andTerms.every(andTerm => searchableText.includes(andTerm));
        }
        return searchableText.includes(term);
      });
    } else if (filterLower.includes(' and ')) {
      const andTerms = filterLower.split(' and ').map(t => t.trim()).filter(t => t.length > 0);
      return andTerms.every(term => searchableText.includes(term));
    } else {
      const terms = filterLower.split(/\s+/).filter(t => t.length > 0);
      return terms.every(term => searchableText.includes(term));
    }
  });

  const pendingTasks = filteredTasks.filter(t => t.status !== 'completed');
  const completedTasks = filteredTasks.filter(t => t.status === 'completed');

  // Drag handlers for Kanban board
  const handleDragStart = (task) => {
    setDraggedTask(task);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (bucketId) => {
    if (draggedTask && draggedTask.bucket !== bucketId) {
      moveTaskToBucket(draggedTask.id, bucketId);
    }
    setDraggedTask(null);
  };

  const handleDragEnd = () => {
    setDraggedTask(null);
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <PageHeader
        title={currentModuleName || 'Tasks'}
        onMenuToggle={onMenuToggle}
        lookAndFeel={lookAndFeel}
        viewMode={viewMode}
        setViewMode={setViewMode}
        viewModes={[
          { value: 'list', label: 'List View' },
          { value: 'card', label: 'Card View' }
        ]}
        titleFilters={
          <>
            {/* Filter Input */}
            <div className="flex items-center gap-2">
              <Filter size={18} className="text-white" />
              <input
                type="text"
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                placeholder="Filter tasks..."
                className="w-64 px-3 py-2 border border-white/20 rounded bg-white/10 text-white placeholder-white/60 focus:ring-2 focus:ring-white/30 focus:border-white/30 focus:bg-white/20"
              />
            </div>

            {/* Task Count */}
            {tasks.length > 0 && (
              <div className="text-sm text-white/80 whitespace-nowrap">
                {pendingTasks.length} pending, {completedTasks.length} completed
              </div>
            )}
          </>
        }
      >
        <button
          onClick={handleFetchAndConvert}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 text-white rounded hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          style={getButtonStyle(lookAndFeel)}
        >
          {loading ? (
            <>
              <RefreshCw className="animate-spin" size={18} />
              Processing...
            </>
          ) : (
            <>
              <Mail size={18} />
              Fetch Emails
            </>
          )}
        </button>
      </PageHeader>

      {/* Main Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className={viewMode === 'card' ? 'mx-auto' : 'max-w-5xl mx-auto'}>
          {/* Error Display */}
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
              <AlertCircle className="text-red-600 flex-shrink-0 mt-0.5" size={20} />
              <div>
                <h3 className="font-semibold text-red-900">Error</h3>
                <p className="text-red-700 text-sm">{error}</p>
              </div>
            </div>
          )}

          {/* Tasks Display */}
          {filteredTasks.length === 0 && tasks.length === 0 ? (
            <div className="text-center py-12">
              <Mail className="mx-auto mb-4 text-gray-400" size={48} />
              <h3 className="text-lg font-semibold text-gray-700 mb-2">No tasks yet</h3>
              <p className="text-gray-500 mb-4">
                Click "Fetch Emails" in the header to create tasks from your emails
              </p>
            </div>
          ) : filteredTasks.length === 0 ? (
            <div className="text-center py-12">
              <AlertCircle className="mx-auto mb-4 text-gray-400" size={48} />
              <h3 className="text-lg font-semibold text-gray-700 mb-2">No tasks match your filter</h3>
              <p className="text-gray-500">Try adjusting your search terms</p>
            </div>
          ) : viewMode === 'list' ? (
            <div className="space-y-6">
              {/* Pending Tasks */}
              {pendingTasks.length > 0 && (
                <div>
                  <h2 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2">
                    <Clock size={20} className="text-blue-600" />
                    Pending Tasks ({pendingTasks.length})
                  </h2>
                  <div className="space-y-3">
                    {pendingTasks.map(task => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        onToggleStatus={toggleTaskStatus}
                        onEdit={setEditingTask}
                        getPriorityColor={getPriorityColor}
                        formatDate={formatDate}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Completed Tasks */}
              {completedTasks.length > 0 && (
                <div>
                  <h2 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2">
                    <CheckCircle size={20} className="text-green-600" />
                    Completed Tasks ({completedTasks.length})
                  </h2>
                  <div className="space-y-3">
                    {completedTasks.map(task => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        onToggleStatus={toggleTaskStatus}
                        onEdit={setEditingTask}
                        getPriorityColor={getPriorityColor}
                        formatDate={formatDate}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            // Card/Board View - Kanban Board
            <div className="flex gap-4 overflow-x-auto pb-4">
              {buckets.map(bucket => {
                const bucketTasks = filteredTasks.filter(task =>
                  (task.bucket || 'backlog') === bucket.id
                );

                return (
                  <div key={bucket.id} className="flex-shrink-0 w-80">
                    {/* Bucket Header */}
                    <div className={`${bucket.color} border-2 rounded-t-lg p-3`}>
                      <h3 className="font-bold text-gray-800 text-sm uppercase tracking-wide">
                        {bucket.name}
                      </h3>
                      <p className="text-xs text-gray-600 mt-1">{bucket.description}</p>
                      <div className="text-xs text-gray-500 mt-2">
                        {bucketTasks.length} {bucketTasks.length === 1 ? 'task' : 'tasks'}
                      </div>
                    </div>

                    {/* Bucket Content */}
                    <div
                      className={`${bucket.color} border-2 border-t-0 rounded-b-lg p-3 min-h-[200px] max-h-[calc(100vh-350px)] overflow-y-auto`}
                      onDragOver={handleDragOver}
                      onDrop={() => handleDrop(bucket.id)}
                    >
                      <div className="space-y-3">
                        {bucketTasks.map(task => (
                          <KanbanTaskCard
                            key={task.id}
                            task={task}
                            onDragStart={() => handleDragStart(task)}
                            onDragEnd={handleDragEnd}
                            onToggleStatus={toggleTaskStatus}
                            onEdit={setEditingTask}
                            getPriorityColor={getPriorityColor}
                            formatDate={formatDate}
                          />
                        ))}
                        {bucketTasks.length === 0 && (
                          <div className="text-center py-8 text-gray-400 text-sm">
                            No tasks in this bucket
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Task Editor Dialog */}
      <TaskEditorDialog
        editingTask={editingTask}
        setEditingTask={setEditingTask}
        onSave={updateTask}
        onDelete={deleteTask}
        buckets={buckets}
      />

      {/* Claude Chat Module */}
      <ClaudeChat
        ref={claudeChatRef}
        taskContext={{
          tasks,
          emails
        }}
      />
    </div>
  );
};

const TaskCard = ({ task, onToggleStatus, onEdit, getPriorityColor, formatDate }) => {
  const isCompleted = task.status === 'completed';

  return (
    <div
      onDoubleClick={() => onEdit(task)}
      className={`bg-white border rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer ${
        isCompleted ? 'opacity-60' : ''
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Checkbox */}
        <button
          onClick={() => onToggleStatus(task.id)}
          className="flex-shrink-0 mt-1"
        >
          {isCompleted ? (
            <CheckCircle className="text-green-600" size={20} />
          ) : (
            <Circle className="text-gray-400 hover:text-gray-600" size={20} />
          )}
        </button>

        {/* Task Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-2">
            <h3 className={`font-semibold text-gray-900 ${isCompleted ? 'line-through' : ''}`}>
              {task.title}
            </h3>
            <div className="flex items-center gap-2 flex-shrink-0">
              {task.priority && (
                <span
                  className={`px-2 py-1 text-xs font-medium rounded border ${getPriorityColor(
                    task.priority
                  )}`}
                >
                  {task.priority}
                </span>
              )}
            </div>
          </div>

          {task.description && (
            <p className={`text-sm text-gray-600 mb-2 ${isCompleted ? 'line-through' : ''}`}>
              {task.description}
            </p>
          )}

          <div className="flex items-center gap-4 text-xs text-gray-500">
            {task.from && (
              <div className="flex items-center gap-1">
                <Mail size={12} />
                <span>{task.from}</span>
              </div>
            )}
            {task.source && (
              <div className="truncate">
                From: {task.source}
              </div>
            )}
            {task.dueDate && (
              <div className="flex items-center gap-1">
                <Clock size={12} />
                <span>Due: {formatDate(task.dueDate)}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const KanbanTaskCard = ({ task, onDragStart, onDragEnd, onToggleStatus, onEdit, getPriorityColor, formatDate }) => {
  const isCompleted = task.status === 'completed';

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDoubleClick={() => onEdit(task)}
      className="bg-white rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow border border-gray-200 relative group cursor-move"
    >
      {/* Card Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleStatus(task.id);
          }}
          className="flex-shrink-0"
        >
          {isCompleted ? (
            <CheckCircle className="text-green-600" size={16} />
          ) : (
            <Circle className="text-gray-400 hover:text-gray-600" size={16} />
          )}
        </button>

        <div className="flex items-center gap-1 flex-shrink-0">
          {task.priority && (
            <span
              className={`px-1.5 py-0.5 text-xs font-medium rounded ${getPriorityColor(
                task.priority
              )}`}
            >
              {task.priority}
            </span>
          )}
        </div>
      </div>

      {/* Title */}
      <h4 className={`text-sm font-semibold text-gray-900 mb-2 ${isCompleted ? 'line-through' : ''}`}>
        {task.title}
      </h4>

      {/* Description */}
      {task.description && (
        <p className={`text-xs text-gray-600 mb-2 line-clamp-2 ${isCompleted ? 'line-through' : ''}`}>
          {task.description}
        </p>
      )}

      {/* Footer */}
      <div className="space-y-1">
        {task.from && (
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <Mail size={10} />
            <span className="truncate">{task.from}</span>
          </div>
        )}
        {task.dueDate && (
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <Clock size={10} />
            <span>{formatDate(task.dueDate)}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default Tasks;
