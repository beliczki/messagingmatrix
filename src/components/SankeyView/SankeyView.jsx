/**
 * SankeyView - Canvas-based vertical Sankey diagram visualization
 * Displays messaging matrix as flowing bands with minimal labels
 */

import React, { useRef, useEffect, useCallback, useImperativeHandle, forwardRef, useState } from 'react';
import { GripHorizontal } from 'lucide-react';
import { useSankey } from '../sankey/hooks/useSankey.js';

/**
 * SankeyView Component - Vertical Sankey Diagram
 *
 * Props:
 * - audiences: Array of audience objects
 * - topics: Array of topic objects
 * - getMessages: Function (topicKey, audienceKey) => messages[]
 * - statusFilters: Array of status strings to filter by
 * - sankeyStructure: String pattern like "Product → Strategy → Audience → Topic → Message"
 * - lookAndFeel: Color scheme object
 * - onEditAudience: Callback when audience node is double-clicked
 * - onEditTopic: Callback when topic node is double-clicked
 * - onEditMessage: Callback when message node is double-clicked
 */
const SankeyView = forwardRef(function SankeyView({
  audiences = [],
  topics = [],
  getMessages,
  statusFilters = [],
  sankeyStructure = 'Product → Strategy → Audience → Topic → Message',
  lookAndFeel = {},
  onEditAudience,
  onEditTopic,
  onEditMessage,
  onZoomChange
}, ref) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const isInitializedRef = useRef(false);

  // Load saved state from localStorage
  const loadSavedState = (key, defaultValue) => {
    try {
      const saved = localStorage.getItem(`sankeyview_${key}`);
      return saved ? JSON.parse(saved) : defaultValue;
    } catch {
      return defaultValue;
    }
  };

  // Panel position state for dragging
  const [settingsPanelPos, setSettingsPanelPos] = useState(() => loadSavedState('settingsPanelPos', { x: 16, y: 16 }));
  const [navPanelPos, setNavPanelPos] = useState(() => loadSavedState('navPanelPos', { x: 200, y: 16 }));
  const [draggingPanel, setDraggingPanel] = useState(null);
  const dragStartRef = useRef({ x: 0, y: 0, panelX: 0, panelY: 0 });
  const settingsPanelRef = useRef(null);
  const navPanelRef = useRef(null);

  // Local state for sliders (to persist)
  const [localFlowScale, setLocalFlowScale] = useState(() => loadSavedState('flowScale', 10));
  const [localLevelSpacing, setLocalLevelSpacing] = useState(() => loadSavedState('levelSpacing', 300));
  const [localTextScale, setLocalTextScale] = useState(() => loadSavedState('textScale', 1));

  // View type state (linear = horizontal Sankey, circular = radial Sankey)
  const [viewType, setViewType] = useState(() => loadSavedState('viewType', 'linear'));

  // Convert user-friendly format to internal format
  // "Product → Strategy → Audience → Topic → Message" -> "Audiences.Product -> Audiences.Strategy -> ..."
  // Also handles already-formatted strings like "Audiences.Product -> Topics.Name"
  const convertToInternalFormat = (structure) => {
    if (!structure) return 'Audiences.Name -> Topics.Name -> Messages.Number';

    const levelMap = {
      'product': 'Audiences.Product',
      'strategy': 'Audiences.Strategy',
      'targeting type': 'Audiences.Targeting_type',
      'targeting_type': 'Audiences.Targeting_type',
      'data source': 'Audiences.Data_source',
      'data_source': 'Audiences.Data_source',
      'audience': 'Audiences.Name',
      'audience name': 'Audiences.Name',
      'name': 'Audiences.Name',
      'topic': 'Topics.Name',
      'topic name': 'Topics.Name',
      'message': 'Messages.Number',
      'message number': 'Messages.Number',
      'number': 'Messages.Number',
      'variant': 'Messages.Variant',
      'message variant': 'Messages.Variant'
    };

    const parts = structure.split(/\s*→\s*|\s*->\s*/);
    const converted = parts.map(part => {
      const trimmed = part.trim();

      // If already in internal format (contains a dot with valid prefix), normalize to plural
      if (trimmed.match(/^(Audiences?|Topics?|Messages?)\./i)) {
        // Normalize singular to plural: Audience.Name -> Audiences.Name, Topic.Name -> Topics.Name
        return trimmed
          .replace(/^Audience\./i, 'Audiences.')
          .replace(/^Topic\./i, 'Topics.')
          .replace(/^Message\./i, 'Messages.');
      }

      const normalized = trimmed.toLowerCase();
      return levelMap[normalized] || `Audiences.${trimmed}`;
    });

    return converted.join(' -> ');
  };

  const effectiveStructure = convertToInternalFormat(sankeyStructure);

  // Use the Sankey hook
  const {
    nodes,
    flows,
    levelCount,
    levelLabels,
    bounds,
    zoom,
    pan,
    flowScale,
    setFlowScale,
    levelSpacing,
    setLevelSpacing,
    textScale,
    setTextScale,
    hoveredNode,
    selectedNode,
    initRenderer,
    initInteraction,
    render,
    fitToView,
    zoomIn,
    zoomOut,
    resetZoom,
    updateDimensions,
    selectAndCenterNode,
    centerOnNode,
    navigateToParent,
    navigateToChild,
    navigateToPrevSibling,
    navigateToNextSibling
  } = useSankey({
    audiences,
    topics,
    getMessages,
    treeStructure: effectiveStructure,
    statusFilters,
    lookAndFeel,
    onZoomChange,
    viewType
  });

  // Expose zoom controls to parent via ref
  useImperativeHandle(ref, () => ({
    zoom,
    zoomIn,
    zoomOut,
    resetZoom,
    fitToView
  }), [zoom, zoomIn, zoomOut, resetZoom, fitToView]);

  // Check if we have data (nodes is now array of arrays)
  const hasData = nodes && nodes.length > 0 && nodes.some(level => level.length > 0);
  const totalNodes = nodes ? nodes.reduce((sum, level) => sum + level.length, 0) : 0;

  // Panel drag handler - use direct DOM manipulation for smooth dragging
  const handlePanelDragStart = useCallback((e, panelType) => {
    e.preventDefault();
    e.stopPropagation();

    const panelPos = panelType === 'settings' ? settingsPanelPos : navPanelPos;
    const panelRef = panelType === 'settings' ? settingsPanelRef : navPanelRef;
    const setPanelPos = panelType === 'settings' ? setSettingsPanelPos : setNavPanelPos;

    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      panelX: panelPos.x,
      panelY: panelPos.y
    };
    setDraggingPanel(panelType);

    // Disable pointer events on panel content during drag
    if (panelRef.current) {
      panelRef.current.style.pointerEvents = 'none';
    }
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'grabbing';

    const handleMouseMove = (ev) => {
      ev.preventDefault();
      ev.stopPropagation();

      const deltaX = ev.clientX - dragStartRef.current.x;
      const deltaY = ev.clientY - dragStartRef.current.y;
      const newX = Math.max(0, dragStartRef.current.panelX + deltaX);
      const newY = Math.max(0, dragStartRef.current.panelY + deltaY);

      // Direct DOM update for smooth dragging
      if (panelRef.current) {
        panelRef.current.style.left = `${newX}px`;
        panelRef.current.style.top = `${newY}px`;
      }
    };

    const handleMouseUp = (ev) => {
      ev.preventDefault();

      const deltaX = ev.clientX - dragStartRef.current.x;
      const deltaY = ev.clientY - dragStartRef.current.y;
      const newX = Math.max(0, dragStartRef.current.panelX + deltaX);
      const newY = Math.max(0, dragStartRef.current.panelY + deltaY);

      // Update React state only on mouse up
      setPanelPos({ x: newX, y: newY });
      setDraggingPanel(null);

      // Re-enable pointer events
      if (panelRef.current) {
        panelRef.current.style.pointerEvents = '';
      }
      document.body.style.userSelect = '';
      document.body.style.cursor = '';

      // Remove listeners with capture phase
      document.removeEventListener('mousemove', handleMouseMove, true);
      document.removeEventListener('mouseup', handleMouseUp, true);
    };

    // Use capture phase so we get events before they're stopped by child elements
    document.addEventListener('mousemove', handleMouseMove, true);
    document.addEventListener('mouseup', handleMouseUp, true);
  }, [settingsPanelPos, navPanelPos]);

  // Sync local state with hook state on mount
  useEffect(() => {
    setFlowScale(localFlowScale);
    setLevelSpacing(localLevelSpacing);
    setTextScale(localTextScale);
  }, []); // Only on mount

  // Save panel positions to localStorage
  useEffect(() => {
    localStorage.setItem('sankeyview_settingsPanelPos', JSON.stringify(settingsPanelPos));
  }, [settingsPanelPos]);

  useEffect(() => {
    localStorage.setItem('sankeyview_navPanelPos', JSON.stringify(navPanelPos));
  }, [navPanelPos]);

  // Save slider settings to localStorage
  useEffect(() => {
    localStorage.setItem('sankeyview_flowScale', JSON.stringify(localFlowScale));
  }, [localFlowScale]);

  useEffect(() => {
    localStorage.setItem('sankeyview_levelSpacing', JSON.stringify(localLevelSpacing));
  }, [localLevelSpacing]);

  useEffect(() => {
    localStorage.setItem('sankeyview_textScale', JSON.stringify(localTextScale));
  }, [localTextScale]);

  useEffect(() => {
    localStorage.setItem('sankeyview_viewType', JSON.stringify(viewType));
  }, [viewType]);

  // Wrapper functions to update both local and hook state
  const handleFlowScaleChange = useCallback((value) => {
    setLocalFlowScale(value);
    setFlowScale(value);
  }, [setFlowScale]);

  const handleLevelSpacingChange = useCallback((value) => {
    setLocalLevelSpacing(value);
    setLevelSpacing(value);
  }, [setLevelSpacing]);

  const handleTextScaleChange = useCallback((value) => {
    setLocalTextScale(value);
    setTextScale(value);
  }, [setTextScale]);

  // Store callbacks in refs to avoid re-initialization when they change
  const onEditAudienceRef = useRef(onEditAudience);
  const onEditTopicRef = useRef(onEditTopic);
  const onEditMessageRef = useRef(onEditMessage);

  // Update refs when callbacks change
  useEffect(() => {
    onEditAudienceRef.current = onEditAudience;
    onEditTopicRef.current = onEditTopic;
    onEditMessageRef.current = onEditMessage;
  }, [onEditAudience, onEditTopic, onEditMessage]);

  // Handle node double-click - uses refs so it's stable
  const handleNodeDoubleClick = useCallback((node) => {
    if (!node || !node.originalData) return;

    const data = node.originalData;

    if ((node.source === 'Audiences' || node.source === 'Audience') && onEditAudienceRef.current) {
      onEditAudienceRef.current(data);
    } else if ((node.source === 'Topics' || node.source === 'Topic') && onEditTopicRef.current) {
      onEditTopicRef.current(data);
    } else if ((node.source === 'Messages' || node.source === 'Message') && onEditMessageRef.current) {
      onEditMessageRef.current(data);
    }
  }, []); // Empty deps - uses refs

  // Timer ref for initial fit
  const initFitTimerRef = useRef(null);
  const hasInitialFitRef = useRef(false);

  // Store fitToView and render in refs so we can call them without adding to deps
  const fitToViewRef = useRef(fitToView);
  const renderRef = useRef(render);
  useEffect(() => {
    fitToViewRef.current = fitToView;
    renderRef.current = render;
  }, [fitToView, render]);

  // Single initialization effect - only runs once on mount
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;

    if (!canvas || !container) return;
    if (hasInitialFitRef.current) return; // Prevent re-initialization
    hasInitialFitRef.current = true;

    // Initialize renderer
    initRenderer(canvas);

    // Initialize interaction with double-click handler
    initInteraction(container, handleNodeDoubleClick);

    // Get initial dimensions
    const rect = container.getBoundingClientRect();
    updateDimensions(rect.width, rect.height);

    isInitializedRef.current = true;

    // Auto fit and center after brief delay for layout to settle
    initFitTimerRef.current = setTimeout(() => {
      fitToViewRef.current();
      renderRef.current();
    }, 100);

    // Observe resize
    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        const { width, height } = entry.contentRect;
        updateDimensions(width, height);
      }
    });
    resizeObserver.observe(container);

    // Cleanup
    return () => {
      resizeObserver.disconnect();
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
      if (initFitTimerRef.current) {
        clearTimeout(initFitTimerRef.current);
      }
      // Reset for next mount
      hasInitialFitRef.current = false;
    };
  }, [initRenderer, initInteraction, handleNodeDoubleClick, updateDimensions]);

  // Render on state changes
  useEffect(() => {
    if (!isInitializedRef.current) return;

    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
    }

    rafRef.current = requestAnimationFrame(() => {
      render();
    });
  }, [nodes, flows, zoom, pan, render, flowScale, levelSpacing, textScale, hoveredNode]);

  return (
    <div
      ref={containerRef}
      className="relative w-full overflow-hidden"
      style={{
        backgroundColor: '#f8fafc',
        minHeight: '600px',
        height: 'calc(100vh - 200px)',
        cursor: hoveredNode ? 'pointer' : 'default'
      }}
    >
      {/* Canvas for Sankey rendering */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0"
        style={{ display: 'block', width: '100%', height: '100%' }}
      />

      {/* Settings panel - draggable */}
      <div
        ref={settingsPanelRef}
        className="absolute z-10 bg-white/95 rounded-lg shadow-md overflow-hidden"
        style={{ left: settingsPanelPos.x, top: settingsPanelPos.y, minWidth: '160px' }}
        data-control-panel="true"
        onMouseMove={(e) => e.stopPropagation()}
        onWheel={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div
          onMouseDown={(e) => handlePanelDragStart(e, 'settings')}
          className={`w-full h-5 flex items-center justify-center cursor-grab hover:bg-gray-200 transition-colors ${draggingPanel === 'settings' ? 'bg-gray-300 cursor-grabbing' : 'bg-gray-100'}`}
        >
          <GripHorizontal size={14} className="text-gray-400" />
        </div>

        <div className="flex flex-col gap-3 p-3">
          {/* View type switch - Linear / Circular */}
          <div className="flex items-center gap-1 p-0.5 rounded" style={{ backgroundColor: '#e5e7eb' }}>
            {/* Linear view */}
            <button
              onClick={() => setViewType('linear')}
              className={`flex items-center justify-center p-1.5 rounded transition-all ${
                viewType === 'linear' ? 'bg-white shadow-sm' : 'hover:bg-white/50'
              }`}
              style={{ color: viewType === 'linear' ? '#374151' : '#9ca3af' }}
              title="Linear Sankey"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 12h16M12 4l8 8-8 8" />
              </svg>
            </button>
            {/* Circular view */}
            <button
              onClick={() => setViewType('circular')}
              className={`flex items-center justify-center p-1.5 rounded transition-all ${
                viewType === 'circular' ? 'bg-white shadow-sm' : 'hover:bg-white/50'
              }`}
              style={{ color: viewType === 'circular' ? '#374151' : '#9ca3af' }}
              title="Circular Sankey"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="8" />
                <path d="M12 4v4M12 16v4M4 12h4M16 12h4" />
              </svg>
            </button>
          </div>

          {/* Flow Scale (height per leaf) */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500">Flow Height</label>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min="3"
                max="30"
                step="1"
                value={localFlowScale}
                onChange={(e) => handleFlowScaleChange(parseInt(e.target.value))}
                className="flex-1 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
              <span className="text-xs text-gray-500 w-8">{localFlowScale}px</span>
            </div>
          </div>

          {/* Level Spacing (horizontal distance) */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500">Level Spacing</label>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min="150"
                max="1500"
                step="25"
                value={localLevelSpacing}
                onChange={(e) => handleLevelSpacingChange(parseInt(e.target.value))}
                className="flex-1 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
              <span className="text-xs text-gray-500 w-10">{localLevelSpacing}</span>
            </div>
          </div>

          {/* Text Size */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500">Text Size</label>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min="0.5"
                max="3"
                step="0.1"
                value={localTextScale}
                onChange={(e) => handleTextScaleChange(parseFloat(e.target.value))}
                className="flex-1 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
              <span className="text-xs text-gray-500 w-8">{localTextScale.toFixed(1)}x</span>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation panel - draggable */}
      <div
        ref={navPanelRef}
        className="absolute z-10 bg-white/95 rounded-lg shadow-md overflow-hidden"
        style={{ left: navPanelPos.x, top: navPanelPos.y }}
        data-control-panel="true"
        onMouseMove={(e) => e.stopPropagation()}
        onWheel={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div
          onMouseDown={(e) => handlePanelDragStart(e, 'nav')}
          className={`w-full h-5 flex items-center justify-center cursor-grab hover:bg-gray-200 transition-colors ${draggingPanel === 'nav' ? 'bg-gray-300 cursor-grabbing' : 'bg-gray-100'}`}
        >
          <GripHorizontal size={14} className="text-gray-400" />
        </div>

        {/* Navigation grid - Sankey is horizontal, so left/right = levels, up/down = siblings in level */}
        <div className="p-2">
          <div className="grid grid-cols-3 gap-1" style={{ width: '72px', height: '72px' }}>
            <div />
            {/* Up arrow: Previous node in same level */}
            <button
              onClick={navigateToPrevSibling}
              disabled={!selectedNode}
              className="nav-btn flex items-center justify-center rounded transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              title="Previous in level"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M6 15l6-6 6 6" />
              </svg>
            </button>
            <div />
            {/* Left arrow: Go to source level */}
            <button
              onClick={navigateToParent}
              disabled={!selectedNode || selectedNode.level === 0}
              className="nav-btn flex items-center justify-center rounded transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              title="Go to source"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M15 6l-6 6 6 6" />
              </svg>
            </button>
            {/* Center: Center on selected or fit to view */}
            <button
              onClick={() => selectedNode ? centerOnNode(selectedNode) : fitToView()}
              className="nav-btn flex items-center justify-center rounded transition-all"
              title={selectedNode ? "Center on selected" : "Fit to view"}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="6" width="12" height="12" rx="2" />
              </svg>
            </button>
            {/* Right arrow: Go to target level */}
            <button
              onClick={navigateToChild}
              disabled={!selectedNode || selectedNode.level >= levelCount - 1}
              className="nav-btn flex items-center justify-center rounded transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              title="Go to target"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M9 6l6 6-6 6" />
              </svg>
            </button>
            <div />
            {/* Down arrow: Next node in same level */}
            <button
              onClick={navigateToNextSibling}
              disabled={!selectedNode}
              className="nav-btn flex items-center justify-center rounded transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              title="Next in level"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
            <div />
          </div>
        </div>
      </div>

      {/* Empty state */}
      {!hasData && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-gray-400 text-center">
            <p className="text-lg mb-2">No Sankey data available</p>
            <p className="text-sm">Add audiences and topics to see the convergent flow diagram</p>
          </div>
        </div>
      )}
    </div>
  );
});

export default React.memo(SankeyView);
