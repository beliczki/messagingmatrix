import React, { useState, useEffect } from 'react';
import { X, Image, Loader2, Download } from 'lucide-react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import html2canvas from 'html2canvas';
import settings from '../services/settings';
import { applyTextFormatting } from '../utils/textFormatter';

const ExportImagesDialog = ({
  isOpen,
  onClose,
  selectedCreatives = [],
  templatesCache = {},
  textFormatting = [],
  selectedBaseColor = '#e91e8c'
}) => {
  const [delay, setDelay] = useState(2000);
  const [format, setFormat] = useState('png');
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, message: '' });

  // ESC key to close dialog
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen && !exporting) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, exporting]);

  if (!isOpen) return null;

  // Count creative types
  const htmlCount = selectedCreatives.filter(c => c.isDynamic).length;
  const staticCount = selectedCreatives.filter(c => !c.isDynamic).length;

  // Helper function to populate template with message data (matching CreativePreview logic)
  const populateTemplate = (html, msg, templateConfig, sizeKey) => {
    if (!msg || !html) return html;
    let result = html;

    if (templateConfig && templateConfig.placeholders) {
      Object.keys(templateConfig.placeholders).forEach(placeholderName => {
        const config = templateConfig.placeholders[placeholderName];
        const binding = config['binding-messagingmatrix'];
        let value = config.default || '';

        if (binding) {
          const fieldName = binding.replace(/^message\./i, '').toLowerCase();
          const matchingKey = Object.keys(msg).find(k => k.toLowerCase() === fieldName);
          value = (matchingKey ? msg[matchingKey] : null) || value;

          // Apply text formatting for specific size
          const textFields = ['headline', 'copy1', 'copy2', 'flash', 'cta', 'disclaimer'];
          if (textFields.includes(fieldName) && value && textFormatting && textFormatting.length > 0) {
            const msgIdentifiers = {
              id: String(msg.id),
              poms_id: msg.poms_id,
              name: msg.name,
              number: String(msg.number || ''),
              variant: msg.variant || '',
              numberVariant: `${msg.number || ''}${msg.variant || ''}`
            };
            value = applyTextFormatting(value, sizeKey, textFormatting, msgIdentifiers);
          }

          // Use path-messagingmatrix for images and videos
          if ((config.type === 'image' || config.type === 'video') && value) {
            const pathPrefix = config['path-messagingmatrix'] || '';
            if (!value.startsWith('http://') && !value.startsWith('https://') && !value.startsWith('/')) {
              value = pathPrefix + value;
            } else if (value.startsWith('/') && pathPrefix) {
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

  // Capture HTML creative to image blob
  const captureHtmlCreative = async (creative) => {
    const templateData = templatesCache[creative.messageData?.template];
    if (!templateData || !templateData.html) {
      throw new Error(`Template not found: ${creative.messageData?.template}`);
    }

    const width = creative.bannerSize.width;
    const height = creative.bannerSize.height;
    const sizeKey = `${width}x${height}`;
    const tplName = creative.messageData?.template || 'html';

    // Inject CSS inline into the HTML
    let htmlWithCss = templateData.html;

    // Add base tag for proper URL resolution
    const baseUrl = window.location.origin;
    htmlWithCss = htmlWithCss.replace(
      /<head([^>]*)>/i,
      `<head$1><base href="${baseUrl}/api/templates/${tplName}/">`
    );

    if (templateData.css?.main || templateData.css?.[sizeKey]) {
      const mainCss = templateData.css.main || '';
      const sizeCss = templateData.css[sizeKey] || '';
      const combinedCss = `${mainCss}\n${sizeCss}`;

      // Replace main.css link with inline styles
      htmlWithCss = htmlWithCss.replace(
        /<link rel="stylesheet" href="main.css".*?>/i,
        `<style>${combinedCss}</style>`
      );

      // Remove any [[css]] placeholder links
      htmlWithCss = htmlWithCss.replace(
        /<link rel="stylesheet" href="\[\[css\]\]".*?>/gi,
        ''
      );

      // Also inject styles before </head> as fallback (in case link tag isn't found)
      if (!htmlWithCss.includes('<style>')) {
        htmlWithCss = htmlWithCss.replace(
          /<\/head>/i,
          `<style>${combinedCss}</style></head>`
        );
      }
    }

    // Populate template with message data
    let populatedHtml = populateTemplate(htmlWithCss, creative.messageData, templateData.config, sizeKey);

    // Fix any remaining hardcoded empty.png references
    populatedHtml = populatedHtml.replace(
      /url\(['"]?empty\.png['"]?\)/gi,
      `url('/api/templates/${tplName}/empty.png')`
    );
    populatedHtml = populatedHtml.replace(
      /src=['"]empty\.png['"]/gi,
      `src="/api/templates/${tplName}/empty.png"`
    );

    // Add size class to body
    populatedHtml = populatedHtml.replace(/<body([^>]*)>/i, `<body$1 class="size-${sizeKey}">`);

    // Create off-screen container
    const container = document.createElement('div');
    container.style.cssText = `
      position: fixed;
      left: -99999px;
      top: 0;
      width: ${width}px;
      height: ${height}px;
      overflow: hidden;
      z-index: -1;
    `;

    // Create iframe to render HTML (for proper script execution)
    const iframe = document.createElement('iframe');
    iframe.style.cssText = `
      width: ${width}px;
      height: ${height}px;
      border: none;
    `;
    iframe.sandbox = 'allow-same-origin allow-scripts';
    container.appendChild(iframe);
    document.body.appendChild(container);

    // Helper to wait for all images to load
    const waitForImages = async (doc) => {
      const images = doc.querySelectorAll('img');
      const promises = Array.from(images).map(img => {
        if (img.complete) return Promise.resolve();
        return new Promise(resolve => {
          img.onload = resolve;
          img.onerror = resolve;
        });
      });
      await Promise.all(promises);
    };

    // Helper to collect SVG info and pre-convert to data URIs
    const collectAndConvertSvgs = async (doc, iframeWindow) => {
      const svgDataUris = {};
      const images = doc.querySelectorAll('img');

      for (const img of images) {
        const src = img.src || img.getAttribute('src');
        if (src && src.includes('.svg') && !src.startsWith('data:')) {
          try {
            const response = await fetch(src, { mode: 'cors' });
            const svgText = await response.text();

            // Get computed dimensions from CSS
            const computedStyle = iframeWindow.getComputedStyle(img);
            const imgWidth = parseInt(computedStyle.width) || img.offsetWidth || img.naturalWidth;
            const imgHeight = parseInt(computedStyle.height) || img.offsetHeight || img.naturalHeight;

            // Inject width/height into SVG
            let modifiedSvg = svgText;
            if (imgWidth && imgHeight) {
              modifiedSvg = modifiedSvg.replace(/<svg([^>]*)>/, (match, attrs) => {
                let cleanAttrs = attrs.replace(/\s*width\s*=\s*["'][^"']*["']/gi, '');
                cleanAttrs = cleanAttrs.replace(/\s*height\s*=\s*["'][^"']*["']/gi, '');
                return `<svg${cleanAttrs} width="${imgWidth}" height="${imgHeight}">`;
              });
            }

            const base64 = btoa(unescape(encodeURIComponent(modifiedSvg)));
            svgDataUris[src] = `data:image/svg+xml;base64,${base64}`;
          } catch (e) {
            console.warn('Failed to convert SVG image:', src, e);
          }
        }
      }

      return svgDataUris;
    };

    return new Promise((resolve, reject) => {
      iframe.onload = async () => {
        // Wait for initial render
        await new Promise(r => setTimeout(r, 100));

        try {
          const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
          const iframeWindow = iframe.contentWindow;

          // Wait for all images to fully load first
          await waitForImages(iframeDoc);

          // Collect SVG info and convert to data URIs (but don't modify live DOM!)
          const svgDataUris = await collectAndConvertSvgs(iframeDoc, iframeWindow);

          // Wait for animations/transitions
          await new Promise(r => setTimeout(r, delay));

          // Capture #adContainer directly instead of body to avoid margin/scroll issues
          const adContainer = iframeDoc.getElementById('adContainer') || iframeDoc.body;

          const canvas = await html2canvas(adContainer, {
            width,
            height,
            scale: 1,
            useCORS: true,
            allowTaint: true,
            backgroundColor: null, // Use template's own background
            logging: false,
            scrollX: 0,
            scrollY: 0,
            windowWidth: width,
            windowHeight: height,
            onclone: (clonedDoc) => {
              // Apply SVG conversions to the CLONED document only
              const clonedImages = clonedDoc.querySelectorAll('img');
              for (const img of clonedImages) {
                const src = img.src || img.getAttribute('src');
                if (src && svgDataUris[src]) {
                  img.src = svgDataUris[src];
                }
              }
            }
          });

          const mimeType = format === 'jpg' ? 'image/jpeg' : 'image/png';
          const quality = format === 'jpg' ? 0.92 : undefined;

          canvas.toBlob(
            (blob) => {
              document.body.removeChild(container);
              if (blob) {
                resolve(blob);
              } else {
                reject(new Error('Failed to create blob from canvas'));
              }
            },
            mimeType,
            quality
          );
        } catch (error) {
          document.body.removeChild(container);
          reject(error);
        }
      };

      iframe.onerror = () => {
        document.body.removeChild(container);
        reject(new Error('Failed to load iframe'));
      };

      // Write HTML to iframe
      const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
      iframeDoc.open();
      iframeDoc.write(populatedHtml);
      iframeDoc.close();
    });
  };

  // Convert static image to format
  const convertStaticImage = async (creative) => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';

      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;

        const ctx = canvas.getContext('2d');

        // Fill with white background for JPEG
        if (format === 'jpg') {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        ctx.drawImage(img, 0, 0);

        const mimeType = format === 'jpg' ? 'image/jpeg' : 'image/png';
        const quality = format === 'jpg' ? 0.92 : undefined;

        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Failed to create blob from canvas'));
            }
          },
          mimeType,
          quality
        );
      };

      img.onerror = () => {
        reject(new Error(`Failed to load image: ${creative.filename}`));
      };

      // Use fullResUrl if available, otherwise url
      img.src = creative.fullResUrl || creative.url;
    });
  };

  // Generate filename for a creative
  const generateFilename = (creative) => {
    const ext = format === 'jpg' ? 'jpg' : 'png';

    if (creative.isDynamic && creative.messageData) {
      const msg = creative.messageData;
      const size = creative.bannerSize;
      return `MC${msg.number}_${msg.variant}_${size.width}x${size.height}.${ext}`;
    }

    // For static images, replace the extension
    const baseName = creative.filename.replace(/\.[^.]+$/, '');
    return `${baseName}.${ext}`;
  };

  // Main export function
  const handleExport = async () => {
    if (selectedCreatives.length === 0) return;

    setExporting(true);
    setProgress({ current: 0, total: selectedCreatives.length, message: 'Starting export...' });

    const zip = new JSZip();
    const errors = [];

    for (let i = 0; i < selectedCreatives.length; i++) {
      const creative = selectedCreatives[i];
      const filename = generateFilename(creative);

      setProgress({
        current: i + 1,
        total: selectedCreatives.length,
        message: `Processing ${filename}...`
      });

      try {
        let blob;
        if (creative.isDynamic) {
          blob = await captureHtmlCreative(creative);
        } else {
          blob = await convertStaticImage(creative);
        }
        zip.file(filename, blob);
      } catch (error) {
        console.error(`Failed to export ${filename}:`, error);
        errors.push(`${filename}: ${error.message}`);
      }
    }

    setProgress({
      current: selectedCreatives.length,
      total: selectedCreatives.length,
      message: 'Creating ZIP file...'
    });

    try {
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const timestamp = new Date().toISOString().slice(0, 10);
      saveAs(zipBlob, `creatives-export-${timestamp}.zip`);

      setProgress({
        current: selectedCreatives.length,
        total: selectedCreatives.length,
        message: errors.length > 0
          ? `Export complete with ${errors.length} errors`
          : 'Export complete!'
      });

      // Show errors if any
      if (errors.length > 0) {
        console.warn('Export errors:', errors);
      }

      // Auto-close after success
      setTimeout(() => {
        setExporting(false);
        onClose();
      }, 1500);
    } catch (error) {
      console.error('Failed to create ZIP:', error);
      setProgress({
        current: 0,
        total: selectedCreatives.length,
        message: `Error: ${error.message}`
      });
      setExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="rounded-lg ui-shadow w-full max-w-md" style={{ backgroundColor: selectedBaseColor }}>
        <div className="flex items-center justify-between p-6 border-b border-white/20">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Image size={20} />
            Export Images
          </h3>
          <button
            onClick={onClose}
            disabled={exporting}
            className="p-2 hover:bg-white/20 rounded transition-colors disabled:opacity-50"
          >
            <X size={20} className="text-white" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Selection Summary */}
          <div className="bg-white/10 rounded-lg p-3">
            <div className="text-sm text-white/80">
              <span className="font-medium text-white">{selectedCreatives.length}</span> creative{selectedCreatives.length !== 1 ? 's' : ''} selected
            </div>
            <div className="text-xs text-white/60 mt-1">
              {htmlCount > 0 && <span>{htmlCount} HTML ad{htmlCount !== 1 ? 's' : ''}</span>}
              {htmlCount > 0 && staticCount > 0 && <span> + </span>}
              {staticCount > 0 && <span>{staticCount} static image{staticCount !== 1 ? 's' : ''}</span>}
            </div>
          </div>

          {/* Delay Input (only relevant for HTML ads) */}
          {htmlCount > 0 && (
            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Capture Delay (ms)
                <span className="text-white/60 font-normal ml-2">for HTML animations</span>
              </label>
              <input
                type="number"
                value={delay}
                onChange={(e) => setDelay(Math.max(0, parseInt(e.target.value) || 0))}
                disabled={exporting}
                min="0"
                step="500"
                className="w-full px-3 py-2 bg-white/20 border border-white/40 rounded text-white focus:outline-none focus:ring-2 focus:ring-white/50 disabled:opacity-50"
              />
              <p className="text-xs text-white/60 mt-1">
                Wait time before capturing (default: 2000ms for animations)
              </p>
            </div>
          )}

          {/* Format Selector */}
          <div>
            <label className="block text-sm font-medium text-white mb-2">
              Output Format
            </label>
            <div className="flex gap-3">
              <button
                onClick={() => setFormat('png')}
                disabled={exporting}
                className={`flex-1 px-4 py-2 rounded border-2 transition-colors ${
                  format === 'png'
                    ? 'border-white bg-white/20 text-white'
                    : 'border-white/40 bg-white/10 text-white/80 hover:border-white/60'
                } disabled:opacity-50`}
              >
                PNG
              </button>
              <button
                onClick={() => setFormat('jpg')}
                disabled={exporting}
                className={`flex-1 px-4 py-2 rounded border-2 transition-colors ${
                  format === 'jpg'
                    ? 'border-white bg-white/20 text-white'
                    : 'border-white/40 bg-white/10 text-white/80 hover:border-white/60'
                } disabled:opacity-50`}
              >
                JPG
              </button>
            </div>
          </div>

          {/* Progress */}
          {exporting && (
            <div className="bg-white/10 rounded-lg p-4">
              <div className="flex items-center gap-3 mb-2">
                <Loader2 size={20} className="text-white animate-spin" />
                <span className="text-white text-sm">{progress.message}</span>
              </div>
              <div className="w-full bg-white/20 rounded-full h-2">
                <div
                  className="bg-white h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(progress.current / progress.total) * 100}%` }}
                />
              </div>
              <div className="text-xs text-white/60 mt-1 text-right">
                {progress.current} / {progress.total}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 p-6 border-t border-white/20">
          <button
            onClick={onClose}
            disabled={exporting}
            className="px-4 py-2 bg-transparent border border-white text-white rounded hover:bg-white/20 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            disabled={exporting || selectedCreatives.length === 0}
            className="px-4 py-2 bg-transparent border border-white text-white rounded hover:bg-white/20 transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            {exporting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download size={16} />
                Export ZIP
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExportImagesDialog;
