import React, { useState } from 'react';
import { X, Plus, Edit3, Move, Copy, Trash2, Save, Clock, User, LogIn } from 'lucide-react';

const ChangeLogPanel = ({ 
  changeLog, 
  onClose, 
  isAuthenticated, 
  currentUser, 
  isSaving, 
  onSaveChanges, 
  onSignIn 
}) => {
  const [saveResult, setSaveResult] = useState(null);
  const getChangeIcon = (action) => {
    switch (action) {
      case 'create':
        return <Plus size={14} className="text-green-600" />;
      case 'update':
        return <Edit3 size={14} className="text-yellow-600" />;
      case 'move':
        return <Move size={14} className="text-blue-600" />;
      case 'copy':
        return <Copy size={14} className="text-purple-600" />;
      case 'delete':
        return <Trash2 size={14} className="text-red-600" />;
      default:
        return <Clock size={14} className="text-gray-600" />;
    }
  };

  const getChangeColor = (action) => {
    switch (action) {
      case 'create':
        return 'bg-green-50 border-green-200';
      case 'update':
        return 'bg-yellow-50 border-yellow-200';
      case 'move':
        return 'bg-blue-50 border-blue-200';
      case 'copy':
        return 'bg-purple-50 border-purple-200';
      case 'delete':
        return 'bg-red-50 border-red-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  const formatTime = (timestamp) => {
    const now = new Date();
    const diff = now - timestamp;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (seconds < 60) return `${seconds}s ago`;
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return timestamp.toLocaleDateString();
  };

  const getChangeDescription = (change) => {
    const { type, action, data } = change;
    
    switch (type) {
      case 'audience':
        if (action === 'create') {
          return `Added audience "${data.name}" (${data.key})`;
        }
        break;
      
      case 'topic':
        if (action === 'create') {
          return `Added topic "${data.name}" (${data.key})`;
        }
        break;
      
      case 'message':
        if (action === 'create') {
          return `Created message ${data.audience}!${data.topic}!m${data.number}!${data.variant}`;
        }
        if (action === 'update') {
          const fields = Object.keys(data.changes || {});
          return `Updated message fields: ${fields.join(', ')}`;
        }
        if (action === 'move') {
          return `Moved message from ${data.from} to ${data.to}`;
        }
        if (action === 'copy') {
          return `Copied message to ${data.newMessage.audience}`;
        }
        break;
      
      default:
        return `${action} ${type}`;
    }
    
    return `${action} ${type}`;
  };

  const unsyncedChanges = changeLog.filter(change => !change.synced);

  const handleSaveChanges = async () => {
    setSaveResult(null);
    
    if (!isAuthenticated) {
      onSignIn();
      return;
    }

    const result = await onSaveChanges();
    setSaveResult(result);
    
    // Clear result after 3 seconds
    setTimeout(() => setSaveResult(null), 3000);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-gray-50">
        <div>
          <h3 className="font-semibold text-gray-800">Change Log</h3>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-xs text-gray-600">
              {unsyncedChanges.length} pending changes
            </p>
            {isAuthenticated && currentUser && (
              <div className="flex items-center gap-1 text-xs text-green-600">
                <User size={12} />
                {currentUser.name}
              </div>
            )}
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X size={16} />
        </button>
      </div>

      {/* Changes list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {changeLog.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            <Clock size={24} className="mx-auto mb-2 text-gray-400" />
            <p>No changes yet</p>
            <p className="text-xs">Start editing to see changes here</p>
          </div>
        ) : (
          changeLog
            .slice()
            .reverse() // Show newest first
            .map((change) => (
              <div
                key={change.id}
                className={`p-3 rounded-lg border ${getChangeColor(change.action)} ${
                  !change.synced ? 'ring-1 ring-orange-200' : ''
                }`}
              >
                <div className="flex items-start gap-2">
                  {getChangeIcon(change.action)}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-gray-800">
                      {getChangeDescription(change)}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {formatTime(change.timestamp)}
                      {!change.synced && (
                        <span className="ml-2 px-1 py-0.5 bg-orange-100 text-orange-600 rounded text-xs">
                          pending
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
        )}
      </div>

      {/* Footer with save button */}
      {unsyncedChanges.length > 0 && (
        <div className="border-t p-4 bg-gray-50">
          {/* Save result display */}
          {saveResult && (
            <div className={`mb-3 p-2 rounded text-sm ${
              saveResult.success 
                ? 'bg-green-100 text-green-700 border border-green-200' 
                : 'bg-red-100 text-red-700 border border-red-200'
            }`}>
              {saveResult.success ? (
                <>✓ Successfully saved {saveResult.totalChanges} changes</>
              ) : (
                <>✗ Save failed: {saveResult.error}</>
              )}
            </div>
          )}

          <button
            onClick={handleSaveChanges}
            disabled={isSaving}
            className={`w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              isAuthenticated 
                ? 'bg-orange-600 text-white hover:bg-orange-700 disabled:bg-orange-400'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            } disabled:cursor-not-allowed`}
          >
            {isSaving ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Saving...
              </>
            ) : isAuthenticated ? (
              <>
                <Save size={16} />
                Save {unsyncedChanges.length} Changes to Spreadsheet
              </>
            ) : (
              <>
                <LogIn size={16} />
                Sign In to Save Changes
              </>
            )}
          </button>
          
          <p className="text-xs text-gray-600 mt-2 text-center">
            {isAuthenticated 
              ? 'Changes are tracked locally until saved'
              : 'Authentication required to save to Google Sheets'
            }
          </p>
        </div>
      )}
    </div>
  );
};

export default ChangeLogPanel;
