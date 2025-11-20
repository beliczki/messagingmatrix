import React, { useState, useEffect } from 'react';
import { X, Trash2, Mail, Clock, Plus, Search, Tag } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

const TaskEditorDialog = ({
  editingTask,
  setEditingTask,
  onSave,
  onDelete,
  buckets
}) => {
  const [activeTab, setActiveTab] = useState('summary');
  const [creativeSearch, setCreativeSearch] = useState('');
  const [availableLabels, setAvailableLabels] = useState({ products: [], topics: [], all: [] });
  const [showLabelDropdown, setShowLabelDropdown] = useState(false);

  // Fetch available labels on mount
  useEffect(() => {
    apiGet('/api/task-labels')
      .then(res => res.json())
      .then(data => setAvailableLabels(data))
      .catch(err => console.error('Error fetching labels:', err));
  }, []);

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

  // Clean email body - remove footers, legal text, etc.
  const cleanEmailBody = (body) => {
    if (!body) return '';

    let cleaned = body;

    // Remove email thread/reply markers and everything after them
    cleaned = cleaned.replace(/On.*?wrote:[\s\S]*$/gim, '');
    cleaned = cleaned.replace(/From:.*?Sent:.*?To:.*?Subject:.*?$/gims, '');
    cleaned = cleaned.replace(/_{5,}.*$/gms, ''); // Long underscores often mark replies
    cleaned = cleaned.replace(/[-]{3,}.*Original.*Message.*[-]{3,}[\s\S]*$/gims, '');

    // Remove quoted reply blocks (lines starting with > or |)
    cleaned = cleaned.split('\n').filter(line => !line.trim().match(/^[>|]/)).join('\n');

    // Remove "Sent from my..." footers
    cleaned = cleaned.replace(/Sent from my.*$/gim, '');
    cleaned = cleaned.replace(/Get Outlook for.*$/gim, '');

    // Remove signature blocks (multiple dashes or underscores)
    cleaned = cleaned.replace(/\n[-_]{3,}\n[\s\S]*$/gm, '');

    // Remove legal disclaimers
    cleaned = cleaned.replace(/This email.*?$/gims, '');
    cleaned = cleaned.replace(/Confidential.*?$/gims, '');
    cleaned = cleaned.replace(/DISCLAIMER.*?$/gims, '');
    cleaned = cleaned.replace(/NOTICE:.*?$/gims, '');

    // Remove common forwarding markers
    cleaned = cleaned.replace(/Begin forwarded message:[\s\S]*$/gim, '');
    cleaned = cleaned.replace(/---------- Forwarded message ---------[\s\S]*$/gim, '');

    // Remove excessive blank lines
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

    return cleaned.trim();
  };

  // Add related content (creative)
  const handleAddRelatedContent = (creative) => {
    const relatedContent = editingTask.relatedContent || [];
    if (!relatedContent.find(c => c.id === creative.id)) {
      setEditingTask({
        ...editingTask,
        relatedContent: [...relatedContent, creative]
      });
    }
    setCreativeSearch('');
  };

  // Remove related content
  const handleRemoveRelatedContent = (creativeId) => {
    setEditingTask({
      ...editingTask,
      relatedContent: (editingTask.relatedContent || []).filter(c => c.id !== creativeId)
    });
  };

  // Generate Gmail search URL from email subject
  const getGmailSearchUrl = (subject) => {
    if (!subject) return null;
    const encodedSubject = encodeURIComponent(subject).replace(/%20/g, '+');
    return `https://mail.google.com/mail/u/0/#search/${encodedSubject}`;
  };

  // Add label to task
  const handleAddLabel = (label) => {
    const currentLabels = editingTask.labels || [];
    if (!currentLabels.includes(label)) {
      setEditingTask({
        ...editingTask,
        labels: [...currentLabels, label]
      });
    }
    setShowLabelDropdown(false);
  };

  // Remove label from task
  const handleRemoveLabel = (label) => {
    setEditingTask({
      ...editingTask,
      labels: (editingTask.labels || []).filter(l => l !== label)
    });
  };

  // Get color for label badge
  const getLabelColor = (label) => {
    // Product labels get blue
    if (availableLabels.products && availableLabels.products.includes(label)) {
      return 'bg-blue-100 text-blue-700 border-blue-300';
    }
    // Topic labels get different colors
    const topicColors = {
      'Creative': 'bg-purple-100 text-purple-700 border-purple-300',
      'Strategy': 'bg-green-100 text-green-700 border-green-300',
      'Technical': 'bg-orange-100 text-orange-700 border-orange-300',
      'Reporting': 'bg-cyan-100 text-cyan-700 border-cyan-300',
      'Client Communication': 'bg-pink-100 text-pink-700 border-pink-300',
      'Campaign Setup': 'bg-indigo-100 text-indigo-700 border-indigo-300',
      'Optimization': 'bg-teal-100 text-teal-700 border-teal-300',
      'QA': 'bg-yellow-100 text-yellow-700 border-yellow-300',
      'Urgent': 'bg-red-100 text-red-700 border-red-300',
      'Research': 'bg-gray-100 text-gray-700 border-gray-300'
    };
    return topicColors[label] || 'bg-gray-100 text-gray-700 border-gray-300';
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
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

        {/* Tab Navigation */}
        <div className="border-b bg-gray-50">
          <div className="flex">
            <button
              onClick={() => setActiveTab('summary')}
              className={`px-6 py-3 font-medium transition-colors ${
                activeTab === 'summary'
                  ? 'bg-white border-b-2 border-blue-500 text-blue-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              Summary
            </button>
            <button
              onClick={() => setActiveTab('context')}
              className={`px-6 py-3 font-medium transition-colors ${
                activeTab === 'context'
                  ? 'bg-white border-b-2 border-blue-500 text-blue-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              Context
            </button>
            <button
              onClick={() => setActiveTab('related')}
              className={`px-6 py-3 font-medium transition-colors ${
                activeTab === 'related'
                  ? 'bg-white border-b-2 border-blue-500 text-blue-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              Related Content
              {editingTask.relatedContent && editingTask.relatedContent.length > 0 && (
                <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs">
                  {editingTask.relatedContent.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Summary Tab */}
          {activeTab === 'summary' && (
            <div className="space-y-4">
              {/* Labels Section */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Tag size={14} className="inline mr-1" />
                  Labels
                </label>

                {/* Current Labels and Add Label Button - Inline */}
                <div className="flex flex-wrap gap-2 items-center">
                  {(editingTask.labels || []).map((label) => (
                    <span
                      key={label}
                      className={`inline-flex items-center gap-1 px-3 py-1 rounded text-sm font-medium ${getLabelColor(label)}`}
                    >
                      {label}
                      <button
                        onClick={() => handleRemoveLabel(label)}
                        className="hover:bg-black hover:bg-opacity-10 rounded-full p-0.5 transition-colors"
                      >
                        <X size={14} />
                      </button>
                    </span>
                  ))}

                  {/* Add Label Dropdown - Inline */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowLabelDropdown(!showLabelDropdown)}
                      className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-50 transition-colors text-sm flex items-center gap-1 bg-white"
                    >
                      <Plus size={14} />
                      Add Label
                    </button>

                    {showLabelDropdown && (
                      <div className="absolute left-0 z-50 mt-1 w-64 bg-white border-2 border-gray-300 rounded-lg shadow-xl max-h-80 overflow-y-auto">
                        {/* Products Section */}
                        {availableLabels.products && availableLabels.products.length > 0 ? (
                          <div className="p-2">
                            <div className="text-xs font-semibold text-gray-500 uppercase px-2 py-1 mb-1">Products</div>
                            {availableLabels.products.map(label => (
                              <button
                                key={label}
                                type="button"
                                onClick={() => handleAddLabel(label)}
                                disabled={(editingTask.labels || []).includes(label)}
                                className={`w-full text-left px-3 py-2 text-sm rounded hover:bg-blue-50 transition-colors mb-1 ${
                                  (editingTask.labels || []).includes(label) ? 'opacity-50 cursor-not-allowed bg-gray-100' : 'bg-white'
                                }`}
                              >
                                <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${getLabelColor(label)}`}>
                                  {label}
                                </span>
                              </button>
                            ))}
                          </div>
                        ) : (
                          <div className="p-4 text-sm text-gray-500 text-center">
                            No product labels available
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

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
                  rows={6}
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

              {/* Gmail Search Link (if task is from email) */}
              {editingTask.emailSubject && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 mt-6">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-green-900 mb-1">
                        <Mail size={14} className="inline mr-1" />
                        Original Email
                      </label>
                      <p className="text-sm text-green-700">
                        {editingTask.emailSubject}
                      </p>
                    </div>
                    <a
                      href={getGmailSearchUrl(editingTask.emailSubject)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors flex items-center gap-2 whitespace-nowrap"
                    >
                      <Search size={16} />
                      Open in Gmail
                    </a>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Context Tab */}
          {activeTab === 'context' && (
            <div className="space-y-4">
              {/* AI-Extracted Conversation Context (Read-only Markdown) */}
              {editingTask.context && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Extracted Conversation Context
                  </label>
                  <p className="text-sm text-gray-500 mb-3">
                    AI-extracted conversation structure from the email thread
                  </p>
                  <div className="w-full px-4 py-3 border border-gray-200 rounded bg-gray-50 prose prose-sm max-w-none max-h-96 overflow-y-auto">
                    <ReactMarkdown>{editingTask.context}</ReactMarkdown>
                  </div>
                </div>
              )}

              {/* User's Additional Notes (Editable) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Additional Context & Notes
                </label>
                <p className="text-sm text-gray-500 mb-3">
                  Add your own notes and context that the AI assistant can use to regenerate or improve the task summary
                </p>
                <textarea
                  value={editingTask.userNotes || ''}
                  onChange={(e) => setEditingTask({ ...editingTask, userNotes: e.target.value })}
                  rows={8}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                  placeholder="Add context, notes, requirements, or any information that helps understand this task better..."
                />
              </div>
            </div>
          )}

          {/* Related Content Tab */}
          {activeTab === 'related' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Related Creatives
                </label>
                <p className="text-sm text-gray-500 mb-3">
                  Link creatives by filename or MC number
                </p>
              </div>

              {/* Search/Add Section */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      value={creativeSearch}
                      onChange={(e) => setCreativeSearch(e.target.value)}
                      placeholder="Search by filename or MC number..."
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <button
                    onClick={() => {
                      if (creativeSearch.trim()) {
                        handleAddRelatedContent({
                          id: Date.now(),
                          reference: creativeSearch.trim(),
                          type: 'creative'
                        });
                      }
                    }}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors flex items-center gap-2"
                  >
                    <Plus size={16} />
                    Add
                  </button>
                </div>
              </div>

              {/* Related Content List */}
              {editingTask.relatedContent && editingTask.relatedContent.length > 0 ? (
                <div className="grid grid-cols-2 gap-3">
                  {editingTask.relatedContent.map((item) => (
                    <div
                      key={item.id}
                      className="bg-white border border-gray-200 rounded-lg p-3 flex items-center justify-between hover:border-blue-300 transition-colors"
                    >
                      <div className="flex-1">
                        <div className="font-medium text-sm text-gray-900">{item.reference}</div>
                        <div className="text-xs text-gray-500 capitalize">{item.type}</div>
                      </div>
                      <button
                        onClick={() => handleRemoveRelatedContent(item.id)}
                        className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500 border border-dashed border-gray-300 rounded-lg">
                  <p className="text-sm">No related content linked yet</p>
                  <p className="text-xs mt-1">Use the search above to add creatives</p>
                </div>
              )}
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
