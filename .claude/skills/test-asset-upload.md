# Test Asset Upload Workflow

This skill tests the asset upload workflow end-to-end.

## Purpose

Verify that the asset upload, metadata extraction, naming, and registry management works correctly.

## Steps

1. Check asset directories:
   - Verify `src/assets/` exists
   - Verify `src/creatives/` exists
   - Check `assets.json` registry file

2. Test metadata extraction:
   - Upload a test image
   - Verify dimensions are extracted correctly
   - Check filename parsing for suggested metadata

3. Test naming pattern:
   - Verify pattern: `Brand_Product_Type_Keyword_Description_Dimensions_Placeholder_Crop_Version.ext`
   - Check that all special characters are handled
   - Verify file extensions are preserved

4. Test registry operations:
   - Add asset to registry
   - Update asset metadata
   - Check asset stats
   - Verify search/filter functionality

5. Verify file operations:
   - Check temp file cleanup
   - Verify final file location
   - Test duplicate filename handling

6. Report any issues with:
   - File permissions
   - Missing directories
   - Registry corruption
   - Naming conflicts

## Reference Files

- `src/components/Assets.jsx:1054`
- `src/utils/assetUtils.js`
- `src/utils/assetsJsonManager.js`
- `server.js` - `/api/assets/*` endpoints
- `ASSET_NAMING_SYSTEM.md`
