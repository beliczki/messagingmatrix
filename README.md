# Messaging Matrix

> A comprehensive messaging campaign management platform with Google Sheets integration, Google Drive asset management, AI-powered content generation, and visual decision tree analysis.

![Version](https://img.shields.io/badge/version-2.0.0-blue.svg)
![React](https://img.shields.io/badge/React-18.3-61DAFB?logo=react)
![Vite](https://img.shields.io/badge/Vite-5.4-646CFF?logo=vite)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3.4-38B2AC?logo=tailwind-css)
![Node](https://img.shields.io/badge/Node.js-18+-339933?logo=node.js)

---

## 🎯 Overview

**Messaging Matrix** is a powerful web application designed for marketing teams to manage, organize, and optimize messaging campaigns across multiple audiences and topics. It provides a visual matrix interface, decision tree visualization, asset management with Google Drive integration, creative library, and AI-powered content generation capabilities.

### Key Capabilities

- **📊 Matrix View**: Organize messages across audiences and topics in an intuitive grid
- **🌳 Tree View**: Visualize campaign strategy as an interactive decision tree
- **🔄 Google Sheets Sync**: Bidirectional sync with Google Spreadsheets for data persistence
- **📦 Asset Management**: Google Drive integration with virtual scrolling and masonry layout
- **🎨 Creative Library**: Manage static and dynamic creatives with template support
- **🤖 AI Content Generation**: Integrate with Claude AI to generate message variations
- **👥 Multi-user Support**: Secure authentication system with user management
- **📱 Responsive Design**: Works seamlessly on desktop and mobile devices
- **🚀 Share Galleries**: Create shareable preview galleries with ZIP downloads

---

## 🚀 Features

### Matrix Management
- **Visual Grid Interface**: Organize messages by audience (columns) and topic (rows)
- **Drag & Drop**: Move messages between cells with intuitive drag-and-drop
- **Status Tracking**: Color-coded status indicators (Active, Inactive, In Progress, Planned)
- **Filtering**: Advanced text filtering with AND/OR logic, Active-only filter
- **Strategy Tagging**: Display strategy prefixes on audience headers
- **Quick Actions**: Edit, duplicate, copy, and delete messages inline
- **Pattern Evaluation**: Auto-generate PMMID and trafficking fields from configurable patterns

### Decision Tree View
- **Hierarchical Visualization**: Strategy → Targeting Type → Audience → Topic → Messages
- **Interactive Navigation**: Pan with Space + Drag, Zoom with Space + Scroll
- **Custom Positioning**: Drag nodes to customize tree layout
- **Connector Styles**: Toggle between curved and elbow connectors
- **Status Coloring**: Messages colored by status for quick identification
- **Persistent State**: View settings preserved when switching between Matrix and Tree

### Asset Management
- **Google Drive Integration**: Automatic sync with Google Drive folders
- **Virtual Scrolling**: Smooth performance with large asset libraries
- **Masonry Layout**: Pinterest-style responsive grid
- **List View**: Detailed table view with sortable columns
- **Advanced Filtering**: AND/OR logic for Brand, Product, Type, Visual_keyword
- **Metadata Management**: Comprehensive asset metadata from spreadsheet
- **Proxy Serving**: Secure asset delivery through backend proxy
- **Preview Dialog**: Full-screen preview with navigation and metadata panel

### Creative Library
- **Static Creatives**: Support for images (JPG, PNG, GIF) and videos (MP4)
- **Dynamic Creatives**: HTML5 banner templates with live preview
- **Template System**: Template configuration with placeholder bindings
- **Banner Sizes**: Multi-size support (300x250, 300x600, 640x360, 970x250, etc.)
- **Drive Sync**: Auto-sync creatives from Google Drive folder
- **Virtual Scrolling**: High-performance rendering for large libraries
- **Preview & Navigation**: Full-screen preview with stepper navigation

### Google Sheets Integration
- **Service Account Authentication**: Secure, no-login-required access to private spreadsheets
- **Automatic Sync**: Load data from and save changes back to Google Sheets
- **Batch Operations**: Efficient bulk read/write operations
- **Progress Tracking**: Visual feedback during save operations
- **State Management**: View last sync time and manage local cache
- **Multi-sheet Support**: Audiences, Topics, Messages, Assets, Creatives, Feed, Keywords, Styles

### Google Drive Integration
- **Service Account Access**: Secure access to shared Drive folders
- **File Metadata**: Extract file details (name, size, date, dimensions)
- **Folder Organization**: Separate folders for assets and creatives
- **Auto-sync**: Automatic synchronization on page load
- **Proxy Serving**: Backend proxy for secure file delivery
- **Filename Support**: Proxy works with both file IDs and filenames

### AI Assistant
- **Module-Specific Contexts**: AI assistant available across all modules with tailored contexts
- **File-Based Instructions**: Editable AI prompts stored in text files (AIMatrixInstructions.txt, etc.)
- **Claude API Integration**: Generate content using Anthropic's Claude 3.5 Sonnet
- **Context-Aware**: Full application data passed to AI (audiences, topics, messages, assets, creatives)
- **Chat & Context Tabs**: View conversation and inspect full AI context in real-time
- **Generate New Instructions**: AI-powered instruction improvement using Claude
- **Multi-field Generation**: Create headlines, copy, CTAs, flash messages, and more
- **Image Upload**: Attach images and filtered creatives to AI conversations
- **API Key Management**: Secure local storage or .env configuration

### Template System
- **HTML5 Templates**: Support for dynamic HTML banner templates
- **Size Variants**: Multiple size configurations per template
- **Placeholder Binding**: Map template placeholders to message fields
- **Path Configuration**: Configurable asset paths via path-messagingmatrix
- **CSS Injection**: Automatic CSS inlining for proper rendering
- **Live Preview**: Real-time template preview in creative library

### Share Gallery System
- **Gallery Creation**: Generate shareable preview galleries from selected creatives
- **Public Links**: Shareable URLs with unique IDs
- **ZIP Download**: Package all creatives as downloadable ZIP
- **Responsive Preview**: Mobile-friendly gallery interface
- **No Authentication**: Public access to shared galleries

### User Authentication
- **Secure Login**: Password hashing with SHA-256
- **Session Management**: Persistent login with localStorage
- **Default User**: Pre-configured admin account
- **User Display**: Show logged-in user in navigation menu
- **Logout**: Clean session termination

### Module Architecture
- **Messaging Matrix**: Main campaign management module
- **Creative Library**: Creative asset management with template support
- **Assets**: Google Drive asset management with virtual scrolling
- **Templates**: Template management and configuration
- **Tasks**: Task and workflow management
- **Monitoring**: Analytics and reporting
- **Users**: User management interface
- **Settings**: Application configuration

---

## 🏗️ Architecture

### Tech Stack

**Frontend:**
- **React 18.3** - UI framework with hooks
- **Vite 5.4** - Build tool and dev server
- **TailwindCSS 3.4** - Utility-first CSS framework
- **Lucide React** - Icon library
- **React Router** - Client-side routing
- **React Hooks** - State management

**Backend:**
- **Node.js 18+** - Server runtime
- **Express** - Web server framework
- **Google APIs** - Sheets and Drive integration
- **Jose** - JWT authentication for Google APIs
- **Archiver** - ZIP file generation
- **PM2** - Process management

**Services:**
- **Google Sheets API** - Data persistence
- **Google Drive API** - Asset storage
- **Claude API** - AI content generation
- **Service Account Auth** - Google Cloud authentication

**State Management:**
- Custom hooks (useMatrix, useAuth)
- localStorage for persistence
- Context API for global state

### Project Structure

```
messagingmatrix/
├── src/
│   ├── components/
│   │   ├── Matrix.jsx                    # Main matrix grid (1,530 lines)
│   │   ├── TreeView.jsx                  # Decision tree visualization (902 lines)
│   │   ├── MessageEditorDialog.jsx       # Message editor (1,320 lines)
│   │   ├── CreativeLibrary.jsx           # Creative library (525 lines)
│   │   ├── CreativeLibraryMasonryView.jsx # Masonry layout for creatives
│   │   ├── CreativeLibraryItem.jsx       # Individual creative item
│   │   ├── CreativePreview.jsx           # Creative preview dialog
│   │   ├── Assets.jsx                    # Asset management (377 lines)
│   │   ├── MediaLibraryBase.jsx          # Shared base for Assets/Creatives (674 lines)
│   │   ├── Templates.jsx                 # Template management
│   │   ├── PreviewView.jsx               # Share gallery viewer (1,440 lines)
│   │   ├── AIAssistant.jsx               # AI assistant with Chat/Context tabs (1,400+ lines)
│   │   ├── StateManagementDialog.jsx     # Application state viewer
│   │   ├── Login.jsx                     # Authentication
│   │   ├── Tasks.jsx                     # Task management
│   │   ├── Monitoring.jsx                # Analytics
│   │   ├── Users.jsx                     # User management
│   │   └── Settings.jsx                  # Application settings
│   ├── contexts/
│   │   └── AuthContext.jsx               # Authentication context
│   ├── hooks/
│   │   └── useMatrix.js                  # Matrix data management (355 lines)
│   ├── services/
│   │   ├── sheets.js                     # Google Sheets API (520 lines)
│   │   ├── settings.js                   # Settings management
│   │   ├── previewService.js             # Share gallery service
│   │   └── driveStorage.js               # Google Drive integration
│   ├── utils/
│   │   ├── patternEvaluator.js           # Pattern evaluation (240 lines)
│   │   ├── treeBuilder.js                # Tree structure builder
│   │   ├── assetUtils.js                 # Asset utilities
│   │   └── templatePopulator.js          # Template population
│   ├── templates/html/                   # HTML5 banner templates
│   ├── App.jsx                           # Main application
│   ├── App.css                           # Global styles
│   ├── index.css                         # Tailwind imports
│   └── main.jsx                          # Application entry
├── server.js                             # Backend server (1,400+ lines)
├── ecosystem.config.cjs                  # PM2 configuration
├── public/                               # Static assets
├── .claude/                              # Claude Code context files
├── GOOGLE_DRIVE_SETUP.md                 # Drive setup guide
├── ASSET_NAMING_SYSTEM.md                # Asset naming conventions
├── SERVER_MANAGEMENT.md                  # PM2 server management
├── PRODUCTION_SETUP.md                   # Production deployment
└── package.json                          # Dependencies
```

---

## 🛠️ Installation & Setup

### Prerequisites

- **Node.js** 18+ and npm
- **Google Cloud Account** with service account
- **Google Sheets** with required tabs
- **Google Drive** folders (optional, for asset management)
- **Claude API Key** (optional, for AI features)
- **PM2** (optional, for production process management)

### Local Development Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd messagingmatrix
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**

   Create `.env` file in project root:
   ```env
   # Google Sheets Service Account JSON (minified, single line)
   VITE_GOOGLE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}

   # Your Google Spreadsheet ID
   VITE_GOOGLE_SHEETS_SPREADSHEET_ID=your-spreadsheet-id

   # Google Drive folder IDs (optional)
   VITE_ASSETS_FOLDER_ID=your-assets-folder-id
   VITE_CREATIVES_FOLDER_ID=your-creatives-folder-id

   # Server port (default: 3003)
   PORT=3003
   ```

4. **Set up Google Sheets**

   Create a Google Spreadsheet with these sheets:
   - `Audiences` - Audience definitions
   - `Topics` - Topic definitions
   - `Messages` - Message content
   - `Assets` - Asset metadata
   - `Creatives` - Creative metadata
   - `Feed` - Generated feed data
   - `Keywords` - Keyword mappings
   - `Styles` - Style definitions

   Share spreadsheet with service account email (Editor access)

5. **Set up Google Drive** (optional)

   Create two folders in Google Drive:
   - Assets folder (for images, videos, documents)
   - Creatives folder (for static and dynamic creatives)

   Share folders with service account email (Viewer access)

   See [GOOGLE_DRIVE_SETUP.md](./GOOGLE_DRIVE_SETUP.md) for detailed instructions

6. **Start development servers**

   ```bash
   # Terminal 1 - Frontend dev server
   npm run dev

   # Terminal 2 - Backend server
   npm run server
   ```

   Frontend: http://localhost:5173
   Backend: http://localhost:3003

### Production Setup with PM2

```bash
# Install PM2 globally
npm install -g pm2

# Build frontend
npm run build

# Start all processes
pm2 start ecosystem.config.cjs

# View process status
pm2 status

# View logs
pm2 logs

# Restart processes
pm2 restart all

# Stop processes
pm2 stop all
```

See [SERVER_MANAGEMENT.md](./SERVER_MANAGEMENT.md) for PM2 commands and troubleshooting.

### Default Login

- **Email**: `beliczki.robert@gmail.com`
- **Password**: `temporary123`

---

## 📖 Usage

### Getting Started

1. **Login**: Use default credentials or create new user
2. **Load Data**: Data loads automatically from Google Sheets
3. **Manage Matrix**:
   - Add audiences (columns) and topics (rows)
   - Create messages in cells
   - Drag messages between cells
   - Edit message content and metadata
4. **Use Filters**:
   - Type in filter box for text search
   - Use AND/OR operators for complex queries
   - Toggle "ACTIVE only" to show active items only
5. **Switch Views**: Toggle between Matrix and Tree view
6. **Save Changes**: Click "Save" to persist changes to Google Sheets

### Working with Assets

1. **Open Assets Module**: Click "Assets" in slide-in menu
2. **Auto-sync**: Assets sync automatically from Google Drive
3. **View Options**:
   - **Masonry**: Pinterest-style responsive grid
   - **List**: Detailed table view with metadata
4. **Filter Assets**: Use filter box with AND/OR logic
5. **Preview**: Click asset to open full-screen preview
6. **Navigate**: Use arrow buttons to step through assets

### Working with Creatives

1. **Open Creative Library**: Click "Creative Library" in menu
2. **Auto-sync**: Creatives sync automatically from Google Drive
3. **View Creatives**:
   - Static images and videos
   - Dynamic HTML5 banners with live preview
4. **Filter**: Use filter box to find specific creatives
5. **Preview**: Click creative for full-screen preview
6. **Create Share**: Select creatives and click "Create Share Gallery"

### Share Galleries

1. **Select Creatives**: Long-press or click to select multiple creatives
2. **Create Share**: Click "Create Share Gallery" button
3. **Share Link**: Copy the generated public link
4. **View Gallery**: Recipients can view without login
5. **Download ZIP**: Gallery includes download button for all creatives

### AI Content Generation

1. **Open Message Editor**: Edit any message
2. **Open Claude Chat**: Click Sparkles icon
3. **Enter API Key**: First time only
4. **Generate Content**:
   - AI uses audience and topic context automatically
   - Generated content fills message fields
   - Iterate with additional prompts
5. **Apply**: Content automatically populates fields

### Template Management

1. **Upload Templates**: Place HTML template folders in `src/templates/html/`
2. **Configure**: Edit `template.json` with placeholder bindings
3. **Set Paths**: Use `path-messagingmatrix` for asset base URLs
4. **Preview**: Templates render automatically in Creative Library
5. **Message Binding**: Bind template placeholders to message fields

---

## 🔐 Security

- **Password Hashing**: SHA-256 for user passwords
- **Service Account Auth**: Google Cloud service account for API access
- **API Key Storage**: Claude API key in browser localStorage
- **Session Management**: Secure session with token validation
- **HTTPS Required**: Production requires SSL/TLS
- **Proxy Serving**: Assets served through backend proxy for security

---

## 🚢 Deployment

### Quick Build

```bash
# Build frontend
npm run build

# Build output in dist/ folder
```

### Production Deployment

See [PRODUCTION_SETUP.md](./PRODUCTION_SETUP.md) for complete deployment instructions including:

- SSL/HTTPS configuration
- PM2 process management
- Environment variable setup
- Reverse proxy configuration
- Domain setup
- Testing and troubleshooting

---

## 📊 Data Structure

### Google Sheets Format

**Audiences Sheet:**
```
ID | Name | Order | Status | Product | Strategy | Buying_Platform | Data_Source |
Targeting_Type | Device | Tag | Key | Comment | Campaign_Name | Campaign_ID |
Lineitem_Name | Lineitem_ID
```

**Topics Sheet:**
```
ID | Name | Key | Order | Status | Product | Tag1 | Tag2 | Tag3 | Tag4 |
Created | Comment
```

**Messages Sheet:**
```
ID | Name | Number | Variant | Audience_Key | Topic_Key | Version | PMMID |
Status | Start_date | End_date | Template | Template_variant_classes |
Headline | Copy1 | Copy2 | Image1 | Image2 | Image3 | Image4 | Image5 |
Image6 | Flash | Flash_style | CTA | Landing_URL | Comment
```

**Assets Sheet:**
```
ID | Brand | Product | Type | Visual_keyword | File_format | File_driveID |
File_name | File_size | File_date | File_dimensions | File_DirectLink |
File_thumbnail | Comment
```

**Creatives Sheet:**
```
ID | Brand | Product | Copy_keyword | Visual_keyword | Template | Version |
File_format | File_driveID | File_name | File_size | File_date |
File_dimensions | File_DirectLink | File_thumbnail | Comment
```

---

## 🔧 Available Scripts

```bash
# Development
npm run dev          # Start Vite dev server (port 5173)
npm run server       # Start backend server (port 3003)

# Production
npm run build        # Build for production
npm run preview      # Preview production build

# PM2 Process Management
pm2 start ecosystem.config.cjs    # Start all processes
pm2 status                        # View process status
pm2 logs                          # View logs
pm2 restart all                   # Restart all processes
pm2 stop all                      # Stop all processes

# Code Quality
npm run lint         # Run ESLint
```

---

## 🆘 Support & Troubleshooting

### Common Issues

**Service account authentication failed:**
- Verify service account has Editor access to spreadsheet
- Check JSON key is properly minified in `.env`
- Ensure Google Sheets API is enabled

**Assets not loading:**
- Check Drive folder IDs in environment variables
- Verify service account has Viewer access to folders
- Check browser console for proxy errors

**Creatives not displaying:**
- Verify File_driveID column in spreadsheet
- Check folder has HTML files for dynamic creatives
- Ensure template.json is properly configured

**Claude API not working:**
- Verify API key is valid
- Check API key has sufficient credits
- Ensure you're using Claude 3 compatible model

**Data not syncing:**
- Check spreadsheet ID in environment variables
- Verify all required sheets exist
- Check browser console for errors

**PM2 processes not starting:**
- Run `pm2 status` to check process state
- Check `pm2 logs` for error messages
- Verify ports 3003 and 5173 are not in use

### Resources

- [Google Sheets API Documentation](https://developers.google.com/sheets/api)
- [Google Drive API Documentation](https://developers.google.com/drive/api)
- [Claude API Documentation](https://docs.anthropic.com/)
- [React Documentation](https://react.dev/)
- [Vite Documentation](https://vitejs.dev/)
- [TailwindCSS Documentation](https://tailwindcss.com/)
- [PM2 Documentation](https://pm2.keymetrics.io/)

---

## 🎯 Roadmap

### Completed Features ✅

- ✅ Assets Library with Google Drive integration
- ✅ Creative Library with static and dynamic creatives
- ✅ Virtual scrolling with masonry layout
- ✅ Share gallery system with ZIP downloads
- ✅ Template management with HTML5 support
- ✅ Advanced filtering with AND/OR logic
- ✅ Pattern evaluation for PMMID and trafficking
- ✅ State management dialog

### Upcoming Features 🚧

- [ ] Monitoring and analytics dashboard
- [ ] User management interface
- [ ] Bulk import/export functionality
- [ ] Version history and rollback
- [ ] Collaborative editing
- [ ] Real-time sync across multiple users
- [ ] Advanced reporting and insights
- [ ] API for external integrations
- [ ] Webhook support for automation
- [ ] Performance analytics

---

## 📞 Contact

**Project**: Messaging Matrix
**Version**: 2.0.0
**Website**: https://messagingmatrix.ai

---

**Built with ❤️ for marketing teams**
