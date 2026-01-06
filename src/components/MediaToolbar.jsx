import React, { useState, useEffect, useRef } from 'react';
import { PocketKnife, GripHorizontal, Filter, ChevronDown, Check, LayoutGrid, List, CheckSquare, Square, X } from 'lucide-react';

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
  availableProducts = [],
  typeOptions = ['Dynamic HTML', 'Adobe generated'],
  availableSizes = [],
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
  // Color picker props
  bgColor,
  setBgColor,
  colorPresets = []
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

  // Refs
  const toolbarRef = useRef(null);
  const productDropdownRef = useRef(null);
  const typeDropdownRef = useRef(null);
  const sizeDropdownRef = useRef(null);
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

  // Toggle helpers
  const toggleProduct = (product) => {
    if (!setProductFilter) return;
    if (productFilter.includes(product)) {
      setProductFilter(productFilter.filter(p => p !== product));
    } else {
      setProductFilter([...productFilter, product]);
    }
  };

  const toggleType = (type) => {
    if (!setTypeFilter) return;
    if (typeFilter.includes(type)) {
      setTypeFilter(typeFilter.filter(t => t !== type));
    } else {
      setTypeFilter([...typeFilter, type]);
    }
  };

  const toggleSize = (size) => {
    if (!setSizeFilter) return;
    if (sizeFilter.includes(size)) {
      setSizeFilter(sizeFilter.filter(s => s !== size));
    } else {
      setSizeFilter([...sizeFilter, size]);
    }
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

          {/* Product Filter Dropdown */}
          {setProductFilter && availableProducts.length > 0 && (
            <div className="filter-group">
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
            </div>
          )}

          {/* Type Filter Dropdown */}
          {setTypeFilter && typeOptions.length > 0 && (
            <div className="filter-group">
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
            </div>
          )}

          {/* Size Filter Dropdown */}
          {setSizeFilter && availableSizes.length > 0 && (
            <div className="filter-group">
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
                <div className="flex gap-2">
                  {onShare && selectedCount > 0 && (
                    <button
                      onClick={onShare}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors text-sm"
                    >
                      Share Selected
                    </button>
                  )}
                  <button
                    onClick={onExitSelection}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-white/10 text-white rounded hover:bg-white/20 transition-colors text-sm"
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

        </div>
      </div>
    </>
  );
};

export default MediaToolbar;
