# Messaging Matrix - Features Documentation

## Table of Contents
- [Matrix View Features](#matrix-view-features)
- [Tree View Features](#tree-view-features)
- [Asset Management](#asset-management)
- [Creative Library](#creative-library)
- [Message Management](#message-management)
- [Template System](#template-system)
- [Share Gallery System](#share-gallery-system)
- [Preview System](#preview-system)
- [Data Synchronization](#data-synchronization)
- [Settings & Configuration](#settings--configuration)
- [User Interface](#user-interface)
- [Performance Features](#performance-features)

---

## Matrix View Features

### Interactive Grid Layout
The matrix provides a visual grid where:
- **Rows** represent Topics
- **Columns** represent Audiences
- **Cells** contain Messages for each Topic-Audience combination

### Drag & Drop Functionality
- **Move Messages**: Drag message cards between audiences
- **Copy Messages**: Ctrl+Drag to copy messages
  - Constraint: Can only copy within same topic (row)
  - Keeps the same message number
  - Updates audience key in the message name

### Advanced Filtering
Filter input with sophisticated logic:
- **AND Logic**: `keyword1 AND keyword2` - Both keywords must match
- **OR Logic**: `keyword1 OR keyword2` - Either keyword must match
- **Combined**: `key1 AND key2 OR key3` - Complex filtering
- **Active Filter**: Toggle to show only ACTIVE messages
- Filters both audiences (columns) and topics (rows)
- Real-time filtering as you type

### Status-based Color Coding
Messages are visually distinguished by status:
- **ACTIVE** - Green background
- **PAUSED** - Gray background
- **PLANNED** - Yellow background
- **INACTIVE** - Red background
- Empty status defaults to PLANNED

### View State Persistence
- Matrix zoom level preserved
- Pan position saved
- Filter settings remembered
- Display mode maintained
- Persists across page reloads via localStorage

---

## Tree View Features

### Hierarchical Visualization
Five-level hierarchy:
1. **Strategy** (top level)
2. **Targeting Type**
3. **Audience**
4. **Topic**
5. **Messages** (leaf nodes)

### Interactive Navigation
- **Pan**: Hold Space + Drag to pan around
- **Zoom**: Hold Space + Scroll to zoom in/out
- **Node Positioning**: Drag nodes to customize layout
- **Reset**: Reset view or positions to defaults

### Connector Styles
- **Curved**: Smooth bezier curves between nodes
- **Elbow**: Right-angled connectors
- Toggle between styles with button

### Visual Features
- **Status Coloring**: Messages colored by status
- **Node Counts**: Show child count on parent nodes
- **Collapsible**: Expand/collapse node branches (planned)
- **Search**: Find and highlight specific nodes (planned)

### State Persistence
- Tree zoom level preserved
- Pan position saved
- Node positions saved (custom layout)
- Connector style preference saved
- Persists across page reloads

---

## Asset Management

### Google Drive Integration
- **Auto-sync**: Automatic synchronization on page load
- **Spreadsheet First**: Reads spreadsheet, compares with Drive
- **Bidirectional**: Updates spreadsheet with new Drive files
- **Folder Organization**: Dedicated folder for assets
- **Service Account**: Secure access without user authentication

### Virtual Scrolling
- **Performance**: Smooth scrolling with 1000+ assets
- **Lazy Loading**: Only renders visible items
- **Dynamic Heights**: Handles varying asset dimensions
- **Sequential Loading**: Loads images one at a time for accurate layout
- **Placeholder System**: Shows placeholders for unloaded items

### Masonry Layout
- **Pinterest-style**: Responsive grid with varying heights
- **Column Auto-sizing**: Adapts to screen width
- **Aspect Ratio**: Maintains asset aspect ratios
- **Gap Consistency**: Even spacing between items
- **Hover Effects**: Smooth overlay transitions

### List View
- **Table Layout**: Detailed rows with all metadata
- **Sortable Columns**: Click headers to sort
- **Thumbnail Preview**: Small thumbnails in rows
- **Metadata Display**:
  - Brand, Product, Type
  - Visual_keyword under filename
  - File format, size, dimensions
  - Direct link and thumbnail link
- **Row Actions**: Click to preview

### Filtering System
- **AND Logic**: `brand1 AND product1` - Both must match
- **OR Logic**: `brand1 OR brand2` - Either must match
- **Field Targeting**: Searches Brand, Product, Type, Visual_keyword
- **Real-time**: Updates as you type
- **Clear Button**: One-click filter reset

### Preview Dialog
- **Full-screen**: Distraction-free preview
- **Dark Theme**: Dark background for better focus
- **Navigation**: Previous/Next buttons to step through assets
- **Metadata Panel**:
  - Left-side slide-in panel
  - Dark-themed to match preview
  - Full height with width transition
  - Shows all asset metadata
  - External link buttons for DirectLink and Thumbnail
- **Zoom Controls**: Zoom in/out for detailed inspection
- **Close**: ESC key or X button to close

### Proxy Serving
- **Secure Delivery**: Assets served through backend proxy
- **File ID Support**: Proxy by Google Drive file ID
- **Filename Support**: Proxy by filename (searches folders)
- **Format Support**: Images, videos, PDFs, HTML, CSS, JS, JSON
- **CORS Handling**: Proper headers for cross-origin requests

---

## Creative Library

### Static Creatives
- **Image Support**: JPG, JPEG, PNG, GIF
- **Video Support**: MP4, WebM, MOV, AVI
- **Metadata**: Brand, Product, Copy_keyword, Visual_keyword
- **Variants**: Multiple variants per creative
- **Platforms**: Platform tags for targeting
- **Auto-sync**: Syncs from Google Drive folder

### Dynamic Creatives
- **HTML5 Banners**: Full support for HTML banner templates
- **Live Preview**: Real-time rendering in library
- **Banner Sizes**: Extracts size from filename (e.g., "banner_300x250.html")
- **Template Binding**: Maps message data to template placeholders
- **CSS Injection**: Inlines CSS for proper rendering
- **Sandbox Rendering**: Secure iframe rendering

### Virtual Scrolling
- **High Performance**: Smooth with 100+ creatives
- **Masonry Layout**: Pinterest-style responsive grid
- **Lazy Loading**: Only renders visible items
- **HTML Detection**: Automatically handles HTML creatives
- **Sequential Loading**: Calculates heights sequentially

### Selector Mode
- **Multi-select**: Select multiple creatives
- **Long-press**: Long-press to activate selector mode
- **Visual Feedback**: Blue ring on selected items
- **Checkbox UI**: Checkmarks on selected creatives
- **Batch Actions**: Create share gallery from selection

### Preview System
- **Full-screen Preview**: Distraction-free viewing
- **Template Rendering**: Renders HTML templates with data
- **Navigation**: Step through creatives with arrows
- **Variant Switching**: Switch between creative variants
- **Dark Theme**: Dark background for better focus

### Drive Sync
- **Auto-sync**: Syncs automatically on page load
- **Spreadsheet First**: Reads spreadsheet, compares with Drive
- **New File Detection**: Finds files not in spreadsheet
- **Metadata Update**: Updates file size, date, dimensions
- **Progress Feedback**: Shows sync status and progress

---

## Message Management

### Creating Messages
1. Click the `+` button in any matrix cell
2. Message is created with:
   - Auto-incremented ID
   - Automatic number assignment (global or cell-specific)
   - Default variant 'a'
   - Version 1
   - Status 'PLANNED'

### Message Numbering Logic
- **Empty Cell**: Gets next global message number with variant 'a'
- **Cell Has Messages**: Uses same number as existing messages, increments variant (a→b→c)
- **Example**: Cell has m1a and m1b → New message becomes m1c

### Content Field Syncing
When editing these fields, changes automatically propagate to all messages with the same number and variant:
- Template
- Landing URL
- Headline
- Copy 1
- Copy 2
- Image fields (Image1-Image6)
- Flash text and Flash_style
- CTA

**Unique Fields** (not synced):
- Status
- Comment
- Audience (obviously)
- Topic
- Start/End dates

### Sync Warning
Edit dialog shows a warning banner listing:
- Number of messages that will be updated
- Which audiences will be affected
- Names of affected messages
- Allows user to review before saving

### Versioning
- Version increments automatically on save
- Version tracking in message name: `v{version}`
- Helps track message evolution over time
- Version history (planned)

### Validation
- **Delete Protection**: Cannot delete audiences or topics that have messages
- Shows alert if deletion attempted
- Ensures data integrity
- Prevents orphaned messages

### Pattern Evaluation
- **PMMID Generation**: Auto-generates PMMID from pattern
- **Trafficking Fields**: Auto-generates trafficking data
- **Configurable Patterns**: Patterns defined in settings
- **Placeholder Replacement**: Supports message and audience fields
- **Real-time Updates**: Regenerates when message changes

---

## Template System

### HTML5 Templates
- **Template Folders**: Templates stored in `src/templates/html/`
- **Structure**: Each template has folder with:
  - `index.html` - Main template file
  - `template.json` - Configuration file
  - `main.css` - Shared styles
  - `{width}x{height}.css` - Size-specific styles
  - Assets folder (optional)

### Template Configuration
```json
{
  "name": "Template Name",
  "sizes": ["300x250", "300x600", "640x360", "970x250"],
  "placeholders": {
    "headline_text_1": {
      "type": "text",
      "binding-messagingmatrix": "message.Headline",
      "default": "Default headline"
    },
    "background_image_1": {
      "type": "image",
      "binding-messagingmatrix": "message.Image1",
      "path-messagingmatrix": "/api/drive/proxy/",
      "default": "default.jpg"
    }
  }
}
```

### Placeholder Binding
- **Text Placeholders**: Bind to message text fields
- **Image Placeholders**: Bind to message image fields
- **Video Placeholders**: Bind to message video fields
- **Path Prefix**: `path-messagingmatrix` sets asset base URL
- **Default Values**: Fallback when field is empty

### Path Configuration
- **Proxy Paths**: Use `/api/drive/proxy/` for Drive assets
- **Relative Paths**: Support for relative asset paths
- **Full URLs**: Support for external URLs
- **Automatic Prefixing**: Auto-adds path prefix to asset IDs

### CSS Injection
- **Inline CSS**: CSS files inlined into HTML
- **Size-specific**: Loads CSS for selected banner size
- **Main CSS**: Shared CSS across all sizes
- **Link Replacement**: Replaces `<link>` tags with `<style>` tags

### Live Preview
- **Real-time Rendering**: Templates render in Creative Library
- **Message Data**: Populates with actual message data
- **Iframe Sandbox**: Secure rendering environment
- **Scaling**: Auto-scales to fit column width
- **Interactive**: Fully interactive within iframe

---

## Share Gallery System

### Gallery Creation
1. Select creatives in Creative Library (selector mode)
2. Click "Create Share Gallery" button
3. System generates:
   - Unique share ID
   - Shareable public URL
   - Static HTML gallery
   - ZIP file with all assets

### Public Access
- **No Authentication**: Anyone with link can view
- **Unique URLs**: Each gallery has unique ID
- **Direct Access**: URL format: `/share/{shareId}`
- **SEO Friendly**: Proper meta tags and descriptions

### Gallery Features
- **Responsive Grid**: Mobile-friendly masonry layout
- **Preview**: Click creatives to view full-screen
- **Navigation**: Step through creatives with arrows
- **Download ZIP**: One-click download of all creatives
- **Metadata**: Shows creative details (size, format, etc.)

### ZIP Download
- **All Creatives**: Packages all gallery creatives
- **Organized**: Maintains folder structure
- **Original Files**: Includes original file formats
- **Automatic**: Generated on-demand
- **Fast Download**: Streamed directly to browser

### Storage
- **Public Folder**: Galleries stored in `public/share/`
- **Asset Folder**: Each gallery has asset subfolder
- **HTML File**: Static HTML for each gallery
- **ZIP File**: Pre-generated ZIP for quick download
- **Persistent**: Galleries persist until manually deleted

---

## Preview System

### Opening Preview
- Click any message, asset, or creative to open preview
- Full-screen modal overlay
- Dark background for better focus
- ESC key or X button to close

### Message Preview Components

#### Variant Selector
- Dropdown showing all available variants for the message number
- Switching variant updates the preview content
- Each variant can have different content fields
- Shows variant letter (a, b, c, etc.)

#### Size Selector
Multiple template sizes available:
- **300x250** - Medium rectangle
- **300x600** - Half page
- **640x360** - Large mobile banner
- **970x250** - Billboard
- **Custom sizes** - Defined by template

Each size has dedicated CSS file for proper formatting.

#### Navigation Buttons
- **Previous ACTIVE**: Navigate to previous ACTIVE message (by number)
- **Next ACTIVE**: Navigate to next ACTIVE message (by number)
- Buttons disabled when no previous/next exists
- Only navigates between ACTIVE status messages
- Skips duplicate numbers (same message in different audiences)

### Template Rendering
- Templates use variable replacement:
  - `{{headline_text_1}}` → Message headline
  - `{{copy_text_1}}` → Message copy1
  - `{{copy_text_2}}` → Message copy2
  - `{{cta_text_1}}` → Message CTA
  - `{{sticker_text_1}}` → Message flash text
- Unused variables are cleared from rendered HTML
- CSS properly injected for each size
- Images loaded via proxy

### Asset/Creative Preview

#### Metadata Panel
- **Left-side Panel**: Slides in from left
- **Dark Theme**: Matches preview background
- **Full Height**: Spans entire preview height
- **Width Transition**: Smooth width animation (w-0 → w-96)
- **Toggle Button**: Info icon to show/hide panel
- **External Links**: Buttons with ExternalLink icon for:
  - File_DirectLink - Opens in new tab
  - File_thumbnail - Opens in new tab

#### Navigation
- **Previous/Next**: Arrow buttons to step through items
- **Keyboard**: Arrow keys for navigation
- **Loop**: Wraps to first/last item at boundaries
- **Filtered**: Respects active filters

---

## Data Synchronization

### Google Sheets Integration

#### Authentication
- **Service Account**: Google Cloud service account
- **OAuth2 JWT**: JWT token authentication via `jose` library
- **Access Token**: Cached and refreshed automatically
- **No User Login**: Works without user OAuth flow
- **Secure**: Credentials in environment variables

#### Data Structure
Eight sheets supported:
1. **Audiences**: ID, Name, Key, Order, Status, Product, Strategy, etc.
2. **Topics**: ID, Name, Key, Order, Status, Product, Tags
3. **Messages**: 25+ columns including content fields
4. **Assets**: Asset metadata and Drive references
5. **Creatives**: Creative metadata and Drive references
6. **Feed**: Generated feed data for export
7. **Keywords**: Keyword mappings for inflection
8. **Styles**: Flash style definitions

#### Save Operation
1. User clicks "Save" button
2. Shows progress dialog with steps
3. Converts state to row format
4. Updates each sheet in sequence:
   - Audiences
   - Topics
   - Messages (with auto-generated fields)
   - Assets (if changed)
   - Creatives (if changed)
   - Feed (if generated)
5. Updates lastSync timestamp
6. Shows success message

#### Load Operation
1. App checks localStorage cache first
2. If cache miss or expired, fetches from Google Sheets
3. Authenticates with service account
4. Fetches all sheets in parallel
5. Parses rows into structured objects
6. Caches to localStorage
7. Updates UI with loaded data

### Google Drive Integration

#### Auto-sync
- **On Page Load**: Syncs automatically when opening Assets/Creatives
- **Spreadsheet First**: Reads spreadsheet as source of truth
- **Compare**: Compares with Drive folder contents
- **Update**: Updates spreadsheet with new/changed files
- **Progress**: Shows sync progress in UI

#### File Metadata Extraction
- **File ID**: Google Drive file ID
- **Filename**: Original filename
- **Size**: File size in bytes
- **Date**: Last modified date
- **Dimensions**: For images and videos (width x height)
- **Format**: File extension/type
- **Links**: Direct link and thumbnail URL

### Local Storage
- **Cache Key Format**: `messagingmatrix_data_{SheetName}`
- **Settings Key**: `messagingmatrix_settings`
- **Benefits**:
  - Offline access
  - Faster loading
  - Reduced API calls
  - Persistence across sessions
- **Invalidation**: Cleared on "Clear & Reload"

### Clear & Reload
Button that:
1. Preserves authentication data
2. Clears all cached data
3. Reloads the page
4. Forces fresh fetch from Google Sheets
5. Re-syncs with Google Drive

---

## Settings & Configuration

### Settings Dialog
Access via Settings icon (gear) in header.

### Spreadsheet Configuration
- **Spreadsheet ID**: Input field for Google Sheets ID
- **Google Sheets Icon**: Button to open spreadsheet in new tab
- **Extract ID**: From URL: `https://docs.google.com/spreadsheets/d/{ID}/edit`
- **Save & Reload**: Saves ID and reloads app

### Drive Configuration
- **Assets Folder ID**: Google Drive folder for assets
- **Creatives Folder ID**: Google Drive folder for creatives
- **Auto-detect**: Reads from environment variables
- **Override**: Can override in settings

### Pattern Configuration
- **PMMID Pattern**: Configure PMMID generation pattern
- **Trafficking Patterns**: Configure trafficking field patterns
- **Placeholders**: Define available placeholders
- **Preview**: Test pattern with sample data

### Look and Feel
- **Logo URL**: Custom logo for header
- **Header Color**: Primary header background color
- **Button Color**: Primary button color
- **Secondary Colors**: Additional theme colors
- **Logo Style**: Custom CSS for logo
- **Button Style**: Custom CSS for buttons

### Persistent Storage
Settings stored in localStorage:
```json
{
  "spreadsheetId": "...",
  "assetsFolderId": "...",
  "creativesFolderId": "...",
  "patterns": {...},
  "lookAndFeel": {...},
  "lastUpdated": "2025-10-25T10:30:00Z"
}
```

### Switching Spreadsheets
1. Open Settings dialog
2. Enter new spreadsheet ID
3. Click "Save & Reload"
4. App clears cached data
5. Page reloads and loads new spreadsheet
6. Re-syncs with new data

---

## User Interface

### Header Bar
- **Menu Toggle**: Hamburger icon to open slide-in menu
- **Module Name**: Current module name
- **Last Sync**: Shows time since last synchronization
- **Settings**: Opens settings dialog
- **Clear & Reload**: Clears cache and reloads
- **Matrix State**: Shows JSON state (for debugging)
- **Save**: Syncs changes to Google Sheets

### Slide-in Menu
- **Smooth Animation**: Slides in from left
- **Overlay**: Dark overlay when open
- **Module Navigation**: All modules listed
- **Active Indicator**: Highlights current module
- **User Info**: Shows logged-in user
- **Logout**: Logout button at bottom
- **Matrix State**: Access to state dialog

### Matrix Grid
- **Responsive**: Adapts to screen size
- **Scrollable**: Horizontal and vertical scrolling
- **Filter Input**: Top-left cell for filtering
- **Column Headers**: Audiences with edit/add buttons
- **Row Headers**: Topics with edit/add buttons
- **Cells**: Message cards with badges and actions
- **Pan & Zoom**: Pan/zoom controls (in matrix mode)

### Message Cards
Each card shows:
- **Badge**: Message number and variant (e.g., "m1a")
- **Headline**: First line of headline text
- **Status Color**: Background color by status
- **Actions**: Eye icon (preview), Edit icon (edit)
- **Hover Effects**: Actions visible on hover
- **Drag Handle**: Entire card is draggable

### Edit Dialogs
- **Modal Overlay**: Full-screen modal
- **Tabs**: Separate tabs for different field groups
- **Form Fields**: All editable fields
- **Sync Warning**: Banner if changes affect other messages
- **Delete Button**: With confirmation dialog
- **Save Button**: Primary action

### Color Scheme
- **Blue**: Settings, links, primary actions
- **Green**: Save, ACTIVE status, success states
- **Orange**: Clear & Reload, warnings
- **Purple**: State, preview, info
- **Yellow**: PLANNED status, caution states
- **Gray**: PAUSED status, disabled states
- **Red**: Delete actions, INACTIVE status

### Responsive Design
- **Mobile**: Touch-friendly, swipe navigation
- **Tablet**: Optimized layout for medium screens
- **Desktop**: Full-featured interface
- **Breakpoints**: Tailwind responsive breakpoints
- **Touch Support**: Long-press, swipe gestures

---

## Performance Features

### Message Lookup Optimization
- **O(1) lookup** using hash map
- **Index**: `${topic}-${audience}` → [messages]
- **Rebuilt**: On message changes
- **Eliminates**: Nested loops in rendering
- **Fast**: Even with 1000+ messages

### React Optimization
- **useCallback**: Stable function references prevent re-renders
- **useMemo**: Computed values cached
- **Efficient Re-rendering**: Proper dependency arrays
- **Component Memoization**: React.memo on heavy components
- **State Colocation**: State close to usage

### Caching Strategy
- **Primary**: localStorage (instant)
- **Fallback**: Google Sheets API (with auth)
- **Update**: On save or manual reload
- **Invalidation**: Smart invalidation on changes
- **Compression**: Efficient JSON storage

### Virtual Scrolling
- **Windowing**: Only renders visible items
- **Buffer**: Small buffer above/below viewport
- **Dynamic Heights**: Measures actual heights
- **Smooth Scrolling**: No jank or stuttering
- **Memory Efficient**: Low memory footprint

### Lazy Loading
- **Images**: Load only when in viewport
- **Templates**: Defer heavy template loading
- **Sequential**: One at a time for masonry
- **Placeholders**: Show placeholders while loading
- **Error Handling**: Graceful fallbacks

### Data Loading
- **Parallel Fetching**: Fetch multiple sheets simultaneously
- **Batch Operations**: Bulk read/write to Sheets API
- **Progressive**: Show data as it loads
- **Error Recovery**: Retry failed requests
- **Offline Support**: Work with cached data

---

## Keyboard Shortcuts

- **Ctrl+Drag**: Copy message to different audience (same topic only)
- **Space+Drag**: Pan in Tree View
- **Space+Scroll**: Zoom in Tree View
- **Escape**: Close dialogs and modals
- **Enter**: Save in input fields
- **Arrow Keys**: Navigate in preview (planned)
- **Delete**: Delete selected items (with confirmation)

---

## Data Validation

### ID Auto-increment
- Scans existing IDs
- Finds maximum value
- Increments by 1
- Prevents ID collisions
- Unique per entity type

### Key Uniqueness
While not enforced, keys should be unique:
- Audiences: `aud1`, `aud2`, etc.
- Topics: `top1`, `top2`, etc.
- Used for lookups and relationships

### Required Fields
Messages require:
- ID (auto-generated)
- Audience key
- Topic key
- Number
- Variant

Empty or invalid rows filtered during parsing.

### File Validation
- **Format Check**: Validates file extensions
- **Size Limits**: Warns on large files
- **Dimensions**: Validates image/video dimensions
- **Drive ID**: Checks Drive ID format
- **Filename**: Sanitizes filenames

---

## Error Handling

### Authentication Errors
- Shows error message in UI
- Logs to console with details
- Provides retry button
- Falls back to cached data
- Clear error messages

### API Errors
- Graceful degradation to localStorage
- Error messages with context
- Console logging for debugging
- Retry logic for transient errors
- User-friendly error dialogs

### Validation Errors
- Alert dialogs for user actions
- Prevents invalid operations
- Clear error messages
- Highlights problematic fields
- Suggests fixes

### File Errors
- **404 Not Found**: Shows placeholder
- **Permission Denied**: Clear error message
- **Network Errors**: Retry button
- **Timeout**: Configurable timeout with fallback
- **Corrupt Files**: Graceful fallback

---

## Accessibility

- **Keyboard Navigation**: Full keyboard support
- **ARIA Labels**: Proper labeling for screen readers
- **Focus Management**: Logical focus order
- **Color Contrast**: WCAG AA compliant
- **Alt Text**: Images have descriptive alt text
- **Error Messages**: Clear, descriptive errors
- **Form Labels**: All inputs properly labeled

---

## Browser Support

- **Chrome**: Full support (latest)
- **Firefox**: Full support (latest)
- **Safari**: Full support (latest)
- **Edge**: Full support (latest)
- **Mobile Browsers**: iOS Safari, Chrome Android

Requires modern browser with:
- ES6+ JavaScript
- CSS Grid
- Flexbox
- LocalStorage
- Fetch API
