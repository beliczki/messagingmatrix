/**
 * Google Drive Storage Service
 * Handles all Google Drive operations for assets and creatives storage
 */

import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';

class DriveStorageService {
  constructor() {
    this.drive = null;
    this.auth = null;
    this.initialized = false;
    this.config = {
      assetsFolderId: null,
      creativesFolderId: null,
    };
  }

  /**
   * Initialize Drive service with service account credentials
   */
  async initialize(serviceAccountPath, assetsFolderId, creativesFolderId) {
    try {
      // Load service account credentials
      const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

      // Create JWT auth client
      this.auth = new google.auth.JWT({
        email: serviceAccount.client_email,
        key: serviceAccount.private_key,
        scopes: [
          'https://www.googleapis.com/auth/drive.file',
          'https://www.googleapis.com/auth/drive',
        ],
      });

      // Initialize Drive API
      this.drive = google.drive({ version: 'v3', auth: this.auth });

      // Store folder IDs
      this.config.assetsFolderId = assetsFolderId;
      this.config.creativesFolderId = creativesFolderId;

      this.initialized = true;
      console.log('✓ Google Drive storage initialized');
      return true;
    } catch (error) {
      console.error('Failed to initialize Google Drive storage:', error);
      throw error;
    }
  }

  /**
   * Check if service is initialized
   */
  ensureInitialized() {
    if (!this.initialized) {
      throw new Error('Drive storage service not initialized. Call initialize() first.');
    }
  }

  /**
   * Upload file to Google Drive
   * @param {Buffer|Stream} fileData - File data to upload
   * @param {string} fileName - Name for the file
   * @param {string} mimeType - MIME type of the file
   * @param {string} folderType - 'assets' or 'creatives'
   * @param {Object} metadata - Additional metadata for the file
   * @returns {Object} - File information including id and webViewLink
   */
  async uploadFile(fileData, fileName, mimeType, folderType = 'assets', metadata = {}) {
    this.ensureInitialized();

    try {
      const folderId = folderType === 'creatives'
        ? this.config.creativesFolderId
        : this.config.assetsFolderId;

      if (!folderId) {
        throw new Error(`Folder ID not configured for ${folderType}`);
      }

      // Convert Buffer to Stream if needed
      const fileStream = Buffer.isBuffer(fileData)
        ? Readable.from(fileData)
        : fileData;

      // Upload file
      const response = await this.drive.files.create({
        requestBody: {
          name: fileName,
          parents: [folderId],
          description: metadata.description || '',
          properties: {
            ...metadata,
            uploadDate: new Date().toISOString(),
            uploadedBy: 'messagingmatrix',
          },
        },
        media: {
          mimeType: mimeType,
          body: fileStream,
        },
        fields: 'id, name, mimeType, size, webViewLink, webContentLink, createdTime',
      });

      const file = response.data;

      // Make file publicly accessible (optional - configure based on needs)
      await this.makeFilePublic(file.id);

      // Get public URL
      const publicUrl = await this.getPublicUrl(file.id);

      console.log(`✓ Uploaded ${fileName} to Google Drive (${folderType})`);

      return {
        id: file.id,
        name: file.name,
        mimeType: file.mimeType,
        size: file.size,
        webViewLink: file.webViewLink,
        webContentLink: file.webContentLink,
        publicUrl: publicUrl,
        createdTime: file.createdTime,
        folderId: folderId,
        folderType: folderType,
      };
    } catch (error) {
      console.error('Error uploading file to Drive:', error);
      throw error;
    }
  }

  /**
   * Upload multiple files in batch
   * @param {Array} files - Array of {fileData, fileName, mimeType, metadata}
   * @param {string} folderType - 'assets' or 'creatives'
   * @returns {Array} - Array of uploaded file information
   */
  async uploadMultipleFiles(files, folderType = 'assets') {
    this.ensureInitialized();

    const results = [];
    for (const file of files) {
      try {
        const result = await this.uploadFile(
          file.fileData,
          file.fileName,
          file.mimeType,
          folderType,
          file.metadata || {}
        );
        results.push({ success: true, file: result });
      } catch (error) {
        results.push({ success: false, fileName: file.fileName, error: error.message });
      }
    }

    return results;
  }

  /**
   * Download file from Google Drive
   * @param {string} fileId - Google Drive file ID
   * @returns {Buffer} - File data
   */
  async downloadFile(fileId) {
    this.ensureInitialized();

    try {
      const response = await this.drive.files.get(
        { fileId: fileId, alt: 'media' },
        { responseType: 'arraybuffer' }
      );

      return Buffer.from(response.data);
    } catch (error) {
      console.error('Error downloading file from Drive:', error);
      throw error;
    }
  }

  /**
   * Get file metadata
   * @param {string} fileId - Google Drive file ID
   * @returns {Object} - File metadata
   */
  async getFileMetadata(fileId) {
    this.ensureInitialized();

    try {
      const response = await this.drive.files.get({
        fileId: fileId,
        fields: 'id, name, mimeType, size, webViewLink, webContentLink, createdTime, modifiedTime, properties, description',
      });

      return response.data;
    } catch (error) {
      console.error('Error getting file metadata:', error);
      throw error;
    }
  }

  /**
   * List files in a folder
   * @param {string} folderType - 'assets' or 'creatives'
   * @param {Object} options - Query options (pageSize, pageToken, query)
   * @returns {Object} - Files list and nextPageToken
   */
  async listFiles(folderType = 'assets', options = {}) {
    this.ensureInitialized();

    try {
      const folderId = folderType === 'creatives'
        ? this.config.creativesFolderId
        : this.config.assetsFolderId;

      if (!folderId) {
        throw new Error(`Folder ID not configured for ${folderType}`);
      }

      const query = options.query
        ? `'${folderId}' in parents and ${options.query} and trashed=false`
        : `'${folderId}' in parents and trashed=false`;

      const response = await this.drive.files.list({
        q: query,
        pageSize: options.pageSize || 100,
        pageToken: options.pageToken || null,
        fields: 'nextPageToken, files(id, name, mimeType, size, webViewLink, webContentLink, createdTime, modifiedTime, properties, description, imageMediaMetadata(width, height), videoMediaMetadata(width, height))',
        orderBy: options.orderBy || 'createdTime desc',
      });

      // Debug: Log first file to see what metadata we're getting
      if (response.data.files && response.data.files.length > 0) {
        const firstFile = response.data.files[0];
        console.log('📊 First file metadata:', {
          name: firstFile.name,
          mimeType: firstFile.mimeType,
          hasImageMeta: !!firstFile.imageMediaMetadata,
          hasVideoMeta: !!firstFile.videoMediaMetadata,
          imageMeta: firstFile.imageMediaMetadata,
          videoMeta: firstFile.videoMediaMetadata
        });
      }

      return {
        files: response.data.files || [],
        nextPageToken: response.data.nextPageToken,
      };
    } catch (error) {
      console.error('Error listing files from Drive:', error);
      throw error;
    }
  }

  /**
   * Delete file from Google Drive
   * @param {string} fileId - Google Drive file ID
   * @returns {boolean} - Success status
   */
  async deleteFile(fileId) {
    this.ensureInitialized();

    try {
      await this.drive.files.delete({ fileId: fileId });
      console.log(`✓ Deleted file ${fileId} from Google Drive`);
      return true;
    } catch (error) {
      console.error('Error deleting file from Drive:', error);
      throw error;
    }
  }

  /**
   * Update file metadata
   * @param {string} fileId - Google Drive file ID
   * @param {Object} metadata - Metadata to update
   * @returns {Object} - Updated file metadata
   */
  async updateFileMetadata(fileId, metadata) {
    this.ensureInitialized();

    try {
      const response = await this.drive.files.update({
        fileId: fileId,
        requestBody: metadata,
        fields: 'id, name, mimeType, size, webViewLink, webContentLink, properties, description',
      });

      return response.data;
    } catch (error) {
      console.error('Error updating file metadata:', error);
      throw error;
    }
  }

  /**
   * Make file publicly accessible
   * @param {string} fileId - Google Drive file ID
   * @returns {boolean} - Success status
   */
  async makeFilePublic(fileId) {
    this.ensureInitialized();

    try {
      await this.drive.permissions.create({
        fileId: fileId,
        requestBody: {
          role: 'reader',
          type: 'anyone',
        },
      });

      return true;
    } catch (error) {
      console.error('Error making file public:', error);
      throw error;
    }
  }

  /**
   * Get public URL for file
   * @param {string} fileId - Google Drive file ID
   * @returns {string} - Public URL
   */
  async getPublicUrl(fileId) {
    // Direct download URL format for public files
    return `https://drive.google.com/uc?export=download&id=${fileId}`;
  }

  /**
   * Search files by name or metadata
   * @param {string} searchTerm - Search term
   * @param {string} folderType - 'assets' or 'creatives'
   * @returns {Array} - Matching files
   */
  async searchFiles(searchTerm, folderType = 'assets') {
    this.ensureInitialized();

    try {
      const folderId = folderType === 'creatives'
        ? this.config.creativesFolderId
        : this.config.assetsFolderId;

      // Use only name search (not fullText) to allow sorting
      const query = `'${folderId}' in parents and name contains '${searchTerm}' and trashed=false`;

      const response = await this.drive.files.list({
        q: query,
        pageSize: 100,
        fields: 'files(id, name, mimeType, size, webViewLink, webContentLink, createdTime, modifiedTime, properties, description, imageMediaMetadata(width, height), videoMediaMetadata(width, height))',
        orderBy: 'name',
      });

      return response.data.files || [];
    } catch (error) {
      console.error('Error searching files:', error);
      throw error;
    }
  }

  /**
   * Create a new folder
   * @param {string} folderName - Name for the folder
   * @param {string} parentFolderId - Parent folder ID (optional)
   * @returns {Object} - Created folder information
   */
  async createFolder(folderName, parentFolderId = null) {
    this.ensureInitialized();

    try {
      const metadata = {
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
      };

      if (parentFolderId) {
        metadata.parents = [parentFolderId];
      }

      const response = await this.drive.files.create({
        requestBody: metadata,
        fields: 'id, name, webViewLink',
      });

      console.log(`✓ Created folder: ${folderName}`);
      return response.data;
    } catch (error) {
      console.error('Error creating folder:', error);
      throw error;
    }
  }

  /**
   * Move file to different folder
   * @param {string} fileId - Google Drive file ID
   * @param {string} newFolderType - 'assets' or 'creatives'
   * @returns {Object} - Updated file metadata
   */
  async moveFile(fileId, newFolderType) {
    this.ensureInitialized();

    try {
      const newFolderId = newFolderType === 'creatives'
        ? this.config.creativesFolderId
        : this.config.assetsFolderId;

      // Get current parents
      const file = await this.drive.files.get({
        fileId: fileId,
        fields: 'parents',
      });

      const previousParents = file.data.parents.join(',');

      // Move file
      const response = await this.drive.files.update({
        fileId: fileId,
        addParents: newFolderId,
        removeParents: previousParents,
        fields: 'id, name, parents',
      });

      console.log(`✓ Moved file ${fileId} to ${newFolderType}`);
      return response.data;
    } catch (error) {
      console.error('Error moving file:', error);
      throw error;
    }
  }

  /**
   * Get storage quota information
   * @returns {Object} - Storage quota details
   */
  async getStorageQuota() {
    this.ensureInitialized();

    try {
      const response = await this.drive.about.get({
        fields: 'storageQuota',
      });

      const quota = response.data.storageQuota;

      return {
        limit: parseInt(quota.limit),
        usage: parseInt(quota.usage),
        usageInDrive: parseInt(quota.usageInDrive),
        usageInDriveTrash: parseInt(quota.usageInDriveTrash),
        available: parseInt(quota.limit) - parseInt(quota.usage),
        percentUsed: ((parseInt(quota.usage) / parseInt(quota.limit)) * 100).toFixed(2),
      };
    } catch (error) {
      console.error('Error getting storage quota:', error);
      throw error;
    }
  }
}

// Create singleton instance
const driveStorage = new DriveStorageService();

export default driveStorage;
