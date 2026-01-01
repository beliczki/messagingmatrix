import React, { useState, useEffect, useRef } from 'react';
import { PocketKnife, GripHorizontal, Filter, ChevronDown, Check, LayoutGrid, GitBranch, RefreshCw, Palette } from 'lucide-react';

/**
 * TaskToolbar - Floating draggable toolbar for Tasks
 * Uses same CSS classes as MediaToolbar (toolbar.css)
 */
const TaskToolbar = ({
  // Filter props
  filterText = '',
  setFilterText,
  workflowTypeFilter = 'all',
  setWorkflowTypeFilter,
  // Count props
  filteredCount = 0,
  totalCount = 0,
  // View mode props
  viewMode = 'kanban',
  setViewMode,
  // Fetch emails
  onFetchEmails,
  loading = false
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

  // Dropdown states
  const [workflowDropdownOpen, setWorkflowDropdownOpen] = useState(false);

  // Refs
  const toolbarRef = useRef(null);
  const workflowDropdownRef = useRef(null);
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
      if (workflowDropdownRef.current && !workflowDropdownRef.current.contains(e.target)) {
        setWorkflowDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

  const workflowTypes = [
    { id: 'all', name: 'All Tasks' },
    { id: 'general', name: 'General' },
    { id: 'creative', name: 'Creative Workflow' }
  ];

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
          {/* View Mode Selector - Kanban or Workflow */}
          {setViewMode && (
            <div className="view-modes">
              <button
                className={`view-mode-btn ${viewMode === 'kanban' ? 'active' : ''}`}
                onClick={() => setViewMode('kanban')}
                title="Kanban Board"
              >
                <LayoutGrid size={18} />
              </button>
              <button
                className={`view-mode-btn ${viewMode === 'workflow' ? 'active' : ''}`}
                onClick={() => setViewMode('workflow')}
                title="Workflow Flowchart"
              >
                <GitBranch size={18} />
              </button>
            </div>
          )}

          {/* Workflow Type Filter Dropdown */}
          {setWorkflowTypeFilter && (
            <div className="filter-group">
              <div className="filter-dropdown" ref={workflowDropdownRef}>
                <button
                  className="filter-pill"
                  onClick={() => setWorkflowDropdownOpen(!workflowDropdownOpen)}
                >
                  <Palette size={16} className="filter-pill-icon" />
                  <span className="filter-pill-text">
                    {workflowTypes.find(t => t.id === workflowTypeFilter)?.name || 'All Tasks'}
                  </span>
                  <ChevronDown size={16} className={`filter-pill-chevron ${workflowDropdownOpen ? 'open' : ''}`} />
                </button>
                {workflowDropdownOpen && (
                  <div className="filter-dropdown-menu">
                    {workflowTypes.map(type => (
                      <button
                        key={type.id}
                        className="filter-dropdown-item"
                        onClick={() => {
                          setWorkflowTypeFilter(type.id);
                          setWorkflowDropdownOpen(false);
                        }}
                      >
                        <Check size={16} className={workflowTypeFilter === type.id ? 'visible' : 'hidden'} />
                        <span>{type.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
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
                className="filter-pill"
                style={{ cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1 }}
              >
                <RefreshCw size={16} className={`filter-pill-icon ${loading ? 'animate-spin' : ''}`} />
                <span className="filter-pill-text">
                  {loading ? 'Fetching...' : 'Fetch Emails'}
                </span>
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default TaskToolbar;
