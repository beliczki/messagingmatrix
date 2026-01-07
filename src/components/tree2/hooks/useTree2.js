/**
 * useTree2 - React hook for Tree2View state management
 * Handles tree data, layout, and interaction state
 */

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { buildTree2 } from '../utils/tree2Builder.js';
import { TreeLayout } from '../classes/TreeLayout.js';
import { TreeRenderer } from '../classes/TreeRenderer.js';
import { TreeInteraction } from '../classes/TreeInteraction.js';

/**
 * Main hook for Tree2View
 */
export function useTree2({
  audiences,
  topics,
  getMessages,
  treeStructure,
  statusFilters,
  lookAndFeel,
  onZoomChange,
  orientation = 'vertical'
}) {
  // Canvas and container refs
  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  // Layout and renderer instances (persistent)
  const layoutRef = useRef(null);
  const rendererRef = useRef(null);
  const interactionRef = useRef(null);

  // View state
  const [zoom, setZoom] = useState(0.5);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [connectorType, setConnectorType] = useState('curved');
  const [nodeScale, setNodeScale] = useState(1.0);
  const [layerHeightScale, setLayerHeightScale] = useState(1.0);
  const [scaleBase, setScaleBase] = useState(50);  // Exponential base for level scaling
  const [hoveredNode, setHoveredNode] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);

  // Container dimensions
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const dimensionsRef = useRef({ width: 0, height: 0 });

  // Store nodes and hovered node in refs for callbacks
  const nodesRef = useRef(null);
  const hoveredNodeRef = useRef(null);
  const selectedNodeRef = useRef(null);

  // Animation frame refs
  const hoverAnimationRef = useRef(null);
  const navAnimationRef = useRef(null);

  // Build tree data (memoized)
  const treeData = useMemo(() => {
    if (!audiences || !topics || !getMessages || !treeStructure) {
      return { nodes: [], levelCount: 0 };
    }
    return buildTree2(audiences, topics, getMessages, treeStructure, statusFilters);
  }, [audiences, topics, getMessages, treeStructure, statusFilters]);

  // Initialize layout instance
  if (!layoutRef.current) {
    layoutRef.current = new TreeLayout({
      levelSpacing: 160,
      nodeSpacing: 20,
      branchSpacing: 40,
      baseNodeWidth: 140,
      baseNodeHeight: 50
    });
  }

  // Calculate layout (memoized) - re-run when scales or orientation change
  const layoutResult = useMemo(() => {
    if (!treeData.nodes || treeData.nodes.length === 0) {
      return { bounds: { minX: 0, maxX: 0, minY: 0, maxY: 0 } };
    }

    // Update layout scales and orientation before calculating
    layoutRef.current.setNodeScale(nodeScale);
    layoutRef.current.setLayerHeightScale(layerHeightScale);
    layoutRef.current.setScaleBase(scaleBase);
    layoutRef.current.setOrientation(orientation);

    const bounds = layoutRef.current.layout(treeData.nodes, treeData.levelCount);
    return { bounds };
  }, [treeData, nodeScale, layerHeightScale, scaleBase, orientation]);

  // Handle update callback (for interaction) - directly render instead of state update
  const handleUpdate = useCallback(() => {
    if (interactionRef.current && rendererRef.current && nodesRef.current) {
      // Update React state for UI display
      setZoom(interactionRef.current.zoom);
      setPan({ ...interactionRef.current.pan });

      // Cancel any pending hover animation
      if (hoverAnimationRef.current) {
        cancelAnimationFrame(hoverAnimationRef.current);
        hoverAnimationRef.current = null;
      }

      // Directly render - don't wait for React
      const needsMoreFrames = rendererRef.current.render(
        nodesRef.current,
        interactionRef.current.zoom,
        interactionRef.current.pan,
        {
          width: dimensionsRef.current.width,
          height: dimensionsRef.current.height,
          panX: interactionRef.current.pan.x,
          panY: interactionRef.current.pan.y
        },
        hoveredNodeRef.current,
        selectedNodeRef.current
      );

      // Continue animation if needed
      if (needsMoreFrames) {
        const animate = () => {
          if (rendererRef.current && nodesRef.current && interactionRef.current) {
            const stillNeedsFrames = rendererRef.current.render(
              nodesRef.current,
              interactionRef.current.zoom,
              interactionRef.current.pan,
              {
                width: dimensionsRef.current.width,
                height: dimensionsRef.current.height,
                panX: interactionRef.current.pan.x,
                panY: interactionRef.current.pan.y
              },
              hoveredNodeRef.current,
              selectedNodeRef.current
            );
            if (stillNeedsFrames) {
              hoverAnimationRef.current = requestAnimationFrame(animate);
            }
          }
        };
        hoverAnimationRef.current = requestAnimationFrame(animate);
      }
    }
  }, []);

  // Helper to trigger hover animation
  const triggerHoverAnimation = useCallback(() => {
    if (!rendererRef.current || !nodesRef.current || !interactionRef.current) return;

    // Cancel any pending animation
    if (hoverAnimationRef.current) {
      cancelAnimationFrame(hoverAnimationRef.current);
      hoverAnimationRef.current = null;
    }

    const animate = () => {
      if (rendererRef.current && nodesRef.current && interactionRef.current) {
        const needsMoreFrames = rendererRef.current.render(
          nodesRef.current,
          interactionRef.current.zoom,
          interactionRef.current.pan,
          {
            width: dimensionsRef.current.width,
            height: dimensionsRef.current.height,
            panX: interactionRef.current.pan.x,
            panY: interactionRef.current.pan.y
          },
          hoveredNodeRef.current,
          selectedNodeRef.current
        );
        if (needsMoreFrames) {
          hoverAnimationRef.current = requestAnimationFrame(animate);
        }
      }
    };
    hoverAnimationRef.current = requestAnimationFrame(animate);
  }, []);

  // Handle mouse move for hover detection
  const handleMouseMove = useCallback((e) => {
    if (!rendererRef.current || !nodesRef.current || !interactionRef.current) return;

    // Only process if target is the canvas element
    if (e.target.tagName !== 'CANVAS') {
      // Clear hover when leaving canvas area
      if (hoveredNodeRef.current !== null) {
        hoveredNodeRef.current = null;
        setHoveredNode(null);
        triggerHoverAnimation();
      }
      return;
    }

    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;

    const node = rendererRef.current.findNodeAtPosition(
      nodesRef.current,
      screenX,
      screenY,
      interactionRef.current.zoom,
      interactionRef.current.pan
    );

    // Only update if changed
    if (node !== hoveredNodeRef.current) {
      hoveredNodeRef.current = node;
      setHoveredNode(node);
      // Trigger animation for hover change
      triggerHoverAnimation();
    }
  }, [triggerHoverAnimation]);

  // Handle mouse leave
  const handleMouseLeave = useCallback(() => {
    if (hoveredNodeRef.current !== null) {
      hoveredNodeRef.current = null;
      setHoveredNode(null);
      // Trigger animation for hover change
      triggerHoverAnimation();
    }
  }, [triggerHoverAnimation]);

  // Initialize renderer (connector type is set separately via effect)
  const initRenderer = useCallback((canvas) => {
    if (!canvas) return;

    rendererRef.current = new TreeRenderer(canvas, {
      connectorColor: lookAndFeel?.secondary2 || '#94a3b8'
    });

    canvasRef.current = canvas;
  }, [lookAndFeel]);

  // Update nodesRef when tree data changes
  nodesRef.current = treeData.nodes;

  // Store selectAndCenterNode in ref for use in initInteraction
  const selectAndCenterNodeRef = useRef(null);

  // Initialize interaction - only once, not on zoom/pan changes
  const initInteraction = useCallback((container, onNodeDoubleClick) => {
    if (!container) return;

    // Clean up existing
    if (interactionRef.current) {
      interactionRef.current.detach();
    }

    // Add mouse move/leave listeners for hover detection
    container.addEventListener('mousemove', handleMouseMove);
    container.addEventListener('mouseleave', handleMouseLeave);

    interactionRef.current = new TreeInteraction({
      initialZoom: 0.5,
      initialPanX: 0,
      initialPanY: 0,
      onUpdate: handleUpdate,
      onNodeClick: (screenX, screenY) => {
        if (rendererRef.current && nodesRef.current) {
          const node = rendererRef.current.findNodeAtPosition(
            nodesRef.current,
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
        if (rendererRef.current && nodesRef.current) {
          const node = rendererRef.current.findNodeAtPosition(
            nodesRef.current,
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

    // Return cleanup function
    return () => {
      container.removeEventListener('mousemove', handleMouseMove);
      container.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [handleUpdate, handleMouseMove, handleMouseLeave]);

  // Render the tree
  const render = useCallback(() => {
    if (!rendererRef.current || !treeData.nodes) return;

    const currentZoom = interactionRef.current?.zoom || zoom;
    const currentPan = interactionRef.current?.pan || pan;

    rendererRef.current.render(
      treeData.nodes,
      currentZoom,
      currentPan,
      {
        width: dimensions.width,
        height: dimensions.height,
        panX: currentPan.x,
        panY: currentPan.y
      },
      hoveredNode,
      selectedNodeRef.current
    );
  }, [treeData.nodes, zoom, pan, dimensions, nodeScale, layerHeightScale, hoveredNode]);

  // Update connector type and re-render (only redraws canvas, not full component)
  useEffect(() => {
    if (rendererRef.current && nodesRef.current && interactionRef.current) {
      rendererRef.current.setConnectorType(connectorType);
      // Directly render without triggering React re-render
      rendererRef.current.render(
        nodesRef.current,
        interactionRef.current.zoom,
        interactionRef.current.pan,
        {
          width: dimensionsRef.current.width,
          height: dimensionsRef.current.height,
          panX: interactionRef.current.pan.x,
          panY: interactionRef.current.pan.y
        },
        hoveredNodeRef.current,
        selectedNodeRef.current
      );
    }
  }, [connectorType]);

  // Re-render when orientation changes (layout recalculates, needs to redraw)
  useEffect(() => {
    if (rendererRef.current && nodesRef.current && interactionRef.current) {
      // Directly render with new layout
      rendererRef.current.render(
        nodesRef.current,
        interactionRef.current.zoom,
        interactionRef.current.pan,
        {
          width: dimensionsRef.current.width,
          height: dimensionsRef.current.height,
          panX: interactionRef.current.pan.x,
          panY: interactionRef.current.pan.y
        },
        hoveredNodeRef.current,
        selectedNodeRef.current
      );
    }
  }, [orientation, layoutResult]);

  // Fit tree to view
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

  // Update selectedNodeRef
  selectedNodeRef.current = selectedNode;

  // Calculate bounds of a node and all its descendants (subtree)
  const calculateSubtreeBounds = useCallback((node) => {
    let minX = node.x - (node.width || 100) / 2;
    let maxX = node.x + (node.width || 100) / 2;
    let minY = node.y - (node.height || 50) / 2;
    let maxY = node.y + (node.height || 50) / 2;

    // Recursively include all children
    const includeChildren = (n) => {
      if (!n.children) return;
      for (const child of n.children) {
        const halfW = (child.width || 100) / 2;
        const halfH = (child.height || 50) / 2;
        minX = Math.min(minX, child.x - halfW);
        maxX = Math.max(maxX, child.x + halfW);
        minY = Math.min(minY, child.y - halfH);
        maxY = Math.max(maxY, child.y + halfH);
        includeChildren(child);
      }
    };
    includeChildren(node);

    return { minX, maxX, minY, maxY };
  }, []);

  // Center on a specific node with animation - fits entire subtree
  const centerOnNode = useCallback((node) => {
    if (!node || !interactionRef.current || !dimensionsRef.current.width) return;

    // Cancel any existing navigation animation
    if (navAnimationRef.current) {
      cancelAnimationFrame(navAnimationRef.current);
      navAnimationRef.current = null;
    }

    // Calculate bounds of the entire subtree (node + all descendants)
    const bounds = calculateSubtreeBounds(node);
    const subtreeWidth = bounds.maxX - bounds.minX;
    const subtreeHeight = bounds.maxY - bounds.minY;
    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = (bounds.minY + bounds.maxY) / 2;

    // Calculate target zoom to fit the subtree with padding
    const padding = 0.85; // Use 85% of viewport
    const targetZoom = Math.min(
      (dimensionsRef.current.width * padding) / subtreeWidth,
      (dimensionsRef.current.height * padding) / subtreeHeight,
      2.0 // Max zoom
    );

    // Calculate target pan to center the subtree
    const targetPanX = dimensionsRef.current.width / 2 - centerX * targetZoom;
    const targetPanY = dimensionsRef.current.height / 2 - centerY * targetZoom;

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

      if (rendererRef.current && nodesRef.current) {
        rendererRef.current.render(
          nodesRef.current,
          currentZoom,
          { x: currentPanX, y: currentPanY },
          {
            width: dimensionsRef.current.width,
            height: dimensionsRef.current.height,
            panX: currentPanX,
            panY: currentPanY
          },
          hoveredNodeRef.current,
          selectedNodeRef.current
        );
      }

      if (progress < 1) {
        navAnimationRef.current = requestAnimationFrame(animate);
      }
    };

    navAnimationRef.current = requestAnimationFrame(animate);
  }, [calculateSubtreeBounds]);

  // Select a node and center on it
  const selectAndCenterNode = useCallback((node) => {
    setSelectedNode(node);
    if (node) {
      centerOnNode(node);
    }
  }, [centerOnNode]);

  // Update ref for use in initInteraction
  selectAndCenterNodeRef.current = selectAndCenterNode;

  // Set default selected node to first root node when tree data changes
  useEffect(() => {
    if (treeData.nodes && treeData.nodes.length > 0 && !selectedNode) {
      setSelectedNode(treeData.nodes[0]);
    }
  }, [treeData.nodes, selectedNode]);

  // Find siblings of a node (same parent)
  const findSiblings = useCallback((node) => {
    if (!node || !node.parent) return [];
    return node.parent.children || [];
  }, []);

  // Find all nodes at the same level (depth) across all branches
  const findNodesAtLevel = useCallback((targetLevel) => {
    const nodesAtLevel = [];
    const traverse = (node) => {
      if (node.level === targetLevel) {
        nodesAtLevel.push(node);
      }
      if (node.children) {
        node.children.forEach(traverse);
      }
    };
    // Traverse from root nodes
    if (nodesRef.current) {
      nodesRef.current.forEach(traverse);
    }
    // Sort by position (x for vertical tree, y for horizontal)
    nodesAtLevel.sort((a, b) => {
      // Use x position as primary sort (works for both orientations after layout)
      return a.x - b.x;
    });
    return nodesAtLevel;
  }, []);

  // Navigation functions
  const navigateToParent = useCallback(() => {
    const current = selectedNodeRef.current;
    if (current && current.parent) {
      selectAndCenterNode(current.parent);
    }
  }, [selectAndCenterNode]);

  const navigateToChild = useCallback(() => {
    const current = selectedNodeRef.current;
    if (current && current.children && current.children.length > 0) {
      selectAndCenterNode(current.children[0]);
    }
  }, [selectAndCenterNode]);

  // Navigate to previous sibling (same parent only)
  const navigateToPrevSibling = useCallback(() => {
    const current = selectedNodeRef.current;
    if (!current) return;

    const siblings = findSiblings(current);
    const currentIndex = siblings.indexOf(current);
    if (currentIndex > 0) {
      selectAndCenterNode(siblings[currentIndex - 1]);
    }
  }, [selectAndCenterNode, findSiblings]);

  // Navigate to next sibling (same parent only)
  const navigateToNextSibling = useCallback(() => {
    const current = selectedNodeRef.current;
    if (!current) return;

    const siblings = findSiblings(current);
    const currentIndex = siblings.indexOf(current);
    if (currentIndex >= 0 && currentIndex < siblings.length - 1) {
      selectAndCenterNode(siblings[currentIndex + 1]);
    }
  }, [selectAndCenterNode, findSiblings]);

  // Navigate to previous node at same level (across branches)
  const navigateToPrevOnLevel = useCallback(() => {
    const current = selectedNodeRef.current;
    if (!current || current.level === undefined) return;

    const levelNodes = findNodesAtLevel(current.level);
    const currentIndex = levelNodes.findIndex(n => n.id === current.id);
    if (currentIndex > 0) {
      selectAndCenterNode(levelNodes[currentIndex - 1]);
    }
  }, [selectAndCenterNode, findNodesAtLevel]);

  // Navigate to next node at same level (across branches)
  const navigateToNextOnLevel = useCallback(() => {
    const current = selectedNodeRef.current;
    if (!current || current.level === undefined) return;

    const levelNodes = findNodesAtLevel(current.level);
    const currentIndex = levelNodes.findIndex(n => n.id === current.id);
    if (currentIndex >= 0 && currentIndex < levelNodes.length - 1) {
      selectAndCenterNode(levelNodes[currentIndex + 1]);
    }
  }, [selectAndCenterNode, findNodesAtLevel]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (interactionRef.current) {
        interactionRef.current.detach();
      }
      if (hoverAnimationRef.current) {
        cancelAnimationFrame(hoverAnimationRef.current);
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

  return {
    // Data
    nodes: treeData.nodes,
    levelCount: treeData.levelCount,
    bounds: layoutResult.bounds,

    // State
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
    navigateToPrevOnLevel,
    navigateToNextOnLevel,

    // Instances (for advanced use)
    getLayout: () => layoutRef.current,
    getRenderer: () => rendererRef.current,
    getInteraction: () => interactionRef.current
  };
}

export default useTree2;
