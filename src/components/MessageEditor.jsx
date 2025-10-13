import React, { useState, useEffect } from 'react';
import { X, Save, ExternalLink, Copy } from 'lucide-react';

const MessageEditor = ({ message, templates, onSave, onClose }) => {
  const [formData, setFormData] = useState({
    template: '',
    landingUrl: '',
    headline: '',
    copy1: '',
    copy2: '',
    flash: '',
    cta: '',
    comment: ''
  });

  // Initialize form data
  useEffect(() => {
    if (message) {
      setFormData({
        template: message.template || '',
        landingUrl: message.landingUrl || '',
        headline: message.headline || '',
        copy1: message.copy1 || '',
        copy2: message.copy2 || '',
        flash: message.flash || '',
        cta: message.cta || '',
        comment: message.comment || ''
      });
    }
  }, [message]);

  const handleChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSave = () => {
    onSave(formData);
  };

  const handleCopyName = () => {
    navigator.clipboard.writeText(message.name);
  };

  const handleOpenUrl = () => {
    if (formData.landingUrl) {
      window.open(formData.landingUrl, '_blank');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-xl font-semibold text-gray-800">Edit Message</h2>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-sm font-mono text-gray-600 bg-gray-100 px-2 py-1 rounded">
                {message.name}
              </span>
              <button
                onClick={handleCopyName}
                className="p-1 text-gray-400 hover:text-gray-600"
                title="Copy message name"
              >
                <Copy size={14} />
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

        {/* Form */}
        <div className="p-6 space-y-4">
          {/* Template selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Template
            </label>
            <select
              value={formData.template}
              onChange={(e) => handleChange('template', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select template...</option>
              {templates.map((template) => (
                <option key={template.id} value={template.name}>
                  {template.name} ({template.type} - {template.dimensions})
                </option>
              ))}
            </select>
          </div>

          {/* Landing URL */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Landing URL
            </label>
            <div className="flex gap-2">
              <input
                type="url"
                value={formData.landingUrl}
                onChange={(e) => handleChange('landingUrl', e.target.value)}
                placeholder="https://example.com/landing-page"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {formData.landingUrl && (
                <button
                  onClick={handleOpenUrl}
                  className="px-3 py-2 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-colors"
                  title="Open URL"
                >
                  <ExternalLink size={16} />
                </button>
              )}
            </div>
          </div>

          {/* Headline */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Headline
            </label>
            <input
              type="text"
              value={formData.headline}
              onChange={(e) => handleChange('headline', e.target.value)}
              placeholder="Enter compelling headline..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Copy 1 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Copy 1 (Primary)
            </label>
            <textarea
              value={formData.copy1}
              onChange={(e) => handleChange('copy1', e.target.value)}
              placeholder="Enter primary copy text..."
              rows="3"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {/* Copy 2 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Copy 2 (Secondary)
            </label>
            <textarea
              value={formData.copy2}
              onChange={(e) => handleChange('copy2', e.target.value)}
              placeholder="Enter secondary copy text..."
              rows="3"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {/* Flash text */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Flash Text
            </label>
            <input
              type="text"
              value={formData.flash}
              onChange={(e) => handleChange('flash', e.target.value)}
              placeholder="Limited time offer, Sale, etc..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* CTA */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Call to Action (CTA)
            </label>
            <input
              type="text"
              value={formData.cta}
              onChange={(e) => handleChange('cta', e.target.value)}
              placeholder="Shop Now, Learn More, Get Started..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Comment */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Comment / Notes
            </label>
            <textarea
              value={formData.comment}
              onChange={(e) => handleChange('comment', e.target.value)}
              placeholder="Internal notes, feedback, variations..."
              rows="3"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t bg-gray-50">
          <div className="text-sm text-gray-500">
            Message: {message.audience}!{message.topic}!m{message.number}!{message.variant}!n{message.version}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              <Save size={16} />
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MessageEditor;
