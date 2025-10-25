import React from 'react';
import settings from '../services/settings';
import mainCss from '../templates/html/main.css?raw';
import css300x250 from '../templates/html/300x250.css?raw';
import css300x600 from '../templates/html/300x600.css?raw';
import css640x360 from '../templates/html/640x360.css?raw';
import css970x250 from '../templates/html/970x250.css?raw';
import css1080x1080 from '../templates/html/1080x1080.css?raw';

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

  // Populate template with message data and inject CSS
  const populateTemplate = (html, msg) => {
    if (!html) return html;

    let result = html;

    // Inject CSS inline - replace <link> tags with <style> tags
    const cssMap = {
      '300x250': css300x250,
      '300x600': css300x600,
      '640x360': css640x360,
      '970x250': css970x250,
      '1080x1080': css1080x1080
    };

    const sizeCss = cssMap[previewSize] || '';

    if (mainCss && sizeCss) {
      const combinedCss = `${mainCss}\n${sizeCss}`;

      // Replace main.css link with inline styles
      result = result.replace(
        /<link rel="stylesheet" href="main\.css".*?>/i,
        `<style>${combinedCss}</style>`
      );

      // Remove [[css]] placeholder link
      result = result.replace(
        /<link rel="stylesheet" href="\[\[css\]\]".*?>/i,
        ''
      );
    }

    if (!msg) return result;

    if (templateConfig && templateConfig.placeholders) {
      // Use dynamic mapping from template.json
      Object.keys(templateConfig.placeholders).forEach(placeholderName => {
        const config = templateConfig.placeholders[placeholderName];
        const binding = config['binding-messagingmatrix'];
        let value = config.default || '';

        if (binding) {
          // Support both "message.Headline" and just "Headline" formats
          const fieldName = binding.replace(/^message\./i, '').toLowerCase();

          // Map all message fields including style and CSS
          const fieldMap = {
            'headline': msg.headline,
            'copy1': msg.copy1,
            'copy2': msg.copy2,
            'flash': msg.flash,
            'cta': msg.cta,
            'image1': msg.image1,
            'image2': msg.image2,
            'image3': msg.image3,
            'image4': msg.image4,
            'image5': msg.image5,
            'image6': msg.image6,
            'template_variant_classes': msg.template_variant_classes,
            // Style fields
            'headline_style': msg.headline_style,
            'copy1_style': msg.copy1_style,
            'copy2_style': msg.copy2_style,
            'flash_style': msg.flash_style,
            'cta_style': msg.cta_style,
            'disclaimer_style': msg.disclaimer_style,
            // CSS field
            'css_styles': msg.css,
            'css': msg.css
          };

          value = fieldMap[fieldName] || msg[fieldName] || value;

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
        sandbox="allow-same-origin allow-scripts"
      />
    </div>
  );
};

export default TemplatePreview;
