import React, { useState, useEffect, useCallback } from 'react';
import { ImageIcon, Filter, CheckSquare, Square, Share2, Upload, Info, RefreshCw, Loader, CheckCircle, AlertCircle, X } from 'lucide-react';
import PageHeader, { getButtonStyle } from './PageHeader';
import CreativeShare from './CreativeShare';
import CreativePreview from './CreativePreview';
import CreativeLibraryMasonryView from './CreativeLibraryMasonryView';
import CreativeLibraryListView from './CreativeLibraryListView';
import CreativeLibraryUploadDialogs from './CreativeLibraryUploadDialogs';
import MediaLibraryBase from './MediaLibraryBase';
import { processAssets } from '../utils/assetUtils';
import { loadDriveAssets, isDriveEnabled, parseDriveAssetData } from '../utils/driveAssets';
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
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState([]);
  const [uploadProgress, setUploadProgress] = useState({});
  const [pendingUploads, setPendingUploads] = useState([]);
  const [showMetadataDialog, setShowMetadataDialog] = useState(false);
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
  const [driveEnabled, setDriveEnabled] = useState(false);
  const [loadingDrive, setLoadingDrive] = useState(false);
  const [syncProgress, setSyncProgress] = useState(null); // { type: 'loading' | 'success' | 'error', message: string }
  const [hasAutoSynced, setHasAutoSynced] = useState(false);

  // MC Template supported banner sizes (from src/templates/html/*.css)
  const bannerSizes = [
    { width: 300, height: 250, name: 'Medium Rectangle' },
    { width: 300, height: 600, name: 'Half Page' },
    { width: 970, height: 250, name: 'Billboard' },
    { width: 1080, height: 1080, name: 'Social Square' },
    { width: 640, height: 360, name: 'Social Video' }
  ];

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

  // Check Drive on mount
  useEffect(() => {
    isDriveEnabled().then(enabled => {
      setDriveEnabled(enabled);
    });
  }, []);

  // Auto-sync with Drive on mount if enabled (only once)
  useEffect(() => {
    if (driveEnabled && matrixData && !hasAutoSynced) {
      setHasAutoSynced(true);
      syncWithDrive();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driveEnabled, matrixData, hasAutoSynced]);

  // Sync with Google Drive
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
      setSyncProgress({ type: 'loading', message: 'Loading creatives from Drive...' });

      // Load all files from Drive
      const driveData = await loadDriveAssets('creatives', { pageSize: 1000 });
      const driveFiles = driveData.files;

      // Get current spreadsheet File_driveIDs from matrixData.creatives
      const spreadsheetCreatives = matrixData?.creatives || [];
      const spreadsheetDriveIds = new Set(
        spreadsheetCreatives.map(creative => creative.File_driveID).filter(id => id)
      );

      // Find new creatives (in Drive but not in spreadsheet)
      const newCreatives = driveFiles.filter(file => !spreadsheetDriveIds.has(file.id));

      // Find deleted creatives (in spreadsheet but not in Drive)
      const driveDriveIds = new Set(driveFiles.map(file => file.id));
      const deletedCreatives = spreadsheetCreatives.filter(
        creative => creative.File_driveID && !driveDriveIds.has(creative.File_driveID)
      );

      console.log(`🔄 Sync results: ${newCreatives.length} new, ${deletedCreatives.length} deleted`);

      // If no changes, just inform user
      if (newCreatives.length === 0 && deletedCreatives.length === 0) {
        setSyncProgress({
          type: 'success',
          message: 'Spreadsheet is up to date with Google Drive. No changes found.'
        });
        setLoadingDrive(false);
        setTimeout(() => setSyncProgress(null), 3000);
        return;
      }

      setSyncProgress({ type: 'loading', message: 'Updating spreadsheet...' });

      // Update spreadsheet with changes
      let updatedCreatives = [...spreadsheetCreatives];

      // Remove deleted creatives
      if (deletedCreatives.length > 0) {
        const deletedIds = new Set(deletedCreatives.map(c => c.File_driveID));
        updatedCreatives = updatedCreatives.filter(creative => !deletedIds.has(creative.File_driveID));
      }

      // Add new creatives with incremental IDs
      if (newCreatives.length > 0) {
        const maxId = Math.max(0, ...updatedCreatives.map(c => parseInt(c.ID) || 0));
        const parsedNewCreatives = newCreatives.map((file, index) => {
          const parsedData = parseDriveAssetData(file);

          // Check if this is an HTML creative
          const isHtml = parsedData.extension === 'html';
          let bannerSize = null;
          if (isHtml) {
            const sizeMatch = file.name.match(/(\d+)x(\d+)/);
            if (sizeMatch) {
              bannerSize = {
                width: parseInt(sizeMatch[1]),
                height: parseInt(sizeMatch[2])
              };
            }
          }

          return {
            ID: maxId + index + 1,
            Brand: parsedData.Brand || '',
            Product: parsedData.Product || '',
            Copy_keyword: '',
            Visual_keyword: parsedData.Visual_keyword || '',
            Template: '',
            Version: parsedData.Version || '',
            File_format: parsedData.extension || '',
            File_driveID: file.id || '',
            File_name: parsedData.filename || '',
            File_size: parsedData.size || '',
            File_date: parsedData.File_date || '',
            File_dimensions: parsedData.File_dimensions || (bannerSize ? `${bannerSize.width}x${bannerSize.height}` : ''),
            File_DirectLink: parsedData.File_DirectLink || '',
            File_thumbnail: parsedData.thumbnail || '',
            Comment: ''
          };
        });

        updatedCreatives = [...updatedCreatives, ...parsedNewCreatives];
      }

      // Update spreadsheet
      matrixData.setCreatives(updatedCreatives);

      // Save to spreadsheet
      await matrixData.save(null, null, null, updatedCreatives);

      setSyncProgress({
        type: 'success',
        message: `Successfully synced with Google Drive.\n\nAdded: ${newCreatives.length} creatives\nRemoved: ${deletedCreatives.length} creatives`
      });

      // Auto-dismiss after 3 seconds
      setTimeout(() => setSyncProgress(null), 3000);

    } catch (err) {
      console.error('Drive sync error:', err);
      setSyncProgress({
        type: 'error',
        message: `Failed to sync with Google Drive:\n${err.message}`
      });
    } finally {
      setLoadingDrive(false);
    }
  };

  // Load creatives
  const loadCreatives = useCallback(async () => {
    const assetModules = import.meta.glob('/src/creatives/*.*', { eager: true, as: 'url' });
    const creativeList = await processAssets(assetModules);

    // Transform spreadsheet creatives from matrixData.creatives to display format
    const spreadsheetCreatives = (matrixData?.creatives || []).map(creative => {
      // Check if this is an HTML creative
      const isHtml = creative.File_format === 'html';
      let bannerSize = null;
      if (isHtml && creative.File_dimensions) {
        const match = creative.File_dimensions.match(/(\d+)x(\d+)/);
        if (match) {
          bannerSize = {
            width: parseInt(match[1]),
            height: parseInt(match[2])
          };
        }
      }

      return {
        id: creative.File_driveID || creative.ID,
        filename: creative.File_name,
        extension: creative.File_format,
        url: creative.File_driveID ? `/api/drive/proxy/${creative.File_driveID}` : creative.File_DirectLink,
        product: creative.Product || creative.File_name,
        size: creative.File_dimensions || '',
        date: creative.File_date || '',
        platforms: [],
        tags: [],
        isDynamic: false,
        bannerSize: bannerSize,
        driveId: creative.File_driveID,
        source: 'drive'
      };
    });

    // Generate dynamic message creatives for ALL messages if matrixData is available
    if (matrixData?.messages && matrixData.messages.length > 0) {
      const activeMessages = matrixData.messages.filter(m => m.status !== 'deleted');

      if (activeMessages.length > 0) {
        // Deduplicate messages by number+variant combination
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

        setCreatives([...allMessageCreatives, ...spreadsheetCreatives, ...creativeList]);
        return;
      }
    }

    setCreatives([...spreadsheetCreatives, ...creativeList]);
  }, [matrixData]);

  useEffect(() => {
    loadCreatives();
  }, [loadCreatives]);

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

  return (
    <>
      <MediaLibraryBase
        items={creatives}
        lookAndFeel={lookAndFeel}
        currentModuleName={currentModuleName || 'Creative Library'}
        onMenuToggle={onMenuToggle}
        getItemId={(creative) => creative.id}
        getItemExtension={(creative) => creative.extension}
        getItemUrl={(creative) => creative.url}
        getItemFilename={(creative) => creative.filename}

        // Custom header with selector mode, share, and upload
        renderHeader={({ filterText, setFilterText, viewMode, setViewMode, viewModes, totalItems, filteredCount }) => {
          const allFilteredCreatives = creatives; // Will be filtered by MediaLibraryBase

          return (
            <PageHeader
              onMenuToggle={onMenuToggle}
              title={currentModuleName || 'Creative Library'}
              lookAndFeel={lookAndFeel}
              viewMode={viewMode}
              setViewMode={setViewMode}
              viewModes={viewModes}
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
                          // MediaLibraryBase will provide filteredCount, but we need the actual items
                          // We'll select all current creatives for now
                          const allIds = new Set(creatives.map(c => c.id));
                          setSelectedCreativeIds(allIds);
                        }}
                        className="px-4 py-2 bg-white/10 text-white rounded hover:bg-white/20 transition-colors"
                      >
                        All ({filteredCount})
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
          );
        }}

        // Custom masonry view using CreativeLibraryMasonryView
        renderMasonryView={({
          gridRef,
          columnItems,
          columnCount,
          containerHeight,
          loadedStart,
          loadedEnd,
          itemPositions,
          onSelectItem,
          currentLoadingItem,
          loadingImageRef,
          handleImageLoaded,
          setNextItemIndex
        }) => (
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
            onSelectCreative={onSelectItem}
            currentLoadingItem={currentLoadingItem}
            loadingImageRef={loadingImageRef}
            handleImageLoaded={handleImageLoaded}
            setNextItemIndex={setNextItemIndex}
            templateHtml={templateHtml}
            templateConfig={templateConfig}
            templateCss={templateCss}
          />
        )}

        // Custom list view (note: MediaLibraryBase expects renderListItem, not a full view component)
        // For now we'll render null and handle list view separately
        renderListItem={null}

        // Custom preview using CreativePreview
        renderPreview={(selectedCreative, onClose, allFilteredCreatives, onNavigate) => (
          <CreativePreview
            creative={selectedCreative}
            onClose={onClose}
            templateHtml={templateHtml}
            templateConfig={templateConfig}
            templateCss={templateCss}
            allCreatives={allFilteredCreatives}
            onNavigate={onNavigate}
          />
        )}

        // Custom floating actions
        renderFloatingActions={({ showDebugInfo, setShowDebugInfo, debugInfo }) => (
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

            {showDebugInfo && (
              <div className="absolute bottom-16 right-0 bg-white rounded-lg shadow-xl p-4 text-xs text-gray-700 whitespace-nowrap border border-gray-200">
                <div className="font-semibold mb-2 text-blue-600">Virtual Scrolling Info</div>
                <div>{debugInfo}</div>
              </div>
            )}
          </div>
        )}
      />

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
        selectedCreatives={creatives.filter(c => selectedCreativeIds.has(c.id))}
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
    </>
  );
};

export default CreativeLibrary;
