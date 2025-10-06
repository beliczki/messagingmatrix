import React, { useState } from 'react';
import { Plus, Save, RefreshCw, ExternalLink, AlertCircle, Edit2, X, Trash2, Eye, Settings } from 'lucide-react';
import { useMatrix } from '../hooks/useMatrix';
import settings from '../services/settings';

const Matrix = () => {
  const {
    audiences,
    topics,
    messages,
    isLoading,
    isSaving,
    error,
    lastSync,
    load,
    save,
    addAudience,
    addTopic,
    addMessage,
    updateMessage,
    deleteMessage,
    moveMessage,
    copyMessage,
    updateAudience,
    updateTopic,
    deleteAudience,
    deleteTopic,
    getMessages,
    getUrl,
    getSpreadsheetId
  } = useMatrix();

  const [editingCell, setEditingCell] = useState(null);
  const [editingHeader, setEditingHeader] = useState(null);
  const [draggedMsg, setDraggedMsg] = useState(null);
  const [editingMessage, setEditingMessage] = useState(null);
  const [editingAudience, setEditingAudience] = useState(null);
  const [editingTopic, setEditingTopic] = useState(null);
  const [showStateDialog, setShowStateDialog] = useState(false);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [filterText, setFilterText] = useState('');
  const [previewMessage, setPreviewMessage] = useState(null);
  const [previewSize, setPreviewSize] = useState('300x250');
  const [previewVariant, setPreviewVariant] = useState('a');
  const [editSpreadsheetId, setEditSpreadsheetId] = useState('');

  // Format last sync time
  const formatSync = (time) => {
    if (!time) return 'Never';
    const mins = Math.floor((Date.now() - time) / 60000);
    if (mins < 1) return 'Just now';
    if (mins === 1) return '1 min ago';
    if (mins < 60) return `${mins} mins ago`;
    return time.toLocaleTimeString();
  };

  // Filter logic: supports AND/OR keywords
  const matchesFilter = (text, filter) => {
    if (!filter.trim()) return true;

    const lowerText = text.toLowerCase();
    const lowerFilter = filter.toLowerCase();

    // Split by OR first (case insensitive)
    const orParts = lowerFilter.split(/\s+or\s+/i);

    return orParts.some(orPart => {
      // Split by AND (case insensitive)
      const andParts = orPart.split(/\s+and\s+/i);

      // All AND parts must match
      return andParts.every(part => lowerText.includes(part.trim()));
    });
  };

  // Filter audiences and topics
  const filteredAudiences = audiences.filter(aud =>
    matchesFilter(aud.name + ' ' + aud.key, filterText)
  );

  const filteredTopics = topics.filter(topic =>
    matchesFilter(topic.name + ' ' + topic.key, filterText)
  );

  // Handle add audience
  const handleAddAudience = () => {
    const maxId = Math.max(0, ...audiences.map(a => parseInt(a.id) || 0));
    const newId = maxId + 1;
    const maxOrder = Math.max(0, ...audiences.map(a => a.order));
    const newOrder = maxOrder + 1;

    setEditingAudience({
      id: newId,
      name: '',
      key: `aud${newOrder}`,
      order: newOrder,
      status: ''
    });
  };

  // Handle add topic
  const handleAddTopic = () => {
    const maxId = Math.max(0, ...topics.map(t => parseInt(t.id) || 0));
    const newId = maxId + 1;
    const maxOrder = Math.max(0, ...topics.map(t => t.order));
    const newOrder = maxOrder + 1;

    setEditingTopic({
      id: newId,
      name: '',
      key: `top${newOrder}`,
      order: newOrder,
      status: ''
    });
  };

  // Handle drag
  const onDragStart = (e, msg) => {
    setDraggedMsg(msg);
    e.dataTransfer.effectAllowed = e.ctrlKey ? 'copy' : 'move';
  };

  const onDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = e.ctrlKey ? 'copy' : 'move';
  };

  const onDrop = (e, topic, audience) => {
    e.preventDefault();
    if (!draggedMsg) return;

    if (e.ctrlKey) {
      // CTRL+drag = copy
      // Constraint: Can only copy within the same row (same topic)
      if (draggedMsg.topic !== topic) {
        alert('Cannot copy message to a different row (topic). Messages can only be copied across columns within the same topic.');
        setDraggedMsg(null);
        return;
      }

      // Copy message: keep same number, update audience key in name
      const newName = `${audience}!${draggedMsg.topic}!m${draggedMsg.number}${draggedMsg.variant}!v${draggedMsg.version}`;

      // Generate new numeric ID
      const maxId = Math.max(0, ...messages.map(m => parseInt(m.id) || 0));
      const newId = maxId + 1;

      const copiedMessage = {
        ...draggedMsg,
        id: newId,           // New numeric ID
        name: newName,       // Updated name with new audience
        audience: audience,  // Update audience key
      };

      // Use copyMessage hook function
      copyMessage(draggedMsg.id, audience);
    } else {
      // Regular drag = move
      moveMessage(draggedMsg.id, audience);
    }

    setDraggedMsg(null);
  };

  // Header edit
  const HeaderEdit = ({ type, item, onSave }) => {
    const [key, setKey] = useState(item.key);
    const [name, setName] = useState(item.name);

    const handleSave = () => {
      if (name.trim()) {
        onSave(item.key, name);
      }
      setEditingHeader(null);
    };

    return (
      <div className="space-y-2">
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={handleSave}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSave();
            if (e.key === 'Escape') setEditingHeader(null);
          }}
          placeholder="Name"
          className="w-full px-2 py-1 text-center border-2 border-blue-500 rounded font-semibold text-lg"
        />
        <input
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="Key"
          className="w-full px-2 py-1 text-xs text-center border-2 border-blue-500 rounded bg-blue-50"
        />
      </div>
    );
  };

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow p-6 max-w-md">
          <div className="flex items-center gap-2 mb-4">
            <AlertCircle className="text-red-500" size={24} />
            <h2 className="text-xl font-semibold">Error</h2>
          </div>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={load}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Messaging Matrix</h1>
            <p className="text-sm text-gray-500">Last sync: {formatSync(lastSync)}</p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const currentId = settings.getSpreadsheetId();
                setEditSpreadsheetId(currentId);
                setShowSettingsDialog(true);
              }}
              className="flex items-center gap-2 px-3 py-2 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
            >
              <Settings size={16} />
              Settings
            </button>

            <button
              onClick={() => {
                localStorage.clear();
                window.location.reload();
              }}
              className="flex items-center gap-2 px-3 py-2 bg-orange-100 text-orange-700 rounded hover:bg-orange-200"
            >
              <RefreshCw size={16} />
              Clear & Reload
            </button>

            <button
              onClick={() => setShowStateDialog(true)}
              className="flex items-center gap-2 px-3 py-2 bg-purple-100 text-purple-700 rounded hover:bg-purple-200"
            >
              <AlertCircle size={16} />
              State
            </button>

            <button
              onClick={save}
              disabled={isSaving}
              className="flex items-center gap-2 px-3 py-2 bg-green-100 text-green-700 rounded hover:bg-green-200 disabled:opacity-50"
            >
              <Save className={isSaving ? 'animate-spin' : ''} size={16} />
              Save
            </button>
          </div>
        </div>
      </div>

      {/* Matrix */}
      <div className="p-4">
        {isLoading && audiences.length === 0 ? (
          <div className="flex items-center justify-center h-64">
            <RefreshCw className="animate-spin text-gray-400" size={32} />
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-50">
                  <th className="border border-gray-300 p-2 bg-gray-100 min-w-[200px]">
                    <input
                      type="text"
                      value={filterText}
                      onChange={(e) => setFilterText(e.target.value)}
                      placeholder="Filter (use AND / OR)"
                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </th>
                  {filteredAudiences.map((aud) => (
                    <th key={aud.key} className="border border-gray-300 p-4 min-w-[250px]">
                      <div className="group relative">
                        <div className="font-semibold text-blue-700 text-lg mb-1">{aud.name}</div>
                        <div className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded inline-block">
                          {aud.key}
                        </div>
                        <button
                          onClick={() => setEditingAudience(aud)}
                          className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-blue-100 rounded"
                          title="Edit audience"
                        >
                          <Edit2 size={14} className="text-blue-600" />
                        </button>
                      </div>
                    </th>
                  ))}
                  <th className="border border-gray-300 p-2">
                    <button
                      onClick={handleAddAudience}
                      className="w-full h-full p-2 text-blue-500 hover:bg-blue-50 rounded"
                      title="Add Audience"
                    >
                      <Plus size={20} />
                    </button>
                  </th>
                </tr>
              </thead>

              <tbody>
                {filteredTopics.map((topic) => (
                  <tr key={topic.key}>
                    <td className="border border-gray-300 p-4 bg-green-50">
                      <div className="group relative">
                        <div className="font-semibold text-green-700 text-lg mb-1">{topic.name}</div>
                        <div className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded inline-block">
                          {topic.key}
                        </div>
                        <button
                          onClick={() => setEditingTopic(topic)}
                          className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-green-100 rounded"
                          title="Edit topic"
                        >
                          <Edit2 size={14} className="text-green-600" />
                        </button>
                      </div>
                    </td>

                    {filteredAudiences.map((aud) => {
                      const cellMsgs = getMessages(topic.key, aud.key);
                      const cellKey = `${topic.key}-${aud.key}`;

                      return (
                        <td
                          key={aud.key}
                          className="border border-gray-300 p-2 align-top"
                          onDragOver={onDragOver}
                          onDrop={(e) => onDrop(e, topic.key, aud.key)}
                        >
                          <div className="min-h-[100px] space-y-2">
                            {cellMsgs.map((msg) => {
                              // Determine status and color
                              const status = (msg.status || 'PLANNED').toUpperCase();
                              let statusColor = 'bg-yellow-100 border-yellow-300'; // PLANNED (default)
                              let statusText = 'PLANNED';

                              if (status === 'ACTIVE') {
                                statusColor = 'bg-green-100 border-green-300';
                                statusText = 'ACTIVE';
                              } else if (status === 'PAUSED') {
                                statusColor = 'bg-gray-200 border-gray-400';
                                statusText = 'PAUSED';
                              }

                              return (
                                <div
                                  key={msg.id}
                                  draggable
                                  onDragStart={(e) => onDragStart(e, msg)}
                                  onDragEnd={() => setDraggedMsg(null)}
                                  className={`${statusColor} border rounded p-2 cursor-move hover:shadow group`}
                                >
                                  <div className="flex items-start gap-2">
                                    <div className="flex-1">
                                      <div className="flex items-center gap-1 mb-1">
                                        <span className="font-bold text-blue-600">{msg.number || ''}</span>
                                        <span className="text-xs font-semibold text-gray-500">{msg.variant || ''}</span>
                                      </div>
                                      <p className="text-sm text-gray-700 whitespace-pre-wrap">
                                        {msg.headline || 'No headline'}
                                      </p>
                                    </div>
                                    <div className="flex gap-1">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setPreviewMessage(msg);
                                          setPreviewVariant(msg.variant);
                                        }}
                                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-purple-100 rounded"
                                        title="Preview message"
                                      >
                                        <Eye size={14} className="text-purple-600" />
                                      </button>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setEditingMessage(msg);
                                        }}
                                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-blue-100 rounded"
                                        title="Edit message"
                                      >
                                        <Edit2 size={14} className="text-blue-600" />
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}

                            <button
                              onClick={() => addMessage(topic.key, aud.key)}
                              className="w-full border-2 border-dashed border-gray-300 rounded p-2 text-sm text-gray-500 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50"
                            >
                              + Add Message
                            </button>
                          </div>
                        </td>
                      );
                    })}

                    <td className="border border-gray-300"></td>
                  </tr>
                ))}

                <tr>
                  <td className="border border-gray-300 p-2">
                    <button
                      onClick={handleAddTopic}
                      className="w-full h-full p-2 text-green-500 hover:bg-green-50 rounded"
                      title="Add Topic"
                    >
                      <Plus size={20} />
                    </button>
                  </td>
                  {filteredAudiences.map((aud) => (
                    <td key={aud.key} className="border border-gray-300"></td>
                  ))}
                  <td className="border border-gray-300"></td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Settings Dialog */}
      {showSettingsDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold">Settings</h2>
              <button
                onClick={() => setShowSettingsDialog(false)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Google Sheets Spreadsheet ID
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={editSpreadsheetId}
                    onChange={(e) => setEditSpreadsheetId(e.target.value)}
                    placeholder="Enter spreadsheet ID"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  {editSpreadsheetId && (
                    <button
                      onClick={() => window.open(`https://docs.google.com/spreadsheets/d/${editSpreadsheetId}/edit`, '_blank')}
                      className="p-2 hover:bg-gray-100 rounded"
                      title="Open in Google Sheets"
                    >
                      <ExternalLink size={20} className="text-green-600" />
                    </button>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  The spreadsheet ID is the long string in the URL after /d/ and before /edit
                </p>
              </div>
            </div>

            <div className="sticky bottom-0 bg-white border-t px-6 py-4 flex justify-end gap-2">
              <button
                onClick={() => setShowSettingsDialog(false)}
                className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  // Save spreadsheet ID to settings
                  settings.setSpreadsheetId(editSpreadsheetId);

                  // Clear cached data for all sheets
                  localStorage.removeItem('messagingmatrix_data_Audiences');
                  localStorage.removeItem('messagingmatrix_data_Topics');
                  localStorage.removeItem('messagingmatrix_data_Messages');

                  alert('Spreadsheet ID saved. The page will reload to fetch new data.');
                  window.location.reload();
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Save & Reload
              </button>
            </div>
          </div>
        </div>
      )}

      {/* State Dialog */}
      {showStateDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold">Application State (JSON)</h2>
              <button
                onClick={() => setShowStateDialog(false)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6">
              <pre className="bg-gray-50 p-4 rounded border border-gray-200 overflow-x-auto text-xs font-mono">
                {JSON.stringify(
                  {
                    audiences: audiences,
                    topics: topics,
                    messages: messages.filter(m => m.status !== 'deleted')
                  },
                  null,
                  2
                )}
              </pre>
            </div>

            <div className="sticky bottom-0 bg-white border-t px-6 py-4 flex justify-end">
              <button
                onClick={() => setShowStateDialog(false)}
                className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Message Edit Overlay */}
      {editingMessage && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold">Edit Messaging Card</h2>
              <button
                onClick={() => setEditingMessage(null)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name (Auto-generated)</label>
                <input
                  type="text"
                  value={editingMessage.name || ''}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded bg-gray-50 text-gray-500 cursor-not-allowed"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Audience Key</label>
                  <input
                    type="text"
                    value={editingMessage.audience || ''}
                    disabled
                    className="w-full px-3 py-2 border border-gray-300 rounded bg-gray-50 text-gray-500 cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Topic Key</label>
                  <input
                    type="text"
                    value={editingMessage.topic || ''}
                    disabled
                    className="w-full px-3 py-2 border border-gray-300 rounded bg-gray-50 text-gray-500 cursor-not-allowed"
                  />
                </div>
              </div>

              <div className="grid grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Number</label>
                  <input
                    type="number"
                    value={editingMessage.number || ''}
                    onChange={(e) => {
                      const newNumber = parseInt(e.target.value) || 0;
                      const newName = `${editingMessage.audience}!${editingMessage.topic}!m${newNumber}${editingMessage.variant || 'a'}!v${editingMessage.version || 1}`;
                      setEditingMessage({ ...editingMessage, number: newNumber, name: newName });
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Variant</label>
                  <input
                    type="text"
                    value={editingMessage.variant || ''}
                    onChange={(e) => {
                      const newVariant = e.target.value;
                      const newName = `${editingMessage.audience}!${editingMessage.topic}!m${editingMessage.number || 1}${newVariant}!v${editingMessage.version || 1}`;
                      setEditingMessage({ ...editingMessage, variant: newVariant, name: newName });
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Version (auto-increments)</label>
                  <input
                    type="number"
                    value={editingMessage.version || 1}
                    disabled
                    className="w-full px-3 py-2 border border-gray-300 rounded bg-gray-50 text-gray-500 cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select
                    value={editingMessage.status || 'PLANNED'}
                    onChange={(e) => setEditingMessage({ ...editingMessage, status: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="PLANNED">PLANNED</option>
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="PAUSED">PAUSED</option>
                  </select>
                </div>
              </div>

              {/* Warning about synced fields */}
              {editingMessage && (() => {
                // Find other messages with same number and variant
                const syncedMessages = messages.filter(m =>
                  m.id !== editingMessage.id &&
                  m.number === editingMessage.number &&
                  m.variant === editingMessage.variant &&
                  m.status !== 'deleted'
                );

                if (syncedMessages.length > 0) {
                  return (
                    <div className="bg-yellow-50 border border-yellow-300 rounded p-3">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="text-yellow-600 flex-shrink-0 mt-0.5" size={16} />
                        <div className="text-sm">
                          <p className="font-semibold text-yellow-800 mb-1">
                            Content Sync Warning: {syncedMessages.length} other message{syncedMessages.length > 1 ? 's' : ''} will be updated
                          </p>
                          <p className="text-yellow-700 mb-2">
                            Changes to Template, Landing URL, Headline, Copy 1, Copy 2, Flash, and CTA fields will be automatically applied to:
                          </p>
                          <ul className="text-yellow-700 list-disc list-inside">
                            {syncedMessages.map(m => {
                              const aud = audiences.find(a => a.key === m.audience);
                              return (
                                <li key={m.id}>
                                  <span className="font-medium">{aud ? aud.name : m.audience}</span>
                                  {' '}({m.name})
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      </div>
                    </div>
                  );
                }
                return null;
              })()}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Headline</label>
                <input
                  type="text"
                  value={editingMessage.headline || ''}
                  onChange={(e) => setEditingMessage({ ...editingMessage, headline: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Copy 1</label>
                <textarea
                  value={editingMessage.copy1 || ''}
                  onChange={(e) => setEditingMessage({ ...editingMessage, copy1: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Copy 2</label>
                <textarea
                  value={editingMessage.copy2 || ''}
                  onChange={(e) => setEditingMessage({ ...editingMessage, copy2: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Flash</label>
                  <input
                    type="text"
                    value={editingMessage.flash || ''}
                    onChange={(e) => setEditingMessage({ ...editingMessage, flash: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">CTA</label>
                  <input
                    type="text"
                    value={editingMessage.cta || ''}
                    onChange={(e) => setEditingMessage({ ...editingMessage, cta: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Landing URL</label>
                <input
                  type="text"
                  value={editingMessage.landingUrl || ''}
                  onChange={(e) => setEditingMessage({ ...editingMessage, landingUrl: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Template</label>
                <input
                  type="text"
                  value={editingMessage.template || ''}
                  onChange={(e) => setEditingMessage({ ...editingMessage, template: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Comment</label>
                <textarea
                  value={editingMessage.comment || ''}
                  onChange={(e) => setEditingMessage({ ...editingMessage, comment: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="sticky bottom-0 bg-white border-t px-6 py-4 flex justify-between items-center">
              <button
                onClick={() => {
                  if (confirm('Are you sure you want to delete this message?')) {
                    deleteMessage(editingMessage.id);
                    setEditingMessage(null);
                  }
                }}
                className="flex items-center gap-2 px-4 py-2 border border-red-300 text-red-600 rounded hover:bg-red-50"
              >
                <Trash2 size={16} />
                Delete Message
              </button>
              <div className="flex gap-2">
                <button
                  onClick={() => setEditingMessage(null)}
                  className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    // Increment version and update name
                    const newVersion = (editingMessage.version || 1) + 1;
                    const newName = `${editingMessage.audience}!${editingMessage.topic}!m${editingMessage.number || 1}${editingMessage.variant || 'a'}!v${newVersion}`;
                    const updatedMessage = { ...editingMessage, version: newVersion, name: newName };

                    // Update the current message
                    updateMessage(editingMessage.id, updatedMessage);

                    // Sync content fields to other messages with same number and variant
                    const syncedMessages = messages.filter(m =>
                      m.id !== editingMessage.id &&
                      m.number === editingMessage.number &&
                      m.variant === editingMessage.variant &&
                      m.status !== 'deleted'
                    );

                    syncedMessages.forEach(msg => {
                      updateMessage(msg.id, {
                        template: editingMessage.template,
                        landingUrl: editingMessage.landingUrl,
                        headline: editingMessage.headline,
                        copy1: editingMessage.copy1,
                        copy2: editingMessage.copy2,
                        flash: editingMessage.flash,
                        cta: editingMessage.cta
                      });
                    });

                    setEditingMessage(null);
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Audience Edit Dialog */}
      {editingAudience && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold">Edit Audience</h2>
              <button
                onClick={() => setEditingAudience(null)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ID</label>
                <input
                  type="number"
                  value={editingAudience.id || ''}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded bg-gray-50 text-gray-500 cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={editingAudience.name || ''}
                  onChange={(e) => setEditingAudience({ ...editingAudience, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Key</label>
                <input
                  type="text"
                  value={editingAudience.key || ''}
                  onChange={(e) => setEditingAudience({ ...editingAudience, key: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Order</label>
                <input
                  type="number"
                  value={editingAudience.order || ''}
                  onChange={(e) => setEditingAudience({ ...editingAudience, order: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={editingAudience.status || ''}
                  onChange={(e) => setEditingAudience({ ...editingAudience, status: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">None</option>
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="PAUSED">PAUSED</option>
                </select>
              </div>
            </div>

            <div className="sticky bottom-0 bg-white border-t px-6 py-4 flex justify-between items-center">
              <button
                onClick={() => {
                  // Check if any messages use this audience
                  const hasMessages = messages.some(m => m.audience === editingAudience.key && m.status !== 'deleted');

                  if (hasMessages) {
                    alert('Cannot delete this audience because it has messages assigned to it. Please delete or move the messages first.');
                    return;
                  }

                  if (confirm('Are you sure you want to delete this audience?')) {
                    deleteAudience(editingAudience.id);
                    setEditingAudience(null);
                  }
                }}
                className="flex items-center gap-2 px-4 py-2 border border-red-300 text-red-600 rounded hover:bg-red-50"
              >
                <Trash2 size={16} />
                Delete Audience
              </button>
              <div className="flex gap-2">
                <button
                  onClick={() => setEditingAudience(null)}
                  className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    // Check if this is a new audience (not in the list yet)
                    const isNew = !audiences.find(a => a.id === editingAudience.id);

                    if (isNew) {
                      // Add new audience
                      addAudience(editingAudience);
                    } else {
                      // Update existing audience
                      updateAudience(editingAudience.id, editingAudience);
                    }
                    setEditingAudience(null);
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Topic Edit Dialog */}
      {editingTopic && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold">Edit Topic</h2>
              <button
                onClick={() => setEditingTopic(null)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ID</label>
                <input
                  type="number"
                  value={editingTopic.id || ''}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded bg-gray-50 text-gray-500 cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={editingTopic.name || ''}
                  onChange={(e) => setEditingTopic({ ...editingTopic, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Key</label>
                <input
                  type="text"
                  value={editingTopic.key || ''}
                  onChange={(e) => setEditingTopic({ ...editingTopic, key: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Order</label>
                <input
                  type="number"
                  value={editingTopic.order || ''}
                  onChange={(e) => setEditingTopic({ ...editingTopic, order: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={editingTopic.status || ''}
                  onChange={(e) => setEditingTopic({ ...editingTopic, status: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-green-500 focus:border-transparent"
                >
                  <option value="">None</option>
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="PAUSED">PAUSED</option>
                </select>
              </div>
            </div>

            <div className="sticky bottom-0 bg-white border-t px-6 py-4 flex justify-between items-center">
              <button
                onClick={() => {
                  // Check if any messages use this topic
                  const hasMessages = messages.some(m => m.topic === editingTopic.key && m.status !== 'deleted');

                  if (hasMessages) {
                    alert('Cannot delete this topic because it has messages assigned to it. Please delete or move the messages first.');
                    return;
                  }

                  if (confirm('Are you sure you want to delete this topic?')) {
                    deleteTopic(editingTopic.id);
                    setEditingTopic(null);
                  }
                }}
                className="flex items-center gap-2 px-4 py-2 border border-red-300 text-red-600 rounded hover:bg-red-50"
              >
                <Trash2 size={16} />
                Delete Topic
              </button>
              <div className="flex gap-2">
                <button
                  onClick={() => setEditingTopic(null)}
                  className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    // Check if this is a new topic (not in the list yet)
                    const isNew = !topics.find(t => t.id === editingTopic.id);

                    if (isNew) {
                      // Add new topic
                      addTopic(editingTopic);
                    } else {
                      // Update existing topic
                      updateTopic(editingTopic.id, editingTopic);
                    }
                    setEditingTopic(null);
                  }}
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Preview Dialog */}
      {previewMessage && (() => {
        // Get current message number from preview
        const currentNumber = previewMessage.number;

        // Find message with current number and selected variant
        const displayMessage = messages.find(m =>
          m.number === currentNumber &&
          m.variant === previewVariant &&
          m.status !== 'deleted'
        ) || previewMessage;

        // Get all unique ACTIVE message numbers
        const activeNumbers = [...new Set(
          messages
            .filter(m => m.status?.toUpperCase() === 'ACTIVE' && m.status !== 'deleted')
            .map(m => m.number)
        )].sort((a, b) => a - b);

        // Get all variants for current number
        const availableVariants = [...new Set(
          messages
            .filter(m => m.number === currentNumber && m.status !== 'deleted')
            .map(m => m.variant)
        )].sort();

        // Find previous and next ACTIVE message numbers
        const currentIndex = activeNumbers.indexOf(currentNumber);
        const prevNumber = currentIndex > 0 ? activeNumbers[currentIndex - 1] : null;
        const nextNumber = currentIndex < activeNumbers.length - 1 ? activeNumbers[currentIndex + 1] : null;

        const goToPrevious = () => {
          if (prevNumber) {
            const prevMsg = messages.find(m => m.number === prevNumber && m.status !== 'deleted');
            if (prevMsg) {
              setPreviewMessage(prevMsg);
              setPreviewVariant(prevMsg.variant);
            }
          }
        };

        const goToNext = () => {
          if (nextNumber) {
            const nextMsg = messages.find(m => m.number === nextNumber && m.status !== 'deleted');
            if (nextMsg) {
              setPreviewMessage(nextMsg);
              setPreviewVariant(nextMsg.variant);
            }
          }
        };

        return (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
              <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <h2 className="text-xl font-semibold">Preview: m{currentNumber}{previewVariant}</h2>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <label className="text-sm font-medium text-gray-700">Variant:</label>
                      <select
                        value={previewVariant}
                        onChange={(e) => setPreviewVariant(e.target.value)}
                        className="px-3 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                      >
                        {availableVariants.map(v => (
                          <option key={v} value={v}>{v}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-sm font-medium text-gray-700">Size:</label>
                      <select
                        value={previewSize}
                        onChange={(e) => setPreviewSize(e.target.value)}
                        className="px-3 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                      >
                        <option value="300x250">300x250</option>
                        <option value="300x600">300x600</option>
                        <option value="640x360">640x360</option>
                        <option value="970x250">970x250</option>
                      </select>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setPreviewMessage(null)}
                  className="p-1 hover:bg-gray-100 rounded"
                >
                  <X size={20} />
                </button>
              </div>

            <div className="flex-1 p-6 overflow-auto">
              <iframe
                srcDoc={(() => {
                  // Fetch template and replace variables
                  const templateHtml = `<html id="html">
  <head>
    <title>${previewMessage.name}</title>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="/src/templates/html/main.css" />
    <link rel="stylesheet" href="/src/templates/html/${previewSize}.css" />
  </head>
  <body>
      <div class="click-url" id="clickLayer">
        <div id="adContainer" class="template_variant_class {{template_variant_class}}">
          <div id="backgroundContainer">
            <div id="imageWrapper">
              <div style="background-image:url('{{background_image_1}}')" class="background_image_1"></div>
            </div>
            <div id="videoWrapper">
              <video autoplay muted playsinline loop onload="playVideo()">
                <source src="{{background_video_1}}" type="video/mp4" class="background_video_1"></video>
            </div>
          </div>
          <main>
            <div id="objectWrapper">
              <div style="background-image:url('{{background_image_2}}')" class="background_image_2"></div>
            </div>
            <div id="textContainer">
              <div id="stickerContainer">
                <div class="stickerTextWrapper">
                  <p class="sticker_text_1 sticker_style_1" style="{{sticker_style_1}}">{{sticker_text_1}}</p>
                  <!-- if p is empty p is not displayed,
                  content eg.: <b>flash</b> text -->
                </div>
                <div class="stickerImageWrapper">
                  <div style="background-image:url('{{sticker_image_1}}')" class="sticker_image_1">
                  {{sticker_image_1}}
                  <!-- if div is empty it is not displayed so sticker_image_1 path must be placed into the div as well,
                  not just into style -->
                  </div>
                </div>
              </div>
              <div id="cardContainer">
                <div class="cardImageWrapper">
                  <div style="background-image:url('{{background_image_3}}')" class="background_image_3">
                  {{background_image_3}}
                  <!-- if div is empty it is not displayed so background_image_3 path must be placed into the div as well,
                  not just into style -->
                  </div>
                </div>
              </div>
              <!-- if any text layer p is empty 0 height block is displayed -->
              <div id="headlineWrapper">
                <h2 class="headline_text_1 headline_style_1" style="{{headline_style_1}}">{{headline_text_1}}</h2>
              </div>
              <div id="copyWrapper1">
                <p class="copy_text_1 copy_style_1" style="{{copy_style_1}}">{{copy_text_1}}</p>
              </div>
              <div id="copyWrapper2">
                <!-- copy_text_2 -->
                <p class="thm copy_style_2" style="{{copy_style_2}}">{{copy_text_2}}</b></p>
              </div>
              <div id="buttonWrapper">
                <span class="cta_text_1 cta_style_1" style="{{cta_style_1}}" data="{{cta_text_1}}">{{cta_text_1}}</span>
                <!-- if buttonContainer > span is empty no button block is displayed -->
              </div>
              <div id="disclaimerWrapper1">
                <p class="disclaimer_text_1 disclaimer_style_1" style="{{disclaimer_style_1}}" data="{{disclaimer_text_1}}">{{disclaimer_text_1}}</p>
              </div>
            </div>
          </main>
          <div id="frameContainer"></div>
          <div id="logoContainer">
            <div id="logoWrapper">
              <img src="{{brand_image_1}}" class="logo logo_image_1 brand_image_1"/>
            </div>
          </div>
        </div>
    </div>
  </body>
</html>`;

                  // Replace placeholders with actual values from displayMessage
                  return templateHtml
                    .replace(/\{\{headline_text_1\}\}/g, displayMessage.headline || '')
                    .replace(/\{\{copy_text_1\}\}/g, displayMessage.copy1 || '')
                    .replace(/\{\{copy_text_2\}\}/g, displayMessage.copy2 || '')
                    .replace(/\{\{cta_text_1\}\}/g, displayMessage.cta || '')
                    .replace(/\{\{sticker_text_1\}\}/g, displayMessage.flash || '')
                    // Clear unused variables
                    .replace(/\{\{[^}]+\}\}/g, '')
                    .replace(/\[\[[^\]]+\]\]/g, '');
                })()}
                className="w-full h-[600px] border-0"
                title="Message Preview"
              />
            </div>

            <div className="sticky bottom-0 bg-white border-t px-6 py-4 flex justify-between items-center">
              <div className="flex gap-2">
                <button
                  onClick={goToPrevious}
                  disabled={!prevNumber}
                  className={`px-4 py-2 rounded ${
                    prevNumber
                      ? 'bg-green-600 text-white hover:bg-green-700'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  Previous ACTIVE
                </button>
                <button
                  onClick={goToNext}
                  disabled={!nextNumber}
                  className={`px-4 py-2 rounded ${
                    nextNumber
                      ? 'bg-green-600 text-white hover:bg-green-700'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  Next ACTIVE
                </button>
              </div>
              <button
                onClick={() => setPreviewMessage(null)}
                className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
        );
      })()}
    </div>
  );
};

export default Matrix;
