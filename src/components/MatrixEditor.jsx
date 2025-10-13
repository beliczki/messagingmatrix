import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  RefreshCw, 
  ExternalLink, 
  AlertCircle, 
  CheckCircle,
  Settings,
  ChevronRight,
  ChevronDown,
  Save
} from 'lucide-react';
import { useMatrixData } from '../hooks/useMatrixData';
import MessageCard from './MessageCard';
import MessageEditor from './MessageEditor';
import MessageDetailOverlay from './MessageDetailOverlay';
import EditableHeader from './EditableHeader';
import ChangeLogPanel from './ChangeLogPanel';

const MatrixEditor = () => {
  const {
    isConnected,
    isLoading,
    error,
    lastSyncTime,
    isSaving,
    audiences,
    topics,
    messages,
    templates,
    changeLog,
    initialize,
    syncData,
    addAudience,
    addTopic,
    addMessage,
    updateMessage,
    moveMessage,
    copyMessage,
    removeMessage,
    updateAudienceName,
    updateTopicName,
    getMessagesForCell,
    clearError,
    saveChanges,
    getSpreadsheetUrl
  } = useMatrixData();

  // UI State
  const [showChangeLog, setShowChangeLog] = useState(false);
  const [editingMessage, setEditingMessage] = useState(null);
  const [viewingMessage, setViewingMessage] = useState(null);
  const [draggedMessage, setDraggedMessage] = useState(null);
  const [dragOverCell, setDragOverCell] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

  // Initialize on mount
  useEffect(() => {
    initialize();
  }, [initialize]);

  // Add new audience
  const handleAddAudience = () => {
    const name = prompt('Enter audience name:');
    if (name && name.trim()) {
      addAudience(name.trim());
    }
  };

  // Add new topic
  const handleAddTopic = () => {
    const name = prompt('Enter topic name:');
    if (name && name.trim()) {
      addTopic(name.trim());
    }
  };

  // Handle message drag start
  const handleDragStart = (e, message) => {
    setDraggedMessage(message);
    setIsDragging(true);
    e.dataTransfer.effectAllowed = e.ctrlKey ? 'copy' : 'move';
  };

  // Handle drag over cell
  const handleDragOver = (e, topicKey, audienceKey) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = e.ctrlKey ? 'copy' : 'move';
    setDragOverCell(`${topicKey}-${audienceKey}`);
  };

  // Handle drag leave
  const handleDragLeave = () => {
    setDragOverCell(null);
  };

  // Handle drop
  const handleDrop = (e, topicKey, audienceKey) => {
    e.preventDefault();
    
    if (!draggedMessage) return;
    
    const isCtrlPressed = e.ctrlKey;
    
    if (isCtrlPressed) {
      // Copy message
      copyMessage(draggedMessage.id, audienceKey);
    } else {
      // Move message
      if (draggedMessage.audience !== audienceKey) {
        moveMessage(draggedMessage.id, audienceKey);
      }
    }
    
    setDraggedMessage(null);
    setDragOverCell(null);
    setIsDragging(false);
  };

  // Handle drag end
  const handleDragEnd = () => {
    setDraggedMessage(null);
    setDragOverCell(null);
    setIsDragging(false);
  };

  // Format last sync time
  const formatLastSync = (time) => {
    if (!time) return 'Never';
    const now = new Date();
    const diffMs = now - time;
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins === 1) return '1 minute ago';
    if (diffMins < 60) return `${diffMins} minutes ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours === 1) return '1 hour ago';
    if (diffHours < 24) return `${diffHours} hours ago`;
    
    return time.toLocaleDateString();
  };

  if (error && !isConnected) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full">
          <div className="flex items-center gap-3 mb-4">
            <AlertCircle className="text-red-500" size={24} />
            <h2 className="text-xl font-semibold text-gray-800">Connection Error</h2>
          </div>
          <p className="text-gray-600 mb-6">{error}</p>
          <div className="flex gap-2">
            <button
              onClick={initialize}
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              <RefreshCw className={isLoading ? 'animate-spin' : ''} size={16} />
              Retry Connection
            </button>
            <button
              onClick={clearError}
              className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
            >
              Clear Error
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-full mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-bold text-gray-800">Interactive Matrix Editor</h1>
              <div className="flex items-center gap-2">
                {isConnected ? (
                  <CheckCircle className="text-green-500" size={20} />
                ) : (
                  <AlertCircle className="text-yellow-500" size={20} />
                )}
                <span className="text-sm text-gray-600">
                  {isConnected ? `Connected • Last sync: ${formatLastSync(lastSyncTime)}` : 'Connecting...'}
                </span>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {/* Service Account Status */}
              {isConnected ? (
                <div className="flex items-center gap-2 px-3 py-2 bg-green-100 text-green-700 rounded-lg">
                  <CheckCircle size={16} />
                  <span className="text-sm">Service Account Active</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 px-3 py-2 bg-yellow-100 text-yellow-700 rounded-lg">
                  <Settings size={16} />
                  <span className="text-sm">Configuring Service Account...</span>
                </div>
              )}

              {/* Change log toggle */}
              <button
                onClick={() => setShowChangeLog(!showChangeLog)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                  changeLog.length > 0 
                    ? 'bg-orange-100 text-orange-700 hover:bg-orange-200' 
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {showChangeLog ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                Changes ({changeLog.length})
              </button>

              {/* Sync button */}
              <button
                onClick={syncData}
                disabled={isLoading}
                className="flex items-center gap-2 px-3 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 disabled:opacity-50"
              >
                <RefreshCw className={isLoading ? 'animate-spin' : ''} size={16} />
                Sync
              </button>

              {/* Spreadsheet link */}
              <button
                onClick={() => window.open(getSpreadsheetUrl(), '_blank')}
                className="flex items-center gap-2 px-3 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200"
              >
                <ExternalLink size={16} />
                Open Sheet
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex">
        {/* Main Matrix */}
        <div className="flex-1 p-4">
          {isLoading && audiences.length === 0 ? (
            <div className="flex items-center justify-center h-64">
              <div className="flex items-center gap-2 text-gray-600">
                <RefreshCw className="animate-spin" size={20} />
                Loading matrix data...
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  {/* Header row with audiences */}
                  <thead>
                    <tr className="bg-blue-50">
                      <th className="border border-gray-300 p-4 bg-gray-100 min-w-48">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-gray-700">Topics / Audiences</span>
                        </div>
                      </th>
                      {audiences.map((audience) => (
                        <th key={audience.id} className="border border-gray-300 p-4 min-w-64">
                          <div className="text-center">
                            <div className="font-semibold text-blue-700 mb-1">
                              <EditableHeader
                                text={audience.name}
                                onSave={(newName) => updateAudienceName(audience.key, newName)}
                                placeholder="Audience name..."
                                className="justify-center"
                              />
                              {audience.isNew && <span className="text-xs text-orange-500 ml-1">(new)</span>}
                            </div>
                            <div className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded">
                              {audience.key}
                            </div>
                          </div>
                        </th>
                      ))}
                      <th className="border border-gray-300 p-4 w-16">
                        <button
                          onClick={handleAddAudience}
                          className="w-full h-full flex items-center justify-center text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors"
                          title="Add Audience"
                        >
                          <Plus size={20} />
                        </button>
                      </th>
                    </tr>
                  </thead>
                  
                  <tbody>
                    {topics.map((topic) => (
                      <tr key={topic.id} className="hover:bg-gray-50">
                        {/* Topic header cell */}
                        <td className="border border-gray-300 p-4 bg-green-50">
                          <div className="text-center">
                            <div className="font-semibold text-green-700 mb-1">
                              <EditableHeader
                                text={topic.name}
                                onSave={(newName) => updateTopicName(topic.key, newName)}
                                placeholder="Topic name..."
                                className="justify-center"
                              />
                              {topic.isNew && <span className="text-xs text-orange-500 ml-1">(new)</span>}
                            </div>
                            <div className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded">
                              {topic.key}
                            </div>
                          </div>
                        </td>
                        
                        {/* Message cells */}
                        {audiences.map((audience) => {
                          const cellKey = `${topic.key}-${audience.key}`;
                          const cellMessages = getMessagesForCell(topic.key, audience.key);
                          const isDragOver = dragOverCell === cellKey;
                          
                          return (
                            <td 
                              key={audience.id} 
                              className={`border border-gray-300 p-2 align-top transition-colors ${
                                isDragOver ? 'bg-blue-100 border-blue-400' : ''
                              }`}
                              onDragOver={(e) => handleDragOver(e, topic.key, audience.key)}
                              onDragLeave={handleDragLeave}
                              onDrop={(e) => handleDrop(e, topic.key, audience.key)}
                            >
                              <div className="min-h-24 space-y-2">
                                {cellMessages.map((message) => (
                                  <MessageCard
                                    key={message.id}
                                    message={message}
                                    onEdit={() => setViewingMessage(message)}
                                    onRemove={() => removeMessage(message.id)}
                                    onDragStart={handleDragStart}
                                    onDragEnd={handleDragEnd}
                                    isDragging={isDragging}
                                  />
                                ))}
                                <button
                                  onClick={() => addMessage(topic.key, audience.key)}
                                  className="w-full border-2 border-dashed border-gray-300 rounded p-2 text-gray-500 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-colors text-sm"
                                >
                                  + Add Message
                                </button>
                              </div>
                            </td>
                          );
                        })}
                        
                        {/* Empty cell for add column alignment */}
                        <td className="border border-gray-300 p-4"></td>
                      </tr>
                    ))}
                    
                    {/* Add topic row */}
                    <tr>
                      <td className="border border-gray-300 p-4">
                        <button
                          onClick={handleAddTopic}
                          className="w-full h-full flex items-center justify-center text-green-500 hover:text-green-700 hover:bg-green-50 rounded transition-colors"
                          title="Add Topic"
                        >
                          <Plus size={20} />
                        </button>
                      </td>
                      {audiences.map((audience) => (
                        <td key={audience.id} className="border border-gray-300 p-4"></td>
                      ))}
                      <td className="border border-gray-300 p-4"></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Change Log Panel */}
        {showChangeLog && (
          <div className="w-80 border-l bg-white">
            <ChangeLogPanel 
              changeLog={changeLog}
              isAuthenticated={true}
              currentUser={{ name: 'Service Account' }}
              isSaving={isSaving}
              onClose={() => setShowChangeLog(false)}
              onSaveChanges={saveChanges}
              onSignIn={() => {}} // No sign in needed
            />
          </div>
        )}
      </div>

      {/* Message Detail Overlay */}
      {viewingMessage && (
        <MessageDetailOverlay
          message={viewingMessage}
          templates={templates}
          isEditing={false}
          onSave={(updates) => {
            updateMessage(viewingMessage.id, updates);
            setViewingMessage(null);
          }}
          onClose={() => setViewingMessage(null)}
        />
      )}


    </div>
  );
};

export default MatrixEditor;
