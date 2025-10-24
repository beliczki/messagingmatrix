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
  setNextItemIndex
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
              const isOutsideRange = asset.originalIndex < loadedStart || asset.originalIndex >= loadedEnd;
              const savedHeight = itemPositions.current.get(asset.id)?.height || 300;

              return (
                <AssetItem
                  key={asset.id}
                  asset={asset}
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
              const isVideo = item.extension === 'mp4';
              const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(item.extension?.toLowerCase());

              // Skip non-image/non-video files
              if (!isImage && !isVideo) {
                console.warn(`⚠️ Skipping non-media file #${itemIndex}: ${item.filename} (${item.extension})`);
                setTimeout(() => setNextItemIndex(itemIndex + 1), 0);
                return null;
              }

              return (
                <div key={`loader-${itemIndex}`} style={{position: 'absolute', left: '-9999px', width: '200px'}}>
                  {isImage && (
                    <img
                      src={item.url}
                      alt="loading"
                      onLoad={(e) => {
                        handleImageLoaded(item, itemIndex, e);
                      }}
                      onError={(e) => {
                        console.error(`❌ onError fired for ${item.filename}`, e);
                        setNextItemIndex(itemIndex + 1);
                      }}
                    />
                  )}
                  {isVideo && (
                    <video
                      src={item.url}
                      onLoadedMetadata={(e) => {
                        handleImageLoaded(item, itemIndex, e);
                      }}
                      onError={(e) => {
                        console.error(`❌ onError fired for ${item.filename}`, e);
                        setNextItemIndex(itemIndex + 1);
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
