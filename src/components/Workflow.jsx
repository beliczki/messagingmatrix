/**
 * FLAGGED: Potential dead end - 2024-12-30
 * This Kanban view of messages by status may not be the right approach.
 * Consider: task-to-MC workflow instead of message status workflow.
 * Keep for reference but may be deprecated.
 */
import React, { useState, useMemo } from 'react';
import { AlertCircle, GripVertical } from 'lucide-react';

// Workflow status columns in order
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

// Legacy status mapping
const LEGACY_STATUS_MAP = {
  'PLANNED': 'NAMING',
  'INPROGRESS': 'CONTENT'
};

const Workflow = ({
  onMenuToggle,
  currentModuleName,
  lookAndFeel,
  matrixData
}) => {
  const [draggedMessage, setDraggedMessage] = useState(null);

  // Extract data from matrixData
  const messages = matrixData?.messages || [];
  const audiences = matrixData?.audiences || [];
  const topics = matrixData?.topics || [];
  const updateMessage = matrixData?.updateMessage || (() => {});
  const statusColors = lookAndFeel?.statusColors || {};

  // Normalize status (handle legacy values)
  const normalizeStatus = (status) => {
    const normalized = (status || 'INCOMING').toUpperCase();
    return LEGACY_STATUS_MAP[normalized] || normalized;
  };

  // Get audience name by key
  const getAudienceName = (audienceKey) => {
    const audience = audiences.find(a => a.key === audienceKey);
    return audience?.name || audienceKey || 'Unknown';
  };

  // Get topic name by key
  const getTopicName = (topicKey) => {
    const topic = topics.find(t => t.key === topicKey);
    return topic?.name || topicKey || 'Unknown';
  };

  // Get status color from config
  const getStatusColor = (status) => {
    const normalized = normalizeStatus(status);
    return statusColors[normalized] || statusColors[status] || '#8B5CF6';
  };

  // Calculate text color based on background
  const getTextColor = (hexColor) => {
    if (!hexColor) return '#ffffff';
    const hex = hexColor.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5 ? '#1f2937' : '#ffffff';
  };

  // Group messages by status
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
        // Unknown status - put in INCOMING
        grouped['INCOMING'].push(msg);
      }
    });

    return grouped;
  }, [messages]);

  // Drag handlers
  const handleDragStart = (msg) => {
    setDraggedMessage(msg);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (newStatus) => {
    if (draggedMessage && normalizeStatus(draggedMessage.status) !== newStatus) {
      // Update message status
      updateMessage(draggedMessage.id, { status: newStatus });
    }
    setDraggedMessage(null);
  };

  const handleDragEnd = () => {
    setDraggedMessage(null);
  };

  return (
    <div className="matrix-fullscreen" style={{ backgroundColor: 'var(--color-primary)' }}>
      <div className="matrix-view-container">
        {/* Main Content */}
        <div className="flex-1 overflow-auto p-6">
          <div className="mx-auto">
            {/* Header */}
            <div className="mb-4 flex items-center justify-between">
              <h1 className="text-xl font-bold text-gray-800">Creative Workflow</h1>
              <div className="text-sm text-gray-500">
                {messages.length} total messages
              </div>
            </div>

            {/* Kanban Board */}
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
                        className="bg-white rounded-b-lg p-3 min-h-[200px] max-h-[calc(100vh-300px)] overflow-y-auto"
                        onDragOver={handleDragOver}
                        onDrop={() => handleDrop(statusDef.id)}
                      >
                        <div className="space-y-2">
                          {statusMessages.map(msg => (
                            <MessageCard
                              key={msg.id}
                              message={msg}
                              audienceName={getAudienceName(msg.audience)}
                              topicName={getTopicName(msg.topic)}
                              onDragStart={() => handleDragStart(msg)}
                              onDragEnd={handleDragEnd}
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
          </div>
        </div>
      </div>
    </div>
  );
};

// Message Card Component
const MessageCard = ({
  message,
  audienceName,
  topicName,
  onDragStart,
  onDragEnd,
  isDragging
}) => {
  // Display name: prefer name, then PMMID, then number+variant
  const displayName = message.name || message.pmmid || `MC${message.number}${message.variant || ''}`;

  // Get thumbnail if image1 exists
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
        {/* Thumbnail */}
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

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Name/PMMID */}
          <h4 className="text-sm font-semibold text-gray-900 truncate">
            {displayName}
          </h4>

          {/* Audience */}
          <p className="text-xs text-gray-500 truncate mt-1">
            {audienceName}
          </p>

          {/* Topic */}
          <p className="text-xs text-gray-400 truncate">
            {topicName}
          </p>
        </div>

        {/* Drag handle */}
        <div className="flex-shrink-0 text-gray-300">
          <GripVertical size={16} />
        </div>
      </div>
    </div>
  );
};

export default Workflow;
