import React, { useState, useEffect, useRef, useMemo } from 'react';
import { RefreshCw, CheckCircle, Circle, Clock, Trash2, Mail, AlertCircle, Filter, List, LayoutGrid, Tag, Palette, Plus, Edit2, GripVertical } from 'lucide-react';
import { apiGet, apiPost } from '../utils/api';
import AIAssistant from './AIAssistant';
import TaskEditorDialog from './TaskEditorDialog';
import TaskToolbar from './TaskToolbar';

const Tasks = ({ onMenuToggle, currentModuleName, lookAndFeel, matrixData }) => {
  const claudeChatRef = useRef(null);
  const [tasks, setTasks] = useState([]);
  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [filterText, setFilterText] = useState('');
  const [viewMode, setViewMode] = useState('kanban'); // 'kanban' or 'workflow'
  const [processedEmailUids, setProcessedEmailUids] = useState([]);
  const [draggedTask, setDraggedTask] = useState(null);
  const [editingTask, setEditingTask] = useState(null);
  const [workflowTypeFilter, setWorkflowTypeFilter] = useState('all'); // 'all', 'general', 'creative'

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
      const response = await apiGet('/api/tasks');
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
      await apiPost('/api/tasks', { tasks });
    } catch (err) {
      console.error('Error saving tasks:', err);
    }
  };

  const loadProcessedEmails = async () => {
    try {
      const response = await apiGet('/api/processed-emails');
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
      const response = await apiPost('/api/processed-emails', { emailUids });
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
      const response = await apiGet('/api/emails?limit=10&unseenOnly=true');
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

      // Use AI Assistant to process emails (this will open the assistant panel)
      if (claudeChatRef.current && claudeChatRef.current.processEmailsToTasks) {
        claudeChatRef.current.processEmailsToTasks(newEmails, (newTasks) => {
          // Callback to add tasks when user clicks "Create Tasks" button
          setTasks(prev => [...newTasks, ...prev]);

          // Mark these emails as processed
          const emailUidsToMark = newEmails.map(e => e.uid);
          markEmailsAsProcessed(emailUidsToMark);
        });
      } else {
        throw new Error('AI Assistant not available or not configured');
      }

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

  const getLabelColor = (label) => {
    // Simple color scheme for labels - you can customize
    const colors = [
      'bg-blue-100 text-blue-700 border-blue-300',
      'bg-purple-100 text-purple-700 border-purple-300',
      'bg-green-100 text-green-700 border-green-300',
      'bg-orange-100 text-orange-700 border-orange-300',
      'bg-pink-100 text-pink-700 border-pink-300',
      'bg-indigo-100 text-indigo-700 border-indigo-300',
      'bg-teal-100 text-teal-700 border-teal-300'
    ];
    // Simple hash to get consistent color for same label
    const hash = label.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
  };

  const getBucketHeaderStyle = (bucketId) => {
    switch (bucketId) {
      case 'backlog':
        return { backgroundColor: '#6B7280' }; // Middle grey
      case 'dead':
        return { backgroundColor: '#DC2626' }; // Full red
      case 'planning':
        return { backgroundColor: lookAndFeel?.secondaryColor || '#3B82F6' }; // Use secondaryColor
      case 'production':
        return { backgroundColor: lookAndFeel?.secondaryColor2 || '#F59E0B' }; // Use secondaryColor2
      case 'review':
        return { backgroundColor: lookAndFeel?.secondaryColor3 || '#8B5CF6' }; // Use secondaryColor3
      default:
        return { backgroundColor: lookAndFeel?.secondaryColor || '#3B82F6' };
    }
  };

  const getBucketContentStyle = () => {
    return { backgroundColor: 'var(--main-ui-color)' };
  };

  const filteredTasks = tasks.filter(task => {
    // Filter by workflow type first
    if (workflowTypeFilter !== 'all') {
      const taskType = task.workflowType || 'general';
      if (taskType !== workflowTypeFilter) return false;
    }

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

  // Workflow view - group messages by status
  const WORKFLOW_STATUSES = [
    { id: 'INCOMING', name: 'Incoming', description: 'New requests' },
    { id: 'NAMING', name: 'Naming', description: 'Naming phase' },
    { id: 'CONTENT', name: 'Content', description: 'Content development' },
    { id: 'PREVIEW', name: 'Preview', description: 'Ready for review' },
    { id: 'APPROVED', name: 'Approved', description: 'Approved by stakeholders' },
    { id: 'ACTIVE', name: 'Active', description: 'Live in ad servers' },
    { id: 'INACTIVE', name: 'Inactive', description: 'Paused' },
    { id: 'ERROR', name: 'Error', description: 'Has issues' }
  ];

  const LEGACY_STATUS_MAP = {
    'PLANNED': 'NAMING',
    'INPROGRESS': 'CONTENT'
  };

  const messages = matrixData?.messages || [];
  const audiences = matrixData?.audiences || [];
  const topics = matrixData?.topics || [];
  const updateMessage = matrixData?.updateMessage || (() => {});
  const statusColors = lookAndFeel?.statusColors || {};

  const normalizeStatus = (status) => {
    const normalized = (status || 'INCOMING').toUpperCase();
    return LEGACY_STATUS_MAP[normalized] || normalized;
  };

  const getAudienceName = (audienceKey) => {
    const audience = audiences.find(a => a.key === audienceKey);
    return audience?.name || audienceKey || 'Unknown';
  };

  const getTopicName = (topicKey) => {
    const topic = topics.find(t => t.key === topicKey);
    return topic?.name || topicKey || 'Unknown';
  };

  const getStatusColor = (status) => {
    const normalized = normalizeStatus(status);
    return statusColors[normalized] || statusColors[status] || '#8B5CF6';
  };

  const getTextColor = (hexColor) => {
    if (!hexColor) return '#ffffff';
    const hex = hexColor.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5 ? '#1f2937' : '#ffffff';
  };

  const messagesByStatus = useMemo(() => {
    const grouped = {};
    WORKFLOW_STATUSES.forEach(s => {
      grouped[s.id] = [];
    });

    messages.forEach(msg => {
      const status = normalizeStatus(msg.status);
      if (grouped[status]) {
        grouped[status].push(msg);
      } else {
        grouped['INCOMING'].push(msg);
      }
    });

    return grouped;
  }, [messages]);

  // Workflow drag handlers
  const [draggedMessage, setDraggedMessage] = useState(null);

  const handleMessageDragStart = (msg) => {
    setDraggedMessage(msg);
  };

  const handleMessageDragOver = (e) => {
    e.preventDefault();
  };

  const handleMessageDrop = (newStatus) => {
    if (draggedMessage && normalizeStatus(draggedMessage.status) !== newStatus) {
      updateMessage(draggedMessage.id, { status: newStatus });
    }
    setDraggedMessage(null);
  };

  const handleMessageDragEnd = () => {
    setDraggedMessage(null);
  };

  // Create task in specific bucket
  const createTaskInBucket = (bucketId) => {
    const newTask = {
      id: `task-${Date.now()}`,
      title: '',
      description: '',
      priority: 'Medium',
      status: 'pending',
      bucket: bucketId,
      workflowType: 'general',
      labels: [],
      relatedContent: [],
      createdAt: new Date().toISOString()
    };
    setTasks(prev => [newTask, ...prev]);
    setEditingTask(newTask);
  };

  return (
    <div className="matrix-fullscreen" style={{ backgroundColor: 'var(--color-primary)' }}>
      {/* TaskToolbar */}
      <TaskToolbar
        filterText={filterText}
        setFilterText={setFilterText}
        workflowTypeFilter={workflowTypeFilter}
        setWorkflowTypeFilter={setWorkflowTypeFilter}
        filteredCount={filteredTasks.length}
        totalCount={tasks.length}
        viewMode={viewMode}
        setViewMode={setViewMode}
        onFetchEmails={handleFetchAndConvert}
        loading={loading}
      />

      {/* Content - Horizontal scroll only with nice scrollbar */}
      <div className="matrix-view-container custom-scrollbar" style={{ overflowX: 'auto', overflowY: 'hidden' }}>

      {/* Main Content */}
      <div className="h-full">
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

          {/* Kanban View */}
          {viewMode === 'kanban' && (
            <>
              {filteredTasks.length === 0 && tasks.length === 0 ? (
                <div className="text-center py-12">
                  <Mail className="mx-auto mb-4 text-gray-400" size={48} />
                  <h3 className="text-lg font-semibold text-gray-700 mb-2">No tasks yet</h3>
                  <p className="text-gray-500 mb-4">
                    Use the toolbar to fetch emails or add tasks to buckets below
                  </p>
                </div>
              ) : filteredTasks.length === 0 ? (
                <div className="text-center py-12">
                  <AlertCircle className="mx-auto mb-4 text-gray-400" size={48} />
                  <h3 className="text-lg font-semibold text-gray-700 mb-2">No tasks match your filter</h3>
                  <p className="text-gray-500">Try adjusting your search terms</p>
                </div>
              ) : null}

              {/* Kanban Board - inline-flex with min-w-max ensures content determines width */}
              <div className="inline-flex gap-4 py-12 px-12" style={{ minWidth: 'max-content' }}>
                {buckets.map(bucket => {
                  const bucketTasks = filteredTasks.filter(task =>
                    (task.bucket || 'backlog') === bucket.id
                  );

                  return (
                    <div key={bucket.id} className="flex-shrink-0 w-80 rounded-lg flex flex-col group/bucket self-start" style={{ boxShadow: 'var(--ui-shadow)', maxHeight: 'calc(100vh - 6rem)' }}>
                      {/* Bucket Header */}
                      <div
                        className="rounded-t-lg p-3"
                        style={getBucketHeaderStyle(bucket.id)}
                      >
                        <h3 className="font-bold text-white text-sm uppercase tracking-wide text-right">
                          {bucket.name}
                        </h3>
                        <p className="text-xs text-white/90 text-right mt-1">{bucket.description}</p>
                        <div className="flex items-center justify-end gap-2 mt-1">
                          <span className="text-xs text-white/80">
                            {bucketTasks.length} {bucketTasks.length === 1 ? 'task' : 'tasks'}
                          </span>
                          <button
                            onClick={() => createTaskInBucket(bucket.id)}
                            className="p-1 rounded-md text-white/50 hover:text-white hover:bg-white/20 transition-all opacity-0 group-hover/bucket:opacity-100"
                            title="Add new task"
                          >
                            <Plus size={16} />
                          </button>
                        </div>
                      </div>

                      {/* Bucket Content */}
                      <div
                        className="rounded-b-lg p-3 overflow-y-auto flex-1 custom-scrollbar"
                        style={getBucketContentStyle()}
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
                              getLabelColor={getLabelColor}
                              formatDate={formatDate}
                            />
                          ))}
                          {bucketTasks.length === 0 && (
                            <div className="text-center py-8 text-sm border-2 border-dashed rounded-lg" style={{ color: 'var(--white-50)', borderColor: 'var(--white-20)' }}>
                              Drop tasks here
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* Workflow Flowchart View */}
          {viewMode === 'workflow' && (
            <>
              {messages.length === 0 ? (
                <div className="text-center py-12">
                  <AlertCircle className="mx-auto mb-4 text-gray-400" size={48} />
                  <h3 className="text-lg font-semibold text-gray-700 mb-2">No messages yet</h3>
                  <p className="text-gray-500">
                    Create messages in the Matrix view to see them here
                  </p>
                </div>
              ) : (
                <div className="flex gap-4 overflow-x-auto pb-4">
                  {WORKFLOW_STATUSES.map(statusDef => {
                    const statusMessages = messagesByStatus[statusDef.id] || [];
                    const statusColor = getStatusColor(statusDef.id);
                    const textColor = getTextColor(statusColor);

                    return (
                      <div key={statusDef.id} className="flex-shrink-0 w-72 shadow-sm rounded-lg">
                        {/* Column Header */}
                        <div
                          className="rounded-t-lg p-3"
                          style={{ backgroundColor: statusColor }}
                        >
                          <h3
                            className="font-bold text-sm uppercase tracking-wide"
                            style={{ color: textColor }}
                          >
                            {statusDef.name}
                          </h3>
                          <p
                            className="text-xs mt-1"
                            style={{ color: textColor, opacity: 0.8 }}
                          >
                            {statusDef.description}
                          </p>
                          <div
                            className="text-xs mt-2"
                            style={{ color: textColor, opacity: 0.7 }}
                          >
                            {statusMessages.length} {statusMessages.length === 1 ? 'message' : 'messages'}
                          </div>
                        </div>

                        {/* Column Content */}
                        <div
                          className="bg-white rounded-b-lg p-3 min-h-[200px] max-h-[calc(100vh-350px)] overflow-y-auto"
                          onDragOver={handleMessageDragOver}
                          onDrop={() => handleMessageDrop(statusDef.id)}
                        >
                          <div className="space-y-2">
                            {statusMessages.map(msg => (
                              <WorkflowMessageCard
                                key={msg.id}
                                message={msg}
                                audienceName={getAudienceName(msg.audience)}
                                topicName={getTopicName(msg.topic)}
                                onDragStart={() => handleMessageDragStart(msg)}
                                onDragEnd={handleMessageDragEnd}
                                isDragging={draggedMessage?.id === msg.id}
                              />
                            ))}
                            {statusMessages.length === 0 && (
                              <div className="text-center py-8 text-gray-400 text-sm border-2 border-dashed border-gray-200 rounded-lg">
                                Drop here
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
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
        matrixData={matrixData}
      />

      {/* Bottom Bar */}
      <div className="bottom-bar">
        <AIAssistant
          ref={claudeChatRef}
          taskContext={{
            tasks,
            emails
          }}
        />
      </div>
    </div>
  );
};

// Workflow Message Card Component
const WorkflowMessageCard = ({
  message,
  audienceName,
  topicName,
  onDragStart,
  onDragEnd,
  isDragging
}) => {
  const displayName = message.name || message.pmmid || `MC${message.number}${message.variant || ''}`;
  const thumbnail = message.image1;

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={`bg-white rounded-lg p-3 shadow-sm hover:shadow-md transition-all border border-gray-200 cursor-move ${
        isDragging ? 'opacity-50 scale-95' : ''
      }`}
    >
      <div className="flex gap-2">
        {thumbnail && (
          <div className="flex-shrink-0 w-12 h-12 rounded overflow-hidden bg-gray-100">
            <img
              src={thumbnail}
              alt=""
              className="w-full h-full object-cover"
              onError={(e) => { e.target.style.display = 'none'; }}
            />
          </div>
        )}

        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-gray-900 truncate">
            {displayName}
          </h4>
          <p className="text-xs text-gray-500 truncate mt-1">
            {audienceName}
          </p>
          <p className="text-xs text-gray-400 truncate">
            {topicName}
          </p>
        </div>

        <div className="flex-shrink-0 text-gray-300">
          <GripVertical size={16} />
        </div>
      </div>
    </div>
  );
};

const TaskCard = ({ task, onToggleStatus, onEdit, getPriorityColor, getLabelColor, formatDate }) => {
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
              {task.title || <span className="text-gray-400 italic">Untitled task</span>}
            </h3>
            <div className="flex items-center gap-2 flex-shrink-0">
              {/* Edit button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(task);
                }}
                className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                title="Edit task"
              >
                <Edit2 size={14} />
              </button>
              {task.priority && (
                <span
                  className={`px-2 py-1 text-xs font-medium rounded border flex-shrink-0 ${getPriorityColor(
                    task.priority
                  )}`}
                >
                  {task.priority}
                </span>
              )}
              {task.labels && task.labels.length > 0 && (
                <div className="flex gap-1 overflow-hidden flex-1 min-w-0">
                  {task.labels.map((label) => (
                    <span
                      key={label}
                      className={`px-2 py-1 text-xs font-medium rounded flex-shrink-0 whitespace-nowrap ${getLabelColor(label)}`}
                    >
                      {label}
                    </span>
                  ))}
                </div>
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

const KanbanTaskCard = ({ task, onDragStart, onDragEnd, onToggleStatus, onEdit, getPriorityColor, getLabelColor, formatDate }) => {
  const isCompleted = task.status === 'completed';

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDoubleClick={() => onEdit(task)}
      className="rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow relative group cursor-move"
      style={{ backgroundColor: 'var(--white-10)', border: '1px solid var(--white-15)' }}
    >
      {/* Card Header - Checkbox, Priority, Edit */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleStatus(task.id);
          }}
          className="flex-shrink-0"
        >
          {isCompleted ? (
            <CheckCircle className="text-green-400" size={16} />
          ) : (
            <Circle size={16} style={{ color: 'var(--white-40)' }} />
          )}
        </button>

        <div className="flex items-center gap-1 flex-shrink-0">
          {/* Edit button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit(task);
            }}
            className="p-1 rounded transition-colors opacity-0 group-hover:opacity-100"
            style={{ color: 'var(--white-50)' }}
            title="Edit task"
          >
            <Edit2 size={12} />
          </button>
          {task.priority && (
            <span
              className={`px-1.5 py-0.5 text-xs font-medium rounded flex-shrink-0 ${getPriorityColor(
                task.priority
              )}`}
            >
              {task.priority}
            </span>
          )}
        </div>
      </div>

      {/* Labels - Wrap to multiple lines, aligned right */}
      {task.labels && task.labels.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2 justify-end">
          {task.labels.map((label) => (
            <span
              key={label}
              className={`px-1.5 py-0.5 text-xs font-medium rounded ${getLabelColor(label)}`}
            >
              {label}
            </span>
          ))}
        </div>
      )}

      {/* Title */}
      <h4 className={`text-sm font-semibold mb-2 ${isCompleted ? 'line-through' : ''}`} style={{ color: 'var(--color-white)' }}>
        {task.title || <span style={{ color: 'var(--white-50)', fontStyle: 'italic' }}>Untitled</span>}
      </h4>

      {/* Description */}
      {task.description && (
        <p className={`text-xs mb-2 line-clamp-2 ${isCompleted ? 'line-through' : ''}`} style={{ color: 'var(--white-70)' }}>
          {task.description}
        </p>
      )}

      {/* Footer */}
      <div className="space-y-1">
        {task.from && (
          <div className="flex items-center gap-1 text-xs" style={{ color: 'var(--white-50)' }}>
            <Mail size={10} />
            <span className="truncate">{task.from}</span>
          </div>
        )}
        {task.dueDate && (
          <div className="flex items-center gap-1 text-xs" style={{ color: 'var(--white-50)' }}>
            <Clock size={10} />
            <span>{formatDate(task.dueDate)}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default Tasks;
