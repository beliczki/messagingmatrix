import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronLeft, ChevronRight, Info, ExternalLink, Image } from 'lucide-react';
import html2canvas from 'html2canvas';
import settings from '../services/settings';
import { applyTextFormattingSpans } from '../utils/textFormatter';

const CreativePreview = ({
  creative,
  onClose,
  templateHtml = '',
  templateConfig = null,
  templateCss = null,
  allCreatives = [],
  onNavigate = null,
  textFormatting = [],
  audiences = []
}) => {
  const [infoOpen, setInfoOpen] = useState(false);
  const [canvasMode, setCanvasMode] = useState(false);
  const [canvasDataUrl, setCanvasDataUrl] = useState(null);
  const [canvasLoading, setCanvasLoading] = useState(false);
  const iframeRef = useRef(null);

  // Progressive loading: start with thumbnail, upgrade to full res
  const [displayUrl, setDisplayUrl] = useState(creative?.url);

  // ESC key to close preview
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && creative) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [creative, onClose]);

  if (!creative) return null;

  const isDynamic = creative.isDynamic && creative.extension === 'html';
  const isPng = creative.extension?.toLowerCase() === 'png';
  const isImage = ['jpg', 'jpeg', 'png', 'gif'].includes(creative.extension);

  // Get product from audiences based on messageData.audience
  const getProduct = () => {
    if (isDynamic && creative.messageData?.audience && audiences.length > 0) {
      const audience = audiences.find(a => a.key === creative.messageData.audience);
      return audience?.product || creative.product;
    }
    return creative.product;
  };
  const product = getProduct();

  // Add product to creative object for display in info panel
  const creativeWithProduct = product ? { ...creative, Product: product } : creative;

  useEffect(() => {
    // Reset to initial URL when creative changes
    setDisplayUrl(creative.url);

    // Upgrade to full resolution if available
    if (creative.fullResUrl && creative.fullResUrl !== creative.url && isImage) {
      const img = new Image();
      img.onload = () => {
        setDisplayUrl(creative.fullResUrl);
      };
      img.onerror = () => {
        console.warn(`Failed to load full res for ${creative.filename}, keeping thumbnail`);
      };
      img.src = creative.fullResUrl;
    }
  }, [creative.id, creative.url, creative.fullResUrl, isImage, creative.filename]);

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

  // Format title - show MC number, variant, size and version for dynamic HTML
  const getTitle = () => {
    if (isDynamic && creative.messageData && creative.bannerSize) {
      return `MC${creative.messageData.number} ${creative.variant.toUpperCase()} ${creative.bannerSize.width}x${creative.bannerSize.height} v${creative.messageData.version || 1}`;
    }
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
          // Case-insensitive property lookup since bindings use various casings
          const matchingKey = Object.keys(msg).find(k => k.toLowerCase() === fieldName);
          value = (matchingKey ? msg[matchingKey] : null) || value;

          // Apply text formatting with spans for text fields
          const textFields = ['headline', 'copy1', 'copy2', 'flash', 'cta', 'disclaimer'];
          if (textFields.includes(fieldName) && value && textFormatting && textFormatting.length > 0) {
            // Build message identifiers for MC scope matching
            const msgIdentifiers = {
              id: String(msg.id),
              poms_id: msg.poms_id,
              name: msg.name,
              number: String(msg.number || ''),
              variant: msg.variant || '',
              numberVariant: `${msg.number || ''}${msg.variant || ''}`
            };
            // Extract template sizes from config
            const templateSizes = templateConfig?.sizes?.map(s => s.name || `${s.width}x${s.height}`) || null;
            value = applyTextFormattingSpans(value, textFormatting, msgIdentifiers, templateSizes);
          }

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

  // Capture iframe content to canvas
  const captureToCanvas = async () => {
    if (!iframeRef.current) return;

    setCanvasLoading(true);
    try {
      const iframe = iframeRef.current;
      const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
      const iframeWindow = iframe.contentWindow;
      const width = creative.bannerSize.width;
      const height = creative.bannerSize.height;

      // Collect SVG info from the LIVE document (but don't modify it!)
      const svgInfo = [];
      const svgImages = iframeDoc.querySelectorAll('img');
      for (const img of svgImages) {
        const src = img.src || img.getAttribute('src');
        if (src && src.includes('.svg') && !src.startsWith('data:')) {
          const computedStyle = iframeWindow.getComputedStyle(img);
          const imgWidth = parseInt(computedStyle.width) || img.offsetWidth;
          const imgHeight = parseInt(computedStyle.height) || img.offsetHeight;
          svgInfo.push({ src, imgWidth, imgHeight });
        }
      }

      // Pre-fetch and convert all SVGs
      const svgDataUris = {};
      for (const info of svgInfo) {
        try {
          const response = await fetch(info.src, { mode: 'cors' });
          const svgText = await response.text();
          let modifiedSvg = svgText;
          // Remove existing width/height and add computed dimensions
          modifiedSvg = modifiedSvg.replace(/<svg([^>]*)>/, (match, attrs) => {
            let cleanAttrs = attrs.replace(/\s*width\s*=\s*["'][^"']*["']/gi, '');
            cleanAttrs = cleanAttrs.replace(/\s*height\s*=\s*["'][^"']*["']/gi, '');
            return `<svg${cleanAttrs} width="${info.imgWidth}" height="${info.imgHeight}">`;
          });
          const base64 = btoa(unescape(encodeURIComponent(modifiedSvg)));
          svgDataUris[info.src] = `data:image/svg+xml;base64,${base64}`;
        } catch (e) {
          console.warn('Failed to convert SVG:', info.src, e);
        }
      }

      // Capture #adContainer directly
      const adContainer = iframeDoc.getElementById('adContainer') || iframeDoc.body;

      const canvas = await html2canvas(adContainer, {
        width,
        height,
        scale: 1,
        useCORS: true,
        allowTaint: true,
        backgroundColor: null,
        logging: true,
        scrollX: 0,
        scrollY: 0,
        windowWidth: width,
        windowHeight: height,
        onclone: (clonedDoc) => {
          // Convert SVGs in the CLONED document (not the original!)
          const clonedImages = clonedDoc.querySelectorAll('img');
          for (const img of clonedImages) {
            const src = img.src || img.getAttribute('src');
            if (src && svgDataUris[src]) {
              img.src = svgDataUris[src];
            }
          }
        }
      });

      setCanvasDataUrl(canvas.toDataURL('image/png'));
    } catch (error) {
      console.error('Canvas capture failed:', error);
      alert('Canvas capture failed: ' + error.message);
    } finally {
      setCanvasLoading(false);
    }
  };

  // Reset canvas when switching creatives or toggling mode
  useEffect(() => {
    if (!canvasMode) {
      setCanvasDataUrl(null);
    }
  }, [canvasMode, creative?.id]);

  // Render dynamic HTML creative
  const renderDynamicCreative = () => {
    if (!templateHtml || !templateCss || !creative.bannerSize) return null;

    const width = creative.bannerSize.width;
    const height = creative.bannerSize.height;
    const sizeKey = `${width}x${height}`;

    // Inject CSS inline into the HTML
    let htmlWithCss = templateHtml;

    if (templateCss.main || templateCss[sizeKey]) {
      const mainCss = templateCss.main || '';
      const sizeCss = templateCss[sizeKey] || '';
      const combinedCss = `${mainCss}\n${sizeCss}`;
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
    let populatedHtml = populateTemplate(htmlWithCss, creative.messageData);

    // Fix any remaining hardcoded empty.png references in template HTML
    const tplName = creative.messageData?.template || 'html';

    // Inject base tag for relative URL resolution (scripts like thm.js, dynamic.content.js)
    const baseTag = `<base href="/api/templates/${tplName}/">`;
    populatedHtml = populatedHtml.replace(/<head>/i, `<head>\n${baseTag}`);

    // Add size class to body for CSS-based text formatting visibility
    populatedHtml = populatedHtml.replace(/<body([^>]*)>/i, `<body$1 class="size-${sizeKey}">`);
    populatedHtml = populatedHtml.replace(
      /url\(['"]?empty\.png['"]?\)/gi,
      `url('/api/templates/${tplName}/empty.png')`
    );
    populatedHtml = populatedHtml.replace(
      /src=['"]empty\.png['"]/gi,
      `src="/api/templates/${tplName}/empty.png"`
    );

    return (
      <div className="bg-gray-900 p-4 rounded-lg flex flex-col items-center justify-center gap-4">
        {/* Canvas Mode Toggle */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCanvasMode(!canvasMode)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm transition-colors ${
              canvasMode
                ? 'bg-orange-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            <Image size={16} />
            Canvas Mode {canvasMode ? 'ON' : 'OFF'}
          </button>
          {canvasMode && !canvasDataUrl && (
            <button
              onClick={captureToCanvas}
              disabled={canvasLoading}
              className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50"
            >
              {canvasLoading ? 'Capturing...' : 'Capture'}
            </button>
          )}
          {canvasMode && canvasDataUrl && (
            <button
              onClick={() => setCanvasDataUrl(null)}
              className="px-3 py-1.5 bg-gray-600 text-white rounded text-sm hover:bg-gray-500"
            >
              Re-capture
            </button>
          )}
        </div>

        {/* Preview Container */}
        <div
          style={{
            width: `${width}px`,
            height: `${height}px`,
            position: 'relative'
          }}
        >
          {canvasMode && canvasDataUrl ? (
            <img
              src={canvasDataUrl}
              alt="Canvas capture"
              style={{ width: `${width}px`, height: `${height}px`, display: 'block' }}
            />
          ) : (
            <iframe
              ref={iframeRef}
              srcDoc={populatedHtml}
              style={{
                width: `${width}px`,
                height: `${height}px`,
                border: 0,
                display: 'block'
              }}
              title={`${creative.product || 'Creative'} Preview`}
              sandbox="allow-same-origin allow-scripts allow-popups allow-popups-to-escape-sandbox"
            />
          )}
        </div>

        {/* Mode indicator */}
        <div className="text-xs text-gray-500">
          {canvasMode
            ? canvasDataUrl
              ? 'Showing html2canvas output (what export will look like)'
              : 'Click Capture to see html2canvas output'
            : 'Showing live iframe (normal preview)'}
        </div>
      </div>
    );
  };

  return createPortal(
    <div
      className="fixed inset-0 bg-black bg-opacity-90 z-[2100] flex"
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
          {Object.entries(creativeWithProduct).map(([key, value]) => {
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
              <img src={displayUrl} alt={creative.filename} className="max-w-full max-h-full rounded-lg" style={{ display: 'block' }} />
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default CreativePreview;
