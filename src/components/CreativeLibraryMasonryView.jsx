import React, { useRef } from 'react';
import CreativeLibraryItem from './CreativeLibraryItem';

const CreativeLibraryMasonryView = ({
  gridRef,
  columnItems,
  columnCount,
  columnWidth = 300,
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
  templatesCache = {},
  getTemplateForCreative,
  textFormatting = [],
  audiences = []
}) => {
  // Track which items have already been loaded to prevent duplicate calls
  const loadedItemsRef = useRef(new Set());

  return (
    <div className="relative">
      {/* Background container */}
      <div
        className="absolute top-0 left-0 right-0 bg-transparent pointer-events-none"
        style={{ height: `${containerHeight}px` }}
      />

      {/* Masonry grid - centered with fixed width columns */}
      <div ref={gridRef} className="flex justify-center gap-4 relative z-10">
        {Array.from({ length: columnCount }, (_, i) => i).map((columnIndex) => (
          <div key={columnIndex} className="flex flex-col gap-4 flex-shrink-0" style={{ width: `${columnWidth}px` }}>
            {/* Render already-loaded items in this column */}
            {(columnItems[columnIndex] || []).map(creative => {
              const isOutsideRange = creative.originalIndex < loadedStart || creative.originalIndex >= loadedEnd;
              const savedHeight = itemPositions.current.get(creative.id)?.height || 300;

              const templateData = getTemplateForCreative ? getTemplateForCreative(creative) : { html: '', config: null, css: null };
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
                  templateHtml={templateData.html}
                  templateConfig={templateData.config}
                  templateCss={templateData.css}
                  textFormatting={textFormatting}
                  audiences={audiences}
                />
              );
            })}

            {/* Render the currently-loading item (hidden, just for loading) */}
            {currentLoadingItem && columnIndex === 0 && (() => {
              const item = currentLoadingItem.item;
              const itemIndex = currentLoadingItem.index;
              const isVideo = item.extension === 'mp4';
              const isImage = ['jpg', 'jpeg', 'png', 'gif'].includes(item.extension);
              const isHtml = item.extension === 'html';

              // HTML creatives don't need preloading - calculate height from banner size
              if (isHtml && item.bannerSize) {
                const fakeEvent = {
                  target: {
                    naturalWidth: item.bannerSize.width,
                    naturalHeight: item.bannerSize.height,
                    videoWidth: item.bannerSize.width,
                    videoHeight: item.bannerSize.height
                  }
                };
                setTimeout(() => handleImageLoaded(item, itemIndex, fakeEvent), 0);
                return null;
              }

              // Skip non-media files
              if (!isImage && !isVideo && !isHtml) {
                console.warn(`⚠️ Skipping non-media file #${itemIndex}: ${item.filename} (${item.extension})`);
                setTimeout(() => setNextItemIndex(itemIndex + 1), 0);
                return null;
              }

              return (
                <div key={`loader-${itemIndex}`} style={{position: 'absolute', left: '-9999px', width: '200px'}}>
                  {isImage && (
                    <img
                      ref={(el) => {
                        loadingImageRef.current = el;
                        // Check if image already loaded (cached)
                        const itemId = `${itemIndex}-${item.filename}`;
                        if (el && el.complete && el.naturalHeight !== 0 && !loadedItemsRef.current.has(itemId)) {
                          loadedItemsRef.current.add(itemId);
                          // Trigger the handler directly since onLoad won't fire
                          handleImageLoaded(item, itemIndex, { target: el });
                        }
                      }}
                      src={item.url}
                      alt="loading"
                      onLoad={(e) => {
                        handleImageLoaded(item, itemIndex, e);
                      }}
                      onError={(e) => {
                        // Try fullResUrl as fallback if thumbnail fails
                        if (item.fullResUrl && e.target.src !== item.fullResUrl) {
                          console.warn(`⚠️ Thumbnail failed, trying fullResUrl for ${item.filename}`);
                          e.target.src = item.fullResUrl;
                        } else {
                          console.error(`❌ Failed to load creative:`, {
                            filename: item.filename,
                            url: item.url,
                            fullResUrl: item.fullResUrl,
                            item: item
                          });
                          setNextItemIndex(itemIndex + 1);
                        }
                      }}
                    />
                  )}
                  {isVideo && (
                    <video
                      ref={(el) => {
                        loadingImageRef.current = el;
                        // Check if video metadata already loaded
                        if (el && el.readyState >= 1) {
                          handleImageLoaded(item, itemIndex, { target: el });
                        }
                      }}
                      src={item.url}
                      onLoadedMetadata={(e) => {
                        handleImageLoaded(item, itemIndex, e);
                      }}
                      onError={(e) => {
                        // Try fullResUrl as fallback if thumbnail fails
                        if (item.fullResUrl && e.target.src !== item.fullResUrl) {
                          console.warn(`⚠️ Thumbnail failed, trying fullResUrl for ${item.filename}`);
                          e.target.src = item.fullResUrl;
                        } else {
                          console.error(`❌ Failed to load creative:`, {
                            filename: item.filename,
                            url: item.url,
                            fullResUrl: item.fullResUrl,
                            item: item
                          });
                          setNextItemIndex(itemIndex + 1);
                        }
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
