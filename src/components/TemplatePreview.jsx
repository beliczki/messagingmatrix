import React from 'react';
import settings from '../services/settings';

/**
 * Reusable template preview component
 * Shows an iframe with populated template content
 */
const TemplatePreview = ({
  templateHtml,
  message,
  previewSize = '300x250',
  className = '',
  templateConfig = null
}) => {
  // Helper function to build full image URL using template.json path-messagingmatrix parameter
  const buildImageUrl = (imageKey, filename) => {
    if (!filename) return '';
    // If filename already starts with http:// or https://, use it as-is
    if (filename.startsWith('http://') || filename.startsWith('https://')) {
      return filename;
    }

    // Map image keys to placeholder names in template.json
    const placeholderMap = {
      'image1': 'background_image_1',
      'image2': 'background_image_2',
      'image3': 'background_image_3',
      'image4': 'background_image_4',
      'image5': 'brand_image_1',
      'image6': 'sticker_image_1',
      'video1': 'background_video_1'
    };

    // Get the placeholder name for this image key
    const placeholderName = placeholderMap[imageKey.toLowerCase()];

    // Try to get path from template config first
    if (templateConfig && placeholderName && templateConfig.placeholders) {
      const placeholder = templateConfig.placeholders[placeholderName];
      if (placeholder && placeholder['path-messagingmatrix']) {
        return placeholder['path-messagingmatrix'] + filename;
      }
    }

    // Fallback to settings imageBaseUrls if template config doesn't have the path
    const imageBaseUrls = settings.getImageBaseUrls();
    return (imageBaseUrls[imageKey] || '') + filename;
  };

  // Populate template with message data
  const populateTemplate = (html, msg) => {
    if (!msg || !html) return html;

    let result = html;

    if (templateConfig && templateConfig.placeholders) {
      // Use dynamic mapping from template.json
      Object.keys(templateConfig.placeholders).forEach(placeholderName => {
        const config = templateConfig.placeholders[placeholderName];
        const binding = config['binding-messagingmatrix'];
        let value = config.default || '';

        if (binding) {
          // Support both "message.Headline" and just "Headline" formats
          const fieldName = binding.replace(/^message\./i, '').toLowerCase();
          value = msg[fieldName] || value;

          // For image types, build the full URL
          if (config.type === 'image' && value) {
            // Determine image key from field name (e.g., "image1" -> "image1")
            value = buildImageUrl(fieldName, value);
          }
        }

        // Replace all occurrences of this placeholder
        const regex = new RegExp(`\\{\\{${placeholderName}\\}\\}`, 'g');
        result = result.replace(regex, value);
      });
    }

    // Remove any remaining placeholders and bracketed content
    result = result
      .replace(/\{\{[^}]+\}\}/g, '')
      .replace(/\[\[[^\]]+\]\]/g, '');

    return result;
  };

  // Get populated HTML
  const populatedHtml = populateTemplate(templateHtml, message);

  // Parse preview size
  const [width, height] = previewSize.split('x').map(Number);

  // Check if either dimension is >= 1080, then scale to 50%
  const shouldScale = width >= 1080 || height >= 1080;
  const scale = shouldScale ? 0.5 : 1;
  const scaledWidth = width * scale;
  const scaledHeight = height * scale;

  return (
    <div className={className} style={{
      width: `${scaledWidth}px`,
      height: `${scaledHeight}px`,
      overflow: 'hidden',
      position: 'relative'
    }}>
      <iframe
        srcDoc={populatedHtml}
        style={{
          width: `${width}px`,
          height: `${height}px`,
          transform: shouldScale ? 'scale(0.5)' : 'none',
          transformOrigin: 'top left',
          border: 0,
          position: 'absolute',
          top: 0,
          left: 0
        }}
        title="Template Preview"
        sandbox="allow-same-origin"
      />
    </div>
  );
};

export default TemplatePreview;
