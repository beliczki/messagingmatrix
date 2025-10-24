# Messaging Matrix

> A comprehensive messaging campaign management platform with Google Sheets integration, AI-powered content generation, and visual decision tree analysis.

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![React](https://img.shields.io/badge/React-18.3-61DAFB?logo=react)
![Vite](https://img.shields.io/badge/Vite-5.4-646CFF?logo=vite)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3.4-38B2AC?logo=tailwind-css)

---

## 🚨 CRITICAL DOCUMENTATION 🚨

**⚠️ BEFORE DEBUGGING PERFORMANCE ISSUES, READ THIS:**

### [React Component Remounting Performance Fix](./REACT_PERFORMANCE_REMOUNT_FIX.md)

**If you see:**
- Component "reloading" or "rebuilding" on every interaction
- Laggy, unresponsive UI during zoom, filter, or state changes
- Component UNMOUNT → MOUNT in console logs

**Read the guide above FIRST!** This issue has happened **3 times** and cost **3+ hours each time**.

Quick fix checklist:
- [ ] Check if component is defined inside another component's render
- [ ] Check for dynamic `key` props
- [ ] Add module-level caching instead of React hooks
- [ ] Use inline JSX instead of component functions

---

## 🎯 Overview

**Messaging Matrix** is a powerful web application designed for marketing teams to manage, organize, and optimize messaging campaigns across multiple audiences and topics. It provides a visual matrix interface, decision tree visualization, and AI-powered content generation capabilities.

### Key Capabilities

- **📊 Matrix View**: Organize messages across audiences and topics in an intuitive grid
- **🌳 Tree View**: Visualize campaign strategy as an interactive decision tree
- **🔄 Google Sheets Sync**: Bidirectional sync with Google Spreadsheets for data persistence
- **🤖 AI Content Generation**: Integrate with Claude AI to generate message variations
- **👥 Multi-user Support**: Secure authentication system with user management
- **📱 Responsive Design**: Works seamlessly on desktop and mobile devices

---

## 🚀 Features

### Matrix Management
- **Visual Grid Interface**: Organize messages by audience (columns) and topic (rows)
- **Drag & Drop**: Move messages between cells with intuitive drag-and-drop
- **Status Tracking**: Color-coded status indicators (Active, Inactive, In Progress, Planned)
- **Filtering**: Advanced text filtering with AND/OR logic, Active-only filter
- **Strategy Tagging**: Display strategy prefixes on audience headers
- **Quick Actions**: Edit, duplicate, copy, and delete messages inline

### Decision Tree View
- **Hierarchical Visualization**: Strategy → Targeting Type → Audience → Topic → Messages
- **Interactive Navigation**: Pan with Space + Drag, Zoom with Space + Scroll
- **Custom Positioning**: Drag nodes to customize tree layout
- **Connector Styles**: Toggle between curved and elbow connectors
- **Status Coloring**: Messages colored by status for quick identification
- **Persistent State**: View settings preserved when switching between Matrix and Tree

### Google Sheets Integration
- **Service Account Authentication**: Secure, no-login-required access to private spreadsheets
- **Automatic Sync**: Load data from and save changes back to Google Sheets
- **Batch Operations**: Efficient bulk read/write operations
- **Progress Tracking**: Visual feedback during save operations
- **State Management**: View last sync time and manage local cache

### AI Content Generation
- **Claude API Integration**: Generate message variations using Anthropic's Claude
- **Context-Aware**: Uses audience, topic, and targeting data for relevant suggestions
- **Multi-field Generation**: Create headlines, copy, CTAs, and flash messages
- **Interactive Chat**: Chat interface for iterative content refinement
- **API Key Management**: Secure local storage of API credentials

### User Authentication
- **Secure Login**: Password hashing with SHA-256
- **Session Management**: Persistent login with localStorage
- **Default User**: Pre-configured admin account
- **User Display**: Show logged-in user in navigation menu
- **Logout**: Clean session termination

### Module Architecture
- **Messaging Matrix**: Main campaign management module
- **Assets Library**: Placeholder for creative asset management (coming soon)
- **Monitoring**: Placeholder for analytics and reporting (coming soon)
- **Users**: Placeholder for user management (coming soon)
- **Slide-in Menu**: Elegant navigation between modules

---

## 🏗️ Architecture

### Tech Stack

**Frontend:**
- **React 18.3** - UI framework
- **Vite 5.4** - Build tool and dev server
- **TailwindCSS 3.4** - Utility-first CSS framework
- **Lucide React** - Icon library
- **React Hooks** - State management

**Backend/Services:**
- **Google Sheets API** - Data persistence
- **Claude API** - AI content generation
- **Service Account Auth** - Google Cloud authentication

**State Management:**
- Local state with React hooks
- localStorage for persistence
- Custom hooks for shared logic

### Project Structure

```
messagingmatrix/
├── src/
│   ├── components/
│   │   ├── Matrix.jsx           # Main matrix grid component
│   │   ├── TreeView.jsx         # Decision tree visualization
│   │   ├── ClaudeChat.jsx       # AI chat interface
│   │   ├── Login.jsx            # Authentication screen
│   │   ├── AssetsLibrary.jsx    # Assets module (placeholder)
│   │   ├── Monitoring.jsx       # Monitoring module (placeholder)
│   │   └── Users.jsx            # Users module (placeholder)
│   ├── contexts/
│   │   └── AuthContext.jsx      # Authentication context provider
│   ├── hooks/
│   │   └── useMatrix.jsx        # Matrix data management hook
│   ├── services/
│   │   ├── sheets.js            # Google Sheets API service
│   │   └── settings.js          # Application settings service
│   ├── App.jsx                  # Main application component
│   ├── App.css                  # Global styles
│   ├── index.css                # Tailwind imports
│   └── main.jsx                 # Application entry point
├── public/                      # Static assets
├── DEPLOYMENT_MESSAGINGMATRIX_AI.md  # Production deployment guide
├── FEATURES.md                  # Detailed features documentation
├── SPECIFICATION.md             # Technical specifications
└── package.json                 # Dependencies and scripts
```

---

## 🛠️ Installation & Setup

### Prerequisites

- **Node.js** 18+ and npm
- **Google Cloud Account** with service account set up
- **Claude API Key** (optional, for AI features)

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
   VITE_GOOGLE_SHEETS_SPREADSHEET_ID=your-spreadsheet-id-here
   ```

4. **Set up Google Sheets**
   - Create a Google Spreadsheet with sheets: `Audiences`, `Topics`, `Messages`
   - Share spreadsheet with service account email (Editor access)
   - See `DEPLOYMENT_MESSAGINGMATRIX_AI.md` for detailed setup instructions

5. **Start development server**
   ```bash
   npm run dev
   ```

   Opens at http://localhost:5173

6. **Start mock server** (for testing)
   ```bash
   npm run server
   ```

   Runs on http://localhost:3001

### Default Login

- **Email**: `beliczki.robert@gmail.com`
- **Password**: `temporary123`

---

## 📖 Usage

### Getting Started

1. **Login**: Use default credentials or create new user
2. **Load Data**: Click "Load" button to fetch data from Google Sheets
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

### Working with Messages

**Create Message:**
1. Click "+" button in any cell
2. Fill in message details (name, number, variant, status, etc.)
3. Optionally use Claude AI to generate content
4. Save message

**Edit Message:**
1. Click message card
2. Update fields in editor dialog
3. Use tabs to switch between naming and content
4. Preview message in different ad sizes
5. Save changes

**Move Message:**
1. Drag message card
2. Drop into target cell
3. Changes saved locally until you click "Save"

### AI Content Generation

1. **Open Claude Chat**: Click Sparkles icon in message editor
2. **Enter API Key**: First time only, enter your Claude API key
3. **Generate Content**:
   - AI automatically uses audience and topic context
   - Generated content appears in message fields
   - Iterate with additional prompts
4. **Apply**: Content automatically fills message fields

### Tree View

1. **Switch to Tree**: Click "Tree" button in header
2. **Navigate**:
   - Hold Space + Drag to pan
   - Hold Space + Scroll to zoom
3. **Customize**:
   - Drag nodes to reposition
   - Toggle connector styles
   - Reset view/positions as needed
4. **Analyze**: Visualize campaign strategy hierarchy

---

## 🔐 Security

- **Password Hashing**: SHA-256 for user passwords
- **Service Account Auth**: Google Cloud service account for API access
- **API Key Storage**: Claude API key stored in browser localStorage
- **Session Management**: Secure session handling with token validation
- **HTTPS Required**: Production deployment requires SSL/TLS

---

## 🚢 Deployment

See **[DEPLOYMENT_MESSAGINGMATRIX_AI.md](./DEPLOYMENT_MESSAGINGMATRIX_AI.md)** for complete deployment instructions including:

- Google Sheets service account setup
- Claude API configuration
- Building for production
- Deploying to standard web hosting (cPanel/FTP)
- SSL/HTTPS setup
- Testing and troubleshooting

### Quick Build

```bash
# Build for production
npm run build

# Preview production build
npm run preview
```

Output in `dist/` folder ready for deployment.

---

## 📊 Data Structure

### Google Sheets Format

**Audiences Sheet:**
```
ID | Name | Order | Status | Product | Strategy | Buying_Platform | Data_Source | Targeting_Type | Device | Tag | Key | Comment | Campaign_Name | Campaign_ID | Lineitem_Name | Lineitem_ID
```

**Topics Sheet:**
```
ID | Name | Key | Order | Status | Product | Tag1 | Tag2 | Tag3 | Tag4 | Created | Comment
```

**Messages Sheet:**
```
ID | Name | Number | Variant | Audience_Key | Topic_Key | Version | PMMID | Status | Start_date | End_date | Template | Template_variant_classes | Headline | Copy1 | Copy2 | Image1-6 | Flash | CTA | Landing_URL | Comment
```

---

## 🔧 Available Scripts

```bash
npm run dev          # Start development server (port 5173)
npm run server       # Start mock API server (port 3001)
npm run build        # Build for production
npm run preview      # Preview production build
npm run lint         # Run ESLint
```

---

## 🤝 Contributing

This is a private project. For questions or support, contact the development team.

---

## 📝 License

Proprietary - All rights reserved

---

## 🆘 Support

### Common Issues

**Service account authentication failed:**
- Verify service account has Editor access to spreadsheet
- Check JSON key is properly minified in `.env`
- Ensure Google Sheets API is enabled

**Claude API not working:**
- Verify API key is valid
- Check API key has sufficient credits
- Ensure you're using Claude 3 compatible model

**Data not loading:**
- Check spreadsheet ID in environment variables
- Verify sheet names match exactly: Audiences, Topics, Messages
- Check browser console for errors

### Resources

- [Google Sheets API Documentation](https://developers.google.com/sheets/api)
- [Claude API Documentation](https://docs.anthropic.com/)
- [React Documentation](https://react.dev/)
- [Vite Documentation](https://vitejs.dev/)
- [TailwindCSS Documentation](https://tailwindcss.com/)

---

## 🎯 Roadmap

### Upcoming Features

- [ ] Assets Library module implementation
- [ ] Monitoring and analytics dashboard
- [ ] User management interface
- [ ] Bulk import/export functionality
- [ ] Template management system
- [ ] Version history and rollback
- [ ] Collaborative editing
- [ ] Real-time sync across multiple users
- [ ] Advanced reporting and insights
- [ ] API for external integrations

---

## 📞 Contact

**Project**: Messaging Matrix
**Version**: 1.0.0
**Website**: https://messagingmatrix.ai

---

**Built with ❤️ for marketing teams**
