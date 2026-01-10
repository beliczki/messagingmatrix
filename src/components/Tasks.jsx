import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { RefreshCw, CheckCircle, Circle, Clock, Trash2, Mail, AlertCircle, Filter, List, LayoutGrid, Tag, Palette, Plus, Edit2 } from 'lucide-react';
import { apiGet, apiPost } from '../utils/api';
import AIAssistant from './AIAssistant';
import TaskEditorDialog from './TaskEditorDialog';
import TaskToolbar from './TaskToolbar';
import MatrixStatePanel from './MatrixStatePanel';
import { clearAndReloadApp } from '../utils/clearAndReload';

const Tasks = ({ onMenuToggle, currentModuleName, lookAndFeel, matrixData }) => {
  const claudeChatRef = useRef(null);
  const [tasks, setTasks] = useState([]);
  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState(null); // { type: 'error' | 'success', text: string }
  const [filterText, setFilterText] = useState('');
  const [processedEmailUids, setProcessedEmailUids] = useState([]);
  const [draggedTask, setDraggedTask] = useState(null);
  const [editingTask, setEditingTask] = useState(null);
  const [labelFilter, setLabelFilter] = useState([]);

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
      // Filter out tasks with temp IDs - they're still being created on server
      const tasksToSave = tasks.filter(t => !String(t.id).startsWith('temp-'));
      if (tasksToSave.length > 0) {
        await apiPost('/api/tasks', { tasks: tasksToSave });
      }
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
    setFeedbackMessage(null);

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
        setFeedbackMessage({ type: 'info', text: 'No new emails to process' });
        setLoading(false);
        return;
      }

      // Use AI Assistant to process emails (this will open the assistant panel)
      if (claudeChatRef.current && claudeChatRef.current.processEmailsToTasks) {
        setFeedbackMessage({ type: 'success', text: `Processing ${newEmails.length} email(s)...` });
        claudeChatRef.current.processEmailsToTasks(newEmails, (newTasks) => {
          // Callback to add tasks when user clicks "Create Tasks" button
          setTasks(prev => [...newTasks, ...prev]);

          // Mark these emails as processed
          const emailUidsToMark = newEmails.map(e => e.uid);
          markEmailsAsProcessed(emailUidsToMark);

          setFeedbackMessage({ type: 'success', text: `Created ${newTasks.length} task(s)` });
        });
      } else {
        throw new Error('AI Assistant not available or not configured');
      }

    } catch (err) {
      setFeedbackMessage({ type: 'error', text: err.message });
      console.error('Error fetching/converting emails:', err);
    } finally {
      setLoading(false);
    }
  };

  // Note: status field removed in v2 schema - bucket determines task state

  // Helper: Sync linked MC statuses when task bucket changes
  // IMPORTANT: Tasks drive MC status - when task moves between buckets, update all linked MCs
  const syncMcStatuses = (task, oldBucket, newBucket) => {
    if (!task?.outputContent?.length || oldBucket === newBucket) return;

    console.log(`[Tasks] Bucket changed from ${oldBucket} to ${newBucket}, syncing ${task.outputContent.length} MCs`);
    console.log(`[Tasks] matrixData available:`, !!matrixData, 'messages:', matrixData?.messages?.length, 'updateMessage:', !!matrixData?.updateMessage);

    task.outputContent.forEach(mcLabel => {
      // Parse MC label: "MC282a" -> number=282, variant=a
      const match = mcLabel.match(/^MC(\d+)([a-z]?)$/i);
      console.log(`[Tasks] Parsing "${mcLabel}" -> match:`, match);

      if (match && matrixData?.messages && matrixData?.updateMessage) {
        const mcNumber = match[1];
        const mcVariant = (match[2] || 'a').toLowerCase();

        // Find matching message(s) by number and variant
        const matchingMessages = matrixData.messages.filter(m =>
          String(m.number) === mcNumber &&
          (m.variant || 'a').toLowerCase() === mcVariant
        );

        console.log(`[Tasks] Looking for MC${mcNumber}${mcVariant}, found ${matchingMessages.length} matches`);

        // Update status for each matching message
        matchingMessages.forEach(msg => {
          console.log(`[Tasks] Syncing MC${mcNumber}${mcVariant} (id=${msg.id}) status to ${newBucket}`);
          matrixData.updateMessage(msg.id, { status: newBucket });
        });
      }
    });
  };

  const moveTaskToBucket = (taskId, newBucket) => {
    // Find the task to sync MC statuses
    const task = tasks.find(t => t.id === taskId);
    if (task && task.bucket !== newBucket) {
      syncMcStatuses(task, task.bucket, newBucket);
    }

    setTasks(prev =>
      prev.map(t =>
        t.id === taskId
          ? { ...t, bucket: newBucket }
          : t
      )
    );
  };

  const deleteTask = (taskId) => {
    setTasks(prev => prev.filter(task => task.id !== taskId));
  };

  const updateTask = (updatedTask) => {
    // Find the old task to detect bucket changes
    const oldTask = tasks.find(t => t.id === updatedTask.id);

    // Sync MC statuses if bucket changed
    if (oldTask && oldTask.bucket !== updatedTask.bucket) {
      syncMcStatuses(updatedTask, oldTask.bucket, updatedTask.bucket);
    }

    setTasks(prev => prev.map(t => t.id === updatedTask.id ? updatedTask : t));
  };

  // Bucket names from keywords spreadsheet, fallback to defaults
  const buckets = matrixData?.keywords?.tasks?.bucket || [
    'INCOMING', 'NAMING', 'CONTENT', 'PREVIEW', 'APPROVED', 'DELIVERED', 'DEAD'
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

  const getBucketHeaderStyle = (bucketName) => {
    // Use status colors from Settings (lookAndFeel.statusColors)
    // Bucket names match status color keys (e.g., INCOMING, NAMING, CONTENT)
    const defaultColors = {
      INCOMING: '#8B5CF6',
      NAMING: '#EAB308',
      CONTENT: '#F97316',
      PREVIEW: '#3B82F6',
      APPROVED: '#22C55E',
      ACTIVE: '#15803D',
      INACTIVE: '#9CA3AF',
      ERROR: '#EF4444',
      DEAD: '#64748B',
      MEMORY: '#06B6D4'
    };
    const statusColors = lookAndFeel?.statusColors || {};
    const color = statusColors[bucketName] || defaultColors[bucketName] || '#808080';
    return { backgroundColor: color };
  };

  const getBucketContentStyle = () => {
    return { backgroundColor: 'var(--main-ui-color)' };
  };

  // Get available labels from tasks
  const availableLabels = useMemo(() => {
    const labels = new Set();
    tasks.forEach(task => {
      // Use product as label (labels field removed in v2 schema)
      if (task.product) {
        labels.add(task.product);
      }
    });
    return Array.from(labels).sort();
  }, [tasks]);

  const filteredTasks = tasks.filter(task => {
    // Apply product filter (replaces old label filter)
    if (labelFilter.length > 0) {
      const taskProduct = task.product || '';
      const hasMatchingProduct = labelFilter.includes(taskProduct);
      if (!hasMatchingProduct) return false;
    }

    if (!filterText.trim()) return true;

    // Include all searchable fields: TC number, product, related content, email info, keywords
    // Note: relatedContent is now array of strings like ["MC282a", "MC283b"]
    const relatedMcNames = (task.relatedContent || []).join(' ');
    const outputMcNames = (task.outputContent || []).join(' ');
    const keywordsText = Array.isArray(task.keywords) ? task.keywords.join(' ') : '';
    const tcNumber = task.id ? `TC${task.id}` : '';

    const searchableText = [
      task.title,
      task.description,
      task.priority,
      task.from,
      task.source,
      task.product,
      task.emailSubject,
      task.context,
      keywordsText,
      tcNumber,
      relatedMcNames,
      outputMcNames
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

  // Create task in specific bucket - uses /api/task to get auto-increment ID
  const createTaskInBucket = async (bucketName) => {
    const tempId = `temp-${Date.now()}`;
    const newTask = {
      id: tempId,
      title: 'New Task',  // Server requires title
      description: '',
      priority: 'Medium',
      bucket: bucketName,
      relatedContent: [],
      outputContent: [],
      createdAt: new Date().toISOString()
    };

    // Add to local state immediately for responsive UI
    setTasks(prev => [newTask, ...prev]);

    try {
      // Create on server to get real auto-increment ID
      const response = await apiPost('/api/tasks/create', newTask);
      if (response.ok) {
        const data = await response.json();
        const realId = data.task.id;

        // Replace temp ID with real ID in state
        setTasks(prev => prev.map(t =>
          t.id === tempId ? { ...t, id: realId } : t
        ));

        // Open editor with real ID
        setEditingTask({ ...newTask, id: realId });
      } else {
        // Remove failed task
        setTasks(prev => prev.filter(t => t.id !== tempId));
        console.error('Failed to create task on server');
      }
    } catch (err) {
      console.error('Error creating task:', err);
      setTasks(prev => prev.filter(t => t.id !== tempId));
    }
  };

  return (
    <div className="matrix-fullscreen" style={{ backgroundColor: 'var(--color-primary)' }}>
      {/* TaskToolbar */}
      <TaskToolbar
        filterText={filterText}
        setFilterText={setFilterText}
        labelFilter={labelFilter}
        setLabelFilter={setLabelFilter}
        availableLabels={availableLabels}
        filteredCount={filteredTasks.length}
        totalCount={tasks.length}
        onFetchEmails={handleFetchAndConvert}
        loading={loading}
        feedbackMessage={feedbackMessage}
        clearFeedback={() => setFeedbackMessage(null)}
      />

      {/* Content - Horizontal scroll only with nice scrollbar */}
      <div className="matrix-view-container custom-scrollbar" style={{ overflowX: 'auto', overflowY: 'hidden' }}>

      {/* Main Content */}
      <div className="h-full">
          {/* Kanban View */}
          <>
            {filteredTasks.length === 0 && tasks.length === 0 && (
                <div className="text-center py-12">
                  <Mail className="mx-auto mb-4 text-gray-400" size={48} />
                  <h3 className="text-lg font-semibold text-gray-700 mb-2">No tasks yet</h3>
                  <p className="text-gray-500 mb-4">
                    Use the toolbar to fetch emails or add tasks to buckets below
                  </p>
                </div>
              )}

              {/* Kanban Board - inline-flex with min-w-max ensures content determines width */}
              <div className="inline-flex gap-4 py-12 px-12" style={{ minWidth: 'max-content' }}>
                {buckets.map(bucket => {
                  const bucketTasks = filteredTasks.filter(task =>
                    (task.bucket || 'INCOMING') === bucket
                  );

                  return (
                    <div key={bucket} className="flex-shrink-0 w-80 rounded-lg flex flex-col group/bucket self-start" style={{ boxShadow: 'var(--ui-shadow)', maxHeight: 'calc(100vh - 6rem)' }}>
                      {/* Bucket Header */}
                      <div
                        className="rounded-t-lg p-3"
                        style={getBucketHeaderStyle(bucket)}
                      >
                        <h3 className="font-bold text-white text-sm uppercase tracking-wide text-right">
                          {bucket}
                        </h3>
                        <div className="flex items-center justify-end gap-2 mt-1">
                          <span className="text-xs text-white/80">
                            {bucketTasks.length} {bucketTasks.length === 1 ? 'task' : 'tasks'}
                          </span>
                          <button
                            onClick={() => createTaskInBucket(bucket)}
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
                        onDrop={() => handleDrop(bucket)}
                      >
                        <div className="space-y-3">
                          {bucketTasks.map(task => (
                            <KanbanTaskCard
                              key={task.id}
                              task={task}
                              onDragStart={() => handleDragStart(task)}
                              onDragEnd={handleDragEnd}
                              onEdit={setEditingTask}
                              getPriorityColor={getPriorityColor}
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
        lookAndFeel={lookAndFeel}
        tasks={tasks}
      />

      {/* Bottom Bar - Rendered via portal */}
      {createPortal(
        <div className="bottom-bar">
          <MatrixStatePanel
            audiences={matrixData?.audiences || []}
            topics={matrixData?.topics || []}
            messages={matrixData?.messages || []}
            keywords={matrixData?.keywords || {}}
            assets={matrixData?.assets || []}
            creatives={matrixData?.creatives || []}
            textFormatting={matrixData?.textFormatting || []}
            feedData={[]}
            tasks={tasks}
            lastSync={null}
            isSaving={false}
            onClearReload={clearAndReloadApp}
            changeTracking={matrixData?.changeTracking}
            originalState={matrixData?.originalState}
            // Tasks saves to SQLite, not spreadsheet
            activeTabs={['tasks']}
            isFullyLoaded={matrixData?.isFullyLoaded}
          />
          <AIAssistant
            ref={claudeChatRef}
            taskContext={{
              tasks,
              emails
            }}
          />
        </div>,
        document.body
      )}
    </div>
  );
};

const TaskCard = ({ task, onEdit, getPriorityColor, getLabelColor, formatDate }) => {
  // Note: status field removed in v2 schema - bucket determines task state
  const isInDead = task.bucket === 'DEAD';

  return (
    <div
      onDoubleClick={() => onEdit(task)}
      className={`bg-white border rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer ${
        isInDead ? 'opacity-60' : ''
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Task Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-2">
            <h3 className={`font-semibold text-gray-900 ${isInDead ? 'line-through' : ''}`}>
              {task.id && <span style={{ color: '#6366f1', marginRight: '6px' }}>TC{task.id}</span>}
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
              {task.product && (
                <span className="px-2 py-1 text-xs font-medium rounded bg-purple-100 text-purple-800 flex-shrink-0 whitespace-nowrap">
                  {task.product}
                </span>
              )}
            </div>
          </div>

          {task.description && (
            <p className={`text-sm text-gray-600 mb-2 ${isInDead ? 'line-through' : ''}`}>
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

const KanbanTaskCard = ({ task, onDragStart, onDragEnd, onEdit, getPriorityColor, formatDate }) => {
  // Note: status field removed in v2 schema - bucket determines task state
  const isInDead = task.bucket === 'DEAD';
  // Show checkmark for "done" buckets
  const isDone = ['APPROVED', 'ACTIVE', 'INACTIVE', 'DEAD', 'MEMORY'].includes(task.bucket);

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDoubleClick={() => onEdit(task)}
      className="rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow relative group cursor-move"
      style={{ backgroundColor: 'var(--white-10)', border: '1px solid var(--white-15)' }}
    >
      {/* Card Header - Task ID on left, Tags aligned right */}
      <div className="flex items-center gap-1 mb-2">
        {/* Left group - Checkmark and TC number */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {isDone ? (
            <CheckCircle size={14} style={{ color: '#22C55E', flexShrink: 0 }} />
          ) : (
            <Circle size={14} style={{ color: 'var(--white-30)', flexShrink: 0 }} />
          )}
          {task.id && (
            <span
              onClick={(e) => {
                e.stopPropagation();
                onEdit(task);
              }}
              className="hover:underline"
              style={{ color: 'white', fontSize: '12px', fontFamily: 'monospace', fontWeight: 600, cursor: 'pointer' }}
              title="Edit task"
            >
              TC{task.id}
            </span>
          )}
        </div>
        {/* Right group - all tags aligned right with wrap */}
        <div className="flex flex-wrap items-center gap-1 justify-end flex-1">
          {task.priority && (
            <span className={`px-1.5 py-0.5 text-xs font-medium rounded whitespace-nowrap ${getPriorityColor(task.priority)}`}>
              {task.priority}
            </span>
          )}
          {task.product && (
            <span className="px-1.5 py-0.5 text-xs font-medium rounded whitespace-nowrap" style={{ backgroundColor: '#3b82f6', color: 'white' }}>
              {task.product}
            </span>
          )}
        </div>
      </div>

      {/* Title */}
      <h4 className={`text-sm font-semibold mb-2 ${isInDead ? 'line-through' : ''}`} style={{ color: 'var(--color-white)' }}>
        {task.title || <span style={{ color: 'var(--white-50)', fontStyle: 'italic' }}>Untitled</span>}
      </h4>

      {/* Description */}
      {task.description && (
        <p className={`text-xs mb-2 line-clamp-2 ${isInDead ? 'line-through' : ''}`} style={{ color: 'var(--white-70)' }}>
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
