# OAuth2 Authentication Fix Checklist

## 🚨 **Current Issue**
**Error**: `Sign in failed: Object { type: "tokenFailed", idpId: "google", error: "server_error" }`

**Cause**: Your domain `https://messagingmatrix.ai` is not authorized in the Google Cloud Console OAuth2 configuration.

## ✅ **Step-by-Step Fix**

### 1. Open Google Cloud Console
- Go to: https://console.cloud.google.com/apis/credentials
- Make sure you're in the correct project

### 2. Find Your OAuth2 Client ID
- Look for: `495467475194-49igjjgnh37bh5ngb1aji4naen0rjss7.apps.googleusercontent.com`
- Click on it to edit

### 3. Add Authorized JavaScript Origins
Under **"Authorized JavaScript origins"**, add these URLs:
```
https://messagingmatrix.ai
http://localhost:3000
http://localhost:3001
```

### 4. Add Authorized Redirect URIs
Under **"Authorized redirect URIs"**, add the same URLs:
```
https://messagingmatrix.ai
http://localhost:3000
http://localhost:3001
```

### 5. Save Changes
- Click **"Save"**
- Wait 5-10 minutes for changes to propagate

### 6. Test Authentication
1. Refresh your application at `https://messagingmatrix.ai`
2. Click the **"Sign In"** button
3. If it still fails, the new troubleshooting dialog will appear with detailed help

## 🔧 **Enhanced Error Handling**

The application now includes:
- **Detailed error messages** explaining what went wrong
- **Troubleshooting dialog** with step-by-step solutions
- **Domain detection** showing your current domain
- **Direct links** to Google Cloud Console
- **Copy buttons** for easy domain copying

## 🎯 **What to Expect After Fix**

1. **Sign In button** will open Google OAuth2 popup
2. **Grant permissions** for Google Sheets access
3. **Your name appears** in the header when signed in
4. **Save functionality** becomes available in change log
5. **Changes can be saved** directly to your spreadsheet

## 🔍 **Debugging Information**

The application now logs detailed information to browser console:
- OAuth2 initialization details
- Current domain and client ID
- Sign-in attempt results
- Specific error codes and messages

**To view logs:**
1. Open browser Developer Tools (F12)
2. Go to Console tab
3. Look for authentication-related messages

## 📋 **Verification Steps**

After making the changes in Google Cloud Console:

1. **Clear browser cache** (Ctrl+Shift+Delete)
2. **Refresh the application**
3. **Open browser console** to monitor logs
4. **Click "Sign In"**
5. **Check for successful authentication**

## ⚠️ **Common Issues & Solutions**

### Issue: Still getting server_error
- **Solution**: Wait longer (up to 30 minutes) for Google's changes to propagate
- **Alternative**: Try in incognito/private browsing mode

### Issue: Popup blocked
- **Solution**: Allow popups for messagingmatrix.ai in browser settings
- **Check**: Look for popup blocker icon in address bar

### Issue: Access denied
- **Solution**: Make sure to click "Allow" when Google asks for permissions
- **Scope needed**: Google Sheets read/write access

### Issue: Invalid client error
- **Solution**: Double-check the client ID matches exactly
- **Verify**: OAuth2 client is enabled and configured correctly

## 🎉 **Success Indicators**

You'll know it's working when:
- ✅ No error dialog appears after clicking "Sign In"
- ✅ Google OAuth2 popup opens successfully
- ✅ Your name appears in the top-right corner
- ✅ "Save Changes" button works in change log panel
- ✅ Changes actually appear in your Google Spreadsheet

## 📞 **Still Having Issues?**

If you're still getting errors after following these steps:

1. **Check browser console** for detailed error messages
2. **Try different browser** or incognito mode
3. **Verify API key** is set in environment variables
4. **Confirm spreadsheet** is accessible and has correct structure
5. **Wait longer** - Google changes can take time to propagate

The troubleshooting dialog in the app will provide specific guidance based on the exact error you're seeing.

---

**Once this is fixed, your Interactive Matrix Editor will have full read/write capabilities with your Google Spreadsheet!** 🚀
