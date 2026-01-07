import React, { useState, useEffect, useMemo } from 'react';
import { Info, Loader, CheckCircle, AlertCircle } from 'lucide-react';
import AIAssistant from './AIAssistant';
import MatrixStatePanel from './MatrixStatePanel';
import CreativePreview from './CreativePreview';
import AssetsMasonryView from './AssetsMasonryView';
import MediaLibraryBase from './MediaLibraryBase';
import MediaToolbar from './MediaToolbar';
import { loadDriveAssets, parseDriveAssetData, isDriveEnabled } from '../utils/driveAssets';
import { clearAndReloadApp } from '../utils/clearAndReload';
import settings from '../services/settings';

const Assets = ({ onMenuToggle, currentModuleName, lookAndFeel, matrixData }) => {
  // Get assets from matrixData (loaded from spreadsheet)
  const { assets: spreadsheetAssets, setAssets: setSpreadsheetAssets } = matrixData;
  const [assets, setAssets] = useState([]);
  const [filteredAssets, setFilteredAssets] = useState([]);
  const [driveEnabled, setDriveEnabled] = useState(false);
  const [loadingDrive, setLoadingDrive] = useState(false);
  const [syncProgress, setSyncProgress] = useState(null); // { type: 'loading' | 'success' | 'error', message: string }
  const [saveProgress, setSaveProgress] = useState(null); // { step: number, message: string }
  const [assetsFolderId, setAssetsFolderId] = useState(null);

  // Selection mode state
  const [selectorMode, setSelectorMode] = useState(false);
  const [selectedAssetIds, setSelectedAssetIds] = useState(new Set());

  // Filter states (persisted to localStorage)
  const [productFilter, setProductFilter] = useState(() => {
    const saved = localStorage.getItem('assets_productFilter');
    return saved ? JSON.parse(saved) : [];
  });
  const [typeFilter, setTypeFilter] = useState(() => {
    const saved = localStorage.getItem('assets_typeFilter');
    return saved ? JSON.parse(saved) : [];
  });
  const [formatFilter, setFormatFilter] = useState(() => {
    const saved = localStorage.getItem('assets_formatFilter');
    return saved ? JSON.parse(saved) : [];
  });
  const [sizeFilter, setSizeFilter] = useState(() => {
    const saved = localStorage.getItem('assets_sizeFilter');
    return saved ? JSON.parse(saved) : [];
  });

  // Background color state
  const [bgColor, setBgColor] = useState(() => {
    const saved = localStorage.getItem('assets_bgColor');
    return saved || lookAndFeel?.headerColor || '#2870ed';
  });

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
      setSyncProgress({ type: 'loading', message: 'Loading assets from Drive...' });

      // Load all files from Drive
      const driveData = await loadDriveAssets('assets', { pageSize: 1000 });
      const driveFiles = driveData.files;

      // Debug: Log all files found in Drive
      console.log(`📂 Drive files found: ${driveFiles.length}`);
      console.log('📂 Has more pages:', !!driveData.nextPageToken);
      console.log('📂 Drive file names:', driveFiles.map(f => f.name));

      // Check specifically for empty.mp4
      const emptyMp4 = driveFiles.find(f => f.name.toLowerCase().includes('empty'));
      if (emptyMp4) {
        console.log('✅ Found empty.mp4:', emptyMp4);
      } else {
        console.log('❌ empty.mp4 NOT found in Drive response');
      }

      // Get current spreadsheet File_driveIDs
      const spreadsheetDriveIds = new Set(
        (spreadsheetAssets || []).map(asset => asset.File_driveID).filter(id => id)
      );
      console.log(`📋 Spreadsheet assets: ${spreadsheetAssets?.length || 0}, with DriveIDs: ${spreadsheetDriveIds.size}`);

      // Find new assets (in Drive but not in spreadsheet)
      const newAssets = driveFiles.filter(file => !spreadsheetDriveIds.has(file.id));

      // Find deleted assets (in spreadsheet but not in Drive)
      const driveDriveIds = new Set(driveFiles.map(file => file.id));
      const deletedAssets = (spreadsheetAssets || []).filter(
        asset => asset.File_driveID && !driveDriveIds.has(asset.File_driveID)
      );

      console.log(`🔄 Sync results: ${newAssets.length} new, ${deletedAssets.length} deleted`);
      if (newAssets.length > 0) {
        console.log('🆕 New assets:', newAssets.map(f => f.name));
      }
      if (deletedAssets.length > 0) {
        console.log('🗑️ Deleted assets:', deletedAssets.map(a => a.File_name));
      }

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
        const maxId = Math.max(0, ...updatedAssets.map(a => parseInt(a.ID) || 0));
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

      // Update local state
      setSpreadsheetAssets(updatedAssets);

      // Check if matrix data is loaded before saving to spreadsheet
      const canSave = (matrixData.audiences?.length > 0) ||
                      (matrixData.topics?.length > 0) ||
                      (matrixData.messages?.length > 0);

      if (canSave) {
        // Save to spreadsheet
        await matrixData.save(null, null, updatedAssets);
      } else {
        console.warn('⚠️ Matrix data not loaded - assets updated locally but not saved to spreadsheet');
      }

      const savedNote = canSave ? '' : '\n\n⚠️ Note: Changes not saved to spreadsheet (no matrix data loaded)';
      setSyncProgress({
        type: 'success',
        message: `Successfully synced with Google Drive.\n\nAdded: ${newAssets.length} assets\nRemoved: ${deletedAssets.length} assets${savedNote}`
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

  // Check Drive on mount and load folder ID
  useEffect(() => {
    const loadDriveConfig = async () => {
      const enabled = await isDriveEnabled();
      setDriveEnabled(enabled);

      // Load folder ID from settings
      await settings.ensureInitialized();
      const driveConfig = settings.get('googleDrive') || {};
      setAssetsFolderId(driveConfig.assetsFolderId || null);
    };
    loadDriveConfig();
  }, []);

  // Save filters to localStorage
  useEffect(() => {
    localStorage.setItem('assets_productFilter', JSON.stringify(productFilter));
  }, [productFilter]);

  useEffect(() => {
    localStorage.setItem('assets_typeFilter', JSON.stringify(typeFilter));
  }, [typeFilter]);

  useEffect(() => {
    localStorage.setItem('assets_formatFilter', JSON.stringify(formatFilter));
  }, [formatFilter]);

  useEffect(() => {
    localStorage.setItem('assets_sizeFilter', JSON.stringify(sizeFilter));
  }, [sizeFilter]);

  useEffect(() => {
    localStorage.setItem('assets_bgColor', bgColor);
  }, [bgColor]);

  // Update assets when spreadsheetAssets changes
  useEffect(() => {
    console.log('📊 Assets - spreadsheetAssets changed:', spreadsheetAssets?.length || 0, 'items');
    setAssets(spreadsheetAssets || []);
  }, [spreadsheetAssets]);

  // Debug: log assets state
  useEffect(() => {
    console.log('📦 Assets - local assets state:', assets?.length || 0, 'items');
  }, [assets]);

  // Get unique products from assets
  const availableProducts = useMemo(() => {
    const products = new Set();
    assets.forEach(asset => {
      if (asset.Product && asset.Product.trim()) {
        products.add(asset.Product);
      }
    });
    return Array.from(products).sort();
  }, [assets]);

  // Get unique types from assets
  const availableTypes = useMemo(() => {
    const types = new Set();
    assets.forEach(asset => {
      if (asset.Type && asset.Type.trim()) {
        types.add(asset.Type);
      }
    });
    return Array.from(types).sort();
  }, [assets]);

  // Get unique formats from assets
  const availableFormats = useMemo(() => {
    const formats = new Set();
    assets.forEach(asset => {
      if (asset.File_format && asset.File_format.trim()) {
        formats.add(asset.File_format.toLowerCase());
      }
    });
    return Array.from(formats).sort();
  }, [assets]);

  // Get unique sizes (dimensions) from assets
  const availableSizes = useMemo(() => {
    const sizes = new Set();
    assets.forEach(asset => {
      if (asset.File_dimensions && asset.File_dimensions.trim()) {
        sizes.add(asset.File_dimensions);
      }
    });
    return Array.from(sizes).sort((a, b) => {
      // Sort by width (first number in WxH format)
      const aWidth = parseInt(a.split('x')[0]) || 0;
      const bWidth = parseInt(b.split('x')[0]) || 0;
      return aWidth - bWidth;
    });
  }, [assets]);

  // Filter assets based on filters
  const filteredByFilters = useMemo(() => {
    return assets.filter(asset => {
      // Product filter
      if (productFilter.length > 0) {
        if (!asset.Product || !productFilter.includes(asset.Product)) {
          return false;
        }
      }

      // Type filter (uses Type column)
      if (typeFilter.length > 0) {
        if (!asset.Type || !typeFilter.includes(asset.Type)) {
          return false;
        }
      }

      // Size filter (dimensions like 300x250)
      if (sizeFilter.length > 0) {
        if (!asset.File_dimensions || !sizeFilter.includes(asset.File_dimensions)) {
          return false;
        }
      }

      return true;
    });
  }, [assets, productFilter, typeFilter, sizeFilter]);

  // Selection handlers
  const toggleAssetSelection = (assetId, enableSelectorMode = false) => {
    if (enableSelectorMode && !selectorMode) {
      setSelectorMode(true);
    }

    const newSelection = new Set(selectedAssetIds);
    if (newSelection.has(assetId)) {
      newSelection.delete(assetId);
    } else {
      newSelection.add(assetId);
    }
    setSelectedAssetIds(newSelection);
  };

  // Checkerboard pattern for transparency
  const checkerboardStyle = {
    backgroundImage: `
      linear-gradient(45deg, #ccc 25%, transparent 25%),
      linear-gradient(-45deg, #ccc 25%, transparent 25%),
      linear-gradient(45deg, transparent 75%, #ccc 75%),
      linear-gradient(-45deg, transparent 75%, #ccc 75%)
    `,
    backgroundSize: '10px 10px',
    backgroundPosition: '0 0, 0 5px, 5px -5px, -5px 0px'
  };

  // Save with progress tracking
  const handleSaveWithProgress = async () => {
    const steps = [
      'Preparing data for save...',
      'Saving assets to spreadsheet...',
      'Finalizing save operation...',
      'Save complete!'
    ];

    try {
      for (let i = 0; i < steps.length; i++) {
        setSaveProgress({ step: i + 1, total: steps.length, message: steps[i] });

        // Small delay to show each step
        await new Promise(resolve => setTimeout(resolve, 300));

        // Actually save on step 1 (after "Preparing data")
        if (i === 0) {
          await matrixData.save(null, null, spreadsheetAssets);
        }
      }

      // Keep success message visible for a moment
      await new Promise(resolve => setTimeout(resolve, 1000));
      setSaveProgress(null);
    } catch (error) {
      setSaveProgress({
        step: 0,
        total: steps.length,
        message: `Error: ${error.message}`,
        error: true
      });

      // Show error for 3 seconds
      await new Promise(resolve => setTimeout(resolve, 3000));
      setSaveProgress(null);
    }
  };

  return (
    <div className="matrix-fullscreen" style={{ backgroundColor: 'var(--color-primary)' }}>
      <div className="matrix-view-container" style={{ backgroundColor: 'transparent' }}>
        <MediaLibraryBase
        items={filteredByFilters}
        lookAndFeel={lookAndFeel}
        currentModuleName={currentModuleName || 'Assets'}
        onMenuToggle={onMenuToggle}
        onFilteredItemsChange={setFilteredAssets}
        getItemId={(asset) => asset.ID}
        getItemExtension={(asset) => asset.File_format}
        getItemUrl={(asset) => {
          // Prefer proxy URL (works better than direct Google Drive links)
          if (asset.File_driveID) {
            return `/api/drive/proxy/${asset.File_driveID}`;
          }
          return asset.File_DirectLink || asset.File_thumbnail;
        }}
        getItemFilename={(asset) => asset.File_name}

        // No header - just toolbar
        renderHeader={({ filterText, setFilterText, viewMode, setViewMode, viewModes, totalItems, filteredCount }) => (
          <MediaToolbar
            filterText={filterText}
            setFilterText={setFilterText}
            productFilter={productFilter}
            setProductFilter={setProductFilter}
            typeFilter={typeFilter}
            setTypeFilter={setTypeFilter}
            sizeFilter={sizeFilter}
            setSizeFilter={setSizeFilter}
            availableProducts={availableProducts}
            typeOptions={availableTypes}
            availableSizes={availableSizes}
            filteredCount={filteredCount}
            totalCount={totalItems}
            viewMode={viewMode}
            setViewMode={setViewMode}
            // Selection props
            selectorMode={selectorMode}
            selectedCount={selectedAssetIds.size}
            onEnterSelectMode={() => setSelectorMode(true)}
            onSelectAll={() => {
              // Select all filtered assets
              const allIds = new Set(filteredAssets.map(a => a.ID));
              setSelectedAssetIds(allIds);
            }}
            onDeselectAll={() => setSelectedAssetIds(new Set())}
            onExitSelection={() => {
              setSelectorMode(false);
              setSelectedAssetIds(new Set());
            }}
            // Color picker props
            bgColor={bgColor}
            setBgColor={setBgColor}
            colorPresets={[
              lookAndFeel?.headerColor || '#2870ed',
              lookAndFeel?.secondaryColor1 || '#eb4c79',
              lookAndFeel?.secondaryColor2 || '#02a3a4',
              lookAndFeel?.secondaryColor3 || '#711c7a'
            ]}
          />
        )}

        // Custom masonry view using AssetsMasonryView
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
          setNextItemIndex,
          getItemId,
          getItemExtension,
          getItemUrl
        }) => (
          <AssetsMasonryView
            gridRef={gridRef}
            columnItems={columnItems}
            columnCount={columnCount}
            containerHeight={containerHeight}
            loadedStart={loadedStart}
            loadedEnd={loadedEnd}
            itemPositions={itemPositions}
            onSelectAsset={onSelectItem}
            currentLoadingItem={currentLoadingItem}
            loadingImageRef={loadingImageRef}
            handleImageLoaded={handleImageLoaded}
            setNextItemIndex={setNextItemIndex}
            getItemId={getItemId}
            getItemExtension={getItemExtension}
            getItemUrl={getItemUrl}
          />
        )}

        // Custom list view rows
        renderListItem={(asset) => {
          // Use proxy URL for thumbnails
          const thumbnailUrl = asset.File_driveID
            ? `/api/drive/proxy/${asset.File_driveID}`
            : (asset.File_DirectLink || asset.File_thumbnail);

          return (
            <>
              <td className="py-3 px-4">
                <div className="flex items-center gap-3">
                  <div
                    className="w-16 h-16 bg-gray-100 rounded flex items-center justify-center overflow-hidden flex-shrink-0"
                    style={checkerboardStyle}
                  >
                    {asset.File_format === 'mp4' ? (
                      <video
                        src={thumbnailUrl}
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <img
                        src={thumbnailUrl}
                        alt={asset.File_name}
                        className="w-full h-full object-contain"
                      />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium text-gray-900 truncate">{asset.File_name}</div>
                    {asset.Visual_keyword && (
                      <div className="text-sm text-gray-500">{asset.Visual_keyword}</div>
                    )}
                  </div>
                </div>
              </td>
              <td className="py-3 px-4 text-sm text-gray-700">{asset.File_size}</td>
              <td className="py-3 px-4 text-sm text-gray-500">{asset.File_date}</td>
              <td className="py-3 px-4">
                <div className="flex flex-wrap gap-1">
                  {[asset.Brand, asset.Product, asset.Type]
                    .filter(tag => tag)
                    .map((tag, i) => (
                      <span
                        key={i}
                        className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded"
                      >
                        {tag}
                      </span>
                    ))}
                </div>
              </td>
            </>
          );
        }}

        // Custom preview using CreativePreview
        renderPreview={(selectedAsset, onClose, allFilteredAssets, onNavigate) => {
          if (!selectedAsset) return null;

          // Transform asset to match CreativePreview's expected format
          const transformedAsset = {
            ...selectedAsset,
            id: selectedAsset.ID,
            url: selectedAsset.File_driveID
              ? `/api/drive/proxy/${selectedAsset.File_driveID}`
              : (selectedAsset.File_DirectLink || selectedAsset.File_thumbnail),
            filename: selectedAsset.File_name,
            extension: selectedAsset.File_format
          };

          // Transform all assets for navigation
          const transformedAssets = allFilteredAssets.map(asset => ({
            ...asset,
            id: asset.ID,
            url: asset.File_driveID
              ? `/api/drive/proxy/${asset.File_driveID}`
              : (asset.File_DirectLink || asset.File_thumbnail),
            filename: asset.File_name,
            extension: asset.File_format
          }));

          return (
            <CreativePreview
              creative={transformedAsset}
              onClose={onClose}
              allCreatives={transformedAssets}
              onNavigate={(navigatedAsset) => {
                // Find the original asset and transform it
                const originalAsset = allFilteredAssets.find(a => a.ID === navigatedAsset.ID);
                if (originalAsset) {
                  const transformed = {
                    ...originalAsset,
                    id: originalAsset.ID,
                    url: originalAsset.File_driveID
                      ? `/api/drive/proxy/${originalAsset.File_driveID}`
                      : (originalAsset.File_DirectLink || originalAsset.File_thumbnail),
                    filename: originalAsset.File_name,
                    extension: originalAsset.File_format
                  };
                  onNavigate(transformed);
                }
              }}
            />
          );
        }}

        // Custom floating actions with Drive status
        renderFloatingActions={({ showDebugInfo, setShowDebugInfo, debugInfo, totalItems }) => (
          <div className="fixed bottom-[68px] right-8 z-40">
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
              <div className="absolute bottom-16 right-0 bg-white rounded-lg shadow-xl p-4 text-xs text-gray-700 border border-gray-200 min-w-64">
                {/* Drive Sync Status */}
                {syncProgress && (
                  <div className="mb-4 pb-4 border-b border-gray-200">
                    <div className="font-semibold mb-2 flex items-center gap-2">
                      {syncProgress.type === 'loading' && (
                        <Loader size={16} className="text-blue-600 animate-spin" />
                      )}
                      {syncProgress.type === 'success' && (
                        <CheckCircle size={16} className="text-green-600" />
                      )}
                      {syncProgress.type === 'error' && (
                        <AlertCircle size={16} className="text-red-600" />
                      )}
                      <span className={
                        syncProgress.type === 'loading' ? 'text-blue-600' :
                        syncProgress.type === 'success' ? 'text-green-600' :
                        'text-red-600'
                      }>
                        {syncProgress.type === 'loading' && 'Syncing with Drive...'}
                        {syncProgress.type === 'success' && 'Sync Successful'}
                        {syncProgress.type === 'error' && 'Sync Failed'}
                      </span>
                    </div>
                    <div className="text-gray-600 whitespace-pre-line">{syncProgress.message}</div>
                    {syncProgress.type === 'error' && (
                      <button
                        onClick={() => setSyncProgress(null)}
                        className="mt-2 text-xs text-red-600 hover:text-red-700 underline"
                      >
                        Dismiss
                      </button>
                    )}
                  </div>
                )}

                {/* Virtual Scrolling Info */}
                <div className="font-semibold mb-3 text-blue-600">Virtual Scrolling Info</div>
                <div className="mb-3 whitespace-nowrap">{debugInfo}</div>

                {/* Google Drive Status */}
                <div className="border-t border-gray-200 pt-3 mt-3">
                  <div className="font-semibold mb-2 text-blue-600">Google Drive Status</div>
                  {loadingDrive ? (
                    <div className="flex items-center gap-2 text-blue-600">
                      <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                      <span>Loading assets from Drive...</span>
                    </div>
                  ) : driveEnabled ? (
                    <div className="text-green-600">✓ Loaded {totalItems} assets</div>
                  ) : (
                    <div className="text-yellow-600">Drive not connected - Click sync to connect</div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
        />
      </div>

      {/* Bottom Bar */}
      <div className="bottom-bar">
        <MatrixStatePanel
          audiences={matrixData?.audiences || []}
          topics={matrixData?.topics || []}
          messages={matrixData?.messages || []}
          keywords={matrixData?.keywords || {}}
          assets={spreadsheetAssets || []}
          creatives={matrixData?.creatives || []}
          textFormatting={matrixData?.textFormatting || []}
          feedData={[]}
          lastSync={matrixData?.lastSync}
          isSaving={matrixData?.isSaving}
          saveProgress={saveProgress}
          onSave={handleSaveWithProgress}
          onClearReload={clearAndReloadApp}
          onRegenerateTopicKeys={matrixData?.regenerateTopicKeys}
          downloadFeedCSV={() => {}}
          changeTracking={matrixData?.changeTracking}
          originalState={matrixData?.originalState}
          // Drive sync props
          assetsFolderId={assetsFolderId}
          onSyncAssets={syncWithDrive}
          syncingAssets={loadingDrive}
        />
        <AIAssistant
          moduleContext={{ module: 'assets' }}
          matrixData={matrixData}
          filteredItems={filteredAssets}
          getItemUrl={(asset) => {
            if (asset.File_driveID) {
              return `/api/drive/proxy/${asset.File_driveID}`;
            }
            return asset.File_DirectLink || asset.File_thumbnail;
          }}
        />
      </div>
    </div>
  );
};

export default Assets;
