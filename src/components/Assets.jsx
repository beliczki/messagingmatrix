import React, { useState, useEffect } from 'react';
import { Filter, Info, RefreshCw, Loader, CheckCircle, AlertCircle, X } from 'lucide-react';
import PageHeader, { getButtonStyle } from './PageHeader';
import CreativePreview from './CreativePreview';
import AssetsMasonryView from './AssetsMasonryView';
import MediaLibraryBase from './MediaLibraryBase';
import { loadDriveAssets, parseDriveAssetData, isDriveEnabled } from '../utils/driveAssets';

const Assets = ({ onMenuToggle, currentModuleName, lookAndFeel, matrixData }) => {
  // Get assets from matrixData (loaded from spreadsheet)
  const { assets: spreadsheetAssets, setAssets: setSpreadsheetAssets } = matrixData;
  const [assets, setAssets] = useState([]);
  const [driveEnabled, setDriveEnabled] = useState(false);
  const [loadingDrive, setLoadingDrive] = useState(false);
  const [syncProgress, setSyncProgress] = useState(null); // { type: 'loading' | 'success' | 'error', message: string }

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

      // Update spreadsheet
      setSpreadsheetAssets(updatedAssets);

      // Save to spreadsheet
      await matrixData.save(null, null, updatedAssets);

      setSyncProgress({
        type: 'success',
        message: `Successfully synced with Google Drive.\n\nAdded: ${newAssets.length} assets\nRemoved: ${deletedAssets.length} assets`
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

  // Check Drive on mount
  useEffect(() => {
    isDriveEnabled().then(enabled => setDriveEnabled(enabled));
  }, []);

  // Update assets when spreadsheetAssets changes
  useEffect(() => {
    console.log('📊 Assets - spreadsheetAssets changed:', spreadsheetAssets?.length || 0, 'items');
    setAssets(spreadsheetAssets || []);
  }, [spreadsheetAssets]);

  // Debug: log assets state
  useEffect(() => {
    console.log('📦 Assets - local assets state:', assets?.length || 0, 'items');
  }, [assets]);

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

  return (
    <>
      <MediaLibraryBase
        items={assets}
        lookAndFeel={lookAndFeel}
        currentModuleName={currentModuleName || 'Assets'}
        onMenuToggle={onMenuToggle}
        getItemId={(asset) => asset.ID}
        getItemExtension={(asset) => asset.File_format}
        getItemUrl={(asset) => {
          // Prefer proxy URL (works better than direct Google Drive links)
          if (asset.File_driveID) {
            const proxyUrl = `/api/drive/proxy/${asset.File_driveID}`;
            console.log(`📎 Asset ${asset.File_name}: using proxy URL ${proxyUrl}`);
            return proxyUrl;
          }
          console.log(`⚠️ Asset ${asset.File_name}: no File_driveID, using fallback URL`);
          return asset.File_DirectLink || asset.File_thumbnail;
        }}
        getItemFilename={(asset) => asset.File_name}

        // Custom header with Drive sync
        renderHeader={({ filterText, setFilterText, viewMode, setViewMode, viewModes, totalItems, filteredCount }) => (
          <PageHeader
            onMenuToggle={onMenuToggle}
            title={currentModuleName || 'Assets'}
            lookAndFeel={lookAndFeel}
            viewMode={viewMode}
            setViewMode={setViewMode}
            viewModes={viewModes}
            titleFilters={
              <div className="flex items-center gap-2">
                <Filter size={18} className="text-white" />
                <input
                  type="text"
                  value={filterText}
                  onChange={(e) => setFilterText(e.target.value)}
                  placeholder="Filter assets (use AND/OR operators)..."
                  className="w-64 px-3 py-2 border border-white/20 rounded bg-white/10 text-white placeholder-white/60 focus:ring-2 focus:ring-white/30 focus:border-white/30 focus:bg-white/20"
                />
              </div>
            }
          >
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

export default Assets;
