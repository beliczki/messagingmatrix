/**
 * Tree2View - Canvas-based tree visualization component
 * A simpler, faster alternative to TreeView using object-oriented design
 */

import React, { useRef, useEffect, useCallback, useImperativeHandle, forwardRef, useState } from 'react';
import { GripHorizontal } from 'lucide-react';
import { useTree2 } from '../tree2/hooks/useTree2.js';

/**
 * Tree2View Component
 *
 * Props:
 * - audiences: Array of audience objects
 * - topics: Array of topic objects
 * - getMessages: Function (topicKey, audienceKey) => messages[]
 * - statusFilters: Array of status strings to filter by
 * - treeStructure: String pattern like "Audiences.Product → Audiences.Strategy → ..."
 * - lookAndFeel: Color scheme object
 * - onEditAudience: Callback when audience node is double-clicked
 * - onEditTopic: Callback when topic node is double-clicked
 * - onEditMessage: Callback when message node is double-clicked
 */
const Tree2View = forwardRef(function Tree2View({
  audiences = [],
  topics = [],
  getMessages,
  statusFilters = [],
  treeStructure = 'Audiences.Product → Audiences.Strategy → Audiences.Name → Topics.Name → Messages.Number',
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
      const saved = localStorage.getItem(`tree2view_${key}`);
      return saved ? JSON.parse(saved) : defaultValue;
    } catch {
      return defaultValue;
    }
  };

  // Panel position state for dragging
  const [settingsPanelPos, setSettingsPanelPos] = useState(() => loadSavedState('settingsPanelPos', { x: 16, y: 16 }));
  const [navPanelPos, setNavPanelPos] = useState(() => loadSavedState('navPanelPos', { x: 210, y: 16 }));
  const [draggingPanel, setDraggingPanel] = useState(null);
  const dragStartRef = useRef({ x: 0, y: 0, panelX: 0, panelY: 0 });

  // Tree orientation state (vertical = top-down, horizontal = left-right)
  const [treeOrientation, setTreeOrientation] = useState(() => loadSavedState('treeOrientation', 'vertical'));

  // Load orientation-specific slider settings
  const getOrientationKey = (orientation, key) => `${key}_${orientation}`;

  // Local state for sliders (stored separately per orientation)
  const [localNodeScale, setLocalNodeScale] = useState(() => {
    const orientation = loadSavedState('treeOrientation', 'vertical');
    return loadSavedState(getOrientationKey(orientation, 'nodeScale'), 1);
  });
  const [localLayerHeightScale, setLocalLayerHeightScale] = useState(() => {
    const orientation = loadSavedState('treeOrientation', 'vertical');
    return loadSavedState(getOrientationKey(orientation, 'layerHeightScale'), orientation === 'horizontal' ? 1 : 0.5);
  });
  const [localScaleBase, setLocalScaleBase] = useState(() => {
    const orientation = loadSavedState('treeOrientation', 'vertical');
    return loadSavedState(getOrientationKey(orientation, 'scaleBase'), 50);
  });
  const [localConnectorType, setLocalConnectorType] = useState(() => loadSavedState('connectorType', 'curved'));

  // Use the tree2 hook
  const {
    nodes,
    levelCount,
    bounds,
    zoom,
    pan,
    connectorType,
    setConnectorType,
    nodeScale,
    setNodeScale,
    layerHeightScale,
    setLayerHeightScale,
    scaleBase,
    setScaleBase,
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
  } = useTree2({
    audiences,
    topics,
    getMessages,
    treeStructure,
    statusFilters,
    lookAndFeel,
    onZoomChange,
    orientation: treeOrientation
  });

  // Expose zoom controls to parent via ref
  useImperativeHandle(ref, () => ({
    zoom,
    zoomIn,
    zoomOut,
    resetZoom,
    fitToView
  }), [zoom, zoomIn, zoomOut, resetZoom, fitToView]);

  // Panel refs for direct DOM manipulation during drag
  const settingsPanelRef = useRef(null);
  const navPanelRef = useRef(null);

  // Panel drag handlers - use direct DOM manipulation for smooth dragging
  const handlePanelDragStart = useCallback((e, panelType) => {
    e.preventDefault();
    e.stopPropagation();

    const pos = panelType === 'settings' ? settingsPanelPos : navPanelPos;
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      panelX: pos.x,
      panelY: pos.y,
      panelType
    };
    setDraggingPanel(panelType);

    const panelRef = panelType === 'settings' ? settingsPanelRef : navPanelRef;

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
      if (dragStartRef.current.panelType === 'settings') {
        setSettingsPanelPos({ x: newX, y: newY });
      } else if (dragStartRef.current.panelType === 'nav') {
        setNavPanelPos({ x: newX, y: newY });
      }
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
    setNodeScale(localNodeScale);
    setLayerHeightScale(localLayerHeightScale);
    setScaleBase(localScaleBase);
    setConnectorType(localConnectorType);
  }, []); // Only on mount

  // Save panel positions to localStorage
  useEffect(() => {
    localStorage.setItem('tree2view_settingsPanelPos', JSON.stringify(settingsPanelPos));
  }, [settingsPanelPos]);

  useEffect(() => {
    localStorage.setItem('tree2view_navPanelPos', JSON.stringify(navPanelPos));
  }, [navPanelPos]);

  // Save tree settings to localStorage (orientation-specific for sliders)
  useEffect(() => {
    localStorage.setItem(`tree2view_${getOrientationKey(treeOrientation, 'nodeScale')}`, JSON.stringify(localNodeScale));
  }, [localNodeScale, treeOrientation]);

  useEffect(() => {
    localStorage.setItem(`tree2view_${getOrientationKey(treeOrientation, 'layerHeightScale')}`, JSON.stringify(localLayerHeightScale));
  }, [localLayerHeightScale, treeOrientation]);

  useEffect(() => {
    localStorage.setItem(`tree2view_${getOrientationKey(treeOrientation, 'scaleBase')}`, JSON.stringify(localScaleBase));
  }, [localScaleBase, treeOrientation]);

  useEffect(() => {
    localStorage.setItem('tree2view_connectorType', JSON.stringify(localConnectorType));
  }, [localConnectorType]);

  useEffect(() => {
    localStorage.setItem('tree2view_treeOrientation', JSON.stringify(treeOrientation));
  }, [treeOrientation]);

  // Load orientation-specific settings when orientation changes
  const prevOrientationRef = useRef(treeOrientation);
  useEffect(() => {
    if (prevOrientationRef.current !== treeOrientation) {
      // Orientation changed - load settings for new orientation
      const newNodeScale = loadSavedState(getOrientationKey(treeOrientation, 'nodeScale'), 1);
      const newLayerHeightScale = loadSavedState(getOrientationKey(treeOrientation, 'layerHeightScale'), treeOrientation === 'horizontal' ? 1 : 0.5);
      const newScaleBase = loadSavedState(getOrientationKey(treeOrientation, 'scaleBase'), 50);

      setLocalNodeScale(newNodeScale);
      setLocalLayerHeightScale(newLayerHeightScale);
      setLocalScaleBase(newScaleBase);

      // Also update the hook state
      setNodeScale(newNodeScale);
      setLayerHeightScale(newLayerHeightScale);
      setScaleBase(newScaleBase);

      prevOrientationRef.current = treeOrientation;
    }
  }, [treeOrientation, setNodeScale, setLayerHeightScale, setScaleBase]);

  // Wrapper functions to update both local and hook state
  const handleNodeScaleChange = useCallback((value) => {
    setLocalNodeScale(value);
    setNodeScale(value);
  }, [setNodeScale]);

  const handleLayerHeightScaleChange = useCallback((value) => {
    setLocalLayerHeightScale(value);
    setLayerHeightScale(value);
  }, [setLayerHeightScale]);

  const handleScaleBaseChange = useCallback((value) => {
    setLocalScaleBase(value);
    setScaleBase(value);
  }, [setScaleBase]);

  const handleConnectorTypeChange = useCallback((value) => {
    setLocalConnectorType(value);
    setConnectorType(value);
  }, [setConnectorType]);

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

    if (node.isAudience() && onEditAudienceRef.current) {
      onEditAudienceRef.current(data);
    } else if (node.isTopic() && onEditTopicRef.current) {
      onEditTopicRef.current(data);
    } else if (node.isMessage() && onEditMessageRef.current) {
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

  // Render on state changes (zoom, pan, nodes, scale, hover, or selection changes)
  useEffect(() => {
    if (!isInitializedRef.current) return;

    // Use RAF for smooth rendering
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
    }

    rafRef.current = requestAnimationFrame(() => {
      render();
    });
  }, [nodes, zoom, pan, render, nodeScale, layerHeightScale, scaleBase, hoveredNode, selectedNode]);

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
      {/* Canvas for tree rendering */}
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
          {/* Orientation and Connector switches - styled like header view switch */}
          <div className="flex items-center gap-1 p-0.5 rounded" style={{ backgroundColor: '#e5e7eb' }}>
            {/* Orientation: Vertical */}
            <button
              onClick={() => setTreeOrientation('vertical')}
              className={`flex items-center justify-center p-1.5 rounded transition-all ${
                treeOrientation === 'vertical' ? 'bg-white shadow-sm' : 'hover:bg-white/50'
              }`}
              style={{ color: treeOrientation === 'vertical' ? '#374151' : '#9ca3af' }}
              title="Vertical tree (top-down)"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 21V3M12 21l-4-4M12 21l4-4" />
              </svg>
            </button>
            {/* Orientation: Horizontal */}
            <button
              onClick={() => setTreeOrientation('horizontal')}
              className={`flex items-center justify-center p-1.5 rounded transition-all ${
                treeOrientation === 'horizontal' ? 'bg-white shadow-sm' : 'hover:bg-white/50'
              }`}
              style={{ color: treeOrientation === 'horizontal' ? '#374151' : '#9ca3af' }}
              title="Horizontal tree (left-right)"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 12h18M21 12l-4-4M21 12l-4 4" />
              </svg>
            </button>
            <div className="w-px h-4 bg-gray-300 mx-0.5" />
            {/* Connector: Curved */}
            <button
              onClick={() => handleConnectorTypeChange('curved')}
              className={`flex items-center justify-center p-1.5 rounded transition-all ${
                localConnectorType === 'curved' ? 'bg-white shadow-sm' : 'hover:bg-white/50'
              }`}
              style={{ color: localConnectorType === 'curved' ? '#374151' : '#9ca3af' }}
              title="Curved connectors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 4 C4 14, 14 14, 20 20" />
              </svg>
            </button>
            {/* Connector: Elbow */}
            <button
              onClick={() => handleConnectorTypeChange('elbow')}
              className={`flex items-center justify-center p-1.5 rounded transition-all ${
                localConnectorType === 'elbow' ? 'bg-white shadow-sm' : 'hover:bg-white/50'
              }`}
              style={{ color: localConnectorType === 'elbow' ? '#374151' : '#9ca3af' }}
              title="Elbow connectors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 4 L4 14 L20 14 L20 20" />
              </svg>
            </button>
          </div>

          {/* Node Scale */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500">Node Size</label>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min="0.1"
                max="2"
                step="0.1"
                value={localNodeScale}
                onChange={(e) => handleNodeScaleChange(parseFloat(e.target.value))}
                className="flex-1 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
              <span className="text-xs text-gray-500 w-8">{localNodeScale.toFixed(1)}x</span>
            </div>
          </div>

          {/* Layer Height/Width Scale */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500">{treeOrientation === 'horizontal' ? 'Layer Width' : 'Layer Height'}</label>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min="0.01"
                max={treeOrientation === 'horizontal' ? '10' : '1'}
                step="0.01"
                value={localLayerHeightScale}
                onChange={(e) => handleLayerHeightScaleChange(parseFloat(e.target.value))}
                className="flex-1 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
              <span className="text-xs text-gray-500 w-10">{localLayerHeightScale.toFixed(2)}x</span>
            </div>
          </div>

          {/* Scale Base */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500">Scale Base</label>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min="1"
                max="100"
                step="1"
                value={localScaleBase}
                onChange={(e) => handleScaleBaseChange(parseFloat(e.target.value))}
                className="flex-1 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
              <span className="text-xs text-gray-500 w-8">{localScaleBase}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation panel - draggable, independent square */}
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

        {/* Navigation grid - arrows swap meaning based on orientation */}
        <div className="p-2">
          <div className="grid grid-cols-3 gap-1" style={{ width: '72px', height: '72px' }}>
            <div />
            {/* Up arrow: parent in vertical, prev sibling in horizontal */}
            <button
              onClick={treeOrientation === 'horizontal' ? navigateToPrevSibling : navigateToParent}
              disabled={treeOrientation === 'horizontal' ? !selectedNode : !selectedNode || !selectedNode.parent}
              className="nav-btn flex items-center justify-center rounded transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              title={treeOrientation === 'horizontal' ? 'Previous sibling' : 'Go to parent'}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M6 15l6-6 6 6" />
              </svg>
            </button>
            <div />
            {/* Left arrow: prev sibling in vertical, parent in horizontal */}
            <button
              onClick={treeOrientation === 'horizontal' ? navigateToParent : navigateToPrevSibling}
              disabled={treeOrientation === 'horizontal' ? !selectedNode || !selectedNode.parent : !selectedNode}
              className="nav-btn flex items-center justify-center rounded transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              title={treeOrientation === 'horizontal' ? 'Go to parent' : 'Previous sibling'}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M15 6l-6 6 6 6" />
              </svg>
            </button>
            <button
              onClick={() => selectedNode ? centerOnNode(selectedNode) : fitToView()}
              className="nav-btn flex items-center justify-center rounded transition-all"
              title={selectedNode ? "Center on selected node" : "Fit to view"}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="6" width="12" height="12" rx="2" />
              </svg>
            </button>
            {/* Right arrow: next sibling in vertical, child in horizontal */}
            <button
              onClick={treeOrientation === 'horizontal' ? navigateToChild : navigateToNextSibling}
              disabled={treeOrientation === 'horizontal' ? !selectedNode || !selectedNode.children || selectedNode.children.length === 0 : !selectedNode}
              className="nav-btn flex items-center justify-center rounded transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              title={treeOrientation === 'horizontal' ? 'Go to first child' : 'Next sibling'}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M9 6l6 6-6 6" />
              </svg>
            </button>
            <div />
            {/* Down arrow: child in vertical, next sibling in horizontal */}
            <button
              onClick={treeOrientation === 'horizontal' ? navigateToNextSibling : navigateToChild}
              disabled={treeOrientation === 'horizontal' ? !selectedNode : !selectedNode || !selectedNode.children || selectedNode.children.length === 0}
              className="nav-btn flex items-center justify-center rounded transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              title={treeOrientation === 'horizontal' ? 'Next sibling' : 'Go to first child'}
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
      {(!nodes || nodes.length === 0) && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-gray-400 text-center">
            <p className="text-lg mb-2">No tree data available</p>
            <p className="text-sm">Add audiences and topics to see the tree</p>
          </div>
        </div>
      )}
    </div>
  );
});

export default React.memo(Tree2View);
