import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Image as ImageIcon, X, Filter, Info, Cloud, RefreshCw, Loader, CheckCircle, AlertCircle } from 'lucide-react';
import PageHeader, { getButtonStyle } from './PageHeader';
import CreativePreview from './CreativePreview';
import AssetsMasonryView from './AssetsMasonryView';
// Local storage utilities - now unused, using Drive only
// import { processAssets, filterAssets } from '../utils/assetUtils';
import { filterAssets } from '../utils/assetUtils';
import { loadDriveAssets, parseDriveAssetData, isDriveEnabled } from '../utils/driveAssets';
// _unused - Upload functionality disabled
// import { uploadToDrive } from '../utils/driveAssets';

const Assets = ({ onMenuToggle, currentModuleName, lookAndFeel, matrixData }) => {
  // Get assets from matrixData (loaded from spreadsheet)
  const { assets: spreadsheetAssets, setAssets: setSpreadsheetAssets } = matrixData;
  const [assets, setAssets] = useState([]);
  const [viewMode, setViewMode] = useState('grid4');
  const [filterText, setFilterText] = useState('');
  // _unused - Upload functionality disabled
  // const [showUploadDialog, setShowUploadDialog] = useState(false);
  // const [uploadingFiles, setUploadingFiles] = useState([]);
  // const [uploadProgress, setUploadProgress] = useState({});
  // const [pendingUploads, setPendingUploads] = useState([]);
  // const [showMetadataDialog, setShowMetadataDialog] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [showDebugInfo, setShowDebugInfo] = useState(false);
  const [driveEnabled, setDriveEnabled] = useState(false);
  const [loadingDrive, setLoadingDrive] = useState(false);
  const [syncProgress, setSyncProgress] = useState(null); // { type: 'loading' | 'success' | 'error', message: string }
  // spreadsheetAssets comes from matrixData (loaded from spreadsheet on app start)

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

  // Transform spreadsheet assets to UI format
  useEffect(() => {
    console.log(`📊 Spreadsheet assets changed: ${spreadsheetAssets?.length || 0} items`);

    if (!spreadsheetAssets || spreadsheetAssets.length === 0) {
      setAssets([]);
      return;
    }

    // Transform spreadsheet format to UI format
    const uiAssets = spreadsheetAssets.map(asset => ({
      ...asset,
      id: asset.File_driveID,
      filename: asset.File_name,
      extension: asset.File_format,
      size: asset.File_size,
      date: asset.File_date,
      url: `/api/drive/proxy/${asset.File_driveID}`,
      thumbnail: asset.File_thumbnail || `/api/drive/proxy/${asset.File_driveID}`,
      brand: asset.Brand,
      product: asset.Product,
      type: asset.Type,
      variant: asset.Version,
      visual_keyword: asset.Visual_keyword,
      comment: asset.Comment,
      File_date: asset.File_date, // Keep raw ISO date
      File_dimensions: asset.File_dimensions, // Keep dimensions
      File_DirectLink: asset.File_DirectLink, // Keep direct link
      platforms: [],
      tags: [],
      source: 'spreadsheet'
    }));

    setAssets(uiAssets);
    console.log(`✓ Loaded ${uiAssets.length} assets from spreadsheet`);
  }, [spreadsheetAssets]);

  // Sync with Drive - compare spreadsheet vs Drive and update if differences found
  const syncWithDrive = async () => {
    try {
      // Check if Drive is enabled
      setSyncProgress({ type: 'loading', message: 'Checking Google Drive connection...' });
      const driveIsEnabled = await isDriveEnabled();
      setDriveEnabled(driveIsEnabled);

      if (!driveIsEnabled) {
        console.warn('Google Drive is not enabled. Please configure Drive in config.json');
        setSyncProgress({
          type: 'error',
          message: 'Google Drive is not enabled. Please configure Drive in config.json'
        });
        return;
      }

      setLoadingDrive(true);
      setSyncProgress({ type: 'loading', message: 'Loading assets from Drive...' });

      // Load all files from Drive
      const driveData = await loadDriveAssets('assets', { pageSize: 1000 });
      const driveFiles = driveData.files;

      // Get current spreadsheet File_driveIDs
      const spreadsheetDriveIds = new Set(
        (spreadsheetAssets || []).map(asset => asset.File_driveID).filter(id => id)
      );

      // Find new assets (in Drive but not in spreadsheet)
      const newAssets = driveFiles.filter(file => !spreadsheetDriveIds.has(file.id));

      // Find deleted assets (in spreadsheet but not in Drive)
      const driveDriveIds = new Set(driveFiles.map(file => file.id));
      const deletedAssets = (spreadsheetAssets || []).filter(
        asset => asset.File_driveID && !driveDriveIds.has(asset.File_driveID)
      );

      console.log(`🔄 Sync results: ${newAssets.length} new, ${deletedAssets.length} deleted`);

      // If no changes, just inform user
      if (newAssets.length === 0 && deletedAssets.length === 0) {
        setSyncProgress({
          type: 'success',
          message: 'Spreadsheet is up to date with Google Drive. No changes found.'
        });
        setLoadingDrive(false);
        // Auto-dismiss after 3 seconds
        setTimeout(() => setSyncProgress(null), 3000);
        return;
      }

      setSyncProgress({ type: 'loading', message: 'Updating spreadsheet...' });

      // Update spreadsheet with changes
      let updatedAssets = [...(spreadsheetAssets || [])];

      // Remove deleted assets
      if (deletedAssets.length > 0) {
        const deletedIds = new Set(deletedAssets.map(a => a.File_driveID));
        updatedAssets = updatedAssets.filter(asset => !deletedIds.has(asset.File_driveID));
      }

      // Add new assets with incremental IDs
      if (newAssets.length > 0) {
        const maxId = updatedAssets.length > 0
          ? Math.max(...updatedAssets.map(a => parseInt(a.ID) || 0))
          : 0;

        const parsedNewAssets = newAssets.map((file, index) => {
          const parsedAsset = parseDriveAssetData(file);
          return {
            ID: maxId + index + 1,
            Brand: '',
            Product: '',
            Type: '',
            Visual_keyword: '',
            Visual_description: '',
            Placeholder_name: '',
            Version: '',
            Comment: '',
            File_format: parsedAsset.extension || '',
            File_driveID: parsedAsset.id || '',
            File_name: parsedAsset.filename || '',
            File_size: parsedAsset.size || '',
            File_date: parsedAsset.File_date || '',
            File_dimensions: parsedAsset.File_dimensions || '',
            File_DirectLink: parsedAsset.File_DirectLink || '',
            File_thumbnail: parsedAsset.thumbnail || ''
          };
        });

        updatedAssets = [...updatedAssets, ...parsedNewAssets];
      }

      // Update spreadsheet
      setSpreadsheetAssets(updatedAssets);

      // Save to spreadsheet
      await matrixData.save(null, null, updatedAssets);

      // Show results to user
      const message = [];
      if (newAssets.length > 0) {
        message.push(`Added ${newAssets.length} new asset(s)`);
      }
      if (deletedAssets.length > 0) {
        message.push(`Removed ${deletedAssets.length} deleted asset(s)`);
      }
      message.push(`Spreadsheet has been updated.`);

      setSyncProgress({
        type: 'success',
        message: message.join(' • ')
      });
      console.log('✓ Sync completed successfully');
      // Auto-dismiss after 5 seconds for success with changes
      setTimeout(() => setSyncProgress(null), 5000);
    } catch (error) {
      console.error('Error syncing with Drive:', error);
      setSyncProgress({
        type: 'error',
        message: `Error syncing with Drive: ${error.message}`
      });
    } finally {
      setLoadingDrive(false);
    }
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
      console.log(`⚠️ Asset #${itemIndex} already processed, skipping: ${asset.filename}`);
      setNextItemIndex(itemIndex + 1);
      return;
    }

    processedItems.current.add(asset.id);

    // List view uses fixed row height, so chunk boundaries are already set
    // Just mark as loaded and move to next
    if (viewMode === 'list') {
      console.log(`✅ List item #${itemIndex} loaded, triggering next item #${itemIndex + 1}`);
      setNextItemIndex(itemIndex + 1);
      return;
    }

    // Grid view: calculate dynamic heights and add to masonry columns
    const isVideo = asset.extension === 'mp4';
    const media = event.target;
    const mediaHeight = isVideo ? media.videoHeight : media.naturalHeight;
    const mediaWidth = isVideo ? media.videoWidth : media.naturalWidth;

    console.log(`📐 Asset #${itemIndex} dimensions: ${mediaWidth}x${mediaHeight}`);

    const currentColumnCount = Object.keys(columnHeightsRef.current).length;
    const columnWidth = (gridRef.current?.offsetWidth || 1000) / currentColumnCount - 16;
    const renderedHeight = (mediaHeight / mediaWidth) * columnWidth;

    const heights = Object.values(columnHeightsRef.current);
    const shortestCol = heights.indexOf(Math.min(...heights));

    const chunkIndex = Math.floor(itemIndex / loadChunkSize);
    const itemYStart = columnHeightsRef.current[shortestCol];
    const itemYEnd = columnHeightsRef.current[shortestCol] + renderedHeight;

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

    setColumnHeights(prev => {
      const newHeights = {
        ...prev,
        [shortestCol]: prev[shortestCol] + renderedHeight + 16
      };
      columnHeightsRef.current = newHeights;
      return newHeights;
    });

    console.log(`✅ Asset #${itemIndex} added to column ${shortestCol}, triggering next item #${itemIndex + 1}`);
    setNextItemIndex(itemIndex + 1);
  }, [loadChunkSize, viewMode]);

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
    const scrollHeight = container.scrollHeight;

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

    columnItemsRef.current = emptyColumns;
    columnHeightsRef.current = emptyHeights;

    chunkBoundaries.current.clear();
    itemPositions.current.clear();
    processedItems.current.clear();

    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }

    // Force reload by resetting nextItemIndex after state updates
    setTimeout(() => {
      setNextItemIndex(0);
    }, 0);
  }, [filterText, loadChunkSize, columnCount]);

  // Clear column assignments when view mode changes
  useEffect(() => {
    const emptyColumns = initializeColumns(columnCount);
    const emptyHeights = initializeHeights(columnCount);

    setTotalVisible(loadChunkSize * 2);
    setLoadedStart(0);
    setLoadedEnd(loadChunkSize * 2);
    setColumnItems(emptyColumns);
    setColumnHeights(emptyHeights);

    columnItemsRef.current = emptyColumns;
    columnHeightsRef.current = emptyHeights;

    chunkBoundaries.current.clear();
    itemPositions.current.clear();
    processedItems.current.clear();

    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }

    // Force reload by resetting nextItemIndex after state updates
    setTimeout(() => {
      setNextItemIndex(0);
    }, 0);
  }, [viewMode, columnCount, loadChunkSize]);

  // Reset and start loading when assets change
  useEffect(() => {
    console.log(`📊 Assets changed: length=${assets.length}, viewMode=${viewMode}, columnCount=${columnCount}`);

    if (assets.length > 0 && (viewMode === 'grid3' || viewMode === 'grid4')) {
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

      console.log(`🎯 Starting sequential loading for ${assets.length} assets`);
    }
  }, [assets.length, columnCount, viewMode]);

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

  // _unused - Upload functionality disabled
  // const handleFileUpload = async (files) => {
  //   const fileArray = Array.from(files);
  //   const previews = [];
  //
  //   for (const file of fileArray) {
  //     try {
  //       const formData = new FormData();
  //       formData.append('file', file);
  //
  //       const response = await fetch('/api/assets/preview-metadata', {
  //         method: 'POST',
  //         body: formData
  //       });
  //
  //       if (!response.ok) {
  //         throw new Error('Preview failed');
  //       }
  //
  //       const result = await response.json();
  //       previews.push({
  //         originalName: result.originalName,
  //         tempFilename: result.tempFilename,
  //         metadata: result.metadata
  //       });
  //     } catch (error) {
  //       console.error('Error previewing file:', error);
  //       alert(`Failed to preview ${file.name}: ${error.message}`);
  //     }
  //   }
  //
  //   if (previews.length > 0) {
  //     setPendingUploads(previews);
  //     setShowUploadDialog(false);
  //     setShowMetadataDialog(true);
  //   }
  // };

  // _unused - Local storage upload (replaced with Drive upload)
  // const handleConfirmUploads = async () => {
  //   setShowMetadataDialog(false);
  //   setUploadingFiles(pendingUploads);
  //   setUploadProgress({});
  //
  //   for (const upload of pendingUploads) {
  //     try {
  //       const response = await fetch('/api/assets/confirm-upload', {
  //         method: 'POST',
  //         headers: { 'Content-Type': 'application/json' },
  //         body: JSON.stringify({
  //           tempFilename: upload.tempFilename,
  //           metadata: upload.metadata,
  //           targetDir: 'assets',
  //           originalName: upload.originalName
  //         })
  //       });
  //
  //       if (!response.ok) {
  //         throw new Error('Upload confirmation failed');
  //       }
  //
  //       const result = await response.json();
  //       console.log('File uploaded:', result);
  //
  //       setUploadProgress(prev => ({
  //         ...prev,
  //         [upload.originalName]: 'completed'
  //       }));
  //     } catch (error) {
  //       console.error('Error confirming upload:', error);
  //       setUploadProgress(prev => ({
  //         ...prev,
  //         [upload.originalName]: 'error'
  //       }));
  //     }
  //   }
  //
  //   await loadAssetsList();
  //
  //   setTimeout(() => {
  //     setUploadingFiles([]);
  //     setUploadProgress({});
  //     setPendingUploads([]);
  //   }, 1500);
  // };

  // _unused - Drive upload handler (upload functionality disabled)
  // const handleConfirmUploads = async () => {
  //   setShowMetadataDialog(false);
  //   setUploadingFiles(pendingUploads);
  //   setUploadProgress({});
  //
  //   for (const upload of pendingUploads) {
  //     try {
  //       setUploadProgress(prev => ({
  //         ...prev,
  //         [upload.originalName]: 'uploading'
  //       }));
  //
  //       // Get the file from temp preview
  //       const tempResponse = await fetch(`/api/assets/temp-preview/${upload.tempFilename}`);
  //       const blob = await tempResponse.blob();
  //       const file = new File([blob], upload.originalName, { type: blob.type });
  //
  //       // Upload to Google Drive
  //       await uploadToDrive(file, 'assets', upload.metadata);
  //
  //       setUploadProgress(prev => ({
  //         ...prev,
  //         [upload.originalName]: 'completed'
  //       }));
  //
  //       console.log(`✓ Uploaded ${upload.originalName} to Google Drive`);
  //     } catch (error) {
  //       console.error('Error uploading to Drive:', error);
  //       setUploadProgress(prev => ({
  //         ...prev,
  //         [upload.originalName]: 'error'
  //       }));
  //     }
  //   }
  //
  //   // Clean up temp files
  //   for (const upload of pendingUploads) {
  //     try {
  //       await fetch('/api/assets/cancel-upload', {
  //         method: 'POST',
  //         headers: { 'Content-Type': 'application/json' },
  //         body: JSON.stringify({ tempFilename: upload.tempFilename })
  //       });
  //     } catch (error) {
  //       console.error('Error cleaning up temp file:', error);
  //     }
  //   }
  //
  //   // Reload assets from Drive
  //   await loadAssetsList();
  //
  //   setTimeout(() => {
  //     setUploadingFiles([]);
  //     setUploadProgress({});
  //     setPendingUploads([]);
  //   }, 1500);
  // };

  // _unused - Upload functionality disabled
  // const handleCancelUploads = async () => {
  //   for (const upload of pendingUploads) {
  //     try {
  //       await fetch('/api/assets/cancel-upload', {
  //         method: 'POST',
  //         headers: { 'Content-Type': 'application/json' },
  //         body: JSON.stringify({ tempFilename: upload.tempFilename })
  //       });
  //     } catch (error) {
  //       console.error('Error canceling upload:', error);
  //     }
  //   }
  //
  //   setPendingUploads([]);
  //   setShowMetadataDialog(false);
  // };

  // _unused - Upload functionality disabled
  // const updatePendingMetadata = (index, field, value) => {
  //   setPendingUploads(prev => {
  //     const updated = [...prev];
  //     updated[index].metadata[field] = value;
  //     return updated;
  //   });
  // };

  // _unused - Upload functionality disabled
  // const handleDrop = (e) => {
  //   e.preventDefault();
  //   const files = e.dataTransfer.files;
  //   if (files.length > 0) {
  //     handleFileUpload(files);
  //   }
  // };

  // _unused - Upload functionality disabled
  // const handleDragOver = (e) => {
  //   e.preventDefault();
  // };

  // Get filtered assets - memoized to prevent unnecessary recalculations
  const allFilteredAssets = useMemo(() => {
    return filterAssets(assets, filterText);
  }, [assets, filterText]);

  const totalAssets = allFilteredAssets.length;
  const visibleItems = allFilteredAssets.slice(0, totalVisible);

  const filteredAssets = visibleItems.map((item, index) => ({
    ...item,
    isPlaceholder: index < loadedStart || index >= loadedEnd,
    originalIndex: index
  }));

  // For list view: populate chunk boundaries with fixed row height
  useEffect(() => {
    if (viewMode !== 'list' || allFilteredAssets.length === 0) return;

    const rowHeight = 120; // Fixed height per row in list view
    const totalChunks = Math.ceil(allFilteredAssets.length / loadChunkSize);

    for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
      const start = chunkIndex * loadChunkSize * rowHeight;
      const itemsInChunk = Math.min(loadChunkSize, allFilteredAssets.length - chunkIndex * loadChunkSize);
      const end = start + (itemsInChunk * rowHeight);

      chunkBoundaries.current.set(chunkIndex, { start, end });
    }

    console.log(`📋 List view: populated ${totalChunks} chunk boundaries`);
  }, [viewMode, allFilteredAssets.length, loadChunkSize]);

  // Get the current item that should be loading (sequential for proper masonry)
  const currentLoadingItem = useMemo(() => {
    console.log(`🔍 currentLoadingItem check: nextItemIndex=${nextItemIndex}, loadedStart=${loadedStart}, loadedEnd=${loadedEnd}, totalAssets=${totalAssets}, allFilteredAssets.length=${allFilteredAssets.length}`);

    if (nextItemIndex < loadedStart || nextItemIndex >= loadedEnd || nextItemIndex >= totalAssets) {
      console.log(`⏸️ No loading item (out of range)`);
      return null;
    }

    const item = allFilteredAssets[nextItemIndex];
    if (!item) {
      console.log(`❌ Item #${nextItemIndex} is undefined in allFilteredAssets (length: ${allFilteredAssets.length})`);
      return null;
    }

    console.log(`🔄 Loading item #${nextItemIndex}: ${item.filename}`);
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
        {/* Sync with Drive Button */}
        <button
          onClick={syncWithDrive}
          className="p-2 text-white rounded hover:opacity-90 transition-opacity"
          style={getButtonStyle(lookAndFeel)}
          title="Sync with Google Drive"
          disabled={loadingDrive}
        >
          <RefreshCw size={20} className={loadingDrive ? 'animate-spin' : ''} />
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
            <div className="absolute bottom-16 right-0 bg-white rounded-lg shadow-xl p-4 text-xs text-gray-700 border border-gray-200 min-w-64">
              <div className="font-semibold mb-3 text-blue-600">Virtual Scrolling Info</div>
              <div className="mb-3 whitespace-nowrap">{debugInfo}</div>

              <div className="border-t border-gray-200 pt-3 mt-3">
                <div className="font-semibold mb-2 text-blue-600">Google Drive Status</div>
                {loadingDrive ? (
                  <div className="flex items-center gap-2 text-blue-600">
                    <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    <span>Loading assets from Drive...</span>
                  </div>
                ) : driveEnabled ? (
                  <div className="text-green-600">✓ Loaded {assets.length} assets</div>
                ) : (
                  <div className="text-yellow-600">Drive not connected - Click sync to connect</div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="max-w-7xl mx-auto">
          {/* Assets Grid */}
          {(viewMode === 'grid3' || viewMode === 'grid4') ? (
            <AssetsMasonryView
              gridRef={gridRef}
              columnItems={columnItems}
              columnCount={columnCount}
              containerHeight={containerHeight}
              loadedStart={loadedStart}
              loadedEnd={loadedEnd}
              itemPositions={itemPositions}
              onSelectAsset={setSelectedAsset}
              currentLoadingItem={currentLoadingItem}
              loadingImageRef={loadingImageRef}
              handleImageLoaded={handleImageLoaded}
              setNextItemIndex={setNextItemIndex}
            />
          ) : (
            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
              <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Asset</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Size</th>
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

                    {filteredAssets.map(asset => {
                      // For list view, skip placeholders (use spacers instead)
                      if (asset.isPlaceholder) {
                        return null;
                      }

                      const isVideo = asset.extension === 'mp4';
                      const isImage = ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'bmp'].includes(asset.extension?.toLowerCase());
                      const hasTransparency = ['png', 'svg'].includes(asset.extension?.toLowerCase());

                      // Checkerboard pattern for transparent images (PNG and SVG)
                      const checkerboardStyle = hasTransparency ? {
                        backgroundImage: `
                          linear-gradient(45deg, #ccc 25%, transparent 25%),
                          linear-gradient(-45deg, #ccc 25%, transparent 25%),
                          linear-gradient(45deg, transparent 75%, #ccc 75%),
                          linear-gradient(-45deg, transparent 75%, #ccc 75%)
                        `,
                        backgroundSize: '10px 10px',
                        backgroundPosition: '0 0, 0 5px, 5px -5px, -5px 0px'
                      } : {};

                      return (
                        <tr
                          key={asset.id}
                          className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                          onClick={() => setSelectedAsset(asset)}
                        >
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <div
                                className="w-16 h-16 bg-gray-100 rounded flex items-center justify-center overflow-hidden flex-shrink-0"
                                style={checkerboardStyle}
                              >
                                {isImage && <img src={asset.url} alt={asset.filename} className="w-full h-full object-cover" loading="lazy" style={{ display: 'block' }} />}
                                {isVideo && <video src={asset.url} className="w-full h-full object-cover" preload="metadata" />}
                                {!isImage && !isVideo && <ImageIcon size={24} className="text-gray-400" />}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="font-semibold text-base text-gray-900 truncate">{asset.filename}</p>
                                <p className="text-xs text-gray-500 truncate">
                                  {[asset.File_dimensions, asset.visual_keyword].filter(Boolean).join(' ') || '-'}
                                </p>
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
                            <div className="flex flex-wrap gap-1">
                              {asset.product && (
                                <span className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded text-xs font-medium">{asset.product}</span>
                              )}
                              {asset.type && (
                                <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs font-medium">{asset.type}</span>
                              )}
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

                    {/* Hidden loading row for sequential loading in list view */}
                    {viewMode === 'list' && currentLoadingItem && (() => {
                      const item = currentLoadingItem.item;
                      const itemIndex = currentLoadingItem.index;
                      const isVideo = item.extension === 'mp4';
                      const isImage = ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'bmp'].includes(item.extension?.toLowerCase());

                      return (
                        <tr style={{ position: 'absolute', visibility: 'hidden', pointerEvents: 'none' }}>
                          <td>
                            {isImage && (
                              <img
                                ref={loadingImageRef}
                                src={item.url}
                                alt=""
                                onLoad={(e) => handleImageLoaded(item, itemIndex, e)}
                                onError={(e) => handleImageLoaded(item, itemIndex, e)}
                                style={{ width: '1px', height: '1px' }}
                              />
                            )}
                            {isVideo && (
                              <video
                                ref={loadingImageRef}
                                src={item.url}
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
                    {loadedEnd < totalAssets && (
                      <tr>
                        <td colSpan="4" style={{ height: `${(totalAssets - loadedEnd) * 120}px`, padding: 0, border: 0 }}></td>
                      </tr>
                    )}
                  </tbody>
                </table>
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

      {/* _unused - Upload dialogs removed (upload functionality disabled) */}

      {/* Asset Preview */}
      <CreativePreview
        creative={selectedAsset}
        onClose={() => setSelectedAsset(null)}
        allCreatives={allFilteredAssets}
        onNavigate={setSelectedAsset}
      />

      {/* Sync Progress Overlay */}
      {syncProgress && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full">
            <div className="flex items-start gap-4">
              {/* Icon */}
              <div className="flex-shrink-0">
                {syncProgress.type === 'loading' && (
                  <Loader size={24} className="text-blue-600 animate-spin" />
                )}
                {syncProgress.type === 'success' && (
                  <CheckCircle size={24} className="text-green-600" />
                )}
                {syncProgress.type === 'error' && (
                  <AlertCircle size={24} className="text-red-600" />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-gray-900 mb-2">
                  {syncProgress.type === 'loading' && 'Syncing with Google Drive...'}
                  {syncProgress.type === 'success' && 'Sync Successful'}
                  {syncProgress.type === 'error' && 'Sync Failed'}
                </h3>
                <p className="text-sm text-gray-600 whitespace-pre-line">
                  {syncProgress.message}
                </p>
              </div>

              {/* Close button for error */}
              {syncProgress.type === 'error' && (
                <button
                  onClick={() => setSyncProgress(null)}
                  className="flex-shrink-0 text-gray-400 hover:text-gray-600"
                >
                  <X size={20} />
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Assets;
