import React from 'react';
import AssetItem from './AssetItem';

const AssetsMasonryView = ({
  gridRef,
  columnItems,
  columnCount,
  containerHeight,
  loadedStart,
  loadedEnd,
  itemPositions,
  onSelectAsset,
  currentLoadingItem,
  loadingImageRef,
  handleImageLoaded,
  setNextItemIndex,
  getItemId = (item) => item.id || item.ID,
  getItemExtension = (item) => item.extension || item.File_format,
  getItemUrl = (item) => item.url || item.File_DirectLink || item.File_thumbnail
}) => {
  return (
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
              const itemId = getItemId(asset);
              const isOutsideRange = asset.originalIndex < loadedStart || asset.originalIndex >= loadedEnd;
              const savedHeight = itemPositions.current.get(itemId)?.height || 300;

              // Transform asset to include expected properties for AssetItem
              const transformedAsset = {
                ...asset,
                id: itemId,
                url: getItemUrl(asset),
                filename: asset.File_name || asset.filename,
                extension: getItemExtension(asset)
              };

              return (
                <AssetItem
                  key={itemId}
                  asset={transformedAsset}
                  onSelect={onSelectAsset}
                  isOutsideRange={isOutsideRange}
                  savedHeight={savedHeight}
                />
              );
            })}

            {/* Render the currently-loading item (hidden, just for loading) - sequential for masonry */}
            {currentLoadingItem && columnIndex === 0 && (() => {
              const item = currentLoadingItem.item;
              const itemIndex = currentLoadingItem.index;
              const extension = getItemExtension(item);
              const url = getItemUrl(item);
              const isVideo = extension === 'mp4';
              const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(extension?.toLowerCase());

              // Skip if no valid URL
              if (!url) {
                console.warn(`⚠️ Skipping item with no URL #${itemIndex}: ${item.File_name || item.filename}`);
                setTimeout(() => setNextItemIndex(itemIndex + 1), 0);
                return null;
              }

              // Skip non-image/non-video files
              if (!isImage && !isVideo) {
                console.warn(`⚠️ Skipping non-media file #${itemIndex}: ${item.File_name || item.filename} (${extension})`);
                setTimeout(() => setNextItemIndex(itemIndex + 1), 0);
                return null;
              }

              console.log(`🔄 Loading image for #${itemIndex}: ${item.File_name || item.filename}, URL: ${url?.substring(0, 100)}...`);

              return (
                <div key={`loader-${itemIndex}`} style={{position: 'absolute', left: '-9999px', width: '200px'}}>
                  {isImage && (
                    <img
                      src={url}
                      alt="loading"
                      onLoad={(e) => {
                        handleImageLoaded(item, itemIndex, e);
                      }}
                      onError={(e) => {
                        console.error(`❌ onError fired for ${item.File_name || item.filename}`, e);
                        // Still add the item to the grid with a default height, even if image fails
                        const fakeEvent = {
                          target: {
                            naturalWidth: 300,
                            naturalHeight: 200
                          }
                        };
                        handleImageLoaded(item, itemIndex, fakeEvent);
                      }}
                    />
                  )}
                  {isVideo && (
                    <video
                      src={url}
                      onLoadedMetadata={(e) => {
                        handleImageLoaded(item, itemIndex, e);
                      }}
                      onError={(e) => {
                        console.error(`❌ onError fired for ${item.File_name || item.filename}`, e);
                        // Still add the item to the grid with a default height, even if video fails
                        const fakeEvent = {
                          target: {
                            videoWidth: 640,
                            videoHeight: 360
                          }
                        };
                        handleImageLoaded(item, itemIndex, fakeEvent);
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
  );
};

export default AssetsMasonryView;
