/**
 * TreeLayout - Calculates node positions for tree visualization
 * Simple top-down layout algorithm with parent centering over children
 */

export class TreeLayout {
  constructor(options = {}) {
    // Spacing configuration
    this.baseLevelSpacing = options.levelSpacing || 200;  // Base vertical distance between levels
    this.nodeSpacing = options.nodeSpacing || 30;         // Horizontal spacing between siblings
    this.branchSpacing = options.branchSpacing || 60;     // Extra spacing between branches
    this.rootY = options.rootY || 100;                    // Y position of root nodes

    // Node sizing
    this.baseNodeWidth = options.baseNodeWidth || 250;
    this.baseNodeHeight = options.baseNodeHeight || 80;
    this.minNodeWidth = options.minNodeWidth || 120;
    this.maxNodeWidth = options.maxNodeWidth || 400;

    // Scale range by level (for dynamic node sizing)
    this.maxScale = options.maxScale || 1.8;              // Scale at root level
    this.minScale = options.minScale || 0.7;              // Scale at n-2 level

    // User-adjustable scalers
    this.nodeScale = options.nodeScale || 1.0;            // Affects all except n and n-1
    this.layerHeightScale = options.layerHeightScale || 1.0;  // Affects vertical spacing
    this.scaleBase = options.scaleBase || 50;             // Exponential base for level scaling

    // Orientation: 'vertical' (top-down) or 'horizontal' (left-right)
    this.orientation = options.orientation || 'vertical';

    // State
    this.levelCount = 0;
    this.bounds = { minX: 0, maxX: 0, minY: 0, maxY: 0 };
    this.childrenPerLevel = [];  // Track children count per level for dynamic spacing
  }

  /**
   * Main layout method - positions all nodes in the tree
   * @param {TreeNode[]} rootNodes - Array of root nodes
   * @param {number} levelCount - Total number of levels in tree
   * @returns {Object} bounds - { minX, maxX, minY, maxY }
   */
  layout(rootNodes, levelCount) {
    if (!rootNodes || rootNodes.length === 0) {
      return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
    }

    this.levelCount = levelCount;
    this.bounds = { minX: Infinity, maxX: -Infinity, minY: 0, maxY: 0 };

    // Clear orientation from all nodes (reset from previous horizontal layout)
    this.clearOrientation(rootNodes);

    // Use smaller spacing for horizontal mode (becomes vertical spacing after transform)
    // Store original values to restore after layout
    const originalNodeSpacing = this.nodeSpacing;
    const originalBranchSpacing = this.branchSpacing;
    if (this.orientation === 'horizontal') {
      this.nodeSpacing = 10;      // Tighter vertical spacing between siblings
      this.branchSpacing = 20;    // Tighter vertical spacing between branches
    }

    // Pre-pass: count children per level for dynamic spacing
    this.childrenPerLevel = new Array(levelCount).fill(0);
    this.countChildrenPerLevel(rootNodes, 0);

    // Calculate max split factor to n-1 level to determine starting line width
    // Ensures thinnest n-1 line is at least minLineWidth (1px)
    const minLineWidth = 1;
    let maxSplitFactor = 1;
    rootNodes.forEach(node => {
      const factor = this.calculateMaxSplitFactor(node, 1, 0);
      maxSplitFactor = Math.max(maxSplitFactor, factor);
    });
    const startingLineWidth = maxSplitFactor * minLineWidth;

    // First pass: calculate node sizes based on content and level
    rootNodes.forEach(node => this.calculateNodeSizes(node, 0, startingLineWidth));

    // Second pass: calculate minimum subtree widths (bottom-up)
    rootNodes.forEach(node => this.calculateSubtreeWidths(node, 0));

    // Third pass: position nodes using pre-calculated subtree widths
    let currentX = 0;
    rootNodes.forEach((node, index) => {
      currentX = this.positionNode(node, currentX, this.rootY, 0);
      // Add extra branch spacing between root-level branches
      if (index < rootNodes.length - 1) {
        currentX += this.branchSpacing;
      }
    });

    // Third pass: center the entire tree
    const offsetX = -this.bounds.minX + 100; // Add left margin
    rootNodes.forEach(node => this.offsetSubtree(node, offsetX));

    // Recalculate bounds after centering
    this.bounds.maxX = this.bounds.maxX - this.bounds.minX + 200;
    this.bounds.minX = 0;

    // For horizontal orientation, transform coordinates (swap x/y)
    if (this.orientation === 'horizontal') {
      this.transformToHorizontal(rootNodes);
    }

    // Restore original spacing values
    this.nodeSpacing = originalNodeSpacing;
    this.branchSpacing = originalBranchSpacing;

    return this.bounds;
  }

  /**
   * Transform tree from vertical to horizontal layout
   * Swaps x/y coordinates but keeps node dimensions (width/height) for proper text display
   */
  transformToHorizontal(nodes) {
    // Reset bounds for horizontal
    this.bounds = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity };

    const transformNode = (node) => {
      // Swap x and y positions only (keep width/height for text readability)
      const oldX = node.x;
      const oldY = node.y;
      node.x = oldY;
      node.y = oldX;

      // DON'T swap width/height - keep nodes readable

      // Store orientation for renderer (affects connector attachment points)
      node.orientation = 'horizontal';

      // Update bounds
      const halfWidth = node.width / 2;
      const halfHeight = node.height / 2;
      this.bounds.minX = Math.min(this.bounds.minX, node.x - halfWidth);
      this.bounds.maxX = Math.max(this.bounds.maxX, node.x + halfWidth);
      this.bounds.minY = Math.min(this.bounds.minY, node.y - halfHeight);
      this.bounds.maxY = Math.max(this.bounds.maxY, node.y + halfHeight);

      // Invalidate cached layout
      node.invalidateLayout();

      // Recurse to children
      node.children.forEach(transformNode);
    };

    nodes.forEach(transformNode);

    // Add margins
    const offsetX = -this.bounds.minX + 100;
    const offsetY = -this.bounds.minY + 100;
    nodes.forEach(node => this.offsetSubtree(node, offsetX, offsetY));

    // Recalculate bounds with margins
    this.bounds.minX = 0;
    this.bounds.minY = 0;
    this.bounds.maxX += offsetX + 100;
    this.bounds.maxY += offsetY + 100;
  }

  /**
   * Clear orientation from all nodes (reset for vertical layout)
   */
  clearOrientation(nodes) {
    const clearNode = (node) => {
      delete node.orientation;
      node.children.forEach(clearNode);
    };
    nodes.forEach(clearNode);
  }

  /**
   * Count children per level for dynamic spacing calculations
   */
  countChildrenPerLevel(nodes, level) {
    if (level >= this.levelCount) return;

    nodes.forEach(node => {
      this.childrenPerLevel[level] = Math.max(
        this.childrenPerLevel[level],
        node.children.length
      );
      this.countChildrenPerLevel(node.children, level + 1);
    });
  }

  /**
   * Calculate the maximum split factor to n-1 level
   * Used to determine starting line width so thinnest n-1 line = minWidth
   */
  calculateMaxSplitFactor(node, currentFactor, level) {
    // Stop at n-1 level (second to last)
    if (level >= this.levelCount - 2 || node.children.length === 0) {
      return currentFactor;
    }

    const childFactor = currentFactor * node.children.length;
    let maxFactor = childFactor;

    node.children.forEach(child => {
      const childMaxFactor = this.calculateMaxSplitFactor(child, childFactor, level + 1);
      maxFactor = Math.max(maxFactor, childMaxFactor);
    });

    return maxFactor;
  }

  /**
   * Pre-calculate the minimum width needed for each subtree
   * This ensures siblings don't overlap even when subtrees have different depths
   */
  calculateSubtreeWidths(node, level) {
    // Last 3 levels (n-2, n-1, n) all use scale 1.0, so use uniform spacing
    const isLastThreeLevels = level >= this.levelCount - 3;
    const spacingScale = isLastThreeLevels ? 1 : this.nodeScale;
    const dynamicNodeSpacing = this.nodeSpacing * spacingScale;
    const dynamicBranchSpacing = this.branchSpacing * spacingScale;

    // For horizontal mode, use height for spacing calculation since X becomes Y
    // This prevents excessive vertical gaps
    const nodeDimension = this.orientation === 'horizontal' ? node.height : node.width;

    if (node.children.length === 0) {
      // Leaf node - needs its own dimension + spacing
      node.subtreeMinWidth = nodeDimension + dynamicNodeSpacing;
    } else {
      // Parent node - sum of children's subtree widths + branch spacing
      let totalChildrenWidth = 0;
      node.children.forEach((child, index) => {
        this.calculateSubtreeWidths(child, level + 1);
        totalChildrenWidth += child.subtreeMinWidth;
        if (index < node.children.length - 1 && child.children.length > 0) {
          totalChildrenWidth += dynamicBranchSpacing * 0.5;
        }
      });
      // Subtree width is max of children's total or this node's own dimension
      // Add extra padding for the node itself to prevent overlap with siblings
      const ownWidthNeeded = nodeDimension + dynamicNodeSpacing * 2;
      node.subtreeMinWidth = Math.max(totalChildrenWidth, ownWidthNeeded);
    }
  }

  /**
   * Calculate sizes for node and all descendants
   */
  calculateNodeSizes(node, level, incomingWidth) {
    node.level = level;
    node.levelCount = this.levelCount;
    node.incomingWidth = incomingWidth; // Flow width for connector
    node.nodeScale = this.nodeScale; // Store for renderer to use for text scaling
    node.scaleBase = this.scaleBase; // Store for renderer to use for level scaling

    // Check if this is n, n-1, or n-2 level (last three levels use uniform scale)
    const isLastThreeLevels = level >= this.levelCount - 3;

    // Get scale factor for this level
    const baseScale = this.getScaleForLevel(level);

    // Apply user nodeScale only to levels except n, n-1, and n-2
    const scale = isLastThreeLevels ? baseScale : baseScale * this.nodeScale;

    // Height scales with level, message nodes (Number and Variant) are smaller
    if (node.isMessage() && node.field === 'Variant') {
      // Last level - variants (fixed small size)
      node.width = 50;
      node.height = 40;
    } else if (node.isMessage() && node.field === 'Number') {
      // Second to last level - numbers (fixed small size)
      node.width = 45;
      node.height = 35;
    } else {
      // Regular nodes - calculate width to fit text without truncation
      const fontSize = 14 * scale;
      const charWidth = fontSize * 0.6;

      // Target: 2-line layout for most text, wider nodes for longer names
      const text = node.value || '';
      const textLength = text.length;

      // Calculate ideal width based on text length
      // Aim for 2 lines max for most text, allow 3 for very long
      let targetCharsPerLine;
      if (textLength <= 15) {
        targetCharsPerLine = textLength; // Single line
      } else if (textLength <= 35) {
        targetCharsPerLine = Math.ceil(textLength / 2); // 2 lines
      } else {
        targetCharsPerLine = Math.ceil(textLength / 3); // 3 lines
      }

      // Ensure longest word fits on one line
      const words = text.split(' ');
      const longestWordLength = words.reduce((max, word) => Math.max(max, word.length), 0);
      targetCharsPerLine = Math.max(targetCharsPerLine, longestWordLength);

      // Calculate width
      const targetWidth = targetCharsPerLine * charWidth + 32;
      const minWidth = this.minNodeWidth * scale;
      const maxWidth = 280 * scale; // Wider max

      node.width = Math.min(maxWidth, Math.max(minWidth, targetWidth));

      // Calculate actual lines that will be needed
      const actualCharsPerLine = Math.floor((node.width - 20) / charWidth);
      const valueLines = Math.ceil(textLength / actualCharsPerLine) || 1;

      // Height: base height + extra for multiple lines
      const lineHeight = fontSize * 1.3;
      const baseHeight = this.baseNodeHeight * scale;
      const textHeight = valueLines * lineHeight;

      // Skip generic labels like "Name" for height calculation
      const skipLabels = ['Name', 'name', 'Number', 'Variant'];
      const hasLabel = node.label && !skipLabels.includes(node.label);
      const labelHeight = hasLabel ? fontSize * 0.8 + 10 : 0;

      node.height = Math.max(baseHeight, textHeight + labelHeight + 20);
    }

    // Recurse to children - split incoming width among them
    const childCount = node.children.length || 1;
    const childWidth = incomingWidth / childCount;
    node.children.forEach(child => this.calculateNodeSizes(child, level + 1, childWidth));

    // Invalidate cached values after sizing
    node.invalidateLayout();
  }

  /**
   * Position a node and its descendants
   * Uses pre-calculated subtreeMinWidth to ensure no overlap
   * Returns the X position after this subtree (for next sibling)
   */
  positionNode(node, startX, y, level) {
    node.y = y;

    // Calculate dynamic level spacing based on children count and scale
    const currentLevelSpacing = this.getLevelSpacing(level);

    // Use pre-calculated subtree width to reserve proper space
    const subtreeWidth = node.subtreeMinWidth || node.width + this.nodeSpacing;

    if (node.children.length === 0) {
      // Leaf node - center in its allocated subtree space
      node.x = startX + subtreeWidth / 2;
      this.updateBounds(node);
      return startX + subtreeWidth;
    }

    // Calculate total children width
    let totalChildrenWidth = 0;
    node.children.forEach(child => {
      totalChildrenWidth += child.subtreeMinWidth || child.width + this.nodeSpacing;
    });

    // If this node is wider than its children, offset children to center them
    // This prevents the parent from extending beyond its allocated space
    const childOffset = Math.max(0, (subtreeWidth - totalChildrenWidth) / 2);

    // Position children within this node's subtree space
    let childX = startX + childOffset;
    const childY = y + currentLevelSpacing;

    node.children.forEach(child => {
      childX = this.positionNode(child, childX, childY, level + 1);
    });

    // Center this node over its children (which are now properly centered in allocated space)
    const firstChild = node.children[0];
    const lastChild = node.children[node.children.length - 1];
    const childrenCenter = (firstChild.x + lastChild.x) / 2;
    node.x = childrenCenter;

    this.updateBounds(node);

    // Return the end of this subtree's allocated space
    return startX + subtreeWidth;
  }

  /**
   * Calculate level spacing dynamically based on level depth
   * MUCH larger spacing at top levels for readability when zoomed out
   */
  getLevelSpacing(level) {
    // Use same exponential scale as node sizes for consistent visual hierarchy
    const scale = this.getScaleForLevel(level);

    // Base spacing scaled by level (larger at top)
    let spacing = this.baseLevelSpacing * scale;

    // Add extra height based on max children at this level
    const maxChildren = this.childrenPerLevel[level] || 1;
    if (maxChildren > 3) {
      spacing += (maxChildren - 3) * 15 * scale;
    }

    // Apply user layer height scale
    spacing *= this.layerHeightScale;

    // Minimum spacing (also scaled by layerHeightScale)
    return Math.max(spacing, 100 * scale * this.layerHeightScale);
  }

  /**
   * Get scale factor for a given level
   * Aggressive exponential scaling - top levels much larger for readability at fit view
   * Scaling applies to levels 0 to n-2, then n-1 and n use the same scale as n-2
   */
  getScaleForLevel(level) {
    if (this.levelCount <= 1) return 1;
    if (this.levelCount <= 3) {
      // For very shallow trees, use simple linear scaling
      const t = level / (this.levelCount - 1);
      return this.scaleBase * Math.pow(1.0 / this.scaleBase, t);
    }

    // Exponential decay from scaleBase at level 0 to 1 at level n-2
    // Levels n-1 and n use the same scale as n-2
    const maxScale = this.scaleBase;  // Level 0 scale - configurable
    const minScale = 1.0;             // Level n-2 scale

    // Clamp level to n-2 so last two levels have same scale
    const effectiveLevel = Math.min(level, this.levelCount - 3);
    const effectiveLevelCount = this.levelCount - 2; // Scale range is 0 to n-2

    // Exponential interpolation: scale = maxScale * (minScale/maxScale)^t
    const t = effectiveLevel / (effectiveLevelCount - 1);
    return maxScale * Math.pow(minScale / maxScale, t);
  }

  /**
   * Set scale base (exponential base for level scaling)
   */
  setScaleBase(base) {
    this.scaleBase = Math.max(1, Math.min(200, base));
  }

  /**
   * Measure text width (approximation)
   */
  measureText(text, scale = 1) {
    if (!text) return 0;
    // Approximate: 8 pixels per character at scale 1
    const fontSize = 14 * scale;
    return text.length * fontSize * 0.6;
  }

  /**
   * Update bounds to include this node
   */
  updateBounds(node) {
    const halfWidth = node.width / 2;
    const halfHeight = node.height / 2;

    this.bounds.minX = Math.min(this.bounds.minX, node.x - halfWidth);
    this.bounds.maxX = Math.max(this.bounds.maxX, node.x + halfWidth);
    this.bounds.minY = Math.min(this.bounds.minY, node.y - halfHeight);
    this.bounds.maxY = Math.max(this.bounds.maxY, node.y + halfHeight);
  }

  /**
   * Offset all nodes in subtree by given amount
   */
  offsetSubtree(node, offsetX, offsetY = 0) {
    node.x += offsetX;
    node.y += offsetY;
    node.invalidateLayout(); // Clear cached bounds
    node.children.forEach(child => this.offsetSubtree(child, offsetX, offsetY));
  }

  /**
   * Calculate the total width needed for the tree
   */
  getTotalWidth() {
    return this.bounds.maxX - this.bounds.minX + 200; // Add margins
  }

  /**
   * Calculate the total height needed for the tree
   */
  getTotalHeight() {
    return this.bounds.maxY + 100; // Add bottom margin
  }

  /**
   * Reconfigure layout options
   */
  configure(options) {
    if (options.levelSpacing !== undefined) this.baseLevelSpacing = options.levelSpacing;
    if (options.nodeSpacing !== undefined) this.nodeSpacing = options.nodeSpacing;
    if (options.branchSpacing !== undefined) this.branchSpacing = options.branchSpacing;
    if (options.baseNodeWidth !== undefined) this.baseNodeWidth = options.baseNodeWidth;
    if (options.baseNodeHeight !== undefined) this.baseNodeHeight = options.baseNodeHeight;
    if (options.maxScale !== undefined) this.maxScale = options.maxScale;
    if (options.minScale !== undefined) this.minScale = options.minScale;
    if (options.nodeScale !== undefined) this.nodeScale = options.nodeScale;
    if (options.layerHeightScale !== undefined) this.layerHeightScale = options.layerHeightScale;
  }

  /**
   * Set node scale (affects all nodes except n and n-1 levels)
   */
  setNodeScale(scale) {
    this.nodeScale = Math.max(0.1, Math.min(2.0, scale));
  }

  /**
   * Set layer height scale
   */
  setLayerHeightScale(scale) {
    this.layerHeightScale = Math.max(0.01, Math.min(10.0, scale));
  }

  /**
   * Set orientation ('vertical' or 'horizontal')
   */
  setOrientation(orientation) {
    this.orientation = orientation === 'horizontal' ? 'horizontal' : 'vertical';
  }

  /**
   * Auto-calculate level spacing based on tree depth
   */
  autoSpacing(levelCount, containerHeight) {
    if (levelCount <= 1) {
      this.levelSpacing = 180;
      return;
    }

    // Target: tree fits in 80% of container
    const availableHeight = containerHeight * 0.8 - this.rootY;
    const idealSpacing = availableHeight / (levelCount - 1);

    // Clamp to reasonable range
    this.levelSpacing = Math.max(100, Math.min(300, idealSpacing));
  }
}

export default TreeLayout;
