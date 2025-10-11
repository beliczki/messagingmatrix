import React from 'react';
import { X, Trash2 } from 'lucide-react';

const AudienceEditorDialog = ({
  editingAudience,
  setEditingAudience,
  audiences,
  updateAudience,
  deleteAudience,
  addAudience,
  keywords,
  messages
}) => {
  if (!editingAudience) return null;

  // Debug: Log keywords structure
  console.log('AudienceEditorDialog keywords:', keywords);
  console.log('keywords.audiences:', keywords?.audiences);
  console.log('Available audience fields:', keywords?.audiences ? Object.keys(keywords.audiences) : 'none');

  // Helper to render input or dropdown based on keyword availability
  const renderField = (fieldName, placeholder = '') => {
    const keywordValues = keywords.audiences && keywords.audiences[fieldName];
    const value = editingAudience[fieldName] || '';

    console.log(`Field ${fieldName}:`, keywordValues);

    if (keywordValues && keywordValues.length > 0) {
      // Render dropdown if keywords exist
      return (
        <select
          value={value}
          onChange={(e) => setEditingAudience({ ...editingAudience, [fieldName]: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="">None</option>
          {keywordValues.map((val) => (
            <option key={val} value={val}>{val}</option>
          ))}
        </select>
      );
    } else {
      // Render text input if no keywords
      return (
        <input
          type="text"
          value={value}
          onChange={(e) => setEditingAudience({ ...editingAudience, [fieldName]: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder={placeholder}
        />
      );
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Edit Audience</h2>
          <button
            onClick={() => setEditingAudience(null)}
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

          <div className="grid grid-cols-3 gap-4">
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
              {(() => {
                const keywordValues = keywords.audiences && keywords.audiences.status;
                const statusOptions = keywordValues && keywordValues.length > 0
                  ? keywordValues
                  : ['PLANNED', 'INPROGRESS', 'ACTIVE', 'INACTIVE'];

                return (
                  <select
                    value={editingAudience.status || ''}
                    onChange={(e) => setEditingAudience({ ...editingAudience, status: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
              {renderField('product')}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Strategy</label>
              {renderField('strategy')}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Buying Platform</label>
              {renderField('buying_platform')}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Data Source</label>
              {renderField('data_source')}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Targeting Type</label>
              {renderField('targeting_type')}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Device</label>
              {renderField('device')}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tag</label>
              {renderField('tag', 'Category tag')}
            </div>
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Comment</label>
            <textarea
              value={editingAudience.comment || ''}
              onChange={(e) => setEditingAudience({ ...editingAudience, comment: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Internal notes..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Campaign Name</label>
              <input
                type="text"
                value={editingAudience.campaign_name || ''}
                onChange={(e) => setEditingAudience({ ...editingAudience, campaign_name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Campaign ID</label>
              <input
                type="text"
                value={editingAudience.campaign_id || ''}
                onChange={(e) => setEditingAudience({ ...editingAudience, campaign_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Line Item Name</label>
              <input
                type="text"
                value={editingAudience.lineitem_name || ''}
                onChange={(e) => setEditingAudience({ ...editingAudience, lineitem_name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Line Item ID</label>
              <input
                type="text"
                value={editingAudience.lineitem_id || ''}
                onChange={(e) => setEditingAudience({ ...editingAudience, lineitem_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
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
              Save & Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AudienceEditorDialog;
