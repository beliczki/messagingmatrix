/**
 * Tree2View - Canvas-based tree visualization component
 * A simpler, faster alternative to TreeView using object-oriented design
 */

import React, { useRef, useEffect, useCallback, useImperativeHandle, forwardRef, useState } from 'react';
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
  orientation: orientationProp,
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

  // Tree orientation state (vertical = top-down, horizontal = left-right)
  const [treeOrientation, setTreeOrientation] = useState(() =>
    orientationProp || loadSavedState('treeOrientation', 'vertical')
  );

  // Sync orientation from prop when it changes
  useEffect(() => {
    if (orientationProp && orientationProp !== treeOrientation) {
      setTreeOrientation(orientationProp);
    }
  }, [orientationProp]);

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
    navigateToNextSibling,
    navigateToPrevOnLevel,
    navigateToNextOnLevel
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

  // Sync local state with hook state on mount
  useEffect(() => {
    setNodeScale(localNodeScale);
    setLayerHeightScale(localLayerHeightScale);
    setScaleBase(localScaleBase);
    setConnectorType(localConnectorType);
  }, []); // Only on mount

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

  // Expose zoom and slider controls to parent via ref
  useImperativeHandle(ref, () => ({
    zoom,
    zoomIn,
    zoomOut,
    resetZoom,
    fitToView,
    // Slider settings
    nodeScale: localNodeScale,
    setNodeScale: handleNodeScaleChange,
    layerHeightScale: localLayerHeightScale,
    setLayerHeightScale: handleLayerHeightScaleChange,
    scaleBase: localScaleBase,
    setScaleBase: handleScaleBaseChange,
    treeOrientation,
    // Navigation
    selectedNode,
    selectAndCenterNode,
    centerOnNode,
    navigateToParent,
    navigateToChild,
    navigateToPrevSibling,
    navigateToNextSibling,
    navigateToPrevOnLevel,
    navigateToNextOnLevel
  }), [zoom, zoomIn, zoomOut, resetZoom, fitToView, localNodeScale, localLayerHeightScale, localScaleBase, handleNodeScaleChange, handleLayerHeightScaleChange, handleScaleBaseChange, treeOrientation, selectedNode, selectAndCenterNode, centerOnNode, navigateToParent, navigateToChild, navigateToPrevSibling, navigateToNextSibling, navigateToPrevOnLevel, navigateToNextOnLevel]);

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
        backgroundColor: 'var(--color-primary)',
        height: '100%',
        cursor: hoveredNode ? 'pointer' : 'default'
      }}
    >
      {/* Canvas for tree rendering */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0"
        style={{ display: 'block', width: '100%', height: '100%' }}
      />

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
