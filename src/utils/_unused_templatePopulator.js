import settings from '../services/settings';

// Helper function to build full image URL
export const buildImageUrl = (imageKey, filename) => {
  if (!filename) return '';
  // If filename already starts with http:// or https://, use it as-is
  if (filename.startsWith('http://') || filename.startsWith('https://')) {
    return filename;
  }
  // Get image base URLs from settings
  const imageBaseUrls = settings.getImageBaseUrls();
  // Otherwise, prepend the base URL
  return (imageBaseUrls[imageKey] || '') + filename;
};

// Populate template with message data
export const populateTemplate = (templateHtml, message) => {
  if (!message) return templateHtml;

  return templateHtml
    .replace(/\{\{headline_text_1\}\}/g, message.headline || '')
    .replace(/\{\{copy_text_1\}\}/g, message.copy1 || '')
    .replace(/\{\{copy_text_2\}\}/g, message.copy2 || '')
    .replace(/\{\{cta_text_1\}\}/g, message.cta || '')
    .replace(/\{\{sticker_text_1\}\}/g, message.flash || '')
    .replace(/\{\{background_image_1\}\}/g, buildImageUrl('image1', message.image1))
    .replace(/\{\{background_image_2\}\}/g, buildImageUrl('image2', message.image2))
    .replace(/\{\{background_image_3\}\}/g, buildImageUrl('image3', message.image3))
    .replace(/\{\{brand_image_1\}\}/g, buildImageUrl('image5', message.image5))
    .replace(/\{\{sticker_image_1\}\}/g, buildImageUrl('image6', message.image6))
    .replace(/\{\{[^}]+\}\}/g, '')
    .replace(/\[\[[^\]]+\]\]/g, '');
};
