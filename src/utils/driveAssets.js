/**
 * Google Drive Assets Utility
 * Handles loading and managing assets from Google Drive
 */

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

    const response = await fetch(`/api/drive/files?${params}`);

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

    const response = await fetch('/api/drive/upload', {
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

    const response = await fetch('/api/drive/upload-batch', {
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
    const response = await fetch(`/api/drive/files/${fileId}`, {
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
    const response = await fetch('/api/drive/quota');

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

    const response = await fetch(`/api/drive/search?${params}`);

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
    const response = await fetch('/api/config');

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
 * Parse Drive file to asset data structure
 * Creates structured asset data from Drive file metadata
 * @param {Object} driveFile - Drive file object from API
 * @returns {Object} - Structured asset data
 */
export const parseDriveAssetData = (driveFile) => {
  const metadata = parseAssetFilename(driveFile.name);

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

  return {
    ID: driveFile.id,
    Brand: metadata.brand,
    Product: metadata.product,
    Type: metadata.type,
    Visual_keyword: metadata.visualKeyword,
    Visual_description: metadata.visualDescription,
    Placeholder_name: metadata.placeholderName,
    Version: metadata.version,
    Format: metadata.format,
    File_name: driveFile.name,
    File_date: driveFile.modifiedTime || driveFile.createdTime,
    File_dimensions: fileDimensions, // Actual dimensions from file properties
    File_DirectLink: directLink,
    File_DriveID: driveFile.id,

    // Additional fields for UI compatibility
    id: driveFile.id,
    name: driveFile.name,
    filename: driveFile.name,
    url: imageUrl, // Use proxy URL for display
    thumbnail: driveFile.thumbnail || imageUrl,
    extension: metadata.format,
    size: formatFileSize(parseInt(driveFile.size)),
    date: formatDate(driveFile.modifiedTime || driveFile.createdTime),
    brand: metadata.brand,
    product: metadata.product,
    type: metadata.type,
    variant: metadata.version,
    platforms: [],
    tags: [],
    source: 'drive'
  };
};
