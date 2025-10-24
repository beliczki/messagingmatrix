import React, { useState, useEffect } from 'react';
import { X, Save, Eye, Edit3, ExternalLink } from 'lucide-react';

const MessageDetailOverlay = ({ message, templates, isEditing, onClose, onSave }) => {
  const [editedMessage, setEditedMessage] = useState(message);
  const [viewMode, setViewMode] = useState(!isEditing);

  useEffect(() => {
    setEditedMessage(message);
  }, [message]);

  const handleSave = () => {
    onSave(editedMessage);
    onClose();
  };

  const handleFieldChange = (field, value) => {
    setEditedMessage(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const toggleMode = () => {
    setViewMode(!viewMode);
  };

  const fieldLabels = {
    name: 'Message Name',
    number: 'Message Number',
    variant: 'Variant',
    audience: 'Audience',
    topic: 'Topic',
    version: 'Version',
    template: 'Template',
    landingUrl: 'Landing URL',
    headline: 'Headline',
    copy1: 'Copy 1',
    copy2: 'Copy 2',
    flash: 'Flash Text',
    cta: 'Call to Action',
    comment: 'Comment',
    status: 'Status'
  };

  const statusOptions = ['active', 'draft', 'review', 'approved', 'removed'];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-gray-900">
              Message Details
            </h2>
            <div className="flex items-center gap-2">
              <button
                onClick={toggleMode}
                className={`flex items-center gap-2 px-3 py-1 rounded-md text-sm transition-colors ${
                  viewMode 
                    ? 'bg-gray-100 text-gray-700 hover:bg-gray-200' 
                    : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                }`}
              >
                {viewMode ? <Edit3 size={16} /> : <Eye size={16} />}
                {viewMode ? 'Edit' : 'View'}
              </button>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-800 border-b pb-2">
                Basic Information
              </h3>
              
              {/* Message Name (readonly) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {fieldLabels.name}
                </label>
                <div className="text-sm font-mono bg-gray-50 p-2 rounded border">
                  {editedMessage.name}
                </div>
              </div>

              {/* Number, Variant, Version */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {fieldLabels.number}
                  </label>
                  {viewMode ? (
                    <div className="text-sm bg-gray-50 p-2 rounded border">
                      {editedMessage.number}
                    </div>
                  ) : (
                    <input
                      type="number"
                      value={editedMessage.number || ''}
                      onChange={(e) => handleFieldChange('number', parseInt(e.target.value) || 0)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {fieldLabels.variant}
                  </label>
                  {viewMode ? (
                    <div className="text-sm bg-gray-50 p-2 rounded border">
                      {editedMessage.variant}
                    </div>
                  ) : (
                    <input
                      type="text"
                      value={editedMessage.variant || ''}
                      onChange={(e) => handleFieldChange('variant', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {fieldLabels.version}
                  </label>
                  {viewMode ? (
                    <div className="text-sm bg-gray-50 p-2 rounded border">
                      {editedMessage.version}
                    </div>
                  ) : (
                    <input
                      type="number"
                      value={editedMessage.version || ''}
                      onChange={(e) => handleFieldChange('version', parseInt(e.target.value) || 1)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  )}
                </div>
              </div>

              {/* Audience and Topic (readonly) */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {fieldLabels.audience}
                  </label>
                  <div className="text-sm bg-gray-50 p-2 rounded border">
                    {editedMessage.audience}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {fieldLabels.topic}
                  </label>
                  <div className="text-sm bg-gray-50 p-2 rounded border">
                    {editedMessage.topic}
                  </div>
                </div>
              </div>

              {/* Template */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {fieldLabels.template}
                </label>
                {viewMode ? (
                  <div className="text-sm bg-gray-50 p-2 rounded border">
                    {editedMessage.template || 'No template selected'}
                  </div>
                ) : (
                  <select
                    value={editedMessage.template || ''}
                    onChange={(e) => handleFieldChange('template', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select template...</option>
                    {templates.map((template) => (
                      <option key={template.name} value={template.name}>
                        {template.name} ({template.type} - {template.dimensions})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Status */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {fieldLabels.status}
                </label>
                {viewMode ? (
                  <div className={`inline-block text-sm px-2 py-1 rounded-full ${
                    editedMessage.status === 'active' ? 'bg-green-100 text-green-800' :
                    editedMessage.status === 'removed' ? 'bg-red-100 text-red-800' :
                    editedMessage.status === 'approved' ? 'bg-blue-100 text-blue-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {editedMessage.status}
                  </div>
                ) : (
                  <select
                    value={editedMessage.status || 'active'}
                    onChange={(e) => handleFieldChange('status', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {statusOptions.map((status) => (
                      <option key={status} value={status}>
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            {/* Content Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-800 border-b pb-2">
                Content Information
              </h3>

              {/* Landing URL */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {fieldLabels.landingUrl}
                </label>
                {viewMode ? (
                  <div className="text-sm bg-gray-50 p-2 rounded border flex items-center gap-2">
                    {editedMessage.landingUrl ? (
                      <>
                        <span className="truncate">{editedMessage.landingUrl}</span>
                        <a
                          href={editedMessage.landingUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800"
                        >
                          <ExternalLink size={14} />
                        </a>
                      </>
                    ) : (
                      'No URL specified'
                    )}
                  </div>
                ) : (
                  <input
                    type="url"
                    value={editedMessage.landingUrl || ''}
                    onChange={(e) => handleFieldChange('landingUrl', e.target.value)}
                    placeholder="https://example.com"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                )}
              </div>

              {/* Headline */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {fieldLabels.headline}
                </label>
                {viewMode ? (
                  <div className="text-sm bg-gray-50 p-2 rounded border min-h-[2.5rem]">
                    {editedMessage.headline || 'No headline'}
                  </div>
                ) : (
                  <textarea
                    value={editedMessage.headline || ''}
                    onChange={(e) => handleFieldChange('headline', e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter headline..."
                  />
                )}
              </div>

              {/* Copy 1 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {fieldLabels.copy1}
                </label>
                {viewMode ? (
                  <div className="text-sm bg-gray-50 p-2 rounded border min-h-[3rem]">
                    {editedMessage.copy1 || 'No copy 1'}
                  </div>
                ) : (
                  <textarea
                    value={editedMessage.copy1 || ''}
                    onChange={(e) => handleFieldChange('copy1', e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter copy 1..."
                  />
                )}
              </div>

              {/* Copy 2 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {fieldLabels.copy2}
                </label>
                {viewMode ? (
                  <div className="text-sm bg-gray-50 p-2 rounded border min-h-[3rem]">
                    {editedMessage.copy2 || 'No copy 2'}
                  </div>
                ) : (
                  <textarea
                    value={editedMessage.copy2 || ''}
                    onChange={(e) => handleFieldChange('copy2', e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter copy 2..."
                  />
                )}
              </div>

              {/* Flash and CTA */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {fieldLabels.flash}
                  </label>
                  {viewMode ? (
                    <div className="text-sm bg-gray-50 p-2 rounded border">
                      {editedMessage.flash || 'No flash text'}
                    </div>
                  ) : (
                    <input
                      type="text"
                      value={editedMessage.flash || ''}
                      onChange={(e) => handleFieldChange('flash', e.target.value)}
                      placeholder="Flash text..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {fieldLabels.cta}
                  </label>
                  {viewMode ? (
                    <div className="text-sm bg-gray-50 p-2 rounded border">
                      {editedMessage.cta || 'No CTA'}
                    </div>
                  ) : (
                    <input
                      type="text"
                      value={editedMessage.cta || ''}
                      onChange={(e) => handleFieldChange('cta', e.target.value)}
                      placeholder="Call to action..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  )}
                </div>
              </div>

              {/* Comment */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {fieldLabels.comment}
                </label>
                {viewMode ? (
                  <div className="text-sm bg-gray-50 p-2 rounded border min-h-[3rem]">
                    {editedMessage.comment || 'No comments'}
                  </div>
                ) : (
                  <textarea
                    value={editedMessage.comment || ''}
                    onChange={(e) => handleFieldChange('comment', e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Add comments..."
                  />
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          {!viewMode && (
            <button
              onClick={handleSave}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              <Save size={16} />
              Save Changes
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default MessageDetailOverlay;
