# Create Share Gallery

This skill helps create and verify share galleries.

## Purpose

Create a shareable gallery of messages with proper HTML rendering and asset management.

## Steps

1. Prepare messages:
   - Select messages from matrix
   - Verify all required fields are populated
   - Check that all referenced assets exist

2. Generate share ID:
   - Create unique ID (using timestamp + random)
   - Check that ID doesn't conflict with existing shares

3. Create share directory:
   - Create `public/share/{shareId}/`
   - Create `assets/` subdirectory

4. Render HTML for each message and size:
   - Load template from `src/templates/html/`
   - Populate with message data
   - Apply size-specific CSS
   - Save as `{messageName}_{size}.html`

5. Copy assets:
   - Copy all referenced images
   - Maintain relative paths
   - Verify asset URLs are correct

6. Generate manifest:
   - Create `manifest.json` with share metadata
   - Include message list
   - Include asset list
   - Add creation timestamp

7. Create ZIP (optional):
   - Bundle all HTML files
   - Bundle all assets
   - Create downloadable ZIP

8. Verify share:
   - Test share URL
   - Check that all sizes render correctly
   - Verify asset loading
   - Test masonry layout

9. Return share URL

## Reference Files

- `src/components/PreviewView.jsx:1440`
- `src/services/previewService.js`
- `server.js` - `/api/shares/*` endpoints
- `src/templates/html/` - Template files
