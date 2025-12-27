import React, { useState, useRef } from 'react';
import { buildTree, parseTreeStructure } from '../utils/treeBuilder';
import {
  getLevelSpacing,
  getNodeSizeScale,
  getMinNodeSpacing,
  calculateBranchWidth,
  calculateDescendantsSpan,
  calculateTreeWidth,
  calculateTotalHeight,
  calculateNodeWidth,
  splitTextIntoLines,
  getMaxChildrenPerLevel
} from '../utils/treeLayout';

// Persistent state outside component to maintain zoom/pan when switching views
let persistentTreeState = {
  zoom: 0.5,
  pan: { x: 0, y: 0 },
  nodePositions: {},
  connectorType: 'curved',
  layerHeight: 1.0, // Layer height multiplier (0.5 to 2.0)
  baseNodeSize: 1.0, // Base node size multiplier (0.5 to 2.0)
  flattenMode: false, // Toggle between tree and flat view
  initialized: false,
  prevTreeKeys: new Set() // Persist tree keys to detect actual structure changes
};

const TreeView = React.memo(({
  audiences,
  topics,
  messages,
  getMessages,
  statusFilters = [],
  zoom: externalZoom,
  setZoom: externalSetZoom,
  connectorType: externalConnectorType,
  setConnectorType: externalSetConnectorType,
  flattenMode: externalFlattenMode,
  onFlattenModeChange: externalOnFlattenModeChange,
  treeStructure = 'Product → Strategy → Targeting Type → Audience → Topic → Messages',
  onTreeStructureChange,
  lookAndFeel = {},
  // Edit callbacks for double-click functionality
  onEditAudience,
  onEditTopic,
  onEditMessage
}) => {
  console.log('🟣 TreeView component render', {
    audiencesLength: audiences?.length,
    topicsLength: topics?.length,
    messagesLength: messages?.length,
    zoom: externalZoom
  });
  const [nodePositions, setNodePositions] = useState(persistentTreeState.nodePositions);
  const [dragging, setDragging] = useState(null);
  const [tempTreeStructure, setTempTreeStructure] = React.useState(treeStructure);
  const [hasChanges, setHasChanges] = React.useState(false);
  const [layerHeight, setLayerHeight] = useState(persistentTreeState.layerHeight);
  const [baseNodeSize, setBaseNodeSize] = useState(persistentTreeState.baseNodeSize);
  const [internalFlattenMode, setInternalFlattenMode] = useState(persistentTreeState.flattenMode);
  const [showTreeStructure, setShowTreeStructure] = useState(false); // Toggle tree structure input visibility

  // Use external flattenMode if provided, otherwise use internal state
  const flattenMode = externalFlattenMode !== undefined ? externalFlattenMode : internalFlattenMode;
  const setFlattenMode = externalOnFlattenModeChange || setInternalFlattenMode;
  const [isDragging, setIsDragging] = useState(false); // Track if user is dragging (to prevent double-click during drag)

  // React to external flattenMode changes - reset node positions
  const prevFlattenModeRef = React.useRef(flattenMode);
  React.useEffect(() => {
    if (prevFlattenModeRef.current !== flattenMode) {
      console.log('🟣 Flatten mode changed to:', flattenMode);
      setNodePositions({});
      persistentTreeState.nodePositions = {};
      persistentTreeState.flattenMode = flattenMode;
      prevFlattenModeRef.current = flattenMode;
    }
  }, [flattenMode]);

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

  // Track dependency changes for debugging
  const getMessagesRef = React.useRef(getMessages);
  const statusFiltersRef = React.useRef(statusFilters);

  if (getMessagesRef.current !== getMessages) {
    console.log('🟠 TreeView: getMessages changed');
    getMessagesRef.current = getMessages;
  }
  if (statusFiltersRef.current !== statusFilters) {
    console.log('🟠 TreeView: statusFilters changed');
    statusFiltersRef.current = statusFilters;
  }

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

  // Track treeData dependency changes
  const audiencesRef = React.useRef(audiences);
  const topicsRef = React.useRef(topics);
  const getFilteredMessagesRef = React.useRef(getFilteredMessages);
  const treeStructureRef = React.useRef(treeStructure);

  if (audiencesRef.current !== audiences) {
    console.log('🔴 TreeView: audiences reference changed');
    audiencesRef.current = audiences;
  }
  if (topicsRef.current !== topics) {
    console.log('🔴 TreeView: topics reference changed');
    topicsRef.current = topics;
  }
  if (getFilteredMessagesRef.current !== getFilteredMessages) {
    console.log('🔴 TreeView: getFilteredMessages reference changed');
    getFilteredMessagesRef.current = getFilteredMessages;
  }
  if (treeStructureRef.current !== treeStructure) {
    console.log('🔴 TreeView: treeStructure reference changed');
    treeStructureRef.current = treeStructure;
  }

  // Build tree data using the imported utility with filtered messages
  // Memoize to prevent rebuilding on every render - only rebuild when inputs change
  const treeData = React.useMemo(() => {
    console.log('🟣 TreeView: buildTree called', {
      audiencesLength: audiences?.length,
      topicsLength: topics?.length,
      treeStructure
    });
    return buildTree(audiences, topics, getFilteredMessages, treeStructure);
  }, [audiences, topics, getFilteredMessages, treeStructure]);

  // Build flat levels data for flatten mode - unique values per level
  const flatLevels = React.useMemo(() => {
    if (!flattenMode) return [];

    const parsedLevels = parseTreeStructure(treeStructure);
    const levels = [];

    // Collect unique values at each level by traversing the tree
    const collectLevelValues = (nodes, levelIndex, collected = []) => {
      if (levelIndex >= parsedLevels.length) return;

      // Initialize level if not exists
      if (!collected[levelIndex]) {
        collected[levelIndex] = {
          level: levelIndex,
          source: parsedLevels[levelIndex].source,
          field: parsedLevels[levelIndex].field,
          label: parsedLevels[levelIndex].label,
          uniqueValues: new Map() // Map of value -> first node with that value
        };
      }

      Object.values(nodes).forEach(node => {
        const value = node.value;
        // Only add if we haven't seen this value at this level
        if (!collected[levelIndex].uniqueValues.has(value)) {
          collected[levelIndex].uniqueValues.set(value, {
            value,
            source: node.source,
            field: node.field,
            data: node.data,
            label: node.label
          });
        }

        // Recurse to children
        if (node.children && Object.keys(node.children).length > 0) {
          collectLevelValues(node.children, levelIndex + 1, collected);
        }
      });
    };

    collectLevelValues(treeData, 0, levels);

    // Convert Maps to arrays for easier rendering
    return levels.map(level => ({
      ...level,
      uniqueValues: Array.from(level.uniqueValues.values())
    }));
  }, [treeData, treeStructure, flattenMode]);

  // Reset node positions when tree structure changes (messages added/removed)
  React.useEffect(() => {
    console.log('🟣 TreeView: Reset positions useEffect fired');
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
    const keysAdded = Array.from(currentTreeKeys).some(key => !persistentTreeState.prevTreeKeys.has(key));
    const keysRemoved = Array.from(persistentTreeState.prevTreeKeys).some(key => !currentTreeKeys.has(key));

    const currentKeysArray = Array.from(currentTreeKeys);
    console.log('🟣 TreeView: Comparison', {
      currentTreeKeysSize: currentTreeKeys.size,
      prevTreeKeysSize: persistentTreeState.prevTreeKeys.size,
      keysAdded,
      keysRemoved,
      sampleCurrentKeys: currentKeysArray.slice(0, 3),
      samplePrevKeys: Array.from(persistentTreeState.prevTreeKeys).slice(0, 3)
    });

    if (currentTreeKeys.size <= 3) {
      console.log('🟣 TreeView: All current keys:', currentKeysArray);
    }

    // Only clear positions if keys were actually added or removed, not on zoom
    if ((keysAdded || keysRemoved) && currentTreeKeys.size > 0) {
      console.log('🟣 TreeView: Tree structure changed, clearing node positions');
      // Tree structure changed - clear custom positions to prevent overlap
      setNodePositions({});
      persistentTreeState.nodePositions = {};
    } else if (keysAdded || keysRemoved) {
      console.log('🟣 TreeView: Ignoring spurious tree structure change (zoom only)');
    }

    // Update persistent prevTreeKeys
    persistentTreeState.prevTreeKeys = currentTreeKeys;
  }, [messages, audiences, topics, treeStructure]);

  // DRAG FUNCTIONALITY DISABLED - Double-click edit is priority
  // Handle mouse down - disabled for now
  const handleMouseDown = (e, nodeKey, nodeData, defaultX, defaultY) => {
    e.stopPropagation();
    // Drag disabled to allow double-click to work
  };

  // Track mouse movement - disabled
  const dragStartPos = React.useRef(null);
  const handleMouseMoveForDrag = (e) => {
    // Disabled
  };

  // Handle mouse move - disabled
  const handleMouseMove = (e) => {
    // Disabled
  };

  // Handle mouse up
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
      const svgHeight = calculateTotalHeight(levelCount, 40, layerHeight, baseNodeSize);

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

  // Update tempTreeStructure when treeStructure prop changes
  React.useEffect(() => {
    setTempTreeStructure(treeStructure);
    setHasChanges(false);
  }, [treeStructure]);

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

  const handleLayerHeightChange = (e) => {
    const newHeight = parseFloat(e.target.value);
    setLayerHeight(newHeight);
    persistentTreeState.layerHeight = newHeight;
    // Reset node positions so new layout takes effect
    setNodePositions({});
    persistentTreeState.nodePositions = {};
  };

  const handleBaseNodeSizeChange = (e) => {
    const newSize = parseFloat(e.target.value);
    setBaseNodeSize(newSize);
    persistentTreeState.baseNodeSize = newSize;
    // Reset node positions so new layout takes effect
    setNodePositions({});
    persistentTreeState.nodePositions = {};
  };

  const handleFlattenModeToggle = (newMode) => {
    const mode = typeof newMode === 'boolean' ? newMode : !flattenMode;
    setFlattenMode(mode);
    persistentTreeState.flattenMode = mode;
    // Reset node positions when switching modes
    setNodePositions({});
    persistentTreeState.nodePositions = {};
  };

  // Fit and center the tree in the viewport
  const handleFitAndCenter = () => {
    if (!containerRef.current || !svgRef.current || containerHeight <= 0) return;

    const container = containerRef.current;
    const svg = svgRef.current;

    const containerWidth = container.clientWidth;
    const svgWidth = svg.width.baseVal.value;
    const parsedLevels = parseTreeStructure(treeStructure);
    const levelCount = parsedLevels.length;
    const svgHeight = calculateTotalHeight(levelCount, 40, layerHeight, baseNodeSize);

    // Calculate zoom to fit: use 90% of container to leave some padding
    const zoomToFitWidth = (containerWidth * 0.9) / svgWidth;
    const zoomToFitHeight = (containerHeight * 0.9) / svgHeight;
    const optimalZoom = Math.min(zoomToFitWidth, zoomToFitHeight, 1);

    // Calculate pan to center the tree at the optimal zoom
    const scaledWidth = svgWidth * optimalZoom;
    const scaledHeight = svgHeight * optimalZoom;
    const centerX = (containerWidth - scaledWidth) / 2;
    const centerY = (containerHeight - scaledHeight) / 2;

    setZoom(optimalZoom);
    setPan({ x: centerX, y: centerY });
    persistentTreeState.zoom = optimalZoom;
    persistentTreeState.pan = { x: centerX, y: centerY };
  };

  // Get position for a node (custom or default)
  const getNodePosition = (nodeKey, nodeData, defaultX, defaultY) => {
    // Only return custom position if it exists for this specific node
    if (nodePositions.hasOwnProperty(nodeKey)) {
      return nodePositions[nodeKey];
    }
    return { x: defaultX, y: defaultY };
  };

  // Handle double-click on a node to open edit dialog
  const handleNodeDoubleClick = (node) => {
    const source = node.source;
    const data = node.data;

    if (!data) {
      console.log('No data associated with this node');
      return;
    }

    // Determine which edit dialog to open based on the node's source type
    if ((source === 'Audiences' || source === 'Audience') && onEditAudience) {
      // Find the full audience object by key
      const audience = audiences.find(a => a.key === data.key);
      if (audience) {
        console.log('Opening audience editor:', audience.name);
        onEditAudience(audience);
      }
    } else if ((source === 'Topics' || source === 'Topic') && onEditTopic) {
      // Find the full topic object by key
      const topic = topics.find(t => t.key === data.key);
      if (topic) {
        console.log('Opening topic editor:', topic.name);
        onEditTopic(topic);
      }
    } else if ((source === 'Messages' || source === 'Message') && onEditMessage) {
      // For messages, the data is already the message object
      console.log('Opening message editor:', data.number, data.variant);
      onEditMessage(data);
    }
  };

  // Helper to render decision node
  const DecisionNode = ({ label, value, x, y, nodeKey, nodeData, color = '#6366f1', bgColor = '#e0e7ff', node, levelIndex, isRoot, totalLevels }) => {
    const pos = getNodePosition(nodeKey, nodeData, x, y);

    // Calculate size based on level - use getNodeSizeScale for consistency with connector calculations
    let sizeScale;
    let heightMultiplier = 1; // For making second-to-last level taller
    // Base text sizes - larger defaults (equivalent to old 1.8x node size)
    let valueTextSize = 25; // Was 14, now starts larger
    let labelTextSize = 22; // Was 12, now starts larger

    // Check if this is a Message node (Number or Variant) - these should NOT scale with baseNodeSize
    const isMessageNode = node && (node.source === 'Messages' || node.source === 'Message');

    if (isRoot) {
      sizeScale = 3;
    } else {
      // Use getNodeSizeScale to ensure consistency with connector attachment calculations
      sizeScale = getNodeSizeScale(levelIndex, totalLevels);

      // Make second-to-last level (parents of leaves) taller with bigger text
      // Since getNodeSizeScale already returns 1.5 for this level, we only need a smaller additional multiplier
      if (levelIndex === totalLevels - 2) {
        heightMultiplier = 1.67; // 1.5 * 1.67 = 2.5x total height
        valueTextSize = 32; // Original size for MC Number
      }
    }

    // Apply base node size multiplier from slider - but NOT to Message nodes (MC Number/Variant)
    if (!isMessageNode) {
      sizeScale = sizeScale * baseNodeSize;
    }

    // Calculate dynamic width based on text - uses shared function for consistency with layout
    // Pass actual label and value being rendered to ensure width matches
    const width = calculateNodeWidth(node, levelIndex, levelCount, baseNodeSize, label, value);

    // For non-last-level nodes, make height taller to fit two lines
    const isLastLevel = levelIndex === levelCount - 1;
    const twoLineHeightMultiplier = (!isLastLevel && !isMessageNode) ? 1.5 : 1;
    // Base height 70 (was 40) to accommodate larger fonts
    const baseHeight = 70;
    const height = baseHeight * sizeScale * heightMultiplier * twoLineHeightMultiplier;
    const borderRadius = 8 * sizeScale;

    // Font sizes - scale with sizeScale (which includes baseNodeSize for non-message nodes)
    const labelFontSize = labelTextSize * sizeScale;
    const valueFontSize = valueTextSize * sizeScale;

    // Split value text into lines for non-last-level nodes
    const valueLines = (!isLastLevel && value) ? splitTextIntoLines(value) : [value];

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

    // Check if this node is editable (has an edit callback for its type)
    const isEditable = node && (
      ((node.source === 'Audiences' || node.source === 'Audience') && onEditAudience) ||
      ((node.source === 'Topics' || node.source === 'Topic') && onEditTopic) ||
      ((node.source === 'Messages' || node.source === 'Message') && onEditMessage)
    );

    return (
      <g
        onMouseDown={(e) => handleMouseDown(e, nodeKey, nodeData, x, y)}
        onMouseMove={handleMouseMoveForDrag}
        onDoubleClick={() => node && handleNodeDoubleClick(node)}
        className="transition-opacity hover:opacity-80"
        style={{ cursor: isEditable ? 'pointer' : 'grab' }}
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
            y={pos.y - (height / 2) + labelFontSize + 4 * sizeScale}
            textAnchor="middle"
            className="text-xs font-semibold pointer-events-none select-none fill-white"
            style={{ fontSize: `${labelFontSize}px` }}
          >
            {label}
          </text>
        )}
        {valueLines.length === 1 ? (
          <text
            x={pos.x}
            y={pos.y + (showLabel ? (10 * sizeScale) : (valueFontSize * 0.35))}
            textAnchor="middle"
            className="text-sm font-bold pointer-events-none select-none fill-white"
            style={{ fontSize: `${valueFontSize}px` }}
          >
            {value}
          </text>
        ) : (
          <>
            <text
              x={pos.x}
              y={pos.y + (showLabel ? 0 : -valueFontSize * 0.3)}
              textAnchor="middle"
              className="text-sm font-bold pointer-events-none select-none fill-white"
              style={{ fontSize: `${valueFontSize}px` }}
            >
              {valueLines[0]}
            </text>
            <text
              x={pos.x}
              y={pos.y + (showLabel ? valueFontSize * 1.1 : valueFontSize * 0.8)}
              textAnchor="middle"
              className="text-sm font-bold pointer-events-none select-none fill-white"
              style={{ fontSize: `${valueFontSize}px` }}
            >
              {valueLines[1]}
            </text>
          </>
        )}
        {/* Tooltip - show full text and edit hint */}
        <title>{value}{isEditable ? ' (double-click to edit)' : ''}</title>
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

    // Smaller variant cards - fixed size (NOT affected by baseNodeSize)
    const cardWidth = 60;
    const cardHeight = 40;
    const fontSize = 24;

    // Handle double-click on message card
    const handleMessageDoubleClick = () => {
      if (onEditMessage && message) {
        console.log('Opening message editor from card:', message.number, message.variant);
        onEditMessage(message);
      }
    };

    return (
      <g
        onMouseDown={(e) => handleMouseDown(e, nodeKey, message, x, y)}
        onMouseMove={handleMouseMoveForDrag}
        onDoubleClick={handleMessageDoubleClick}
        className="transition-opacity hover:opacity-80"
        style={{ cursor: onEditMessage ? 'pointer' : 'grab' }}
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
        {/* Tooltip hint for editable message cards */}
        {onEditMessage && (
          <title>Double-click to edit message</title>
        )}
      </g>
    );
  };

  // Helper to draw connector with variable stroke width
  const Connector = ({ x1, y1, x2, y2, label, levelIndex }) => {
    const midY = (y1 + y2) / 2;

    // Calculate stroke width: 40px at level 0, scaling down to 1px at last level
    // Apply baseNodeSize multiplier for visual consistency
    const maxStroke = 40 * baseNodeSize;
    const minStroke = 1 * baseNodeSize;
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

  // Calculate max children per level for dynamic spacing
  const maxChildrenPerLevel = React.useMemo(() => {
    const result = getMaxChildrenPerLevel(treeData, levelCount);
    console.log('🌳 maxChildrenPerLevel:', result, 'levelCount:', levelCount);
    return result;
  }, [treeData, levelCount]);

  // Layout calculations - dynamic spacing based on tree depth and node size
  const startY = 40; // Reduced from 80 to move first layer higher
  // Scale spacing with baseNodeSize to prevent node overlap
  const leafSpacing = 65 + (baseNodeSize - 1) * 100; // Increases as nodes get bigger

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
  const svgWidth = calculateTreeWidth(treeData, levelCount, leafSpacing, baseNodeSize);
  const totalHeight = calculateTotalHeight(levelCount, startY, layerHeight, baseNodeSize, maxChildrenPerLevel);
  const svgHeight = containerHeight > 0 ? containerHeight : Math.max(1200, totalHeight);

  // Calculate total tree width to determine root X position
  const treeStartX = 200; // Left margin
  const treeEndX = svgWidth - 200; // Right margin
  const startX = (treeStartX + treeEndX) / 2; // Center of entire tree

  // Recursive function to collect tree connectors and nodes separately for proper z-order
  const collectTreeElements = (nodes, levelIndex, parentX, parentY, startXOffset, allConnectors, allNodes) => {
    const entries = Object.entries(nodes);
    if (entries.length === 0) return;

    // Calculate cumulative Y position using variable spacing (with baseNodeSize and dynamic children-based spacing)
    // The spacing above level i should be based on how many children level i-1 nodes have (fan-out effect)
    let cumulativeY = startY;
    for (let i = 0; i <= levelIndex; i++) {
      const childrenCountForSpacing = i > 0 ? (maxChildrenPerLevel[i - 1] || 1) : 1;
      cumulativeY += getLevelSpacing(i, levelCount, layerHeight, baseNodeSize, childrenCountForSpacing);
    }
    const currentY = cumulativeY;
    const colors = levelColors[levelIndex % levelColors.length];
    const isLastLevel = levelIndex === levelCount - 1;

    // First pass: calculate total width and positions for centering
    let currentX = startXOffset;
    const nodeInfo = [];

    entries.forEach(([key, node], index) => {
      const branchWidth = calculateBranchWidth(node, levelCount, leafSpacing, baseNodeSize);
      const minX = currentX;
      const maxX = currentX + branchWidth;

      // Create consistent node key for position tracking
      // IMPORTANT: Use the tree's unique key for ALL nodes to avoid collisions
      // The tree key includes the full path and is guaranteed unique
      const nodeKey = key;
      const nodeData = node.data || node.value;

      // Calculate the actual span of descendants to center parent over them
      const descendantsSpan = calculateDescendantsSpan(node, minX, levelCount, leafSpacing, baseNodeSize);

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

    // Second pass: collect connectors and nodes separately
    nodeInfo.forEach(({ key, node, nodeKey, nodeData, minX, maxX, branchWidth, descendantsSpan }) => {
      // Position node at center of its descendants' span for proper centering
      const defaultNodeX = (descendantsSpan.minX + descendantsSpan.maxX) / 2;
      const nodePos = getNodePosition(nodeKey, nodeData, defaultNodeX, currentY);

      // Collect connector from parent
      if (parentX !== undefined && parentY !== undefined) {
        // Calculate connector attachment points based on node scaling
        const parentScale = levelIndex > 0 ? getNodeSizeScale(levelIndex - 1, levelCount) : 3;
        const currentScale = isLastLevel ? 0.5 : getNodeSizeScale(levelIndex, levelCount);

        // Apply baseNodeSize to parent scale (except for Message nodes at parent level)
        const parentLevelIndex = levelIndex - 1;
        const isParentMessageNode = parentLevelIndex >= 0 && (node.source === 'Messages' || node.source === 'Message');
        const adjustedParentScale = isParentMessageNode ? parentScale : parentScale * baseNodeSize;

        // Check if parent is at second-to-last level (has heightMultiplier)
        const parentHeightMultiplier = parentLevelIndex === levelCount - 2 ? 1.67 : 1;
        const currentHeightMultiplier = (levelIndex === levelCount - 2 && !isLastLevel) ? 1.67 : 1;

        // Two-line height multiplier for non-last-level, non-message nodes
        const isCurrentMessageNode = node && (node.source === 'Messages' || node.source === 'Message');
        const parentTwoLineMultiplier = (parentLevelIndex < levelCount - 1 && !isParentMessageNode) ? 1.5 : 1;
        const currentTwoLineMultiplier = (!isLastLevel && !isCurrentMessageNode) ? 1.5 : 1;

        // Base height 70 (matches DecisionNode)
        const baseHeight = 70;
        const parentHeight = levelIndex > 0 ? baseHeight * adjustedParentScale * parentHeightMultiplier * parentTwoLineMultiplier : 200 * baseNodeSize;
        const currentHeight = isLastLevel ? 40 : baseHeight * currentScale * baseNodeSize * currentHeightMultiplier * currentTwoLineMultiplier;

        allConnectors.push(
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

      // Collect node (either DecisionNode or MessageCard for last level)
      if (isLastLevel && node.data && node.data.type === 'message') {
        allNodes.push(
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
        allNodes.push(
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

      // Recursively collect children
      if (node.children && Object.keys(node.children).length > 0) {
        collectTreeElements(
          node.children,
          levelIndex + 1,
          nodePos.x,
          nodePos.y,
          minX,
          allConnectors,
          allNodes
        );
      }
    });
  };

  // Wrapper function to render tree with proper z-order (connectors behind nodes)
  const renderTreeLevel = (nodes, parentX, parentY, startXOffset) => {
    const allConnectors = [];
    const allNodes = [];

    collectTreeElements(nodes, 0, parentX, parentY, startXOffset, allConnectors, allNodes);

    // Return connectors first (rendered behind), then all nodes (rendered on top)
    return (
      <>
        <g className="tree-connectors">
          {allConnectors}
        </g>
        <g className="tree-nodes">
          {allNodes}
        </g>
      </>
    );
  };

  // Render flat mode - horizontal rows of unique values per level
  const renderFlatMode = () => {
    if (flatLevels.length === 0) return null;

    const elements = [];
    const nodeSpacing = 180 * baseNodeSize; // Horizontal spacing between nodes
    // For flat mode, use average children count for consistent spacing
    const avgChildren = Math.max(1, Math.ceil(flatLevels.reduce((sum, l) => sum + l.uniqueValues.length, 0) / flatLevels.length));
    const levelSpacing = getLevelSpacing(0, flatLevels.length, layerHeight, baseNodeSize, avgChildren); // Vertical spacing between levels

    flatLevels.forEach((level, levelIndex) => {
      const levelY = startY + (levelIndex + 1) * levelSpacing;
      const levelWidth = level.uniqueValues.length * nodeSpacing;
      const levelStartX = startX - levelWidth / 2 + nodeSpacing / 2;
      const colors = levelColors[levelIndex % levelColors.length];

      // Draw vertical connector from previous level (centered)
      if (levelIndex > 0) {
        const prevLevelY = startY + levelIndex * levelSpacing;
        const connectorStrokeWidth = Math.max(2, 20 * baseNodeSize * (1 - levelIndex / flatLevels.length));

        elements.push(
          <line
            key={`level-connector-${levelIndex}`}
            x1={startX}
            y1={prevLevelY + 30 * baseNodeSize}
            x2={startX}
            y2={levelY - 30 * baseNodeSize}
            stroke="#94a3b8"
            strokeWidth={connectorStrokeWidth}
          />
        );
      }

      // Draw level label
      elements.push(
        <text
          key={`level-label-${levelIndex}`}
          x={levelStartX - 100}
          y={levelY + 5}
          textAnchor="end"
          className="text-sm font-semibold fill-gray-500 select-none pointer-events-none"
          style={{ fontSize: `${14 * baseNodeSize}px` }}
        >
          {level.label}
        </text>
      );

      // Draw nodes for this level in a horizontal row
      level.uniqueValues.forEach((item, itemIndex) => {
        const nodeX = levelStartX + itemIndex * nodeSpacing;
        const nodeKey = `flat-${levelIndex}-${item.value}`;
        const nodeWidth = 140 * baseNodeSize;
        const nodeHeight = 40 * baseNodeSize;

        // Check if this is a message node (last level with Message source)
        const isMessage = item.source === 'Messages' || item.source === 'Message';

        // Determine node color
        let nodeColor = colors.color;
        if (isMessage && item.data?.status) {
          nodeColor = getStatusColor(item.data.status);
        }

        // Check if editable
        const isEditable =
          ((item.source === 'Audiences' || item.source === 'Audience') && onEditAudience) ||
          ((item.source === 'Topics' || item.source === 'Topic') && onEditTopic) ||
          ((item.source === 'Messages' || item.source === 'Message') && onEditMessage);

        elements.push(
          <g
            key={nodeKey}
            onMouseDown={(e) => handleMouseDown(e, nodeKey, item.data, nodeX, levelY)}
            onMouseMove={handleMouseMoveForDrag}
            onDoubleClick={() => handleNodeDoubleClick(item)}
            className="transition-opacity hover:opacity-80"
            style={{ cursor: isEditable ? 'pointer' : 'grab' }}
          >
            <rect
              x={nodeX - nodeWidth / 2}
              y={levelY - nodeHeight / 2}
              width={nodeWidth}
              height={nodeHeight}
              rx={5 * baseNodeSize}
              fill={nodeColor}
              stroke="none"
            />
            <text
              x={nodeX}
              y={levelY + 5 * baseNodeSize}
              textAnchor="middle"
              className="text-sm font-bold pointer-events-none select-none fill-white"
              style={{ fontSize: `${14 * baseNodeSize}px` }}
            >
              {item.value}
            </text>
            {isEditable && <title>Double-click to edit</title>}
          </g>
        );
      });
    });

    return elements;
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
        {/* Top right control buttons */}
        <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
          {/* Fit and center button */}
          <button
            onClick={handleFitAndCenter}
            className="p-2 bg-white border border-gray-300 rounded-lg shadow-sm hover:bg-gray-50 transition-colors"
            title="Fit and center tree"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>
            </svg>
          </button>

          {/* Tree structure toggle button */}
          <button
            onClick={() => setShowTreeStructure(!showTreeStructure)}
            className={`p-2 border rounded-lg shadow-sm transition-colors ${
              showTreeStructure
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white border-gray-300 hover:bg-gray-50'
            }`}
            title="Edit tree structure"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3v18"/>
              <path d="M5 8h14"/>
              <path d="M5 16h14"/>
              <circle cx="12" cy="3" r="2"/>
              <circle cx="5" cy="8" r="2"/>
              <circle cx="19" cy="8" r="2"/>
              <circle cx="5" cy="16" r="2"/>
              <circle cx="19" cy="16" r="2"/>
            </svg>
          </button>
        </div>

        {/* Tree structure input panel (hidden behind icon) */}
        {showTreeStructure && (
          <div className="absolute top-16 right-4 z-10 bg-white border border-gray-300 rounded-lg shadow-lg p-4" style={{ width: '500px' }}>
            <div className="flex items-center gap-2 mb-3">
              <label className="text-sm font-medium text-gray-700 whitespace-nowrap">
                Tree structure:
              </label>
            </div>
            <input
              type="text"
              value={tempTreeStructure}
              onChange={handleInputChange}
              className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg shadow-sm text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none mb-3"
              placeholder="e.g., Product → Strategy → Targeting Type → Audience → Topic → Messages"
            />
            {hasChanges && (
              <div className="flex gap-2">
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
              </div>
            )}
          </div>
        )}

        {/* Left side sliders */}
        <div className="absolute top-4 left-4 z-10 flex items-center gap-4">
          {/* Layer height slider */}
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700 whitespace-nowrap">
              Layer:
            </label>
            <div className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded-lg shadow-sm">
              <input
                type="range"
                min="0.5"
                max="4"
                step="0.1"
                value={layerHeight}
                onChange={handleLayerHeightChange}
                className="w-24"
              />
              <span className="text-sm text-gray-600 font-mono w-8">{layerHeight.toFixed(1)}x</span>
            </div>
          </div>

          {/* Node size slider */}
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700 whitespace-nowrap">
              Node:
            </label>
            <div className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded-lg shadow-sm">
              <input
                type="range"
                min="0.5"
                max="2"
                step="0.1"
                value={baseNodeSize}
                onChange={handleBaseNodeSizeChange}
                className="w-24"
              />
              <span className="text-sm text-gray-600 font-mono w-8">{baseNodeSize.toFixed(1)}x</span>
            </div>
          </div>
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
            {/* Root node - scales with baseNodeSize */}
            <g
              onMouseDown={(e) => handleMouseDown(e, '__root__', { type: 'root' }, startX, startY)}
              className="transition-opacity hover:opacity-80"
            >
              <rect
                x={(() => {
                  const pos = getNodePosition('__root__', { type: 'root' }, startX, startY);
                  return pos.x - 360 * baseNodeSize;
                })()}
                y={(() => {
                  const pos = getNodePosition('__root__', { type: 'root' }, startX, startY);
                  return pos.y - 100 * baseNodeSize;
                })()}
                width={720 * baseNodeSize}
                height={200 * baseNodeSize}
                rx={24 * baseNodeSize}
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
                  return pos.y + 15 * baseNodeSize;
                })()}
                textAnchor="middle"
                className="fill-white select-none pointer-events-none"
                style={{ fontSize: `${48 * baseNodeSize}px`, fontWeight: 'bold' }}
              >
                Decision tree
              </text>
            </g>

            {/* Render tree or flat mode based on toggle */}
            {flattenMode ? (
              renderFlatMode()
            ) : (
              renderTreeLevel(treeData, (() => {
                const pos = getNodePosition('__root__', { type: 'root' }, startX, startY);
                return pos.x;
              })(), (() => {
                const pos = getNodePosition('__root__', { type: 'root' }, startX, startY);
                return pos.y;
              })(), treeStartX)
            )}
          </g>
        </svg>
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison - only re-render if props actually changed
  return (
    prevProps.audiences === nextProps.audiences &&
    prevProps.topics === nextProps.topics &&
    prevProps.messages === nextProps.messages &&
    prevProps.getMessages === nextProps.getMessages &&
    prevProps.statusFilters === nextProps.statusFilters &&
    prevProps.zoom === nextProps.zoom &&
    prevProps.treeStructure === nextProps.treeStructure &&
    prevProps.connectorType === nextProps.connectorType &&
    prevProps.flattenMode === nextProps.flattenMode
  );
});

export default TreeView;
