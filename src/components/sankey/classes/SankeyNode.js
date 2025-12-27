/**
 * SankeyNode - Represents a node in the Sankey diagram
 * Adapted from TreeNode for flow-based visualization
 */

// Level-based colors for flows
const LEVEL_COLORS = [
  '#6366f1', // indigo - level 0 (Product)
  '#eb4c79', // pink - level 1 (Strategy)
  '#02a3a4', // teal - level 2 (Audience)
  '#711c7a', // purple - level 3 (Topic)
  '#10b981', // green - level 4 (Message/Number)
  '#3b82f6', // blue - level 5
  '#8b5cf6'  // violet - level 6+
];

// Status color mapping for leaf nodes
const STATUS_COLORS = {
  'ACTIVE': '#10b981',
  'LIVE': '#10b981',
  'IN PROGRESS': '#f59e0b',
  'PLANNED': '#eab308',
  'STOPPED': '#9ca3af',
  'INACTIVE': '#9ca3af',
  'ERROR': '#ef4444',
  'DEFAULT': '#6366f1'
};

export class SankeyNode {
  constructor(data) {
    // Identity
    this.id = data.id || `node_${Math.random().toString(36).substr(2, 9)}`;
    this.value = data.value || '';
    this.label = data.label || '';
    this.source = data.source || '';      // "Audiences" | "Topics" | "Messages"
    this.field = data.field || '';
    this.originalData = data.originalData || null;
    this.status = data.status || '';

    // Sankey layout properties (computed by SankeyLayout)
    this.x = 0;           // Horizontal center position
    this.y = 0;           // Vertical position (level row)
    this.flowWidth = 0;   // Width of flow through this node
    this.xStart = 0;      // Left edge of flow
    this.xEnd = 0;        // Right edge of flow
    this.level = 0;
    this.levelCount = 0;

    // Hierarchy
    this.children = [];
    this.parent = null;

    // Cached computed values
    this._leafCount = null;
  }

  /**
   * Add a child node
   */
  addChild(childNode) {
    childNode.parent = this;
    this.children.push(childNode);
    this.invalidateCache();
    return childNode;
  }

  /**
   * Get leaf count (memoized)
   * Each leaf contributes 1 to the flow
   */
  get leafCount() {
    if (this._leafCount !== null) return this._leafCount;

    if (this.children.length === 0) {
      this._leafCount = 1;
    } else {
      this._leafCount = this.children.reduce(
        (sum, child) => sum + child.leafCount,
        0
      );
    }

    return this._leafCount;
  }

  /**
   * Invalidate cached values
   */
  invalidateCache() {
    this._leafCount = null;
    if (this.parent) {
      this.parent.invalidateCache();
    }
  }

  /**
   * Check if this is a message node (leaf level)
   */
  isMessage() {
    return this.source === 'Messages' || this.source === 'Message';
  }

  /**
   * Check if this is a topic node
   */
  isTopic() {
    return this.source === 'Topics' || this.source === 'Topic';
  }

  /**
   * Check if this is an audience node
   */
  isAudience() {
    return this.source === 'Audiences' || this.source === 'Audience';
  }

  /**
   * Get flow color based on level
   */
  getFlowColor() {
    const colorIndex = Math.min(this.level, LEVEL_COLORS.length - 1);
    return LEVEL_COLORS[colorIndex];
  }

  /**
   * Get status color for message nodes
   */
  getStatusColor() {
    if (this.isMessage()) {
      const status = (this.status || '').toUpperCase();
      return STATUS_COLORS[status] || STATUS_COLORS.DEFAULT;
    }
    return this.getFlowColor();
  }

  /**
   * Get text color for labels
   */
  getTextColor() {
    return '#374151'; // Gray-700
  }

  /**
   * Check if point is within this node's flow area
   */
  containsPoint(px, py, labelHeight = 30) {
    const halfLabel = labelHeight / 2;
    return (
      px >= this.xStart &&
      px <= this.xEnd &&
      py >= this.y - halfLabel &&
      py <= this.y + halfLabel
    );
  }

  /**
   * Traverse this node and all descendants
   */
  traverse(callback) {
    callback(this);
    this.children.forEach(child => child.traverse(callback));
  }

  /**
   * Find a node by ID in this subtree
   */
  findById(id) {
    if (this.id === id) return this;
    for (const child of this.children) {
      const found = child.findById(id);
      if (found) return found;
    }
    return null;
  }

  /**
   * Get all leaf nodes in this subtree
   */
  getLeaves() {
    if (this.children.length === 0) return [this];
    return this.children.flatMap(child => child.getLeaves());
  }

  /**
   * Get display text (possibly truncated)
   */
  getDisplayText(maxLength = 20) {
    const text = this.value || '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 2) + '...';
  }

  /**
   * Clone this node (shallow - doesn't clone children)
   */
  clone() {
    const node = new SankeyNode({
      id: this.id,
      value: this.value,
      label: this.label,
      source: this.source,
      field: this.field,
      originalData: this.originalData,
      status: this.status
    });
    node.x = this.x;
    node.y = this.y;
    node.flowWidth = this.flowWidth;
    node.xStart = this.xStart;
    node.xEnd = this.xEnd;
    node.level = this.level;
    node.levelCount = this.levelCount;
    return node;
  }
}

export { LEVEL_COLORS, STATUS_COLORS };
export default SankeyNode;
