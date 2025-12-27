/**
 * SankeyRenderer - Canvas-based rendering for vertical Sankey diagram
 * Draws flowing bands and minimal labels
 */

import { LEVEL_COLORS, STATUS_COLORS } from './SankeyNode.js';

export class SankeyRenderer {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.dpr = window.devicePixelRatio || 1;

    // Configuration
    this.labelHeight = options.labelHeight || 30;
    this.fontFamily = options.fontFamily || '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    this.minLabelWidth = options.minLabelWidth || 30; // Min flow width to show label

    // Cache
    this._lastWidth = 0;
    this._lastHeight = 0;

    // Animation state
    this.animationProgress = 0; // 0 = no hover, 1 = full hover effect
    this.targetProgress = 0;
    this.lastHoveredNodeId = null;
    this.animationSpeed = 0.15; // How fast to animate (0-1, higher = faster)
  }

  /**
   * Resize canvas to match container (with DPR scaling)
   */
  resize(width, height) {
    if (width === this._lastWidth && height === this._lastHeight) {
      return false;
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
   * Main render method - draws entire Sankey diagram (tree-based)
   */
  render(nodes, zoom, pan, viewport) {
    const ctx = this.ctx;

    // Clear canvas
    ctx.save();
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width / this.dpr, this.canvas.height / this.dpr);

    // Apply zoom and pan transform
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);

    // Collect visible elements
    const visibleNodes = [];
    const flows = [];

    // Traverse tree and collect visible elements
    nodes.forEach(rootNode => {
      this.collectVisibleElements(rootNode, viewport, zoom, pan, visibleNodes, flows);
    });

    // Draw flows first (behind everything)
    flows.forEach(({ parent, child }) => {
      this.drawFlow(parent, child);
    });

    // Draw node bars on top of flows
    visibleNodes.forEach(node => {
      this.drawNodeBar(node);
    });

    // Draw labels on top
    visibleNodes.forEach(node => {
      this.drawLabel(node, zoom);
    });

    ctx.restore();
  }

  /**
   * Render convergent Sankey diagram (with separate nodes and flows arrays)
   */
  renderConvergent(levels, flows, zoom, pan, viewport, hoveredNode = null, textScale = 1.0, selectedNode = null) {
    this.textScale = textScale; // Store for use in label drawing
    this.selectedNode = selectedNode; // Store for use in node drawing
    const ctx = this.ctx;

    // Update animation state - active when any node is hovered or selected
    const hasActiveNode = hoveredNode || selectedNode;
    const activeKey = `${hoveredNode?.id || ''}_${selectedNode?.id || ''}`;
    if (activeKey !== this.lastHoveredNodeId) {
      this.lastHoveredNodeId = activeKey;
      this.targetProgress = hasActiveNode ? 1 : 0;
    }

    // Animate progress towards target
    const progressDiff = this.targetProgress - this.animationProgress;
    if (Math.abs(progressDiff) > 0.01) {
      this.animationProgress += progressDiff * this.animationSpeed;
      // Request another frame for animation
      this._needsAnimationFrame = true;
    } else {
      this.animationProgress = this.targetProgress;
      this._needsAnimationFrame = false;
    }

    const t = this.animationProgress; // 0 = normal, 1 = full hover effect

    // Clear canvas
    ctx.save();
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width / this.dpr, this.canvas.height / this.dpr);

    // Apply zoom and pan transform
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);

    // Build node lookup map for flow coloring
    const nodeMap = new Map();
    levels.forEach((levelNodes, levelIndex) => {
      levelNodes.forEach(node => {
        nodeMap.set(node.id, { node, levelIndex });
      });
    });

    // Build highlight sets - include both hovered and selected nodes
    const highlightedFlows = new Set();
    const highlightedNodes = new Set();

    // Always highlight selected node and its connections
    if (selectedNode) {
      highlightedNodes.add(selectedNode.id);
      flows.forEach(flow => {
        if (flow.sourceId === selectedNode.id) {
          highlightedFlows.add(`${flow.sourceId}->${flow.targetId}`);
          highlightedNodes.add(flow.targetId);
        }
        if (flow.targetId === selectedNode.id) {
          highlightedFlows.add(`${flow.sourceId}->${flow.targetId}`);
          highlightedNodes.add(flow.sourceId);
        }
      });
    }

    // Also highlight hovered node and its connections (in addition to selected)
    if (hoveredNode && (!selectedNode || hoveredNode.id !== selectedNode.id)) {
      highlightedNodes.add(hoveredNode.id);
      flows.forEach(flow => {
        if (flow.sourceId === hoveredNode.id) {
          highlightedFlows.add(`${flow.sourceId}->${flow.targetId}`);
          highlightedNodes.add(flow.targetId);
        }
        if (flow.targetId === hoveredNode.id) {
          highlightedFlows.add(`${flow.sourceId}->${flow.targetId}`);
          highlightedNodes.add(flow.sourceId);
        }
      });
    }

    // Calculate animated opacity values
    const normalOpacity = 0.6;
    const dimmedOpacity = 0.1;
    const highlightedOpacity = 0.7;

    // Draw flows
    flows.forEach(flow => {
      const flowKey = `${flow.sourceId}->${flow.targetId}`;
      const isHighlighted = highlightedFlows.has(flowKey);

      let opacity;
      if (t === 0) {
        // No hover - all normal
        opacity = normalOpacity;
      } else if (isHighlighted) {
        // Highlighted flow - lerp from normal to highlighted
        opacity = normalOpacity + (highlightedOpacity - normalOpacity) * t;
      } else {
        // Non-highlighted flow - lerp from normal to dimmed
        opacity = normalOpacity + (dimmedOpacity - normalOpacity) * t;
      }

      this.drawConvergentFlow(flow, zoom, opacity, isHighlighted && t > 0.5, nodeMap);
    });

    // Draw node bars with animated opacity
    levels.forEach((levelNodes, levelIndex) => {
      levelNodes.forEach(node => {
        const isHighlighted = highlightedNodes.has(node.id);
        const highlightAmount = isHighlighted ? t : 0;
        const dimAmount = !isHighlighted ? t : 0;
        this.drawNodeBarConvergent(node, levelIndex, highlightAmount, dimAmount);
      });
    });

    // Draw labels with animated opacity
    levels.forEach((levelNodes) => {
      levelNodes.forEach(node => {
        const isHighlighted = highlightedNodes.has(node.id);
        const highlightAmount = isHighlighted ? t : 0;
        const dimAmount = !isHighlighted ? t : 0;
        this.drawLabelConvergent(node, zoom, highlightAmount, dimAmount);
      });
    });

    ctx.restore();

    return this._needsAnimationFrame;
  }

  /**
   * Draw a flow band for convergent Sankey
   */
  drawConvergentFlow(flow, zoom, opacity = 0.75, highlighted = false, nodeMap = null) {
    const ctx = this.ctx;

    if (!flow.sourceX || !flow.targetX) return;

    const x1 = flow.sourceX;
    const x2 = flow.targetX;
    const sourceTop = flow.sourceYStart;
    const sourceBottom = flow.sourceYEnd;
    const targetTop = flow.targetYStart;
    const targetBottom = flow.targetYEnd;

    // Control points for smooth S-curve
    const controlX1 = x1 + (x2 - x1) * 0.4;
    const controlX2 = x1 + (x2 - x1) * 0.6;

    // Draw curved band
    ctx.beginPath();
    ctx.moveTo(x1, sourceTop);
    ctx.bezierCurveTo(controlX1, sourceTop, controlX2, targetTop, x2, targetTop);
    ctx.lineTo(x2, targetBottom);
    ctx.bezierCurveTo(controlX2, targetBottom, controlX1, sourceBottom, x1, sourceBottom);
    ctx.closePath();

    // Get colors - use status colors for message nodes
    let sourceColor, targetColor;

    if (nodeMap) {
      const sourceInfo = nodeMap.get(flow.sourceId);
      const targetInfo = nodeMap.get(flow.targetId);

      if (sourceInfo) {
        sourceColor = this.getNodeColor(sourceInfo.node, sourceInfo.levelIndex);
      } else {
        const sourceLevel = flow.sourceLevel || 0;
        sourceColor = LEVEL_COLORS[Math.min(sourceLevel, LEVEL_COLORS.length - 1)];
      }

      if (targetInfo) {
        targetColor = this.getNodeColor(targetInfo.node, targetInfo.levelIndex);
      } else {
        const targetLevel = (flow.sourceLevel || 0) + 1;
        targetColor = LEVEL_COLORS[Math.min(targetLevel, LEVEL_COLORS.length - 1)];
      }
    } else {
      // Fallback to level-based colors
      const sourceLevel = flow.sourceLevel || 0;
      const targetLevel = (flow.sourceLevel || 0) + 1;
      sourceColor = LEVEL_COLORS[Math.min(sourceLevel, LEVEL_COLORS.length - 1)];
      targetColor = LEVEL_COLORS[Math.min(targetLevel, LEVEL_COLORS.length - 1)];
    }

    // Convert hex to rgb
    const sr = parseInt(sourceColor.slice(1, 3), 16);
    const sg = parseInt(sourceColor.slice(3, 5), 16);
    const sb = parseInt(sourceColor.slice(5, 7), 16);
    const tr = parseInt(targetColor.slice(1, 3), 16);
    const tg = parseInt(targetColor.slice(3, 5), 16);
    const tb = parseInt(targetColor.slice(5, 7), 16);

    // Create horizontal gradient
    const gradient = ctx.createLinearGradient(x1, 0, x2, 0);
    gradient.addColorStop(0, `rgba(${sr}, ${sg}, ${sb}, ${opacity})`);
    gradient.addColorStop(1, `rgba(${tr}, ${tg}, ${tb}, ${opacity})`);

    ctx.fillStyle = gradient;
    ctx.fill();

    // Subtle edge for non-highlighted flows
    if (!highlighted) {
      ctx.strokeStyle = `rgba(255, 255, 255, ${opacity * 0.3})`;
      ctx.lineWidth = 0.5;
      ctx.stroke();
    }
  }

  /**
   * Get node color - uses status colors for message nodes, level colors for others
   */
  getNodeColor(node, levelIndex) {
    // Message nodes use status colors
    const isMessage = node.source === 'Messages' || node.source === 'Message';
    if (isMessage) {
      const status = (node.originalData?.status || '').toUpperCase();
      return STATUS_COLORS[status] || STATUS_COLORS.DEFAULT;
    }
    // Other nodes use level-based colors
    const colorIndex = Math.min(levelIndex, LEVEL_COLORS.length - 1);
    return LEVEL_COLORS[colorIndex];
  }

  /**
   * Draw node bar for convergent Sankey
   * @param {Object} node - Node to draw
   * @param {number} levelIndex - Level index for coloring
   * @param {number} highlightAmount - 0-1, how much to highlight (1 = full highlight)
   * @param {number} dimAmount - 0-1, how much to dim (1 = fully dimmed)
   */
  drawNodeBarConvergent(node, levelIndex, highlightAmount = 0, dimAmount = 0) {
    const ctx = this.ctx;

    const x = node.xStart;
    const y = node.yStart;
    const width = node.xEnd - node.xStart;
    const height = node.yEnd - node.yStart;

    // Check if this node is selected
    const isSelected = this.selectedNode && this.selectedNode.id === node.id;

    // Get color - status-based for messages, level-based for others
    const baseColor = this.getNodeColor(node, levelIndex);
    const r = parseInt(baseColor.slice(1, 3), 16);
    const g = parseInt(baseColor.slice(3, 5), 16);
    const b = parseInt(baseColor.slice(5, 7), 16);

    // Interpolate opacity: normal (0.75) -> highlighted (1.0) or dimmed (0.2)
    const normalOpacity = 0.75;
    const highlightedOpacity = 1.0;
    const dimmedOpacity = 0.2;

    let opacity = normalOpacity;
    if (highlightAmount > 0) {
      opacity = normalOpacity + (highlightedOpacity - normalOpacity) * highlightAmount;
    } else if (dimAmount > 0) {
      opacity = normalOpacity + (dimmedOpacity - normalOpacity) * dimAmount;
    }

    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${opacity})`;
    ctx.fillRect(x, y, width, height);

    // Draw selection border if selected
    if (isSelected) {
      ctx.strokeStyle = '#3b82f6'; // Blue selection color
      ctx.lineWidth = 3;
      ctx.strokeRect(x - 1, y - 1, width + 2, height + 2);
    }

    // Interpolate border
    const normalBorderOpacity = 0.3;
    const highlightedBorderOpacity = 0.8;
    const dimmedBorderOpacity = 0.1;
    const normalLineWidth = 1;
    const highlightedLineWidth = 2;

    let borderOpacity = normalBorderOpacity;
    let lineWidth = normalLineWidth;

    if (highlightAmount > 0) {
      borderOpacity = normalBorderOpacity + (highlightedBorderOpacity - normalBorderOpacity) * highlightAmount;
      lineWidth = normalLineWidth + (highlightedLineWidth - normalLineWidth) * highlightAmount;
    } else if (dimAmount > 0) {
      borderOpacity = normalBorderOpacity + (dimmedBorderOpacity - normalBorderOpacity) * dimAmount;
    }

    ctx.strokeStyle = `rgba(0, 0, 0, ${borderOpacity})`;
    ctx.lineWidth = lineWidth;
    ctx.strokeRect(x, y, width, height);
  }

  /**
   * Draw label for convergent Sankey
   * @param {Object} node - Node to draw label for
   * @param {number} zoom - Current zoom level
   * @param {number} highlightAmount - 0-1, how much to highlight
   * @param {number} dimAmount - 0-1, how much to dim
   */
  drawLabelConvergent(node, zoom, highlightAmount = 0, dimAmount = 0) {
    const ctx = this.ctx;
    const textScale = this.textScale || 1.0;

    const flowHeight = node.flowHeight || (node.yEnd - node.yStart) || 20;

    // Skip labels for very short flows (unless being highlighted)
    if (flowHeight * zoom < 12 && highlightAmount < 0.3) return;

    const text = node.getDisplayText ? node.getDisplayText(30) : (node.value || '');
    if (!text) return;

    // Interpolate font size: normal (9-12) -> highlighted (14-18), scaled by textScale
    const normalFontSize = Math.max(9, Math.min(12, flowHeight / 2)) * textScale;
    const highlightedFontSize = Math.max(14, Math.min(18, flowHeight / 1.5)) * textScale;
    const fontSize = normalFontSize + (highlightedFontSize - normalFontSize) * highlightAmount;

    // Interpolate font weight: 500 -> 700
    const fontWeight = Math.round(500 + 200 * highlightAmount);
    ctx.font = `${fontWeight} ${fontSize}px ${this.fontFamily}`;

    const labelX = node.xEnd + 6;
    const labelY = node.y;

    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    // Interpolate shadow intensity
    const shadowOpacity = 0.9 + 0.1 * highlightAmount; // 0.9 -> 1.0
    const shadowOffset = 0.5 + 0.5 * highlightAmount;  // 0.5 -> 1.0

    ctx.fillStyle = `rgba(255, 255, 255, ${shadowOpacity})`;
    ctx.fillText(text, labelX + shadowOffset, labelY + shadowOffset);

    // Extra shadow passes for highlighted state
    if (highlightAmount > 0.3) {
      const extraShadowOpacity = (highlightAmount - 0.3) / 0.7; // 0 when < 0.3, 1 when 1.0
      ctx.fillStyle = `rgba(255, 255, 255, ${extraShadowOpacity})`;
      ctx.fillText(text, labelX - shadowOffset, labelY - shadowOffset);
      ctx.fillText(text, labelX + shadowOffset, labelY - shadowOffset);
      ctx.fillText(text, labelX - shadowOffset, labelY + shadowOffset);
    }

    // Interpolate text color
    // Normal: #1f2937 (31, 41, 55)
    // Highlighted: #000000 (0, 0, 0)
    // Dimmed: rgba(31, 41, 55, 0.2)
    let textOpacity = 1.0;
    let r = 31, g = 41, b = 55;

    if (highlightAmount > 0) {
      // Interpolate toward black
      r = Math.round(31 - 31 * highlightAmount);
      g = Math.round(41 - 41 * highlightAmount);
      b = Math.round(55 - 55 * highlightAmount);
    } else if (dimAmount > 0) {
      // Fade out opacity
      textOpacity = 1.0 - 0.8 * dimAmount; // 1.0 -> 0.2
    }

    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${textOpacity})`;
    ctx.fillText(text, labelX, labelY);
  }

  /**
   * Render radial/circular Sankey diagram
   */
  renderConvergentRadial(levels, flows, zoom, pan, viewport, hoveredNode = null, textScale = 1.0, selectedNode = null) {
    this.textScale = textScale;
    this.selectedNode = selectedNode;
    const ctx = this.ctx;

    // Update animation state
    const hasActiveNode = hoveredNode || selectedNode;
    const activeKey = `${hoveredNode?.id || ''}_${selectedNode?.id || ''}`;
    if (activeKey !== this.lastHoveredNodeId) {
      this.lastHoveredNodeId = activeKey;
      this.targetProgress = hasActiveNode ? 1 : 0;
    }

    // Animate progress
    const progressDiff = this.targetProgress - this.animationProgress;
    if (Math.abs(progressDiff) > 0.01) {
      this.animationProgress += progressDiff * this.animationSpeed;
      this._needsAnimationFrame = true;
    } else {
      this.animationProgress = this.targetProgress;
      this._needsAnimationFrame = false;
    }

    const t = this.animationProgress;

    // Clear canvas
    ctx.save();
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width / this.dpr, this.canvas.height / this.dpr);

    // Apply zoom and pan
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);

    // Build node lookup and highlight sets
    const nodeMap = new Map();
    levels.forEach((levelNodes, levelIndex) => {
      levelNodes.forEach(node => {
        nodeMap.set(node.id, { node, levelIndex });
      });
    });

    const highlightedFlows = new Set();
    const highlightedNodes = new Set();

    if (selectedNode) {
      highlightedNodes.add(selectedNode.id);
      flows.forEach(flow => {
        if (flow.sourceId === selectedNode.id) {
          highlightedFlows.add(`${flow.sourceId}->${flow.targetId}`);
          highlightedNodes.add(flow.targetId);
        }
        if (flow.targetId === selectedNode.id) {
          highlightedFlows.add(`${flow.sourceId}->${flow.targetId}`);
          highlightedNodes.add(flow.sourceId);
        }
      });
    }

    if (hoveredNode && (!selectedNode || hoveredNode.id !== selectedNode.id)) {
      highlightedNodes.add(hoveredNode.id);
      flows.forEach(flow => {
        if (flow.sourceId === hoveredNode.id) {
          highlightedFlows.add(`${flow.sourceId}->${flow.targetId}`);
          highlightedNodes.add(flow.targetId);
        }
        if (flow.targetId === hoveredNode.id) {
          highlightedFlows.add(`${flow.sourceId}->${flow.targetId}`);
          highlightedNodes.add(flow.sourceId);
        }
      });
    }

    // Opacity values
    const normalOpacity = 0.6;
    const dimmedOpacity = 0.1;
    const highlightedOpacity = 0.7;

    // Draw radial flows
    flows.forEach(flow => {
      const flowKey = `${flow.sourceId}->${flow.targetId}`;
      const isHighlighted = highlightedFlows.has(flowKey);

      let opacity;
      if (t === 0) {
        opacity = normalOpacity;
      } else if (isHighlighted) {
        opacity = normalOpacity + (highlightedOpacity - normalOpacity) * t;
      } else {
        opacity = normalOpacity + (dimmedOpacity - normalOpacity) * t;
      }

      this.drawRadialFlow(flow, zoom, opacity, isHighlighted && t > 0.5, nodeMap);
    });

    // Draw node arcs
    levels.forEach((levelNodes, levelIndex) => {
      levelNodes.forEach(node => {
        const isHighlighted = highlightedNodes.has(node.id);
        const highlightAmount = isHighlighted ? t : 0;
        const dimAmount = !isHighlighted ? t : 0;
        this.drawNodeArc(node, levelIndex, highlightAmount, dimAmount);
      });
    });

    // Draw labels
    levels.forEach((levelNodes) => {
      levelNodes.forEach(node => {
        const isHighlighted = highlightedNodes.has(node.id);
        const highlightAmount = isHighlighted ? t : 0;
        const dimAmount = !isHighlighted ? t : 0;
        this.drawRadialLabel(node, zoom, highlightAmount, dimAmount);
      });
    });

    ctx.restore();

    return this._needsAnimationFrame;
  }

  /**
   * Draw a chord diagram flow (ribbon connecting two arcs through center)
   */
  drawRadialFlow(flow, zoom, opacity = 0.6, highlighted = false, nodeMap = null) {
    const ctx = this.ctx;

    if (!flow.radius) return;

    const centerX = flow.centerX;
    const centerY = flow.centerY;
    const radius = flow.radius;

    // Source arc angles
    const sa1 = flow.sourceAngleStart;
    const sa2 = flow.sourceAngleEnd;
    // Target arc angles
    const ta1 = flow.targetAngleStart;
    const ta2 = flow.targetAngleEnd;

    // Skip if angles are invalid
    if (sa1 === undefined || ta1 === undefined) return;

    // Calculate chord endpoints on the circle
    const sourceStart = { x: centerX + radius * Math.cos(sa1), y: centerY + radius * Math.sin(sa1) };
    const sourceEnd = { x: centerX + radius * Math.cos(sa2), y: centerY + radius * Math.sin(sa2) };
    const targetStart = { x: centerX + radius * Math.cos(ta1), y: centerY + radius * Math.sin(ta1) };
    const targetEnd = { x: centerX + radius * Math.cos(ta2), y: centerY + radius * Math.sin(ta2) };

    // Draw chord ribbon using bezier curves through center
    ctx.beginPath();

    // Start at source arc start point
    ctx.moveTo(sourceStart.x, sourceStart.y);

    // Arc along source segment (on the circle)
    ctx.arc(centerX, centerY, radius, sa1, sa2);

    // Bezier curve from source end to target start (through center)
    // Control point is at the center
    ctx.quadraticCurveTo(centerX, centerY, targetStart.x, targetStart.y);

    // Arc along target segment (on the circle)
    ctx.arc(centerX, centerY, radius, ta1, ta2);

    // Bezier curve from target end back to source start (through center)
    ctx.quadraticCurveTo(centerX, centerY, sourceStart.x, sourceStart.y);

    ctx.closePath();

    // Get colors based on source node
    let sourceColor;
    if (nodeMap) {
      const sourceInfo = nodeMap.get(flow.sourceId);
      sourceColor = sourceInfo ? this.getNodeColor(sourceInfo.node, sourceInfo.levelIndex) : LEVEL_COLORS[0];
    } else {
      sourceColor = LEVEL_COLORS[flow.sourceLevel || 0];
    }

    // Parse color
    const r = parseInt(sourceColor.slice(1, 3), 16);
    const g = parseInt(sourceColor.slice(3, 5), 16);
    const b = parseInt(sourceColor.slice(5, 7), 16);

    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${opacity})`;
    ctx.fill();

    if (!highlighted) {
      ctx.strokeStyle = `rgba(255, 255, 255, ${opacity * 0.3})`;
      ctx.lineWidth = 0.5;
      ctx.stroke();
    }
  }

  /**
   * Draw a node as an arc segment
   */
  drawNodeArc(node, levelIndex, highlightAmount = 0, dimAmount = 0) {
    const ctx = this.ctx;

    if (!node.radius || node.angleStart === undefined) return;

    const centerX = node.centerX;
    const centerY = node.centerY;
    const radius = node.radius;
    const arcWidth = 15; // Width of arc band

    const isSelected = this.selectedNode && this.selectedNode.id === node.id;

    // Get color
    const baseColor = this.getNodeColor(node, levelIndex);
    const r = parseInt(baseColor.slice(1, 3), 16);
    const g = parseInt(baseColor.slice(3, 5), 16);
    const b = parseInt(baseColor.slice(5, 7), 16);

    // Calculate opacity
    const normalOpacity = 0.85;
    const highlightedOpacity = 1.0;
    const dimmedOpacity = 0.25;

    let opacity = normalOpacity;
    if (highlightAmount > 0) {
      opacity = normalOpacity + (highlightedOpacity - normalOpacity) * highlightAmount;
    } else if (dimAmount > 0) {
      opacity = normalOpacity + (dimmedOpacity - normalOpacity) * dimAmount;
    }

    // Draw arc
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius + arcWidth / 2, node.angleStart, node.angleEnd);
    ctx.arc(centerX, centerY, radius - arcWidth / 2, node.angleEnd, node.angleStart, true);
    ctx.closePath();

    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${opacity})`;
    ctx.fill();

    // Selection border
    if (isSelected) {
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    // Normal border
    const borderOpacity = highlightAmount > 0 ? 0.8 : (dimAmount > 0 ? 0.1 : 0.4);
    ctx.strokeStyle = `rgba(0, 0, 0, ${borderOpacity})`;
    ctx.lineWidth = highlightAmount > 0 ? 2 : 1;
    ctx.stroke();
  }

  /**
   * Draw label for radial node
   */
  drawRadialLabel(node, zoom, highlightAmount = 0, dimAmount = 0) {
    const ctx = this.ctx;
    const textScale = this.textScale || 1.0;

    if (!node.radius || node.angle === undefined) return;

    const text = node.getDisplayText ? node.getDisplayText(20) : (node.value || '');
    if (!text) return;

    // Calculate label position (outside the arc)
    const labelRadius = node.radius + 25;
    const labelX = node.centerX + labelRadius * Math.cos(node.angle);
    const labelY = node.centerY + labelRadius * Math.sin(node.angle);

    // Font size
    const normalFontSize = 10 * textScale;
    const highlightedFontSize = 13 * textScale;
    const fontSize = normalFontSize + (highlightedFontSize - normalFontSize) * highlightAmount;
    const fontWeight = Math.round(500 + 200 * highlightAmount);

    ctx.font = `${fontWeight} ${fontSize}px ${this.fontFamily}`;

    // Rotate text to follow the arc
    ctx.save();
    ctx.translate(labelX, labelY);

    // Rotate based on angle, flip if on left side
    let rotation = node.angle;
    let align = 'left';
    if (node.angle > Math.PI / 2 && node.angle < Math.PI * 1.5) {
      rotation += Math.PI;
      align = 'right';
    }
    ctx.rotate(rotation);

    ctx.textAlign = align;
    ctx.textBaseline = 'middle';

    // Text opacity
    let textOpacity = 1.0;
    if (dimAmount > 0) {
      textOpacity = 1.0 - 0.7 * dimAmount;
    }

    // Shadow
    ctx.fillStyle = `rgba(255, 255, 255, ${0.9 * textOpacity})`;
    ctx.fillText(text, align === 'left' ? 1 : -1, 1);

    // Main text
    ctx.fillStyle = `rgba(31, 41, 55, ${textOpacity})`;
    ctx.fillText(text, 0, 0);

    ctx.restore();
  }

  /**
   * Find node at position for radial Sankey
   */
  findNodeAtPositionRadial(levels, screenX, screenY, zoom, pan) {
    const diagramX = (screenX - pan.x) / zoom;
    const diagramY = (screenY - pan.y) / zoom;

    for (const levelNodes of levels) {
      for (const node of levelNodes) {
        if (!node.radius || !node.centerX) continue;

        // Check if point is within the arc
        const dx = diagramX - node.centerX;
        const dy = diagramY - node.centerY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx);

        // Normalize angle to match our range
        let normalizedAngle = angle;
        if (normalizedAngle < -Math.PI / 2) normalizedAngle += Math.PI * 2;

        const arcWidth = 15;
        const inRadius = distance >= node.radius - arcWidth && distance <= node.radius + arcWidth;

        // Check angle (handle wraparound)
        let inAngle = normalizedAngle >= node.angleStart && normalizedAngle <= node.angleEnd;

        if (inRadius && inAngle) {
          return node;
        }
      }
    }
    return null;
  }

  /**
   * Find node at position for convergent Sankey
   */
  findNodeAtPositionConvergent(levels, screenX, screenY, zoom, pan) {
    const diagramX = (screenX - pan.x) / zoom;
    const diagramY = (screenY - pan.y) / zoom;

    for (const levelNodes of levels) {
      for (const node of levelNodes) {
        const inX = diagramX >= node.xStart && diagramX <= node.xEnd;
        const inY = diagramY >= node.yStart && diagramY <= node.yEnd;
        if (inX && inY) {
          return node;
        }
      }
    }
    return null;
  }

  /**
   * Collect visible nodes and flows
   */
  collectVisibleElements(node, viewport, zoom, pan, visibleNodes, flows) {
    const isVisible = this.isNodeVisible(node, viewport, zoom, pan);

    if (isVisible) {
      visibleNodes.push(node);
    }

    // Check children and collect flows
    node.children.forEach(child => {
      const childVisible = this.isNodeVisible(child, viewport, zoom, pan);

      // Draw flow if either parent or child is visible
      if (isVisible || childVisible) {
        flows.push({ parent: node, child });
      }

      // Recurse
      this.collectVisibleElements(child, viewport, zoom, pan, visibleNodes, flows);
    });
  }

  /**
   * Check if a node is within the visible viewport (horizontal Sankey)
   */
  isNodeVisible(node, viewport, zoom, pan) {
    const margin = 100;

    // Convert node position to screen coordinates
    const screenX = node.x * zoom + pan.x;
    const screenY = node.y * zoom + pan.y;
    const screenHeight = (node.flowHeight || 30) * zoom;

    return (
      screenX + margin > 0 &&
      screenX - margin < viewport.width &&
      screenY + screenHeight / 2 + margin > 0 &&
      screenY - screenHeight / 2 - margin < viewport.height
    );
  }

  /**
   * Draw the node bar (vertical rectangle for horizontal Sankey)
   */
  drawNodeBar(node) {
    const ctx = this.ctx;

    const x = node.xStart;
    const y = node.yStart;
    const width = node.xEnd - node.xStart;
    const height = node.yEnd - node.yStart;

    // Fill with level color
    ctx.fillStyle = this.getFlowColor(node.level, node.levelCount);
    ctx.fillRect(x, y, width, height);

    // Border
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, width, height);
  }

  /**
   * Draw a horizontal flow band between parent and child
   * Creates smooth S-curves flowing left to right
   */
  drawFlow(parent, child) {
    const ctx = this.ctx;

    // Calculate child's portion of parent's flow (vertical height portion)
    const parentFlowHeight = parent.flowHeight || parent.yEnd - parent.yStart;
    const childPortion = child.leafCount / parent.leafCount;
    const sourceHeight = parentFlowHeight * childPortion;

    // Calculate vertical position within parent's span (for the source of the flow)
    let siblingOffset = 0;
    for (const sibling of parent.children) {
      if (sibling === child) break;
      siblingOffset += (sibling.leafCount / parent.leafCount) * parentFlowHeight;
    }

    // Source coordinates (right edge of parent)
    const sourceTop = parent.yStart + siblingOffset;
    const sourceBottom = sourceTop + sourceHeight;
    const x1 = parent.xEnd;  // Right edge of parent

    // Target coordinates (left edge of child, at child's actual position)
    const targetTop = child.yStart;
    const targetBottom = child.yEnd;
    const x2 = child.xStart;  // Left edge of child

    // Control points for smooth horizontal S-curve
    const controlX1 = x1 + (x2 - x1) * 0.4;
    const controlX2 = x1 + (x2 - x1) * 0.6;

    // Draw curved band shape using cubic bezier
    ctx.beginPath();

    // Top edge (left to right) - smooth S-curve
    ctx.moveTo(x1, sourceTop);
    ctx.bezierCurveTo(
      controlX1, sourceTop,
      controlX2, targetTop,
      x2, targetTop
    );

    // Right edge (at child)
    ctx.lineTo(x2, targetBottom);

    // Bottom edge (right to left) - smooth S-curve
    ctx.bezierCurveTo(
      controlX2, targetBottom,
      controlX1, sourceBottom,
      x1, sourceBottom
    );

    // Close path (left edge at parent)
    ctx.closePath();

    // Fill with semi-transparent level-based color
    ctx.fillStyle = this.getFlowColor(child.level, child.levelCount);
    ctx.fill();

    // Subtle border for definition
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 0.5;
    ctx.stroke();
  }

  /**
   * Draw a minimal label for a node (horizontal Sankey)
   */
  drawLabel(node, zoom) {
    const ctx = this.ctx;

    // Get flow height (for horizontal Sankey)
    const flowHeight = node.flowHeight || (node.yEnd - node.yStart) || 30;

    // Skip labels for very short flows when zoomed out
    if (flowHeight * zoom < this.minLabelWidth) {
      return;
    }

    const text = node.getDisplayText(Math.floor(flowHeight / 6));
    if (!text) return;

    // Font size proportional to flow height, with limits
    const baseFontSize = Math.max(9, Math.min(14, flowHeight / 3));
    const fontSize = baseFontSize;

    ctx.font = `600 ${fontSize}px ${this.fontFamily}`;

    // Position label to the right of the node bar
    const labelX = node.xEnd + 5;
    const labelY = node.y;

    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    // Draw text with subtle shadow for readability
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.fillText(text, labelX + 0.5, labelY + 0.5);
    ctx.fillText(text, labelX - 0.5, labelY - 0.5);

    // Main text
    ctx.fillStyle = '#374151'; // Gray-700
    ctx.fillText(text, labelX, labelY);
  }

  /**
   * Get flow color based on level
   */
  getFlowColor(level, levelCount) {
    // Use semi-transparent colors for flows
    const colorIndex = Math.min(level, LEVEL_COLORS.length - 1);
    const baseColor = LEVEL_COLORS[colorIndex];

    // Convert hex to rgba with some transparency
    const r = parseInt(baseColor.slice(1, 3), 16);
    const g = parseInt(baseColor.slice(3, 5), 16);
    const b = parseInt(baseColor.slice(5, 7), 16);

    return `rgba(${r}, ${g}, ${b}, 0.75)`;
  }

  /**
   * Find node at screen position (for hit testing) - horizontal Sankey
   */
  findNodeAtPosition(nodes, screenX, screenY, zoom, pan) {
    // Convert screen to diagram coordinates
    const diagramX = (screenX - pan.x) / zoom;
    const diagramY = (screenY - pan.y) / zoom;

    // Search all nodes (depth-first, children first for top-down priority)
    const findInSubtree = (nodeList) => {
      for (const node of nodeList) {
        // Check children first (they're rendered on top)
        const foundInChildren = findInSubtree(node.children);
        if (foundInChildren) return foundInChildren;

        // Check this node using xStart/xEnd and yStart/yEnd
        const inX = diagramX >= node.xStart && diagramX <= node.xEnd;
        const inY = diagramY >= node.yStart && diagramY <= node.yEnd;
        if (inX && inY) {
          return node;
        }
      }
      return null;
    };

    return findInSubtree(nodes);
  }

  /**
   * Draw highlight around a node (for hover/selection)
   */
  drawNodeHighlight(node, color = '#ffffff', lineWidth = 2) {
    const ctx = this.ctx;
    const halfLabel = this.labelHeight / 2;

    ctx.beginPath();
    ctx.rect(node.xStart - 2, node.y - halfLabel - 2, node.flowWidth + 4, this.labelHeight + 4);
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
}

export default SankeyRenderer;
