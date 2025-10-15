/**
 * Tree layout calculation utilities
 * Handles spacing, positioning, and width calculations for tree nodes
 */

/**
 * Calculate level spacing (vertical distance between levels)
 * Taller spacing at top levels, shorter at bottom
 * @param {number} levelIndex - Current level index
 * @param {number} levelCount - Total number of levels
 * @returns {number} Spacing in pixels
 */
export const getLevelSpacing = (levelIndex, levelCount) => {
  if (levelCount > 1) {
    const maxSpacing = 300; // Taller spacing at top
    const minSpacing = 120; // Shorter spacing at bottom
    const progress = levelIndex / (levelCount - 1);
    return maxSpacing - (maxSpacing - minSpacing) * progress;
  }
  return 180; // Default if only one level
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
 * Calculate minimum spacing based on node size at this level
 * @param {number} levelIndex - Current level index
 * @param {number} levelCount - Total number of levels
 * @returns {number} Minimum spacing in pixels
 */
export const getMinNodeSpacing = (levelIndex, levelCount) => {
  const scale = getNodeSizeScale(levelIndex, levelCount);
  const baseWidth = 140 * scale;
  return baseWidth + 20; // Node width + small gap
};

/**
 * Calculate width of a branch recursively from bottom up
 * Handles phantom spacing for early-terminating nodes
 * @param {Object} node - Tree node object
 * @param {number} levelCount - Total number of levels
 * @param {number} leafSpacing - Space between leaf nodes
 * @returns {number} Total width of this branch
 */
export const calculateBranchWidth = (node, levelCount, leafSpacing) => {
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
    return sum + calculateBranchWidth(child, levelCount, leafSpacing);
  }, 0);

  // Get minimum spacing for this level based on scaled node size
  const minSpacing = getMinNodeSpacing(nodeDepth, levelCount);
  const finalWidth = Math.max(totalWidth, minSpacing);

  return finalWidth;
};

/**
 * Calculate the actual X-span (min and max X) of all descendants for centering
 * @param {Object} node - Tree node object
 * @param {number} startX - Starting X position
 * @param {number} levelCount - Total number of levels
 * @param {number} leafSpacing - Space between leaf nodes
 * @returns {Object} Object with minX and maxX properties
 */
export const calculateDescendantsSpan = (node, startX, levelCount, leafSpacing) => {
  const children = Object.values(node.children || {});

  if (children.length === 0) {
    // Leaf node - span is just the branch width
    const width = calculateBranchWidth(node, levelCount, leafSpacing);
    return { minX: startX, maxX: startX + width };
  }

  let currentX = startX;
  let overallMinX = Infinity;
  let overallMaxX = -Infinity;

  children.forEach(child => {
    const childWidth = calculateBranchWidth(child, levelCount, leafSpacing);
    const childSpan = calculateDescendantsSpan(child, currentX, levelCount, leafSpacing);

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
 * @returns {number} Total width in pixels
 */
export const calculateTreeWidth = (treeData, levelCount, leafSpacing) => {
  let totalWidth = 0;
  Object.values(treeData).forEach(node => {
    totalWidth += calculateBranchWidth(node, levelCount, leafSpacing);
  });
  const margin = 400; // Left and right margins (200px each)
  return Math.max(3000, totalWidth + margin);
};

/**
 * Calculate total tree height using cumulative variable spacing
 * @param {number} levelCount - Total number of levels
 * @param {number} startY - Starting Y position
 * @returns {number} Total height in pixels
 */
export const calculateTotalHeight = (levelCount, startY) => {
  let totalHeight = startY;
  for (let i = 0; i <= levelCount; i++) {
    totalHeight += getLevelSpacing(i, levelCount);
  }
  return totalHeight + 100; // Add bottom margin
};
