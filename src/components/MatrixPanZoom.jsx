import { useRef, useEffect, useCallback } from 'react';

/**
 * Custom hook for matrix pan and zoom using direct DOM manipulation
 * Avoids re-renders by manipulating transform directly on the DOM
 * @param {Object} containerRef - Ref to the container element
 * @param {Object} contentRef - Ref to the content element to transform
 * @param {number} initialZoom - Initial zoom level
 * @param {Object} initialPan - Initial pan position {x, y}
 * @param {boolean} enabled - Whether the hook should be active (default: true)
 */
export const useMatrixPanZoom = (containerRef, contentRef, initialZoom = 1, initialPan = { x: 0, y: 0 }, enabled = true) => {
  // Refs to store current state without causing re-renders
  const zoomRef = useRef(initialZoom);
  const panRef = useRef(initialPan);
  const spaceRef = useRef(false);
  const panningRef = useRef(false);
  const panStartRef = useRef({ x: 0, y: 0 });

  // Apply transform directly to DOM (works for both HTML and SVG elements)
  const applyTransform = () => {
    if (contentRef.current) {
      const { x, y } = panRef.current;
      const zoom = zoomRef.current;
      const transformString = `translate(${x}px, ${y}px) scale(${zoom})`;

      // Check if it's an SVG element
      if (contentRef.current instanceof SVGElement) {
        contentRef.current.setAttribute('transform', `translate(${x}, ${y}) scale(${zoom})`);
      } else {
        contentRef.current.style.transform = transformString;
      }
    }
  };

  // Update cursor
  const updateCursor = () => {
    if (containerRef.current) {
      if (spaceRef.current) {
        containerRef.current.style.cursor = panningRef.current ? 'grabbing' : 'grab';
      } else {
        containerRef.current.style.cursor = 'default';
      }
    }
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !enabled) return;

    // Set initial transform
    applyTransform();

    // Keyboard handlers
    const handleKeyDown = (e) => {
      const target = e.target;
      const isInputField = target.tagName === 'INPUT' ||
                          target.tagName === 'TEXTAREA' ||
                          target.isContentEditable;

      if (e.code === 'Space' && !spaceRef.current && !isInputField) {
        e.preventDefault();
        spaceRef.current = true;
        updateCursor();
      }
    };

    const handleKeyUp = (e) => {
      const target = e.target;
      const isInputField = target.tagName === 'INPUT' ||
                          target.tagName === 'TEXTAREA' ||
                          target.isContentEditable;

      if (e.code === 'Space' && !isInputField) {
        e.preventDefault();
        spaceRef.current = false;
        panningRef.current = false;
        updateCursor();
      }
    };

    // Mouse handlers for panning
    const handleMouseDown = (e) => {
      if (spaceRef.current) {
        e.preventDefault();
        panningRef.current = true;
        panStartRef.current = {
          x: e.clientX - panRef.current.x,
          y: e.clientY - panRef.current.y
        };
        updateCursor();
      }
    };

    const handleMouseMove = (e) => {
      if (panningRef.current && spaceRef.current) {
        panRef.current = {
          x: e.clientX - panStartRef.current.x,
          y: e.clientY - panStartRef.current.y
        };
        applyTransform();
      }
    };

    const handleMouseUp = () => {
      if (panningRef.current) {
        panningRef.current = false;
        updateCursor();
      }
    };

    // Wheel handler for zooming
    const handleWheel = (e) => {
      if (spaceRef.current) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        zoomRef.current = Math.min(Math.max(0.1, zoomRef.current * delta), 3);
        applyTransform();
      }
    };

    // Attach all listeners
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    container.addEventListener('mousedown', handleMouseDown);
    container.addEventListener('wheel', handleWheel, { passive: false });

    // Cleanup
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      container.removeEventListener('mousedown', handleMouseDown);
      container.removeEventListener('wheel', handleWheel);
    };
  }, [enabled]); // Re-run when enabled changes

  // Return current values getter with stable references
  const getCurrentZoom = useCallback(() => zoomRef.current, []);
  const getCurrentPan = useCallback(() => panRef.current, []);
  const setZoom = useCallback((zoom) => {
    zoomRef.current = zoom;
    applyTransform();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const setPan = useCallback((pan) => {
    panRef.current = pan;
    applyTransform();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    getCurrentZoom,
    getCurrentPan,
    setZoom,
    setPan
  };
};
