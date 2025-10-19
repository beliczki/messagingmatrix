import React from 'react';
import CreativeLibraryItem from './CreativeLibraryItem';

const CreativeLibraryMasonryView = ({
  gridRef,
  columnItems,
  columnCount,
  containerHeight,
  loadedStart,
  loadedEnd,
  itemPositions,
  selectorMode,
  selectedCreativeIds,
  onToggleSelection,
  onSelectCreative,
  currentLoadingItem,
  loadingImageRef,
  handleImageLoaded,
  setNextItemIndex,
  templateHtml,
  templateConfig,
  templateCss
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
            {(columnItems[columnIndex] || []).map(creative => {
              const isOutsideRange = creative.originalIndex < loadedStart || creative.originalIndex >= loadedEnd;
              const savedHeight = itemPositions.current.get(creative.id)?.height || 300;

              return (
                <CreativeLibraryItem
                  key={creative.id}
                  creative={creative}
                  selectorMode={selectorMode}
                  isSelected={selectedCreativeIds.has(creative.id)}
                  onToggleSelection={(id, enableSelectorMode, skipToggle) => onToggleSelection(id, enableSelectorMode, skipToggle)}
                  onSelect={onSelectCreative}
                  isOutsideRange={isOutsideRange}
                  savedHeight={savedHeight}
                  templateHtml={templateHtml}
                  templateConfig={templateConfig}
                  templateCss={templateCss}
                />
              );
            })}

            {/* Render the currently-loading item (hidden, just for loading) */}
            {currentLoadingItem && columnIndex === 0 && (() => {
              const item = currentLoadingItem.item;
              const itemIndex = currentLoadingItem.index;
              const isVideo = item.extension === 'mp4';
              const isImage = ['jpg', 'jpeg', 'png', 'gif'].includes(item.extension);

              console.log(`🎯 Rendering hidden loader for item #${itemIndex}: ${item.filename} (${isVideo ? 'video' : isImage ? 'image' : 'unknown'})`);

              return (
                <div key={`loader-${itemIndex}`} style={{position: 'absolute', left: '-9999px', width: '200px'}}>
                  {isImage && (
                    <img
                      ref={(el) => {
                        loadingImageRef.current = el;
                        // Check if image already loaded (cached)
                        if (el && el.complete && el.naturalHeight !== 0) {
                          console.log(`✅ Image already loaded (cached): ${item.filename}`);
                          // Trigger the handler directly since onLoad won't fire
                          handleImageLoaded(item, itemIndex, { target: el });
                        }
                      }}
                      src={item.url}
                      alt="loading"
                      onLoad={(e) => {
                        console.log(`✅ onLoad fired for ${item.filename}`);
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
                      ref={(el) => {
                        loadingImageRef.current = el;
                        // Check if video metadata already loaded
                        if (el && el.readyState >= 1) {
                          console.log(`✅ Video metadata already loaded: ${item.filename}`);
                          handleImageLoaded(item, itemIndex, { target: el });
                        }
                      }}
                      src={item.url}
                      onLoadedMetadata={(e) => {
                        console.log(`✅ onLoadedMetadata fired for ${item.filename}`);
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

export default CreativeLibraryMasonryView;
