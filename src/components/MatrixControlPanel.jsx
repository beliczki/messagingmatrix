import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Filter, Minus, Plus, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Square, GripHorizontal, List, PocketKnife, Check, ChevronDown, X, Info, Upload } from 'lucide-react';

// Grid 2x2 (informative view)
const Grid2x2Icon = ({ size = 18 }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="18" height="18" x="3" y="3" rx="2"/>
    <path d="M3 12h18"/>
    <path d="M12 3v18"/>
  </svg>
);

// Grid 3x3 (minimal view)
const Grid3x3Icon = ({ size = 18 }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="18" height="18" x="3" y="3" rx="2"/>
    <path d="M3 9h18"/>
    <path d="M3 15h18"/>
    <path d="M9 3v18"/>
    <path d="M15 3v18"/>
  </svg>
);

// Vertical tree (network icon)
const NetworkIcon = ({ size = 18 }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="16" y="16" width="6" height="6" rx="1"/>
    <rect x="2" y="16" width="6" height="6" rx="1"/>
    <rect x="9" y="2" width="6" height="6" rx="1"/>
    <path d="M5 16v-3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3"/>
    <path d="M12 12V8"/>
  </svg>
);

// Horizontal tree (rotated network icon - root on left)
const NetworkHorizontalIcon = ({ size = 18 }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: 'rotate(-90deg)' }}>
    <rect x="16" y="16" width="6" height="6" rx="1"/>
    <rect x="2" y="16" width="6" height="6" rx="1"/>
    <rect x="9" y="2" width="6" height="6" rx="1"/>
    <path d="M5 16v-3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3"/>
    <path d="M12 12V8"/>
  </svg>
);

// Sankey view
const LayoutPanelTopIcon = ({ size = 18 }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="18" height="7" x="3" y="3" rx="1"/>
    <rect width="7" height="7" x="3" y="14" rx="1"/>
    <rect width="7" height="7" x="14" y="14" rx="1"/>
  </svg>
);

// Circular sankey view (diameter icon)
const DiameterIcon = ({ size = 18 }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="19" cy="19" r="2"/>
    <circle cx="5" cy="5" r="2"/>
    <path d="M6.48 3.66a10 10 0 0 1 13.86 13.86"/>
    <path d="m6.41 6.41 11.18 11.18"/>
    <path d="M3.66 6.48a10 10 0 0 0 13.86 13.86"/>
  </svg>
);

const MatrixControlPanel = ({
  viewMode,
  displayMode,
  matrixZoom,
  treeZoom,
  treeConnectorType,
  treeFlattenMode,
  lookAndFeel,
  onViewModeChange,
  onDisplayModeChange,
  onMatrixZoomChange,
  onMatrixFit,
  onTreeZoomChange,
  onTreeConnectorTypeChange,
  onTreeFlattenModeChange,
  tree2Ref,
  sankeyRef,
  tree2Zoom = 0.5,
  sankeyZoom = 0.5,
  // Filter props
  audienceFilter = '',
  topicFilter = '',
  mcFilter = '',
  onAudienceFilterChange,
  onTopicFilterChange,
  onMcFilterChange,
  // Product & Status filters
  productFilters = [],
  statusFilters = [],
  allProducts = [],
  allStatuses = [],
  onProductFiltersChange,
  onStatusFiltersChange,
  statusColors = {},
  filteredCounts = { products: 0, audiences: 0, topics: 0, messages: 0 },
  // View variant props
  treeOrientation = 'vertical',
  onTreeOrientationChange,
  sankeyVariant = 'sankey',
  onSankeyVariantChange,
  // Feed export props
  onExportFilteredFeed,
  isExporting = false,
  exportStatus = null // 'success' | 'error' | null
}) => {
  // Load saved toolbar state from localStorage
  const [isOpen, setIsOpen] = useState(() => {
    try {
      const saved = localStorage.getItem('toolbar_isOpen');
      return saved ? JSON.parse(saved) : false;
    } catch { return false; }
  });

  // Toolbar position state (null = default CSS position)
  const [toolbarPosition, setToolbarPosition] = useState(() => {
    try {
      const saved = localStorage.getItem('toolbar_position');
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });

  const [productDropdownOpen, setProductDropdownOpen] = useState(false);
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const productDropdownRef = useRef(null);
  const statusDropdownRef = useRef(null);
  const toolbarRef = useRef(null);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0, toolbarX: 0, toolbarY: 0 });

  // Save isOpen state to localStorage
  useEffect(() => {
    localStorage.setItem('toolbar_isOpen', JSON.stringify(isOpen));
  }, [isOpen]);

  // Save position to localStorage
  useEffect(() => {
    if (toolbarPosition) {
      localStorage.setItem('toolbar_position', JSON.stringify(toolbarPosition));
    }
  }, [toolbarPosition]);

  // Drag handlers
  const handleDragStart = (e) => {
    if (e.target.closest('.filter-dropdown-menu')) return; // Don't drag when clicking dropdown
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

    // Constrain to viewport
    const toolbar = toolbarRef.current;
    if (!toolbar) return;
    const rect = toolbar.getBoundingClientRect();
    const maxY = window.innerHeight - rect.height - 10;

    // Calculate distance from right edge of viewport
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

  // Local state for slider values (to trigger re-renders)
  const [treeNodeScale, setTreeNodeScale] = useState(1);
  const [treeLayerHeight, setTreeLayerHeight] = useState(0.5);
  const [treeScaleBase, setTreeScaleBase] = useState(50);
  const [sankeyFlowScale, setSankeyFlowScale] = useState(10);
  const [sankeyLevelSpacing, setSankeyLevelSpacing] = useState(300);
  const [sankeyTextScale, setSankeyTextScale] = useState(1);

  // Sync slider values from refs when view changes or toolbar opens
  useEffect(() => {
    if (viewMode === 'tree2' && tree2Ref?.current) {
      setTreeNodeScale(tree2Ref.current.nodeScale || 1);
      setTreeLayerHeight(tree2Ref.current.layerHeightScale || 0.5);
      setTreeScaleBase(tree2Ref.current.scaleBase || 50);
    } else if (viewMode === 'tree3' && sankeyRef?.current) {
      setSankeyFlowScale(sankeyRef.current.flowScale || 10);
      setSankeyLevelSpacing(sankeyRef.current.levelSpacing || 300);
      setSankeyTextScale(sankeyRef.current.textScale || 1);
    }
  }, [viewMode, isOpen, tree2Ref, sankeyRef]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (productDropdownRef.current && !productDropdownRef.current.contains(e.target)) {
        setProductDropdownOpen(false);
      }
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(e.target)) {
        setStatusDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Get current zoom based on view mode
  const getCurrentZoom = () => {
    if (viewMode === 'matrix') return matrixZoom;
    if (viewMode === 'tree') return treeZoom;
    if (viewMode === 'tree2') return tree2Zoom;
    if (viewMode === 'tree3') return sankeyZoom;
    return 1;
  };

  // Handle zoom
  const handleZoomIn = () => {
    if (viewMode === 'matrix') onMatrixZoomChange(Math.min(matrixZoom * 1.2, 3));
    else if (viewMode === 'tree') onTreeZoomChange(Math.min(treeZoom * 1.2, 3));
    else if (viewMode === 'tree2') tree2Ref?.current?.zoomIn?.();
    else if (viewMode === 'tree3') sankeyRef?.current?.zoomIn?.();
  };

  const handleZoomOut = () => {
    if (viewMode === 'matrix') onMatrixZoomChange(Math.max(matrixZoom * 0.8, 0.1));
    else if (viewMode === 'tree') onTreeZoomChange(Math.max(treeZoom * 0.8, 0.1));
    else if (viewMode === 'tree2') tree2Ref?.current?.zoomOut?.();
    else if (viewMode === 'tree3') sankeyRef?.current?.zoomOut?.();
  };

  const handleFit = () => {
    if (viewMode === 'matrix') onMatrixFit?.();
    else if (viewMode === 'tree2') tree2Ref?.current?.fitToView?.();
    else if (viewMode === 'tree3') sankeyRef?.current?.fitToView?.();
  };

  // Navigation handlers for tree/sankey views
  // In vertical tree: left/right = jump across branches at same level, up/down = parent/child
  // In horizontal tree: up/down = jump across branches at same level, left/right = parent/child
  const handleNavUp = useCallback(() => {
    if (viewMode === 'tree2') {
      if (treeOrientation === 'vertical') {
        tree2Ref?.current?.navigateToParent?.();
      } else {
        // Jump across branches at same level
        tree2Ref?.current?.navigateToPrevOnLevel?.();
      }
    } else if (viewMode === 'tree3') {
      sankeyRef?.current?.navigateToPrevSibling?.();
    }
  }, [viewMode, treeOrientation, tree2Ref, sankeyRef]);

  const handleNavDown = useCallback(() => {
    if (viewMode === 'tree2') {
      if (treeOrientation === 'vertical') {
        tree2Ref?.current?.navigateToChild?.();
      } else {
        // Jump across branches at same level
        tree2Ref?.current?.navigateToNextOnLevel?.();
      }
    } else if (viewMode === 'tree3') {
      sankeyRef?.current?.navigateToNextSibling?.();
    }
  }, [viewMode, treeOrientation, tree2Ref, sankeyRef]);

  const handleNavLeft = useCallback(() => {
    if (viewMode === 'tree2') {
      if (treeOrientation === 'vertical') {
        // Jump across branches at same level
        tree2Ref?.current?.navigateToPrevOnLevel?.();
      } else {
        tree2Ref?.current?.navigateToParent?.();
      }
    } else if (viewMode === 'tree3') {
      sankeyRef?.current?.navigateToParent?.();
    }
  }, [viewMode, treeOrientation, tree2Ref, sankeyRef]);

  const handleNavRight = useCallback(() => {
    if (viewMode === 'tree2') {
      if (treeOrientation === 'vertical') {
        // Jump across branches at same level
        tree2Ref?.current?.navigateToNextOnLevel?.();
      } else {
        tree2Ref?.current?.navigateToChild?.();
      }
    } else if (viewMode === 'tree3') {
      sankeyRef?.current?.navigateToChild?.();
    }
  }, [viewMode, treeOrientation, tree2Ref, sankeyRef]);

  // Keyboard navigation for tree views
  useEffect(() => {
    if (viewMode !== 'tree2') return;

    const handleKeyDown = (e) => {
      // Don't handle if user is typing in an input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          handleNavUp();
          break;
        case 'ArrowDown':
          e.preventDefault();
          handleNavDown();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          handleNavLeft();
          break;
        case 'ArrowRight':
          e.preventDefault();
          handleNavRight();
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewMode, handleNavUp, handleNavDown, handleNavLeft, handleNavRight]);

  const handleNavCenter = () => {
    if (viewMode === 'tree2') {
      const selected = tree2Ref?.current?.selectedNode;
      if (selected) tree2Ref?.current?.centerOnNode?.(selected);
      else tree2Ref?.current?.fitToView?.();
    } else if (viewMode === 'tree3') {
      const selected = sankeyRef?.current?.selectedNode;
      if (selected) sankeyRef?.current?.centerOnNode?.(selected);
      else sankeyRef?.current?.fitToView?.();
    }
  };

  const toggleProduct = (product) => {
    if (productFilters.includes(product)) {
      onProductFiltersChange(productFilters.filter(p => p !== product));
    } else {
      onProductFiltersChange([...productFilters, product]);
    }
  };

  const toggleStatus = (status) => {
    if (statusFilters.includes(status)) {
      onStatusFiltersChange(statusFilters.filter(s => s !== status));
    } else {
      onStatusFiltersChange([...statusFilters, status]);
    }
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
          {/* View Modes - Toggle behavior: click active button to switch variant */}
          <div className="view-modes">
            {/* Matrix: toggle between informative (2x2) and minimal (3x3) */}
            <button
              className={`view-mode-btn ${viewMode === 'matrix' ? 'active' : ''}`}
              onClick={() => {
                if (viewMode === 'matrix') {
                  // Toggle display mode variant
                  onDisplayModeChange?.(displayMode === 'informative' ? 'minimal' : 'informative');
                } else {
                  onViewModeChange('matrix');
                }
              }}
              title={viewMode === 'matrix'
                ? (displayMode === 'informative' ? 'Switch to Minimal View' : 'Switch to Informative View')
                : 'Matrix View'
              }
            >
              {displayMode === 'minimal' && viewMode === 'matrix'
                ? <Grid3x3Icon size={18} />
                : <Grid2x2Icon size={18} />
              }
            </button>

            {/* Tree: toggle between vertical and horizontal */}
            <button
              className={`view-mode-btn ${viewMode === 'tree2' ? 'active' : ''}`}
              onClick={() => {
                if (viewMode === 'tree2') {
                  // Toggle tree orientation
                  onTreeOrientationChange?.(treeOrientation === 'vertical' ? 'horizontal' : 'vertical');
                } else {
                  onViewModeChange('tree2');
                }
              }}
              title={viewMode === 'tree2'
                ? (treeOrientation === 'vertical' ? 'Switch to Horizontal Tree' : 'Switch to Vertical Tree')
                : 'Tree View'
              }
            >
              {treeOrientation === 'horizontal' && viewMode === 'tree2'
                ? <NetworkHorizontalIcon size={18} />
                : <NetworkIcon size={18} />
              }
            </button>

            {/* Sankey: toggle between sankey and circular */}
            <button
              className={`view-mode-btn ${viewMode === 'tree3' ? 'active' : ''}`}
              onClick={() => {
                if (viewMode === 'tree3') {
                  // Toggle sankey variant
                  onSankeyVariantChange?.(sankeyVariant === 'sankey' ? 'circular' : 'sankey');
                } else {
                  onViewModeChange('tree3');
                }
              }}
              title={viewMode === 'tree3'
                ? (sankeyVariant === 'sankey' ? 'Switch to Circular View' : 'Switch to Sankey View')
                : 'Sankey View'
              }
            >
              {sankeyVariant === 'circular' && viewMode === 'tree3'
                ? <DiameterIcon size={18} />
                : <LayoutPanelTopIcon size={18} />
              }
            </button>

            {/* Feed: no variant toggle */}
            <button
              className={`view-mode-btn ${viewMode === 'feed' ? 'active' : ''}`}
              onClick={() => onViewModeChange('feed')}
              title="Feed View"
            >
              <List size={18} />
            </button>
          </div>

          {/* Product Filter Dropdown */}
          <div className="filter-group">
            <div className="filter-dropdown" ref={productDropdownRef}>
              <button
                className="filter-pill"
                onClick={() => setProductDropdownOpen(!productDropdownOpen)}
              >
                <Filter size={16} className="filter-pill-icon" />
                <span className="filter-pill-text">Products</span>
                <ChevronDown size={16} className={`filter-pill-chevron ${productDropdownOpen ? 'open' : ''}`} />
                <span className={`filter-pill-badge ${productFilters.length === 0 ? 'zero' : ''}`}>
                  {productFilters.length}
                </span>
              </button>
              {productDropdownOpen && (
                <div className="filter-dropdown-menu">
                  {allProducts.map(product => (
                    <button
                      key={product}
                      className="filter-dropdown-item"
                      onClick={() => toggleProduct(product)}
                    >
                      <Check size={16} className={productFilters.includes(product) ? 'visible' : 'hidden'} />
                      <span>{product}</span>
                    </button>
                  ))}
                  {allProducts.length === 0 && (
                    <div className="filter-dropdown-empty">No products available</div>
                  )}
                </div>
              )}
            </div>

            {/* Status Filter Dropdown */}
            <div className="filter-dropdown" ref={statusDropdownRef}>
              <button
                className="filter-pill"
                onClick={() => setStatusDropdownOpen(!statusDropdownOpen)}
              >
                <Filter size={16} className="filter-pill-icon" />
                <span className="filter-pill-text">Status</span>
                <ChevronDown size={16} className={`filter-pill-chevron ${statusDropdownOpen ? 'open' : ''}`} />
                <span className={`filter-pill-badge ${statusFilters.length === 0 ? 'zero' : ''}`}>
                  {statusFilters.length}
                </span>
              </button>
              {statusDropdownOpen && (
                <div className="filter-dropdown-menu">
                  {allStatuses.map(status => {
                    const bgColor = statusColors[status.toUpperCase()] || '#cccccc';
                    const textColor = getTextColor(bgColor);
                    return (
                      <button
                        key={status}
                        className="filter-dropdown-item"
                        onClick={() => toggleStatus(status)}
                      >
                        <Check size={16} className={statusFilters.includes(status) ? 'visible' : 'hidden'} />
                        <span
                          className="status-chip"
                          style={{ backgroundColor: bgColor, color: textColor }}
                        >
                          {status}
                        </span>
                      </button>
                    );
                  })}
                  {allStatuses.length === 0 && (
                    <div className="filter-dropdown-empty">No statuses available</div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Text Filters */}
          <div className="filter-group">
            <div className="filter-pill">
              <Filter size={16} className="filter-pill-icon" />
              <input
                type="text"
                className="filter-input"
                placeholder="Audience filter..."
                value={audienceFilter}
                onChange={(e) => onAudienceFilterChange?.(e.target.value)}
              />
              <span className={`filter-pill-badge ${filteredCounts.audiences === 0 ? 'zero' : ''}`}>
                {filteredCounts.audiences}
              </span>
            </div>
            <div className="filter-pill">
              <Filter size={16} className="filter-pill-icon" />
              <input
                type="text"
                className="filter-input"
                placeholder="Topic filter..."
                value={topicFilter}
                onChange={(e) => onTopicFilterChange?.(e.target.value)}
              />
              <span className={`filter-pill-badge ${filteredCounts.topics === 0 ? 'zero' : ''}`}>
                {filteredCounts.topics}
              </span>
            </div>
            <div className="filter-pill">
              <Filter size={16} className="filter-pill-icon" />
              <input
                type="text"
                className="filter-input"
                placeholder="MC, name, images..."
                value={mcFilter}
                onChange={(e) => onMcFilterChange?.(e.target.value)}
              />
              <span className={`filter-pill-badge ${filteredCounts.messages === 0 ? 'zero' : ''}`}>
                {filteredCounts.messages}
              </span>
            </div>
          </div>

          {/* Feed Export Section - Only for feed view */}
          {viewMode === 'feed' && onExportFilteredFeed && (
            <div className="feed-export-section" style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.2)' }}>
              <button
                onClick={onExportFilteredFeed}
                disabled={isExporting || (filteredCounts.dynamicTemplateMessages || 0) === 0}
                className="export-filtered-feed-btn"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  width: '100%',
                  padding: '10px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: isExporting || (filteredCounts.dynamicTemplateMessages || 0) === 0 ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s',
                  backgroundColor: isExporting
                    ? 'rgba(255,255,255,0.1)'
                    : exportStatus === 'success'
                      ? '#22c55e'
                      : exportStatus === 'error'
                        ? '#ef4444'
                        : (filteredCounts.dynamicTemplateMessages || 0) === 0
                          ? 'rgba(255,255,255,0.1)'
                          : '#3b82f6',
                  color: isExporting || (filteredCounts.dynamicTemplateMessages || 0) === 0 ? 'rgba(255,255,255,0.5)' : 'white'
                }}
              >
                <Upload size={16} />
                {isExporting
                  ? 'Exporting...'
                  : exportStatus === 'success'
                    ? 'Exported!'
                    : exportStatus === 'error'
                      ? 'Export Failed'
                      : `Export Filtered Feed (${filteredCounts.dynamicTemplateMessages || 0})`
                }
              </button>
            </div>
          )}

          {/* Sliders - Only for tree and sankey views */}
          {(viewMode === 'tree2' || viewMode === 'tree3') && (
            <div className="slider-group">
              {viewMode === 'tree2' && (
                <>
                  <div className="slider-item">
                    <div className="slider-header">
                      <span className="slider-label">Node size</span>
                      <span className="slider-value">{treeNodeScale.toFixed(1)}x</span>
                    </div>
                    <input
                      type="range"
                      className="slider-input"
                      min="0.5"
                      max="2"
                      step="0.1"
                      value={treeNodeScale}
                      onChange={(e) => {
                        const value = parseFloat(e.target.value);
                        setTreeNodeScale(value);
                        tree2Ref?.current?.setNodeScale?.(value);
                      }}
                    />
                  </div>
                  <div className="slider-item">
                    <div className="slider-header">
                      <span className="slider-label">
                        {treeOrientation === 'horizontal' ? 'Layer width' : 'Layer height'}
                      </span>
                      <span className="slider-value">{treeLayerHeight.toFixed(2)}x</span>
                    </div>
                    <input
                      type="range"
                      className="slider-input"
                      min={treeOrientation === 'horizontal' ? '0.5' : '0.1'}
                      max={treeOrientation === 'horizontal' ? '10' : '1'}
                      step="0.1"
                      value={treeLayerHeight}
                      onChange={(e) => {
                        const value = parseFloat(e.target.value);
                        setTreeLayerHeight(value);
                        tree2Ref?.current?.setLayerHeightScale?.(value);
                      }}
                    />
                  </div>
                  <div className="slider-item">
                    <div className="slider-header">
                      <span className="slider-label">Scale base</span>
                      <span className="slider-value">{Math.round(treeScaleBase)}</span>
                    </div>
                    <input
                      type="range"
                      className="slider-input"
                      min="10"
                      max="100"
                      step="5"
                      value={treeScaleBase}
                      onChange={(e) => {
                        const value = parseFloat(e.target.value);
                        setTreeScaleBase(value);
                        tree2Ref?.current?.setScaleBase?.(value);
                      }}
                    />
                  </div>
                </>
              )}
              {viewMode === 'tree3' && (
                <>
                  <div className="slider-item">
                    <div className="slider-header">
                      <span className="slider-label">Flow height</span>
                      <span className="slider-value">{sankeyFlowScale}px</span>
                    </div>
                    <input
                      type="range"
                      className="slider-input"
                      min="2"
                      max="30"
                      step="1"
                      value={sankeyFlowScale}
                      onChange={(e) => {
                        const value = parseInt(e.target.value);
                        setSankeyFlowScale(value);
                        sankeyRef?.current?.setFlowScale?.(value);
                      }}
                    />
                  </div>
                  <div className="slider-item">
                    <div className="slider-header">
                      <span className="slider-label">Level spacing</span>
                      <span className="slider-value">{sankeyLevelSpacing}</span>
                    </div>
                    <input
                      type="range"
                      className="slider-input"
                      min={sankeyVariant === 'circular' ? '50' : '150'}
                      max={sankeyVariant === 'circular' ? '400' : '1500'}
                      step="10"
                      value={sankeyLevelSpacing}
                      onChange={(e) => {
                        const value = parseInt(e.target.value);
                        setSankeyLevelSpacing(value);
                        sankeyRef?.current?.setLevelSpacing?.(value);
                      }}
                    />
                  </div>
                  <div className="slider-item">
                    <div className="slider-header">
                      <span className="slider-label">Text size</span>
                      <span className="slider-value">{sankeyTextScale.toFixed(1)}x</span>
                    </div>
                    <input
                      type="range"
                      className="slider-input"
                      min="0.5"
                      max="2"
                      step="0.1"
                      value={sankeyTextScale}
                      onChange={(e) => {
                        const value = parseFloat(e.target.value);
                        setSankeyTextScale(value);
                        sankeyRef?.current?.setTextScale?.(value);
                      }}
                    />
                  </div>
                </>
              )}
            </div>
          )}

          {/* Zoom Controls - Not in feed mode */}
          {viewMode !== 'feed' && (
            <div className="zoom-controls full-width">
              <div className="zoom-row">
                <button className="zoom-btn" onClick={handleZoomOut}>
                  <Minus size={16} />
                </button>
                <span className="zoom-value">
                  <span>{Math.round(getCurrentZoom() * 100)}%</span>
                  <span className="zoom-fit" onClick={handleFit}>fit</span>
                </span>
                <button className="zoom-btn" onClick={handleZoomIn}>
                  <Plus size={16} />
                </button>
              </div>

              {/* Navigation Pad - Only for tree2 view */}
              {viewMode === 'tree2' && (
                <div className="nav-pad">
                  <div></div>
                  <button className="nav-pad-btn" onClick={handleNavUp} title="Previous sibling"><ArrowUp size={16} /></button>
                  <div></div>
                  <button className="nav-pad-btn" onClick={handleNavLeft} title="Go to parent"><ArrowLeft size={16} /></button>
                  <button className="nav-pad-btn center" onClick={handleNavCenter} title="Center on selected">
                    <Square size={14} />
                  </button>
                  <button className="nav-pad-btn" onClick={handleNavRight} title="Go to child"><ArrowRight size={16} /></button>
                  <div></div>
                  <button className="nav-pad-btn" onClick={handleNavDown} title="Next sibling"><ArrowDown size={16} /></button>
                  <div></div>
                </div>
              )}

              <div className="zoom-info">
                <Info size={14} />
                <span>
                  {viewMode === 'matrix'
                    ? 'Press space for Zoom-scrolling'
                    : <>Press space for panning<br />and Zoom-scrolling</>
                  }
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default MatrixControlPanel;
