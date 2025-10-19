import React from 'react';
import { Image as ImageIcon, Check } from 'lucide-react';
import settings from '../services/settings';

const CreativeLibraryItem = ({
  creative,
  selectorMode,
  isSelected,
  onToggleSelection,
  onSelect,
  isOutsideRange = false,
  savedHeight = 300,
  templateHtml = '',
  templateConfig = null,
  templateCss = null
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

  // Helper function to build full image URLs
  const buildImageUrl = (imageKey, filename) => {
    if (!filename) return '';
    if (filename.startsWith('http://') || filename.startsWith('https://')) {
      return filename;
    }
    const imageBaseUrls = settings.getImageBaseUrls();
    return (imageBaseUrls[imageKey] || '') + filename;
  };

  // Helper function to populate template with message data
  const populateTemplate = (html, msg) => {
    if (!msg || !html) return html;
    let result = html;

    if (templateConfig && templateConfig.placeholders) {
      Object.keys(templateConfig.placeholders).forEach(placeholderName => {
        const config = templateConfig.placeholders[placeholderName];
        const binding = config['binding-messagingmatrix'];
        let value = config.default || '';

        if (binding) {
          const fieldName = binding.replace(/^message\./i, '').toLowerCase();
          value = msg[fieldName] || value;

          if (config.type === 'image' && value) {
            value = buildImageUrl(fieldName, value);
          }
        }

        const regex = new RegExp(`\\{\\{${placeholderName}\\}\\}`, 'g');
        result = result.replace(regex, value);
      });
    }

    return result;
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
        {isDynamic && creative.bannerSize && (() => {
          if (!templateHtml || !templateCss) return null;

          const width = creative.bannerSize.width;
          const height = creative.bannerSize.height;
          const sizeKey = `${width}x${height}`;

          // Inject CSS inline into the HTML
          let htmlWithCss = templateHtml;

          // Replace CSS link references with inline styles
          if (templateCss.main && templateCss[sizeKey]) {
            const combinedCss = `${templateCss.main}\n${templateCss[sizeKey]}`;
            htmlWithCss = htmlWithCss.replace(
              /<link rel="stylesheet" href="main.css".*?>/,
              `<style>${combinedCss}</style>`
            );
            htmlWithCss = htmlWithCss.replace(
              /<link rel="stylesheet" href="\[\[css\]\]".*?>/,
              ''
            );
          }

          // Populate template with message data
          const populatedHtml = populateTemplate(htmlWithCss, creative.messageData);

          return (
            <div className="w-full bg-white border border-gray-300 overflow-hidden">
              {/* Outer wrapper - takes full column width and maintains aspect ratio */}
              <div
                style={{
                  width: '100%',
                  aspectRatio: `${width} / ${height}`,
                  position: 'relative',
                  overflow: 'hidden'
                }}
              >
                {/* Inner container - sized at banner dimensions, then scaled to fit */}
                <div
                  style={{
                    width: `${width}px`,
                    height: `${height}px`,
                    transformOrigin: 'top left',
                    transform: 'scale(var(--scale))',
                    position: 'absolute',
                    top: 0,
                    left: 0
                  }}
                  ref={(el) => {
                    if (el) {
                      // Calculate scale to fit column width
                      const parentWidth = el.parentElement?.offsetWidth || width;
                      const scale = parentWidth / width;
                      el.style.setProperty('--scale', scale.toString());
                    }
                  }}
                >
                  <iframe
                    srcDoc={populatedHtml}
                    style={{
                      width: `${width}px`,
                      height: `${height}px`,
                      border: 0,
                      display: 'block'
                    }}
                    title={`${creative.product || 'Creative'} Preview`}
                    sandbox="allow-same-origin allow-scripts"
                  />
                </div>
              </div>
            </div>
          );
        })()}
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
