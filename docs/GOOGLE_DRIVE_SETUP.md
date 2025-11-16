# Google Drive Storage Setup Guide

This guide explains how to set up Google Drive as cloud storage for assets and creatives in Messaging Matrix.

## Overview

Google Drive integration allows you to:
- Store assets and creatives in the cloud instead of local filesystem
- Access files from anywhere with internet connection
- Share files easily with team members
- Leverage Google's infrastructure for reliability and scalability
- Manage storage quota and permissions centrally

## Prerequisites

- Google Cloud Project with Drive API enabled
- Service account with JSON key file
- Two Google Drive folders (one for assets, one for creatives)

---

## Step 1: Enable Google Drive API

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project (or create a new one)
3. Navigate to **APIs & Services** → **Library**
4. Search for **Google Drive API**
5. Click **Enable**

---

## Step 2: Create Service Account (if not already done)

If you already have a service account for Google Sheets, you can use the same one for Drive.

**To create a new service account:**

1. Go to **APIs & Services** → **Credentials**
2. Click **Create Credentials** → **Service Account**
3. Fill in details:
   - Name: `messagingmatrix-service`
   - Description: `Service account for Messaging Matrix`
4. Click **Create and Continue**
5. Grant roles (optional): `Editor` or custom role
6. Click **Done**

---

## Step 3: Generate and Download JSON Key

1. Click on the created service account
2. Go to the **Keys** tab
3. Click **Add Key** → **Create New Key**
4. Choose **JSON** format
5. Click **Create**
6. Save the downloaded JSON file as `service-account.json` in your project root

**Important:** Keep this file secure and never commit it to version control!

---

## Step 4: Create Google Drive Folders

1. Open [Google Drive](https://drive.google.com/)
2. Create two folders:
   - `MessagingMatrix-Assets` (for uploaded assets like images)
   - `MessagingMatrix-Creatives` (for HTML creatives)

---

## Step 5: Share Folders with Service Account

1. Open each folder in Google Drive
2. Click **Share** button
3. Add the service account email address (found in `service-account.json` as `client_email`)
   - Example: `messagingmatrix-service@project-id.iam.gserviceaccount.com`
4. Set permission level to **Editor**
5. Uncheck **Notify people** (service accounts don't need notifications)
6. Click **Share**

**Repeat for both folders!**

---

## Step 6: Get Folder IDs

1. Open each folder in Google Drive
2. Look at the URL in your browser:
   ```
   https://drive.google.com/drive/folders/FOLDER_ID_HERE
   ```
3. Copy the `FOLDER_ID_HERE` part for each folder

Example Folder ID: `1a2B3c4D5e6F7g8H9i0J1k2L3m4N5o6P`

---

## Step 7: Update config.json

Edit `config.json` and add/update the `googleDrive` section:

```json
{
  "googleDrive": {
    "enabled": true,
    "assetsFolderId": "YOUR_ASSETS_FOLDER_ID",
    "creativesFolderId": "YOUR_CREATIVES_FOLDER_ID",
    "storageMode": "hybrid",
    "useForNewUploads": true
  }
}
```

**Configuration Options:**

- `enabled` (boolean): Enable/disable Google Drive storage
- `assetsFolderId` (string): Folder ID for assets
- `creativesFolderId` (string): Folder ID for creatives
- `storageMode` (string):
  - `"hybrid"` - Store in both Drive and local filesystem
  - `"drive-only"` - Store only in Google Drive
  - `"local-only"` - Store only in local filesystem
- `useForNewUploads` (boolean): Use Drive for new uploads when enabled

---

## Step 8: Verify Setup

1. Restart the server: `pm2 restart all`
2. Check the logs: `pm2 logs`
3. Look for: `✓ Google Drive storage initialized`

If you see this message, Drive storage is configured correctly!

---

## API Endpoints

Once configured, the following Drive API endpoints are available:

### Upload File
```
POST /api/drive/upload
Content-Type: multipart/form-data

Body:
- file: File to upload
- folderType: "assets" or "creatives" (default: "assets")
- metadata: JSON object with file metadata
```

### List Files
```
GET /api/drive/files?folderType=assets&pageSize=100&pageToken=&orderBy=createdTime desc
```

### Get File Metadata
```
GET /api/drive/files/:fileId
```

### Download File
```
GET /api/drive/download/:fileId
```

### Delete File
```
DELETE /api/drive/files/:fileId
```

### Update File Metadata
```
PATCH /api/drive/files/:fileId
Body: { metadata: {...} }
```

### Search Files
```
GET /api/drive/search?q=searchTerm&folderType=assets
```

### Move File
```
POST /api/drive/files/:fileId/move
Body: { folderType: "assets" | "creatives" }
```

### Get Storage Quota
```
GET /api/drive/quota
```

### Batch Upload
```
POST /api/drive/upload-batch
Content-Type: multipart/form-data

Body:
- files[]: Multiple files to upload
- folderType: "assets" or "creatives"
- metadata: JSON object with file metadata
```

---

## Storage Modes

### Hybrid Mode (Recommended)
Files are stored in both Google Drive and local filesystem. This provides:
- ✓ Fast local access
- ✓ Cloud backup
- ✓ Easy sharing
- ✗ Double storage usage

### Drive-Only Mode
Files are stored only in Google Drive. This provides:
- ✓ Centralized storage
- ✓ Easy sharing
- ✓ No local storage usage
- ✗ Requires internet for all access
- ✗ Slightly slower access

### Local-Only Mode
Files are stored only in local filesystem (current behavior):
- ✓ Fastest access
- ✓ No internet required
- ✗ No cloud backup
- ✗ Harder to share

---

## Troubleshooting

### "Drive storage service not initialized"
- Check that `googleDrive.enabled` is `true` in config.json
- Verify folder IDs are correct
- Ensure service account JSON file exists at the path specified in .env

### "Failed to upload to Drive"
- Check that folders are shared with service account email
- Verify Drive API is enabled in Google Cloud Console
- Check service account has Editor permission on folders

### "File not found" or "Permission denied"
- Verify the file exists in Google Drive
- Check that the service account has access to the folder
- Ensure file ID is correct

### Check Logs
```bash
pm2 logs messagingmatrix-server
```

Look for Drive-related messages starting with:
- `✓ Google Drive storage initialized`
- `✓ Uploaded ... to Google Drive`
- `✗ Failed to initialize Google Drive storage`

---

## Security Best Practices

1. **Never commit service-account.json** - Add it to `.gitignore`
2. **Restrict service account permissions** - Only grant necessary roles
3. **Use separate folders** - Don't mix assets and creatives
4. **Regular backups** - Even with Drive, maintain backups
5. **Monitor quota** - Check storage usage regularly with `/api/drive/quota`
6. **Audit file access** - Review Drive activity logs periodically

---

## Storage Quota Management

Google Drive provides 15 GB of free storage per account. For larger needs:

**Check Current Usage:**
```bash
curl http://localhost:3003/api/drive/quota
```

**Response:**
```json
{
  "limit": 16106127360,
  "usage": 1234567890,
  "usageInDrive": 1234567890,
  "usageInDriveTrash": 0,
  "available": 14871559470,
  "percentUsed": "7.66"
}
```

**Upgrade Options:**
- Google One: 100GB, 200GB, or 2TB plans
- Google Workspace: Unlimited storage (Business Plus and above)

---

## Migration from Local to Drive

To migrate existing assets to Google Drive:

1. Set `storageMode` to `"hybrid"` in config.json
2. Restart server
3. Use the batch upload endpoint to upload existing assets:

```javascript
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const assetsDir = './src/assets';
const files = fs.readdirSync(assetsDir);

files.forEach(async (file) => {
  const filePath = path.join(assetsDir, file);
  const form = new FormData();
  form.append('files', fs.createReadStream(filePath));
  form.append('folderType', 'assets');

  const response = await fetch('http://localhost:3003/api/drive/upload-batch', {
    method: 'POST',
    body: form
  });

  console.log(`Uploaded ${file}:`, await response.json());
});
```

4. After migration, optionally switch to `"drive-only"` mode

---

## Frontend Integration

The frontend components (Assets.jsx, CreativeLibrary.jsx) will be updated to:
- Detect Drive storage availability
- Show Drive storage status
- Allow users to choose storage location
- Display storage quota information
- Provide seamless upload/download experience

---

## Support

For issues or questions:
- Check server logs: `pm2 logs`
- Review Google Cloud Console error logs
- Consult Google Drive API documentation: https://developers.google.com/drive/api/v3/about-sdk
- Check Messaging Matrix documentation

---

Last Updated: 2025-10-24
