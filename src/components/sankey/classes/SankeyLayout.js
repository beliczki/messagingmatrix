/**
 * SankeyLayout - Calculates node positions for HORIZONTAL Sankey diagram
 * Positions nodes in vertical columns (left to right) with flow heights proportional to leaf count
 * Creates true Sankey effect with nodes centered per level (creating crossing flows)
 */

/**
 * Smart sort comparator - sorts numerically if both values are numbers, otherwise alphabetically
 */
const smartCompare = (a, b) => {
  const aVal = a.value || '';
  const bVal = b.value || '';
  const aNum = parseFloat(aVal);
  const bNum = parseFloat(bVal);

  // If both are valid numbers, sort numerically
  if (!isNaN(aNum) && !isNaN(bNum) && aVal.trim() !== '' && bVal.trim() !== '') {
    return aNum - bNum;
  }

  // Otherwise sort alphabetically
  return aVal.localeCompare(bVal);
};

export class SankeyLayout {
  constructor(options = {}) {
    // Spacing configuration
    this.levelSpacing = options.levelSpacing || 180;  // Horizontal distance between levels
    this.flowScale = options.flowScale || 10;         // Pixels per leaf (for height)
    this.startX = options.startX || 80;               // X position of first level
    this.nodeWidth = options.nodeWidth || 60;         // Width of each node bar (3x wider)
    this.nodeGap = options.nodeGap || 8;              // Gap between sibling nodes

    // State
    this.levelCount = 0;
    this.bounds = { minX: 0, maxX: 0, minY: 0, maxY: 0 };
  }

  /**
   * Main layout method - positions all nodes in horizontal Sankey arrangement
   * @param {SankeyNode[]} rootNodes - Array of root nodes
   * @param {number} levelCount - Total number of levels in tree
   * @returns {Object} bounds - { minX, maxX, minY, maxY }
   */
  layout(rootNodes, levelCount) {
    if (!rootNodes || rootNodes.length === 0) {
      return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
    }

    this.levelCount = levelCount;
    this.bounds = { minX: 0, maxX: 0, minY: Infinity, maxY: -Infinity };

    // Phase 1: Calculate leaf counts (bottom-up)
    rootNodes.forEach(node => this.calculateLeafCounts(node));

    // Phase 2: Collect nodes by level
    const levels = [];
    for (let i = 0; i < levelCount; i++) {
      levels.push([]);
    }
    rootNodes.forEach(node => this.collectNodesByLevel(node, 0, levels));

    // Phase 3: Calculate total height needed (based on tallest level)
    const totalLeaves = rootNodes.reduce((sum, node) => sum + node.leafCount, 0);
    const baseHeight = totalLeaves * this.flowScale;

    // Calculate height needed for each level (including gaps)
    let maxLevelHeight = baseHeight;
    levels.forEach(levelNodes => {
      const gaps = Math.max(0, levelNodes.length - 1) * this.nodeGap;
      const nodesHeight = levelNodes.reduce((sum, node) => sum + node.leafCount * this.flowScale, 0);
      maxLevelHeight = Math.max(maxLevelHeight, nodesHeight + gaps);
    });
    const totalHeight = Math.max(maxLevelHeight, 100);

    // Phase 4: Position each level independently (centered vertically)
    levels.forEach((levelNodes, levelIndex) => {
      this.positionLevel(levelNodes, levelIndex, totalHeight);
    });

    // Set bounds
    this.bounds.minX = 0;
    this.bounds.maxX = this.startX + (levelCount - 1) * this.levelSpacing + this.nodeWidth + 50;
    this.bounds.minY = 0;
    this.bounds.maxY = totalHeight + 60;

    return this.bounds;
  }

  /**
   * Calculate leaf counts for node and descendants (bottom-up)
   */
  calculateLeafCounts(node) {
    if (node.children.length === 0) {
      node.leafCount = 1;
      return 1;
    }

    let total = 0;
    node.children.forEach(child => {
      total += this.calculateLeafCounts(child);
    });
    node.leafCount = total;
    return total;
  }

  /**
   * Collect all nodes organized by their level
   */
  collectNodesByLevel(node, level, levels) {
    node.level = level;
    node.levelCount = this.levelCount;
    levels[level].push(node);

    node.children.forEach(child => {
      this.collectNodesByLevel(child, level + 1, levels);
    });
  }

  /**
   * Position all nodes at a given level (column), centered within totalHeight
   */
  positionLevel(levelNodes, levelIndex, totalHeight) {
    if (levelNodes.length === 0) return;

    // Calculate total height needed for this level
    const totalLeafCount = levelNodes.reduce((sum, node) => sum + node.leafCount, 0);
    const nodesHeight = totalLeafCount * this.flowScale;
    const gaps = Math.max(0, levelNodes.length - 1) * this.nodeGap;
    const levelHeight = nodesHeight + gaps;

    // Center the level vertically
    const startY = (totalHeight - levelHeight) / 2 + 30; // 30px top margin

    // X position for this level (column)
    const levelX = this.startX + levelIndex * this.levelSpacing;

    // Position each node
    let currentY = startY;
    levelNodes.forEach((node, index) => {
      const nodeHeight = node.leafCount * this.flowScale;

      // For horizontal Sankey: x is column position, y defines the vertical span
      node.x = levelX + this.nodeWidth / 2;  // Center of node
      node.yStart = currentY;
      node.yEnd = currentY + nodeHeight;
      node.y = (node.yStart + node.yEnd) / 2;  // Center Y
      node.flowHeight = nodeHeight;

      // Also set flowWidth for compatibility (used for hit testing)
      node.flowWidth = this.nodeWidth;
      node.xStart = levelX;
      node.xEnd = levelX + this.nodeWidth;

      // Update bounds
      this.bounds.minY = Math.min(this.bounds.minY, node.yStart);
      this.bounds.maxY = Math.max(this.bounds.maxY, node.yEnd);

      currentY += nodeHeight + this.nodeGap;
    });
  }

  /**
   * Layout for convergent Sankey (nodes at each level, flows between them)
   * @param {Array} levels - Array of node arrays (one per level)
   * @param {Array} flows - Array of { sourceId, targetId, weight }
   * @param {number} levelCount - Number of levels
   */
  layoutConvergent(levels, flows, levelCount) {
    if (!levels || levels.length === 0) {
      return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
    }

    this.levelCount = levelCount;
    this.bounds = { minX: 0, maxX: 0, minY: Infinity, maxY: -Infinity };

    // Calculate total weight at each level
    let maxLevelWeight = 0;
    levels.forEach(levelNodes => {
      const totalWeight = levelNodes.reduce((sum, node) => sum + (node.weight || 1), 0);
      maxLevelWeight = Math.max(maxLevelWeight, totalWeight);
    });

    // Calculate total height needed
    const totalHeight = maxLevelWeight * this.flowScale + (Math.max(...levels.map(l => l.length)) - 1) * this.nodeGap + 60;

    // Build node lookup map
    const nodeMap = new Map();
    levels.forEach(levelNodes => {
      levelNodes.forEach(node => nodeMap.set(node.id, node));
    });

    // Build connection maps for sorting
    const incomingFlows = new Map(); // targetId -> [{sourceId, weight}]
    const outgoingFlows = new Map(); // sourceId -> [{targetId, weight}]
    flows.forEach(flow => {
      if (!incomingFlows.has(flow.targetId)) incomingFlows.set(flow.targetId, []);
      if (!outgoingFlows.has(flow.sourceId)) outgoingFlows.set(flow.sourceId, []);
      incomingFlows.get(flow.targetId).push({ sourceId: flow.sourceId, weight: flow.weight });
      outgoingFlows.get(flow.sourceId).push({ targetId: flow.targetId, weight: flow.weight });
    });

    // Sort nodes at each level to minimize crossings
    // Level 0: sort numerically if numbers, otherwise alphabetically
    if (levels[0]) {
      levels[0].sort(smartCompare);
    }

    // Levels 1+: sort by average position of connected sources
    for (let i = 1; i < levels.length; i++) {
      const prevLevel = levels[i - 1];
      // Assign temp positions to previous level for sorting
      prevLevel.forEach((node, idx) => { node._sortPos = idx; });

      levels[i].sort((a, b) => {
        const aIncoming = incomingFlows.get(a.id) || [];
        const bIncoming = incomingFlows.get(b.id) || [];

        // Calculate weighted average position of sources
        const getAvgPos = (incoming) => {
          if (incoming.length === 0) return 0;
          let totalWeight = 0;
          let weightedSum = 0;
          incoming.forEach(({ sourceId, weight }) => {
            const sourceNode = nodeMap.get(sourceId);
            if (sourceNode && sourceNode._sortPos !== undefined) {
              weightedSum += sourceNode._sortPos * weight;
              totalWeight += weight;
            }
          });
          return totalWeight > 0 ? weightedSum / totalWeight : 0;
        };

        return getAvgPos(aIncoming) - getAvgPos(bIncoming);
      });
    }

    // Position each level
    levels.forEach((levelNodes, levelIndex) => {
      this.positionConvergentLevel(levelNodes, levelIndex, totalHeight);
    });

    // Calculate flow positions (where each flow connects)
    this.calculateFlowPositions(levels, flows, nodeMap);

    // Set bounds
    this.bounds.minX = 0;
    this.bounds.maxX = this.startX + (levelCount - 1) * this.levelSpacing + this.nodeWidth + 100;
    this.bounds.minY = Math.max(0, this.bounds.minY - 30);
    this.bounds.maxY = this.bounds.maxY + 30;

    return this.bounds;
  }

  /**
   * Position nodes at a level for convergent Sankey
   */
  positionConvergentLevel(levelNodes, levelIndex, totalHeight) {
    if (levelNodes.length === 0) return;

    // DON'T sort here - sorting is done in layoutConvergent after building connection maps

    // Calculate total height needed for this level
    const totalWeight = levelNodes.reduce((sum, node) => sum + (node.weight || 1), 0);
    const nodesHeight = totalWeight * this.flowScale;
    const gaps = Math.max(0, levelNodes.length - 1) * this.nodeGap;
    const levelHeight = nodesHeight + gaps;

    // Center the level vertically
    const startY = (totalHeight - levelHeight) / 2 + 30;

    // X position for this level (column)
    const levelX = this.startX + levelIndex * this.levelSpacing;

    // Position each node
    let currentY = startY;
    levelNodes.forEach((node) => {
      const nodeHeight = Math.max((node.weight || 1) * this.flowScale, 4); // Min 4px height

      node.x = levelX + this.nodeWidth / 2;
      node.yStart = currentY;
      node.yEnd = currentY + nodeHeight;
      node.y = (node.yStart + node.yEnd) / 2;
      node.flowHeight = nodeHeight;
      node.flowWidth = this.nodeWidth;
      node.xStart = levelX;
      node.xEnd = levelX + this.nodeWidth;

      // Track source/target positions for flows
      node.sourceY = node.yStart; // Where outgoing flows start
      node.targetY = node.yStart; // Where incoming flows end

      this.bounds.minY = Math.min(this.bounds.minY, node.yStart);
      this.bounds.maxY = Math.max(this.bounds.maxY, node.yEnd);

      currentY += nodeHeight + this.nodeGap;
    });
  }

  /**
   * Calculate flow source/target Y positions
   */
  calculateFlowPositions(levels, flows, nodeMap) {
    // Group flows by source and target
    const flowsBySource = new Map();
    const flowsByTarget = new Map();

    flows.forEach(flow => {
      if (!flowsBySource.has(flow.sourceId)) flowsBySource.set(flow.sourceId, []);
      if (!flowsByTarget.has(flow.targetId)) flowsByTarget.set(flow.targetId, []);
      flowsBySource.get(flow.sourceId).push(flow);
      flowsByTarget.get(flow.targetId).push(flow);
    });

    // Sort outgoing flows by target Y position to reduce crossings
    flowsBySource.forEach((sourceFlows, sourceId) => {
      sourceFlows.sort((a, b) => {
        const targetA = nodeMap.get(a.targetId);
        const targetB = nodeMap.get(b.targetId);
        if (!targetA || !targetB) return 0;
        return targetA.y - targetB.y;
      });
    });

    // Sort incoming flows by source Y position to reduce crossings
    flowsByTarget.forEach((targetFlows, targetId) => {
      targetFlows.sort((a, b) => {
        const sourceA = nodeMap.get(a.sourceId);
        const sourceB = nodeMap.get(b.sourceId);
        if (!sourceA || !sourceB) return 0;
        return sourceA.y - sourceB.y;
      });
    });

    // Calculate Y positions for each flow (process by source, sorted by target position)
    flowsBySource.forEach((sourceFlows, sourceId) => {
      const source = nodeMap.get(sourceId);
      if (!source) return;

      sourceFlows.forEach(flow => {
        const flowHeight = flow.weight * this.flowScale;

        // Source position (where flow leaves source node)
        flow.sourceYStart = source.sourceY;
        flow.sourceYEnd = source.sourceY + flowHeight;
        source.sourceY += flowHeight;

        // X positions
        flow.sourceX = source.xEnd;
        flow.sourceLevel = source.level;
      });
    });

    // Calculate target Y positions (process by target, sorted by source position)
    flowsByTarget.forEach((targetFlows, targetId) => {
      const target = nodeMap.get(targetId);
      if (!target) return;

      targetFlows.forEach(flow => {
        const flowHeight = flow.weight * this.flowScale;

        // Target position (where flow enters target node)
        flow.targetYStart = target.targetY;
        flow.targetYEnd = target.targetY + flowHeight;
        target.targetY += flowHeight;

        // X positions
        flow.targetX = target.xStart;
      });
    });
  }

  /**
   * Layout for chord diagram style (all nodes on single circle, flows as chords)
   * @param {Array} levels - Array of node arrays (one per level)
   * @param {Array} flows - Array of { sourceId, targetId, weight }
   * @param {number} levelCount - Number of levels
   */
  layoutConvergentRadial(levels, flows, levelCount) {
    if (!levels || levels.length === 0) {
      return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
    }

    this.levelCount = levelCount;

    // Calculate what the linear layout's center would be (to match positions)
    // Linear bounds: minX=0, maxX = startX + (levelCount-1)*levelSpacing + nodeWidth + 100
    const linearMaxX = this.startX + (levelCount - 1) * this.levelSpacing + this.nodeWidth + 100;

    // Calculate total weight for linear height estimation
    let maxLevelWeight = 0;
    levels.forEach(levelNodes => {
      const totalWeight = levelNodes.reduce((sum, node) => sum + (node.weight || 1), 0);
      maxLevelWeight = Math.max(maxLevelWeight, totalWeight);
    });
    const linearTotalHeight = maxLevelWeight * this.flowScale + (Math.max(...levels.map(l => l.length)) - 1) * this.nodeGap + 60;

    // Use linear layout's center point for the circular layout
    const centerX = linearMaxX / 2;
    const centerY = linearTotalHeight / 2 + 30;

    // Calculate radius based on available space (fit within linear bounds)
    const maxRadius = Math.min(linearMaxX, linearTotalHeight) * 0.35;
    const radius = Math.max(150, maxRadius + this.levelSpacing * 0.1);

    // Build node lookup map
    const nodeMap = new Map();
    levels.forEach(levelNodes => {
      levelNodes.forEach(node => nodeMap.set(node.id, node));
    });

    // Calculate total weight across all levels
    let totalWeight = 0;
    levels.forEach(levelNodes => {
      levelNodes.forEach(node => {
        totalWeight += node.weight || 1;
      });
    });

    // Gap between levels and between nodes
    const levelGap = 0.08; // Gap between level groups
    const nodeGap = 0.015;  // Small gap between nodes within a level
    const totalGaps = (levelCount * levelGap) + levels.reduce((sum, l) => sum + Math.max(0, l.length - 1) * nodeGap, 0);
    const availableAngle = Math.PI * 2 - totalGaps;

    // Position all nodes on a single circle
    let currentAngle = -Math.PI / 2; // Start at top

    levels.forEach((levelNodes, levelIndex) => {
      // Sort nodes within level - numerically if numbers, otherwise alphabetically
      levelNodes.sort(smartCompare);

      levelNodes.forEach((node, nodeIndex) => {
        const nodeWeight = node.weight || 1;
        const nodeAngle = (nodeWeight / totalWeight) * availableAngle;

        // Store radial position info
        node.radius = radius;
        node.angleStart = currentAngle;
        node.angleEnd = currentAngle + nodeAngle;
        node.angle = (node.angleStart + node.angleEnd) / 2;

        // Calculate cartesian coordinates for center of arc
        node.x = centerX + radius * Math.cos(node.angle);
        node.y = centerY + radius * Math.sin(node.angle);

        // Calculate arc endpoints for drawing
        node.arcStartX = centerX + radius * Math.cos(node.angleStart);
        node.arcStartY = centerY + radius * Math.sin(node.angleStart);
        node.arcEndX = centerX + radius * Math.cos(node.angleEnd);
        node.arcEndY = centerY + radius * Math.sin(node.angleEnd);

        // Store center for reference
        node.centerX = centerX;
        node.centerY = centerY;

        // Track where flows attach (will be updated per flow)
        node.sourceAngle = node.angleStart;
        node.targetAngle = node.angleStart;

        currentAngle += nodeAngle + nodeGap;
      });

      // Add level gap after each level group
      currentAngle += levelGap - nodeGap; // Subtract nodeGap since we added it after last node
    });

    // Calculate chord flow positions
    this.calculateChordFlowPositions(levels, flows, nodeMap, centerX, centerY, radius);

    // Calculate bounds - tight bounds around the circular diagram with padding for labels
    const labelPadding = 150; // Extra space for labels extending outward
    this.bounds = {
      minX: centerX - radius - labelPadding,
      maxX: centerX + radius + labelPadding,
      minY: centerY - radius - labelPadding,
      maxY: centerY + radius + labelPadding
    };

    return this.bounds;
  }

  /**
   * Calculate flow positions for chord diagram (curved chords through center)
   */
  calculateChordFlowPositions(levels, flows, nodeMap, centerX, centerY, radius) {
    // Reset flow attachment angles
    nodeMap.forEach(node => {
      node.sourceAngle = node.angleStart;
      node.targetAngle = node.angleStart;
    });

    // Sort flows by source node order for consistent ribbon placement
    const sortedFlows = [...flows].sort((a, b) => {
      const nodeA = nodeMap.get(a.sourceId);
      const nodeB = nodeMap.get(b.sourceId);
      if (!nodeA || !nodeB) return 0;
      return nodeA.angleStart - nodeB.angleStart;
    });

    sortedFlows.forEach(flow => {
      const sourceNode = nodeMap.get(flow.sourceId);
      const targetNode = nodeMap.get(flow.targetId);
      if (!sourceNode || !targetNode) return;

      // Calculate the angular width of this flow
      const totalSourceWeight = sourceNode.weight || 1;
      const sourceAngleSpan = sourceNode.angleEnd - sourceNode.angleStart;
      const flowSourceAngle = (flow.weight / totalSourceWeight) * sourceAngleSpan;

      const totalTargetWeight = targetNode.weight || 1;
      const targetAngleSpan = targetNode.angleEnd - targetNode.angleStart;
      const flowTargetAngle = (flow.weight / totalTargetWeight) * targetAngleSpan;

      // Flow attaches at current position on source and target
      flow.sourceAngleStart = sourceNode.sourceAngle;
      flow.sourceAngleEnd = sourceNode.sourceAngle + flowSourceAngle;
      flow.targetAngleStart = targetNode.targetAngle;
      flow.targetAngleEnd = targetNode.targetAngle + flowTargetAngle;

      // Update attachment positions for next flow
      sourceNode.sourceAngle += flowSourceAngle;
      targetNode.targetAngle += flowTargetAngle;

      // Store center and radius for rendering
      flow.centerX = centerX;
      flow.centerY = centerY;
      flow.radius = radius;
    });
  }

  /**
   * Calculate flow positions for radial layout
   */
  calculateRadialFlowPositions(levels, flows, nodeMap, centerX, centerY) {
    // Group flows by source and target
    const flowsBySource = new Map();
    const flowsByTarget = new Map();

    flows.forEach(flow => {
      if (!flowsBySource.has(flow.sourceId)) flowsBySource.set(flow.sourceId, []);
      if (!flowsByTarget.has(flow.targetId)) flowsByTarget.set(flow.targetId, []);
      flowsBySource.get(flow.sourceId).push(flow);
      flowsByTarget.get(flow.targetId).push(flow);
    });

    // Sort flows to minimize crossings
    flowsBySource.forEach((sourceFlows, sourceId) => {
      sourceFlows.sort((a, b) => {
        const targetA = nodeMap.get(a.targetId);
        const targetB = nodeMap.get(b.targetId);
        if (!targetA || !targetB) return 0;
        return targetA.angle - targetB.angle;
      });
    });

    flowsByTarget.forEach((targetFlows, targetId) => {
      targetFlows.sort((a, b) => {
        const sourceA = nodeMap.get(a.sourceId);
        const sourceB = nodeMap.get(b.sourceId);
        if (!sourceA || !sourceB) return 0;
        return sourceA.angle - sourceB.angle;
      });
    });

    // Calculate angle positions for each flow
    flowsBySource.forEach((sourceFlows, sourceId) => {
      const source = nodeMap.get(sourceId);
      if (!source) return;

      const totalOutWeight = sourceFlows.reduce((sum, f) => sum + f.weight, 0);
      const angleSpan = source.angleEnd - source.angleStart;

      sourceFlows.forEach(flow => {
        const flowAngle = (flow.weight / totalOutWeight) * angleSpan;

        flow.sourceAngleStart = source.sourceAngle;
        flow.sourceAngleEnd = source.sourceAngle + flowAngle;
        flow.sourceRadius = source.radius;
        source.sourceAngle += flowAngle;

        flow.sourceLevel = source.level;
        flow.centerX = centerX;
        flow.centerY = centerY;
      });
    });

    flowsByTarget.forEach((targetFlows, targetId) => {
      const target = nodeMap.get(targetId);
      if (!target) return;

      const totalInWeight = targetFlows.reduce((sum, f) => sum + f.weight, 0);
      const angleSpan = target.angleEnd - target.angleStart;

      targetFlows.forEach(flow => {
        const flowAngle = (flow.weight / totalInWeight) * angleSpan;

        flow.targetAngleStart = target.targetAngle;
        flow.targetAngleEnd = target.targetAngle + flowAngle;
        flow.targetRadius = target.radius;
        target.targetAngle += flowAngle;
      });
    });
  }

  /**
   * Set flow scale (pixels per leaf)
   */
  setFlowScale(scale) {
    this.flowScale = Math.max(2, Math.min(50, scale));
  }

  /**
   * Set level spacing
   */
  setLevelSpacing(spacing) {
    this.levelSpacing = Math.max(100, Math.min(1500, spacing));
  }

  /**
   * Configure layout options
   */
  configure(options) {
    if (options.levelSpacing !== undefined) this.levelSpacing = options.levelSpacing;
    if (options.flowScale !== undefined) this.flowScale = options.flowScale;
    if (options.rootY !== undefined) this.rootY = options.rootY;
    if (options.labelHeight !== undefined) this.labelHeight = options.labelHeight;
    if (options.minFlowWidth !== undefined) this.minFlowWidth = options.minFlowWidth;
  }

  /**
   * Get total width of the diagram
   */
  getTotalWidth() {
    return this.bounds.maxX - this.bounds.minX;
  }

  /**
   * Get total height of the diagram
   */
  getTotalHeight() {
    return this.bounds.maxY + 50; // Add bottom margin
  }
}

export default SankeyLayout;
