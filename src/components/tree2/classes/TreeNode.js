/**
 * TreeNode - Represents a node in the tree visualization
 * Object-oriented class with memoized layout properties
 */

// Status color mapping - workflow statuses
const STATUS_COLORS = {
  // Workflow statuses
  'INCOMING': '#8B5CF6',
  'NAMING': '#EAB308',
  'CONTENT': '#F97316',
  'PREVIEW': '#3B82F6',
  'APPROVED': '#22C55E',
  'ACTIVE': '#15803D',
  'INACTIVE': '#9CA3AF',
  'ERROR': '#EF4444',
  // Legacy statuses (backward compatibility)
  'PLANNED': '#EAB308',
  'INPROGRESS': '#F97316',
  'IN PROGRESS': '#F97316',
  'LIVE': '#10b981',
  'STOPPED': '#9ca3af',
  'DEFAULT': '#6366f1'
};

// Level-based colors for decision nodes
const LEVEL_COLORS = [
  '#6366f1', // indigo - level 0
  '#eb4c79', // pink - level 1
  '#02a3a4', // teal - level 2
  '#711c7a', // purple - level 3
  '#f59e0b', // amber - level 4
  '#3b82f6', // blue - level 5
  '#8b5cf6'  // violet - level 6+
];

export class TreeNode {
  constructor(data) {
    // Identity
    this.id = data.id || `node_${Math.random().toString(36).substr(2, 9)}`;
    this.value = data.value || '';
    this.label = data.label || '';
    this.source = data.source || '';      // "Audiences" | "Topics" | "Messages"
    this.field = data.field || '';
    this.originalData = data.originalData || null;
    this.status = data.status || '';

    // Layout properties (computed by TreeLayout)
    this.x = 0;
    this.y = 0;
    this.width = 0;
    this.height = 0;
    this.level = 0;
    this.levelCount = 0; // Total levels in tree (set by layout)

    // Hierarchy
    this.children = [];
    this.parent = null;

    // Cached computed values
    this._subtreeWidth = null;
    this._bounds = null;
  }

  /**
   * Add a child node
   */
  addChild(childNode) {
    childNode.parent = this;
    this.children.push(childNode);
    this.invalidateLayout();
    return childNode;
  }

  /**
   * Calculate subtree width (memoized)
   * Used for horizontal positioning
   */
  get subtreeWidth() {
    if (this._subtreeWidth !== null) return this._subtreeWidth;

    if (this.children.length === 0) {
      // Leaf node - just its own width plus spacing
      this._subtreeWidth = this.width + 20;
    } else {
      // Parent node - sum of children's subtree widths
      this._subtreeWidth = this.children.reduce(
        (sum, child) => sum + child.subtreeWidth,
        0
      );
      // Ensure at least as wide as this node
      this._subtreeWidth = Math.max(this._subtreeWidth, this.width + 20);
    }

    return this._subtreeWidth;
  }

  /**
   * Get bounds of this node (for hit testing)
   */
  get bounds() {
    if (this._bounds !== null) return this._bounds;

    this._bounds = {
      left: this.x - this.width / 2,
      right: this.x + this.width / 2,
      top: this.y - this.height / 2,
      bottom: this.y + this.height / 2
    };

    return this._bounds;
  }

  /**
   * Invalidate cached layout values (called when tree structure changes)
   */
  invalidateLayout() {
    this._subtreeWidth = null;
    this._bounds = null;
    if (this.parent) {
      this.parent.invalidateLayout();
    }
  }

  /**
   * Check if this node can be edited (double-click action)
   */
  isEditable() {
    const editableSources = ['Audiences', 'Audience', 'Topics', 'Topic', 'Messages', 'Message'];
    return editableSources.includes(this.source);
  }

  /**
   * Check if this is a message node (leaf)
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
   * Get fill color based on status or level
   */
  getFillColor() {
    // Message nodes use status colors
    if (this.isMessage()) {
      const status = (this.status || '').toUpperCase();
      return STATUS_COLORS[status] || STATUS_COLORS.DEFAULT;
    }

    // Other nodes use level-based colors
    const colorIndex = Math.min(this.level, LEVEL_COLORS.length - 1);
    return LEVEL_COLORS[colorIndex];
  }

  /**
   * Get text color (contrast with fill)
   */
  getTextColor() {
    return '#ffffff';
  }

  /**
   * Check if point is inside this node
   */
  containsPoint(x, y) {
    const b = this.bounds;
    return x >= b.left && x <= b.right && y >= b.top && y <= b.bottom;
  }

  /**
   * Get display text (possibly truncated)
   */
  getDisplayText(maxLength = 30) {
    const text = this.value || '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
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
   * Get depth of this node (0 = root)
   */
  getDepth() {
    let depth = 0;
    let current = this;
    while (current.parent) {
      depth++;
      current = current.parent;
    }
    return depth;
  }

  /**
   * Clone this node (shallow - doesn't clone children)
   */
  clone() {
    const node = new TreeNode({
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
    node.width = this.width;
    node.height = this.height;
    node.level = this.level;
    node.levelCount = this.levelCount;
    return node;
  }
}

export default TreeNode;
