import React, { useState } from 'react';
import { X, ChevronLeft, ChevronRight, Info } from 'lucide-react';
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
      className="fixed inset-0 bg-black bg-opacity-90 z-50"
      onClick={onClose}
    >
      {/* Fixed Header at Top */}
      <div className="fixed top-0 left-0 right-0 flex items-center justify-between p-4 bg-black/50 backdrop-blur-sm z-10">
        {/* Title - Left */}
        <h3 className="text-xl font-bold text-white flex-1">{getTitle()}</h3>

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

          {/* Info Button */}
          <button
            onClick={() => setInfoOpen(!infoOpen)}
            className={`p-2 rounded transition-colors ml-2 ${
              infoOpen
                ? 'bg-blue-500 text-white'
                : 'bg-white/10 hover:bg-white/20 text-white'
            }`}
            title="Show asset info"
          >
            <Info size={20} />
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

      {/* Content - Centered with top padding for header */}
      <div className="flex items-center justify-center h-full pt-20 pb-4 px-4" onClick={(e) => e.stopPropagation()}>
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

      {/* Info Slidein Panel */}
      <div
        className={`absolute top-0 right-0 bottom-0 w-96 bg-white shadow-xl border-l z-20 transform transition-transform duration-300 ease-in-out overflow-auto ${
          infoOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b bg-gray-50 sticky top-0 z-10">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-gray-900">Asset Info</h3>
            <button
              onClick={() => setInfoOpen(false)}
              className="p-1 hover:bg-gray-200 rounded transition-colors"
            >
              <X size={20} className="text-gray-600" />
            </button>
          </div>
        </div>
        <div className="p-4 space-y-4">
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
                <div key={key} className="border-b border-gray-200 pb-3">
                  <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">
                    {key.replace(/_/g, ' ')}
                  </label>
                  <div className="flex flex-wrap gap-1">
                    {value.map((item, index) => (
                      <span key={index} className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              );
            }

            // Skip empty values
            if (!value || value === '') return null;

            return (
              <div key={key} className="border-b border-gray-200 pb-3">
                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">
                  {key.replace(/_/g, ' ')}
                </label>
                <div className="text-sm text-gray-900 break-words">
                  {String(value)}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default CreativePreview;
