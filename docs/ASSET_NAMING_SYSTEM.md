# Asset Naming System Documentation

## Overview
This system automatically renames uploaded assets following a structured naming pattern and maintains a registry of all assets in `assets.json`.

## Naming Pattern
```
Brand_Product_Type_Visual-keyword_Visual-description_Dimensions_Placeholder-name_Cropping-template_Version.format
```

### Pattern Components

1. **Brand** - The brand name (e.g., Nike, Apple, Samsung)
2. **Product** - The product name (e.g., Air-Max, iPhone, Galaxy)
3. **Type** - Asset type (e.g., banner, poster, social, video, carousel)
4. **Visual Keyword** - Main visual element (e.g., product, lifestyle, hero, logo)
5. **Visual Description** - Detailed description (e.g., hero-shot, close-up, overhead)
6. **Dimensions** - Size in pixels (e.g., 1200x628, 300x250)
7. **Placeholder Name** - Placeholder identifier (e.g., main-image, background)
8. **Cropping Template** - Crop method (e.g., center, top-left, fill)
9. **Version** - Version number (e.g., v1, v2, v3)
10. **Format** - File extension (e.g., jpg, png, mp4)

### Example Filenames
```
Nike_Air-Max_banner_product_hero-shot_1200x628_main-image_center_v1.jpg
Apple_iPhone_social_lifestyle_close-up_1080x1920_product-photo_fill_v2.png
Samsung_Galaxy_video_product_unboxing_1920x1080_hero-video_center_v1.mp4
```

## Upload Workflow

### 1. Upload Asset
- Click the Upload button in the Assets page
- Drag and drop files or click to browse
- Accepts: images (jpg, png, gif, webp, svg) and videos (mp4)

### 2. Review Metadata
The system automatically extracts metadata from the filename and uploaded file:
- **Automatic Dimension Detection**: Reads actual image dimensions from the file (width x height)
- **Filename Parsing**: Detects version, common brands, and types from filename
- **Keyword Matching**: Matches filename keywords to common values
- **Intelligent Parsing**: Splits filename by underscores to extract components

**Supported formats for dimension detection:**
- Images: JPG, JPEG, PNG, GIF, WebP, SVG
- Videos: Manual entry (auto-detection requires ffprobe)

### 3. Edit Metadata
Review and edit all metadata fields:
- Brand
- Product
- Type
- Visual Keyword
- Visual Description
- Dimensions
- Placeholder Name
- Cropping Template
- Version
- Format (read-only)

### 4. Preview Filename
See a real-time preview of the final filename as you edit metadata

### 5. Confirm Upload
Click "Confirm & Upload" to:
- Rename the file with the new pattern
- Save the file to the assets directory
- Add a record to `assets.json`

## assets.json Registry

The `assets.json` file maintains a complete registry of all uploaded assets.

### Registry Structure
```json
{
  "assets": [
    {
      "id": "1234567890_abc123",
      "filename": "Nike_Air-Max_banner_product_hero-shot_1200x628_main-image_center_v1.jpg",
      "originalFilename": "nike-airmax-1200x628.jpg",
      "uploadDate": "2025-10-23T12:00:00.000Z",
      "lastModified": "2025-10-23T12:00:00.000Z",
      "metadata": {
        "brand": "Nike",
        "product": "Air Max",
        "type": "banner",
        "visualKeyword": "product",
        "visualDescription": "hero shot",
        "dimensions": "1200x628",
        "placeholderName": "main image",
        "croppingTemplate": "center",
        "version": "1",
        "format": "jpg"
      },
      "tags": [],
      "platforms": [],
      "status": "active",
      "directory": "assets"
    }
  ],
  "version": "1.0.0",
  "lastUpdated": "2025-10-23T00:00:00.000Z"
}
```

### Asset Record Fields

- **id**: Unique identifier for the asset
- **filename**: Final filename after renaming
- **originalFilename**: Original uploaded filename
- **uploadDate**: ISO timestamp of upload
- **lastModified**: ISO timestamp of last modification
- **metadata**: All metadata fields from the naming pattern
- **tags**: Array of custom tags
- **platforms**: Array of platform names (e.g., Facebook, Instagram)
- **status**: Asset status (active, archived, deleted)
- **directory**: Storage directory (assets or creatives)

## API Endpoints

### Get Assets Registry
```
GET /api/assets/registry
```
Returns the complete assets registry

### Add/Update Asset
```
POST /api/assets/registry
Body: { ...assetRecord }
```
Adds or updates an asset record

### Delete Asset
```
DELETE /api/assets/registry
Body: { "id": "asset_id" }
```
Removes an asset from the registry

### Preview Metadata
```
POST /api/assets/preview-metadata
Body: FormData with file
```
Extracts metadata from filename for preview

### Confirm Upload
```
POST /api/assets/confirm-upload
Body: { tempFilename, metadata, targetDir, originalName }
```
Finalizes upload, renames file, and updates registry

## Automatic Keyword Matching

The system automatically matches filename keywords to common values:

### Brands
- Nike, Adidas, Puma, Reebok
- Apple, Samsung, Google

### Types
- banner, poster, social, video
- carousel, story, reel

### Platforms (for tags)
- Facebook (fb, facebook)
- Instagram (ig, instagram)
- Google (google, pmax)
- YouTube (youtube, yt)
- LinkedIn (linkedin, li)
- Twitter (twitter, tw)

### Visual Keywords
- product, lifestyle, hero
- logo, text, icon, photo

## Usage Tips

1. **Use Descriptive Names**: Upload files with descriptive names that include key information
2. **Consistent Spacing**: Use hyphens or underscores in multi-word values
3. **Include Dimensions**: Add dimensions to filename for automatic extraction (e.g., 1200x628)
4. **Version Numbers**: Include version numbers for easy tracking (e.g., v1, v2)
5. **Review Before Upload**: Always review auto-extracted metadata before confirming

## Benefits

1. **Consistent Naming**: All assets follow the same naming pattern
2. **Easy Search**: Structured filenames make assets easy to find
3. **Complete Tracking**: `assets.json` provides full asset history
4. **Metadata Rich**: All assets include comprehensive metadata
5. **Version Control**: Track different versions of the same asset
6. **Automatic Organization**: Intelligent keyword matching reduces manual work

## File Locations

- **Assets Directory**: `src/assets/`
- **Registry File**: `assets.json` (root directory)
- **Temp Uploads**: `.temp/` (automatically cleaned)

## Utilities

The following utility functions are available in `src/utils/assetsJsonManager.js`:

- `createAssetRecord()` - Create a new asset record
- `generateFilename()` - Generate filename from metadata
- `extractMetadataFromFilename()` - Parse filename to metadata
- `matchKeywordsToValues()` - Match keywords to common values
- `fetchAssetsJson()` - Get assets registry from API
- `updateAssetsJson()` - Update registry via API
- `removeFromAssetsJson()` - Remove asset via API

## Future Enhancements

Potential improvements:
- Bulk upload with CSV metadata
- Asset tagging and categorization
- Advanced search and filtering
- Asset usage tracking
- Duplicate detection
- Automatic image optimization
- CDN integration
