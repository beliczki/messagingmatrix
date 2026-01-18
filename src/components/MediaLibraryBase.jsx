import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Image as ImageIcon, Info } from 'lucide-react';
import PageHeader from './PageHeader';
import { filterAssets, calculatePlaceholderHeight } from '../utils/assetUtils';

/**
 * MediaLibraryBase - Shared base component for Assets and Creative Library
 *
 * Provides:
 * - Virtual scrolling with masonry/grid/list layouts
 * - Sequential image loading for proper masonry positioning
 * - Filter functionality with AND/OR operators
 * - View mode switching (compact/normal/wide/list)
 * - Reusable scrolling and loading logic
 *
 * Usage:
 * <MediaLibraryBase
 *   items={assets}
 *   renderHeader={({ filterText, setFilterText, viewMode, setViewMode }) => <CustomHeader ... />}
 *   renderItem={(item, isGridView) => <CustomItem item={item} />}
 *   renderPreview={(selectedItem, onClose, allItems, onNavigate) => <CustomPreview ... />}
 *   onItemClick={(item) => setSelectedItem(item)}
 *   getItemId={(item) => item.id}
 *   getItemExtension={(item) => item.extension}
 *   getItemUrl={(item) => item.url}
 * />
 */
const MediaLibraryBase = ({
  // Data
  items = [],
  lookAndFeel = {},
  currentModuleName = 'Media Library',

  // Callbacks
  onMenuToggle = () => {},
  onItemClick = () => {},
  onFilteredItemsChange = null, // (filteredItems) => void - called when filtered items change
  getItemId = (item) => item.id,
  getItemExtension = (item) => item.extension,
  getItemUrl = (item) => item.url || item.thumbnail,
  getItemFilename = (item) => item.filename || item.name || 'Untitled',

  // Render props
  renderHeader = null, // ({ filterText, setFilterText, viewMode, setViewMode, totalItems, filteredCount }) => ReactNode
  renderGridItem = null, // (item) => ReactNode
  renderListItem = null, // (item) => ReactNode
  renderMasonryView = null, // ({ gridRef, columnItems, columnCount, containerHeight, ... }) => ReactNode
  renderPreview = null, // (selectedItem, onClose, allFilteredItems, onNavigate) => ReactNode
  renderFloatingActions = null, // ({ showDebugInfo, setShowDebugInfo, debugInfo }) => ReactNode

  // Configuration
  initialViewMode = 'grid',
  initialFilterText = '',
  loadChunkSize = 16,
  columnWidthPx = 300, // Fixed column width for grid view
  viewModes = [
    { value: 'grid', label: 'Grid View' },
    { value: 'list', label: 'List View' }
  ]
}) => {
  // View state
  const [viewMode, setViewMode] = useState(initialViewMode);
  const [filterText, setFilterText] = useState(initialFilterText);
  const [selectedItem, setSelectedItem] = useState(null);
  const [showDebugInfo, setShowDebugInfo] = useState(false);
  const [containerWidth, setContainerWidth] = useState(1200);

  // Fixed column width for grid view (300px)
  const columnWidth = columnWidthPx;

  // Calculate column count based on container width and column width (with 16px gap)
  const columnCount = Math.max(1, Math.floor((containerWidth + 16) / (columnWidth + 16)));

  // Virtual scrolling state
  const [totalVisible, setTotalVisible] = useState(loadChunkSize);
  const [loadedStart, setLoadedStart] = useState(0);
  const [loadedEnd, setLoadedEnd] = useState(loadChunkSize);
  const scrollContainerRef = useRef(null);
  const isUpdatingWindow = useRef(false);
  const lastUpdateTime = useRef(0);
  const itemPositions = useRef(new Map());
  const gridRef = useRef(null);
  const chunkBoundaries = useRef(new Map());

  // Sequential masonry loading state
  const initializeColumns = useCallback((count) => {
    const cols = {};
    for (let i = 0; i < count; i++) {
      cols[i] = [];
    }
    return cols;
  }, []);

  const initializeHeights = useCallback((count) => {
    const heights = {};
    for (let i = 0; i < count; i++) {
      heights[i] = 0;
    }
    return heights;
  }, []);

  // Build masonry layout with placeholders using known dimensions from spreadsheet
  const buildMasonryWithPlaceholders = useCallback((filteredItems, colCount, colWidth) => {
    if (filteredItems.length === 0) {
      return {
        columns: initializeColumns(colCount),
        heights: initializeHeights(colCount),
        chunks: new Map()
      };
    }

    const columns = initializeColumns(colCount);
    const heights = initializeHeights(colCount);
    const chunks = new Map();
    const effectiveColumnWidth = colWidth || 300;

    // Distribute items to columns based on calculated placeholder heights
    filteredItems.forEach((item, index) => {
      // Calculate placeholder height from dimensions
      const placeholderHeight = calculatePlaceholderHeight(item, effectiveColumnWidth);

      // Find shortest column
      const heightsArray = Object.values(heights);
      const shortestCol = heightsArray.indexOf(Math.min(...heightsArray));

      // Add to column with index info
      columns[shortestCol].push({ ...item, originalIndex: index });

      // Update chunk boundaries
      const chunkIndex = Math.floor(index / loadChunkSize);
      const itemYStart = heights[shortestCol];
      const itemYEnd = heights[shortestCol] + placeholderHeight;

      const existingBoundary = chunks.get(chunkIndex);
      if (existingBoundary) {
        chunks.set(chunkIndex, {
          start: Math.min(existingBoundary.start, itemYStart),
          end: Math.max(existingBoundary.end, itemYEnd)
        });
      } else {
        chunks.set(chunkIndex, {
          start: itemYStart,
          end: itemYEnd
        });
      }

      // Update column height
      heights[shortestCol] += placeholderHeight + 16; // 16px gap
    });

    return { columns, heights, chunks };
  }, [gridRef, loadChunkSize, initializeColumns, initializeHeights]);

  // Append new chunk placeholders to existing masonry
  const appendChunkToMasonry = useCallback((newItems, startIndex, existingColumns, existingHeights, existingChunks, colWidth) => {
    if (newItems.length === 0) {
      return { columns: existingColumns, heights: existingHeights, chunks: existingChunks };
    }

    const columns = { ...existingColumns };
    const heights = { ...existingHeights };
    const chunks = new Map(existingChunks);
    const effectiveColumnWidth = colWidth || 300;

    // Distribute new items to columns based on calculated placeholder heights
    newItems.forEach((item, offset) => {
      const index = startIndex + offset;

      // Calculate placeholder height from dimensions
      const placeholderHeight = calculatePlaceholderHeight(item, effectiveColumnWidth);

      // Find shortest column
      const heightsArray = Object.values(heights);
      const shortestCol = heightsArray.indexOf(Math.min(...heightsArray));

      // Add to column with index info
      columns[shortestCol].push({ ...item, originalIndex: index });

      // Update chunk boundaries
      const chunkIndex = Math.floor(index / loadChunkSize);
      const itemYStart = heights[shortestCol];
      const itemYEnd = heights[shortestCol] + placeholderHeight;

      const existingBoundary = chunks.get(chunkIndex);
      if (existingBoundary) {
        chunks.set(chunkIndex, {
          start: Math.min(existingBoundary.start, itemYStart),
          end: Math.max(existingBoundary.end, itemYEnd)
        });
      } else {
        chunks.set(chunkIndex, {
          start: itemYStart,
          end: itemYEnd
        });
      }

      // Update column height
      heights[shortestCol] += placeholderHeight + 16; // 16px gap
    });

    return { columns, heights, chunks };
  }, [gridRef, loadChunkSize, columnCount]);

  const [columnItems, setColumnItems] = useState(() => initializeColumns(columnCount));
  const [columnHeights, setColumnHeights] = useState(() => initializeHeights(columnCount));
  const [nextItemIndex, setNextItemIndex] = useState(0);
  const loadingImageRef = useRef(null);
  const processedItems = useRef(new Set());
  const columnItemsRef = useRef(columnItems);
  const columnHeightsRef = useRef(columnHeights);
  const placeholdersBuiltUpTo = useRef(0); // Track how many items have placeholders built

  // Keep refs in sync
  useEffect(() => {
    columnItemsRef.current = columnItems;
  }, [columnItems]);

  useEffect(() => {
    columnHeightsRef.current = columnHeights;
  }, [columnHeights]);

  // Save current item positions
  const saveItemPositions = useCallback(() => {
    if (!gridRef.current) return;

    const itemElements = gridRef.current.querySelectorAll('[data-item-id]');
    itemElements.forEach(element => {
      const id = element.getAttribute('data-item-id');
      const rect = element.getBoundingClientRect();
      itemPositions.current.set(id, {
        height: rect.height
      });
    });
  }, []);

  // Handle image/video load - add to shortest column and trigger next
  const handleImageLoaded = useCallback((item, itemIndex, event) => {
    const itemId = getItemId(item);

    // Check if this was an error event
    const isError = event.type === 'error';
    if (isError) {
      console.error(`❌ Failed to load creative:`, {
        filename: getItemFilename(item),
        url: getItemUrl(item),
        item: item
      });
    }

    if (processedItems.current.has(itemId)) {
      // console.log(`⚠️ Item #${itemIndex} already processed, skipping: ${getItemFilename(item)}`);
      setNextItemIndex(itemIndex + 1);
      return;
    }

    processedItems.current.add(itemId);

    // List view uses fixed row height, so chunk boundaries are already set
    // Just mark as loaded and move to next
    if (viewMode === 'list') {
      // console.log(`✅ List item #${itemIndex} loaded, triggering next item #${itemIndex + 1}`);
      setNextItemIndex(itemIndex + 1);
      return;
    }

    // Grid view with new placeholder system:
    // - Items are already placed in columns from buildMasonryWithPlaceholders
    // - We just need to mark them as loaded by expanding loadedEnd
    // - Layout height is already estimated from File_dimensions, keeping layout stable

    // Expand the loaded range to include this item
    setLoadedEnd(prev => Math.max(prev, itemIndex + 1));

    // For error events, skip dimension calculation
    if (isError) {
      setNextItemIndex(itemIndex + 1);
      return;
    }

    // Store actual dimensions for reference (optional, for future use)
    const extension = getItemExtension(item);
    const isVideo = extension === 'mp4';
    const media = event.target;
    const mediaHeight = isVideo ? media.videoHeight : media.naturalHeight;
    const mediaWidth = isVideo ? media.videoWidth : media.naturalWidth;

    if (mediaHeight && mediaWidth) {
      const renderedHeight = (mediaHeight / mediaWidth) * columnWidth;

      itemPositions.current.set(itemId, {
        height: renderedHeight
      });
    }

    // console.log(`✅ Item #${itemIndex} loaded (range: 0-${itemIndex + 1}), moving to next`);
    setNextItemIndex(itemIndex + 1);
  }, [loadChunkSize, viewMode, getItemId, getItemFilename, getItemExtension, columnWidth]);

  // Scroll-based virtual scrolling
  const handleScroll = useCallback(() => {
    const now = Date.now();
    if (isUpdatingWindow.current && now - lastUpdateTime.current > 500) {
      isUpdatingWindow.current = false;
    }

    if (isUpdatingWindow.current || !scrollContainerRef.current) return;

    const container = scrollContainerRef.current;
    const scrollTop = container.scrollTop;
    const clientHeight = container.clientHeight;

    const totalItems = filterAssets(items, filterText).length;
    if (totalItems === 0) return;

    if (chunkBoundaries.current.size === 0) {
      if (loadedStart !== 0 || loadedEnd !== loadChunkSize * 2) {
        isUpdatingWindow.current = true;
        lastUpdateTime.current = Date.now();
        saveItemPositions();
        setTotalVisible(loadChunkSize * 2);
        setLoadedStart(0);
        setLoadedEnd(loadChunkSize * 2);
        requestAnimationFrame(() => {
          isUpdatingWindow.current = false;
        });
      }
      return;
    }

    const viewportStart = scrollTop;
    const viewportEnd = scrollTop + clientHeight;

    const visibleChunks = [];
    chunkBoundaries.current.forEach((bounds, chunkIndex) => {
      if (bounds.end >= viewportStart && bounds.start <= viewportEnd) {
        visibleChunks.push(chunkIndex);
      }
    });

    if (visibleChunks.length === 0) {
      const maxColHeight = Math.max(...Object.values(columnHeights));

      if (scrollTop > maxColHeight) {
        return;
      }

      const targetStart = 0;
      const targetEnd = Math.min(totalItems, loadChunkSize * 2);
      const targetVisible = targetEnd;

      if (targetStart !== loadedStart || targetEnd !== loadedEnd) {
        isUpdatingWindow.current = true;
        lastUpdateTime.current = Date.now();
        saveItemPositions();
        setTotalVisible(targetVisible);
        setLoadedStart(targetStart);
        setLoadedEnd(targetEnd);
        requestAnimationFrame(() => {
          isUpdatingWindow.current = false;
        });
      }
      return;
    }

    const minVisibleChunk = Math.min(...visibleChunks);
    const maxVisibleChunk = Math.max(...visibleChunks);

    const totalChunks = Math.ceil(totalItems / loadChunkSize);
    const targetStartChunk = Math.max(0, minVisibleChunk - 1);
    const targetEndChunk = Math.min(totalChunks - 1, maxVisibleChunk + 1);

    const targetStart = targetStartChunk * loadChunkSize;
    const targetEnd = Math.min(totalItems, (targetEndChunk + 1) * loadChunkSize);
    const targetVisible = Math.max(targetEnd, loadChunkSize * 2);

    // Check if we need to build more placeholders
    if (targetEnd > placeholdersBuiltUpTo.current && placeholdersBuiltUpTo.current < totalItems) {
      const filtered = filterAssets(items, filterText);
      const newItemsStart = placeholdersBuiltUpTo.current;
      const newItemsEnd = Math.min(targetEnd, filtered.length);
      const newItems = filtered.slice(newItemsStart, newItemsEnd);

      if (newItems.length > 0) {
        // Append new chunk placeholders to existing columns
        const { columns, heights, chunks } = appendChunkToMasonry(
          newItems,
          newItemsStart,
          columnItemsRef.current,
          columnHeightsRef.current,
          chunkBoundaries.current,
          columnWidth
        );

        setColumnItems(columns);
        setColumnHeights(heights);
        chunkBoundaries.current = chunks;
        placeholdersBuiltUpTo.current = newItemsEnd;
      }
    }

    if (targetStart !== loadedStart || targetEnd !== loadedEnd) {
      isUpdatingWindow.current = true;
      lastUpdateTime.current = Date.now();

      saveItemPositions();

      setTotalVisible(targetVisible);
      setLoadedStart(targetStart);
      setLoadedEnd(targetEnd);

      requestAnimationFrame(() => {
        isUpdatingWindow.current = false;
      });
    }
  }, [items, filterText, loadedStart, loadedEnd, saveItemPositions, loadChunkSize, columnHeights, appendChunkToMasonry, columnWidth]);

  // Setup scroll listener
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      container.removeEventListener('scroll', handleScroll);
    };
  }, [handleScroll]);

  // Track container width for responsive columns
  useEffect(() => {
    const updateContainerWidth = () => {
      if (scrollContainerRef.current) {
        // Get the actual content width by measuring the inner padding box
        const style = getComputedStyle(scrollContainerRef.current);
        const paddingLeft = parseFloat(style.paddingLeft) || 0;
        const paddingRight = parseFloat(style.paddingRight) || 0;
        const rawWidth = scrollContainerRef.current.clientWidth;
        const width = rawWidth - paddingLeft - paddingRight;
        setContainerWidth(width);
      }
    };

    // Initial measurement immediately
    updateContainerWidth();

    // Also measure after a delay to catch late layout
    const timer = setTimeout(updateContainerWidth, 200);

    // Listen for resize
    window.addEventListener('resize', updateContainerWidth);

    // Also observe the scroll container for size changes
    const resizeObserver = new ResizeObserver(() => {
      // Small delay to let layout settle
      requestAnimationFrame(updateContainerWidth);
    });
    if (scrollContainerRef.current) {
      resizeObserver.observe(scrollContainerRef.current);
    }

    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', updateContainerWidth);
      resizeObserver.disconnect();
    };
  }, [columnWidth]);

  // Removed: Old sequential loading reset effects
  // Now handled by placeholder-based masonry building below

  // Removed: Items change effect - now handled by placeholder building

  // When loaded range changes, only reload the newly visible items
  useEffect(() => {
    if (viewMode !== 'list') {
      const currentLoadedIndices = new Set();
      Object.values(columnItems).flat().forEach(item => {
        currentLoadedIndices.add(item.originalIndex);
      });

      let needsReload = false;
      for (let i = loadedStart; i < loadedEnd; i++) {
        if (!currentLoadedIndices.has(i)) {
          needsReload = true;
          break;
        }
      }

      if (needsReload && currentLoadedIndices.size === 0) {
        setNextItemIndex(loadedStart);
      }
    }
  }, [loadedStart, loadedEnd, viewMode, columnItems]);

  // Get filtered items - memoized to prevent unnecessary recalculations
  const allFilteredItems = useMemo(() => {
    // console.log('🔍 MediaLibraryBase - filtering items:', items?.length || 0, 'total, filterText:', filterText);
    const filtered = filterAssets(items, filterText);
    // console.log('✅ MediaLibraryBase - filtered result:', filtered?.length || 0, 'items');
    return filtered;
  }, [items, filterText]);

  // Notify parent component when filtered items change
  useEffect(() => {
    if (onFilteredItemsChange) {
      onFilteredItemsChange(allFilteredItems);
    }
  }, [allFilteredItems, onFilteredItemsChange]);

  // Build masonry with placeholders for visible chunks only
  useEffect(() => {
    if (viewMode === 'list') return;

    const filtered = filterAssets(items, filterText);

    // Only build placeholders for initial visible chunks (not all items!)
    const initialLoadSize = loadChunkSize * 2; // First 2 chunks
    const visibleItems = filtered.slice(0, initialLoadSize);

    // Build masonry layout with only the visible chunk items
    const { columns, heights, chunks } = buildMasonryWithPlaceholders(visibleItems, columnCount, columnWidth);

    setColumnItems(columns);
    setColumnHeights(heights);
    chunkBoundaries.current = chunks;
    processedItems.current.clear();
    itemPositions.current.clear(); // Clear cached heights to avoid size contamination on filter change
    placeholdersBuiltUpTo.current = visibleItems.length; // Track how many placeholders we've built

    // Set visible range
    setLoadedStart(0);
    setLoadedEnd(initialLoadSize);
    setTotalVisible(initialLoadSize); // Only show what we've created placeholders for
    setNextItemIndex(0); // Start loading the first chunks
  }, [filterText, items, viewMode, columnCount, columnWidth, buildMasonryWithPlaceholders, loadChunkSize]);

  const totalItems = allFilteredItems.length;
  const visibleItems = allFilteredItems.slice(0, totalVisible);

  const filteredItems = visibleItems.map((item, index) => ({
    ...item,
    isPlaceholder: index < loadedStart || index >= loadedEnd,
    originalIndex: index
  }));

  // For list view: populate chunk boundaries with fixed row height
  useEffect(() => {
    if (viewMode !== 'list' || allFilteredItems.length === 0) return;

    const rowHeight = 120; // Fixed height per row in list view
    const totalChunks = Math.ceil(allFilteredItems.length / loadChunkSize);

    for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
      const start = chunkIndex * loadChunkSize * rowHeight;
      const itemsInChunk = Math.min(loadChunkSize, allFilteredItems.length - chunkIndex * loadChunkSize);
      const end = start + (itemsInChunk * rowHeight);

      chunkBoundaries.current.set(chunkIndex, { start, end });
    }

    // console.log(`📋 List view: populated ${totalChunks} chunk boundaries`);
  }, [viewMode, allFilteredItems.length, loadChunkSize]);

  // Get the current item that should be loading (sequential for proper masonry)
  const currentLoadingItem = useMemo(() => {
    // console.log(`🔍 currentLoadingItem check: nextItemIndex=${nextItemIndex}, loadedStart=${loadedStart}, loadedEnd=${loadedEnd}, totalItems=${totalItems}, allFilteredItems.length=${allFilteredItems.length}`);

    // Only load items within the loadedEnd range (stops after initial chunks are loaded)
    if (nextItemIndex < 0 || nextItemIndex >= loadedEnd || nextItemIndex >= totalItems) {
      // console.log(`⏸️ No loading item (outside loaded range or all items loaded)`);
      return null;
    }

    const item = allFilteredItems[nextItemIndex];
    if (!item) {
      // console.log(`❌ Item #${nextItemIndex} is undefined in allFilteredItems (length: ${allFilteredItems.length})`);
      return null;
    }

    // console.log(`🔄 Loading item #${nextItemIndex}: ${getItemFilename(item)}`);
    return { item, index: nextItemIndex };
  }, [nextItemIndex, loadedStart, loadedEnd, totalItems, allFilteredItems, getItemFilename]);

  // Calculate max column height for background container
  const maxColumnHeight = Math.max(...Object.values(columnHeights));
  const containerHeight = maxColumnHeight + (typeof window !== 'undefined' ? window.innerHeight * 0.1 : 80);

  const unloadedCount = totalVisible - (loadedEnd - loadedStart);
  const debugInfo = `Showing ${totalVisible} of ${totalItems} (loaded: ${loadedStart + 1}-${loadedEnd}, ${unloadedCount > 0 ? unloadedCount + ' unloaded' : 'all loaded'}) | Next to load: #${nextItemIndex}`;

  // Handle item click
  const handleItemClick = useCallback((item) => {
    setSelectedItem(item);
    onItemClick(item);
  }, [onItemClick]);

  return (
    <div className="min-h-screen w-full" style={{ background: 'transparent' }}>
      {/* Header */}
      {renderHeader ? renderHeader({
        filterText,
        setFilterText,
        viewMode,
        setViewMode,
        viewModes,
        totalItems: items.length,
        filteredCount: totalItems,
        onMenuToggle,
        currentModuleName,
        lookAndFeel
      }) : (
        <PageHeader
          onMenuToggle={onMenuToggle}
          title={currentModuleName}
          lookAndFeel={lookAndFeel}
          viewMode={viewMode}
          setViewMode={setViewMode}
          viewModes={viewModes}
        />
      )}

      {/* Content */}
      <div
        ref={scrollContainerRef}
        className="w-full p-6 overflow-y-auto relative custom-scrollbar"
        style={{ height: '100vh', background: 'transparent' }}
      >
        {/* Floating Actions */}
        {renderFloatingActions ? renderFloatingActions({
          showDebugInfo,
          setShowDebugInfo,
          debugInfo,
          totalItems,
          filteredCount: totalItems
        }) : (
          <div className="fixed bottom-8 right-8 z-40">
            <button
              onClick={() => setShowDebugInfo(!showDebugInfo)}
              className={`p-3 rounded-full shadow-lg transition-all ${
                showDebugInfo
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-blue-600 hover:bg-blue-50'
              }`}
              title="View loading info"
            >
              <Info size={20} />
            </button>

            {/* Debug Info Panel */}
            {showDebugInfo && (
              <div className="absolute bottom-16 right-0 bg-white rounded-lg shadow-xl p-4 text-xs text-gray-700 border border-gray-200 min-w-64">
                <div className="font-semibold mb-3 text-blue-600">Virtual Scrolling Info</div>
                <div className="mb-3 whitespace-nowrap">{debugInfo}</div>
              </div>
            )}
          </div>
        )}

        <div>
          {/* Grid/Masonry View */}
          {viewMode !== 'list' && renderMasonryView ? (
            renderMasonryView({
              gridRef,
              columnItems,
              columnCount,
              columnWidth,
              containerHeight,
              loadedStart,
              loadedEnd,
              itemPositions,
              onSelectItem: handleItemClick,
              currentLoadingItem,
              loadingImageRef,
              handleImageLoaded,
              setNextItemIndex,
              getItemId,
              getItemExtension,
              getItemUrl
            })
          ) : viewMode !== 'list' ? (
            <div className="text-center py-12 text-gray-500">
              <p>Grid view requires renderMasonryView prop</p>
            </div>
          ) : null}

          {/* List View */}
          {viewMode === 'list' && renderListItem && (
            <div className="bg-white rounded-lg shadow-sm overflow-hidden mx-auto" style={{ width: 'calc(100vw - 24rem)' }}>
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Item</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Size</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Template</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Date</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Tags</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Spacer for items before loaded range */}
                  {loadedStart > 0 && (
                    <tr>
                      <td colSpan="4" style={{ height: `${loadedStart * 120}px`, padding: 0, border: 0 }}></td>
                    </tr>
                  )}

                  {filteredItems.map(item => {
                    // For list view, skip placeholders (use spacers instead)
                    if (item.isPlaceholder) {
                      return null;
                    }

                    return (
                      <tr
                        key={getItemId(item)}
                        className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                        onClick={() => handleItemClick(item)}
                      >
                        {renderListItem(item)}
                      </tr>
                    );
                  })}

                  {/* Hidden loading row for sequential loading in list view */}
                  {viewMode === 'list' && currentLoadingItem && (() => {
                    const item = currentLoadingItem.item;
                    const itemIndex = currentLoadingItem.index;
                    const extension = getItemExtension(item);
                    const isVideo = extension === 'mp4';
                    const isImage = ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'bmp'].includes(extension?.toLowerCase());

                    return (
                      <tr style={{ position: 'absolute', visibility: 'hidden', pointerEvents: 'none' }}>
                        <td>
                          {isImage && (
                            <img
                              ref={loadingImageRef}
                              src={getItemUrl(item)}
                              alt=""
                              onLoad={(e) => handleImageLoaded(item, itemIndex, e)}
                              onError={(e) => handleImageLoaded(item, itemIndex, e)}
                              style={{ width: '1px', height: '1px' }}
                            />
                          )}
                          {isVideo && (
                            <video
                              ref={loadingImageRef}
                              src={getItemUrl(item)}
                              onLoadedMetadata={(e) => handleImageLoaded(item, itemIndex, e)}
                              onError={(e) => handleImageLoaded(item, itemIndex, e)}
                              preload="metadata"
                              style={{ width: '1px', height: '1px' }}
                            />
                          )}
                          {!isImage && !isVideo && (
                            <img
                              ref={loadingImageRef}
                              src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1' height='1'%3E%3C/svg%3E"
                              alt=""
                              onLoad={(e) => handleImageLoaded(item, itemIndex, e)}
                              style={{ width: '1px', height: '1px' }}
                            />
                          )}
                        </td>
                      </tr>
                    );
                  })()}

                  {/* Spacer for items after loaded range */}
                  {loadedEnd < totalItems && (
                    <tr>
                      <td colSpan="4" style={{ height: `${(totalItems - loadedEnd) * 120}px`, padding: 0, border: 0 }}></td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {filteredItems.length === 0 && totalItems === 0 && (
            <div className="text-center py-12 text-gray-500">
              <ImageIcon size={48} className="mx-auto mb-4 text-gray-300" />
              <p>No items found</p>
            </div>
          )}
        </div>
      </div>

      {/* Preview */}
      {renderPreview && selectedItem && renderPreview(
        selectedItem,
        () => setSelectedItem(null),
        allFilteredItems,
        (item) => setSelectedItem(item)
      )}
    </div>
  );
};

export default MediaLibraryBase;
