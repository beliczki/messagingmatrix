/**
 * Google Drive Assets Utility
 * Handles loading and managing assets from Google Drive
 */

import { apiGet, authenticatedFetch } from './api.js';

/**
 * Load assets from Google Drive
 * @param {string} folderType - 'assets' or 'creatives'
 * @param {Object} options - Query options (pageSize, pageToken, orderBy)
 * @returns {Promise<Object>} - {files: Array, nextPageToken: string}
 */
export const loadDriveAssets = async (folderType = 'assets', options = {}) => {
  try {
    const params = new URLSearchParams({
      folderType,
      pageSize: options.pageSize || 100,
      orderBy: options.orderBy || 'createdTime desc'
    });

    if (options.pageToken) {
      params.append('pageToken', options.pageToken);
    }

    const response = await apiGet(`/api/drive/files?${params}`);

    if (!response.ok) {
      throw new Error(`Failed to load Drive assets: ${response.statusText}`);
    }

    const data = await response.json();

    // Transform Drive files to match local asset format
    const transformedFiles = data.files.map(file => ({
      id: file.id,
      name: file.name,
      url: file.webContentLink,
      publicUrl: `https://drive.google.com/uc?export=download&id=${file.id}`,
      thumbnail: file.mimeType.startsWith('image/')
        ? `https://drive.google.com/thumbnail?id=${file.id}&sz=w400`
        : null,
      size: parseInt(file.size),
      mimeType: file.mimeType,
      createdTime: file.createdTime,
      modifiedTime: file.modifiedTime,
      webViewLink: file.webViewLink,
      source: 'drive',
      properties: file.properties || {},
      description: file.description || '',
      imageMediaMetadata: file.imageMediaMetadata, // Include image metadata
      videoMediaMetadata: file.videoMediaMetadata  // Include video metadata
    }));

    return {
      files: transformedFiles,
      nextPageToken: data.nextPageToken
    };
  } catch (error) {
    console.error('Error loading Drive assets:', error);
    throw error;
  }
};

/**
 * Upload file to Google Drive
 * @param {File} file - File to upload
 * @param {string} folderType - 'assets' or 'creatives'
 * @param {Object} metadata - File metadata
 * @returns {Promise<Object>} - Uploaded file information
 */
export const uploadToDrive = async (file, folderType = 'assets', metadata = {}) => {
  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('folderType', folderType);
    formData.append('metadata', JSON.stringify(metadata));

    const response = await authenticatedFetch('/api/drive/upload', {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      throw new Error(`Failed to upload to Drive: ${response.statusText}`);
    }

    const data = await response.json();
    return data.file;
  } catch (error) {
    console.error('Error uploading to Drive:', error);
    throw error;
  }
};

/**
 * Upload multiple files to Google Drive
 * @param {File[]} files - Files to upload
 * @param {string} folderType - 'assets' or 'creatives'
 * @param {Object} metadata - File metadata
 * @returns {Promise<Array>} - Array of upload results
 */
export const uploadMultipleToDrive = async (files, folderType = 'assets', metadata = {}) => {
  try {
    const formData = new FormData();

    files.forEach(file => {
      formData.append('files', file);
    });

    formData.append('folderType', folderType);
    formData.append('metadata', JSON.stringify(metadata));

    const response = await authenticatedFetch('/api/drive/upload-batch', {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      throw new Error(`Failed to upload to Drive: ${response.statusText}`);
    }

    const data = await response.json();
    return data.results;
  } catch (error) {
    console.error('Error uploading to Drive:', error);
    throw error;
  }
};

/**
 * Delete file from Google Drive
 * @param {string} fileId - Google Drive file ID
 * @returns {Promise<boolean>} - Success status
 */
export const deleteDriveFile = async (fileId) => {
  try {
    const response = await authenticatedFetch(`/api/drive/files/${fileId}`, {
      method: 'DELETE'
    });

    if (!response.ok) {
      throw new Error(`Failed to delete file from Drive: ${response.statusText}`);
    }

    return true;
  } catch (error) {
    console.error('Error deleting file from Drive:', error);
    throw error;
  }
};

/**
 * Get storage quota information
 * @returns {Promise<Object>} - Quota information
 */
export const getDriveQuota = async () => {
  try {
    const response = await apiGet('/api/drive/quota');

    if (!response.ok) {
      throw new Error(`Failed to get Drive quota: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error getting Drive quota:', error);
    throw error;
  }
};

/**
 * Search files in Google Drive
 * @param {string} searchTerm - Search term
 * @param {string} folderType - 'assets' or 'creatives'
 * @returns {Promise<Array>} - Matching files
 */
export const searchDriveFiles = async (searchTerm, folderType = 'assets') => {
  try {
    const params = new URLSearchParams({
      q: searchTerm,
      folderType
    });

    const response = await apiGet(`/api/drive/search?${params}`);

    if (!response.ok) {
      throw new Error(`Failed to search Drive files: ${response.statusText}`);
    }

    const data = await response.json();

    // Transform results
    const transformedFiles = data.files.map(file => ({
      id: file.id,
      name: file.name,
      url: file.webContentLink,
      publicUrl: `https://drive.google.com/uc?export=download&id=${file.id}`,
      thumbnail: file.mimeType.startsWith('image/')
        ? `https://drive.google.com/thumbnail?id=${file.id}&sz=w400`
        : null,
      size: parseInt(file.size),
      mimeType: file.mimeType,
      createdTime: file.createdTime,
      source: 'drive',
      properties: file.properties || {}
    }));

    return transformedFiles;
  } catch (error) {
    console.error('Error searching Drive files:', error);
    throw error;
  }
};

/**
 * Check if Google Drive storage is enabled
 * @returns {Promise<boolean>} - True if Drive is enabled
 */
export const isDriveEnabled = async () => {
  try {
    const response = await apiGet('/api/config');

    if (!response.ok) {
      return false;
    }

    const config = await response.json();
    return config.googleDrive && config.googleDrive.enabled;
  } catch (error) {
    console.error('Error checking Drive status:', error);
    return false;
  }
};

/**
 * Format file size for display
 * @param {number} bytes - File size in bytes
 * @returns {string} - Formatted size (e.g., "1.5 MB")
 */
export const formatFileSize = (bytes) => {
  if (!bytes) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
};

/**
 * Format date for display
 * @param {string} isoDate - ISO date string
 * @returns {string} - Formatted date
 */
export const formatDate = (isoDate) => {
  if (!isoDate) return '';

  const date = new Date(isoDate);
  const now = new Date();
  const diffMs = now - date;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;

  return date.toLocaleDateString();
};

/**
 * Merge local and Drive assets
 * @param {Array} localAssets - Assets from local storage
 * @param {Array} driveAssets - Assets from Google Drive
 * @param {string} storageMode - 'local', 'drive', or 'both'
 * @returns {Array} - Merged asset list
 */
export const mergeAssets = (localAssets, driveAssets, storageMode = 'both') => {
  if (storageMode === 'local') return localAssets;
  if (storageMode === 'drive') return driveAssets;

  // Merge both, Drive files first
  return [...driveAssets, ...localAssets];
};

/**
 * Parse asset filename to extract metadata
 * Pattern: Brand_Product_Type_Visual-keyword_Visual-description_Dimensions_Placeholder-name_Cropping-template_Version.format
 * @param {string} filename - Full filename
 * @returns {Object} - Parsed metadata
 */
export const parseAssetFilename = (filename) => {
  // Remove extension
  const parts = filename.split('.');
  const extension = parts.pop();
  const nameWithoutExt = parts.join('.');

  // Split by underscore
  const segments = nameWithoutExt.split('_');

  // Initialize default values
  const metadata = {
    brand: '',
    product: '',
    type: '',
    visualKeyword: '',
    visualDescription: '',
    dimensions: '',
    placeholderName: '',
    croppingTemplate: '',
    version: '',
    format: extension
  };

  // Parse segments if we have the expected pattern
  if (segments.length >= 9) {
    metadata.brand = segments[0] || '';
    metadata.product = segments[1] || '';
    metadata.type = segments[2] || '';
    metadata.visualKeyword = segments[3] || '';
    metadata.visualDescription = segments[4] || '';
    metadata.dimensions = segments[5] || '';
    metadata.placeholderName = segments[6] || '';
    metadata.croppingTemplate = segments[7] || '';

    // Extract version number from last segment (e.g., "v1" -> "1")
    const versionMatch = segments[8].match(/v?(\d+)/i);
    metadata.version = versionMatch ? versionMatch[1] : segments[8];
  } else {
    // Fallback: try to extract whatever we can
    metadata.brand = segments[0] || '';
    metadata.product = segments[1] || '';
    metadata.type = segments[2] || '';

    // Try to find version in any segment
    for (const segment of segments) {
      const versionMatch = segment.match(/v?(\d+)/i);
      if (versionMatch) {
        metadata.version = versionMatch[1];
        break;
      }
    }

    // Try to find dimensions pattern (e.g., 1200x628)
    for (const segment of segments) {
      if (/\d+x\d+/i.test(segment)) {
        metadata.dimensions = segment;
        break;
      }
    }
  }

  return metadata;
};

/**
 * Helper to get nested keywords from dot notation path
 * e.g., "creatives.product" -> keywords.creatives.product
 * @param {Object} keywords - Keywords object
 * @param {string} path - Dot notation path
 * @returns {Array|null} - Array of keywords or null
 */
const getNestedKeywords = (keywords, path) => {
  if (!path || !keywords) return null;
  const parts = path.split('.');
  let current = keywords;
  for (const part of parts) {
    if (!current || !current[part]) return null;
    current = current[part];
  }
  return Array.isArray(current) ? current : null;
};

/**
 * Apply a single parsing rule to extract a field value
 * @param {Array} segments - Filename segments (split by _)
 * @param {Object} rule - Parsing rule configuration
 * @param {Object} keywords - Keywords for matching
 * @param {string} extension - File extension
 * @param {Set} usedIndices - Set of already-used segment indices (for 'remaining' rule)
 * @returns {string|{value: string, index: number}} - Extracted value (or object with index for tracking)
 */
const applyParsingRule = (segments, rule, keywords, extension, usedIndices = new Set()) => {
  if (!rule) return '';

  switch (rule.rule) {
    case 'fixed':
      return rule.value || '';

    case 'segment':
      return segments[rule.index] || '';

    case 'after_segment': {
      // Find segment with afterValue and return next segment
      const idx = segments.findIndex(s => s.toUpperCase() === (rule.afterValue || '').toUpperCase());
      if (idx >= 0 && idx < segments.length - 1) {
        const nextSegment = segments[idx + 1];
        // Optionally match against keywords
        if (rule.matchKeywords && keywords) {
          const keywordList = getNestedKeywords(keywords, rule.keywordsCategory);
          if (keywordList) {
            // Check if next segment matches any keyword (case insensitive)
            const matched = keywordList.find(k => k.toUpperCase() === nextSegment.toUpperCase());
            if (matched) return matched;
          }
        }
        return nextSegment;
      }
      return '';
    }

    case 'after_pattern': {
      // Find segment matching pattern and return the NEXT segment
      const regex = new RegExp(rule.pattern);
      for (let i = 0; i < segments.length - 1; i++) {
        if (regex.test(segments[i])) {
          return segments[i + 1];
        }
      }
      return '';
    }

    case 'last_segment': {
      // Get the last segment and optionally validate with pattern
      const lastSegment = segments[segments.length - 1] || '';
      if (rule.pattern) {
        const regex = new RegExp(rule.pattern);
        const match = lastSegment.match(regex);
        if (match) {
          return rule.extractGroup !== undefined ? (match[rule.extractGroup] || match[0]) : match[0];
        }
      }
      return lastSegment;
    }

    case 'pattern': {
      const regex = new RegExp(rule.pattern);
      // Search all segments for match
      for (const segment of segments) {
        const match = segment.match(regex);
        if (match) {
          return rule.extractGroup !== undefined ? (match[rule.extractGroup] || '') : match[0];
        }
      }
      return '';
    }

    case 'remaining': {
      // Collect all segments that weren't matched by other rules
      // This should be processed LAST after all other rules have marked their used indices
      const remaining = [];
      for (let i = 0; i < segments.length; i++) {
        if (!usedIndices.has(i)) {
          remaining.push(segments[i]);
        }
      }
      return remaining.join('_');
    }

    case 'extension_type': {
      // Return "video" for video extensions, "image" otherwise
      const videoExtensions = ['mp4', 'webm', 'mov', 'avi', 'mkv'];
      return videoExtensions.includes(extension?.toLowerCase()) ? 'video' : 'image';
    }

    case 'empty':
      // Explicitly return empty string
      return '';

    default:
      return '';
  }
};

/**
 * Parse creative filename using configurable rules
 * @param {string} filename - Full filename
 * @param {Object} parsingRules - Rules from settings.getCreativeParsingRules()
 * @param {Object} keywords - Keywords from matrixData.keywords for product matching
 * @returns {Object} - Parsed metadata
 */
export const parseCreativeFilename = (filename, parsingRules, keywords = {}) => {
  // Remove extension
  const parts = filename.split('.');
  const extension = parts.pop();
  const nameWithoutExt = parts.join('.');

  // Split by underscore
  const segments = nameWithoutExt.split('_');

  const metadata = {
    File_format: extension,
    File_name: filename
  };

  // Track which segment indices are used
  const usedIndices = new Set();

  // Helper to mark segment index as used based on rule type and value
  const markUsedIndex = (rule, value) => {
    if (!rule || !value) return;

    switch (rule.rule) {
      case 'segment':
        usedIndices.add(rule.index);
        break;

      case 'after_segment': {
        const idx = segments.findIndex(s => s.toUpperCase() === (rule.afterValue || '').toUpperCase());
        if (idx >= 0) {
          usedIndices.add(idx); // Mark the "afterValue" segment
          usedIndices.add(idx + 1); // Mark the next segment (the value)
        }
        break;
      }

      case 'after_pattern': {
        const regex = new RegExp(rule.pattern);
        for (let i = 0; i < segments.length - 1; i++) {
          if (regex.test(segments[i])) {
            usedIndices.add(i); // Mark the pattern segment
            usedIndices.add(i + 1); // Mark the next segment (the value)
            break;
          }
        }
        break;
      }

      case 'last_segment':
        usedIndices.add(segments.length - 1);
        break;

      case 'pattern': {
        const regex = new RegExp(rule.pattern);
        for (let i = 0; i < segments.length; i++) {
          if (regex.test(segments[i])) {
            usedIndices.add(i);
            break;
          }
        }
        break;
      }
    }
  };

  // Process each rule (except 'remaining' which must be last)
  if (parsingRules) {
    // First pass: process all non-remaining rules
    Object.entries(parsingRules).forEach(([fieldName, rule]) => {
      if (rule?.rule === 'remaining') return; // Skip for now
      const value = applyParsingRule(segments, rule, keywords, extension, usedIndices);
      metadata[fieldName] = value;
      // Debug Type and Visual_keyword specifically
      if (fieldName === 'Type' || fieldName === 'Visual_keyword') {
        console.log(`🔍 parseCreativeFilename: ${fieldName} rule=${rule?.rule}, value="${value}", extension="${extension}"`);
      }
      markUsedIndex(rule, value);
    });

    // Second pass: process 'remaining' rules with the usedIndices set
    Object.entries(parsingRules).forEach(([fieldName, rule]) => {
      if (rule?.rule !== 'remaining') return;
      metadata[fieldName] = applyParsingRule(segments, rule, keywords, extension, usedIndices);
    });
  }

  return metadata;
};

/**
 * Parse Drive file to asset data structure
 * Creates structured asset data from Drive file metadata
 * @param {Object} driveFile - Drive file object from API
 * @param {Object} parsingRules - Optional parsing rules from settings
 * @param {Object} keywords - Optional keywords for product matching
 * @returns {Object} - Structured asset data
 */
export const parseDriveAssetData = (driveFile, parsingRules = null, keywords = null) => {
  // Use proxy endpoint to serve Drive files through our backend
  const imageUrl = `/api/drive/proxy/${driveFile.id}`;
  const directLink = driveFile.webContentLink || `https://drive.google.com/uc?export=view&id=${driveFile.id}`;

  // Get actual dimensions from Drive file metadata (not filename)
  let fileDimensions = '';
  if (driveFile.imageMediaMetadata && driveFile.imageMediaMetadata.width && driveFile.imageMediaMetadata.height) {
    fileDimensions = `${driveFile.imageMediaMetadata.width}x${driveFile.imageMediaMetadata.height}`;
    console.log(`📐 Image dimensions for ${driveFile.name}: ${fileDimensions}`);
  } else if (driveFile.videoMediaMetadata && driveFile.videoMediaMetadata.width && driveFile.videoMediaMetadata.height) {
    fileDimensions = `${driveFile.videoMediaMetadata.width}x${driveFile.videoMediaMetadata.height}`;
    console.log(`📐 Video dimensions for ${driveFile.name}: ${fileDimensions}`);
  } else {
    console.log(`⚠️ No metadata for ${driveFile.name}:`, {
      hasImageMeta: !!driveFile.imageMediaMetadata,
      hasVideoMeta: !!driveFile.videoMediaMetadata,
      mimeType: driveFile.mimeType
    });
  }

  // Use configurable parser if rules provided, otherwise fall back to legacy parser
  let parsedData;
  console.log(`🔧 parseDriveAssetData called for ${driveFile.name} with parsingRules:`, parsingRules ? `${Object.keys(parsingRules).length} rules (${Object.keys(parsingRules).join(', ')})` : 'null');
  if (parsingRules && Object.keys(parsingRules).length > 0) {
    // Use configurable parser
    parsedData = parseCreativeFilename(driveFile.name, parsingRules, keywords || {});
    console.log(`🔧 Parsed ${driveFile.name} with configurable parser:`, parsedData);
  } else {
    console.warn(`⚠️ Using LEGACY parser for ${driveFile.name} - no parsing rules provided!`);
    // Fall back to legacy parser for backwards compatibility
    const legacyMetadata = parseAssetFilename(driveFile.name);
    parsedData = {
      Brand: legacyMetadata.brand,
      Product: legacyMetadata.product,
      Type: legacyMetadata.type,
      Visual_keyword: legacyMetadata.visualKeyword,
      Visual_description: legacyMetadata.visualDescription,
      Placeholder_name: legacyMetadata.placeholderName,
      Version: legacyMetadata.version,
      File_format: legacyMetadata.format,
      File_name: driveFile.name
    };
  }

  // Build result object merging parsed data with Drive file metadata
  const result = {
    // ID fields
    ID: driveFile.id,
    File_driveID: driveFile.id,

    // Parsed fields from filename (will be overwritten by parsedData)
    Brand: '',
    Product: '',
    Type: '',
    Visual_keyword: '',
    Visual_description: '',
    MC_Number: '',
    MC_Variant: '',
    Version: '',

    // File metadata from Drive
    File_format: parsedData.File_format || '',
    File_name: driveFile.name,
    File_size: formatFileSize(parseInt(driveFile.size)),
    File_date: driveFile.modifiedTime || driveFile.createdTime,
    File_dimensions: fileDimensions, // From actual file properties (more accurate)
    File_DirectLink: directLink,
    File_thumbnail: driveFile.thumbnail || imageUrl,
    Is_Dynamic: driveFile.mimeType?.includes('video') ? 'TRUE' : 'FALSE',

    // Spread parsed data to fill in configured fields
    ...parsedData,

    // Override File_dimensions with actual dimensions if available (more accurate than filename)
    File_dimensions: fileDimensions || parsedData.File_dimensions || '',

    // Additional fields for UI compatibility
    id: driveFile.id,
    name: driveFile.name,
    filename: driveFile.name,
    url: imageUrl, // Use proxy URL for display
    thumbnail: driveFile.thumbnail || imageUrl,
    extension: parsedData.File_format || '',
    size: formatFileSize(parseInt(driveFile.size)),
    date: formatDate(driveFile.modifiedTime || driveFile.createdTime),
    brand: parsedData.Brand || '',
    product: parsedData.Product || '',
    type: parsedData.Type || '',
    variant: parsedData.Version || '',
    platforms: [],
    tags: [],
    source: 'drive'
  };

  return result;
};
