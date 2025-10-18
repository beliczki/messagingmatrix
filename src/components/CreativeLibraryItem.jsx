import React from 'react';
import { Image as ImageIcon, Check } from 'lucide-react';

const CreativeLibraryItem = ({
  creative,
  selectorMode,
  isSelected,
  onToggleSelection,
  onSelect,
  isOutsideRange = false,
  savedHeight = 300
}) => {
  const isVideo = creative.extension === 'mp4';
  const isImage = ['jpg', 'jpeg', 'png', 'gif'].includes(creative.extension);
  const isDynamic = creative.isDynamic && creative.extension === 'html';

  let longPressTimer = null;

  const handleMouseDown = () => {
    longPressTimer = setTimeout(() => {
      onToggleSelection(creative.id, true); // true = enable selector mode
    }, 500);
  };

  const handleMouseUp = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
    }
  };

  const handleClick = () => {
    if (selectorMode) {
      onToggleSelection(creative.id);
    } else {
      onSelect(creative);
    }
  };

  // Render placeholder for items outside loaded range
  if (isOutsideRange) {
    return (
      <div
        data-creative-id={creative.id}
        className="rounded-lg bg-gray-200 flex items-center justify-center"
        style={{ height: `${savedHeight}px` }}
      >
        <div className="text-gray-400 text-sm">Unloaded</div>
      </div>
    );
  }

  return (
    <div
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
        {/* Selection Checkbox */}
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

        {/* Media Content */}
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
        {isDynamic && creative.bannerSize && (
          <div
            className="w-full bg-white flex items-center justify-center border border-gray-300"
            style={{
              aspectRatio: `${creative.bannerSize.width} / ${creative.bannerSize.height}`
            }}
          >
            <div className="text-center p-4">
              <div className="text-lg font-semibold text-gray-800 mb-2">{creative.bannerSize.width}x{creative.bannerSize.height}</div>
              <div className="text-sm text-gray-600">{creative.bannerSize.name}</div>
              <div className="text-xs text-gray-500 mt-2">MC{creative.messageData.number}_{creative.messageData.variant}</div>
            </div>
          </div>
        )}
        {!isImage && !isVideo && !isDynamic && (
          <div className="w-full h-64 bg-gray-200 flex items-center justify-center">
            <ImageIcon size={48} className="text-gray-400" />
          </div>
        )}

        {/* Hover Overlay with Info */}
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
};

export default CreativeLibraryItem;
