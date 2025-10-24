// Asset JSON Manager - Utility for managing assets.json file
// This file provides functions to read, write, and update the assets registry

/**
 * Asset metadata structure following the naming pattern:
 * Brand_Product_Type_Visual_keyword_Visual_description_Dimensions_Placeholder_name_Cropping_template_Version_Format
 */
export const createAssetRecord = (filename, metadata) => {
  return {
    id: `${Date.now()}_${Math.random().toString(36).substring(7)}`,
    filename,
    originalFilename: metadata.originalFilename || filename,
    uploadDate: new Date().toISOString(),
    lastModified: new Date().toISOString(),
    metadata: {
      brand: metadata.brand || '',
      product: metadata.product || '',
      type: metadata.type || '',
      visualKeyword: metadata.visualKeyword || '',
      visualDescription: metadata.visualDescription || '',
      dimensions: metadata.dimensions || '',
      placeholderName: metadata.placeholderName || '',
      croppingTemplate: metadata.croppingTemplate || '',
      version: metadata.version || '1',
      format: metadata.format || filename.split('.').pop().toLowerCase()
    },
    // Additional metadata for searching/filtering
    tags: metadata.tags || [],
    platforms: metadata.platforms || [],
    status: metadata.status || 'active'
  };
};

/**
 * Generate filename from metadata following the pattern:
 * Brand_Product_Type_Visual_keyword_Visual_description_Dimensions_Placeholder_name_Cropping_template_Version_Format
 */
export const generateFilename = (metadata) => {
  const parts = [
    (metadata.brand || 'unknown').replace(/\s+/g, '-'),
    (metadata.product || 'unknown').replace(/\s+/g, '-'),
    (metadata.type || 'unknown').replace(/\s+/g, '-'),
    (metadata.visualKeyword || 'unknown').replace(/\s+/g, '-'),
    (metadata.visualDescription || 'desc').replace(/\s+/g, '-'),
    (metadata.dimensions || '').replace(/\s+/g, ''),
    (metadata.placeholderName || 'placeholder').replace(/\s+/g, '-'),
    (metadata.croppingTemplate || 'default').replace(/\s+/g, '-'),
    `v${metadata.version || '1'}`,
  ];

  const format = metadata.format || 'jpg';
  return `${parts.join('_')}.${format}`;
};

/**
 * Extract metadata from filename following the pattern:
 * Brand_Product_Type_Visual_keyword_Visual_description_Dimensions_Placeholder_name_Cropping_template_Version_Format
 */
export const extractMetadataFromFilename = (filename) => {
  const nameWithoutExt = filename.replace(/\.(jpg|jpeg|png|mp4|gif|webp|svg)$/i, '');
  const parts = nameWithoutExt.split('_');

  // Extract dimensions (look for patterns like 1200x628, 300x250, etc.)
  const dimensionsMatch = nameWithoutExt.match(/(\d+)x(\d+)/);
  const dimensions = dimensionsMatch ? dimensionsMatch[0] : '';

  // Extract version (look for patterns like v1, v2, v10, etc.)
  const versionMatch = nameWithoutExt.match(/v(\d+)/i);
  const version = versionMatch ? versionMatch[1] : '1';

  // Try to intelligently parse the parts
  let brand = '';
  let product = '';
  let type = '';
  let visualKeyword = '';
  let visualDescription = '';
  let placeholderName = '';
  let croppingTemplate = '';

  if (parts.length >= 9) {
    // Full pattern match
    [brand, product, type, visualKeyword, visualDescription, , placeholderName, croppingTemplate] = parts;
  } else if (parts.length >= 2) {
    // Partial match - try to extract what we can
    brand = parts[0] || '';
    product = parts[1] || '';
    type = parts[2] || '';
    visualKeyword = parts[3] || '';
    visualDescription = parts[4] || '';
    placeholderName = parts.length > 6 ? parts[parts.length - 3] : '';
    croppingTemplate = parts.length > 7 ? parts[parts.length - 2] : '';
  }

  return {
    brand: brand.replace(/-/g, ' '),
    product: product.replace(/-/g, ' '),
    type: type.replace(/-/g, ' '),
    visualKeyword: visualKeyword.replace(/-/g, ' '),
    visualDescription: visualDescription.replace(/-/g, ' '),
    dimensions,
    placeholderName: placeholderName.replace(/-/g, ' '),
    croppingTemplate: croppingTemplate.replace(/-/g, ' '),
    version,
    format: filename.split('.').pop().toLowerCase(),
    originalFilename: filename
  };
};

/**
 * Match keywords from filename to common asset values
 * This helps auto-populate metadata fields
 */
export const matchKeywordsToValues = (filename) => {
  const lowerFilename = filename.toLowerCase();

  // Common brand keywords
  const brands = ['nike', 'adidas', 'puma', 'reebok', 'apple', 'samsung', 'google'];
  const matchedBrand = brands.find(brand => lowerFilename.includes(brand));

  // Common types
  const types = ['banner', 'poster', 'social', 'video', 'carousel', 'story', 'reel'];
  const matchedType = types.find(type => lowerFilename.includes(type));

  // Common platforms (for tags)
  const platforms = [];
  if (lowerFilename.includes('fb') || lowerFilename.includes('facebook')) platforms.push('Facebook');
  if (lowerFilename.includes('ig') || lowerFilename.includes('instagram')) platforms.push('Instagram');
  if (lowerFilename.includes('google') || lowerFilename.includes('pmax')) platforms.push('Google');
  if (lowerFilename.includes('youtube') || lowerFilename.includes('yt')) platforms.push('YouTube');
  if (lowerFilename.includes('linkedin') || lowerFilename.includes('li')) platforms.push('LinkedIn');
  if (lowerFilename.includes('twitter') || lowerFilename.includes('tw')) platforms.push('Twitter');

  // Common visual keywords
  const visualKeywords = ['product', 'lifestyle', 'hero', 'logo', 'text', 'icon', 'photo'];
  const matchedVisualKeyword = visualKeywords.find(kw => lowerFilename.includes(kw));

  return {
    brand: matchedBrand || '',
    type: matchedType || '',
    platforms,
    visualKeyword: matchedVisualKeyword || ''
  };
};

/**
 * API helper to fetch assets.json
 */
export const fetchAssetsJson = async () => {
  try {
    const response = await fetch('/api/assets/registry');
    if (response.ok) {
      return await response.json();
    }
    return { assets: [] };
  } catch (error) {
    console.error('Error fetching assets.json:', error);
    return { assets: [] };
  }
};

/**
 * API helper to update assets.json
 */
export const updateAssetsJson = async (assetRecord) => {
  try {
    const response = await fetch('/api/assets/registry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(assetRecord)
    });

    if (response.ok) {
      return await response.json();
    }
    throw new Error('Failed to update assets registry');
  } catch (error) {
    console.error('Error updating assets.json:', error);
    throw error;
  }
};

/**
 * API helper to remove asset from assets.json
 */
export const removeFromAssetsJson = async (assetId) => {
  try {
    const response = await fetch('/api/assets/registry', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: assetId })
    });

    if (response.ok) {
      return await response.json();
    }
    throw new Error('Failed to remove asset from registry');
  } catch (error) {
    console.error('Error removing asset from registry:', error);
    throw error;
  }
};
