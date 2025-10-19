import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Image as ImageIcon, Upload, X, Filter, Check, Info } from 'lucide-react';
import PageHeader, { getButtonStyle } from './PageHeader';
import CreativePreview from './CreativePreview';
import { processAssets, filterAssets } from '../utils/assetUtils';

const Assets = ({ onMenuToggle, currentModuleName, lookAndFeel }) => {
  const [assets, setAssets] = useState([]);
  const [viewMode, setViewMode] = useState('grid4');
  const [filterText, setFilterText] = useState('');
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState([]);
  const [uploadProgress, setUploadProgress] = useState({});
  const [pendingUploads, setPendingUploads] = useState([]);
  const [showMetadataDialog, setShowMetadataDialog] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [showDebugInfo, setShowDebugInfo] = useState(false);

  // Virtual scrolling configuration
  const loadChunkSize = 16;
  const columnCount = viewMode === 'grid3' ? 3 : viewMode === 'grid4' ? 4 : 4;

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
  const [nextItemIndex, setNextItemIndex] = useState(0);
  const loadingImageRef = useRef(null);
  const processedItems = useRef(new Set());
  const columnItemsRef = useRef(columnItems);
  const columnHeightsRef = useRef(columnHeights);

  // Keep refs in sync
  useEffect(() => {
    columnItemsRef.current = columnItems;
  }, [columnItems]);

  useEffect(() => {
    columnHeightsRef.current = columnHeights;
  }, [columnHeights]);

  useEffect(() => {
    loadAssetsList();
  }, []);

  const loadAssetsList = async () => {
    const assetModules = import.meta.glob('/src/assets/*.*', { eager: true, as: 'url' });
    const assetList = await processAssets(assetModules);
    setAssets(assetList);
  };

  // Save current item positions
  const saveItemPositions = useCallback(() => {
    if (!gridRef.current) return;

    const items = gridRef.current.querySelectorAll('[data-asset-id]');
    items.forEach(item => {
      const id = item.getAttribute('data-asset-id');
      const rect = item.getBoundingClientRect();
      itemPositions.current.set(id, {
        height: rect.height
      });
    });
  }, []);

  // Handle image/video load - add to shortest column and trigger next
  const handleImageLoaded = useCallback((asset, itemIndex, event) => {
    if (processedItems.current.has(asset.id)) {
      setNextItemIndex(itemIndex + 1);
      return;
    }

    processedItems.current.add(asset.id);

    const isVideo = asset.extension === 'mp4';
    const media = event.target;
    const mediaHeight = isVideo ? media.videoHeight : media.naturalHeight;
    const mediaWidth = isVideo ? media.videoWidth : media.naturalWidth;

    const currentColumnCount = Object.keys(columnHeights).length;
    const columnWidth = (gridRef.current?.offsetWidth || 1000) / currentColumnCount - 16;
    const renderedHeight = (mediaHeight / mediaWidth) * columnWidth;

    const heights = Object.values(columnHeights);
    const shortestCol = heights.indexOf(Math.min(...heights));

    const chunkIndex = Math.floor(itemIndex / loadChunkSize);
    const itemYStart = columnHeights[shortestCol];
    const itemYEnd = columnHeights[shortestCol] + renderedHeight;

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

    itemPositions.current.set(asset.id, {
      height: renderedHeight
    });

    setColumnItems(prev => {
      const updated = { ...prev };
      updated[shortestCol] = [...updated[shortestCol], { ...asset, originalIndex: itemIndex }];
      return updated;
    });

    setColumnHeights(prev => ({
      ...prev,
      [shortestCol]: prev[shortestCol] + renderedHeight + 16
    }));

    setNextItemIndex(itemIndex + 1);
  }, [columnHeights, loadChunkSize]);

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

    const totalItems = filterAssets(assets, filterText).length;
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
  }, [assets, filterText, loadedStart, loadedEnd, saveItemPositions, loadChunkSize, columnHeights]);

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
    const emptyColumns = initializeColumns(columnCount);
    const emptyHeights = initializeHeights(columnCount);

    setTotalVisible(loadChunkSize * 2);
    setLoadedStart(0);
    setLoadedEnd(loadChunkSize * 2);
    setColumnItems(emptyColumns);
    setColumnHeights(emptyHeights);
    setNextItemIndex(0);

    columnItemsRef.current = emptyColumns;
    columnHeightsRef.current = emptyHeights;

    chunkBoundaries.current.clear();
    itemPositions.current.clear();
    processedItems.current.clear();

    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  }, [filterText, loadChunkSize, columnCount]);

  // Clear column assignments when view mode changes
  useEffect(() => {
    const emptyColumns = initializeColumns(columnCount);
    const emptyHeights = initializeHeights(columnCount);

    setColumnItems(emptyColumns);
    setColumnHeights(emptyHeights);
    setNextItemIndex(0);

    columnItemsRef.current = emptyColumns;
    columnHeightsRef.current = emptyHeights;

    chunkBoundaries.current.clear();
    itemPositions.current.clear();
    processedItems.current.clear();
  }, [viewMode, columnCount]);

  // When loaded range changes, only reload the newly visible items
  useEffect(() => {
    if (viewMode === 'grid3' || viewMode === 'grid4') {
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
            metadata: upload.metadata,
            targetDir: 'assets'
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

    await loadAssetsList();

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

  // Get filtered assets
  const allFilteredAssets = filterAssets(assets, filterText);
  const totalAssets = allFilteredAssets.length;
  const visibleItems = allFilteredAssets.slice(0, totalVisible);

  const filteredAssets = visibleItems.map((item, index) => ({
    ...item,
    isPlaceholder: index < loadedStart || index >= loadedEnd,
    originalIndex: index
  }));

  // Get the current item that should be loading
  const currentLoadingItem = useMemo(() => {
    if (nextItemIndex < loadedStart || nextItemIndex >= loadedEnd || nextItemIndex >= totalAssets) {
      return null;
    }

    const item = allFilteredAssets[nextItemIndex];
    return { item, index: nextItemIndex };
  }, [nextItemIndex, loadedStart, loadedEnd, totalAssets, allFilteredAssets]);

  // Calculate max column height for background container
  const maxColumnHeight = Math.max(...Object.values(columnHeights));
  const containerHeight = maxColumnHeight + (typeof window !== 'undefined' ? window.innerHeight * 0.1 : 80);

  const unloadedCount = totalVisible - (loadedEnd - loadedStart);
  const debugInfo = `Showing ${totalVisible} of ${totalAssets} (loaded: ${loadedStart + 1}-${loadedEnd}, ${unloadedCount > 0 ? unloadedCount + ' unloaded' : 'all loaded'}) | Next to load: #${nextItemIndex}`;

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader
        onMenuToggle={onMenuToggle}
        title={currentModuleName || 'Assets'}
        lookAndFeel={lookAndFeel}
        viewMode={viewMode}
        setViewMode={setViewMode}
        viewModes={[
          { value: 'grid3', label: '3 Columns' },
          { value: 'grid4', label: '4 Columns' },
          { value: 'list', label: 'List View' }
        ]}
        titleFilters={
          <>
            {/* Filter Input */}
            <div className="flex items-center gap-2">
              <Filter size={18} className="text-white" />
              <input
                type="text"
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                placeholder="Filter assets..."
                className="w-64 px-3 py-2 border border-white/20 rounded bg-white/10 text-white placeholder-white/60 focus:ring-2 focus:ring-white/30 focus:border-white/30 focus:bg-white/20"
              />
            </div>
          </>
        }
      >
        {/* Upload Button */}
        <button
          onClick={() => setShowUploadDialog(true)}
          className="p-2 text-white rounded hover:opacity-90 transition-opacity"
          style={getButtonStyle(lookAndFeel)}
          title="Upload assets"
        >
          <Upload size={20} />
        </button>
      </PageHeader>

      {/* Content */}
      <div
        ref={scrollContainerRef}
        className="p-8 overflow-y-auto relative"
        style={{ height: 'calc(100vh - 100px)' }}
      >
        {/* Floating Info Button */}
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
            <div className="absolute bottom-16 right-0 bg-white rounded-lg shadow-xl p-4 text-xs text-gray-700 whitespace-nowrap border border-gray-200">
              <div className="font-semibold mb-2 text-blue-600">Virtual Scrolling Info</div>
              <div>{debugInfo}</div>
            </div>
          )}
        </div>

        <div className="max-w-7xl mx-auto">
          {/* Assets Grid */}
          {(viewMode === 'grid3' || viewMode === 'grid4') ? (
            <div className="relative">
              {/* Background container */}
              <div
                className="absolute top-0 left-0 right-0 bg-transparent pointer-events-none"
                style={{ height: `${containerHeight}px` }}
              />

              {/* Masonry grid */}
              <div ref={gridRef} className="flex gap-4 relative z-10">
                {Array.from({ length: columnCount }, (_, i) => i).map((columnIndex) => (
                  <div key={columnIndex} className="flex-1 flex flex-col gap-4">
                    {/* Render already-loaded items in this column */}
                    {(columnItems[columnIndex] || []).map(asset => {
                      const isOutsideRange = asset.originalIndex < loadedStart || asset.originalIndex >= loadedEnd;
                      const savedHeight = itemPositions.current.get(asset.id)?.height || 300;

                      if (isOutsideRange) {
                        return (
                          <div
                            key={asset.id}
                            data-asset-id={asset.id}
                            className="rounded-lg bg-gray-200 flex items-center justify-center"
                            style={{ height: `${savedHeight}px` }}
                          >
                            <div className="text-gray-400 text-sm">Unloaded</div>
                          </div>
                        );
                      }

                      const isVideo = asset.extension === 'mp4';
                      const isImage = ['jpg', 'jpeg', 'png', 'gif'].includes(asset.extension);

                      return (
                        <div
                          key={asset.id}
                          data-asset-id={asset.id}
                          className="group cursor-pointer"
                          onClick={() => setSelectedAsset(asset)}
                        >
                          <div className="relative rounded-lg overflow-hidden shadow-md hover:shadow-xl transition-shadow">
                            {isImage && (
                              <img
                                src={asset.url}
                                alt={asset.filename}
                                className="w-full h-auto object-cover"
                                loading="lazy"
                              />
                            )}
                            {isVideo && (
                              <video
                                src={asset.url}
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
                                {asset.product || asset.filename}
                              </h3>

                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="px-2 py-1 bg-white/20 backdrop-blur-sm text-white rounded text-xs font-medium uppercase">
                                  {asset.extension}
                                </span>
                                {asset.size && (
                                  <span className="px-2 py-1 bg-white/20 backdrop-blur-sm text-white rounded text-xs">
                                    {asset.size}
                                  </span>
                                )}
                                {asset.variant && (
                                  <span className="px-2 py-1 bg-white/20 backdrop-blur-sm text-white rounded text-xs">
                                    v{asset.variant.toUpperCase()}
                                  </span>
                                )}
                              </div>

                              {(asset.platforms.length > 0 || asset.tags.length > 0) && (
                                <div className="flex flex-wrap gap-1 mt-2">
                                  {asset.platforms.map(platform => (
                                    <span key={platform} className="px-2 py-0.5 bg-blue-500/80 backdrop-blur-sm text-white rounded text-xs">
                                      {platform}
                                    </span>
                                  ))}
                                  {asset.tags.slice(0, 2).map(tag => (
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
                    {currentLoadingItem && columnIndex === 0 && (() => {
                      const item = currentLoadingItem.item;
                      const itemIndex = currentLoadingItem.index;
                      const isVideo = item.extension === 'mp4';
                      const isImage = ['jpg', 'jpeg', 'png', 'gif'].includes(item.extension);

                      return (
                        <div key={`loader-${itemIndex}`} style={{position: 'absolute', left: '-9999px', width: '200px'}}>
                          {isImage && (
                            <img
                              ref={(el) => {
                                loadingImageRef.current = el;
                                if (el && el.complete && el.naturalHeight !== 0) {
                                  handleImageLoaded(item, itemIndex, { target: el });
                                }
                              }}
                              src={item.url}
                              alt="loading"
                              onLoad={(e) => handleImageLoaded(item, itemIndex, e)}
                              onError={() => setNextItemIndex(itemIndex + 1)}
                            />
                          )}
                          {isVideo && (
                            <video
                              ref={(el) => {
                                loadingImageRef.current = el;
                                if (el && el.readyState >= 1) {
                                  handleImageLoaded(item, itemIndex, { target: el });
                                }
                              }}
                              src={item.url}
                              onLoadedMetadata={(e) => handleImageLoaded(item, itemIndex, e)}
                              onError={() => setNextItemIndex(itemIndex + 1)}
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
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Asset</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Size</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Date</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Variant</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Tags</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAssets.map(asset => {
                      const isVideo = asset.extension === 'mp4';
                      const isImage = ['jpg', 'jpeg', 'png', 'gif'].includes(asset.extension);

                      return (
                        <tr
                          key={asset.id}
                          className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                          onClick={() => setSelectedAsset(asset)}
                        >
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <div className="w-16 h-16 bg-gray-100 rounded flex items-center justify-center overflow-hidden flex-shrink-0">
                                {isImage && <img src={asset.url} alt={asset.filename} className="w-full h-full object-cover" loading="lazy" />}
                                {isVideo && <video src={asset.url} className="w-full h-full object-cover" preload="metadata" />}
                                {!isImage && !isVideo && <ImageIcon size={24} className="text-gray-400" />}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="font-medium text-gray-800 truncate">{asset.product || 'Untitled'}</p>
                                <p className="text-xs text-gray-500 truncate">{asset.filename}</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            {asset.size && (
                              <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">
                                {asset.size}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-600">{asset.date || '-'}</td>
                          <td className="py-3 px-4">
                            {asset.variant && (
                              <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs font-medium">
                                {asset.variant.toUpperCase()}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex flex-wrap gap-1">
                              {asset.platforms.map(platform => (
                                <span key={platform} className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">{platform}</span>
                              ))}
                              {asset.tags.slice(0, 2).map(tag => (
                                <span key={tag} className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs">{tag}</span>
                              ))}
                              {asset.tags.length > 2 && (
                                <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">+{asset.tags.length - 2}</span>
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

          {filteredAssets.length === 0 && totalAssets === 0 && (
            <div className="text-center py-12 text-gray-500">
              <ImageIcon size={48} className="mx-auto mb-4 text-gray-300" />
              <p>No assets found</p>
            </div>
          )}
        </div>
      </div>

      {/* Upload Dialog */}
      {showUploadDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b">
              <h3 className="text-lg font-bold text-gray-800">Upload Assets</h3>
              <button onClick={() => setShowUploadDialog(false)} className="p-2 hover:bg-gray-100 rounded">
                <X size={20} />
              </button>
            </div>
            <div className="p-6">
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-400 transition-colors cursor-pointer"
                onClick={() => document.getElementById('asset-file-input').click()}
              >
                <Upload size={48} className="mx-auto mb-4 text-gray-400" />
                <p className="text-gray-700 mb-2 font-medium">Drag and drop files here</p>
                <p className="text-sm text-gray-500">or click to browse</p>
                <input
                  id="asset-file-input"
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
                      <span className="text-sm text-gray-700 truncate flex-1">{file.originalName}</span>
                      {uploadProgress[file.originalName] === 'completed' && (
                        <Check size={16} className="text-green-500 ml-2" />
                      )}
                      {uploadProgress[file.originalName] === 'error' && (
                        <X size={16} className="text-red-500 ml-2" />
                      )}
                      {!uploadProgress[file.originalName] && (
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

      {/* Asset Preview */}
      <CreativePreview
        creative={selectedAsset}
        onClose={() => setSelectedAsset(null)}
      />
    </div>
  );
};

export default Assets;
