import React, { useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, Trash2, Check } from 'lucide-react';
import settings from '../services/settings';

const AudienceEditorDialog = ({
  editingAudience,
  setEditingAudience,
  audiences,
  filteredAudiences,
  updateAudience,
  deleteAudience,
  addAudience,
  keywords,
  messages
}) => {
  const [isClosing, setIsClosing] = useState(false);
  const [autoSave, setAutoSave] = useState(() => {
    const saved = localStorage.getItem('audienceEditor_autoSave');
    return saved === 'true';
  });

  // Persist auto-save preference
  useEffect(() => {
    localStorage.setItem('audienceEditor_autoSave', autoSave);
  }, [autoSave]);

  // Handle close with animation
  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      setEditingAudience(null);
    }, 200);
  };

  // Get sorted audiences for navigation (use filtered list if available)
  const sortedAudiences = useMemo(() => {
    const list = filteredAudiences || audiences;
    return [...list].sort((a, b) => (a.order || 0) - (b.order || 0));
  }, [filteredAudiences, audiences]);

  // Current index in navigation
  const currentIndex = useMemo(() => {
    return sortedAudiences.findIndex(a => a.id === editingAudience?.id);
  }, [sortedAudiences, editingAudience?.id]);

  const hasPrevious = currentIndex > 0;
  const hasNext = currentIndex < sortedAudiences.length - 1;

  // Navigate to previous/next audience
  const goToPrevious = () => {
    if (sortedAudiences.length === 0) return;
    const targetIndex = hasPrevious ? currentIndex - 1 : sortedAudiences.length - 1;
    setEditingAudience(sortedAudiences[targetIndex]);
  };

  const goToNext = () => {
    if (sortedAudiences.length === 0) return;
    const targetIndex = hasNext ? currentIndex + 1 : 0;
    setEditingAudience(sortedAudiences[targetIndex]);
  };

  // Auto-save effect
  useEffect(() => {
    if (!autoSave || !editingAudience) return;

    const timer = setTimeout(() => {
      const isNew = !audiences.find(a => a.id === editingAudience.id);
      if (!isNew) {
        updateAudience(editingAudience.id, editingAudience);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [editingAudience, autoSave, audiences, updateAudience]);

  // ESC key to close dialog
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && editingAudience) {
        handleClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [editingAudience]);

  if (!editingAudience) return null;

  // Get status color
  const statusColors = settings.getStatusColors();
  const currentStatus = (editingAudience.status || 'INCOMING').toUpperCase();
  const statusColor = statusColors[currentStatus] || statusColors['INCOMING'] || '#8B5CF6';

  const getTextColor = (hexColor) => {
    const hex = hexColor.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.6 ? '#000000' : '#ffffff';
  };
  const textColor = getTextColor(statusColor);

  // Helper to render input or dropdown based on keyword availability
  const renderField = (fieldName, placeholder = '') => {
    const keywordValues = keywords.audiences && keywords.audiences[fieldName];
    const value = editingAudience[fieldName] || '';

    if (keywordValues && keywordValues.length > 0) {
      return (
        <select
          value={value}
          onChange={(e) => setEditingAudience({ ...editingAudience, [fieldName]: e.target.value })}
          className="form-select"
        >
          <option value="">None</option>
          {keywordValues.map((val) => (
            <option key={val} value={val}>{val}</option>
          ))}
        </select>
      );
    } else {
      return (
        <input
          type="text"
          value={value}
          onChange={(e) => setEditingAudience({ ...editingAudience, [fieldName]: e.target.value })}
          className="form-input"
          placeholder={placeholder}
        />
      );
    }
  };

  const handleSave = () => {
    const isNew = !audiences.find(a => a.id === editingAudience.id);
    if (isNew) {
      addAudience(editingAudience);
    } else {
      updateAudience(editingAudience.id, editingAudience);
    }
  };

  const handleSaveAndClose = () => {
    handleSave();
    handleClose();
  };

  const handleDelete = () => {
    const hasMessages = messages.some(m => m.audience === editingAudience.key && m.status !== 'deleted');
    if (hasMessages) {
      alert('Cannot delete this audience because it has messages assigned to it. Please delete or move the messages first.');
      return;
    }
    if (confirm('Are you sure you want to delete this audience?')) {
      deleteAudience(editingAudience.id);
      handleClose();
    }
  };

  return createPortal(
    <div
      className={`dialog-overlay overlay-animated ${isClosing ? 'closing' : 'open'}`}
      onClick={handleClose}
    >
      <div
        className={`dialog dialog-animated ${isClosing ? 'closing' : 'open'}`}
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '900px' }}
      >
        <div className="dialog-layout">
          {/* LEFT SIDEBAR */}
          <div className="dialog-sidebar">
            <h2 className="dialog-title">Edit Audience</h2>

            {/* Navigation */}
            <div className="dialog-nav">
              <button
                onClick={goToPrevious}
                className="dialog-nav-btn"
                title="Previous audience"
              >
                <ChevronLeft size={16} />
              </button>
              <div
                className="dialog-nav-indicator"
                style={{
                  backgroundColor: statusColor,
                  color: textColor,
                  borderRadius: '6px',
                  fontWeight: 600,
                  paddingTop: '3px'
                }}
              >
                {editingAudience.id || ''}
              </div>
              <button
                onClick={goToNext}
                className="dialog-nav-btn"
                title="Next audience"
              >
                <ChevronRight size={16} />
              </button>
            </div>

            {/* Auto-Save Toggle */}
            <button
              className={`dialog-toggle ${autoSave ? 'checked' : ''}`}
              onClick={() => setAutoSave(!autoSave)}
            >
              <div className="checkbox-box">
                <Check size={14} />
              </div>
              <span>Auto-Save</span>
            </button>

            {/* Spacer to push actions to bottom */}
            <div style={{ flex: 1 }} />

            {/* Actions */}
            <div className="dialog-actions">
              <button onClick={handleDelete} className="link-button danger">
                <Trash2 size={16} />
                Delete
              </button>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={handleClose} className="btn btn-secondary btn-lg" style={{ flex: 1 }}>
                  Cancel
                </button>
                <button onClick={handleSave} className="btn btn-secondary btn-lg" style={{ flex: 1 }}>
                  Save
                </button>
              </div>
              <button onClick={handleSaveAndClose} className="btn btn-primary btn-lg">
                Save & Close
              </button>
            </div>
          </div>

          {/* CONTENT AREA */}
          <div className="dialog-content-area">
            <div className="dialog-main custom-scrollbar">
              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label">ID</label>
                  <input
                    type="text"
                    value={editingAudience.id || ''}
                    disabled
                    className="form-input"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Order</label>
                  <input
                    type="number"
                    value={editingAudience.order || ''}
                    onChange={(e) => setEditingAudience({ ...editingAudience, order: parseInt(e.target.value) || 0 })}
                    className="form-input"
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Name</label>
                <input
                  type="text"
                  value={editingAudience.name || ''}
                  onChange={(e) => setEditingAudience({ ...editingAudience, name: e.target.value })}
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Key</label>
                <input
                  type="text"
                  value={editingAudience.key || ''}
                  onChange={(e) => setEditingAudience({ ...editingAudience, key: e.target.value })}
                  className="form-input"
                />
              </div>

              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label">Status</label>
                  {(() => {
                    const keywordValues = keywords.audiences && keywords.audiences.status;
                    const statusOptions = keywordValues && keywordValues.length > 0
                      ? keywordValues
                      : ['INCOMING', 'NAMING', 'CONTENT', 'PREVIEW', 'APPROVED', 'ACTIVE', 'INACTIVE', 'ERROR'];

                    const currentColor = currentStatus ? (statusColors[currentStatus] || '#8B5CF6') : 'rgba(255,255,255,0.15)';

                    return (
                      <select
                        value={editingAudience.status || ''}
                        onChange={(e) => setEditingAudience({ ...editingAudience, status: e.target.value })}
                        className="form-select"
                        style={{
                          backgroundColor: currentColor,
                          borderColor: currentColor,
                          color: currentStatus ? getTextColor(currentColor) : 'var(--color-white)'
                        }}
                      >
                        <option value="" style={{ backgroundColor: 'var(--main-ui-color)', color: 'white' }}>None</option>
                        {statusOptions.map((val) => {
                          const optionColor = statusColors[val.toUpperCase()] || '#8B5CF6';
                          return (
                            <option key={val} value={val} style={{ backgroundColor: optionColor, color: getTextColor(optionColor) }}>
                              {val}
                            </option>
                          );
                        })}
                      </select>
                    );
                  })()}
                </div>

                <div className="form-group">
                  <label className="form-label">Product</label>
                  {renderField('product')}
                </div>
              </div>

              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label">Strategy</label>
                  {renderField('strategy')}
                </div>

                <div className="form-group">
                  <label className="form-label">Buying Platform</label>
                  {renderField('buying_platform')}
                </div>
              </div>

              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label">Data Source</label>
                  {renderField('data_source')}
                </div>

                <div className="form-group">
                  <label className="form-label">Targeting Type</label>
                  {renderField('targeting_type')}
                </div>
              </div>

              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label">Device</label>
                  {renderField('device')}
                </div>

                <div className="form-group">
                  <label className="form-label">Tag</label>
                  {renderField('tag', 'Category tag')}
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Comment</label>
                <textarea
                  value={editingAudience.comment || ''}
                  onChange={(e) => setEditingAudience({ ...editingAudience, comment: e.target.value })}
                  rows={3}
                  className="form-input"
                  placeholder="Internal notes..."
                />
              </div>

              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label">Campaign Name</label>
                  <input
                    type="text"
                    value={editingAudience.campaign_name || ''}
                    onChange={(e) => setEditingAudience({ ...editingAudience, campaign_name: e.target.value })}
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Campaign ID</label>
                  <input
                    type="text"
                    value={editingAudience.campaign_id || ''}
                    onChange={(e) => setEditingAudience({ ...editingAudience, campaign_id: e.target.value })}
                    className="form-input"
                  />
                </div>
              </div>

              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label">Line Item Name</label>
                  <input
                    type="text"
                    value={editingAudience.lineitem_name || ''}
                    onChange={(e) => setEditingAudience({ ...editingAudience, lineitem_name: e.target.value })}
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Line Item ID</label>
                  <input
                    type="text"
                    value={editingAudience.lineitem_id || ''}
                    onChange={(e) => setEditingAudience({ ...editingAudience, lineitem_id: e.target.value })}
                    className="form-input"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default AudienceEditorDialog;
