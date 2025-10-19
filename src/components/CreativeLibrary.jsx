import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Image as ImageIcon, Filter, CheckSquare, Square, Share2, Upload, Info } from 'lucide-react';
import PageHeader, { getButtonStyle } from './PageHeader';
import CreativeShare from './CreativeShare';
import CreativePreview from './CreativePreview';
import CreativeLibraryMasonryView from './CreativeLibraryMasonryView';
import CreativeLibraryListView from './CreativeLibraryListView';
import CreativeLibraryUploadDialogs from './CreativeLibraryUploadDialogs';
import { processAssets, filterAssets } from '../utils/assetUtils';
import templateHtmlRaw from '../templates/html/index.html?raw';
import templateConfigUrl from '../templates/html/template.json?url';
import mainCss from '../templates/html/main.css?raw';
import css300x250 from '../templates/html/300x250.css?raw';
import css300x600 from '../templates/html/300x600.css?raw';
import css640x360 from '../templates/html/640x360.css?raw';
import css970x250 from '../templates/html/970x250.css?raw';
import css1080x1080 from '../templates/html/1080x1080.css?raw';

const CreativeLibrary = ({ onMenuToggle, currentModuleName, lookAndFeel, matrixData }) => {
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
  const [templateHtml, setTemplateHtml] = useState('');
  const [templateConfig, setTemplateConfig] = useState(null);
  const [templateCss, setTemplateCss] = useState(null);
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
  const itemColumnAssignments = useRef(new Map());
  const gridRef = useRef(null);
  const columnRefs = useRef([]);
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
  const loadingItemRef = useRef(null);
  const loadingImageRef = useRef(null);
  const processedDynamicItems = useRef(new Set());
  const processedRegularItems = useRef(new Set());
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
    loadCreatives();
  }, [matrixData?.messages]);

  // Load template HTML and config
  useEffect(() => {
    const loadTemplate = async () => {
      try {
        // HTML is already loaded as raw string via import
        setTemplateHtml(templateHtmlRaw);

        // Set up CSS map
        const cssMap = {
          main: mainCss,
          '300x250': css300x250,
          '300x600': css300x600,
          '640x360': css640x360,
          '970x250': css970x250,
          '1080x1080': css1080x1080
        };
        setTemplateCss(cssMap);

        // Only need to fetch the JSON config
        const configResponse = await fetch(templateConfigUrl);
        const config = await configResponse.json();
        setTemplateConfig(config);
      } catch (error) {
        console.error('Failed to load template:', error);
      }
    };

    loadTemplate();
  }, []);

  // MC Template supported banner sizes (from src/templates/html/*.css)
  const bannerSizes = [
    { width: 300, height: 250, name: 'Medium Rectangle' },
    { width: 300, height: 600, name: 'Half Page' },
    { width: 970, height: 250, name: 'Billboard' },
    { width: 1080, height: 1080, name: 'Social Square' },
    { width: 640, height: 360, name: 'Social Video' }
  ];

  const loadCreatives = useCallback(async () => {
    const assetModules = import.meta.glob('/src/creatives/*.*', { eager: true, as: 'url' });
    const creativeList = await processAssets(assetModules);

    // Generate dynamic message creatives for ALL messages if matrixData is available
    if (matrixData?.messages && matrixData.messages.length > 0) {
      const activeMessages = matrixData.messages.filter(m => m.status !== 'deleted');

      if (activeMessages.length > 0) {
        // Deduplicate messages by number+variant combination
        // Keep only the first occurrence of each unique number+variant pair
        const uniqueMessages = [];
        const seen = new Set();

        activeMessages.forEach(message => {
          const key = `${message.number}-${message.variant}`;
          if (!seen.has(key)) {
            seen.add(key);
            uniqueMessages.push(message);
          }
        });

        console.log('📊 Total active messages:', activeMessages.length);
        console.log('✅ Unique messages after deduplication:', uniqueMessages.length);
        console.log('🔍 Unique messages:', uniqueMessages.map(m => `MC${m.number}-${m.variant} (ID: ${m.id}, Name: ${m.name})`));

        const allMessageCreatives = [];

        // Create creatives for each unique message
        uniqueMessages.forEach(message => {
          const messageCreatives = bannerSizes.map((size) => ({
            id: `mc${message.number}-${message.variant}-${size.width}x${size.height}`,
            filename: `MC${message.number}_${message.variant}_${size.width}x${size.height}.html`,
            extension: 'html',
            url: null,
            product: message.name || `Message ${message.number}`,
            size: `${size.width}x${size.height}`,
            variant: message.variant,
            date: new Date().toISOString().split('T')[0],
            platforms: [],
            tags: [size.name, 'dynamic', 'message', `mc${message.number}`, `v${message.variant}`],
            isDynamic: true,
            messageData: message,
            bannerSize: size
          }));

          allMessageCreatives.push(...messageCreatives);
        });

        setCreatives([...allMessageCreatives, ...creativeList]);
        return;
      }
    }

    setCreatives(creativeList);
  }, [matrixData]);

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
    // Check if this item has already been processed (by ID only)
    if (processedRegularItems.current.has(creative.id)) {
      console.log('⚠️ Item already processed, skipping:', creative.id);
      setNextItemIndex(itemIndex + 1);
      return;
    }

    processedRegularItems.current.add(creative.id);

    const isVideo = creative.extension === 'mp4';
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

    itemPositions.current.set(creative.id, {
      height: renderedHeight
    });

    setColumnItems(prev => {
      const updated = { ...prev };
      updated[shortestCol] = [...updated[shortestCol], { ...creative, originalIndex: itemIndex }];
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

    const totalItems = filterAssets(creatives, filterText).length;
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
    const emptyColumns = initializeColumns(columnCount);
    const emptyHeights = initializeHeights(columnCount);

    setTotalVisible(loadChunkSize * 2);
    setLoadedStart(0);
    setLoadedEnd(loadChunkSize * 2);
    setColumnItems(emptyColumns);
    setColumnHeights(emptyHeights);
    setNextItemIndex(0);

    // Immediately update refs to prevent stale data
    columnItemsRef.current = emptyColumns;
    columnHeightsRef.current = emptyHeights;

    chunkBoundaries.current.clear();
    itemPositions.current.clear();
    processedDynamicItems.current.clear();
    processedRegularItems.current.clear();

    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  }, [filterText, loadChunkSize, columnCount]);

  // Clear column assignments when view mode changes
  useEffect(() => {
    const emptyColumns = initializeColumns(columnCount);
    const emptyHeights = initializeHeights(columnCount);

    itemColumnAssignments.current.clear();
    setColumnItems(emptyColumns);
    setColumnHeights(emptyHeights);
    setNextItemIndex(0);

    // Immediately update refs to prevent stale data
    columnItemsRef.current = emptyColumns;
    columnHeightsRef.current = emptyHeights;

    chunkBoundaries.current.clear();
    itemPositions.current.clear();
    processedDynamicItems.current.clear();
    processedRegularItems.current.clear();
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

  // Auto-add dynamic creatives to columns (they don't need image loading)
  useEffect(() => {
    if (viewMode !== 'grid3' && viewMode !== 'grid4') return;
    if (!gridRef.current) return;

    const allFiltered = filterAssets(creatives, filterText);

    // Find which dynamic items in the loaded range haven't been processed yet
    const dynamicCreativesToAdd = [];
    for (let i = loadedStart; i < loadedEnd && i < allFiltered.length; i++) {
      const creative = allFiltered[i];
      // Track by ID only, not by ID+index
      if (creative.isDynamic && !processedDynamicItems.current.has(creative.id)) {
        dynamicCreativesToAdd.push({ creative, index: i });
        processedDynamicItems.current.add(creative.id);
      }
    }

    if (dynamicCreativesToAdd.length === 0) return;

    console.log('🔄 Adding dynamic creatives to columns:', dynamicCreativesToAdd.map(d => `${d.creative.id} at index ${d.index}`));

    const currentColumnCount = Object.keys(columnHeightsRef.current).length;
    const columnWidth = (gridRef.current?.offsetWidth || 1000) / currentColumnCount - 16;

    // Copy existing column structure
    const newColumnItems = {};
    Object.keys(columnItemsRef.current).forEach(key => {
      newColumnItems[key] = [...columnItemsRef.current[key]];
    });
    const workingHeights = { ...columnHeightsRef.current };

    // Add only the new dynamic items
    dynamicCreativesToAdd.forEach(({ creative, index }) => {
      const aspectRatio = creative.bannerSize.width / creative.bannerSize.height;
      const renderedHeight = columnWidth / aspectRatio;

      const heights = Object.values(workingHeights);
      const shortestCol = heights.indexOf(Math.min(...heights));

      const chunkIndex = Math.floor(index / loadChunkSize);
      const itemYStart = workingHeights[shortestCol];
      const itemYEnd = workingHeights[shortestCol] + renderedHeight;

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

      itemPositions.current.set(creative.id, {
        height: renderedHeight
      });

      newColumnItems[shortestCol].push({ ...creative, originalIndex: index });

      workingHeights[shortestCol] = workingHeights[shortestCol] + renderedHeight + 16;
    });

    setColumnItems(newColumnItems);
    setColumnHeights(workingHeights);
  }, [loadedStart, loadedEnd, viewMode, creatives, filterText, loadChunkSize]);

  const toggleSelectorMode = () => {
    setSelectorMode(!selectorMode);
    if (selectorMode) {
      setSelectedCreativeIds(new Set());
    }
  };

  const toggleCreativeSelection = (creativeId, enableSelectorMode = false, skipToggle = false) => {
    if (enableSelectorMode && !selectorMode) {
      setSelectorMode(true);
    }

    // If skipToggle is true (e.g., entering selector mode via long press), don't toggle selection
    if (skipToggle) {
      return;
    }

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

  // Get filtered creatives
  const allFilteredCreatives = filterAssets(creatives, filterText);
  const totalCreatives = allFilteredCreatives.length;
  const visibleItems = allFilteredCreatives.slice(0, totalVisible);

  const filteredCreatives = visibleItems.map((item, index) => ({
    ...item,
    isPlaceholder: index < loadedStart || index >= loadedEnd,
    originalIndex: index
  }));

  // Get the current item that should be loading
  const currentLoadingItem = useMemo(() => {
    if (nextItemIndex < loadedStart || nextItemIndex >= loadedEnd || nextItemIndex >= totalCreatives) {
      return null;
    }

    const item = allFilteredCreatives[nextItemIndex];

    if (item?.isDynamic) {
      const nextNonDynamicIndex = nextItemIndex + 1;

      for (let i = nextNonDynamicIndex; i < loadedEnd && i < totalCreatives; i++) {
        const nextItem = allFilteredCreatives[i];
        if (!nextItem?.isDynamic) {
          return { item: nextItem, index: i };
        }
      }

      setTimeout(() => setNextItemIndex(nextNonDynamicIndex), 0);
      return null;
    }

    return { item, index: nextItemIndex };
  }, [nextItemIndex, loadedStart, loadedEnd, totalCreatives, allFilteredCreatives]);

  // Calculate max column height for background container
  const maxColumnHeight = Math.max(...Object.values(columnHeights));
  const containerHeight = maxColumnHeight + (typeof window !== 'undefined' ? window.innerHeight * 0.1 : 80);

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
        titleFilters={
          <>
            {/* Filter Input */}
            <div className="flex items-center gap-2">
              <Filter size={18} className="text-white" />
              <input
                type="text"
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                placeholder="Filter creatives..."
                className="w-64 px-3 py-2 border border-white/20 rounded bg-white/10 text-white placeholder-white/60 focus:ring-2 focus:ring-white/30 focus:border-white/30 focus:bg-white/20"
              />
            </div>

            {/* Select Button */}
            <button
              onClick={toggleSelectorMode}
              className={`flex items-center gap-2 px-4 py-2 rounded transition-colors ${
                selectorMode
                  ? 'bg-white text-gray-900 hover:bg-white/90'
                  : 'bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              {selectorMode ? <CheckSquare size={16} /> : <Square size={16} />}
              {selectorMode ? 'Selecting' : 'Select'}
            </button>

            {/* Select All / Deselect All */}
            {selectorMode && (
              <>
                <button
                  onClick={() => {
                    const allFilteredIds = new Set(allFilteredCreatives.map(creative => creative.id));
                    setSelectedCreativeIds(allFilteredIds);
                  }}
                  className="px-4 py-2 bg-white/10 text-white rounded hover:bg-white/20 transition-colors"
                >
                  All ({totalCreatives})
                </button>
                <button
                  onClick={() => setSelectedCreativeIds(new Set())}
                  className="px-4 py-2 bg-white/10 text-white rounded hover:bg-white/20 transition-colors"
                >
                  None
                </button>
              </>
            )}
          </>
        }
      >
        {/* Share Button */}
        {selectorMode && selectedCreativeIds.size > 0 && (
          <button
            onClick={() => {
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
            className="relative p-2 text-white rounded hover:opacity-90 transition-opacity"
            style={getButtonStyle(lookAndFeel)}
            title={`Share ${selectedCreativeIds.size} creative${selectedCreativeIds.size > 1 ? 's' : ''}`}
          >
            <Share2 size={20} />
            {selectedCreativeIds.size > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                {selectedCreativeIds.size}
              </span>
            )}
          </button>
        )}

        {/* Upload Button */}
        <button
          onClick={() => setShowUploadDialog(true)}
          className="p-2 text-white rounded hover:opacity-90 transition-opacity"
          style={getButtonStyle(lookAndFeel)}
          title="Upload creatives"
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
            <CreativeLibraryMasonryView
              gridRef={gridRef}
              columnItems={columnItems}
              columnCount={columnCount}
              containerHeight={containerHeight}
              loadedStart={loadedStart}
              loadedEnd={loadedEnd}
              itemPositions={itemPositions}
              selectorMode={selectorMode}
              selectedCreativeIds={selectedCreativeIds}
              onToggleSelection={toggleCreativeSelection}
              onSelectCreative={setSelectedCreative}
              currentLoadingItem={currentLoadingItem}
              loadingImageRef={loadingImageRef}
              handleImageLoaded={handleImageLoaded}
              setNextItemIndex={setNextItemIndex}
              templateHtml={templateHtml}
              templateConfig={templateConfig}
              templateCss={templateCss}
            />
          ) : (
            <CreativeLibraryListView
              gridRef={gridRef}
              filteredCreatives={filteredCreatives}
              selectorMode={selectorMode}
              selectedCreativeIds={selectedCreativeIds}
              onToggleSelection={toggleCreativeSelection}
              onSelectCreative={setSelectedCreative}
            />
          )}

          {filteredCreatives.length === 0 && totalCreatives === 0 && (
            <div className="text-center py-12 text-gray-500">
              <ImageIcon size={48} className="mx-auto mb-4 text-gray-300" />
              <p>No creatives found</p>
            </div>
          )}
        </div>
      </div>

      {/* Upload Dialogs */}
      <CreativeLibraryUploadDialogs
        showUploadDialog={showUploadDialog}
        setShowUploadDialog={setShowUploadDialog}
        showMetadataDialog={showMetadataDialog}
        pendingUploads={pendingUploads}
        uploadingFiles={uploadingFiles}
        uploadProgress={uploadProgress}
        handleDrop={handleDrop}
        handleDragOver={handleDragOver}
        handleFileUpload={handleFileUpload}
        updatePendingMetadata={updatePendingMetadata}
        handleConfirmUploads={handleConfirmUploads}
        handleCancelUploads={handleCancelUploads}
      />

      {/* Share Dialog */}
      <CreativeShare
        isOpen={showShareDialog}
        onClose={closeShareDialog}
        selectedCreativeIds={selectedCreativeIds}
        selectedCreatives={allFilteredCreatives.filter(c => selectedCreativeIds.has(c.id))}
        shareTitle={shareTitle}
        setShareTitle={setShareTitle}
        selectedBaseColor={selectedBaseColor}
        setSelectedBaseColor={setSelectedBaseColor}
        generatedShareUrl={generatedShareUrl}
        setGeneratedShareUrl={setGeneratedShareUrl}
        copiedUrl={copiedUrl}
        setCopiedUrl={setCopiedUrl}
        lookAndFeel={lookAndFeel}
        templateHtml={templateHtml}
        templateConfig={templateConfig}
        templateCss={templateCss}
        templateName="html"
      />

      {/* Creative Preview */}
      <CreativePreview
        creative={selectedCreative}
        onClose={() => setSelectedCreative(null)}
        templateHtml={templateHtml}
        templateConfig={templateConfig}
        templateCss={templateCss}
        allCreatives={allFilteredCreatives}
        onNavigate={setSelectedCreative}
      />
    </div>
  );
};

export default CreativeLibrary;
