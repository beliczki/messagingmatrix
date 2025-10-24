import React from 'react';
import { Image as ImageIcon, Cloud } from 'lucide-react';

const AssetItem = ({
  asset,
  onSelect,
  isOutsideRange = false,
  savedHeight = 300
}) => {
  const isVideo = asset.extension === 'mp4';
  const isImage = ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'bmp'].includes(asset.extension?.toLowerCase());
  const hasTransparency = ['png', 'svg'].includes(asset.extension?.toLowerCase());

  // Checkerboard pattern for transparent images
  const checkerboardStyle = hasTransparency ? {
    backgroundImage: `
      linear-gradient(45deg, #ccc 25%, transparent 25%),
      linear-gradient(-45deg, #ccc 25%, transparent 25%),
      linear-gradient(45deg, transparent 75%, #ccc 75%),
      linear-gradient(-45deg, transparent 75%, #ccc 75%)
    `,
    backgroundSize: '20px 20px',
    backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px'
  } : {};

  // Render placeholder for items outside loaded range
  if (isOutsideRange) {
    return (
      <div
        data-asset-id={asset.id}
        className="rounded-lg bg-gray-200 flex items-center justify-center"
        style={{ height: `${savedHeight}px` }}
      >
        <div className="text-gray-400 text-sm">Unloaded</div>
      </div>
    );
  }

  return (
    <div
      data-asset-id={asset.id}
      className="group cursor-pointer"
      onClick={() => onSelect(asset)}
    >
      <div className="relative rounded-lg overflow-hidden shadow-md hover:shadow-xl transition-shadow" style={checkerboardStyle}>
        {/* Drive Source Badge */}
        {asset.source === 'drive' && (
          <div className="absolute top-2 right-2 z-10 bg-blue-500 text-white px-2 py-1 rounded text-xs flex items-center gap-1 shadow-lg">
            <Cloud size={10} />
            Drive
          </div>
        )}

        {/* Media Content */}
        {isImage && (
          <img
            src={asset.url}
            alt={asset.filename}
            className="w-full h-auto object-cover"
            loading="lazy"
            style={{ display: 'block' }}
          />
        )}
        {isVideo && (
          <video
            src={asset.url}
            className="w-full h-auto object-cover"
            preload="metadata"
          />
        )}
        {!isImage && !isVideo && (
          <div className="w-full h-64 bg-gray-200 flex items-center justify-center">
            <ImageIcon size={48} className="text-gray-400" />
          </div>
        )}

        {/* Hover Overlay with Info */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-4 pointer-events-none">
          <h3 className="text-white font-semibold text-sm mb-2 line-clamp-2">
            {asset.filename}
          </h3>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2 py-1 bg-white/20 backdrop-blur-sm text-white rounded text-xs font-medium uppercase">
              {asset.extension}
            </span>
            {asset.size && (
              <span className="px-2 py-1 bg-white/20 backdrop-blur-sm text-white rounded text-xs">
                {asset.size}
              </span>
            )}
            {asset.variant && (
              <span className="px-2 py-1 bg-white/20 backdrop-blur-sm text-white rounded text-xs">
                v{asset.variant.toUpperCase()}
              </span>
            )}
          </div>

          {(asset.platforms?.length > 0 || asset.tags?.length > 0) && (
            <div className="flex flex-wrap gap-1 mt-2">
              {asset.platforms.map(platform => (
                <span key={platform} className="px-2 py-0.5 bg-blue-500/80 backdrop-blur-sm text-white rounded text-xs">
                  {platform}
                </span>
              ))}
              {asset.tags.slice(0, 2).map(tag => (
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

export default AssetItem;
