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

  // Virtual scrolling state
  const [windowStart, setWindowStart] = useState(0);
  const [windowSize] = useState(42);
  const scrollContainerRef = useRef(null);
  const lastScrollY = useRef(0);
  const isUpdatingWindow = useRef(false);
  const itemPositions = useRef(new Map()); // Track positions of items
  const gridRef = useRef(null);

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
      const containerRect = scrollContainerRef.current.getBoundingClientRect();
      itemPositions.current.set(id, {
        top: rect.top - containerRect.top + scrollContainerRef.current.scrollTop,
        height: rect.height
      });
    });
  }, []);

  // Calculate masonry container height for a set of items
  const calculateMasonryHeight = useCallback((items, columnCount) => {
    const columnHeights = Array(columnCount).fill(0);
    const gapSize = 16; // Tailwind gap-4 = 1rem = 16px

    items.forEach((item) => {
      const shortestColumnIndex = columnHeights.indexOf(Math.min(...columnHeights));
      const estimatedHeight = itemPositions.current.get(item.id)?.height || 300;
      columnHeights[shortestColumnIndex] += estimatedHeight + gapSize;
    });

    return Math.max(...columnHeights);
  }, []);

  // Virtual scrolling handler
  const handleScroll = useCallback(() => {
    if (!scrollContainerRef.current || isUpdatingWindow.current) return;

    const container = scrollContainerRef.current;
    const scrollY = container.scrollTop;
    const scrollDirection = scrollY > lastScrollY.current ? 'down' : 'up';
    lastScrollY.current = scrollY;

    // Get total items after filtering
    const totalItems = filterAssets(creatives, filterText).length;

    // Calculate scroll percentage based on viewport
    const scrollHeight = container.scrollHeight - container.clientHeight;
    const scrollPercent = scrollHeight > 0 ? scrollY / scrollHeight : 0;

    // Calculate approximate item index based on scroll position
    const approximateItemIndex = Math.floor(scrollPercent * totalItems);

    // Get current window end
    const currentWindowEnd = windowStart + windowSize;
    const currentWindowMiddle = windowStart + Math.floor(windowSize / 2);

    // Determine column count based on view mode (list view doesn't use masonry)
    const columnCount = viewMode === 'grid3' ? 3 : viewMode === 'grid4' ? 4 : 1;

    if (scrollDirection === 'down') {
      // Scrolling down: if we're past the middle (21 items), load next batch
      if (approximateItemIndex > currentWindowMiddle && currentWindowEnd < totalItems) {
        const newStart = Math.min(windowStart + 12, totalItems - windowSize);
        if (newStart > windowStart) {
          isUpdatingWindow.current = true;

          // Save positions before update
          saveItemPositions();

          // Calculate masonry height change for removed items
          const allFiltered = filterAssets(creatives, filterText);
          const currentItems = allFiltered.slice(windowStart, windowStart + windowSize);
          const newItems = allFiltered.slice(newStart, newStart + windowSize);

          const currentHeight = calculateMasonryHeight(currentItems, columnCount);
          const newHeight = calculateMasonryHeight(newItems, columnCount);
          const heightDifference = currentHeight - newHeight;

          // Update window
          setWindowStart(newStart);

          // Adjust scroll to compensate for removed items
          requestAnimationFrame(() => {
            if (scrollContainerRef.current && heightDifference > 0) {
              scrollContainerRef.current.scrollTop = scrollY - heightDifference;
              lastScrollY.current = scrollContainerRef.current.scrollTop;
            }
            setTimeout(() => {
              isUpdatingWindow.current = false;
            }, 50);
          });
        }
      }
    } else if (scrollDirection === 'up') {
      // Scrolling up: if we're before 25% of window, load previous batch
      const currentWindowQuarter = windowStart + Math.floor(windowSize / 4);
      if (approximateItemIndex < currentWindowQuarter && windowStart > 0) {
        const newStart = Math.max(windowStart - 12, 0);
        if (newStart < windowStart) {
          isUpdatingWindow.current = true;

          // Save positions before update
          saveItemPositions();

          // Calculate masonry height change for added items
          const allFiltered = filterAssets(creatives, filterText);
          const currentItems = allFiltered.slice(windowStart, windowStart + windowSize);
          const newItems = allFiltered.slice(newStart, newStart + windowSize);

          const currentHeight = calculateMasonryHeight(currentItems, columnCount);
          const newHeight = calculateMasonryHeight(newItems, columnCount);
          const heightDifference = newHeight - currentHeight;

          // Update window
          setWindowStart(newStart);

          // Adjust scroll to compensate for added items
          requestAnimationFrame(() => {
            if (scrollContainerRef.current && heightDifference > 0) {
              scrollContainerRef.current.scrollTop = scrollY + heightDifference;
              lastScrollY.current = scrollContainerRef.current.scrollTop;
            }
            setTimeout(() => {
              isUpdatingWindow.current = false;
            }, 50);
          });
        }
      }
    }
  }, [creatives, filterText, windowStart, windowSize, viewMode, saveItemPositions, calculateMasonryHeight]);

  // Setup scroll listener
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    // Throttle scroll events
    let scrollTimeout;
    const throttledScroll = () => {
      if (scrollTimeout) return;
      scrollTimeout = setTimeout(() => {
        handleScroll();
        scrollTimeout = null;
      }, 100);
    };

    container.addEventListener('scroll', throttledScroll);
    return () => {
      container.removeEventListener('scroll', throttledScroll);
      if (scrollTimeout) clearTimeout(scrollTimeout);
    };
  }, [handleScroll]);

  // Reset window when filter changes
  useEffect(() => {
    setWindowStart(0);
  }, [filterText]);

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

  // Get filtered creatives and apply virtual scrolling window
  const allFilteredCreatives = filterAssets(creatives, filterText);
  const totalCreatives = allFilteredCreatives.length;
  const windowEnd = Math.min(windowStart + windowSize, totalCreatives);
  const filteredCreatives = allFilteredCreatives.slice(windowStart, windowEnd);

  // Masonry distribution: Distribute items across columns balancing by height
  const distributeToColumns = useCallback((items, columnCount) => {
    const columns = Array.from({ length: columnCount }, () => []);
    const columnHeights = Array(columnCount).fill(0);

    items.forEach((item) => {
      // Find shortest column
      const shortestColumnIndex = columnHeights.indexOf(Math.min(...columnHeights));

      // Add item to shortest column
      columns[shortestColumnIndex].push(item);

      // Estimate item height based on saved position or default
      const estimatedHeight = itemPositions.current.get(item.id)?.height || 300;
      columnHeights[shortestColumnIndex] += estimatedHeight;
    });

    return columns;
  }, []);

  // Distribute items for grid views
  const grid3Columns = useMemo(
    () => distributeToColumns(filteredCreatives, 3),
    [filteredCreatives, distributeToColumns]
  );

  const grid4Columns = useMemo(
    () => distributeToColumns(filteredCreatives, 4),
    [filteredCreatives, distributeToColumns]
  );

  // For debugging
  const debugInfo = `Showing ${windowStart + 1}-${windowEnd} of ${totalCreatives}`;

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
            <div ref={gridRef} className="flex gap-4">
              {grid3Columns.map((column, columnIndex) => (
                <div key={columnIndex} className="flex-1 flex flex-col gap-4">
                  {column.map(creative => {
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
                </div>
              ))}
            </div>
          ) : viewMode === 'grid4' ? (
            <div ref={gridRef} className="flex gap-4">
              {grid4Columns.map((column, columnIndex) => (
                <div key={columnIndex} className="flex-1 flex flex-col gap-4">
                  {column.map(creative => {
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
                </div>
              ))}
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

          {filteredCreatives.length === 0 && (
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
