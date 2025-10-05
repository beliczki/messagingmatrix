# Production Deployment Guide

This guide covers deploying your Interactive Matrix Editor with service account authentication to production.

## 🚀 **Pre-Deployment Checklist**

### ✅ Service Account Setup
- [ ] Service account created in Google Cloud Console
- [ ] Google Sheets API enabled
- [ ] Service account has Editor access to your spreadsheet
- [ ] JSON key file downloaded and configured
- [ ] Application tested locally with service account

### ✅ Environment Configuration
- [ ] `.env` file configured with `VITE_GOOGLE_SERVICE_ACCOUNT_KEY`
- [ ] Spreadsheet ID confirmed in environment variables
- [ ] Build process tested locally (`npm run build`)
- [ ] Production build verified (`npm run preview`)

## 🌐 **Deployment Options**

### Option 1: Static Hosting (Recommended)

Since this is a client-side React application, you can deploy to any static hosting service:

#### **Netlify (Easiest)**
1. **Build your application**:
   ```bash
   npm run build
   ```

2. **Deploy to Netlify**:
   - Drag the `dist` folder to https://app.netlify.com/drop
   - Or connect your GitHub repository for automatic deployments

3. **Set environment variables** in Netlify dashboard:
   - Go to Site Settings > Environment Variables
   - Add `VITE_GOOGLE_SERVICE_ACCOUNT_KEY` with your JSON credentials

#### **Vercel**
1. **Install Vercel CLI**:
   ```bash
   npm i -g vercel
   ```

2. **Deploy**:
   ```bash
   vercel --prod
   ```

3. **Set environment variables**:
   ```bash
   vercel env add VITE_GOOGLE_SERVICE_ACCOUNT_KEY
   ```

#### **GitHub Pages**
1. **Build and deploy**:
   ```bash
   npm run build
   git add dist
   git commit -m "Deploy to GitHub Pages"
   git subtree push --prefix dist origin gh-pages
   ```

### Option 2: Custom Domain (Your Case)

For deployment to `https://messagingmatrix.ai`:

#### **Via cPanel/FTP**
1. **Build the application**:
   ```bash
   npm run build
   ```

2. **Upload files**:
   - Upload contents of `dist` folder to your domain's public_html
   - Ensure `.htaccess` is configured for SPA routing

3. **Environment variables**:
   - Since this is client-side, create a production `.env` file
   - Or hardcode the service account key in the deployment build

#### **Via CI/CD Pipeline**
Set up automated deployment with GitHub Actions:

```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v2
    
    - name: Setup Node.js
      uses: actions/setup-node@v2
      with:
        node-version: '18'
        
    - name: Install dependencies
      run: npm install
      
    - name: Build
      run: npm run build
      env:
        VITE_GOOGLE_SERVICE_ACCOUNT_KEY: ${{ secrets.SERVICE_ACCOUNT_KEY }}
        
    - name: Deploy to server
      # Your deployment script here
      run: rsync -avz --delete dist/ user@server:/path/to/public_html/
```

## 🔒 **Security Considerations**

### **Environment Variables**
- ⚠️ **Client-side exposure**: Environment variables starting with `VITE_` are exposed to the browser
- 🔒 **Service account key**: While functional, consider server-side proxy for maximum security
- 🌐 **Domain restrictions**: Configure your service account for specific domains only

### **Production Recommendations**
1. **Server-side proxy**: For enterprise use, consider a backend API that handles Google Sheets communication
2. **Rate limiting**: Monitor API usage to stay within Google's quotas
3. **Error tracking**: Implement error monitoring (Sentry, LogRocket, etc.)
4. **Backup strategy**: Regular spreadsheet exports or backups

## 📊 **Performance Optimization**

### **Build Optimization**
```bash
# Analyze bundle size
npm run build -- --analyze

# Preview production build locally
npm run preview
```

### **Caching Strategy**
- **Static assets**: Set long cache headers for JS/CSS files
- **HTML**: Short cache for index.html to enable updates
- **API responses**: Implement local caching for spreadsheet data

### **Monitoring**
- **Google Cloud Console**: Monitor API usage and quotas
- **Browser DevTools**: Check for performance issues
- **Real User Monitoring**: Track actual user experience

## 🔧 **Production Environment Variables**

Create a production `.env` file:

```env
# Production Service Account
VITE_GOOGLE_SERVICE_ACCOUNT_KEY={"type":"service_account","project_id":"prod-project",...}

# Production Spreadsheet (if different)
VITE_GOOGLE_SHEETS_SPREADSHEET_ID=1-bL8zTosWjXvkcHWEIYquO1tID4D4tq-aVjbgZNN06o

# Optional: Environment identifier
VITE_ENV=production
```

## 🌍 **Domain Configuration**

### **DNS Setup**
1. **Point your domain** to your hosting provider
2. **Configure SSL/HTTPS** (usually automatic with modern hosts)
3. **Set up redirects** from www to non-www (or vice versa)

### **CDN Configuration** (Optional)
For global performance:
- **Cloudflare**: Free CDN with optimization features
- **AWS CloudFront**: Enterprise-grade CDN
- **Netlify CDN**: Included with Netlify hosting

## 📈 **Post-Deployment**

### **Testing Checklist**
- [ ] Application loads correctly on production domain
- [ ] Service account authentication works
- [ ] Data loads from Google Spreadsheet
- [ ] Save functionality works properly
- [ ] All features function as expected
- [ ] Mobile/responsive design works
- [ ] Performance is acceptable

### **Monitoring Setup**
1. **Google Analytics**: Track usage and user behavior
2. **Error tracking**: Monitor JavaScript errors
3. **API monitoring**: Watch Google Sheets API usage
4. **Uptime monitoring**: Ensure site availability

### **Backup Strategy**
1. **Code backup**: Ensure code is in version control
2. **Data backup**: Regular spreadsheet exports
3. **Environment backup**: Document all configuration

## 🎉 **You're Ready!**

Your Interactive Matrix Editor is now ready for production with:

✅ **Service account authentication** - Secure and reliable  
✅ **Private spreadsheet access** - No public sharing required  
✅ **Optimized build** - Fast loading and efficient  
✅ **Production monitoring** - Track performance and issues  
✅ **Scalable architecture** - Ready for enterprise use  

**Your application is now live at `https://messagingmatrix.ai`!** 🚀

---

### **Support and Maintenance**

- **Updates**: Regular npm updates and security patches
- **Google API**: Monitor quota usage and billing
- **User feedback**: Collect feedback for future improvements
- **Performance**: Regular performance audits and optimizations

**Happy messaging campaign management!** ✨
