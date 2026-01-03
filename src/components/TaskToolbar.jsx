import React, { useState, useEffect, useRef } from 'react';
import { PocketKnife, GripHorizontal, Filter, RefreshCw, X, ChevronDown, Check, Tag } from 'lucide-react';

/**
 * TaskToolbar - Floating draggable toolbar for Tasks
 * Uses same CSS classes as MediaToolbar (toolbar.css)
 */
const TaskToolbar = ({
  // Filter props
  filterText = '',
  setFilterText,
  // Label filter props
  labelFilter = [],
  setLabelFilter,
  availableLabels = [],
  // Count props
  filteredCount = 0,
  totalCount = 0,
  // Fetch emails
  onFetchEmails,
  loading = false,
  // Feedback message (shown under Fetch button)
  feedbackMessage = null,
  clearFeedback
}) => {
  // Load saved toolbar state from localStorage
  const [isOpen, setIsOpen] = useState(() => {
    try {
      const saved = localStorage.getItem('task_toolbar_isOpen');
      return saved ? JSON.parse(saved) : false;
    } catch { return false; }
  });

  // Toolbar position state (null = default CSS position)
  const [toolbarPosition, setToolbarPosition] = useState(() => {
    try {
      const saved = localStorage.getItem('task_toolbar_position');
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });

  // Dropdown state
  const [labelDropdownOpen, setLabelDropdownOpen] = useState(false);

  // Refs
  const toolbarRef = useRef(null);
  const labelDropdownRef = useRef(null);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0, toolbarX: 0, toolbarY: 0 });

  // Save isOpen state to localStorage
  useEffect(() => {
    localStorage.setItem('task_toolbar_isOpen', JSON.stringify(isOpen));
  }, [isOpen]);

  // Save position to localStorage
  useEffect(() => {
    if (toolbarPosition) {
      localStorage.setItem('task_toolbar_position', JSON.stringify(toolbarPosition));
    }
  }, [toolbarPosition]);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (labelDropdownRef.current && !labelDropdownRef.current.contains(e.target)) {
        setLabelDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Toggle label filter
  const toggleLabel = (label) => {
    if (!setLabelFilter) return;
    if (labelFilter.includes(label)) {
      setLabelFilter(labelFilter.filter(l => l !== label));
    } else {
      setLabelFilter([...labelFilter, label]);
    }
  };

  // Get color for label badge (same as Tasks.jsx)
  const getLabelColor = (label) => {
    const colors = [
      'bg-blue-100 text-blue-700 border-blue-300',
      'bg-purple-100 text-purple-700 border-purple-300',
      'bg-green-100 text-green-700 border-green-300',
      'bg-orange-100 text-orange-700 border-orange-300',
      'bg-pink-100 text-pink-700 border-pink-300',
      'bg-indigo-100 text-indigo-700 border-indigo-300',
      'bg-teal-100 text-teal-700 border-teal-300'
    ];
    const hash = label.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
  };

  // Select all labels
  const selectAllLabels = () => {
    if (setLabelFilter) {
      setLabelFilter([...availableLabels]);
    }
  };

  // Deselect all labels
  const deselectAllLabels = () => {
    if (setLabelFilter) {
      setLabelFilter([]);
    }
  };

  // Drag handlers
  const handleDragStart = (e) => {
    if (e.target.closest('.filter-dropdown-menu')) return;
    isDraggingRef.current = true;
    const toolbar = toolbarRef.current;
    if (!toolbar) return;

    const rect = toolbar.getBoundingClientRect();
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      toolbarX: rect.left,
      toolbarY: rect.top
    };

    document.addEventListener('mousemove', handleDragMove);
    document.addEventListener('mouseup', handleDragEnd);
    e.preventDefault();
  };

  const handleDragMove = (e) => {
    if (!isDraggingRef.current) return;

    const deltaX = e.clientX - dragStartRef.current.x;
    const deltaY = e.clientY - dragStartRef.current.y;

    const newX = dragStartRef.current.toolbarX + deltaX;
    const newY = dragStartRef.current.toolbarY + deltaY;

    const toolbar = toolbarRef.current;
    if (!toolbar) return;
    const rect = toolbar.getBoundingClientRect();
    const maxY = window.innerHeight - rect.height - 10;

    const rightOffset = window.innerWidth - newX - rect.width;

    setToolbarPosition({
      right: Math.max(10, rightOffset),
      y: Math.max(10, Math.min(newY, maxY))
    });
  };

  const handleDragEnd = () => {
    isDraggingRef.current = false;
    document.removeEventListener('mousemove', handleDragMove);
    document.removeEventListener('mouseup', handleDragEnd);
  };

  return (
    <>
      {/* Toggle Button */}
      <button
        className="toolbar-toggle"
        onClick={() => setIsOpen(!isOpen)}
        title={isOpen ? 'Close toolbar' : 'Open toolbar'}
      >
        <PocketKnife size={24} />
      </button>

      {/* Toolbar Panel */}
      <div
        ref={toolbarRef}
        className={`toolbar ${isOpen ? 'open' : ''}`}
        style={toolbarPosition ? {
          top: toolbarPosition.y,
          right: toolbarPosition.right
        } : undefined}
      >
        {/* Drag Handle */}
        <div
          className="toolbar-drag-row"
          onMouseDown={handleDragStart}
        >
          <GripHorizontal size={20} />
        </div>

        {/* Content */}
        <div className="toolbar-content">
          {/* Label Filter Combo Box */}
          {setLabelFilter && availableLabels.length > 0 && (
            <div className="filter-group" ref={labelDropdownRef} style={{ position: 'relative' }}>
              {/* Combo Box Trigger */}
              <div
                onClick={() => setLabelDropdownOpen(!labelDropdownOpen)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 12px',
                  background: 'var(--white-10)',
                  border: '1px solid var(--white-20)',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  minWidth: '160px'
                }}
              >
                <Tag size={14} style={{ color: 'var(--white-50)', flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: '12px', color: 'var(--white-50)' }}>
                  Labels
                </span>
                <ChevronDown size={14} style={{ color: 'var(--white-50)', flexShrink: 0, transform: labelDropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                <span style={{
                  padding: '2px 8px',
                  fontSize: '11px',
                  fontWeight: 600,
                  borderRadius: '10px',
                  background: labelFilter.length > 0 ? 'white' : 'var(--white-20)',
                  color: labelFilter.length > 0 ? 'var(--toolbar-color)' : 'var(--white-70)'
                }}>
                  {labelFilter.length || availableLabels.length}
                </span>
              </div>

              {/* Dropdown Menu */}
              {labelDropdownOpen && (
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    marginTop: '4px',
                    background: 'color-mix(in srgb, var(--toolbar-color) 95%, black)',
                    border: '1px solid var(--white-20)',
                    borderRadius: '8px',
                    boxShadow: 'var(--ui-shadow)',
                    zIndex: 100,
                    maxHeight: '250px',
                    display: 'flex',
                    flexDirection: 'column'
                  }}
                >
                  {/* Header with Select All / Deselect All */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 10px',
                    borderBottom: '1px solid var(--white-15)',
                    fontSize: '10px',
                    color: 'var(--white-60)'
                  }}>
                    <span>{availableLabels.length} labels • {labelFilter.length} selected</span>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          selectAllLabels();
                        }}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          padding: '2px 6px',
                          fontSize: '10px',
                          color: 'var(--white-70)',
                          cursor: 'pointer',
                          borderRadius: '4px'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--white-15)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                      >
                        All
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deselectAllLabels();
                        }}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          padding: '2px 6px',
                          fontSize: '10px',
                          color: 'var(--white-70)',
                          cursor: 'pointer',
                          borderRadius: '4px'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--white-15)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                      >
                        None
                      </button>
                    </div>
                  </div>

                  {/* Labels List */}
                  <div style={{ overflowY: 'auto', flex: 1, padding: '4px' }} className="custom-scrollbar">
                    {availableLabels.map(label => (
                      <div
                        key={label}
                        onClick={() => toggleLabel(label)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '6px 8px',
                          cursor: 'pointer',
                          borderRadius: '6px',
                          background: labelFilter.includes(label) ? 'var(--white-10)' : 'transparent'
                        }}
                        onMouseEnter={(e) => { if (!labelFilter.includes(label)) e.currentTarget.style.background = 'var(--white-05)'; }}
                        onMouseLeave={(e) => { if (!labelFilter.includes(label)) e.currentTarget.style.background = 'transparent'; }}
                      >
                        <div style={{
                          width: '16px',
                          height: '16px',
                          borderRadius: '4px',
                          border: labelFilter.includes(label) ? 'none' : '1px solid var(--white-30)',
                          background: labelFilter.includes(label) ? 'white' : 'transparent',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}>
                          {labelFilter.includes(label) && <Check size={12} style={{ color: 'var(--toolbar-color)' }} />}
                        </div>
                        <span className={`px-1.5 py-0.5 text-xs font-medium rounded whitespace-nowrap ${getLabelColor(label)}`}>
                          {label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Text Filter */}
          {setFilterText && (
            <div className="filter-group">
              <div className="filter-pill">
                <Filter size={16} className="filter-pill-icon" />
                <input
                  type="text"
                  className="filter-input"
                  placeholder="Filter tasks..."
                  value={filterText}
                  onChange={(e) => setFilterText(e.target.value)}
                />
                <span className={`filter-pill-badge ${filteredCount === 0 ? 'zero' : ''}`}>
                  {filteredCount}/{totalCount}
                </span>
              </div>
            </div>
          )}

          {/* Fetch Emails Button */}
          {onFetchEmails && (
            <div className="filter-group">
              <button
                onClick={onFetchEmails}
                disabled={loading}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 14px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.6 : 1,
                  border: 'none',
                  background: 'white',
                  color: 'var(--toolbar-color)',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: 600
                }}
              >
                <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                <span>
                  {loading ? 'Fetching...' : 'Fetch Emails'}
                </span>
              </button>
            </div>
          )}

          {/* Feedback Message */}
          {feedbackMessage && (
            <div
              className="filter-group"
              style={{
                padding: '8px 12px',
                background: feedbackMessage.type === 'error' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(34, 197, 94, 0.15)',
                border: `1px solid ${feedbackMessage.type === 'error' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(34, 197, 94, 0.3)'}`,
                borderRadius: '8px',
                fontSize: '12px',
                color: feedbackMessage.type === 'error' ? '#fca5a5' : '#86efac',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                maxWidth: '200px'
              }}
            >
              <span style={{ flex: 1 }}>{feedbackMessage.text}</span>
              {clearFeedback && (
                <button
                  onClick={clearFeedback}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    padding: '2px',
                    cursor: 'pointer',
                    color: 'inherit',
                    opacity: 0.7,
                    display: 'flex'
                  }}
                >
                  <X size={14} />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default TaskToolbar;
