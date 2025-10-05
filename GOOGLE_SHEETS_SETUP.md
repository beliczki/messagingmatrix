# Google Sheets Integration Setup Guide

This guide will walk you through setting up Google Sheets integration with your React skeleton for live data synchronization.

## 🎯 Overview

The Google Sheets integration allows you to:
- Sync data in real-time from Google Sheets
- Auto-update every 30 seconds when connected
- Use spreadsheet data in your Claude artifacts
- Manage content without touching code

## 📋 Prerequisites

1. A Google account
2. Access to Google Cloud Console
3. A Google Spreadsheet

## 🚀 Step-by-Step Setup

### Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Note down your project ID

### Step 2: Enable Google Sheets API

1. In the Google Cloud Console, go to "APIs & Services" → "Library"
2. Search for "Google Sheets API"
3. Click on it and press "Enable"

### Step 3: Create API Key

1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "API Key"
3. Copy the API key (starts with `AIza...`)
4. **Important**: Click "Restrict Key" and:
   - Under "API restrictions", select "Restrict key"
   - Choose "Google Sheets API" only
   - Under "Application restrictions", choose "HTTP referrers" and add your domain

### Step 4: Create Google Spreadsheet

1. Create a new Google Spreadsheet
2. Set up your data structure (see format below)
3. **Important**: Make the spreadsheet publicly readable:
   - Click "Share" button
   - Change "Restricted" to "Anyone with the link"
   - Set permission to "Viewer"

### Step 5: Get Spreadsheet ID

From your Google Sheets URL:
```
https://docs.google.com/spreadsheets/d/[SPREADSHEET_ID]/edit#gid=0
```
Copy the `SPREADSHEET_ID` part.

### Step 6: Configure Environment Variables

Create a `.env` file in your project root:

```env
VITE_GOOGLE_SHEETS_API_KEY=your_api_key_here
VITE_GOOGLE_SHEETS_SPREADSHEET_ID=your_spreadsheet_id_here
```

**Security Note**: Never commit your `.env` file to version control!

## 📊 Spreadsheet Data Format

Your Google Spreadsheet should follow this structure:

### Header Row (Row 1):
```
Type | Name | Key | TopicKey | AudienceKey | MessageNumber | Variant | MessageID | Content
```

### Data Rows Examples:
```
Audience | Young Adults | ya | | | | | |
Audience | Professionals | prof | | | | | |
Topic | Product Launch | launch | | | | | |
Topic | Brand Awareness | brand | | | | | |
Message | | | launch | ya | 1 | a | ya!launch!m1!a | Exciting new product for young innovators!
Message | | | launch | prof | 1 | a | prof!launch!m1!a | Professional-grade solution for your business needs.
```

## 🔄 How It Works

1. **Auto-sync**: Data syncs automatically every 30 seconds
2. **Manual sync**: Click the "Sync Now" button for immediate updates
3. **Real-time**: Changes in your spreadsheet appear in your app within 30 seconds
4. **Error handling**: Connection issues are displayed with helpful messages

## 🛠 Usage in Your Claude Artifacts

Once connected, your Claude artifacts can access the synced data:

```javascript
// In your artifact component
const YourArtifact = ({ syncedData }) => {
  const { audiences, topics, messages } = syncedData || {};
  
  return (
    <div>
      {audiences?.map(audience => (
        <div key={audience.id}>{audience.name}</div>
      ))}
    </div>
  );
};
```

## 🔧 Troubleshooting

### Common Issues:

1. **"API key not configured"**
   - Check your `.env` file exists and has the correct variable names
   - Restart your development server after creating `.env`

2. **"Failed to fetch spreadsheet info"**
   - Verify your spreadsheet is publicly readable
   - Check the spreadsheet ID is correct
   - Ensure the API key has Google Sheets API enabled

3. **"Request failed with status 403"**
   - Your API key might not have the right permissions
   - Check API restrictions in Google Cloud Console
   - Verify the spreadsheet sharing settings

4. **"No data found"**
   - Check your spreadsheet format matches the expected structure
   - Ensure there's data in your spreadsheet
   - Verify column headers are correct

### Testing Your Setup:

1. Open browser developer tools (F12)
2. Go to Console tab
3. Look for sync messages and any error logs
4. Check the Network tab for API calls to `sheets.googleapis.com`

## 🚀 Advanced Configuration

### Custom Sync Intervals

To change the auto-sync interval, modify `src/hooks/useGoogleSheets.js`:

```javascript
// Change 30000 (30 seconds) to your preferred interval in milliseconds
const interval = setInterval(async () => {
  // ... sync logic
}, 30000);
```

### Multiple Spreadsheets

To support multiple spreadsheets, you can extend the service to accept different spreadsheet IDs dynamically.

## 📈 Best Practices

1. **Keep your API key secure** - Never expose it in client-side code in production
2. **Use meaningful keys** - Make audience and topic keys descriptive but short
3. **Structure your data** - Keep your spreadsheet organized with clear headers
4. **Test regularly** - Verify sync is working after making changes
5. **Monitor usage** - Check Google Cloud Console for API usage limits

## 🔐 Production Deployment

For production deployment:

1. **Use environment variables** on your hosting platform
2. **Restrict API key** to your production domain
3. **Consider rate limits** - Google Sheets API has usage quotas
4. **Monitor errors** - Set up error tracking for API failures

## 📞 Support

If you encounter issues:
1. Check the browser console for detailed error messages
2. Verify all setup steps were completed correctly
3. Test with the sample data structure first
4. Ensure your Google Cloud project has the Sheets API enabled

---

🎉 **You're all set!** Your React skeleton now has live Google Sheets integration. Any Claude artifact you paste will be able to access and use your spreadsheet data in real-time.
