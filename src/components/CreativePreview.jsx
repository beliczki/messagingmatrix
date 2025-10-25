import React, { useState } from 'react';
import { X, ChevronLeft, ChevronRight, Info, ExternalLink } from 'lucide-react';
import settings from '../services/settings';

const CreativePreview = ({
  creative,
  onClose,
  templateHtml = '',
  templateConfig = null,
  templateCss = null,
  allCreatives = [],
  onNavigate = null
}) => {
  const [infoOpen, setInfoOpen] = useState(false);

  if (!creative) return null;

  const isDynamic = creative.isDynamic && creative.extension === 'html';
  const isPng = creative.extension?.toLowerCase() === 'png';

  // Checkerboard pattern for transparent PNG images
  const checkerboardStyle = isPng ? {
    backgroundImage: `
      linear-gradient(45deg, #333 25%, transparent 25%),
      linear-gradient(-45deg, #333 25%, transparent 25%),
      linear-gradient(45deg, transparent 75%, #333 75%),
      linear-gradient(-45deg, transparent 75%, #333 75%)
    `,
    backgroundSize: '30px 30px',
    backgroundPosition: '0 0, 0 15px, 15px -15px, -15px 0px'
  } : {};

  // Find current index in all creatives
  const currentIndex = allCreatives.findIndex(c => c.id === creative.id);
  const hasPrevious = currentIndex > 0;
  const hasNext = currentIndex < allCreatives.length - 1;

  const handlePrevious = () => {
    if (hasPrevious && onNavigate) {
      onNavigate(allCreatives[currentIndex - 1]);
    }
  };

  const handleNext = () => {
    if (hasNext && onNavigate) {
      onNavigate(allCreatives[currentIndex + 1]);
    }
  };

  // Format title - always show filename
  const getTitle = () => {
    return creative.filename || creative.product || 'Preview';
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

          // Use path-messagingmatrix for images and videos
          if ((config.type === 'image' || config.type === 'video') && value) {
            const pathPrefix = config['path-messagingmatrix'] || '';
            // If value is already a full URL, use it as-is
            if (value.startsWith('http://') || value.startsWith('https://') || value.startsWith('/')) {
              // If it starts with /, it's a relative path, so prepend the path prefix
              if (value.startsWith('/') && !pathPrefix) {
                value = value; // Keep as-is
              } else if (!value.startsWith('http')) {
                value = pathPrefix + value;
              }
            } else {
              // It's a file ID or filename, prepend the path
              value = pathPrefix + value;
            }
          }
        }

        const regex = new RegExp(`\\{\\{${placeholderName}\\}\\}`, 'g');
        result = result.replace(regex, value);
      });
    }

    return result;
  };

  // Render dynamic HTML creative
  const renderDynamicCreative = () => {
    if (!templateHtml || !templateCss || !creative.bannerSize) return null;

    const width = creative.bannerSize.width;
    const height = creative.bannerSize.height;
    const sizeKey = `${width}x${height}`;

    // Inject CSS inline into the HTML
    let htmlWithCss = templateHtml;

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
      <div className="bg-gray-900 p-4 rounded-lg flex items-center justify-center">
        <div
          style={{
            width: `${width}px`,
            height: `${height}px`,
            position: 'relative'
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
    );
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-90 z-50 flex"
      onClick={onClose}
    >
      {/* Info Panel - Full Height, Left Side, Dark Theme */}
      <div
        className={`bg-gray-900 shadow-xl border-r border-gray-700 flex-shrink-0 transition-all duration-300 ease-in-out overflow-auto ${
          infoOpen ? 'w-96' : 'w-0 border-0'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-96 flex-shrink-0">
          <div className="p-4 space-y-2">
          {/* Display all asset properties */}
          {Object.entries(creative).map(([key, value]) => {
            // Skip some non-display fields
            if (['url', 'thumbnail', 'isPlaceholder', 'isDynamic', 'messageData', 'bannerSize'].includes(key)) {
              return null;
            }

            // Handle array values
            if (Array.isArray(value)) {
              if (value.length === 0) return null;
              return (
                <div key={key} className="border-b border-gray-700 pb-2">
                  <div className="flex items-start gap-3">
                    <label className="text-xs font-semibold text-gray-400 uppercase whitespace-nowrap flex-shrink-0 w-32">
                      {key.replace(/_/g, ' ')}
                    </label>
                    <div className="flex flex-wrap gap-1 flex-1">
                      {value.map((item, index) => (
                        <span key={index} className="px-2 py-1 bg-blue-900 text-blue-200 rounded text-xs">
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              );
            }

            // Skip empty values
            if (!value || value === '') return null;

            // Special handling for File_DirectLink and File_thumbnail - show as external link button
            if ((key === 'File_DirectLink' || key === 'File_thumbnail') && value) {
              return (
                <div key={key} className="border-b border-gray-700 pb-2">
                  <div className="flex items-center gap-3">
                    <label className="text-xs font-semibold text-gray-400 uppercase whitespace-nowrap flex-shrink-0 w-32">
                      {key.replace(/_/g, ' ')}
                    </label>
                    <a
                      href={value}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs transition-colors"
                    >
                      <span>Open</span>
                      <ExternalLink size={12} />
                    </a>
                  </div>
                </div>
              );
            }

            return (
              <div key={key} className="border-b border-gray-700 pb-2">
                <div className="flex items-start gap-3">
                  <label className="text-xs font-semibold text-gray-400 uppercase whitespace-nowrap flex-shrink-0 w-32">
                    {key.replace(/_/g, ' ')}
                  </label>
                  <div className="text-sm text-gray-200 break-words flex-1">
                    {String(value)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      </div>

      {/* Main Content Area - Flex to take remaining space */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between p-4 bg-black/50 backdrop-blur-sm flex-shrink-0">
          {/* Info Toggle + Title - Left */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setInfoOpen(!infoOpen);
              }}
              className={`p-2 rounded-lg shadow-lg transition-all flex-shrink-0 ${
                infoOpen
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800/90 text-white hover:bg-gray-700'
              }`}
              title={infoOpen ? "Hide asset info" : "Show asset info"}
            >
              <Info size={20} />
            </button>
            <h3 className="text-xl font-bold text-white truncate">{getTitle()}</h3>
          </div>

          {/* Navigation & Close - Right */}
          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            {/* Previous Button */}
            <button
              onClick={handlePrevious}
              disabled={!hasPrevious}
              className={`p-2 rounded transition-colors ${
                hasPrevious
                  ? 'bg-white/10 hover:bg-white/20 text-white'
                  : 'bg-white/5 text-white/30 cursor-not-allowed'
              }`}
              title="Previous creative"
            >
              <ChevronLeft size={20} />
            </button>

            {/* Counter */}
            {allCreatives.length > 0 && (
              <span className="text-white/70 text-sm px-2">
                {currentIndex + 1} / {allCreatives.length}
              </span>
            )}

            {/* Next Button */}
            <button
              onClick={handleNext}
              disabled={!hasNext}
              className={`p-2 rounded transition-colors ${
                hasNext
                  ? 'bg-white/10 hover:bg-white/20 text-white'
                  : 'bg-white/5 text-white/30 cursor-not-allowed'
              }`}
              title="Next creative"
            >
              <ChevronRight size={20} />
            </button>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-2 bg-white/10 hover:bg-white/20 rounded text-white ml-2"
              title="Close preview"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Preview Content - Flex to take remaining space */}
        <div className="flex-1 flex items-center justify-center p-4 min-h-0" onClick={(e) => e.stopPropagation()}>
          {isDynamic ? (
            renderDynamicCreative()
          ) : creative.extension === 'mp4' ? (
            <video src={creative.url} controls autoPlay className="max-w-full max-h-full rounded-lg" />
          ) : (
            <div className="flex items-center justify-center rounded-lg" style={checkerboardStyle}>
              <img src={creative.url} alt={creative.filename} className="max-w-full max-h-full rounded-lg" style={{ display: 'block' }} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CreativePreview;
