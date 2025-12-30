/**
 * SankeyView - Canvas-based vertical Sankey diagram visualization
 * Displays messaging matrix as flowing bands with minimal labels
 */

import React, { useRef, useEffect, useCallback, useImperativeHandle, forwardRef, useState } from 'react';
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
  variant: variantProp,
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

  // View type state (linear = horizontal Sankey, circular = radial Sankey)
  // Map prop values: 'sankey' -> 'linear', 'circular' -> 'circular'
  const mapVariantToViewType = (variant) => variant === 'circular' ? 'circular' : 'linear';
  const [viewType, setViewType] = useState(() =>
    variantProp ? mapVariantToViewType(variantProp) : loadSavedState('viewType', 'linear')
  );

  // Helper to get view-type-specific storage key
  const getViewTypeKey = (viewType, key) => `${key}_${viewType}`;

  // Local state for sliders (stored separately per view type)
  const [localFlowScale, setLocalFlowScale] = useState(() => {
    const vt = variantProp ? mapVariantToViewType(variantProp) : loadSavedState('viewType', 'linear');
    return loadSavedState(getViewTypeKey(vt, 'flowScale'), 10);
  });
  const [localLevelSpacing, setLocalLevelSpacing] = useState(() => {
    const vt = variantProp ? mapVariantToViewType(variantProp) : loadSavedState('viewType', 'linear');
    return loadSavedState(getViewTypeKey(vt, 'levelSpacing'), vt === 'circular' ? 200 : 300);
  });
  const [localTextScale, setLocalTextScale] = useState(() => {
    const vt = variantProp ? mapVariantToViewType(variantProp) : loadSavedState('viewType', 'linear');
    return loadSavedState(getViewTypeKey(vt, 'textScale'), 1);
  });

  // Sync viewType from variant prop when it changes
  useEffect(() => {
    if (variantProp) {
      const mappedType = mapVariantToViewType(variantProp);
      if (mappedType !== viewType) {
        setViewType(mappedType);
      }
    }
  }, [variantProp]);

  // Load view-type-specific slider values when view type changes
  useEffect(() => {
    const newFlowScale = loadSavedState(getViewTypeKey(viewType, 'flowScale'), 10);
    const newLevelSpacing = loadSavedState(getViewTypeKey(viewType, 'levelSpacing'), viewType === 'circular' ? 200 : 300);
    const newTextScale = loadSavedState(getViewTypeKey(viewType, 'textScale'), 1);

    setLocalFlowScale(newFlowScale);
    setLocalLevelSpacing(newLevelSpacing);
    setLocalTextScale(newTextScale);

    // Also update the hook state
    setFlowScale(newFlowScale);
    setLevelSpacing(newLevelSpacing);
    setTextScale(newTextScale);
  }, [viewType]);

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

  // Check if we have data (nodes is now array of arrays)
  const hasData = nodes && nodes.length > 0 && nodes.some(level => level.length > 0);

  // Sync local state with hook state on mount
  useEffect(() => {
    setFlowScale(localFlowScale);
    setLevelSpacing(localLevelSpacing);
    setTextScale(localTextScale);
  }, []); // Only on mount

  // Save slider settings to localStorage (view-type-specific)
  useEffect(() => {
    localStorage.setItem(`sankeyview_${getViewTypeKey(viewType, 'flowScale')}`, JSON.stringify(localFlowScale));
  }, [localFlowScale, viewType, getViewTypeKey]);

  useEffect(() => {
    localStorage.setItem(`sankeyview_${getViewTypeKey(viewType, 'levelSpacing')}`, JSON.stringify(localLevelSpacing));
  }, [localLevelSpacing, viewType, getViewTypeKey]);

  useEffect(() => {
    localStorage.setItem(`sankeyview_${getViewTypeKey(viewType, 'textScale')}`, JSON.stringify(localTextScale));
  }, [localTextScale, viewType, getViewTypeKey]);

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

  // Expose zoom and slider controls to parent via ref
  useImperativeHandle(ref, () => ({
    zoom,
    zoomIn,
    zoomOut,
    resetZoom,
    fitToView,
    // Slider settings
    flowScale: localFlowScale,
    setFlowScale: handleFlowScaleChange,
    levelSpacing: localLevelSpacing,
    setLevelSpacing: handleLevelSpacingChange,
    textScale: localTextScale,
    setTextScale: handleTextScaleChange,
    viewType,
    // Navigation
    selectedNode,
    levelCount,
    selectAndCenterNode,
    centerOnNode,
    navigateToParent,
    navigateToChild,
    navigateToPrevSibling,
    navigateToNextSibling
  }), [zoom, zoomIn, zoomOut, resetZoom, fitToView, localFlowScale, localLevelSpacing, localTextScale, handleFlowScaleChange, handleLevelSpacingChange, handleTextScaleChange, viewType, selectedNode, levelCount, selectAndCenterNode, centerOnNode, navigateToParent, navigateToChild, navigateToPrevSibling, navigateToNextSibling]);

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
        backgroundColor: 'var(--color-primary)',
        minHeight: '600px',
        height: '100%',
        cursor: hoveredNode ? 'pointer' : 'default'
      }}
    >
      {/* Canvas for Sankey rendering */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0"
        style={{ display: 'block', width: '100%', height: '100%' }}
      />

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
