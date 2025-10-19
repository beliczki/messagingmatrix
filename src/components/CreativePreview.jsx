import React from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
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
  if (!creative) return null;

  const isDynamic = creative.isDynamic && creative.extension === 'html';

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

  // Format title for dynamic ads
  const getTitle = () => {
    if (isDynamic && creative.messageData) {
      const msg = creative.messageData;
      const mcPart = `MC${msg.number}${msg.variant.toUpperCase()}`;
      const namePart = msg.name || creative.filename;
      return `${mcPart} | ${namePart}`;
    }
    return creative.product || creative.filename;
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
          <img src={creative.url} alt={creative.filename} className="max-w-full max-h-full rounded-lg" />
        )}
      </div>
    </div>
  );
};

export default CreativePreview;
