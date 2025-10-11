import React, { useEffect } from 'react';
import { X, Trash2 } from 'lucide-react';
import settings from '../services/settings';
import { generateTopicKey } from '../utils/patternEvaluator';

const TopicEditorDialog = ({
  editingTopic,
  setEditingTopic,
  topics,
  updateTopic,
  deleteTopic,
  addTopic,
  keywords,
  messages
}) => {
  // Helper function to generate key based on pattern
  const updateTopicKey = (updatedTopic) => {
    const topicKeyPattern = settings.getPattern('topicKey');
    const generatedKey = generateTopicKey(updatedTopic, topicKeyPattern);
    return { ...updatedTopic, key: generatedKey };
  };

  // Auto-generate key when dialog opens or relevant fields change
  useEffect(() => {
    if (editingTopic) {
      const updatedTopic = updateTopicKey(editingTopic);
      // Only update if the key has actually changed
      if (updatedTopic.key !== editingTopic.key) {
        setEditingTopic(updatedTopic);
      }
    }
  }, [editingTopic?.tag1, editingTopic?.tag2, editingTopic?.tag3, editingTopic?.tag4, editingTopic?.product]);

  if (!editingTopic) return null;

  return (
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

        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ID</label>
            <input
              type="text"
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
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Key <span className="text-xs text-gray-500">(auto-generated)</span>
            </label>
            <input
              type="text"
              value={editingTopic.key || ''}
              disabled
              className="w-full px-3 py-2 border border-gray-300 rounded bg-gray-50 text-gray-500 cursor-not-allowed"
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
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
              {(() => {
                const keywordValues = keywords.topics && keywords.topics.status;
                const statusOptions = keywordValues && keywordValues.length > 0
                  ? keywordValues
                  : ['PLANNED', 'INPROGRESS', 'ACTIVE', 'INACTIVE'];

                return (
                  <select
                    value={editingTopic.status || ''}
                    onChange={(e) => setEditingTopic({ ...editingTopic, status: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  >
                    <option value="">None</option>
                    {statusOptions.map((val) => (
                      <option key={val} value={val}>{val}</option>
                    ))}
                  </select>
                );
              })()}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Product</label>
              <select
                value={editingTopic.product || ''}
                onChange={(e) => {
                  const updatedTopic = { ...editingTopic, product: e.target.value };
                  setEditingTopic(updateTopicKey(updatedTopic));
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-green-500 focus:border-transparent"
              >
                <option value="">None</option>
                {((keywords.topics && keywords.topics.product) || []).map((value) => (
                  <option key={value} value={value}>{value}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tag 1</label>
              <select
                value={editingTopic.tag1 || ''}
                onChange={(e) => {
                  const updatedTopic = { ...editingTopic, tag1: e.target.value };
                  setEditingTopic(updateTopicKey(updatedTopic));
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-green-500 focus:border-transparent"
              >
                <option value="">None</option>
                {((keywords.topics && keywords.topics.tag1) || []).map((value) => (
                  <option key={value} value={value}>{value}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tag 2</label>
              <select
                value={editingTopic.tag2 || ''}
                onChange={(e) => {
                  const updatedTopic = { ...editingTopic, tag2: e.target.value };
                  setEditingTopic(updateTopicKey(updatedTopic));
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-green-500 focus:border-transparent"
              >
                <option value="">None</option>
                {((keywords.topics && keywords.topics.tag2) || []).map((value) => (
                  <option key={value} value={value}>{value}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tag 3</label>
              <select
                value={editingTopic.tag3 || ''}
                onChange={(e) => {
                  const updatedTopic = { ...editingTopic, tag3: e.target.value };
                  setEditingTopic(updateTopicKey(updatedTopic));
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-green-500 focus:border-transparent"
              >
                <option value="">None</option>
                {((keywords.topics && keywords.topics.tag3) || []).map((value) => (
                  <option key={value} value={value}>{value}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tag 4</label>
              <input
                type="text"
                value={editingTopic.tag4 || ''}
                onChange={(e) => {
                  const updatedTopic = { ...editingTopic, tag4: e.target.value };
                  setEditingTopic(updateTopicKey(updatedTopic));
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="Enter tag 4"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Created</label>
            <input
              type="date"
              value={editingTopic.created || ''}
              onChange={(e) => setEditingTopic({ ...editingTopic, created: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Comment</label>
            <textarea
              value={editingTopic.comment || ''}
              onChange={(e) => setEditingTopic({ ...editingTopic, comment: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-green-500 focus:border-transparent"
              placeholder="Internal notes..."
            />
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
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Save & Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TopicEditorDialog;
