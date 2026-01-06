import React, { useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, Trash2, Check } from 'lucide-react';
import settings from '../services/settings';
import { generateTopicKey } from '../utils/patternEvaluator';

const TopicEditorDialog = ({
  editingTopic,
  setEditingTopic,
  topics,
  filteredTopics,
  updateTopic,
  deleteTopic,
  addTopic,
  keywords,
  messages
}) => {
  const [isClosing, setIsClosing] = useState(false);
  const [autoSave, setAutoSave] = useState(() => {
    const saved = localStorage.getItem('topicEditor_autoSave');
    return saved === 'true';
  });

  // Persist auto-save preference
  useEffect(() => {
    localStorage.setItem('topicEditor_autoSave', autoSave);
  }, [autoSave]);

  // Helper function to generate key based on pattern
  const updateTopicKey = (updatedTopic) => {
    const topicKeyPattern = settings.getPattern('topicKey');
    const generatedKey = generateTopicKey(updatedTopic, topicKeyPattern);
    return { ...updatedTopic, key: generatedKey };
  };

  // Handle close with animation
  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      setEditingTopic(null);
    }, 200);
  };

  // Get sorted topics for navigation (use filtered list if available)
  const sortedTopics = useMemo(() => {
    const list = filteredTopics || topics;
    return [...list].sort((a, b) => (a.order || 0) - (b.order || 0));
  }, [filteredTopics, topics]);

  // Current index in navigation
  const currentIndex = useMemo(() => {
    return sortedTopics.findIndex(t => t.id === editingTopic?.id);
  }, [sortedTopics, editingTopic?.id]);

  const hasPrevious = currentIndex > 0;
  const hasNext = currentIndex < sortedTopics.length - 1;

  // Navigate to previous/next topic
  const goToPrevious = () => {
    if (sortedTopics.length === 0) return;
    const targetIndex = hasPrevious ? currentIndex - 1 : sortedTopics.length - 1;
    setEditingTopic(sortedTopics[targetIndex]);
  };

  const goToNext = () => {
    if (sortedTopics.length === 0) return;
    const targetIndex = hasNext ? currentIndex + 1 : 0;
    setEditingTopic(sortedTopics[targetIndex]);
  };

  // Auto-save effect
  useEffect(() => {
    if (!autoSave || !editingTopic) return;

    const timer = setTimeout(() => {
      const isNew = !topics.find(t => t.id === editingTopic.id);
      if (!isNew) {
        updateTopic(editingTopic.id, editingTopic);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [editingTopic, autoSave, topics, updateTopic]);

  // Auto-generate key when dialog opens
  useEffect(() => {
    if (editingTopic) {
      const updatedTopic = updateTopicKey(editingTopic);
      if (updatedTopic.key !== editingTopic.key) {
        setEditingTopic(updatedTopic);
      }
    }
  }, [editingTopic?.id]);

  // Auto-regenerate key when relevant fields change
  useEffect(() => {
    if (editingTopic) {
      const updatedTopic = updateTopicKey(editingTopic);
      if (updatedTopic.key !== editingTopic.key) {
        setEditingTopic(updatedTopic);
      }
    }
  }, [editingTopic?.tag1, editingTopic?.tag2, editingTopic?.tag3, editingTopic?.tag4, editingTopic?.product]);

  // ESC key to close dialog
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && editingTopic) {
        handleClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [editingTopic]);

  if (!editingTopic) return null;

  // Get status color
  const statusColors = settings.getStatusColors();
  const currentStatus = (editingTopic.status || 'INCOMING').toUpperCase();
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

  const handleSave = () => {
    const isNew = !topics.find(t => t.id === editingTopic.id);
    if (isNew) {
      addTopic(editingTopic);
    } else {
      updateTopic(editingTopic.id, editingTopic);
    }
  };

  const handleSaveAndClose = () => {
    handleSave();
    handleClose();
  };

  const handleDelete = () => {
    const hasMessages = messages.some(m => m.topic === editingTopic.key && m.status !== 'deleted');
    if (hasMessages) {
      alert('Cannot delete this topic because it has messages assigned to it. Please delete or move the messages first.');
      return;
    }
    if (confirm('Are you sure you want to delete this topic?')) {
      deleteTopic(editingTopic.id);
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
            <h2 className="dialog-title">Edit Topic</h2>

            {/* Navigation */}
            <div className="dialog-nav">
              <button
                onClick={goToPrevious}
                className="dialog-nav-btn"
                title="Previous topic"
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
                {editingTopic.id || ''}
              </div>
              <button
                onClick={goToNext}
                className="dialog-nav-btn"
                title="Next topic"
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
                    value={editingTopic.id || ''}
                    disabled
                    className="form-input"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Order</label>
                  <input
                    type="number"
                    value={editingTopic.order || ''}
                    onChange={(e) => setEditingTopic({ ...editingTopic, order: parseInt(e.target.value) || 0 })}
                    className="form-input"
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Name</label>
                <input
                  type="text"
                  value={editingTopic.name || ''}
                  onChange={(e) => setEditingTopic({ ...editingTopic, name: e.target.value })}
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label className="form-label">
                  Key <span style={{ fontSize: '0.75rem', opacity: 0.6 }}>(auto-generated)</span>
                </label>
                <input
                  type="text"
                  value={editingTopic.key || ''}
                  disabled
                  className="form-input"
                />
              </div>

              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label">Status</label>
                  {(() => {
                    const keywordValues = keywords.topics && keywords.topics.status;
                    const statusOptions = keywordValues && keywordValues.length > 0
                      ? keywordValues
                      : ['INCOMING', 'NAMING', 'CONTENT', 'PREVIEW', 'APPROVED', 'ACTIVE', 'INACTIVE', 'ERROR'];

                    const currentColor = currentStatus ? (statusColors[currentStatus] || '#8B5CF6') : 'rgba(255,255,255,0.15)';

                    return (
                      <select
                        value={editingTopic.status || ''}
                        onChange={(e) => setEditingTopic({ ...editingTopic, status: e.target.value })}
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
                  <select
                    value={editingTopic.product || ''}
                    onChange={(e) => {
                      const updatedTopic = { ...editingTopic, product: e.target.value };
                      setEditingTopic(updateTopicKey(updatedTopic));
                    }}
                    className="form-select"
                  >
                    <option value="">None</option>
                    {((keywords.topics && keywords.topics.product) || []).map((value) => (
                      <option key={value} value={value}>{value}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-grid-4">
                <div className="form-group">
                  <label className="form-label">Tag 1</label>
                  <select
                    value={editingTopic.tag1 || ''}
                    onChange={(e) => {
                      const updatedTopic = { ...editingTopic, tag1: e.target.value };
                      setEditingTopic(updateTopicKey(updatedTopic));
                    }}
                    className="form-select"
                  >
                    <option value="">None</option>
                    {((keywords.topics && keywords.topics.tag1) || []).map((value) => (
                      <option key={value} value={value}>{value}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Tag 2</label>
                  <select
                    value={editingTopic.tag2 || ''}
                    onChange={(e) => {
                      const updatedTopic = { ...editingTopic, tag2: e.target.value };
                      setEditingTopic(updateTopicKey(updatedTopic));
                    }}
                    className="form-select"
                  >
                    <option value="">None</option>
                    {((keywords.topics && keywords.topics.tag2) || []).map((value) => (
                      <option key={value} value={value}>{value}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Tag 3</label>
                  <select
                    value={editingTopic.tag3 || ''}
                    onChange={(e) => {
                      const updatedTopic = { ...editingTopic, tag3: e.target.value };
                      setEditingTopic(updateTopicKey(updatedTopic));
                    }}
                    className="form-select"
                  >
                    <option value="">None</option>
                    {((keywords.topics && keywords.topics.tag3) || []).map((value) => (
                      <option key={value} value={value}>{value}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Tag 4</label>
                  <input
                    type="text"
                    value={editingTopic.tag4 || ''}
                    onChange={(e) => {
                      const updatedTopic = { ...editingTopic, tag4: e.target.value };
                      setEditingTopic(updateTopicKey(updatedTopic));
                    }}
                    className="form-input"
                    placeholder="Enter tag 4"
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Created</label>
                <input
                  type="date"
                  value={editingTopic.created || ''}
                  onChange={(e) => setEditingTopic({ ...editingTopic, created: e.target.value })}
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Comment</label>
                <textarea
                  value={editingTopic.comment || ''}
                  onChange={(e) => setEditingTopic({ ...editingTopic, comment: e.target.value })}
                  rows={3}
                  className="form-input"
                  placeholder="Internal notes..."
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default TopicEditorDialog;
