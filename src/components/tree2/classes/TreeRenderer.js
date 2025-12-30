/**
 * TreeRenderer - Canvas-based rendering for tree visualization
 * Handles drawing nodes, connectors, and viewport culling
 */

export class TreeRenderer {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.dpr = window.devicePixelRatio || 1;

    // Connector style
    this.connectorType = options.connectorType || 'curved'; // 'curved' or 'elbow'
    this.connectorColor = options.connectorColor || '#94a3b8';

    // Text settings
    this.fontFamily = options.fontFamily || '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

    // Cache for performance
    this._lastWidth = 0;
    this._lastHeight = 0;

    // Hover animation state
    this._hoverScale = 1.0;           // Current animated scale
    this._targetHoverScale = 1.0;     // Target scale (1.0 or 2.0)
    this._lastHoveredNode = null;     // Track for animation
    this._lastHoveredSubtree = new Set(); // Remember subtree for fade-out animation
    this._hoverAnimationSpeed = 0.15; // Animation speed (0-1, higher = faster)
  }

  /**
   * Resize canvas to match container (with DPR scaling)
   */
  resize(width, height) {
    if (width === this._lastWidth && height === this._lastHeight) {
      return false; // No resize needed
    }

    this._lastWidth = width;
    this._lastHeight = height;

    // Set actual canvas size (accounting for device pixel ratio)
    this.canvas.width = width * this.dpr;
    this.canvas.height = height * this.dpr;

    // Set display size
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;

    // Scale context for DPR
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    return true;
  }

  /**
   * Main render method - draws entire tree
   * Returns true if animation is in progress and more frames are needed
   */
  render(nodes, zoom, pan, viewport, hoveredNode = null, selectedNode = null) {
    this._selectedNode = selectedNode; // Store for drawNode to access
    const ctx = this.ctx;

    // Update hover animation state (for fade transition only, no zoom)
    if (hoveredNode !== this._lastHoveredNode) {
      this._lastHoveredNode = hoveredNode;
      this._targetHoverScale = hoveredNode ? 1.3 : 1.0;

      // When starting to hover a new node, build and store the subtree
      if (hoveredNode) {
        this._lastHoveredSubtree = new Set();
        this.collectSubtreeNodes(hoveredNode, this._lastHoveredSubtree);
      }
      // When mouse leaves, keep the old subtree for fade-out animation (don't clear it)
    }

    // Animate hover scale toward target (controls fade transition speed)
    const scaleDiff = this._targetHoverScale - this._hoverScale;
    if (Math.abs(scaleDiff) > 0.01) {
      this._hoverScale += scaleDiff * this._hoverAnimationSpeed;
    } else {
      this._hoverScale = this._targetHoverScale;
      // Clear the stored subtree when animation completes and we're fully faded out
      if (this._hoverScale === 1.0) {
        this._lastHoveredSubtree = new Set();
      }
    }

    const needsMoreFrames = Math.abs(this._targetHoverScale - this._hoverScale) > 0.01;

    // Clear canvas
    ctx.save();
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width / this.dpr, this.canvas.height / this.dpr);

    // Apply zoom and pan transform
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);

    // Use stored subtree (works for both hover-in and hover-out animations)
    const hoveredSubtree = this._lastHoveredSubtree;

    // Collect visible elements
    const visibleNodes = [];
    const connectors = [];

    // Traverse tree and collect visible elements
    nodes.forEach(rootNode => {
      this.collectVisibleElements(rootNode, viewport, zoom, pan, visibleNodes, connectors);
    });

    // Separate nodes and connectors into normal and hovered groups
    const normalNodes = [];
    const hoveredNodes = [];
    const normalConnectors = [];
    const hoveredConnectors = [];

    visibleNodes.forEach(node => {
      if (hoveredSubtree.has(node)) {
        hoveredNodes.push(node);
      } else {
        normalNodes.push(node);
      }
    });

    // Separate connectors
    connectors.forEach(conn => {
      const parentInSubtree = hoveredSubtree.has(conn.parent);
      const childInSubtree = hoveredSubtree.has(conn.child);

      if (parentInSubtree && childInSubtree) {
        hoveredConnectors.push(conn);
      } else {
        normalConnectors.push(conn);
      }
    });

    // Calculate fade amount for non-hovered elements (0 = normal, 1 = fully faded)
    // Use _hoverScale to determine fade, not hoveredNode, so animation works on mouse out too
    const fadeAmount = (this._hoverScale - 1.0) / (1.3 - 1.0); // 0 to 1
    const normalOpacity = fadeAmount > 0.01 ? Math.max(0.2, 1.0 - fadeAmount * 0.8) : 1.0;

    // Draw normal (non-hovered) elements with fade
    if (normalOpacity < 1.0) {
      ctx.globalAlpha = normalOpacity;
    }

    // Draw normal connectors first (behind nodes)
    normalConnectors.forEach(({ parent, child }) => {
      this.drawConnector(parent, child);
    });

    // Draw normal nodes
    normalNodes.forEach(node => {
      this.drawNode(node);
    });

    // Reset opacity
    ctx.globalAlpha = 1.0;

    // Draw hovered subtree on top (full opacity) - also during fade-out animation
    if (hoveredNodes.length > 0 && fadeAmount > 0.01) {
      // Draw hovered connectors
      hoveredConnectors.forEach(({ parent, child }) => {
        this.drawConnector(parent, child);
      });

      // Draw hovered nodes
      hoveredNodes.forEach(node => {
        this.drawNode(node);
      });
    }

    ctx.restore();

    return needsMoreFrames;
  }

  /**
   * Collect all nodes in a subtree (including the root)
   */
  collectSubtreeNodes(node, nodeSet) {
    nodeSet.add(node);
    node.children.forEach(child => {
      this.collectSubtreeNodes(child, nodeSet);
    });
  }

  /**
   * Collect visible nodes and connectors (viewport culling)
   */
  collectVisibleElements(node, viewport, zoom, pan, visibleNodes, connectors) {
    const isVisible = this.isNodeVisible(node, viewport, zoom, pan);

    if (isVisible) {
      visibleNodes.push(node);
    }

    // Check children and collect connectors
    node.children.forEach(child => {
      const childVisible = this.isNodeVisible(child, viewport, zoom, pan);

      // Draw connector if either parent or child is visible
      if (isVisible || childVisible) {
        connectors.push({ parent: node, child });
      }

      // Recurse
      this.collectVisibleElements(child, viewport, zoom, pan, visibleNodes, connectors);
    });
  }

  /**
   * Check if a node is within the visible viewport
   */
  isNodeVisible(node, viewport, zoom, pan) {
    const margin = 100; // Buffer for partial visibility

    // Convert node position to screen coordinates
    const screenX = node.x * zoom + pan.x;
    const screenY = node.y * zoom + pan.y;
    const screenWidth = node.width * zoom;
    const screenHeight = node.height * zoom;

    return (
      screenX + screenWidth / 2 + margin > 0 &&
      screenX - screenWidth / 2 - margin < viewport.width &&
      screenY + screenHeight / 2 + margin > 0 &&
      screenY - screenHeight / 2 - margin < viewport.height
    );
  }

  /**
   * Draw a single node
   */
  drawNode(node) {
    const ctx = this.ctx;
    const x = node.x - node.width / 2;
    const y = node.y - node.height / 2;

    // Get level-based scale for font size (larger at top, smaller toward bottom)
    const levelScale = this.getLevelScale(node.level, node.levelCount, node.scaleBase);

    // Apply user's nodeScale to text (except for last 3 levels which use uniform scale)
    const isLastThreeLevels = node.level >= node.levelCount - 3;
    const textScale = isLastThreeLevels ? levelScale : levelScale * (node.nodeScale || 1);

    // Scale border radius with node size
    const radius = Math.max(4, 8 * levelScale);

    // Get colors
    const fillColor = node.getFillColor();
    const textColor = node.getTextColor();

    // Check if this node is selected
    const isSelected = this._selectedNode === node;

    // Draw rounded rectangle background
    ctx.beginPath();
    this.roundRect(x, y, node.width, node.height, radius);
    ctx.fillStyle = fillColor;
    ctx.fill();

    // Draw border - white if selected, subtle grey otherwise
    ctx.strokeStyle = isSelected ? '#ffffff' : 'rgba(0, 0, 0, 0.1)';
    ctx.lineWidth = Math.max(1, levelScale);
    ctx.stroke();

    // Draw text
    ctx.fillStyle = textColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (node.isMessage() && node.field === 'Variant') {
      // Variant nodes: show variant letter (fixed size)
      const variant = node.originalData?.variant || node.value;
      ctx.font = `bold 16px ${this.fontFamily}`;
      ctx.fillText(variant, node.x, node.y);
    } else if (node.isMessage() && node.field === 'Number') {
      // Number nodes: show message number (fixed size)
      const number = node.originalData?.number || node.value;
      ctx.font = `bold 14px ${this.fontFamily}`;
      ctx.fillText(String(number), node.x, node.y);
    } else {
      // Check if label should be shown (skip generic labels like "Name")
      const skipLabels = ['Name', 'name', 'Number', 'Variant'];
      const showLabel = node.label &&
                        node.label !== node.value &&
                        !skipLabels.includes(node.label);

      const fontSize = Math.round(14 * textScale);
      const labelSize = Math.round(11 * textScale);
      const lineHeight = fontSize * 1.3;
      const maxWidth = node.width - 20;

      // Wrap value text to multiple lines if needed
      const valueLines = this.wrapText(node.value, maxWidth, fontSize);

      if (showLabel) {
        // Two-line layout: label and value
        const totalTextHeight = labelSize + 6 + (valueLines.length * lineHeight);
        const startY = node.y - totalTextHeight / 2 + labelSize / 2;

        // Label (smaller, at top) - blue for level 0, otherwise white/transparent
        ctx.font = `${labelSize}px ${this.fontFamily}`;
        ctx.fillStyle = node.level === 0 ? '#3b82f6' : 'rgba(255, 255, 255, 0.7)';
        ctx.fillText(node.label, node.x, startY);

        // Value lines (larger, below label)
        ctx.font = `bold ${fontSize}px ${this.fontFamily}`;
        ctx.fillStyle = textColor;
        valueLines.forEach((line, i) => {
          ctx.fillText(line, node.x, startY + labelSize + 8 + (i + 0.5) * lineHeight);
        });
      } else {
        // Just value - wrap if needed
        ctx.font = `bold ${fontSize}px ${this.fontFamily}`;

        // Center lines vertically
        const totalHeight = valueLines.length * lineHeight;
        const startY = node.y - totalHeight / 2 + lineHeight / 2;

        valueLines.forEach((line, i) => {
          ctx.fillText(line, node.x, startY + i * lineHeight);
        });
      }
    }
  }

  /**
   * Get scale factor for a level
   * Aggressive exponential scaling - top levels much larger for readability at fit view
   * Scaling applies to levels 0 to n-2, then n-1 and n use the same scale as n-2
   * Must match TreeLayout.getScaleForLevel
   */
  getLevelScale(level, levelCount, scaleBase = 50) {
    if (levelCount <= 1) return 1;
    if (levelCount <= 3) {
      // For very shallow trees, use simple linear scaling
      const t = level / (levelCount - 1);
      return scaleBase * Math.pow(1.0 / scaleBase, t);
    }

    // Exponential decay from scaleBase at level 0 to 1 at level n-2
    // Levels n-1 and n use the same scale as n-2
    const maxScale = scaleBase;  // Level 0 scale - configurable via slider
    const minScale = 1.0;        // Level n-2 scale

    // Clamp level to n-2 so last two levels have same scale
    const effectiveLevel = Math.min(level, levelCount - 3);
    const effectiveLevelCount = levelCount - 2; // Scale range is 0 to n-2

    // Exponential interpolation: scale = maxScale * (minScale/maxScale)^t
    const t = effectiveLevel / (effectiveLevelCount - 1);
    return maxScale * Math.pow(minScale / maxScale, t);
  }

  /**
   * Wrap text to fit within maxWidth, returning array of lines
   */
  wrapText(text, maxWidth, fontSize) {
    if (!text) return [''];

    const words = text.split(' ');
    const lines = [];
    let currentLine = '';
    const charWidth = fontSize * 0.55; // Approximate character width

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const testWidth = testLine.length * charWidth;

      if (testWidth > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }

    if (currentLine) {
      lines.push(currentLine);
    }

    // If still too long (single long word), just return it
    return lines.length > 0 ? lines : [text];
  }

  /**
   * Draw connector between parent and child node
   * Width is based on child's incoming flow width (proportional split from parent)
   * Supports both vertical and horizontal orientations
   */
  drawConnector(parent, child) {
    const ctx = this.ctx;
    const isHorizontal = child.orientation === 'horizontal';

    // Width based on child's incoming flow width
    const strokeWidth = Math.max(0.5, child.incomingWidth || 1);

    ctx.beginPath();
    ctx.strokeStyle = '#d1d5db'; // Light grey
    ctx.lineWidth = strokeWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (isHorizontal) {
      // Horizontal orientation: connector from right side of parent to left side of child
      const x1 = parent.x + parent.width / 2;
      const y1 = parent.y;
      const x2 = child.x - child.width / 2;
      const y2 = child.y;

      if (this.connectorType === 'curved') {
        // Bezier curve (horizontal)
        const controlX = (x1 + x2) / 2;
        ctx.moveTo(x1, y1);
        ctx.bezierCurveTo(controlX, y1, controlX, y2, x2, y2);
      } else {
        // Elbow connector (horizontal-vertical-horizontal)
        const midX = (x1 + x2) / 2;
        ctx.moveTo(x1, y1);
        ctx.lineTo(midX, y1);
        ctx.lineTo(midX, y2);
        ctx.lineTo(x2, y2);
      }
    } else {
      // Vertical orientation: connector from bottom of parent to top of child
      const x1 = parent.x;
      const y1 = parent.y + parent.height / 2;
      const x2 = child.x;
      const y2 = child.y - child.height / 2;

      if (this.connectorType === 'curved') {
        // Bezier curve (vertical)
        const controlY = (y1 + y2) / 2;
        ctx.moveTo(x1, y1);
        ctx.bezierCurveTo(x1, controlY, x2, controlY, x2, y2);
      } else {
        // Elbow connector (vertical-horizontal-vertical)
        const midY = (y1 + y2) / 2;
        ctx.moveTo(x1, y1);
        ctx.lineTo(x1, midY);
        ctx.lineTo(x2, midY);
        ctx.lineTo(x2, y2);
      }
    }

    ctx.stroke();
  }

  /**
   * Draw rounded rectangle path
   */
  roundRect(x, y, width, height, radius) {
    const ctx = this.ctx;
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }

  /**
   * Truncate text to fit width
   */
  truncateText(text, maxWidth, fontSize) {
    if (!text) return '';

    // Approximate character width
    const charWidth = fontSize * 0.6;
    const maxChars = Math.floor(maxWidth / charWidth);

    if (text.length <= maxChars) return text;
    return text.substring(0, maxChars - 2) + '…';
  }

  /**
   * Set connector type
   */
  setConnectorType(type) {
    this.connectorType = type;
  }

  /**
   * Set connector color
   */
  setConnectorColor(color) {
    this.connectorColor = color;
  }

  /**
   * Draw a highlight around a node (for hover/selection)
   */
  drawNodeHighlight(node, color = '#ffffff', lineWidth = 3) {
    const ctx = this.ctx;
    const x = node.x - node.width / 2;
    const y = node.y - node.height / 2;
    const radius = 10;

    ctx.beginPath();
    this.roundRect(x - 2, y - 2, node.width + 4, node.height + 4, radius);
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }

  /**
   * Get node at screen position (for hit testing)
   * Returns null if no node found
   */
  findNodeAtPosition(nodes, screenX, screenY, zoom, pan) {
    // Convert screen to tree coordinates
    const treeX = (screenX - pan.x) / zoom;
    const treeY = (screenY - pan.y) / zoom;

    // Hysteresis: If we have a currently hovered node, check if mouse is still within bounds
    const hoveredNode = this._lastHoveredNode;
    if (hoveredNode && hoveredNode.containsPoint(treeX, treeY)) {
      return hoveredNode;
    }

    // Search all nodes (depth-first, children first since they're on top)
    const findInSubtree = (nodeList) => {
      for (const node of nodeList) {
        // Check children first (they're on top visually)
        const foundInChildren = findInSubtree(node.children);
        if (foundInChildren) return foundInChildren;

        // Check this node
        if (node.containsPoint(treeX, treeY)) {
          return node;
        }
      }
      return null;
    };

    return findInSubtree(nodes);
  }
}

export default TreeRenderer;
