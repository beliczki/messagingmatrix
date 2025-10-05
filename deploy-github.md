# GitHub Pages Deployment

## Step 1: Create GitHub Repository
1. Go to GitHub and create a new repository
2. Push your project to GitHub:

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/yourusername/your-repo-name.git
git push -u origin main
```

## Step 2: Configure for GitHub Pages
Add this to your `vite.config.js`:

```javascript
export default defineConfig({
  plugins: [react()],
  base: '/your-repo-name/',  // Replace with your repo name
  server: {
    port: 3000,
    open: true
  }
})
```

## Step 3: Deploy Script
Add to your `package.json`:

```json
{
  "scripts": {
    "deploy": "npm run build && npx gh-pages -d dist"
  }
}
```

## Step 4: Install gh-pages and Deploy
```bash
npm install --save-dev gh-pages
npm run deploy
```

## Step 5: Configure Custom Domain (Optional)
1. Go to your repo Settings → Pages
2. Add your custom domain
3. Create a `CNAME` file in your domain's DNS settings
