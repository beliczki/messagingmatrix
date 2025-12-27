/**
 * TreeInteraction - Handles user input for tree visualization
 * Manages zoom, pan, and click/double-click events
 */

export class TreeInteraction {
  constructor(options = {}) {
    // Zoom state
    this.zoom = options.initialZoom || 0.5;
    this.minZoom = options.minZoom || 0.005; // Allow down to 0.5%
    this.maxZoom = options.maxZoom || 5;

    // Pan state
    this.pan = {
      x: options.initialPanX || 0,
      y: options.initialPanY || 0
    };

    // Interaction state
    this.isPanning = false;
    this.panStart = { x: 0, y: 0 };
    this.spacePressed = false;

    // Callbacks
    this.onUpdate = options.onUpdate || (() => {});
    this.onNodeClick = options.onNodeClick || (() => {});
    this.onNodeDoubleClick = options.onNodeDoubleClick || (() => {});

    // Bound event handlers (for cleanup)
    this._boundHandlers = {};
  }

  /**
   * Attach event listeners to container element
   */
  attach(container) {
    this.container = container;

    // Create bound handlers
    this._boundHandlers = {
      wheel: this.handleWheel.bind(this),
      mousedown: this.handleMouseDown.bind(this),
      mousemove: this.handleMouseMove.bind(this),
      mouseup: this.handleMouseUp.bind(this),
      mouseleave: this.handleMouseUp.bind(this),
      keydown: this.handleKeyDown.bind(this),
      keyup: this.handleKeyUp.bind(this),
      click: this.handleClick.bind(this),
      dblclick: this.handleDoubleClick.bind(this)
    };

    // Attach to container
    container.addEventListener('wheel', this._boundHandlers.wheel, { passive: false });
    container.addEventListener('mousedown', this._boundHandlers.mousedown);
    container.addEventListener('mousemove', this._boundHandlers.mousemove);
    container.addEventListener('mouseup', this._boundHandlers.mouseup);
    container.addEventListener('mouseleave', this._boundHandlers.mouseleave);
    container.addEventListener('click', this._boundHandlers.click);
    container.addEventListener('dblclick', this._boundHandlers.dblclick);

    // Keyboard events on window
    window.addEventListener('keydown', this._boundHandlers.keydown);
    window.addEventListener('keyup', this._boundHandlers.keyup);
  }

  /**
   * Remove event listeners
   */
  detach() {
    if (!this.container) return;

    this.container.removeEventListener('wheel', this._boundHandlers.wheel);
    this.container.removeEventListener('mousedown', this._boundHandlers.mousedown);
    this.container.removeEventListener('mousemove', this._boundHandlers.mousemove);
    this.container.removeEventListener('mouseup', this._boundHandlers.mouseup);
    this.container.removeEventListener('mouseleave', this._boundHandlers.mouseleave);
    this.container.removeEventListener('click', this._boundHandlers.click);
    this.container.removeEventListener('dblclick', this._boundHandlers.dblclick);

    window.removeEventListener('keydown', this._boundHandlers.keydown);
    window.removeEventListener('keyup', this._boundHandlers.keyup);

    this.container = null;
  }

  /**
   * Handle mouse wheel - zoom when space is pressed
   * Uses logarithmic scaling for smooth zoom at all levels
   */
  handleWheel(e) {
    if (!this.spacePressed) return;

    // Only process if target is the canvas element
    if (e.target.tagName !== 'CANVAS') return;

    e.preventDefault();

    const rect = this.container.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Logarithmic zoom - constant percentage change at all zoom levels
    // Use log scale: each scroll step changes zoom by ~10%
    const zoomSpeed = 0.1;
    const direction = e.deltaY > 0 ? -1 : 1;
    const logZoom = Math.log(this.zoom);
    const newLogZoom = logZoom + direction * zoomSpeed;
    const newZoom = Math.max(this.minZoom, Math.min(this.maxZoom, Math.exp(newLogZoom)));

    // Zoom toward mouse position
    const treeX = (mouseX - this.pan.x) / this.zoom;
    const treeY = (mouseY - this.pan.y) / this.zoom;

    this.zoom = newZoom;
    this.pan.x = mouseX - treeX * newZoom;
    this.pan.y = mouseY - treeY * newZoom;

    this.onUpdate();
  }

  /**
   * Handle mouse down - start panning when space is pressed
   */
  handleMouseDown(e) {
    // Only process if target is the canvas element
    if (e.target.tagName !== 'CANVAS') return;

    // Middle mouse button or space + left click
    if (e.button === 1 || (this.spacePressed && e.button === 0)) {
      e.preventDefault();
      this.isPanning = true;
      this.panStart = {
        x: e.clientX - this.pan.x,
        y: e.clientY - this.pan.y
      };
      this.container.style.cursor = 'grabbing';
    }
  }

  /**
   * Handle mouse move - pan if dragging
   */
  handleMouseMove(e) {
    if (this.isPanning) {
      this.pan.x = e.clientX - this.panStart.x;
      this.pan.y = e.clientY - this.panStart.y;
      this.onUpdate();
    } else if (this.spacePressed) {
      this.container.style.cursor = 'grab';
    }
  }

  /**
   * Handle mouse up - stop panning
   */
  handleMouseUp() {
    if (this.isPanning) {
      this._wasPanning = true; // Flag to ignore following click event
    }
    this.isPanning = false;
    if (this.spacePressed) {
      this.container.style.cursor = 'grab';
    } else {
      this.container.style.cursor = 'default';
    }
  }

  /**
   * Handle key down - track space key
   */
  handleKeyDown(e) {
    // Don't capture if typing in an input
    if (this.isInputElement(e.target)) return;

    if (e.code === 'Space') {
      e.preventDefault();
      this.spacePressed = true;
      if (this.container) {
        this.container.style.cursor = 'grab';
      }
    }
  }

  /**
   * Handle key up - release space key
   */
  handleKeyUp(e) {
    if (e.code === 'Space') {
      this.spacePressed = false;
      this.isPanning = false;
      if (this.container) {
        this.container.style.cursor = 'default';
      }
    }
  }

  /**
   * Handle click - find and notify about clicked node
   */
  handleClick(e) {
    // Only process if target is the canvas element
    if (e.target.tagName !== 'CANVAS') return;

    // Ignore if we were panning
    if (this._wasPanning) {
      this._wasPanning = false;
      return;
    }

    const rect = this.container.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;

    this.onNodeClick(screenX, screenY);
  }

  /**
   * Handle double click - find and notify about clicked node
   */
  handleDoubleClick(e) {
    // Only process if target is the canvas element
    if (e.target.tagName !== 'CANVAS') return;

    const rect = this.container.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;

    this.onNodeDoubleClick(screenX, screenY);
  }

  /**
   * Check if element is an input field
   */
  isInputElement(element) {
    return (
      element.tagName === 'INPUT' ||
      element.tagName === 'TEXTAREA' ||
      element.isContentEditable
    );
  }

  /**
   * Convert screen coordinates to tree coordinates
   */
  screenToTree(screenX, screenY) {
    return {
      x: (screenX - this.pan.x) / this.zoom,
      y: (screenY - this.pan.y) / this.zoom
    };
  }

  /**
   * Convert tree coordinates to screen coordinates
   */
  treeToScreen(treeX, treeY) {
    return {
      x: treeX * this.zoom + this.pan.x,
      y: treeY * this.zoom + this.pan.y
    };
  }

  /**
   * Fit the tree to the viewport
   */
  fitToView(bounds, containerWidth, containerHeight) {
    if (!bounds || bounds.maxX <= bounds.minX) return;

    const padding = 0.85; // Use 85% of container
    const treeWidth = bounds.maxX - bounds.minX;
    const treeHeight = bounds.maxY - bounds.minY;

    // Calculate zoom to fit
    const scaleX = (containerWidth * padding) / treeWidth;
    const scaleY = (containerHeight * padding) / treeHeight;
    this.zoom = Math.min(scaleX, scaleY, 1); // Don't zoom in past 100%

    // Center the tree
    const scaledWidth = treeWidth * this.zoom;
    const scaledHeight = treeHeight * this.zoom;
    this.pan.x = (containerWidth - scaledWidth) / 2 - bounds.minX * this.zoom;
    this.pan.y = (containerHeight - scaledHeight) / 2 - bounds.minY * this.zoom + 40;

    this.onUpdate();
  }

  /**
   * Zoom in by factor
   */
  zoomIn(factor = 1.2) {
    this.setZoom(this.zoom * factor);
  }

  /**
   * Zoom out by factor
   */
  zoomOut(factor = 1.2) {
    this.setZoom(this.zoom / factor);
  }

  /**
   * Set zoom level (with centering)
   */
  setZoom(newZoom, centerX = null, centerY = null) {
    const clampedZoom = Math.max(this.minZoom, Math.min(this.maxZoom, newZoom));

    if (centerX !== null && centerY !== null) {
      // Zoom toward specified point
      const treeX = (centerX - this.pan.x) / this.zoom;
      const treeY = (centerY - this.pan.y) / this.zoom;
      this.zoom = clampedZoom;
      this.pan.x = centerX - treeX * clampedZoom;
      this.pan.y = centerY - treeY * clampedZoom;
    } else {
      // Zoom toward center of container
      if (this.container) {
        const rect = this.container.getBoundingClientRect();
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        const treeX = (centerX - this.pan.x) / this.zoom;
        const treeY = (centerY - this.pan.y) / this.zoom;
        this.zoom = clampedZoom;
        this.pan.x = centerX - treeX * clampedZoom;
        this.pan.y = centerY - treeY * clampedZoom;
      } else {
        this.zoom = clampedZoom;
      }
    }

    this.onUpdate();
  }

  /**
   * Reset zoom and pan
   */
  reset() {
    this.zoom = 0.5;
    this.pan = { x: 0, y: 0 };
    this.onUpdate();
  }

  /**
   * Get current state (for persistence)
   */
  getState() {
    return {
      zoom: this.zoom,
      pan: { ...this.pan }
    };
  }

  /**
   * Set state (for restoring)
   */
  setState(state) {
    if (state.zoom !== undefined) this.zoom = state.zoom;
    if (state.pan !== undefined) this.pan = { ...state.pan };
    this.onUpdate();
  }
}

export default TreeInteraction;
