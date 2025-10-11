# Deployment Guide for messagingmatrix.ai (Standard Web Hosting)

This guide provides step-by-step instructions for deploying your Messaging Matrix application to standard web hosting at **messagingmatrix.ai**.

---

## 📋 Prerequisites

- Access to your web hosting control panel (cPanel or similar)
- FTP/SFTP credentials or File Manager access
- Node.js installed locally for building the application
- Google Cloud account for service account setup
- Claude API account

---

## Part 1: Google Sheets Service Account Setup

### Step 1: Create a Google Cloud Project

1. **Go to Google Cloud Console**
   - Visit: https://console.cloud.google.com/

2. **Create a new project**
   - Click the project dropdown at the top
   - Click "New Project"
   - Name: "Messaging Matrix Production"
   - Click "Create"

3. **Select your project**
   - Wait for the project to be created
   - Select it from the project dropdown

### Step 2: Enable Google Sheets API

1. **Navigate to APIs & Services**
   - Click the hamburger menu (☰)
   - Go to "APIs & Services" > "Library"

2. **Enable Google Sheets API**
   - Search for "Google Sheets API"
   - Click on it
   - Click "Enable"
   - Wait for activation

### Step 3: Create Service Account

1. **Go to Service Accounts**
   - Click the hamburger menu (☰)
   - Go to "IAM & Admin" > "Service Accounts"
   - Click "Create Service Account"

2. **Configure Service Account**
   - **Service account name**: `messaging-matrix-prod`
   - **Service account ID**: Auto-generated (e.g., `messaging-matrix-prod@project-id.iam.gserviceaccount.com`)
   - **Description**: "Service account for Messaging Matrix production app"
   - Click "Create and Continue"

3. **Grant Permissions** (Optional)
   - You can skip this step for now
   - Click "Continue"

4. **Grant User Access** (Optional)
   - Skip this step
   - Click "Done"

### Step 4: Generate Service Account Key

1. **Access the Service Account**
   - Find your newly created service account in the list
   - Click on it to open details

2. **Create JSON Key**
   - Go to the "Keys" tab
   - Click "Add Key" > "Create new key"
   - Select "JSON" format
   - Click "Create"
   - **IMPORTANT**: A JSON file will download automatically - save it securely!

3. **JSON Key Structure** (example):
   ```json
   {
     "type": "service_account",
     "project_id": "messaging-matrix-prod",
     "private_key_id": "abc123...",
     "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
     "client_email": "messaging-matrix-prod@project-id.iam.gserviceaccount.com",
     "client_id": "123456789...",
     "auth_uri": "https://accounts.google.com/o/oauth2/auth",
     "token_uri": "https://oauth2.googleapis.com/token",
     "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
     "client_x509_cert_url": "..."
   }
   ```

### Step 5: Share Spreadsheet with Service Account

1. **Open Your Google Spreadsheet**
   - Go to your messaging matrix spreadsheet
   - Click the "Share" button

2. **Share with Service Account Email**
   - Copy the service account email (e.g., `messaging-matrix-prod@project-id.iam.gserviceaccount.com`)
   - Paste it in the "Add people and groups" field
   - Set permission to "Editor"
   - **Uncheck** "Notify people" (service accounts don't need notifications)
   - Click "Share"

3. **Verify Spreadsheet ID**
   - Your spreadsheet URL looks like: `https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit`
   - Copy the `SPREADSHEET_ID` - you'll need it later

---

## Part 2: Claude API Setup

### Step 1: Get Claude API Key

1. **Go to Anthropic Console**
   - Visit: https://console.anthropic.com/

2. **Sign in or Create Account**
   - Sign in with your account
   - Or create a new account if needed

3. **Generate API Key**
   - Go to "API Keys" section
   - Click "Create Key"
   - Name: "Messaging Matrix Production"
   - Copy the API key immediately (it won't be shown again!)
   - Format: `sk-ant-api03-...`

4. **Set Up Billing** (if not already done)
   - Go to "Billing" section
   - Add payment method
   - Set usage limits if desired

### Step 2: Configure API Key in Application

**IMPORTANT**: The Claude API key is entered by users in the application itself, not in environment variables. Users will:
1. Click the Claude chat button in the app
2. Enter their API key in the settings
3. The key is stored in browser localStorage

**For Production**: You can pre-configure a default API key in the code if you want all users to use the same key (see Optional Configuration below).

---

## Part 3: Build the Application

### Step 1: Configure Environment Variables

1. **Create Production Environment File**
   ```bash
   # In your project root, create .env.production
   ```

2. **Add Configuration**
   Create a file named `.env.production` with:
   ```env
   # Google Sheets Service Account (paste entire JSON on one line)
   VITE_GOOGLE_SERVICE_ACCOUNT_KEY={"type":"service_account","project_id":"messaging-matrix-prod",...}

   # Your Spreadsheet ID
   VITE_GOOGLE_SHEETS_SPREADSHEET_ID=your-actual-spreadsheet-id-here
   ```

3. **Minify the JSON Key** (important!)
   - The JSON key must be on a single line
   - Remove all line breaks and extra spaces
   - You can use: https://jsonformatter.org/json-minify
   - Or use this command:
   ```bash
   # On Linux/Mac
   cat service-account-key.json | jq -c . > minified-key.json
   ```

### Step 2: Build the Application

1. **Install Dependencies** (if not already done)
   ```bash
   npm install
   ```

2. **Build for Production**
   ```bash
   npm run build
   ```

3. **Verify Build Output**
   - A `dist` folder should be created
   - Contains: `index.html`, `assets/` folder with JS and CSS files
   - Check that build completed without errors

4. **Test Production Build Locally** (optional but recommended)
   ```bash
   npm run preview
   ```
   - Opens a local server to test the production build
   - Verify everything works correctly

---

## Part 4: Deploy to messagingmatrix.ai

### Option A: Using File Manager (cPanel)

1. **Access cPanel**
   - Log into your hosting control panel
   - Usually at: `https://messagingmatrix.ai:2083` or similar

2. **Open File Manager**
   - Navigate to File Manager
   - Go to `public_html` directory (or your domain's root folder)

3. **Backup Existing Files** (if any)
   - Select all files
   - Right-click > Compress > Create Archive
   - Name it `backup-[date].zip`

4. **Clear Old Files**
   - Delete old files (but keep `.htaccess` if it exists and you need it)

5. **Upload New Build**
   - Click "Upload" button
   - Select all files from your local `dist` folder
   - Wait for upload to complete
   - **Important**: Upload the *contents* of the `dist` folder, not the folder itself

6. **Verify File Structure**
   Your public_html should look like:
   ```
   public_html/
   ├── index.html
   ├── assets/
   │   ├── index-[hash].js
   │   ├── index-[hash].css
   │   └── ...
   └── .htaccess (see next step)
   ```

### Option B: Using FTP/SFTP

1. **Connect via FTP Client**
   - Use FileZilla, Cyberduck, or similar
   - **Host**: `ftp.messagingmatrix.ai` or your hosting IP
   - **Username**: Your FTP username
   - **Password**: Your FTP password
   - **Port**: 21 (FTP) or 22 (SFTP)

2. **Navigate to Web Root**
   - Usually `/public_html/` or `/www/`

3. **Upload Files**
   - Navigate to your local `dist` folder
   - Select ALL files inside `dist`
   - Drag to the remote server's public_html
   - Wait for upload to complete

### Step 3: Configure .htaccess for SPA Routing

Since this is a Single Page Application (SPA), you need proper URL routing.

1. **Create/Edit .htaccess file**
   In your `public_html` directory, create or edit `.htaccess`:

   ```apache
   # Enable Rewrite Engine
   <IfModule mod_rewrite.c>
     RewriteEngine On
     RewriteBase /

     # Handle Front Controller...
     RewriteCond %{REQUEST_FILENAME} !-f
     RewriteCond %{REQUEST_FILENAME} !-d
     RewriteRule ^ index.html [L]
   </IfModule>

   # CORS Headers (if needed for external APIs)
   <IfModule mod_headers.c>
     Header set Access-Control-Allow-Origin "*"
     Header set Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS"
     Header set Access-Control-Allow-Headers "Content-Type, Authorization"
   </IfModule>

   # Compression
   <IfModule mod_deflate.c>
     AddOutputFilterByType DEFLATE text/html text/plain text/xml text/css text/javascript application/javascript application/json
   </IfModule>

   # Cache Control
   <IfModule mod_expires.c>
     ExpiresActive On
     ExpiresByType text/html "access plus 0 seconds"
     ExpiresByType image/jpg "access plus 1 year"
     ExpiresByType image/jpeg "access plus 1 year"
     ExpiresByType image/gif "access plus 1 year"
     ExpiresByType image/png "access plus 1 year"
     ExpiresByType image/svg+xml "access plus 1 year"
     ExpiresByType text/css "access plus 1 month"
     ExpiresByType application/javascript "access plus 1 month"
     ExpiresByType application/json "access plus 0 seconds"
   </IfModule>

   # Security Headers
   <IfModule mod_headers.c>
     Header always set X-Content-Type-Options "nosniff"
     Header always set X-Frame-Options "SAMEORIGIN"
     Header always set X-XSS-Protection "1; mode=block"
   </IfModule>
   ```

2. **Upload .htaccess**
   - Save the file
   - Upload to your `public_html` directory
   - Make sure the filename is exactly `.htaccess` (starts with a dot)

---

## Part 5: SSL/HTTPS Setup

### Enable HTTPS (Required for Security)

1. **Via cPanel**
   - Go to "SSL/TLS Status" or "Let's Encrypt SSL"
   - Select your domain `messagingmatrix.ai`
   - Click "Install SSL Certificate" or "Issue"
   - Wait for installation (usually automatic)

2. **Force HTTPS Redirect**
   Add to the top of your `.htaccess`:
   ```apache
   # Force HTTPS
   RewriteCond %{HTTPS} off
   RewriteRule ^(.*)$ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]
   ```

3. **Verify HTTPS**
   - Visit `https://messagingmatrix.ai`
   - Check for the padlock icon in the browser
   - Verify certificate is valid

---

## Part 6: Testing and Verification

### Testing Checklist

1. **Application Loads**
   - [ ] Visit `https://messagingmatrix.ai`
   - [ ] Application loads without errors
   - [ ] No console errors in browser DevTools

2. **Authentication Works**
   - [ ] Login screen appears
   - [ ] Can log in with: `beliczki.robert@gmail.com` / `temporary123`
   - [ ] Stays logged in after page refresh
   - [ ] Logout works correctly

3. **Google Sheets Integration**
   - [ ] Click "Load" button in Matrix module
   - [ ] Data loads from spreadsheet successfully
   - [ ] No authentication errors
   - [ ] Audiences, topics, and messages display correctly

4. **Matrix Functionality**
   - [ ] Can add/edit audiences
   - [ ] Can add/edit topics
   - [ ] Can add/edit messages
   - [ ] Can drag messages between cells
   - [ ] Filter works correctly
   - [ ] "ACTIVE only" checkbox works
   - [ ] Status colors display correctly

5. **Tree View**
   - [ ] Switch to Tree View mode
   - [ ] Tree renders correctly
   - [ ] Can pan and zoom (Space + drag/scroll)
   - [ ] Tree data matches matrix

6. **Save Functionality**
   - [ ] Click "Save" button
   - [ ] Changes save to spreadsheet
   - [ ] No errors during save
   - [ ] Verify changes in Google Spreadsheet directly

7. **Claude Integration**
   - [ ] Click Claude chat button
   - [ ] Can enter Claude API key
   - [ ] Can generate message content
   - [ ] Generated content appears in message editor

8. **Responsive Design**
   - [ ] Test on mobile device or DevTools mobile view
   - [ ] Layout adapts correctly
   - [ ] All features accessible on mobile

### Common Issues and Solutions

#### Issue: "Service account authentication failed"
**Solution:**
- Verify service account email is shared with spreadsheet (Editor access)
- Check that JSON key in `.env.production` is properly minified (single line)
- Ensure Google Sheets API is enabled in Google Cloud Console

#### Issue: "Spreadsheet not found"
**Solution:**
- Verify `VITE_GOOGLE_SHEETS_SPREADSHEET_ID` matches your actual spreadsheet ID
- Check that spreadsheet is shared with service account
- Make sure spreadsheet has the correct sheet names (Audiences, Topics, Messages)

#### Issue: "404 errors on page refresh"
**Solution:**
- Verify `.htaccess` file exists and has correct SPA routing rules
- Check that mod_rewrite is enabled on your server
- Test the rewrite rule directly

#### Issue: "Mixed content warnings"
**Solution:**
- Ensure all resources load over HTTPS
- Check that HTTPS redirect is working
- Update any hardcoded HTTP URLs to HTTPS

#### Issue: "Application loads but is blank"
**Solution:**
- Check browser console for JavaScript errors
- Verify all files uploaded correctly (check file sizes)
- Clear browser cache and hard refresh (Ctrl+Shift+R)
- Check that assets folder uploaded with correct structure

---

## Part 7: Optional Configuration

### Pre-configure Claude API Key (Optional)

If you want to use a single Claude API key for all users instead of requiring them to enter their own:

1. **Edit ClaudeChat.jsx**
   Find this line (around line 34):
   ```javascript
   const savedKey = localStorage.getItem('claude_api_key');
   ```

2. **Add default key**:
   ```javascript
   const savedKey = localStorage.getItem('claude_api_key') || 'sk-ant-api03-YOUR-KEY-HERE';
   ```

3. **Rebuild and redeploy**
   ```bash
   npm run build
   # Upload new files
   ```

### Custom Domain Configuration

If you have subdomains or multiple domains:

1. **Update CORS settings** if accessing APIs from different domains
2. **Configure DNS** properly for all domains
3. **Update service account domain restrictions** in Google Cloud Console

---

## Part 8: Maintenance and Updates

### Regular Updates

**Weekly:**
- Check Google Sheets API quota usage in Cloud Console
- Monitor application performance
- Review error logs (if configured)

**Monthly:**
- Update npm dependencies: `npm update`
- Check for security vulnerabilities: `npm audit`
- Review Claude API usage and costs

**As Needed:**
- Update service account key if compromised
- Rotate Claude API key periodically
- Backup spreadsheet data regularly

### Making Updates

When you make code changes:

1. **Make changes locally**
2. **Test locally**: `npm run dev`
3. **Build**: `npm run build`
4. **Test build**: `npm run preview`
5. **Deploy**: Upload new `dist` folder contents
6. **Verify**: Test on production site
7. **Clear cache**: Users may need to hard refresh (Ctrl+Shift+R)

### Backup Strategy

**Code Backup:**
- Keep code in Git repository (GitHub, GitLab, etc.)
- Tag releases: `git tag v1.0.0`

**Data Backup:**
- Google Sheets: File > Make a copy (weekly)
- Download as Excel: File > Download > Microsoft Excel
- Export to CSV for long-term archival

**Configuration Backup:**
- Save `.env.production` file securely (not in Git!)
- Document service account details
- Keep JSON key file in secure location

---

## Part 9: Security Best Practices

### Protect Sensitive Information

1. **Service Account Key**
   - Never commit JSON key to Git
   - Store securely (password manager, encrypted storage)
   - Rotate key if compromised

2. **Claude API Key**
   - Monitor usage regularly
   - Set spending limits in Anthropic console
   - Rotate key periodically

3. **User Authentication**
   - Change default password after first login
   - Use strong passwords
   - Consider adding more users via the app

### Access Control

1. **Google Spreadsheet**
   - Only share with service account (not public)
   - Review access permissions regularly
   - Use version history to track changes

2. **File Permissions**
   - Set proper file permissions on server (644 for files, 755 for directories)
   - Protect `.env` files (though not used in client-side builds)

---

## 🎉 Deployment Complete!

Your Messaging Matrix application should now be live at:

**🌐 https://messagingmatrix.ai**

### Quick Start for Users

1. Navigate to https://messagingmatrix.ai
2. Log in with credentials
3. Click "Load" to fetch data from spreadsheet
4. Start managing your messaging matrix
5. Click "Save" to persist changes back to spreadsheet

### Support Information

**Application:** Messaging Matrix
**Version:** 1.0.0
**Deployed:** [Current Date]
**Domain:** https://messagingmatrix.ai
**Spreadsheet:** [Your Spreadsheet ID]

---

## Troubleshooting Resources

- **Google Sheets API Docs**: https://developers.google.com/sheets/api
- **Claude API Docs**: https://docs.anthropic.com/
- **Vite Deployment Guide**: https://vitejs.dev/guide/static-deploy
- **React Router**: https://reactrouter.com/

## Need Help?

If you encounter issues not covered in this guide:

1. Check browser console for error messages
2. Review Google Cloud Console logs
3. Verify all steps were followed correctly
4. Check that all files uploaded successfully
5. Test with a fresh browser (incognito mode)

---

**🚀 Happy messaging campaign management!**
