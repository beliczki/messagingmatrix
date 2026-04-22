import React, { useState, useEffect, useRef } from 'react';
import { PocketKnife, GripHorizontal, Filter, ChevronDown, Check, LayoutGrid, List, CheckSquare, Square, X, Image, Share2, Info } from 'lucide-react';

/**
 * MediaToolbar - Floating draggable toolbar for Creative Library
 * Uses same CSS classes as MatrixControlPanel (toolbar.css)
 */
const MediaToolbar = ({
  // Filter props
  filterText = '',
  setFilterText,
  productFilter = [],
  setProductFilter,
  typeFilter = [],
  setTypeFilter,
  sizeFilter = [],
  setSizeFilter,
  statusFilter = [],
  setStatusFilter,
  liveInAdFormFilter = [],
  setLiveInAdFormFilter,
  availableLiveStates = [],
  availableProducts = [],
  typeOptions = ['Dynamic HTML', 'Adobe generated'],
  availableSizes = [],
  availableStatuses = [],
  statusColors = {},
  // Count props
  filteredCount = 0,
  totalCount = 0,
  // View mode props
  viewMode = 'grid',
  setViewMode,
  // Selection props
  selectorMode = false,
  selectedCount = 0,
  onEnterSelectMode,
  onSelectAll,
  onDeselectAll,
  onExitSelection,
  onShare,
  onExportImages,
  // Color picker props
  bgColor,
  setBgColor,
  colorPresets = [],
  // Debug info
  debugInfo
}) => {
  // Load saved toolbar state from localStorage
  const [isOpen, setIsOpen] = useState(() => {
    try {
      const saved = localStorage.getItem('media_toolbar_isOpen');
      return saved ? JSON.parse(saved) : false;
    } catch { return false; }
  });

  // Toolbar position state (null = default CSS position)
  const [toolbarPosition, setToolbarPosition] = useState(() => {
    try {
      const saved = localStorage.getItem('media_toolbar_position');
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });

  // Dropdown states
  const [productDropdownOpen, setProductDropdownOpen] = useState(false);
  const [typeDropdownOpen, setTypeDropdownOpen] = useState(false);
  const [sizeDropdownOpen, setSizeDropdownOpen] = useState(false);
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const [liveDropdownOpen, setLiveDropdownOpen] = useState(false);
  const [debugOpen, setDebugOpen] = useState(false);

  // Refs
  const toolbarRef = useRef(null);
  const productDropdownRef = useRef(null);
  const typeDropdownRef = useRef(null);
  const sizeDropdownRef = useRef(null);
  const statusDropdownRef = useRef(null);
  const liveDropdownRef = useRef(null);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0, toolbarX: 0, toolbarY: 0 });

  // Save isOpen state to localStorage
  useEffect(() => {
    localStorage.setItem('media_toolbar_isOpen', JSON.stringify(isOpen));
  }, [isOpen]);

  // Save position to localStorage
  useEffect(() => {
    if (toolbarPosition) {
      localStorage.setItem('media_toolbar_position', JSON.stringify(toolbarPosition));
    }
  }, [toolbarPosition]);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (productDropdownRef.current && !productDropdownRef.current.contains(e.target)) {
        setProductDropdownOpen(false);
      }
      if (typeDropdownRef.current && !typeDropdownRef.current.contains(e.target)) {
        setTypeDropdownOpen(false);
      }
      if (sizeDropdownRef.current && !sizeDropdownRef.current.contains(e.target)) {
        setSizeDropdownOpen(false);
      }
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(e.target)) {
        setStatusDropdownOpen(false);
      }
      if (liveDropdownRef.current && !liveDropdownRef.current.contains(e.target)) {
        setLiveDropdownOpen(false);
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

  // Toggle helpers - use functional updaters to prevent stale closure bugs
  const toggleProduct = (product) => {
    if (!setProductFilter) return;
    setProductFilter(prev =>
      prev.includes(product) ? prev.filter(p => p !== product) : [...prev, product]
    );
  };

  const toggleType = (type) => {
    if (!setTypeFilter) return;
    setTypeFilter(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  const toggleSize = (size) => {
    if (!setSizeFilter) return;
    setSizeFilter(prev =>
      prev.includes(size) ? prev.filter(s => s !== size) : [...prev, size]
    );
  };

  const toggleStatus = (status) => {
    if (!setStatusFilter) return;
    setStatusFilter(prev =>
      prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status]
    );
  };

  const toggleLive = (state) => {
    if (!setLiveInAdFormFilter) return;
    setLiveInAdFormFilter(prev =>
      prev.includes(state) ? prev.filter(s => s !== state) : [...prev, state]
    );
  };

  const getTextColor = (bgColor) => {
    if (!bgColor) return '#000000';
    const hex = bgColor.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5 ? '#000000' : '#ffffff';
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
          {/* View Mode Selector - Grid or List */}
          {setViewMode && (
            <div className="view-modes">
              <button
                className={`view-mode-btn ${viewMode === 'grid' ? 'active' : ''}`}
                onClick={() => setViewMode('grid')}
                title="Grid View"
              >
                <LayoutGrid size={18} />
              </button>
              <button
                className={`view-mode-btn ${viewMode === 'list' ? 'active' : ''}`}
                onClick={() => setViewMode('list')}
                title="List View"
              >
                <List size={18} />
              </button>
            </div>
          )}

          {/* Filter Dropdowns - grouped like Matrix toolbar */}
          <div className="filter-group">
            {/* Product Filter Dropdown */}
            {setProductFilter && availableProducts.length > 0 && (
              <div className="filter-dropdown" ref={productDropdownRef}>
                <button
                  className="filter-pill"
                  onClick={() => setProductDropdownOpen(!productDropdownOpen)}
                >
                  <Filter size={16} className="filter-pill-icon" />
                  <span className="filter-pill-text">Products</span>
                  <ChevronDown size={16} className={`filter-pill-chevron ${productDropdownOpen ? 'open' : ''}`} />
                  <span className="filter-pill-badge">
                    {productFilter.length === 0 ? availableProducts.length : productFilter.length}
                  </span>
                </button>
                {productDropdownOpen && (
                  <div className="filter-dropdown-menu">
                    {availableProducts.map(product => (
                      <button
                        key={product}
                        className="filter-dropdown-item"
                        onClick={() => toggleProduct(product)}
                      >
                        <Check size={16} className={productFilter.includes(product) ? 'visible' : 'hidden'} />
                        <span>{product}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Type Filter Dropdown */}
            {setTypeFilter && typeOptions.length > 0 && (
              <div className="filter-dropdown" ref={typeDropdownRef}>
                <button
                  className="filter-pill"
                  onClick={() => setTypeDropdownOpen(!typeDropdownOpen)}
                >
                  <Filter size={16} className="filter-pill-icon" />
                  <span className="filter-pill-text">Type</span>
                  <ChevronDown size={16} className={`filter-pill-chevron ${typeDropdownOpen ? 'open' : ''}`} />
                  <span className="filter-pill-badge">
                    {typeFilter.length === 0 ? typeOptions.length : typeFilter.length}
                  </span>
                </button>
                {typeDropdownOpen && (
                  <div className="filter-dropdown-menu">
                    {typeOptions.map(type => (
                      <button
                        key={type}
                        className="filter-dropdown-item"
                        onClick={() => toggleType(type)}
                      >
                        <Check size={16} className={typeFilter.includes(type) ? 'visible' : 'hidden'} />
                        <span>{type}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Status Filter Dropdown */}
            {setStatusFilter && availableStatuses.length > 0 && (
              <div className="filter-dropdown" ref={statusDropdownRef}>
                <button
                  className="filter-pill"
                  onClick={() => setStatusDropdownOpen(!statusDropdownOpen)}
                >
                  <Filter size={16} className="filter-pill-icon" />
                  <span className="filter-pill-text">Status</span>
                  <ChevronDown size={16} className={`filter-pill-chevron ${statusDropdownOpen ? 'open' : ''}`} />
                  <span className={`filter-pill-badge ${statusFilter.length === 0 ? 'zero' : ''}`}>
                    {statusFilter.length}
                  </span>
                </button>
                {statusDropdownOpen && (
                  <div className="filter-dropdown-menu">
                    {availableStatuses.map(status => {
                      const bgColor = statusColors[status.toUpperCase()] || '#cccccc';
                      const textColor = getTextColor(bgColor);
                      return (
                        <button
                          key={status}
                          className="filter-dropdown-item"
                          onClick={() => toggleStatus(status)}
                        >
                          <Check size={16} className={statusFilter.includes(status) ? 'visible' : 'hidden'} />
                          <span
                            className="status-chip"
                            style={{ backgroundColor: bgColor, color: textColor }}
                          >
                            {status}
                          </span>
                        </button>
                      );
                    })}
                    {availableStatuses.length === 0 && (
                      <div className="filter-dropdown-empty">No statuses available</div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Live-in-AdForm Filter Dropdown */}
            {setLiveInAdFormFilter && availableLiveStates.length > 0 && (
              <div className="filter-dropdown" ref={liveDropdownRef}>
                <button
                  className="filter-pill"
                  onClick={() => setLiveDropdownOpen(!liveDropdownOpen)}
                >
                  <Filter size={16} className="filter-pill-icon" />
                  <span className="filter-pill-text">AdForm</span>
                  <ChevronDown size={16} className={`filter-pill-chevron ${liveDropdownOpen ? 'open' : ''}`} />
                  <span className={`filter-pill-badge ${liveInAdFormFilter.length === 0 ? 'zero' : ''}`}>
                    {liveInAdFormFilter.length}
                  </span>
                </button>
                {liveDropdownOpen && (
                  <div className="filter-dropdown-menu">
                    {availableLiveStates.map(state => (
                      <button
                        key={state}
                        className="filter-dropdown-item"
                        onClick={() => toggleLive(state)}
                      >
                        <Check size={16} className={liveInAdFormFilter.includes(state) ? 'visible' : 'hidden'} />
                        <span
                          className="status-chip"
                          style={{
                            backgroundColor: state === 'live' ? '#16a34a' : '#9ca3af',
                            color: '#ffffff'
                          }}
                        >
                          {state}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Size Filter Dropdown */}
            {setSizeFilter && availableSizes.length > 0 && (
              <div className="filter-dropdown" ref={sizeDropdownRef}>
                <button
                  className="filter-pill"
                  onClick={() => setSizeDropdownOpen(!sizeDropdownOpen)}
                >
                  <Filter size={16} className="filter-pill-icon" />
                  <span className="filter-pill-text">Size</span>
                  <ChevronDown size={16} className={`filter-pill-chevron ${sizeDropdownOpen ? 'open' : ''}`} />
                  <span className="filter-pill-badge">
                    {sizeFilter.length === 0 ? availableSizes.length : sizeFilter.length}
                  </span>
                </button>
                {sizeDropdownOpen && (
                  <div className="filter-dropdown-menu">
                    {availableSizes.map(size => (
                      <button
                        key={size}
                        className="filter-dropdown-item"
                        onClick={() => toggleSize(size)}
                      >
                        <Check size={16} className={sizeFilter.includes(size) ? 'visible' : 'hidden'} />
                        <span>{size}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Text Filter */}
          {setFilterText && (
            <div className="filter-group">
              <div className="filter-pill">
                <Filter size={16} className="filter-pill-icon" />
                <input
                  type="text"
                  className="filter-input"
                  placeholder="Filter creatives..."
                  value={filterText}
                  onChange={(e) => setFilterText(e.target.value)}
                />
                <span className={`filter-pill-badge ${filteredCount === 0 ? 'zero' : ''}`}>
                  {filteredCount}/{totalCount}
                </span>
              </div>
            </div>
          )}

          {/* Selection Controls */}
          {(onEnterSelectMode || onSelectAll || onDeselectAll) && (
            <div className="flex flex-col gap-2 mt-4 pt-4 border-t border-white/20">
              {!selectorMode ? (
                <button
                  onClick={onEnterSelectMode}
                  className="flex items-center justify-center gap-2 px-3 py-2 bg-white/10 text-white rounded hover:bg-white/20 transition-colors text-sm"
                >
                  <CheckSquare size={16} />
                  <span>Enter Select Mode</span>
                </button>
              ) : (
                <>
                  <div className="text-white/80 text-sm text-center">
                    {selectedCount} selected
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={onSelectAll}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-white/10 text-white rounded hover:bg-white/20 transition-colors text-sm"
                    >
                      <CheckSquare size={16} />
                      <span>Select All</span>
                    </button>
                    <button
                      onClick={onDeselectAll}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-white/10 text-white rounded hover:bg-white/20 transition-colors text-sm"
                    >
                      <Square size={16} />
                      <span>Deselect</span>
                    </button>
                  </div>
                </>
              )}
              {selectorMode && (
                <div className="flex flex-col gap-2">
                  {onShare && selectedCount > 0 && (
                    <button
                      onClick={onShare}
                      className="flex items-center justify-center gap-2 px-3 py-2 border border-white text-white rounded hover:bg-white/20 transition-colors text-sm"
                    >
                      <Share2 size={16} />
                      Share Selected
                    </button>
                  )}
                  {onExportImages && selectedCount > 0 && (
                    <button
                      onClick={onExportImages}
                      className="flex items-center justify-center gap-2 px-3 py-2 border border-white text-white rounded hover:bg-white/20 transition-colors text-sm"
                    >
                      <Image size={16} />
                      Export Images
                    </button>
                  )}
                  <button
                    onClick={onExitSelection}
                    className="flex items-center justify-center gap-2 px-3 py-2 bg-white/10 text-white rounded hover:bg-white/20 transition-colors text-sm"
                  >
                    <X size={16} />
                    <span>Cancel</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Background Color Picker */}
          {setBgColor && (
            <div className="mt-4 pt-4 border-t border-white/20">
              <div className="text-white/80 text-sm mb-2">Background Color</div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setBgColor('#e5e5e5')}
                  className={`h-8 w-8 rounded-full border-2 transition-transform hover:scale-110 ${bgColor?.toLowerCase() === '#e5e5e5' ? 'border-white ring-2 ring-white/50' : 'border-white/30'}`}
                  style={{ backgroundColor: '#e5e5e5' }}
                  title="Light Gray"
                />
                <button
                  onClick={() => setBgColor('#1a1a1a')}
                  className={`h-8 w-8 rounded-full border-2 transition-transform hover:scale-110 ${bgColor?.toLowerCase() === '#1a1a1a' ? 'border-white ring-2 ring-white/50' : 'border-white/30'}`}
                  style={{ backgroundColor: '#1a1a1a' }}
                  title="Black"
                />
                {colorPresets.map((color, index) => (
                  <button
                    key={index}
                    onClick={() => setBgColor(color)}
                    className={`h-8 w-8 rounded-full border-2 transition-transform hover:scale-110 ${bgColor?.toLowerCase() === color?.toLowerCase() ? 'border-white ring-2 ring-white/50' : 'border-white/30'}`}
                    style={{ backgroundColor: color }}
                    title={index === 0 ? 'Header Color' : `Secondary ${index}`}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Virtual Scrolling Info (collapsible) */}
          {debugInfo && (
            <div className="mt-4 pt-4 border-t border-white/20">
              <button
                onClick={() => setDebugOpen(prev => !prev)}
                className="flex items-center gap-2 text-white/60 hover:text-white/80 transition-colors text-xs w-full"
              >
                <Info size={14} />
                <span>Virtual Scrolling</span>
                <ChevronDown size={14} className={`ml-auto transition-transform ${debugOpen ? 'rotate-180' : ''}`} />
              </button>
              {debugOpen && (
                <div className="mt-2 text-white/70 text-xs whitespace-pre-line">
                  {debugInfo}
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </>
  );
};

export default MediaToolbar;
