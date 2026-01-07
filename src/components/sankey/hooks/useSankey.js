/**
 * useSankey - React hook for SankeyView state management
 * Builds a convergent Sankey showing how different audiences flow to shared topics/messages
 */

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { parseTreeStructure } from '../../tree2/utils/tree2Builder.js';
import { SankeyLayout } from '../classes/SankeyLayout.js';
import { SankeyRenderer } from '../classes/SankeyRenderer.js';
import { TreeInteraction } from '../../tree2/classes/TreeInteraction.js';

/**
 * Build convergent Sankey data structure
 * Shows how different sources flow into shared destinations
 */
const buildSankeyData = (audiences, topics, getMessages, treeStructure, statusFilters) => {
  const levels = parseTreeStructure(treeStructure);

  if (levels.length === 0) {
    return { nodes: [], flows: [], levelCount: 0 };
  }

  // Collect all messages that pass filters
  const allMessages = [];
  audiences.forEach(audience => {
    topics.forEach(topic => {
      const msgs = getMessages(topic.key, audience.key) || [];
      msgs.forEach(msg => {
        if (statusFilters.length === 0 || statusFilters.includes(msg.status)) {
          allMessages.push({ audience, topic, message: msg });
        }
      });
    });
  });

  if (allMessages.length === 0) {
    return { nodes: [], flows: [], levelCount: 0 };
  }

  // Build nodes and flows for each level
  const levelNodes = [];  // Array of Maps: level -> Map<value, nodeData>
  const flows = [];       // Array of { sourceId, targetId, weight }

  // Helper to get value from item
  const getValue = (item, source, field) => {
    if (source === 'Audiences' || source === 'Audience') {
      if (field === 'Name') return item.audience?.name || '';
      if (field === 'Product') return item.audience?.product || '';
      if (field === 'Strategy') return item.audience?.strategy || '';
      if (field === 'Data_source') return item.audience?.data_source || '';
      if (field === 'Targeting_type') return item.audience?.targeting_type || '';
      return item.audience?.[field.toLowerCase()] || '';
    }
    if (source === 'Topics' || source === 'Topic') {
      if (field === 'Name') return item.topic?.name || '';
      return item.topic?.[field.toLowerCase()] || '';
    }
    if (source === 'Messages' || source === 'Message') {
      if (field === 'Number') return String(item.message?.number || '');
      if (field === 'Variant') return item.message?.variant || '';
      return item.message?.[field.toLowerCase()] || '';
    }
    return '';
  };

  // Initialize level node maps
  levels.forEach(() => levelNodes.push(new Map()));

  // Build unique nodes at each level and count flows
  const flowCounts = new Map(); // "sourceId->targetId" -> count

  allMessages.forEach(item => {
    let prevNodeId = null;

    levels.forEach((level, levelIndex) => {
      const value = getValue(item, level.source, level.field) || 'Unknown';
      const nodeId = `L${levelIndex}_${value}`;

      // Add node if not exists
      if (!levelNodes[levelIndex].has(value)) {
        levelNodes[levelIndex].set(value, {
          id: nodeId,
          value,
          label: value,
          level: levelIndex,
          source: level.source,
          field: level.field,
          weight: 0,
          originalData: level.source.includes('Audience') ? item.audience :
                        level.source.includes('Topic') ? item.topic : item.message
        });
      }

      // Increment weight
      levelNodes[levelIndex].get(value).weight++;

      // Add flow from previous level
      if (prevNodeId) {
        const flowKey = `${prevNodeId}->${nodeId}`;
        flowCounts.set(flowKey, (flowCounts.get(flowKey) || 0) + 1);
      }

      prevNodeId = nodeId;
    });
  });

  // Convert to arrays
  const nodes = levelNodes.map(levelMap => Array.from(levelMap.values()));

  // Convert flow counts to flow objects
  flowCounts.forEach((weight, key) => {
    const [sourceId, targetId] = key.split('->');
    // Extract source level from sourceId (format: "L{level}_{value}")
    const sourceLevel = parseInt(sourceId.substring(1, sourceId.indexOf('_'))) || 0;
    flows.push({ sourceId, targetId, weight, sourceLevel });
  });

  // Add helper methods to nodes
  nodes.flat().forEach(node => {
    node.getDisplayText = (maxLength = 20) => {
      const text = node.value || '';
      if (text.length <= maxLength) return text;
      return text.substring(0, maxLength - 2) + '...';
    };
  });

  return {
    nodes,      // Array of arrays (nodes per level)
    flows,      // Array of { sourceId, targetId, weight }
    levelCount: levels.length,
    levelLabels: levels.map(l => l.field)
  };
};

/**
 * Main hook for SankeyView (Sankey diagram)
 */
export function useSankey({
  audiences,
  topics,
  getMessages,
  treeStructure,
  statusFilters,
  lookAndFeel,
  onZoomChange,
  viewType = 'linear'
}) {
  // Canvas and container refs
  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  // Layout and renderer instances (persistent)
  const layoutRef = useRef(null);
  const rendererRef = useRef(null);
  const interactionRef = useRef(null);

  // Animation frame ref for smooth hover transitions
  const animationFrameRef = useRef(null);

  // View state
  const [zoom, setZoom] = useState(0.5);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [flowScale, setFlowScale] = useState(6); // Pixels per unit weight (height)
  const [levelSpacing, setLevelSpacing] = useState(400); // Horizontal spacing between levels
  const [textScale, setTextScale] = useState(1.0); // Text size multiplier
  const [hoveredNode, setHoveredNode] = useState(null); // Currently hovered node
  const [selectedNode, setSelectedNode] = useState(null); // Currently selected node

  // Container dimensions
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const dimensionsRef = useRef({ width: 0, height: 0 });

  // Animation frame refs
  const navAnimationRef = useRef(null);

  // Store data in refs for callbacks
  const sankeyDataRef = useRef(null);
  const hoveredNodeRef = useRef(null);
  const selectedNodeRef = useRef(null);
  const textScaleRef = useRef(1.0);
  const viewTypeRef = useRef('linear');

  // Build convergent Sankey data (memoized)
  const sankeyData = useMemo(() => {
    // Use fallback tree structure if none provided
    const effectiveTreeStructure = treeStructure || 'Audiences.Name -> Topics.Name -> Messages.Number';

    if (!audiences || !topics || !getMessages) {
      return { nodes: [], flows: [], levelCount: 0 };
    }
    return buildSankeyData(audiences, topics, getMessages, effectiveTreeStructure, statusFilters);
  }, [audiences, topics, getMessages, treeStructure, statusFilters]);

  // Initialize layout instance (horizontal Sankey)
  if (!layoutRef.current) {
    layoutRef.current = new SankeyLayout({
      levelSpacing: 400,  // Horizontal spacing
      flowScale: 6,       // Height per unit weight
      nodeWidth: 60       // Width of node bars (3x wider)
    });
  }

  // Calculate layout (memoized) - re-run when scales change or viewType changes
  const layoutResult = useMemo(() => {
    if (!sankeyData.nodes || sankeyData.nodes.length === 0) {
      return { bounds: { minX: 0, maxX: 0, minY: 0, maxY: 0 } };
    }

    // Update layout configuration
    layoutRef.current.setFlowScale(flowScale);
    layoutRef.current.setLevelSpacing(levelSpacing);

    // Use radial layout for circular view, linear for standard view
    let bounds;
    if (viewType === 'circular') {
      bounds = layoutRef.current.layoutConvergentRadial(sankeyData.nodes, sankeyData.flows, sankeyData.levelCount);
    } else {
      bounds = layoutRef.current.layoutConvergent(sankeyData.nodes, sankeyData.flows, sankeyData.levelCount);
    }
    return { bounds };
  }, [sankeyData, flowScale, levelSpacing, viewType]);

  // Handle update callback (for interaction) - directly render with animation support
  const handleUpdate = useCallback(() => {
    if (interactionRef.current && rendererRef.current && sankeyDataRef.current) {
      // Update React state for UI display
      setZoom(interactionRef.current.zoom);
      setPan({ ...interactionRef.current.pan });

      // Cancel any pending animation frame
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }

      // Choose render method based on view type
      const renderMethod = viewTypeRef.current === 'circular'
        ? 'renderConvergentRadial'
        : 'renderConvergent';

      // Directly render
      const needsMoreFrames = rendererRef.current[renderMethod](
        sankeyDataRef.current.nodes,
        sankeyDataRef.current.flows,
        interactionRef.current.zoom,
        interactionRef.current.pan,
        {
          width: dimensionsRef.current.width,
          height: dimensionsRef.current.height
        },
        hoveredNodeRef.current,
        textScaleRef.current,
        selectedNodeRef.current
      );

      // Continue animation if more frames are needed
      if (needsMoreFrames) {
        const animate = () => {
          if (rendererRef.current && sankeyDataRef.current && interactionRef.current) {
            const stillNeedsFrames = rendererRef.current[renderMethod](
              sankeyDataRef.current.nodes,
              sankeyDataRef.current.flows,
              interactionRef.current.zoom,
              interactionRef.current.pan,
              {
                width: dimensionsRef.current.width,
                height: dimensionsRef.current.height
              },
              hoveredNodeRef.current,
              textScaleRef.current,
              selectedNodeRef.current
            );
            if (stillNeedsFrames) {
              animationFrameRef.current = requestAnimationFrame(animate);
            }
          }
        };
        animationFrameRef.current = requestAnimationFrame(animate);
      }
    }
  }, []);

  // Initialize renderer
  const initRenderer = useCallback((canvas) => {
    if (!canvas) return;

    rendererRef.current = new SankeyRenderer(canvas, {
      nodeWidth: 60
    });

    canvasRef.current = canvas;
  }, []);

  // Update refs when data changes
  sankeyDataRef.current = sankeyData;
  textScaleRef.current = textScale;
  selectedNodeRef.current = selectedNode;
  viewTypeRef.current = viewType;

  // Store selectAndCenterNode in ref for use in initInteraction
  const selectAndCenterNodeRef = useRef(null);

  // Handle mouse move for hover detection
  const handleMouseMove = useCallback((e) => {
    if (!rendererRef.current || !sankeyDataRef.current || !interactionRef.current) return;

    // Only process if target is the canvas element
    if (e.target.tagName !== 'CANVAS') {
      // Clear hover when leaving canvas area
      if (hoveredNodeRef.current !== null) {
        hoveredNodeRef.current = null;
        setHoveredNode(null);
      }
      return;
    }

    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;

    // Choose find method based on view type
    const findMethod = viewTypeRef.current === 'circular'
      ? 'findNodeAtPositionRadial'
      : 'findNodeAtPositionConvergent';

    const node = rendererRef.current[findMethod](
      sankeyDataRef.current.nodes,
      screenX,
      screenY,
      interactionRef.current.zoom,
      interactionRef.current.pan
    );

    hoveredNodeRef.current = node;
    setHoveredNode(node);
  }, []);

  // Handle mouse leave
  const handleMouseLeave = useCallback(() => {
    hoveredNodeRef.current = null;
    setHoveredNode(null);
  }, []);

  // Initialize interaction
  const initInteraction = useCallback((container, onNodeDoubleClick) => {
    if (!container) return;

    // Clean up existing
    if (interactionRef.current) {
      interactionRef.current.detach();
    }

    // Add mouse move listener for hover
    container.addEventListener('mousemove', handleMouseMove);
    container.addEventListener('mouseleave', handleMouseLeave);

    interactionRef.current = new TreeInteraction({
      initialZoom: 0.5,
      initialPanX: 0,
      initialPanY: 0,
      minZoom: 0.01,
      maxZoom: 5,
      onUpdate: handleUpdate,
      onNodeClick: (screenX, screenY) => {
        if (rendererRef.current && sankeyDataRef.current) {
          const findMethod = viewTypeRef.current === 'circular'
            ? 'findNodeAtPositionRadial'
            : 'findNodeAtPositionConvergent';
          const node = rendererRef.current[findMethod](
            sankeyDataRef.current.nodes,
            screenX,
            screenY,
            interactionRef.current.zoom,
            interactionRef.current.pan
          );
          if (node && selectAndCenterNodeRef.current) {
            selectAndCenterNodeRef.current(node);
          }
        }
      },
      onNodeDoubleClick: (screenX, screenY) => {
        if (rendererRef.current && sankeyDataRef.current) {
          const findMethod = viewTypeRef.current === 'circular'
            ? 'findNodeAtPositionRadial'
            : 'findNodeAtPositionConvergent';
          const node = rendererRef.current[findMethod](
            sankeyDataRef.current.nodes,
            screenX,
            screenY,
            interactionRef.current.zoom,
            interactionRef.current.pan
          );
          if (node && onNodeDoubleClick) {
            onNodeDoubleClick(node);
          }
        }
      }
    });

    interactionRef.current.attach(container);
    containerRef.current = container;

    // Cleanup function
    return () => {
      container.removeEventListener('mousemove', handleMouseMove);
      container.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [handleUpdate, handleMouseMove, handleMouseLeave]);

  // Render the diagram with animation loop support
  const render = useCallback(() => {
    if (!rendererRef.current || !sankeyData.nodes) return;

    // Cancel any pending animation frame
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    const currentZoom = interactionRef.current?.zoom || zoom;
    const currentPan = interactionRef.current?.pan || pan;

    // Choose render method based on view type
    const renderMethod = viewType === 'circular'
      ? 'renderConvergentRadial'
      : 'renderConvergent';

    const needsMoreFrames = rendererRef.current[renderMethod](
      sankeyData.nodes,
      sankeyData.flows,
      currentZoom,
      currentPan,
      {
        width: dimensions.width,
        height: dimensions.height
      },
      hoveredNode,
      textScale,
      selectedNode
    );

    // Continue animation if more frames are needed
    if (needsMoreFrames) {
      animationFrameRef.current = requestAnimationFrame(render);
    }
  }, [sankeyData, zoom, pan, dimensions, flowScale, levelSpacing, textScale, hoveredNode, viewType]);

  // Fit diagram to view
  const fitToView = useCallback(() => {
    if (interactionRef.current && layoutResult.bounds && dimensions.width > 0) {
      interactionRef.current.fitToView(
        layoutResult.bounds,
        dimensions.width,
        dimensions.height
      );
    }
  }, [layoutResult.bounds, dimensions]);

  // Zoom controls
  const zoomIn = useCallback(() => {
    if (interactionRef.current) {
      interactionRef.current.zoomIn();
    }
  }, []);

  const zoomOut = useCallback(() => {
    if (interactionRef.current) {
      interactionRef.current.zoomOut();
    }
  }, []);

  const resetZoom = useCallback(() => {
    if (interactionRef.current) {
      interactionRef.current.reset();
    }
  }, []);

  // Update dimensions
  const updateDimensions = useCallback((width, height) => {
    dimensionsRef.current = { width, height };
    setDimensions({ width, height });

    if (rendererRef.current) {
      rendererRef.current.resize(width, height);
    }
  }, []);

  // Center on a specific node with animation (no zoom change)
  const centerOnNode = useCallback((node) => {
    if (!node || !interactionRef.current || !dimensionsRef.current.width) return;

    // Cancel any existing navigation animation
    if (navAnimationRef.current) {
      cancelAnimationFrame(navAnimationRef.current);
      navAnimationRef.current = null;
    }

    // Calculate node center - use centerX/centerY for radial nodes
    let nodeCenterX, nodeCenterY;
    if (viewTypeRef.current === 'circular' && node.centerX !== undefined) {
      nodeCenterX = node.centerX;
      nodeCenterY = node.centerY;
    } else {
      nodeCenterX = (node.xStart + node.xEnd) / 2;
      nodeCenterY = (node.yStart + node.yEnd) / 2;
    }

    // Keep current zoom level
    const targetZoom = interactionRef.current.zoom;

    // Calculate target pan to center the node (without changing zoom)
    const targetPanX = dimensionsRef.current.width / 2 - nodeCenterX * targetZoom;
    const targetPanY = dimensionsRef.current.height / 2 - nodeCenterY * targetZoom;

    // Animate to target
    const startZoom = interactionRef.current.zoom;
    const startPanX = interactionRef.current.pan.x;
    const startPanY = interactionRef.current.pan.y;
    const duration = 300; // ms
    const startTime = performance.now();

    const animate = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);

      const currentZoom = startZoom + (targetZoom - startZoom) * eased;
      const currentPanX = startPanX + (targetPanX - startPanX) * eased;
      const currentPanY = startPanY + (targetPanY - startPanY) * eased;

      interactionRef.current.zoom = currentZoom;
      interactionRef.current.pan.x = currentPanX;
      interactionRef.current.pan.y = currentPanY;

      // Update state and render
      setZoom(currentZoom);
      setPan({ x: currentPanX, y: currentPanY });

      if (rendererRef.current && sankeyDataRef.current) {
        const renderMethod = viewTypeRef.current === 'circular'
          ? 'renderConvergentRadial'
          : 'renderConvergent';
        rendererRef.current[renderMethod](
          sankeyDataRef.current.nodes,
          sankeyDataRef.current.flows,
          currentZoom,
          { x: currentPanX, y: currentPanY },
          {
            width: dimensionsRef.current.width,
            height: dimensionsRef.current.height
          },
          hoveredNodeRef.current,
          textScaleRef.current,
          selectedNodeRef.current
        );
      }

      if (progress < 1) {
        navAnimationRef.current = requestAnimationFrame(animate);
      }
    };

    navAnimationRef.current = requestAnimationFrame(animate);
  }, []);

  // Select a node (no auto-centering in Sankey view)
  const selectAndCenterNode = useCallback((node) => {
    setSelectedNode(node);
    // Don't auto-center - user can manually center with nav panel if desired
  }, []);

  // Update ref for use in initInteraction
  selectAndCenterNodeRef.current = selectAndCenterNode;

  // Navigation functions
  const navigateToPrevSibling = useCallback(() => {
    const current = selectedNodeRef.current;
    if (!current || !sankeyDataRef.current) return;

    // Find the level containing this node
    const levelIndex = current.level;
    const levelNodes = sankeyDataRef.current.nodes[levelIndex];
    if (!levelNodes) return;

    const currentIndex = levelNodes.findIndex(n => n.id === current.id);
    if (currentIndex > 0) {
      selectAndCenterNode(levelNodes[currentIndex - 1]);
    }
  }, [selectAndCenterNode]);

  const navigateToNextSibling = useCallback(() => {
    const current = selectedNodeRef.current;
    if (!current || !sankeyDataRef.current) return;

    // Find the level containing this node
    const levelIndex = current.level;
    const levelNodes = sankeyDataRef.current.nodes[levelIndex];
    if (!levelNodes) return;

    const currentIndex = levelNodes.findIndex(n => n.id === current.id);
    if (currentIndex >= 0 && currentIndex < levelNodes.length - 1) {
      selectAndCenterNode(levelNodes[currentIndex + 1]);
    }
  }, [selectAndCenterNode]);

  const navigateToParent = useCallback(() => {
    const current = selectedNodeRef.current;
    if (!current || !sankeyDataRef.current) return;

    // Find a flow that targets this node
    const incomingFlow = sankeyDataRef.current.flows.find(f => f.targetId === current.id);
    if (!incomingFlow) return;

    // Find the source node
    const prevLevelIndex = current.level - 1;
    if (prevLevelIndex < 0) return;

    const prevLevelNodes = sankeyDataRef.current.nodes[prevLevelIndex];
    const sourceNode = prevLevelNodes?.find(n => n.id === incomingFlow.sourceId);
    if (sourceNode) {
      selectAndCenterNode(sourceNode);
    }
  }, [selectAndCenterNode]);

  const navigateToChild = useCallback(() => {
    const current = selectedNodeRef.current;
    if (!current || !sankeyDataRef.current) return;

    // Find a flow that starts from this node
    const outgoingFlow = sankeyDataRef.current.flows.find(f => f.sourceId === current.id);
    if (!outgoingFlow) return;

    // Find the target node
    const nextLevelIndex = current.level + 1;
    if (nextLevelIndex >= sankeyDataRef.current.nodes.length) return;

    const nextLevelNodes = sankeyDataRef.current.nodes[nextLevelIndex];
    const targetNode = nextLevelNodes?.find(n => n.id === outgoingFlow.targetId);
    if (targetNode) {
      selectAndCenterNode(targetNode);
    }
  }, [selectAndCenterNode]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (interactionRef.current) {
        interactionRef.current.detach();
      }
      // Cancel any pending animation frame
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (navAnimationRef.current) {
        cancelAnimationFrame(navAnimationRef.current);
      }
    };
  }, []);

  // Notify parent when zoom changes
  useEffect(() => {
    if (onZoomChange) {
      onZoomChange(zoom);
    }
  }, [zoom, onZoomChange]);

  // Track previous viewType to detect changes and trigger fit
  const prevViewTypeRef = useRef(viewType);
  const pendingFitRef = useRef(false);

  // Mark that we need a fit when viewType changes
  useEffect(() => {
    if (prevViewTypeRef.current !== viewType) {
      prevViewTypeRef.current = viewType;
      pendingFitRef.current = true;
    }
  }, [viewType]);

  // Auto fit when bounds change after viewType change
  // This ensures we fit AFTER slider values have been loaded and layout recalculated
  useEffect(() => {
    if (!pendingFitRef.current) return;

    const timerId = setTimeout(() => {
      if (interactionRef.current && dimensionsRef.current.width > 0 && layoutRef.current) {
        const bounds = layoutRef.current.bounds;
        if (bounds && bounds.maxX > bounds.minX) {
          interactionRef.current.fitToView(
            bounds,
            dimensionsRef.current.width,
            dimensionsRef.current.height
          );
          handleUpdate();
          pendingFitRef.current = false;
        }
      }
    }, 150); // Longer delay to ensure slider values have settled

    return () => clearTimeout(timerId);
  }, [layoutResult.bounds, handleUpdate]);

  return {
    // Data
    nodes: sankeyData.nodes,
    flows: sankeyData.flows,
    levelCount: sankeyData.levelCount,
    levelLabels: sankeyData.levelLabels,
    bounds: layoutResult.bounds,

    // State
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
    dimensions,

    // Refs
    canvasRef,
    containerRef,

    // Methods
    initRenderer,
    initInteraction,
    render,
    fitToView,
    zoomIn,
    zoomOut,
    resetZoom,
    updateDimensions,

    // Navigation
    selectAndCenterNode,
    centerOnNode,
    navigateToParent,
    navigateToChild,
    navigateToPrevSibling,
    navigateToNextSibling,

    // Instances (for advanced use)
    getLayout: () => layoutRef.current,
    getRenderer: () => rendererRef.current,
    getInteraction: () => interactionRef.current
  };
}

export default useSankey;
