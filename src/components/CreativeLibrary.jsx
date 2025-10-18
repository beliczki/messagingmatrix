import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Image as ImageIcon, Grid, List, Upload, X, Filter, Calendar, Tag, Monitor, Download, ExternalLink, CheckSquare, Square, Share2, Copy, Check, LayoutGrid } from 'lucide-react';
import PageHeader, { getButtonStyle } from './PageHeader';
import CreativeShare from './CreativeShare';
import CreativePreview from './CreativePreview';
import { processAssets, filterAssets } from '../utils/assetUtils';

const CreativeLibrary = ({ onMenuToggle, currentModuleName, lookAndFeel }) => {
  const [creatives, setCreatives] = useState([]);
  const [viewMode, setViewMode] = useState('grid4'); // 'grid3' or 'grid4' or 'list'
  const [filterText, setFilterText] = useState('');
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState([]);
  const [uploadProgress, setUploadProgress] = useState({});
  const [pendingUploads, setPendingUploads] = useState([]);
  const [showMetadataDialog, setShowMetadataDialog] = useState(false);
  const [selectedCreative, setSelectedCreative] = useState(null);
  const [selectorMode, setSelectorMode] = useState(false);
  const [selectedCreativeIds, setSelectedCreativeIds] = useState(new Set());
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [shareTitle, setShareTitle] = useState('');
  const [generatedShareUrl, setGeneratedShareUrl] = useState(null);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [selectedBaseColor, setSelectedBaseColor] = useState(lookAndFeel?.headerColor || '#2870ed');

  // Virtual scrolling configuration
  const loadChunkSize = 16; // Number of items to load/unload per scroll

  // Dynamic column count based on view mode
  const columnCount = viewMode === 'grid3' ? 3 : viewMode === 'grid4' ? 4 : 4;

  // Virtual scrolling state - track total count and loaded range
  const [totalVisible, setTotalVisible] = useState(loadChunkSize); // Total items to render (grows with scrolling)
  const [loadedStart, setLoadedStart] = useState(0); // Start of loaded range
  const [loadedEnd, setLoadedEnd] = useState(loadChunkSize); // End of loaded range
  const scrollContainerRef = useRef(null);
  const isUpdatingWindow = useRef(false);
  const lastUpdateTime = useRef(0);
  const itemPositions = useRef(new Map()); // Track positions of items
  const itemColumnAssignments = useRef(new Map()); // Track which column each item is in
  const gridRef = useRef(null);
  const columnRefs = useRef([]); // Refs for each column div
  const chunkBoundaries = useRef(new Map()); // Track actual pixel heights for each chunk {start, end}

  // Sequential masonry loading state - initialize with current column count
  const initializeColumns = (count) => {
    const cols = {};
    for (let i = 0; i < count; i++) {
      cols[i] = [];
    }
    return cols;
  };

  const initializeHeights = (count) => {
    const heights = {};
    for (let i = 0; i < count; i++) {
      heights[i] = 0;
    }
    return heights;
  };

  const [columnItems, setColumnItems] = useState(() => initializeColumns(columnCount));
  const [columnHeights, setColumnHeights] = useState(() => initializeHeights(columnCount));
  const [nextItemIndex, setNextItemIndex] = useState(0); // Next item to load
  const loadingItemRef = useRef(null); // Currently loading item
  const loadingImageRef = useRef(null); // Ref to the loading image element

  useEffect(() => {
    loadCreatives();
  }, []);

  const loadCreatives = async () => {
    const assetModules = import.meta.glob('/src/creatives/*.*', { eager: true, as: 'url' });
    const creativeList = await processAssets(assetModules);
    setCreatives(creativeList);
  };

  // Save current item positions
  const saveItemPositions = useCallback(() => {
    if (!gridRef.current) return;

    const items = gridRef.current.querySelectorAll('[data-creative-id]');
    items.forEach(item => {
      const id = item.getAttribute('data-creative-id');
      const rect = item.getBoundingClientRect();
      itemPositions.current.set(id, {
        height: rect.height
      });
    });
  }, []);

  // Handle image/video load - add to shortest column and trigger next
  const handleImageLoaded = useCallback((creative, itemIndex, event) => {
    const isVideo = creative.extension === 'mp4';
    console.log(`\n${isVideo ? '🎬' : '📸'} ${isVideo ? 'Video' : 'Image'} #${itemIndex} loaded: ${creative.filename}`);

    // Get the loaded media dimensions
    const media = event.target;
    const mediaHeight = isVideo ? media.videoHeight : media.naturalHeight;
    const mediaWidth = isVideo ? media.videoWidth : media.naturalWidth;

    // Calculate rendered height based on column width (assuming equal columns)
    // Use dynamic column count
    const currentColumnCount = Object.keys(columnHeights).length;
    const columnWidth = (gridRef.current?.offsetWidth || 1000) / currentColumnCount - 16; // Subtract gap
    const renderedHeight = (mediaHeight / mediaWidth) * columnWidth;

    console.log(`📐 ${isVideo ? 'Video' : 'Image'} dimensions: ${mediaWidth}x${mediaHeight} → Rendered height: ${Math.round(renderedHeight)}px`);

    // Find shortest column from current state
    const heights = Object.values(columnHeights);
    const shortestCol = heights.indexOf(Math.min(...heights));

    console.log(`📏 Column heights (${currentColumnCount} cols):`, heights, `| Shortest: Column ${shortestCol} (${Math.round(heights[shortestCol])}px)`);

    // Calculate chunk boundaries
    const chunkIndex = Math.floor(itemIndex / loadChunkSize);
    const itemYStart = columnHeights[shortestCol]; // Where this item starts in its column
    const itemYEnd = columnHeights[shortestCol] + renderedHeight; // Where it ends

    // Update chunk boundaries - track min start and max end across all items in chunk
    const existingBoundary = chunkBoundaries.current.get(chunkIndex);
    if (existingBoundary) {
      chunkBoundaries.current.set(chunkIndex, {
        start: Math.min(existingBoundary.start, itemYStart),
        end: Math.max(existingBoundary.end, itemYEnd)
      });
    } else {
      chunkBoundaries.current.set(chunkIndex, {
        start: itemYStart,
        end: itemYEnd
      });
    }

    const boundary = chunkBoundaries.current.get(chunkIndex);
    console.log(`📦 Chunk ${chunkIndex} boundaries: ${Math.round(boundary.start)}-${Math.round(boundary.end)}px (height: ${Math.round(boundary.end - boundary.start)}px)`);

    // Save the item height for future placeholder use
    itemPositions.current.set(creative.id, {
      height: renderedHeight
    });

    // Add item to the shortest column
    setColumnItems(prev => {
      const updated = { ...prev };
      updated[shortestCol] = [...updated[shortestCol], { ...creative, originalIndex: itemIndex }];
      console.log(`✅ Added to Column ${shortestCol} | Column now has ${updated[shortestCol].length} items`);
      return updated;
    });

    // Update column height (add image height + gap)
    setColumnHeights(prev => ({
      ...prev,
      [shortestCol]: prev[shortestCol] + renderedHeight + 16 // 16px gap
    }));

    // Load next item (but don't exceed loadedEnd)
    setNextItemIndex(itemIndex + 1);
  }, [columnHeights, loadChunkSize]);

  // Scroll-based virtual scrolling - use actual chunk boundaries instead of estimation
  const handleScroll = useCallback(() => {
    // Safety mechanism: if lock is held for more than 500ms, force release it
    const now = Date.now();
    if (isUpdatingWindow.current && now - lastUpdateTime.current > 500) {
      console.warn('⚠️ Force releasing scroll lock after timeout');
      isUpdatingWindow.current = false;
    }

    if (isUpdatingWindow.current || !scrollContainerRef.current) return;

    const container = scrollContainerRef.current;
    const scrollTop = container.scrollTop;
    const clientHeight = container.clientHeight;

    // Get total items after filtering
    const totalItems = filterAssets(creatives, filterText).length;
    if (totalItems === 0) return;

    // If no chunks loaded yet, start from beginning
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

    // Calculate viewport boundaries
    const viewportStart = scrollTop;
    const viewportEnd = scrollTop + clientHeight;

    // Find which chunks intersect with the viewport based on actual boundaries
    const visibleChunks = [];
    chunkBoundaries.current.forEach((bounds, chunkIndex) => {
      // Check if chunk's bounding box intersects with viewport
      if (bounds.end >= viewportStart && bounds.start <= viewportEnd) {
        visibleChunks.push(chunkIndex);
      }
    });

    if (visibleChunks.length === 0) {
      // No chunks visible - viewport is beyond loaded content
      // Load based on scroll position relative to max column height
      const maxColHeight = Math.max(...Object.values(columnHeights));

      if (scrollTop > maxColHeight) {
        // Scrolled beyond loaded content - do nothing, wait for more to load
        return;
      }

      // Before loaded content - load from start
      const targetStart = 0;
      const targetEnd = Math.min(totalItems, loadChunkSize * 2);
      const targetVisible = targetEnd;

      if (targetStart !== loadedStart || targetEnd !== loadedEnd) {
        isUpdatingWindow.current = true;
        lastUpdateTime.current = Date.now();
        console.log(`📊 Viewport before content | Loading chunks 0-1 | Range: ${targetStart}-${targetEnd}`);
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

    // Get the range of visible chunks
    const minVisibleChunk = Math.min(...visibleChunks);
    const maxVisibleChunk = Math.max(...visibleChunks);

    // Load visible chunks + 1 before + 1 after for buffering
    const totalChunks = Math.ceil(totalItems / loadChunkSize);
    const targetStartChunk = Math.max(0, minVisibleChunk - 1);
    const targetEndChunk = Math.min(totalChunks - 1, maxVisibleChunk + 1);

    const targetStart = targetStartChunk * loadChunkSize;
    const targetEnd = Math.min(totalItems, (targetEndChunk + 1) * loadChunkSize);
    const targetVisible = Math.max(targetEnd, loadChunkSize * 2);

    // Only update if the range has changed
    if (targetStart !== loadedStart || targetEnd !== loadedEnd) {
      isUpdatingWindow.current = true;
      lastUpdateTime.current = Date.now();

      // Log visible chunks with their actual boundaries
      const chunkInfo = visibleChunks.map(idx => {
        const bounds = chunkBoundaries.current.get(idx);
        return `Chunk ${idx} (${Math.round(bounds.start)}-${Math.round(bounds.end)}px)`;
      }).join(', ');

      console.log(`📊 Scroll: ${Math.round(scrollTop)}px | Viewport: ${Math.round(viewportStart)}-${Math.round(viewportEnd)}px`);
      console.log(`   Visible: ${chunkInfo}`);
      console.log(`   Loading chunks ${targetStartChunk}-${targetEndChunk} | Items: ${targetStart}-${targetEnd}`);

      // Save positions before update
      saveItemPositions();

      setTotalVisible(targetVisible);
      setLoadedStart(targetStart);
      setLoadedEnd(targetEnd);

      requestAnimationFrame(() => {
        isUpdatingWindow.current = false;
      });
    }
  }, [creatives, filterText, loadedStart, loadedEnd, saveItemPositions, loadChunkSize, columnHeights]);

  // Setup scroll listener
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      container.removeEventListener('scroll', handleScroll);
    };
  }, [handleScroll]);

  // Reset state when filter changes
  useEffect(() => {
    console.log(`🔄 Filter changed: "${filterText}" - Resetting sequential loading`);
    setTotalVisible(loadChunkSize * 2);
    setLoadedStart(0);
    setLoadedEnd(loadChunkSize * 2);
    // Reset sequential loading completely with current column count
    setColumnItems(initializeColumns(columnCount));
    setColumnHeights(initializeHeights(columnCount));
    setNextItemIndex(0);
    // Clear chunk boundaries
    chunkBoundaries.current.clear();
    // Clear saved item positions
    itemPositions.current.clear();

    // Scroll to top when filter changes
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  }, [filterText, loadChunkSize, columnCount]);

  // Clear column assignments when view mode changes
  useEffect(() => {
    itemColumnAssignments.current.clear();
    console.log(`🔄 View mode changed to ${viewMode} (${columnCount} columns) - Resetting sequential loading`);
    // Reset sequential loading with new column count
    setColumnItems(initializeColumns(columnCount));
    setColumnHeights(initializeHeights(columnCount));
    setNextItemIndex(0);
    // Clear chunk boundaries
    chunkBoundaries.current.clear();
    // Clear saved item positions
    itemPositions.current.clear();
  }, [viewMode, columnCount]);

  // When loaded range changes, only reload the newly visible items
  useEffect(() => {
    if (viewMode === 'grid3' || viewMode === 'grid4') {
      console.log(`🔄 Loaded range changed: ${loadedStart}-${loadedEnd}`);

      // Find items that need to be loaded (within new range but not already loaded)
      const currentLoadedIndices = new Set();
      Object.values(columnItems).flat().forEach(item => {
        currentLoadedIndices.add(item.originalIndex);
      });

      // Check if we need to reload from scratch
      let needsReload = false;
      for (let i = loadedStart; i < loadedEnd; i++) {
        if (!currentLoadedIndices.has(i)) {
          needsReload = true;
          break;
        }
      }

      // Only reset if we actually need new items
      if (needsReload && currentLoadedIndices.size === 0) {
        setNextItemIndex(loadedStart);
      }
    }
  }, [loadedStart, loadedEnd, viewMode, columnItems]);

  const toggleSelectorMode = () => {
    setSelectorMode(!selectorMode);
    if (selectorMode) {
      setSelectedCreativeIds(new Set());
    }
  };

  const toggleCreativeSelection = (creativeId) => {
    const newSelection = new Set(selectedCreativeIds);
    if (newSelection.has(creativeId)) {
      newSelection.delete(creativeId);
    } else {
      newSelection.add(creativeId);
    }
    setSelectedCreativeIds(newSelection);
  };

  const closeShareDialog = () => {
    setShowShareDialog(false);
    setShareTitle('');
    setGeneratedShareUrl(null);
    setCopiedUrl(false);
    setSelectedCreativeIds(new Set());
    setSelectorMode(false);
    setSelectedBaseColor(lookAndFeel?.headerColor || '#2870ed');
  };

  const handleFileUpload = async (files) => {
    const fileArray = Array.from(files);
    const previews = [];

    for (const file of fileArray) {
      try {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch('/api/assets/preview-metadata', {
          method: 'POST',
          body: formData
        });

        if (!response.ok) {
          throw new Error('Preview failed');
        }

        const result = await response.json();
        previews.push({
          originalName: result.originalName,
          tempFilename: result.tempFilename,
          metadata: result.metadata
        });
      } catch (error) {
        console.error('Error previewing file:', error);
        alert(`Failed to preview ${file.name}: ${error.message}`);
      }
    }

    if (previews.length > 0) {
      setPendingUploads(previews);
      setShowUploadDialog(false);
      setShowMetadataDialog(true);
    }
  };

  const handleConfirmUploads = async () => {
    setShowMetadataDialog(false);
    setUploadingFiles(pendingUploads);
    setUploadProgress({});

    for (const upload of pendingUploads) {
      try {
        const response = await fetch('/api/assets/confirm-upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tempFilename: upload.tempFilename,
            metadata: upload.metadata
          })
        });

        if (!response.ok) {
          throw new Error('Upload confirmation failed');
        }

        const result = await response.json();
        console.log('File uploaded:', result);

        setUploadProgress(prev => ({
          ...prev,
          [upload.originalName]: 'completed'
        }));
      } catch (error) {
        console.error('Error confirming upload:', error);
        setUploadProgress(prev => ({
          ...prev,
          [upload.originalName]: 'error'
        }));
      }
    }

    await loadCreatives();

    setTimeout(() => {
      setUploadingFiles([]);
      setUploadProgress({});
      setPendingUploads([]);
    }, 1500);
  };

  const handleCancelUploads = async () => {
    for (const upload of pendingUploads) {
      try {
        await fetch('/api/assets/cancel-upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tempFilename: upload.tempFilename })
        });
      } catch (error) {
        console.error('Error canceling upload:', error);
      }
    }

    setPendingUploads([]);
    setShowMetadataDialog(false);
  };

  const updatePendingMetadata = (index, field, value) => {
    setPendingUploads(prev => {
      const updated = [...prev];
      updated[index].metadata[field] = value;
      return updated;
    });
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileUpload(files);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  // Get filtered creatives - render from 0 to totalVisible with placeholders
  const allFilteredCreatives = filterAssets(creatives, filterText);
  const totalCreatives = allFilteredCreatives.length;
  const visibleItems = allFilteredCreatives.slice(0, totalVisible);

  // Mark which items should show placeholders (outside loaded range) and add index
  const filteredCreatives = visibleItems.map((item, index) => ({
    ...item,
    isPlaceholder: index < loadedStart || index >= loadedEnd,
    originalIndex: index // Add original index for debugging
  }));

  // Get the current item that should be loading (only if within loaded range)
  // Use allFilteredCreatives (full filtered list) not filteredCreatives (visible slice)
  const currentLoadingItem = (nextItemIndex >= loadedStart && nextItemIndex < loadedEnd && nextItemIndex < totalCreatives)
    ? allFilteredCreatives[nextItemIndex]
    : null;

  // Debug logging
  if (viewMode === 'grid3' || viewMode === 'grid4') {
    console.log(`🔍 Loading state: nextItemIndex=${nextItemIndex}, loadedStart=${loadedStart}, loadedEnd=${loadedEnd}, totalCreatives=${totalCreatives}, currentLoadingItem=${currentLoadingItem ? currentLoadingItem.filename : 'null'}`);
  }

  // Calculate max column height for background container (add 10% of viewport height)
  const maxColumnHeight = Math.max(...Object.values(columnHeights));
  const containerHeight = maxColumnHeight + (typeof window !== 'undefined' ? window.innerHeight * 0.1 : 80);

  // For debugging
  const unloadedCount = totalVisible - (loadedEnd - loadedStart);
  const debugInfo = `Showing ${totalVisible} of ${totalCreatives} (loaded: ${loadedStart + 1}-${loadedEnd}, ${unloadedCount > 0 ? unloadedCount + ' unloaded' : 'all loaded'}) | Next to load: #${nextItemIndex}`;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <PageHeader
        onMenuToggle={onMenuToggle}
        title={currentModuleName || 'Creative Library'}
        lookAndFeel={lookAndFeel}
        viewMode={viewMode}
        setViewMode={setViewMode}
        viewModes={[
          { value: 'grid3', label: '3 Columns' },
          { value: 'grid4', label: '4 Columns' },
          { value: 'list', label: 'List View' }
        ]}
      >
        {selectorMode && selectedCreativeIds.size > 0 && (
          <button
            onClick={() => {
              // Randomly select a base color when opening the dialog
              const colors = [
                lookAndFeel?.headerColor || '#2870ed',
                lookAndFeel?.secondaryColor1 || '#eb4c79',
                lookAndFeel?.secondaryColor2 || '#02a3a4',
                lookAndFeel?.secondaryColor3 || '#711c7a'
              ];
              const randomColor = colors[Math.floor(Math.random() * colors.length)];
              setSelectedBaseColor(randomColor);
              setShowShareDialog(true);
            }}
            className="flex items-center gap-2 px-4 py-2 text-white rounded hover:opacity-90 transition-opacity"
            style={getButtonStyle(lookAndFeel)}
          >
            <Share2 size={16} />
            Share ({selectedCreativeIds.size})
          </button>
        )}
        <button
          onClick={() => setShowUploadDialog(true)}
          className="flex items-center gap-2 px-4 py-2 text-white rounded hover:opacity-90 transition-opacity"
          style={getButtonStyle(lookAndFeel)}
        >
          <Upload size={16} />
          Upload
        </button>
      </PageHeader>

      {/* Content */}
      <div
        ref={scrollContainerRef}
        className="p-8 overflow-y-auto"
        style={{ height: 'calc(100vh - 100px)' }}
      >
        <div className="max-w-7xl mx-auto">
          {/* Virtual Scrolling Debug Info */}
          <div className="mb-2 text-xs text-gray-500 text-right">
            {debugInfo}
          </div>

          {/* Filter and Controls Row */}
          <div className="flex items-center gap-4 mb-6">
            <div className="flex items-center gap-2 flex-1">
              <Filter size={18} className="text-gray-400" />
              <input
                type="text"
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                placeholder="Filter creatives (use 'and' / 'or' operators)..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <button
              onClick={toggleSelectorMode}
              className={`flex items-center gap-2 px-4 py-2 rounded transition-colors ${
                selectorMode
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {selectorMode ? <CheckSquare size={16} /> : <Square size={16} />}
              {selectorMode ? 'Selecting' : 'Select'}
            </button>

            {selectorMode && (
              <>
                <button
                  onClick={() => {
                    const allFilteredIds = new Set(allFilteredCreatives.map(creative => creative.id));
                    setSelectedCreativeIds(allFilteredIds);
                  }}
                  className="px-4 py-2 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                >
                  Select All ({totalCreatives})
                </button>
                <button
                  onClick={() => setSelectedCreativeIds(new Set())}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
                >
                  Deselect All
                </button>
              </>
            )}
          </div>

          {/* Assets Grid */}
          {viewMode === 'grid3' ? (
            <div className="relative">
              {/* Background container */}
              <div
                className="absolute top-0 left-0 right-0 bg-transparent pointer-events-none"
                style={{ height: `${containerHeight}px` }}
              />

              {/* Masonry grid */}
              <div ref={gridRef} className="flex gap-4 relative z-10">
                {Object.keys(columnItems).map((columnIndex) => (
                  <div key={columnIndex} className="flex-1 flex flex-col gap-4">
                  {/* Render already-loaded items in this column */}
                  {columnItems[columnIndex].map(creative => {
                    // Check if item is outside loaded range - show placeholder
                    const isOutsideRange = creative.originalIndex < loadedStart || creative.originalIndex >= loadedEnd;

                    if (isOutsideRange) {
                      const savedHeight = itemPositions.current.get(creative.id)?.height || 300;
                      return (
                        <div
                          key={creative.id}
                          data-creative-id={creative.id}
                          className="rounded-lg bg-gray-200 flex items-center justify-center"
                          style={{ height: `${savedHeight}px` }}
                        >
                          <div className="text-gray-400 text-sm">Unloaded</div>
                        </div>
                      );
                    }

                    const isVideo = creative.extension === 'mp4';
                    const isImage = ['jpg', 'jpeg', 'png', 'gif'].includes(creative.extension);
                    const isSelected = selectedCreativeIds.has(creative.id);

                    let longPressTimer = null;

                    const handleMouseDown = () => {
                      longPressTimer = setTimeout(() => {
                        setSelectorMode(true);
                      }, 500);
                    };

                    const handleMouseUp = () => {
                      if (longPressTimer) {
                        clearTimeout(longPressTimer);
                      }
                    };

                    const handleClick = () => {
                      if (selectorMode) {
                        toggleCreativeSelection(creative.id);
                      } else {
                        setSelectedCreative(creative);
                      }
                    };

                    return (
                      <div
                        key={creative.id}
                        data-creative-id={creative.id}
                        className="group cursor-pointer"
                        onMouseDown={handleMouseDown}
                        onMouseUp={handleMouseUp}
                        onMouseLeave={handleMouseUp}
                        onTouchStart={handleMouseDown}
                        onTouchEnd={handleMouseUp}
                        onClick={handleClick}
                      >
                        <div className={`relative rounded-lg overflow-hidden shadow-md hover:shadow-xl transition-shadow ${isSelected ? 'ring-4 ring-blue-500' : ''}`}>
                          {selectorMode && (
                            <div className="absolute top-2 right-2 z-[5]">
                              <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                                isSelected
                                  ? 'bg-blue-500 border-blue-500'
                                  : 'bg-white/80 border-white backdrop-blur-sm'
                              }`}>
                                {isSelected && <Check size={16} className="text-white" />}
                              </div>
                            </div>
                          )}

                          {isImage && (
                            <img
                              src={creative.url}
                              alt={creative.filename}
                              className="w-full h-auto object-cover"
                              loading="lazy"
                            />
                          )}
                          {isVideo && (
                            <video
                              src={creative.url}
                              className="w-full h-auto object-cover"
                              preload="metadata"
                            />
                          )}
                          {!isImage && !isVideo && (
                            <div className="w-full h-64 bg-gray-200 flex items-center justify-center">
                              <ImageIcon size={48} className="text-gray-400" />
                            </div>
                          )}

                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-4 pointer-events-none">
                            <h3 className="text-white font-semibold text-sm mb-2 line-clamp-2">
                              {creative.product || creative.filename}
                            </h3>

                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="px-2 py-1 bg-white/20 backdrop-blur-sm text-white rounded text-xs font-medium uppercase">
                                {creative.extension}
                              </span>
                              {creative.size && (
                                <span className="px-2 py-1 bg-white/20 backdrop-blur-sm text-white rounded text-xs">
                                  {creative.size}
                                </span>
                              )}
                              {creative.variant && (
                                <span className="px-2 py-1 bg-white/20 backdrop-blur-sm text-white rounded text-xs">
                                  v{creative.variant.toUpperCase()}
                                </span>
                              )}
                            </div>

                            {(creative.platforms.length > 0 || creative.tags.length > 0) && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {creative.platforms.map(platform => (
                                  <span key={platform} className="px-2 py-0.5 bg-blue-500/80 backdrop-blur-sm text-white rounded text-xs">
                                    {platform}
                                  </span>
                                ))}
                                {creative.tags.slice(0, 2).map(tag => (
                                  <span key={tag} className="px-2 py-0.5 bg-green-500/80 backdrop-blur-sm text-white rounded text-xs">
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {/* Render the currently-loading item (hidden, just for loading) */}
                  {currentLoadingItem && columnIndex === '0' && (() => {
                    const isVideo = currentLoadingItem.extension === 'mp4';
                    const isImage = ['jpg', 'jpeg', 'png', 'gif'].includes(currentLoadingItem.extension);

                    console.log(`🎯 Rendering hidden loader for item #${nextItemIndex}: ${currentLoadingItem.filename} (${isVideo ? 'video' : isImage ? 'image' : 'unknown'})`);

                    return (
                      <div key={`loader-${nextItemIndex}`} style={{position: 'absolute', left: '-9999px', width: '200px'}}>
                        {isImage && (
                          <img
                            ref={(el) => {
                              loadingImageRef.current = el;
                              // Check if image already loaded (cached)
                              if (el && el.complete && el.naturalHeight !== 0) {
                                console.log(`✅ Image already loaded (cached): ${currentLoadingItem.filename}`);
                                // Trigger the handler directly since onLoad won't fire
                                handleImageLoaded(currentLoadingItem, nextItemIndex, { target: el });
                              }
                            }}
                            src={currentLoadingItem.url}
                            alt="loading"
                            onLoad={(e) => {
                              console.log(`✅ onLoad fired for ${currentLoadingItem.filename}`);
                              handleImageLoaded(currentLoadingItem, nextItemIndex, e);
                            }}
                            onError={(e) => {
                              console.error(`❌ onError fired for ${currentLoadingItem.filename}`, e);
                              setNextItemIndex(nextItemIndex + 1);
                            }}
                          />
                        )}
                        {isVideo && (
                          <video
                            ref={(el) => {
                              loadingImageRef.current = el;
                              // Check if video metadata already loaded
                              if (el && el.readyState >= 1) {
                                console.log(`✅ Video metadata already loaded: ${currentLoadingItem.filename}`);
                                handleImageLoaded(currentLoadingItem, nextItemIndex, { target: el });
                              }
                            }}
                            src={currentLoadingItem.url}
                            onLoadedMetadata={(e) => {
                              console.log(`✅ onLoadedMetadata fired for ${currentLoadingItem.filename}`);
                              handleImageLoaded(currentLoadingItem, nextItemIndex, e);
                            }}
                            onError={(e) => {
                              console.error(`❌ onError fired for ${currentLoadingItem.filename}`, e);
                              setNextItemIndex(nextItemIndex + 1);
                            }}
                            preload="metadata"
                          />
                        )}
                      </div>
                    );
                  })()}
                </div>
              ))}
              </div>
            </div>
          ) : viewMode === 'grid4' ? (
            <div className="relative">
              {/* Background container that extends 1 viewport beyond content */}
              <div
                className="absolute top-0 left-0 right-0 bg-transparent pointer-events-none"
                style={{ height: `${containerHeight}px` }}
              />

              {/* Masonry grid */}
              <div ref={gridRef} className="flex gap-4 relative z-10">
                {Object.keys(columnItems).map((columnIndex) => (
                  <div key={columnIndex} className="flex-1 flex flex-col gap-4">
                  {/* Render already-loaded items in this column */}
                  {columnItems[columnIndex].map(creative => {
                    // Check if item is outside loaded range - show placeholder
                    const isOutsideRange = creative.originalIndex < loadedStart || creative.originalIndex >= loadedEnd;

                    if (isOutsideRange) {
                      const savedHeight = itemPositions.current.get(creative.id)?.height || 300;
                      return (
                        <div
                          key={creative.id}
                          data-creative-id={creative.id}
                          className="rounded-lg bg-gray-200 flex items-center justify-center"
                          style={{ height: `${savedHeight}px` }}
                        >
                          <div className="text-gray-400 text-sm">Unloaded</div>
                        </div>
                      );
                    }

                    const isVideo = creative.extension === 'mp4';
                    const isImage = ['jpg', 'jpeg', 'png', 'gif'].includes(creative.extension);
                    const isSelected = selectedCreativeIds.has(creative.id);

                    let longPressTimer = null;

                    const handleMouseDown = () => {
                      longPressTimer = setTimeout(() => {
                        setSelectorMode(true);
                      }, 500);
                    };

                    const handleMouseUp = () => {
                      if (longPressTimer) {
                        clearTimeout(longPressTimer);
                      }
                    };

                    const handleClick = () => {
                      if (selectorMode) {
                        toggleCreativeSelection(creative.id);
                      } else {
                        setSelectedCreative(creative);
                      }
                    };

                    return (
                      <div
                        key={creative.id}
                        data-creative-id={creative.id}
                        className="group cursor-pointer"
                        onMouseDown={handleMouseDown}
                        onMouseUp={handleMouseUp}
                        onMouseLeave={handleMouseUp}
                        onTouchStart={handleMouseDown}
                        onTouchEnd={handleMouseUp}
                        onClick={handleClick}
                      >
                        <div className={`relative rounded-lg overflow-hidden shadow-md hover:shadow-xl transition-shadow ${isSelected ? 'ring-4 ring-blue-500' : ''}`}>
                          {selectorMode && (
                            <div className="absolute top-2 right-2 z-[5]">
                              <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                                isSelected
                                  ? 'bg-blue-500 border-blue-500'
                                  : 'bg-white/80 border-white backdrop-blur-sm'
                              }`}>
                                {isSelected && <Check size={16} className="text-white" />}
                              </div>
                            </div>
                          )}

                          {isImage && (
                            <img
                              src={creative.url}
                              alt={creative.filename}
                              className="w-full h-auto object-cover"
                            />
                          )}
                          {isVideo && (
                            <video
                              src={creative.url}
                              className="w-full h-auto object-cover"
                              preload="metadata"
                            />
                          )}

                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-4 pointer-events-none">
                            <h3 className="text-white font-semibold text-sm mb-2 line-clamp-2">
                              {creative.product || creative.filename}
                            </h3>

                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="px-2 py-1 bg-white/20 backdrop-blur-sm text-white rounded text-xs font-medium uppercase">
                                {creative.extension}
                              </span>
                              {creative.size && (
                                <span className="px-2 py-1 bg-white/20 backdrop-blur-sm text-white rounded text-xs">
                                  {creative.size}
                                </span>
                              )}
                              {creative.variant && (
                                <span className="px-2 py-1 bg-white/20 backdrop-blur-sm text-white rounded text-xs">
                                  v{creative.variant.toUpperCase()}
                                </span>
                              )}
                            </div>

                            {(creative.platforms.length > 0 || creative.tags.length > 0) && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {creative.platforms.map(platform => (
                                  <span key={platform} className="px-2 py-0.5 bg-blue-500/80 backdrop-blur-sm text-white rounded text-xs">
                                    {platform}
                                  </span>
                                ))}
                                {creative.tags.slice(0, 2).map(tag => (
                                  <span key={tag} className="px-2 py-0.5 bg-green-500/80 backdrop-blur-sm text-white rounded text-xs">
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {/* Render the currently-loading item (hidden, just for loading) */}
                  {currentLoadingItem && columnIndex === '0' && (() => {
                    const isVideo = currentLoadingItem.extension === 'mp4';
                    const isImage = ['jpg', 'jpeg', 'png', 'gif'].includes(currentLoadingItem.extension);

                    console.log(`🎯 Rendering hidden loader for item #${nextItemIndex}: ${currentLoadingItem.filename} (${isVideo ? 'video' : isImage ? 'image' : 'unknown'})`);

                    return (
                      <div key={`loader-${nextItemIndex}`} style={{position: 'absolute', left: '-9999px', width: '200px'}}>
                        {isImage && (
                          <img
                            ref={(el) => {
                              loadingImageRef.current = el;
                              // Check if image already loaded (cached)
                              if (el && el.complete && el.naturalHeight !== 0) {
                                console.log(`✅ Image already loaded (cached): ${currentLoadingItem.filename}`);
                                // Trigger the handler directly since onLoad won't fire
                                handleImageLoaded(currentLoadingItem, nextItemIndex, { target: el });
                              }
                            }}
                            src={currentLoadingItem.url}
                            alt="loading"
                            onLoad={(e) => {
                              console.log(`✅ onLoad fired for ${currentLoadingItem.filename}`);
                              handleImageLoaded(currentLoadingItem, nextItemIndex, e);
                            }}
                            onError={(e) => {
                              console.error(`❌ onError fired for ${currentLoadingItem.filename}`, e);
                              setNextItemIndex(nextItemIndex + 1);
                            }}
                          />
                        )}
                        {isVideo && (
                          <video
                            ref={(el) => {
                              loadingImageRef.current = el;
                              // Check if video metadata already loaded
                              if (el && el.readyState >= 1) {
                                console.log(`✅ Video metadata already loaded: ${currentLoadingItem.filename}`);
                                handleImageLoaded(currentLoadingItem, nextItemIndex, { target: el });
                              }
                            }}
                            src={currentLoadingItem.url}
                            onLoadedMetadata={(e) => {
                              console.log(`✅ onLoadedMetadata fired for ${currentLoadingItem.filename}`);
                              handleImageLoaded(currentLoadingItem, nextItemIndex, e);
                            }}
                            onError={(e) => {
                              console.error(`❌ onError fired for ${currentLoadingItem.filename}`, e);
                              setNextItemIndex(nextItemIndex + 1);
                            }}
                            preload="metadata"
                          />
                        )}
                      </div>
                    );
                  })()}
                </div>
              ))}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table ref={gridRef} className="w-full">
                  <thead className="bg-gray-50">
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Creative</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Size</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Date</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Variant</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Tags</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCreatives.map(creative => {
                      const isVideo = creative.extension === 'mp4';
                      const isImage = ['jpg', 'jpeg', 'png', 'gif'].includes(creative.extension);
                      const isSelected = selectedCreativeIds.has(creative.id);

                      return (
                        <tr
                          key={creative.id}
                          data-creative-id={creative.id}
                          className={`border-b border-gray-100 hover:bg-gray-50 cursor-pointer ${isSelected ? 'bg-blue-50' : ''}`}
                          onClick={() => {
                            if (selectorMode) {
                              toggleCreativeSelection(creative.id);
                            } else {
                              setSelectedCreative(creative);
                            }
                          }}
                        >
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              {selectorMode && (
                                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                                  isSelected
                                    ? 'bg-blue-500 border-blue-500'
                                    : 'border-gray-300'
                                }`}>
                                  {isSelected && <Check size={14} className="text-white" />}
                                </div>
                              )}
                              <div className="w-16 h-16 bg-gray-100 rounded flex items-center justify-center overflow-hidden flex-shrink-0">
                                {isImage && <img src={creative.url} alt={creative.filename} className="w-full h-full object-cover" loading="lazy" />}
                                {isVideo && <video src={creative.url} className="w-full h-full object-cover" preload="metadata" />}
                                {!isImage && !isVideo && <ImageIcon size={24} className="text-gray-400" />}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="font-medium text-gray-800 truncate">{creative.product || 'Untitled'}</p>
                                <p className="text-xs text-gray-500 truncate">{creative.filename}</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            {creative.size && (
                              <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">
                                <Monitor size={12} />
                                {creative.size}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-600">{creative.date || '-'}</td>
                          <td className="py-3 px-4">
                            {creative.variant && (
                              <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs font-medium">
                                {creative.variant.toUpperCase()}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex flex-wrap gap-1">
                              {creative.platforms.map(platform => (
                                <span key={platform} className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">{platform}</span>
                              ))}
                              {creative.tags.slice(0, 2).map(tag => (
                                <span key={tag} className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs">{tag}</span>
                              ))}
                              {creative.tags.length > 2 && (
                                <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">+{creative.tags.length - 2}</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {filteredCreatives.length === 0 && totalCreatives === 0 && (
            <div className="text-center py-12 text-gray-500">
              <ImageIcon size={48} className="mx-auto mb-4 text-gray-300" />
              <p>No creatives found</p>
            </div>
          )}
        </div>
      </div>

      {/* Upload Dialog */}
      {showUploadDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b">
              <h3 className="text-lg font-bold text-gray-800">Upload Creatives</h3>
              <button onClick={() => setShowUploadDialog(false)} className="p-2 hover:bg-gray-100 rounded">
                <X size={20} />
              </button>
            </div>
            <div className="p-6">
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-400 transition-colors cursor-pointer"
                onClick={() => document.getElementById('file-input').click()}
              >
                <Upload size={48} className="mx-auto mb-4 text-gray-400" />
                <p className="text-gray-700 mb-2 font-medium">Drag and drop files here</p>
                <p className="text-sm text-gray-500">or click to browse</p>
                <input
                  id="file-input"
                  type="file"
                  multiple
                  accept="image/*,video/*"
                  onChange={(e) => handleFileUpload(e.target.files)}
                  className="hidden"
                />
              </div>

              {uploadingFiles.length > 0 && (
                <div className="mt-4 space-y-2">
                  {uploadingFiles.map((file, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <span className="text-sm text-gray-700 truncate flex-1">{file.name}</span>
                      {uploadProgress[file.name] === 'completed' && (
                        <Check size={16} className="text-green-500 ml-2" />
                      )}
                      {uploadProgress[file.name] === 'error' && (
                        <X size={16} className="text-red-500 ml-2" />
                      )}
                      {!uploadProgress[file.name] && (
                        <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin ml-2" />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Metadata Confirmation Dialog */}
      {showMetadataDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b">
              <h3 className="text-lg font-bold text-gray-800">Confirm File Metadata</h3>
              <button onClick={handleCancelUploads} className="p-2 hover:bg-gray-100 rounded">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1">
              <p className="text-sm text-gray-600 mb-4">
                Review and edit the metadata for each file. Files will be renamed as: <br />
                <code className="text-xs bg-gray-100 px-2 py-1 rounded">product_platform_size_variant_templateSource.ext</code>
              </p>
              <div className="space-y-4">
                {pendingUploads.map((upload, index) => (
                  <div key={index} className="border rounded-lg p-4">
                    <p className="font-semibold text-gray-800 mb-3 truncate">{upload.originalName}</p>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Product</label>
                        <input
                          type="text"
                          value={upload.metadata.product}
                          onChange={(e) => updatePendingMetadata(index, 'product', e.target.value)}
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Platform</label>
                        <input
                          type="text"
                          value={upload.metadata.platform}
                          onChange={(e) => updatePendingMetadata(index, 'platform', e.target.value)}
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Size</label>
                        <input
                          type="text"
                          value={upload.metadata.size}
                          onChange={(e) => updatePendingMetadata(index, 'size', e.target.value)}
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Variant</label>
                        <input
                          type="text"
                          value={upload.metadata.variant}
                          onChange={(e) => updatePendingMetadata(index, 'variant', e.target.value)}
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Template Source</label>
                        <input
                          type="text"
                          value={upload.metadata.templateSource}
                          onChange={(e) => updatePendingMetadata(index, 'templateSource', e.target.value)}
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Extension</label>
                        <input
                          type="text"
                          value={upload.metadata.ext}
                          readOnly
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded bg-gray-50 cursor-not-allowed"
                        />
                      </div>
                    </div>
                    <div className="mt-2">
                      <p className="text-xs text-gray-500">
                        New filename: <span className="font-mono">{`${upload.metadata.product}_${upload.metadata.platform}_${upload.metadata.size}_${upload.metadata.variant}_${upload.metadata.templateSource}.${upload.metadata.ext}`}</span>
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 p-6 border-t">
              <button
                onClick={handleCancelUploads}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmUploads}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
              >
                <Upload size={16} />
                Confirm & Upload ({pendingUploads.length})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Progress Dialog */}
      {uploadingFiles.length > 0 && !showMetadataDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b">
              <h3 className="text-lg font-bold text-gray-800">Uploading Files...</h3>
            </div>
            <div className="p-6">
              <div className="space-y-2">
                {uploadingFiles.map((upload, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                    <span className="text-sm text-gray-700 truncate flex-1">{upload.originalName}</span>
                    {uploadProgress[upload.originalName] === 'completed' && (
                      <Check size={16} className="text-green-500 ml-2" />
                    )}
                    {uploadProgress[upload.originalName] === 'error' && (
                      <X size={16} className="text-red-500 ml-2" />
                    )}
                    {!uploadProgress[upload.originalName] && (
                      <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin ml-2" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Share Dialog */}
      <CreativeShare
        isOpen={showShareDialog}
        onClose={closeShareDialog}
        selectedCreativeIds={selectedCreativeIds}
        shareTitle={shareTitle}
        setShareTitle={setShareTitle}
        selectedBaseColor={selectedBaseColor}
        setSelectedBaseColor={setSelectedBaseColor}
        generatedShareUrl={generatedShareUrl}
        setGeneratedShareUrl={setGeneratedShareUrl}
        copiedUrl={copiedUrl}
        setCopiedUrl={setCopiedUrl}
        lookAndFeel={lookAndFeel}
      />

      {/* Creative Preview */}
      <CreativePreview
        creative={selectedCreative}
        onClose={() => setSelectedCreative(null)}
      />
    </div>
  );
};

export default CreativeLibrary;
