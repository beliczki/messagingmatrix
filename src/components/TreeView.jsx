import React, { useState, useRef } from 'react';
import { buildTree, parseTreeStructure } from '../utils/treeBuilder';
import {
  getLevelSpacing,
  getNodeSizeScale,
  getMinNodeSpacing,
  calculateBranchWidth,
  calculateDescendantsSpan,
  calculateTreeWidth,
  calculateTotalHeight
} from '../utils/treeLayout';

// Persistent state outside component to maintain zoom/pan when switching views
let persistentTreeState = {
  zoom: 0.5,
  pan: { x: 0, y: 0 },
  nodePositions: {},
  connectorType: 'curved',
  initialized: false
};

const TreeView = ({
  audiences,
  topics,
  messages,
  getMessages,
  statusFilters = [],
  zoom: externalZoom,
  setZoom: externalSetZoom,
  connectorType: externalConnectorType,
  setConnectorType: externalSetConnectorType,
  treeStructure = 'Product → Strategy → Targeting Type → Audience → Topic → Messages',
  onTreeStructureChange,
  lookAndFeel = {}
}) => {
  const [nodePositions, setNodePositions] = useState(persistentTreeState.nodePositions);
  const [dragging, setDragging] = useState(null);

  // Use external zoom/connector if provided, otherwise use internal state
  const zoom = externalZoom !== undefined ? externalZoom : persistentTreeState.zoom;
  const setZoom = externalSetZoom || (() => {});
  const connectorType = externalConnectorType !== undefined ? externalConnectorType : persistentTreeState.connectorType;
  const setConnectorType = externalSetConnectorType || (() => {});

  const [pan, setPan] = useState(persistentTreeState.pan);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [containerHeight, setContainerHeight] = useState(0);
  const svgRef = useRef(null);
  const containerRef = useRef(null);

  // Wrap getMessages to apply status filtering
  const getFilteredMessages = React.useCallback((topicKey, audienceKey) => {
    const allMessages = getMessages(topicKey, audienceKey);

    // Filter by status if any status filters are selected
    if (statusFilters.length === 0) {
      return allMessages;
    }

    return allMessages.filter(msg => {
      const msgStatus = (msg.status || 'PLANNED').toUpperCase();
      return statusFilters.includes(msgStatus);
    });
  }, [getMessages, statusFilters]);

  // Build tree data using the imported utility with filtered messages
  const treeData = buildTree(audiences, topics, getFilteredMessages, treeStructure);

  // Track tree data changes to reset custom node positions
  const [prevTreeKeys, setPrevTreeKeys] = React.useState(new Set());

  // Reset node positions when tree structure changes (messages added/removed)
  React.useEffect(() => {
    const currentTreeKeys = new Set();

    // Recursively collect all node keys from the tree
    const collectKeys = (nodes) => {
      Object.keys(nodes).forEach(key => {
        currentTreeKeys.add(key);
        if (nodes[key].children) {
          collectKeys(nodes[key].children);
        }
      });
    };

    collectKeys(treeData);

    // Check if tree structure has changed (keys added or removed)
    const keysAdded = Array.from(currentTreeKeys).some(key => !prevTreeKeys.has(key));
    const keysRemoved = Array.from(prevTreeKeys).some(key => !currentTreeKeys.has(key));

    if (keysAdded || keysRemoved) {
      // Tree structure changed - clear custom positions to prevent overlap
      setNodePositions({});
      persistentTreeState.nodePositions = {};
    }

    setPrevTreeKeys(currentTreeKeys);
  }, [messages, audiences, topics, treeStructure]);

  // Handle mouse down - start dragging
  const handleMouseDown = (e, nodeKey, nodeData, defaultX, defaultY) => {
    e.preventDefault();
    e.stopPropagation();
    const svg = svgRef.current;
    const rect = svg.getBoundingClientRect();
    const startX = (e.clientX - rect.left - pan.x) / zoom;
    const startY = (e.clientY - rect.top - pan.y) / zoom;

    const currentPos = getNodePosition(nodeKey, nodeData, defaultX, defaultY);

    setDragging({
      nodeKey: nodeKey,
      data: nodeData,
      offsetX: startX - currentPos.x,
      offsetY: startY - currentPos.y
    });
  };

  // Handle mouse move - update position while dragging
  const handleMouseMove = (e) => {
    if (!dragging) return;

    const svg = svgRef.current;
    const rect = svg.getBoundingClientRect();
    const x = (e.clientX - rect.left - pan.x) / zoom - dragging.offsetX;
    const y = (e.clientY - rect.top - pan.y) / zoom - dragging.offsetY;

    setNodePositions(prev => ({
      ...prev,
      [dragging.nodeKey]: { x, y }
    }));
  };

  // Handle mouse up - stop dragging
  const handleMouseUp = () => {
    setDragging(null);
    setIsPanning(false);
  };

  // Track spacebar state
  const [spacePressed, setSpacePressed] = React.useState(false);

  // Handle keyboard events for spacebar
  React.useEffect(() => {
    const handleKeyDown = (e) => {
      // Allow space in input fields, textareas, and contenteditable elements
      const target = e.target;
      const isInputField = target.tagName === 'INPUT' ||
                          target.tagName === 'TEXTAREA' ||
                          target.isContentEditable;

      if (e.code === 'Space' && !spacePressed && !isInputField) {
        e.preventDefault();
        setSpacePressed(true);
      }
    };

    const handleKeyUp = (e) => {
      // Allow space in input fields, textareas, and contenteditable elements
      const target = e.target;
      const isInputField = target.tagName === 'INPUT' ||
                          target.tagName === 'TEXTAREA' ||
                          target.isContentEditable;

      if (e.code === 'Space' && !isInputField) {
        e.preventDefault();
        setSpacePressed(false);
        setIsPanning(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [spacePressed]);

  // Update container height when it resizes
  React.useEffect(() => {
    const updateHeight = () => {
      // Calculate available height: viewport - menu (97px) - pane header (57px)
      // Note: Controls are overlayed, so no need to subtract their height
      const menuHeight = 97;
      const paneHeaderHeight = 57;
      const availableHeight = window.innerHeight - menuHeight - paneHeaderHeight;
      setContainerHeight(availableHeight);
    };

    updateHeight();
    window.addEventListener('resize', updateHeight);

    return () => {
      window.removeEventListener('resize', updateHeight);
    };
  }, []);

  // Auto-fit tree to viewport on initial load
  React.useEffect(() => {
    if (!persistentTreeState.initialized && containerRef.current && svgRef.current && containerHeight > 0) {
      const container = containerRef.current;
      const svg = svgRef.current;

      // Get dimensions
      const containerWidth = container.clientWidth;
      const svgWidth = svg.width.baseVal.value;
      const parsedLevels = parseTreeStructure(treeStructure);
      const levelCount = parsedLevels.length;
      const svgHeight = calculateTotalHeight(levelCount, 40);

      // Calculate zoom to fit: use 90% of container to leave some padding
      const zoomToFitWidth = (containerWidth * 0.9) / svgWidth;
      const zoomToFitHeight = (containerHeight * 0.9) / svgHeight;
      const optimalZoom = Math.min(zoomToFitWidth, zoomToFitHeight, 1); // Don't zoom in beyond 1x

      // Calculate pan to center the tree at the optimal zoom
      const scaledWidth = svgWidth * optimalZoom;
      const scaledHeight = svgHeight * optimalZoom;
      const centerX = (containerWidth - scaledWidth) / 2;
      const centerY = (containerHeight - scaledHeight) / 2;

      // Update zoom and pan
      setZoom(optimalZoom);
      setPan({ x: centerX, y: centerY });

      // Mark as initialized and persist
      persistentTreeState.initialized = true;
      persistentTreeState.zoom = optimalZoom;
      persistentTreeState.pan = { x: centerX, y: centerY };
    }
  }, [containerHeight]);

  // Persist state changes
  React.useEffect(() => {
    persistentTreeState.zoom = zoom;
  }, [zoom]);

  React.useEffect(() => {
    persistentTreeState.pan = pan;
  }, [pan]);

  React.useEffect(() => {
    persistentTreeState.nodePositions = nodePositions;
  }, [nodePositions]);

  React.useEffect(() => {
    persistentTreeState.connectorType = connectorType;
  }, [connectorType]);

  // Handle zoom with mouse wheel (only with Space)
  const handleWheel = React.useCallback((e) => {
    if (spacePressed) {
      e.preventDefault();

      const container = containerRef.current;
      if (!container) return;

      // Get container viewport dimensions
      const containerRect = container.getBoundingClientRect();
      const containerCenterX = containerRect.width / 2;
      const containerCenterY = containerRect.height / 2;

      // Calculate current center point in SVG coordinates (before zoom)
      const svgCenterX = (containerCenterX - pan.x) / zoom;
      const svgCenterY = (containerCenterY - pan.y) / zoom;

      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      const newZoom = Math.min(Math.max(0.1, zoom * delta), 3);

      // Calculate new pan to keep the center point fixed
      const newPanX = containerCenterX - svgCenterX * newZoom;
      const newPanY = containerCenterY - svgCenterY * newZoom;

      setZoom(newZoom);
      setPan({ x: newPanX, y: newPanY });
    }
  }, [spacePressed, zoom, pan]);

  // Attach wheel listener manually with passive: false to allow preventDefault
  React.useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      container.removeEventListener('wheel', handleWheel);
    };
  }, [handleWheel]);

  // Handle pan start
  const handlePanStart = (e) => {
    if (e.button === 1 || spacePressed) { // Middle mouse or Space+Left
      e.preventDefault();
      setIsPanning(true);
      setPanStart({
        x: e.clientX - pan.x,
        y: e.clientY - pan.y
      });
    }
  };

  // Handle pan move
  const handlePanMove = (e) => {
    if (isPanning) {
      const deltaX = e.clientX - panStart.x;
      const deltaY = e.clientY - panStart.y;
      setPan({
        x: deltaX,
        y: deltaY
      });
    }
  };

  // Zoom controls
  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev * 1.2, 3));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev * 0.8, 0.1));
  };

  const handleZoomReset = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const handleResetAll = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setNodePositions({});
  };

  // Get position for a node (custom or default)
  const getNodePosition = (nodeKey, nodeData, defaultX, defaultY) => {
    // Only return custom position if it exists for this specific node
    if (nodePositions.hasOwnProperty(nodeKey)) {
      return nodePositions[nodeKey];
    }
    return { x: defaultX, y: defaultY };
  };

  // Helper to render decision node
  const DecisionNode = ({ label, value, x, y, nodeKey, nodeData, color = '#6366f1', bgColor = '#e0e7ff', node, levelIndex, isRoot, totalLevels }) => {
    const pos = getNodePosition(nodeKey, nodeData, x, y);

    // Calculate size based on level - use getNodeSizeScale for consistency with connector calculations
    let sizeScale;
    let heightMultiplier = 1; // For making second-to-last level taller
    let valueTextSize = 14; // Base text size for value

    if (isRoot) {
      sizeScale = 3;
    } else {
      // Use getNodeSizeScale to ensure consistency with connector attachment calculations
      sizeScale = getNodeSizeScale(levelIndex, totalLevels);

      // Make second-to-last level (parents of leaves) taller with bigger text
      // Since getNodeSizeScale already returns 1.5 for this level, we only need a smaller additional multiplier
      if (levelIndex === totalLevels - 2) {
        heightMultiplier = 1.67; // 1.5 * 1.67 = 2.5x total height
        valueTextSize = 32; // Much bigger text for the number
      }
    }

    const width = 140 * sizeScale;
    const height = 40 * sizeScale * heightMultiplier;
    const borderRadius = 5 * sizeScale;

    // Use status-based coloring if node has children (for Message.Number nodes)
    let nodeColor = color;
    let nodeBgColor = bgColor;

    if (node && node.children && Object.keys(node.children).length > 0 && node.field === 'Number') {
      // This is a Message.Number node - color by highest priority child status
      const childStatus = getChildrenStatus(node);
      const statusColor = getStatusColor(childStatus);
      nodeColor = statusColor;
      nodeBgColor = statusColor + '20'; // Add transparency
    }

    // Hide label if it's "Name" or "Number"
    const showLabel = label !== 'Name' && label !== 'Number';

    return (
      <g
        onMouseDown={(e) => handleMouseDown(e, nodeKey, nodeData, x, y)}
        className="transition-opacity hover:opacity-80"
      >
        <rect
          x={pos.x - width/2}
          y={pos.y - height/2}
          width={width}
          height={height}
          rx={borderRadius}
          fill={nodeColor}
          stroke="none"
        />
        {showLabel && (
          <text
            x={pos.x}
            y={pos.y - (6 * sizeScale)}
            textAnchor="middle"
            className="text-xs font-semibold pointer-events-none select-none fill-white"
            style={{ fontSize: `${12 * sizeScale}px` }}
          >
            {label}
          </text>
        )}
        <text
          x={pos.x}
          y={pos.y + (showLabel ? (10 * sizeScale) : (valueTextSize * sizeScale * 0.35))}
          textAnchor="middle"
          className="text-sm font-bold pointer-events-none select-none fill-white"
          style={{ fontSize: `${valueTextSize * sizeScale}px` }}
        >
          {value}
        </text>
      </g>
    );
  };

  // Status priority helper - higher number = higher priority
  const getStatusPriority = (status) => {
    const s = (status || '').toLowerCase();
    if (s.includes('error') || s.includes('failed')) return 5;  // ERROR - highest priority
    if (s === 'in progress' || s === 'paused') return 4;  // In progress/paused
    if (s === 'live' || s === 'running' || s === 'active') return 3;  // Active/green
    if (s === 'stopped' || s === 'paused') return 2;  // Stopped/paused
    if (s === 'planned' || s === 'draft') return 1;  // Planned - lowest priority
    return 0;  // Unknown
  };

  // Helper to get status color
  const getStatusColor = (status) => {
    const s = (status || '').toLowerCase();
    if (s.includes('error') || s.includes('failed')) return '#ef4444';  // Red - Error
    if (s === 'in progress') return '#f59e0b';  // Orange - In Progress
    if (s === 'live' || s === 'running' || s === 'active') return '#10b981';  // Green - Active
    if (s === 'stopped') return '#9ca3af';  // Gray - Stopped
    if (s === 'paused') return '#6b7280';  // Darker gray - Paused
    if (s === 'planned' || s === 'draft') return '#eab308';  // Yellow - Planned
    if (s === 'inactive') return '#6b7280';  // Gray - Inactive
    return '#6b7280';  // Default gray
  };

  // Get highest priority status among children
  const getChildrenStatus = (node) => {
    if (!node.children || Object.keys(node.children).length === 0) {
      // Leaf node - return its own status
      return node.data?.status || 'unknown';
    }

    // Has children - find highest priority status
    let highestPriority = 0;
    let highestStatus = 'unknown';

    const checkChildren = (children) => {
      Object.values(children).forEach(child => {
        if (child.data?.status) {
          const priority = getStatusPriority(child.data.status);
          if (priority > highestPriority) {
            highestPriority = priority;
            highestStatus = child.data.status;
          }
        }
        if (child.children) {
          checkChildren(child.children);
        }
      });
    };

    checkChildren(node.children);
    return highestStatus;
  };

  // Helper to render message card (leaf node)
  const MessageCard = ({ message, x, y, variant, nodeKey }) => {
    const pos = getNodePosition(nodeKey, message, x, y);

    const statusColor = getStatusColor(message.status);
    const displayVariant = variant || message.variant;

    // Smaller variant cards
    const cardWidth = 60;
    const cardHeight = 40;
    const fontSize = 24;

    return (
      <g
        onMouseDown={(e) => handleMouseDown(e, nodeKey, message, x, y)}
        className="transition-opacity hover:opacity-80"
      >
        <rect
          x={pos.x - cardWidth/2}
          y={pos.y - cardHeight/2}
          width={cardWidth}
          height={cardHeight}
          rx={8}
          fill={statusColor}
          stroke="none"
        />
        <text
          x={pos.x}
          y={pos.y + fontSize / 3}
          textAnchor="middle"
          className="font-bold fill-white pointer-events-none select-none"
          style={{ fontSize: `${fontSize}px` }}
        >
          {displayVariant}
        </text>
      </g>
    );
  };

  // Helper to draw connector with variable stroke width
  const Connector = ({ x1, y1, x2, y2, label, levelIndex }) => {
    const midY = (y1 + y2) / 2;

    // Calculate stroke width: 40px at level 0, scaling down to 1px at last level
    const maxStroke = 40;
    const minStroke = 1;
    let strokeWidth;
    if (levelCount > 1) {
      const progress = levelIndex / (levelCount - 1);
      strokeWidth = maxStroke - (maxStroke - minStroke) * progress;
    } else {
      strokeWidth = maxStroke;
    }

    if (connectorType === 'curved') {
      // Curved connector using cubic bezier
      const controlY = (y1 + y2) / 2;
      const path = `M ${x1} ${y1} C ${x1} ${controlY}, ${x2} ${controlY}, ${x2} ${y2}`;

      return (
        <g className="pointer-events-none">
          <path d={path} stroke="#94a3b8" strokeWidth={strokeWidth} fill="none" />
          {/* Label */}
          {label && (
            <text
              x={(x1 + x2) / 2}
              y={midY - 5}
              textAnchor="middle"
              className="text-xs fill-gray-600 font-medium select-none"
            >
              {label}
            </text>
          )}
        </g>
      );
    }

    // Elbow connector (default)
    return (
      <g className="pointer-events-none">
        {/* Vertical line down */}
        <line x1={x1} y1={y1} x2={x1} y2={midY} stroke="#94a3b8" strokeWidth={strokeWidth} />
        {/* Horizontal line */}
        <line x1={x1} y1={midY} x2={x2} y2={midY} stroke="#94a3b8" strokeWidth={strokeWidth} />
        {/* Vertical line to target */}
        <line x1={x2} y1={midY} x2={x2} y2={y2} stroke="#94a3b8" strokeWidth={strokeWidth} />
        {/* Label */}
        {label && (
          <text
            x={(x1 + x2) / 2}
            y={midY - 5}
            textAnchor="middle"
            className="text-xs fill-gray-600 font-medium select-none"
          >
            {label}
          </text>
        )}
      </g>
    );
  };

  // Check if tree is empty
  if (Object.keys(treeData).length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        No messages to display in tree view
      </div>
    );
  }

  // Parse tree structure to get level count
  const parsedLevels = parseTreeStructure(treeStructure);
  const levelCount = parsedLevels.length;

  // Layout calculations - dynamic spacing based on tree depth
  const startY = 40; // Reduced from 80 to move first layer higher
  const leafSpacing = 65; // Space between leaf nodes (messages)

  // Color palette for different levels using secondary colors
  const secondaryColor1 = lookAndFeel.secondaryColor1 || '#eb4c79';
  const secondaryColor2 = lookAndFeel.secondaryColor2 || '#02a3a4';
  const secondaryColor3 = lookAndFeel.secondaryColor3 || '#711c7a';

  const levelColors = [
    { color: secondaryColor1, bgColor: secondaryColor1 + '20' },
    { color: secondaryColor2, bgColor: secondaryColor2 + '20' },
    { color: secondaryColor3, bgColor: secondaryColor3 + '20' },
    { color: secondaryColor1, bgColor: secondaryColor1 + '20' },
    { color: secondaryColor2, bgColor: secondaryColor2 + '20' },
    { color: secondaryColor3, bgColor: secondaryColor3 + '20' },
  ];

  // Calculate dimensions using imported utilities
  const svgWidth = calculateTreeWidth(treeData, levelCount, leafSpacing);
  const totalHeight = calculateTotalHeight(levelCount, startY);
  const svgHeight = containerHeight > 0 ? containerHeight : Math.max(1200, totalHeight);

  // Calculate total tree width to determine root X position
  const treeStartX = 200; // Left margin
  const treeEndX = svgWidth - 200; // Right margin
  const startX = (treeStartX + treeEndX) / 2; // Center of entire tree

  // Recursive function to render tree nodes
  const renderTreeLevel = (nodes, levelIndex, parentX, parentY, startXOffset) => {
    const entries = Object.entries(nodes);
    if (entries.length === 0) return null;

    // Calculate cumulative Y position using variable spacing
    let cumulativeY = startY;
    for (let i = 0; i <= levelIndex; i++) {
      cumulativeY += getLevelSpacing(i, levelCount);
    }
    const currentY = cumulativeY;
    const colors = levelColors[levelIndex % levelColors.length];
    const isLastLevel = levelIndex === levelCount - 1;

    // First pass: calculate total width and positions for centering
    let currentX = startXOffset;
    const nodeInfo = [];

    entries.forEach(([key, node], index) => {
      const branchWidth = calculateBranchWidth(node, levelCount, leafSpacing);
      const minX = currentX;
      const maxX = currentX + branchWidth;

      // Create consistent node key for position tracking
      // IMPORTANT: Use the tree's unique key for ALL nodes to avoid collisions
      // The tree key includes the full path and is guaranteed unique
      const nodeKey = key;
      const nodeData = node.data || node.value;

      // Calculate the actual span of descendants to center parent over them
      const descendantsSpan = calculateDescendantsSpan(node, minX, levelCount, leafSpacing);

      nodeInfo.push({
        key,
        node,
        nodeKey,
        nodeData,
        minX,
        maxX,
        branchWidth,
        descendantsSpan
      });

      currentX += branchWidth;
    });

    // Calculate center of all children
    const totalMinX = nodeInfo[0]?.minX || startXOffset;
    const totalMaxX = nodeInfo[nodeInfo.length - 1]?.maxX || startXOffset;
    const childrenCenterX = (totalMinX + totalMaxX) / 2;

    // Second pass: render connectors and nodes
    const connectors = [];
    const nodesElements = [];

    nodeInfo.forEach(({ key, node, nodeKey, nodeData, minX, maxX, branchWidth, descendantsSpan }) => {
      // Position node at center of its descendants' span for proper centering
      // This ensures parent nodes are centered over all their descendant leaves
      const defaultNodeX = (descendantsSpan.minX + descendantsSpan.maxX) / 2;
      const nodePos = getNodePosition(nodeKey, nodeData, defaultNodeX, currentY);

      // Render connector from parent - connectors rendered first for proper z-order
      if (parentX !== undefined && parentY !== undefined) {
        // Calculate connector attachment points based on node scaling
        const parentScale = levelIndex > 0 ? getNodeSizeScale(levelIndex - 1, levelCount) : 3; // parent node scale
        const currentScale = isLastLevel ? 0.5 : getNodeSizeScale(levelIndex, levelCount); // current node scale

        // Check if parent is at second-to-last level (has heightMultiplier)
        // Since getNodeSizeScale already returns 1.5 for second-to-last, we use 1.67 multiplier
        const parentHeightMultiplier = (levelIndex - 1) === levelCount - 2 ? 1.67 : 1;
        // Current node only gets heightMultiplier if it's at second-to-last level AND not last level
        const currentHeightMultiplier = (levelIndex === levelCount - 2 && !isLastLevel) ? 1.67 : 1;

        const parentHeight = levelIndex > 0 ? 40 * parentScale * parentHeightMultiplier : 200; // root is 200px tall
        const currentHeight = isLastLevel ? 40 : 40 * currentScale * currentHeightMultiplier;

        connectors.push(
          <Connector
            key={`connector-${key}`}
            x1={parentX}
            y1={parentY + (parentHeight / 2)}
            x2={nodePos.x}
            y2={nodePos.y - (currentHeight / 2)}
            levelIndex={levelIndex}
          />
        );
      }

      // Render node (either DecisionNode or MessageCard for last level)
      if (isLastLevel && node.data && node.data.type === 'message') {
        // Render as message card (leaf node showing variant)
        nodesElements.push(
          <MessageCard
            key={key}
            message={node.data}
            x={defaultNodeX}
            y={currentY}
            variant={node.value}
            nodeKey={nodeKey}
          />
        );
      } else {
        // Render as decision node
        nodesElements.push(
          <DecisionNode
            key={key}
            label={node.label || node.field || `Level ${levelIndex + 1}`}
            value={node.value || 'Unknown'}
            x={defaultNodeX}
            y={currentY}
            nodeKey={nodeKey}
            nodeData={nodeData}
            color={colors.color}
            bgColor={colors.bgColor}
            node={node}
            levelIndex={levelIndex}
            isRoot={false}
            totalLevels={levelCount}
          />
        );
      }

      // Recursively render children - pass the actual node position for connector alignment
      if (node.children && Object.keys(node.children).length > 0) {
        const childElements = renderTreeLevel(
          node.children,
          levelIndex + 1,
          nodePos.x,
          nodePos.y,
          minX
        );
        if (childElements) {
          nodesElements.push(
            <g key={`children-${key}`}>
              {childElements}
            </g>
          );
        }
      }
    });

    // Return connectors first, then nodes (for proper z-order)
    return [...connectors, ...nodesElements];
  };

  const [tempTreeStructure, setTempTreeStructure] = React.useState(treeStructure);
  const [hasChanges, setHasChanges] = React.useState(false);

  // Update tempTreeStructure when treeStructure prop changes
  React.useEffect(() => {
    setTempTreeStructure(treeStructure);
    setHasChanges(false);
  }, [treeStructure]);

  const handleInputChange = (e) => {
    setTempTreeStructure(e.target.value);
    setHasChanges(e.target.value !== treeStructure);
  };

  const handleSave = () => {
    onTreeStructureChange(tempTreeStructure);
    setHasChanges(false);
  };

  const handleCancel = () => {
    setTempTreeStructure(treeStructure);
    setHasChanges(false);
  };

  return (
    <div className="w-full h-full bg-white rounded-lg shadow select-none flex flex-col overflow-hidden">
      <div
        ref={containerRef}
        className="flex-1 bg-gray-100 overflow-hidden relative"
        onMouseMove={(e) => {
          handleMouseMove(e);
          handlePanMove(e);
        }}
        onMouseDown={handlePanStart}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{
          minHeight: 0
        }}
      >
        {/* Tree structure input overlay */}
        <div className="absolute top-4 left-4 z-10 flex items-center gap-2" style={{ width: '90%' }}>
          <label className="text-sm font-medium text-gray-700 whitespace-nowrap">
            Tree structure:
          </label>
          <input
            type="text"
            value={tempTreeStructure}
            onChange={handleInputChange}
            className="flex-1 px-3 py-2 bg-white border border-gray-300 rounded-lg shadow-sm text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
            placeholder="e.g., Product → Strategy → Targeting Type → Audience → Topic → Messages"
          />
          {hasChanges && (
            <>
              <button
                onClick={handleSave}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 shadow-sm"
              >
                Save
              </button>
              <button
                onClick={handleCancel}
                className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 shadow-sm"
              >
                Cancel
              </button>
            </>
          )}
        </div>

        <svg
          ref={svgRef}
          width={svgWidth}
          height={svgHeight}
          style={{
            userSelect: 'none',
            display: 'block',
            minHeight: '100%',
            minWidth: '100%'
          }}
        >
          <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
            {/* Root node - 3x bigger and blue */}
            <g
              onMouseDown={(e) => handleMouseDown(e, '__root__', { type: 'root' }, startX, startY)}
              className="transition-opacity hover:opacity-80"
            >
              <rect
                x={(() => {
                  const pos = getNodePosition('__root__', { type: 'root' }, startX, startY);
                  return pos.x - 360;
                })()}
                y={(() => {
                  const pos = getNodePosition('__root__', { type: 'root' }, startX, startY);
                  return pos.y - 100;
                })()}
                width={720}
                height={200}
                rx={24}
                fill="#2563eb"
                stroke="none"
              />
              <text
                x={(() => {
                  const pos = getNodePosition('__root__', { type: 'root' }, startX, startY);
                  return pos.x;
                })()}
                y={(() => {
                  const pos = getNodePosition('__root__', { type: 'root' }, startX, startY);
                  return pos.y + 15;
                })()}
                textAnchor="middle"
                className="fill-white select-none pointer-events-none"
                style={{ fontSize: '48px', fontWeight: 'bold' }}
              >
                Decision tree
              </text>
            </g>

            {/* Recursively render tree levels */}
            {renderTreeLevel(treeData, 0, (() => {
              const pos = getNodePosition('__root__', { type: 'root' }, startX, startY);
              return pos.x;
            })(), (() => {
              const pos = getNodePosition('__root__', { type: 'root' }, startX, startY);
              return pos.y;
            })(), treeStartX)}
          </g>
        </svg>
      </div>
    </div>
  );
};

export default TreeView;
