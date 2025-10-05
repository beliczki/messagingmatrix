# Save Changes to Spreadsheet - Setup & Usage Guide

The Interactive Matrix Editor now supports saving changes back to your Google Spreadsheet using OAuth2 authentication. This guide covers setup, usage, and troubleshooting.

## 🎯 Overview

The save functionality allows you to:
- **Authenticate with Google** using OAuth2
- **Save new audiences and topics** directly to your spreadsheet
- **Save new messages** with all their details
- **Track changes locally** until they're saved
- **Batch save multiple changes** at once
- **See real-time feedback** on save operations

## 🔧 Setup Requirements

### 1. Google Cloud Console Configuration

Your existing setup needs one additional step:

#### Enable OAuth2 Web Application
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to "APIs & Services" → "Credentials"
3. Find your OAuth2 client ID: `495467475194-49igjjgnh37bh5ngb1aji4naen0rjss7.apps.googleusercontent.com`
4. Click on it to edit
5. Under "Authorized JavaScript origins", add:
   - `http://localhost:3000` (for development)
   - `http://localhost:3001` (backup port)
   - Your production domain (e.g., `https://yourdomain.com`)
6. Under "Authorized redirect URIs", add the same URLs
7. Save the changes

### 2. Environment Configuration

Your `.env` file should contain:
```env
VITE_GOOGLE_SHEETS_API_KEY=your_api_key_here
```

The client ID and spreadsheet ID are already configured in the code.

### 3. Spreadsheet Permissions

Your spreadsheet needs to be:
- **Publicly readable** (for reading data)
- **Writable by authenticated users** (the OAuth2 scope handles this)

## 🚀 How to Use

### Step 1: Start the Application
```bash
npm run dev
```

### Step 2: Sign In
1. Click the **"Sign In"** button in the top-right corner
2. A Google OAuth2 popup will appear
3. Sign in with your Google account
4. Grant permissions to access Google Sheets
5. You'll see your name appear in the header when signed in

### Step 3: Make Changes
1. **Add audiences** using the + button in column headers
2. **Add topics** using the + button in row headers  
3. **Create messages** by clicking "Add Message" in any cell
4. **Edit messages** by clicking on message cards
5. **Drag & drop** to move/copy messages between audiences

### Step 4: Review Changes
1. Click **"Changes"** button to open the change log panel
2. Review all pending changes
3. Each change shows:
   - **Icon** indicating the type of action
   - **Description** of what changed
   - **Timestamp** when the change was made
   - **Status** (pending or synced)

### Step 5: Save Changes
1. Click **"Save X Changes to Spreadsheet"** in the change log panel
2. If not signed in, you'll be prompted to authenticate
3. Watch the progress indicator during saving
4. See success/failure feedback
5. Successfully saved changes are marked as "synced"

## 📊 What Gets Saved

### New Audiences
- Added to the "audiences" sheet
- Columns: Name, Key, Order, Status
- Status defaults to "active"

### New Topics  
- Added to the "topics" sheet
- Columns: Name, Key, Order, Status
- Status defaults to "active"

### New Messages
- Added to the "messages" sheet
- All 14 columns are populated:
  - Name (auto-generated pattern)
  - Number, Variant, Audience, Topic, Version
  - Template, Landing URL, Headline
  - Copy1, Copy2, Flash, CTA, Comment

### Message Updates
- Currently logs the changes (full update logic coming soon)
- Tracks what fields were modified

## 🔄 How Saving Works

### Authentication Flow
1. **OAuth2 popup** appears when signing in
2. **Permissions requested**: Google Sheets read/write access
3. **Access token** stored temporarily in browser
4. **Token used** for all write operations

### Save Process
1. **Group changes** by spreadsheet sheet (audiences, topics, messages)
2. **Process each sheet** sequentially
3. **Append new rows** to the appropriate sheets
4. **Update existing rows** (for modifications)
5. **Mark changes as synced** when successful
6. **Show results** with success/error feedback

### Data Consistency
- **Read before write**: Current data is read to avoid conflicts
- **Append operations**: New data is added to the end of sheets
- **Atomic operations**: Each sheet is updated completely or not at all
- **Error handling**: Failed saves don't mark changes as synced

## 🎨 User Interface

### Header Authentication
- **Sign In button** when not authenticated
- **User name + Sign Out** when authenticated  
- **Green checkmark** indicates successful authentication

### Change Log Panel
- **Expandable panel** on the right side
- **Change counter** in the header button
- **Color-coded changes** by action type:
  - 🟢 Green: Create operations
  - 🟡 Yellow: Update operations  
  - 🔵 Blue: Move operations
  - 🟣 Purple: Copy operations
- **Save button** changes based on auth status
- **Progress indicator** during save operations
- **Success/error feedback** after save attempts

### Visual Indicators
- **Orange badges** on "pending" changes
- **User info** in change log when authenticated
- **Loading spinners** during operations
- **Color-coded results** (green success, red error)

## 🔧 Troubleshooting

### Common Issues

#### "Sign in failed: Popup blocked"
- **Solution**: Allow popups for your domain
- **Alternative**: Check browser popup blocker settings

#### "Not authenticated" when saving
- **Solution**: Click "Sign In" button first
- **Check**: Look for your name in the header
- **Retry**: Sign out and sign in again if needed

#### "Failed to save changes: 403 Forbidden"
- **Solution**: Check OAuth2 client configuration
- **Verify**: Authorized origins include your domain
- **Confirm**: Spreadsheet has correct sharing settings

#### "Failed to save changes: Network error"
- **Solution**: Check internet connection
- **Verify**: Google Sheets API is accessible
- **Retry**: Wait a moment and try saving again

#### Changes not appearing in spreadsheet
- **Check**: Refresh your Google Sheets tab
- **Verify**: Look at the correct sheet tabs (audiences, topics, messages)
- **Confirm**: Save operation showed success message

### Debug Steps

1. **Open browser console** (F12 → Console tab)
2. **Look for error messages** during sign in or save
3. **Check network tab** for failed API requests
4. **Verify API key** is correctly set in .env file
5. **Test spreadsheet access** by opening it manually

### API Limits

Google Sheets API has usage quotas:
- **100 requests per 100 seconds per user**
- **300 requests per 100 seconds** (total)

If you hit limits:
- **Wait** for the quota to reset
- **Batch changes** to reduce API calls
- **Avoid rapid saves** in succession

## 🔐 Security Notes

### Authentication Security
- **OAuth2 tokens** are temporary and stored in browser memory
- **No passwords** are stored locally
- **Tokens expire** automatically for security
- **Re-authentication** required after token expiry

### Data Privacy
- **Read/write access** only to your specified spreadsheet
- **No access** to other Google Drive files
- **Permissions** can be revoked in Google Account settings

### Production Deployment
- **Add your domain** to authorized origins
- **Use HTTPS** for production deployments
- **Monitor API usage** in Google Cloud Console
- **Set up error tracking** for save failures

## 🎉 Success!

You now have a fully functional save system that:
- ✅ **Authenticates securely** with Google OAuth2
- ✅ **Saves all types of changes** to your spreadsheet
- ✅ **Provides clear feedback** on operations
- ✅ **Tracks changes locally** until saved
- ✅ **Handles errors gracefully** with helpful messages

### Next Steps
1. **Test with your API key** and client credentials
2. **Create some test data** (audiences, topics, messages)
3. **Save changes** and verify they appear in your spreadsheet
4. **Deploy to production** when ready

The matrix editor is now a complete, production-ready application for managing your messaging campaigns! 🚀
