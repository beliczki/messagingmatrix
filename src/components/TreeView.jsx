import React, { useState, useRef } from 'react';

// Persistent state outside component to maintain zoom/pan when switching views
let persistentTreeState = {
  zoom: 1,
  pan: { x: 0, y: 0 },
  nodePositions: {},
  connectorType: 'curved'
};

const TreeView = ({ audiences, topics, messages, getMessages }) => {
  const [nodePositions, setNodePositions] = useState(persistentTreeState.nodePositions);
  const [dragging, setDragging] = useState(null);
  const [zoom, setZoom] = useState(persistentTreeState.zoom);
  const [pan, setPan] = useState(persistentTreeState.pan);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [containerHeight, setContainerHeight] = useState(0);
  const [connectorType, setConnectorType] = useState(persistentTreeState.connectorType);
  const svgRef = useRef(null);
  const containerRef = useRef(null);

  // Build hierarchical tree structure from data
  const buildTree = () => {
    const tree = {
      strategies: {}
    };

    // Group by strategy -> targeting_type -> audience -> topic -> messages
    audiences.forEach(audience => {
      const strategy = audience.strategy || 'Unknown Strategy';
      const targetingType = audience.targeting_type || 'Unknown Type';
      const audienceKey = audience.key;

      // Initialize strategy branch
      if (!tree.strategies[strategy]) {
        tree.strategies[strategy] = {
          name: strategy,
          targetingTypes: {}
        };
      }

      // Initialize targeting type branch
      if (!tree.strategies[strategy].targetingTypes[targetingType]) {
        tree.strategies[strategy].targetingTypes[targetingType] = {
          name: targetingType,
          audiences: {}
        };
      }

      // Initialize audience branch
      if (!tree.strategies[strategy].targetingTypes[targetingType].audiences[audienceKey]) {
        tree.strategies[strategy].targetingTypes[targetingType].audiences[audienceKey] = {
          data: audience,
          topics: {}
        };
      }

      // Add topics and messages for this audience
      topics.forEach(topic => {
        const cellMessages = getMessages(topic.key, audienceKey);
        if (cellMessages.length > 0) {
          tree.strategies[strategy].targetingTypes[targetingType].audiences[audienceKey].topics[topic.key] = {
            data: topic,
            messages: cellMessages
          };
        }
      });
    });

    return tree;
  };

  const treeData = buildTree();

  // Handle mouse down - start dragging
  const handleMouseDown = (e, nodeType, nodeData, defaultX, defaultY) => {
    e.preventDefault();
    e.stopPropagation();
    const svg = svgRef.current;
    const rect = svg.getBoundingClientRect();
    const startX = (e.clientX - rect.left - pan.x) / zoom;
    const startY = (e.clientY - rect.top - pan.y) / zoom;

    const currentPos = getNodePosition(nodeType, nodeData, defaultX, defaultY);

    setDragging({
      type: nodeType,
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

    const nodeKey = `${dragging.type}-${dragging.data.id || dragging.data.key || dragging.data}`;
    setNodePositions(prev => ({
      ...prev,
      [nodeKey]: { x, y }
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
      if (e.code === 'Space' && !spacePressed) {
        e.preventDefault();
        setSpacePressed(true);
      }
    };

    const handleKeyUp = (e) => {
      if (e.code === 'Space') {
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
      // Calculate available height: viewport - menu (97px) - pane header (57px) - padding (48px)
      const menuHeight = 97;
      const paneHeaderHeight = 57;
      const paddingHeight = 48; // 1rem top + 2rem bottom (p-4 = 16px * 3)
      const availableHeight = window.innerHeight - menuHeight - paneHeaderHeight - paddingHeight;
      setContainerHeight(availableHeight);
    };

    updateHeight();
    window.addEventListener('resize', updateHeight);

    return () => {
      window.removeEventListener('resize', updateHeight);
    };
  }, []);

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
  const handleWheel = (e) => {
    if (spacePressed) {
      e.preventDefault();

      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      const newZoom = Math.min(Math.max(0.1, zoom * delta), 3);

      setZoom(newZoom);
    }
  };

  // Handle pan start
  const handlePanStart = (e) => {
    if (e.button === 1 || spacePressed) { // Middle mouse or Space+Left
      e.preventDefault();
      setIsPanning(true);
      setPanStart({
        x: e.clientX - pan.x * zoom,
        y: e.clientY - pan.y * zoom
      });
    }
  };

  // Handle pan move
  const handlePanMove = (e) => {
    if (isPanning) {
      const deltaX = (e.clientX - panStart.x) / zoom;
      const deltaY = (e.clientY - panStart.y) / zoom;
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
  const getNodePosition = (nodeType, nodeData, defaultX, defaultY) => {
    const nodeKey = `${nodeType}-${nodeData.id || nodeData.key || nodeData}`;
    const customPos = nodePositions[nodeKey];
    return customPos || { x: defaultX, y: defaultY };
  };

  // Helper to render decision node
  const DecisionNode = ({ label, value, x, y, nodeType, nodeData, color = '#6366f1', bgColor = '#e0e7ff' }) => {
    const pos = getNodePosition(nodeType, nodeData, x, y);

    return (
      <g
        onMouseDown={(e) => handleMouseDown(e, nodeType, nodeData, x, y)}
        className="transition-opacity hover:opacity-80"
      >
        <rect
          x={pos.x - 70}
          y={pos.y - 20}
          width={140}
          height={40}
          rx={5}
          fill={bgColor}
          stroke={color}
          strokeWidth={2}
        />
        <text
          x={pos.x}
          y={pos.y - 5}
          textAnchor="middle"
          className="text-xs font-semibold pointer-events-none select-none"
          fill={color}
        >
          {label}
        </text>
        <text
          x={pos.x}
          y={pos.y + 10}
          textAnchor="middle"
          className="text-sm font-bold pointer-events-none select-none"
          fill={color}
        >
          {value}
        </text>
      </g>
    );
  };

  // Helper to render message card (leaf node)
  const MessageCard = ({ message, x, y }) => {
    const pos = getNodePosition('message', message, x, y);

    const getStatusColor = (status) => {
      const s = (status || '').toLowerCase();
      if (s === 'live' || s === 'running' || s === 'active') return '#10b981';  // Green - Active
      if (s === 'paused' || s === 'in progress') return '#f59e0b';  // Orange - In Progress
      if (s === 'planned') return '#eab308';  // Yellow - Planned
      if (s === 'draft' || s === 'inactive') return '#6b7280';  // Gray - Inactive
      return '#6b7280';  // Default gray
    };

    const statusColor = getStatusColor(message.status);

    return (
      <g
        onMouseDown={(e) => handleMouseDown(e, 'message', message, x, y)}
        className="transition-opacity hover:opacity-80"
      >
        <rect
          x={pos.x - 40}
          y={pos.y - 25}
          width={80}
          height={50}
          rx={6}
          fill={statusColor}
          stroke={statusColor}
          strokeWidth={2}
        />
        <text
          x={pos.x}
          y={pos.y - 5}
          textAnchor="middle"
          className="text-lg font-bold fill-white pointer-events-none select-none"
        >
          {message.number}{message.variant}
        </text>
        <text
          x={pos.x}
          y={pos.y + 12}
          textAnchor="middle"
          className="text-xs fill-white pointer-events-none select-none"
        >
          {message.status || 'PLANNED'}
        </text>
      </g>
    );
  };

  // Helper to draw connector
  const Connector = ({ x1, y1, x2, y2, label }) => {
    const midY = (y1 + y2) / 2;

    if (connectorType === 'curved') {
      // Curved connector using cubic bezier
      const controlY = (y1 + y2) / 2;
      const path = `M ${x1} ${y1} C ${x1} ${controlY}, ${x2} ${controlY}, ${x2} ${y2}`;

      return (
        <g className="pointer-events-none">
          <path d={path} stroke="#94a3b8" strokeWidth={2} fill="none" />
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
        <line x1={x1} y1={y1} x2={x1} y2={midY} stroke="#94a3b8" strokeWidth={2} />
        {/* Horizontal line */}
        <line x1={x1} y1={midY} x2={x2} y2={midY} stroke="#94a3b8" strokeWidth={2} />
        {/* Vertical line to target */}
        <line x1={x2} y1={midY} x2={x2} y2={y2} stroke="#94a3b8" strokeWidth={2} />
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

  if (Object.keys(treeData.strategies).length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        No messages to display in tree view
      </div>
    );
  }

  // Layout calculations - much larger spacing to prevent overlaps
  const startY = 80;
  const strategyY = 220;
  const targetingY = 400;
  const audienceY = 580;
  const topicY = 760;
  const messageY = 940;

  const messageSpacing = 100;
  const minNodeSpacing = 150; // Minimum space between sibling nodes

  // Calculate width of a branch recursively from bottom up
  const calculateBranchWidth = (node, level) => {
    if (level === 'message') {
      return messageSpacing;
    }

    if (level === 'topic') {
      const messageCount = node.messages.length;
      return Math.max(messageCount * messageSpacing, minNodeSpacing);
    }

    if (level === 'audience') {
      const topicsArr = Object.values(node.topics);
      if (topicsArr.length === 0) return minNodeSpacing;

      const totalWidth = topicsArr.reduce((sum, topic) => {
        return sum + calculateBranchWidth(topic, 'topic');
      }, 0);

      return Math.max(totalWidth, minNodeSpacing);
    }

    if (level === 'targeting') {
      const audiencesArr = Object.values(node.audiences);
      if (audiencesArr.length === 0) return minNodeSpacing;

      const totalWidth = audiencesArr.reduce((sum, audience) => {
        return sum + calculateBranchWidth(audience, 'audience');
      }, 0);

      return Math.max(totalWidth, minNodeSpacing);
    }

    if (level === 'strategy') {
      const targetingArr = Object.values(node.targetingTypes);
      if (targetingArr.length === 0) return minNodeSpacing;

      const totalWidth = targetingArr.reduce((sum, targeting) => {
        return sum + calculateBranchWidth(targeting, 'targeting');
      }, 0);

      return Math.max(totalWidth, minNodeSpacing);
    }

    return minNodeSpacing;
  };

  // Calculate total SVG width
  const calculateTreeWidth = () => {
    let totalWidth = 0;
    Object.values(treeData.strategies).forEach(strategy => {
      totalWidth += calculateBranchWidth(strategy, 'strategy');
    });
    const margin = 400; // Left and right margins (200px each)
    return Math.max(3000, totalWidth + margin);
  };

  const svgWidth = calculateTreeWidth();
  // Use calculated available height, ensuring it's enough for content
  const svgHeight = containerHeight > 0 ? containerHeight : 1200;

  // Calculate total tree width to determine root X position
  const treeStartX = 200; // Left margin
  const treeEndX = svgWidth - 200; // Right margin
  const startX = (treeStartX + treeEndX) / 2; // Center of entire tree

  let currentStrategyX = treeStartX;

  return (
    <div className="w-full h-full bg-white rounded-lg shadow select-none flex flex-col overflow-hidden">
      <div className="p-4 border-b bg-gray-50 text-sm text-gray-600 flex items-center gap-2 flex-shrink-0">
        <span className="font-semibold">Decision Tree: Strategy → Targeting Type → Audience → Topic → Messages</span>

        {/* Controls */}
        <div className="ml-auto flex items-center gap-3">
          <span className="text-xs text-gray-500">
            {spacePressed ? '🖐️ Pan & Zoom Mode (Drag to Pan | Scroll to Zoom)' : 'Hold Space for Pan & Zoom Mode'}
          </span>

          {/* Zoom controls */}
          <div className="flex items-center gap-1">
            <button
              onClick={handleZoomOut}
              className="px-2 py-1 bg-gray-200 hover:bg-gray-300 rounded text-xs font-bold"
              title="Zoom Out"
            >
              −
            </button>
            <span className="text-xs font-mono min-w-[60px] text-center">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={handleZoomIn}
              className="px-2 py-1 bg-gray-200 hover:bg-gray-300 rounded text-xs font-bold"
              title="Zoom In"
            >
              +
            </button>
          </div>

          {/* Connector type toggle - styled like matrix/tree toggle */}
          <div className="flex items-center gap-0.5 bg-gray-100 rounded p-0.5">
            <button
              onClick={() => setConnectorType('elbow')}
              className={`flex items-center gap-1 px-3 py-1.5 rounded transition-colors text-xs ${
                connectorType === 'elbow'
                  ? 'bg-white text-blue-700 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
              title="Elbow Connectors"
            >
              ⌐⌐
            </button>
            <button
              onClick={() => setConnectorType('curved')}
              className={`flex items-center gap-1 px-3 py-1.5 rounded transition-colors text-xs ${
                connectorType === 'curved'
                  ? 'bg-white text-blue-700 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
              title="Curved Connectors"
            >
              ~
            </button>
          </div>

          {/* Reset button */}
          <button
            onClick={handleResetAll}
            className="px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded text-xs"
            title="Reset View & Positions"
          >
            Reset
          </button>
        </div>
      </div>

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
        onWheel={handleWheel}
        style={{
          minHeight: 0
        }}
      >
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
          {/* Root node */}
          <g>
            <rect
              x={startX - 120}
              y={startY - 25}
              width={240}
              height={50}
              rx={8}
              fill="#7c3aed"
              stroke="#6d28d9"
              strokeWidth={3}
            />
            <text
              x={startX}
              y={startY + 5}
              textAnchor="middle"
              className="text-lg font-bold fill-white select-none"
            >
              Decision tree
            </text>
          </g>

          {/* Render strategy branches */}
          {Object.entries(treeData.strategies).map(([strategyName, strategyData], strategyIdx) => {
            // Calculate this strategy's branch width
            const strategyBranchWidth = calculateBranchWidth(strategyData, 'strategy');

            const targetingTypes = Object.entries(strategyData.targetingTypes);
            let currentTargetingX = currentStrategyX;

            // Calculate min and max X positions of children to center parent
            const strategyMinX = currentStrategyX;
            const strategyMaxX = currentStrategyX + strategyBranchWidth;
            const strategyX = (strategyMinX + strategyMaxX) / 2;
            const strategyPos = getNodePosition('strategy', strategyName, strategyX, strategyY);

            return (
              <g key={`strategy-${strategyName}`}>
                {/* Connector from root to strategy */}
                <Connector x1={startX} y1={startY + 25} x2={strategyPos.x} y2={strategyPos.y - 20} />

                {/* Strategy node */}
                <DecisionNode
                  label="Strategy"
                  value={strategyName}
                  x={strategyX}
                  y={strategyY}
                  nodeType="strategy"
                  nodeData={strategyName}
                  color="#dc2626"
                  bgColor="#fee2e2"
                />

                {/* Render targeting type branches */}
                {targetingTypes.map(([targetingName, targetingData], targetingIdx) => {
                  const targetingBranchWidth = calculateBranchWidth(targetingData, 'targeting');

                  const audiencesArr = Object.entries(targetingData.audiences);
                  let currentAudienceX = currentTargetingX;

                  // Calculate min and max X positions of children to center parent
                  const targetingMinX = currentTargetingX;
                  const targetingMaxX = currentTargetingX + targetingBranchWidth;
                  const targetingX = (targetingMinX + targetingMaxX) / 2;
                  const targetingPos = getNodePosition('targeting', targetingName, targetingX, targetingY);

                  const targetingElement = (
                    <g key={`targeting-${targetingName}`}>
                      {/* Connector from strategy to targeting */}
                      <Connector x1={strategyPos.x} y1={strategyPos.y + 20} x2={targetingPos.x} y2={targetingPos.y - 20} />

                      {/* Targeting type node */}
                      <DecisionNode
                        label="Targeting Type"
                        value={targetingName}
                        x={targetingX}
                        y={targetingY}
                        nodeType="targeting"
                        nodeData={targetingName}
                        color="#ea580c"
                        bgColor="#ffedd5"
                      />

                      {/* Render audience branches */}
                      {audiencesArr.map(([audienceKey, audienceData], audienceIdx) => {
                        const audienceBranchWidth = calculateBranchWidth(audienceData, 'audience');

                        const topicsArr = Object.entries(audienceData.topics);
                        let currentTopicX = currentAudienceX;

                        // Calculate min and max X positions of children to center parent
                        const audienceMinX = currentAudienceX;
                        const audienceMaxX = currentAudienceX + audienceBranchWidth;
                        const audienceX = (audienceMinX + audienceMaxX) / 2;
                        const audiencePos = getNodePosition('audience', audienceData.data, audienceX, audienceY);

                        const audienceElement = (
                          <g key={`audience-${audienceKey}`}>
                            {/* Connector from targeting to audience */}
                            <Connector x1={targetingPos.x} y1={targetingPos.y + 20} x2={audiencePos.x} y2={audiencePos.y - 20} />

                            {/* Audience node */}
                            <DecisionNode
                              label="Audience"
                              value={audienceData.data.name}
                              x={audienceX}
                              y={audienceY}
                              nodeType="audience"
                              nodeData={audienceData.data}
                              color="#2563eb"
                              bgColor="#dbeafe"
                            />

                            {/* Render topic branches */}
                            {topicsArr.map(([topicKey, topicData], topicIdx) => {
                              const topicBranchWidth = calculateBranchWidth(topicData, 'topic');

                              const messagesArr = topicData.messages;
                              let currentMessageX = currentTopicX;

                              // Calculate min and max X positions of children to center parent
                              const topicMinX = currentTopicX;
                              const topicMaxX = currentTopicX + topicBranchWidth;
                              const topicX = (topicMinX + topicMaxX) / 2;
                              const topicPos = getNodePosition('topic', topicData.data, topicX, topicY);

                              const topicElement = (
                                <g key={`topic-${topicKey}`}>
                                  {/* Connector from audience to topic */}
                                  <Connector x1={audiencePos.x} y1={audiencePos.y + 20} x2={topicPos.x} y2={topicPos.y - 20} />

                                  {/* Topic node */}
                                  <DecisionNode
                                    label="Topic"
                                    value={topicData.data.name}
                                    x={topicX}
                                    y={topicY}
                                    nodeType="topic"
                                    nodeData={topicData.data}
                                    color="#059669"
                                    bgColor="#d1fae5"
                                  />

                                  {/* Render messages */}
                                  {messagesArr.map((msg, msgIdx) => {
                                    const msgX = currentMessageX + messageSpacing / 2;
                                    const msgY = messageY;
                                    const msgPos = getNodePosition('message', msg, msgX, msgY);

                                    const msgElement = (
                                      <g key={`msg-${msg.id}`}>
                                        {/* Connector from topic to message */}
                                        <Connector x1={topicPos.x} y1={topicPos.y + 20} x2={msgPos.x} y2={msgPos.y - 25} />

                                        {/* Message card */}
                                        <MessageCard message={msg} x={msgX} y={msgY} />
                                      </g>
                                    );

                                    currentMessageX += messageSpacing;
                                    return msgElement;
                                  })}
                                </g>
                              );

                              currentTopicX += topicBranchWidth;
                              return topicElement;
                            })}
                          </g>
                        );

                        currentAudienceX += audienceBranchWidth;
                        return audienceElement;
                      })}
                    </g>
                  );

                  currentTargetingX += targetingBranchWidth;
                  return targetingElement;
                })}

                {/* Update X position for next strategy */}
                {(() => {
                  currentStrategyX += strategyBranchWidth;
                  return null;
                })()}
              </g>
            );
          })}
          </g>
        </svg>
      </div>
    </div>
  );
};

export default TreeView;
