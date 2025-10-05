# Interactive Matrix Editor

A powerful React-based matrix editor that connects to Google Sheets for real-time data synchronization. Built specifically for managing messaging campaigns across audiences and topics.

## 🎯 Overview

The Interactive Matrix Editor allows you to:
- **Manage Audiences & Topics**: Add, organize, and track different audience segments and topic categories
- **Create Message Variants**: Build multiple message variations for each audience-topic combination
- **Live Google Sheets Sync**: Real-time synchronization with your Google Spreadsheet
- **Drag & Drop**: Move and copy messages between audiences with intuitive drag-and-drop
- **Change Tracking**: Monitor all changes with a comprehensive change log
- **Template System**: Use predefined templates for consistent messaging

## 📊 Data Structure

The editor works with 4 Google Sheets:

### 1. Audiences Sheet
| Column | Description |
|--------|-------------|
| Name | Display name of the audience |
| Key | Short identifier (used in message naming) |
| Order | Sort order for display |
| Status | active/inactive |

### 2. Topics Sheet  
| Column | Description |
|--------|-------------|
| Name | Display name of the topic |
| Key | Short identifier (used in message naming) |
| Order | Sort order for display |
| Status | active/inactive |

### 3. Messages Sheet
| Column | Description |
|--------|-------------|
| Name | Auto-generated: `audience!topic!m{number}!{variant}!n{version}` |
| Number | Message number (auto-incrementing) |
| Variant | Letter variant (a, b, c, etc.) |
| Audience | Audience key |
| Topic | Topic key |
| Version | Version number |
| Template | Selected template name |
| Landing URL | Destination URL |
| Headline | Main headline text |
| Copy1 | Primary copy text |
| Copy2 | Secondary copy text |
| Flash | Flash/urgency text |
| CTA | Call-to-action text |
| Comment | Internal notes |

### 4. Templates Sheet
| Column | Description |
|--------|-------------|
| Name | Template name |
| Type | Template type (banner, email, etc.) |
| Dimensions | Size specifications |
| Version | Template version |

## 🚀 Features

### Matrix Grid Interface
- **Interactive table** showing topics vs audiences
- **Visual indicators** for new and modified content
- **Hover effects** and intuitive controls
- **Responsive design** that works on all screen sizes

### Message Management
- **Auto-incrementing message numbers** - Each new message gets the next available number
- **Variant system** - Multiple variants (a, b, c) for the same message number
- **Drag & drop** - Move messages between audiences (updates naming automatically)
- **Copy with Ctrl+Drag** - Duplicate messages to other audiences
- **Rich editor popup** - Full editing interface for all message fields

### Change Tracking
- **Comprehensive logging** - Every action is tracked
- **Visual indicators** - See what's new, modified, or pending
- **Expandable change log** - Review all changes before saving
- **Batch saving** - Save multiple changes to spreadsheet at once

### Google Sheets Integration
- **Real-time sync** - Auto-sync every 60 seconds
- **Manual sync** - Instant sync button
- **Error handling** - Clear error messages and recovery options
- **Direct spreadsheet access** - Quick link to edit in Google Sheets

## 🛠 Setup Instructions

### Prerequisites
1. Google Cloud Console account
2. Google Sheets API enabled
3. API key with proper restrictions
4. Google Spreadsheet with correct structure

### Step 1: Configure Google Sheets API
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create or select a project
3. Enable Google Sheets API
4. Create an API key
5. Restrict the key to Google Sheets API only

### Step 2: Set Up Your Spreadsheet
1. Create a Google Spreadsheet with 4 sheets: `audiences`, `topics`, `messages`, `templates`
2. Set up the column headers as described in the data structure above
3. Make the spreadsheet publicly readable (Anyone with link → Viewer)
4. Copy the spreadsheet ID from the URL

### Step 3: Configure the Application
1. Create a `.env` file in your project root:
   ```env
   VITE_GOOGLE_SHEETS_API_KEY=your_api_key_here
   ```
2. The spreadsheet ID is already configured for your specific sheet
3. Start the development server: `npm run dev`

## 🎮 Usage Guide

### Adding Audiences and Topics
1. **Add Audience**: Click the `+` button in the last column header
2. **Add Topic**: Click the `+` button in the last row's first cell
3. Enter a descriptive name - the key will be auto-generated

### Creating Messages
1. **Add Message**: Click `+ Add Message` in any audience-topic intersection
2. The system automatically:
   - Assigns the next message number
   - Sets variant to 'a' (or next available letter)
   - Generates the proper naming convention
   - Marks it as new in the change log

### Editing Messages
1. **Click any message card** to open the full editor
2. **Edit all fields** including template selection, copy, CTA, etc.
3. **Save changes** - they're tracked in the change log
4. **Auto-preview** - see headline and copy1 on the card

### Moving and Copying Messages
1. **Drag to move** - Drag a message card to a different audience column
2. **Ctrl+Drag to copy** - Hold Ctrl while dragging to create a copy
3. **Automatic renaming** - The audience part of the name updates automatically
4. **Variant handling** - Copies get the next available variant letter

### Managing Changes
1. **View change log** - Click the "Changes" button in the header
2. **Review modifications** - See all pending changes before saving
3. **Save to spreadsheet** - Batch save all changes at once
4. **Auto-sync** - Changes from others sync automatically every minute

## 🔧 Technical Details

### Message Naming Convention
Messages follow the pattern: `{audience}!{topic}!m{number}!{variant}!n{version}`

Examples:
- `ya!launch!m1!a!n1` - Young adults, product launch, message 1, variant a, version 1
- `prof!brand!m2!b!n1` - Professionals, brand awareness, message 2, variant b, version 1

### Auto-Incrementing Logic
- **New topic-audience combination**: Gets next global message number
- **Existing combination**: Uses same message number, next variant letter
- **Cross-audience moves**: Keeps original message number
- **Copies**: Use same number, get next available variant in target audience

### Drag & Drop Behavior
- **Same row only**: Messages can only move between audiences in the same topic row
- **Visual feedback**: Drag over effects and cursor changes
- **Ctrl modifier**: Hold Ctrl to copy instead of move
- **Automatic updates**: Names update instantly to reflect new audience

### Change Tracking System
Every action creates a log entry with:
- **Timestamp**: When the change occurred
- **Type**: audience, topic, or message
- **Action**: create, update, move, copy, delete
- **Data**: Specific details about what changed
- **Sync status**: Whether it's been saved to the spreadsheet

## 🚨 Important Notes

### Data Consistency
- **Message numbers are global**: Once assigned, a message number is never reused
- **Variants are per-combination**: Each audience-topic combo has its own variant sequence
- **Keys must be unique**: Audience and topic keys cannot be duplicated

### Google Sheets Limitations
- **Read-only sync**: Currently syncs FROM spreadsheet TO app
- **Manual save required**: Changes must be manually saved back to spreadsheet
- **API quotas**: Google Sheets API has usage limits
- **Public access needed**: Spreadsheet must be publicly readable

### Performance Considerations
- **Auto-sync interval**: 60 seconds (configurable)
- **Change batching**: Multiple changes are grouped for efficiency
- **Local state**: All editing happens locally until saved
- **Memory usage**: Large datasets may impact performance

## 🔮 Future Enhancements

### Planned Features
- **Write-back to spreadsheet**: Direct saving without manual intervention
- **Bulk operations**: Select multiple messages for batch actions
- **Template preview**: Visual preview of selected templates
- **Export options**: PDF, CSV, and other format exports
- **Collaboration**: Real-time collaboration indicators
- **Version control**: Track and compare different versions
- **Advanced filtering**: Filter by status, audience, topic, etc.
- **Search functionality**: Find messages by content or metadata

### Technical Improvements
- **OAuth2 integration**: Secure write access to spreadsheets
- **Offline mode**: Work without internet connection
- **Undo/redo**: Full action history with undo capability
- **Keyboard shortcuts**: Power user shortcuts for common actions
- **Mobile optimization**: Better mobile/tablet experience

---

## 🎉 You're Ready!

Your Interactive Matrix Editor is now set up and ready to use. The interface is intuitive and powerful, allowing you to manage complex messaging campaigns with ease.

**Key Shortcuts:**
- **Drag**: Move message between audiences
- **Ctrl+Drag**: Copy message to another audience  
- **Click message**: Open full editor
- **+ buttons**: Add new audiences and topics
- **Changes panel**: Review and save modifications

Start by adding your audiences and topics, then create your first message to see the system in action!
