/**
 * Tree layout calculation utilities
 * Handles spacing, positioning, and width calculations for tree nodes
 */

/**
 * Calculate max children count at each level of the tree
 * @param {Object} treeData - The tree data
 * @param {number} levelCount - Total number of levels
 * @returns {Array} Array of max children counts per level
 */
export const getMaxChildrenPerLevel = (treeData, levelCount) => {
  const maxChildren = new Array(levelCount).fill(0);

  const traverse = (nodes, level) => {
    if (level >= levelCount) return;

    Object.values(nodes).forEach(node => {
      const childCount = node.children ? Object.keys(node.children).length : 0;
      maxChildren[level] = Math.max(maxChildren[level], childCount);

      if (node.children) {
        traverse(node.children, level + 1);
      }
    });
  };

  traverse(treeData, 0);
  return maxChildren;
};

/**
 * Calculate level spacing (vertical distance between levels)
 * Dynamic based on max children count at that level
 * @param {number} levelIndex - Current level index
 * @param {number} levelCount - Total number of levels
 * @param {number} multiplier - Layer height multiplier (default 1.0)
 * @param {number} baseNodeSize - Node size multiplier (default 1.0)
 * @param {number} maxChildrenAtLevel - Max children any node has at this level (default 1)
 * @returns {number} Spacing in pixels
 */
export const getLevelSpacing = (levelIndex, levelCount, multiplier = 1.0, baseNodeSize = 1.0, maxChildrenAtLevel = 1) => {
  if (levelCount > 1) {
    const maxSpacing = 600; // Taller spacing at top (doubled)
    const minSpacing = 240; // Shorter spacing at bottom (doubled)
    const progress = levelIndex / (levelCount - 1);
    const baseSpacing = maxSpacing - (maxSpacing - minSpacing) * progress;

    // Dynamic spacing based on children count - more children = more height needed
    // Add 80px per child beyond the first, capped at reasonable amount
    const childrenBonus = Math.min(maxChildrenAtLevel - 1, 15) * 80;

    // Add extra spacing based on node size to prevent overlap
    const nodeSizeBonus = (baseNodeSize - 1) * 80;

    // Add extra spacing for second-to-last level which has height multiplier
    const heightMultiplierBonus = (levelIndex === levelCount - 2) ? 100 * baseNodeSize : 0;

    // Add extra spacing for last level (n-1) to give more room for connectors from n-2
    const lastLevelBonus = (levelIndex === levelCount - 1) ? 80 * baseNodeSize : 0;

    // Apply multiplier on top of dynamic spacing
    return (baseSpacing + childrenBonus + nodeSizeBonus + heightMultiplierBonus + lastLevelBonus) * multiplier;
  }
  return 360 * multiplier; // Default if only one level (doubled)
};

/**
 * Calculate node size scale for a given level
 * Larger nodes at top, smaller at bottom, with emphasis on second-to-last level (parents of leaves)
 * @param {number} levelIndex - Current level index
 * @param {number} levelCount - Total number of levels
 * @returns {number} Scale factor
 */
export const getNodeSizeScale = (levelIndex, levelCount) => {
  if (levelCount > 1) {
    const maxScale = 3;
    const minScale = 0.5;

    // Make the second-to-last level (parents of leaves) bigger - scale 1.5
    if (levelIndex === levelCount - 2) {
      return 1.5;
    }

    const progress = levelIndex / (levelCount - 1);
    return maxScale - (maxScale - minScale) * progress;
  }
  return 1;
};

/**
 * Split text into two lines for display
 * @param {string} text - Text to split
 * @returns {Array} Array of one or two lines
 */
export const splitTextIntoLines = (text) => {
  if (!text || text.length <= 12) return [text];

  // Find best split point (prefer space near middle)
  const mid = Math.floor(text.length / 2);
  let splitIndex = -1;

  // Look for space near middle
  for (let i = 0; i <= Math.floor(text.length / 2); i++) {
    if (text[mid + i] === ' ') {
      splitIndex = mid + i;
      break;
    }
    if (text[mid - i] === ' ') {
      splitIndex = mid - i;
      break;
    }
  }

  // If no space found, don't split
  if (splitIndex === -1 || splitIndex === 0 || splitIndex === text.length - 1) {
    return [text];
  }

  return [text.slice(0, splitIndex), text.slice(splitIndex + 1)];
};

/**
 * Calculate the width of a node based on its text content
 * For nodes before n-1, text wraps to two lines and width is based on longer line
 * @param {Object} node - The node object with value, label, source
 * @param {number} levelIndex - Current level index
 * @param {number} levelCount - Total number of levels
 * @param {number} baseNodeSize - Node size multiplier (default 1.0)
 * @param {string} labelOverride - Optional override for label text
 * @param {string} valueOverride - Optional override for value text
 * @returns {number} Node width in pixels
 */
export const calculateNodeWidth = (node, levelIndex, levelCount, baseNodeSize = 1.0, labelOverride = null, valueOverride = null) => {
  const scale = getNodeSizeScale(levelIndex, levelCount);

  // Check if this is a Message node (by source type, not level) - these should NOT scale with baseNodeSize
  const isMessageNode = node && (node.source === 'Messages' || node.source === 'Message');
  const adjustedScale = isMessageNode ? scale : scale * baseNodeSize;

  const baseWidth = 140 * adjustedScale;

  // Get text values - use overrides if provided, otherwise get from node
  const label = labelOverride !== null ? labelOverride : (node?.label || node?.field || '');
  const value = valueOverride !== null ? valueOverride : (node?.value || '');

  // Calculate font sizes - match DecisionNode logic with larger base sizes
  let valueTextSize = 25; // Larger base (was 14)
  let labelTextSize = 22; // Larger base (was 12)
  if (levelIndex === levelCount - 2) {
    valueTextSize = 32; // Original size for MC Number level
  }

  // adjustedScale already includes baseNodeSize for non-message nodes
  const labelFontSize = labelTextSize * adjustedScale;
  const valueFontSize = valueTextSize * adjustedScale;

  // For non-last-level nodes, text wraps to two lines - calculate width based on longer line
  const isLastLevel = levelIndex === levelCount - 1;

  let maxTextWidth = 0;

  if (!isLastLevel && value) {
    // Split value into lines and find the longer one
    const valueLines = splitTextIntoLines(value);
    const longestValueLine = valueLines.reduce((a, b) => a.length > b.length ? a : b, '');
    maxTextWidth = longestValueLine.length * valueFontSize * 0.6;
  } else {
    // Single line text
    const valueTextWidth = value ? value.length * valueFontSize * 0.6 : 0;
    maxTextWidth = valueTextWidth;
  }

  // Also consider label width
  const labelTextWidth = label ? label.length * labelFontSize * 0.65 : 0;
  maxTextWidth = Math.max(maxTextWidth, labelTextWidth);

  // Width is the larger of base width or text width + generous padding
  return Math.max(baseWidth, maxTextWidth + 30 * adjustedScale);
};

/**
 * Calculate minimum spacing based on node size at this level
 * @param {number} levelIndex - Current level index
 * @param {number} levelCount - Total number of levels
 * @param {number} baseNodeSize - Node size multiplier (default 1.0)
 * @returns {number} Minimum spacing in pixels
 */
export const getMinNodeSpacing = (levelIndex, levelCount, baseNodeSize = 1.0) => {
  const scale = getNodeSizeScale(levelIndex, levelCount);
  // Apply baseNodeSize except for last two levels (message nodes)
  const isMessageLevel = levelIndex >= levelCount - 2;
  const adjustedScale = isMessageLevel ? scale : scale * baseNodeSize;
  const baseWidth = 140 * adjustedScale;
  // Add extra gap proportional to node size to prevent overlap
  const gap = 40 * (isMessageLevel ? 1 : baseNodeSize);
  return baseWidth + gap;
};

/**
 * Calculate minimum spacing for a specific node based on its actual width
 * @param {Object} node - The node object
 * @param {number} levelIndex - Current level index
 * @param {number} levelCount - Total number of levels
 * @param {number} baseNodeSize - Node size multiplier (default 1.0)
 * @returns {number} Minimum spacing in pixels
 */
export const getNodeSpacingForNode = (node, levelIndex, levelCount, baseNodeSize = 1.0) => {
  const nodeWidth = calculateNodeWidth(node, levelIndex, levelCount, baseNodeSize);
  const isMessageLevel = levelIndex >= levelCount - 2;
  const gap = 40 * (isMessageLevel ? 1 : baseNodeSize);
  return nodeWidth + gap;
};

/**
 * Calculate width of a branch recursively from bottom up
 * Handles phantom spacing for early-terminating nodes
 * @param {Object} node - Tree node object
 * @param {number} levelCount - Total number of levels
 * @param {number} leafSpacing - Space between leaf nodes
 * @param {number} baseNodeSize - Node size multiplier (default 1.0)
 * @returns {number} Total width of this branch
 */
export const calculateBranchWidth = (node, levelCount, leafSpacing, baseNodeSize = 1.0) => {
  const children = Object.values(node.children || {});
  const nodeDepth = node.depth !== undefined ? node.depth : 0;

  // If no children (leaf node or early termination), return leaf spacing
  if (children.length === 0) {
    // Check if this is an actual leaf node (at the last level) or early termination
    const isActualLeaf = nodeDepth >= levelCount - 1;

    if (isActualLeaf) {
      // This is a real leaf node at the last level
      return leafSpacing;
    } else {
      // This is an early-terminating node - needs phantom spacing
      const levelsRemaining = (levelCount - 1) - nodeDepth;
      const phantomWidth = leafSpacing * (levelsRemaining + 1);
      return phantomWidth;
    }
  }

  // Calculate total width of all children
  const totalWidth = children.reduce((sum, child) => {
    return sum + calculateBranchWidth(child, levelCount, leafSpacing, baseNodeSize);
  }, 0);

  // Get minimum spacing for this node based on its ACTUAL text width
  const minSpacing = getNodeSpacingForNode(node, nodeDepth, levelCount, baseNodeSize);
  const finalWidth = Math.max(totalWidth, minSpacing);

  return finalWidth;
};

/**
 * Calculate the actual X-span (min and max X) of all descendants for centering
 * @param {Object} node - Tree node object
 * @param {number} startX - Starting X position
 * @param {number} levelCount - Total number of levels
 * @param {number} leafSpacing - Space between leaf nodes
 * @param {number} baseNodeSize - Node size multiplier (default 1.0)
 * @returns {Object} Object with minX and maxX properties
 */
export const calculateDescendantsSpan = (node, startX, levelCount, leafSpacing, baseNodeSize = 1.0) => {
  const children = Object.values(node.children || {});

  if (children.length === 0) {
    // Leaf node - span is just the branch width
    const width = calculateBranchWidth(node, levelCount, leafSpacing, baseNodeSize);
    return { minX: startX, maxX: startX + width };
  }

  let currentX = startX;
  let overallMinX = Infinity;
  let overallMaxX = -Infinity;

  children.forEach(child => {
    const childWidth = calculateBranchWidth(child, levelCount, leafSpacing, baseNodeSize);
    const childSpan = calculateDescendantsSpan(child, currentX, levelCount, leafSpacing, baseNodeSize);

    overallMinX = Math.min(overallMinX, childSpan.minX);
    overallMaxX = Math.max(overallMaxX, childSpan.maxX);

    currentX += childWidth;
  });

  return { minX: overallMinX, maxX: overallMaxX };
};

/**
 * Calculate total tree width
 * @param {Object} treeData - Root level tree data
 * @param {number} levelCount - Total number of levels
 * @param {number} leafSpacing - Space between leaf nodes
 * @param {number} baseNodeSize - Node size multiplier (default 1.0)
 * @returns {number} Total width in pixels
 */
export const calculateTreeWidth = (treeData, levelCount, leafSpacing, baseNodeSize = 1.0) => {
  let totalWidth = 0;
  Object.values(treeData).forEach(node => {
    totalWidth += calculateBranchWidth(node, levelCount, leafSpacing, baseNodeSize);
  });
  const margin = 400; // Left and right margins (200px each)
  return Math.max(3000, totalWidth + margin);
};

/**
 * Calculate total tree height using cumulative variable spacing
 * @param {number} levelCount - Total number of levels
 * @param {number} startY - Starting Y position
 * @param {number} multiplier - Layer height multiplier (default 1.0)
 * @param {number} baseNodeSize - Node size multiplier (default 1.0)
 * @param {Array} maxChildrenPerLevel - Array of max children counts per level (optional)
 * @returns {number} Total height in pixels
 */
export const calculateTotalHeight = (levelCount, startY, multiplier = 1.0, baseNodeSize = 1.0, maxChildrenPerLevel = null) => {
  let totalHeight = startY;
  for (let i = 0; i <= levelCount; i++) {
    // The spacing above level i should be based on how many children level i-1 nodes have
    const maxChildrenAtLevel = maxChildrenPerLevel && i > 0 ? (maxChildrenPerLevel[i - 1] || 1) : 1;
    totalHeight += getLevelSpacing(i, levelCount, multiplier, baseNodeSize, maxChildrenAtLevel);
  }
  return totalHeight + 100; // Add bottom margin
};
