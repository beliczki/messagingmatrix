# Claude Artifact React Skeleton

A ready-to-use React development environment specifically designed for quickly implementing Claude artifacts. This skeleton provides a modern React setup with Vite, Tailwind CSS, and all the common dependencies that Claude artifacts typically use.

## 🚀 Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start development server:**
   ```bash
   npm run dev
   ```

3. **Open your browser** and navigate to `http://localhost:3000`

4. **Replace the placeholder** with your Claude artifact code (see instructions below)

## 📋 How to Use with Claude Artifacts

### Step 1: Get Your Claude Artifact
When Claude provides you with a React component artifact, copy the entire component code.

### Step 2: Replace the Placeholder
1. Open `src/components/ArtifactContainer.jsx`
2. Replace the entire `PlaceholderArtifact` component with your Claude artifact component
3. Update the export at the bottom to use your new component name

### Step 3: Install Additional Dependencies (if needed)
Some Claude artifacts might use additional libraries. Install them using:
```bash
npm install [package-name]
```

Common packages that might be needed:
- `date-fns` - Date manipulation
- `recharts` - Charts and graphs  
- `framer-motion` - Animations
- `react-hook-form` - Form handling
- `axios` - HTTP requests

### Example Replacement

**Before (in ArtifactContainer.jsx):**
```jsx
const PlaceholderArtifact = () => {
  // placeholder code...
}

export default PlaceholderArtifact
```

**After (replace with your Claude artifact):**
```jsx
const MyClaudeArtifact = () => {
  // Your Claude artifact code goes here
  return (
    <div>
      {/* Your artifact JSX */}
    </div>
  )
}

export default MyClaudeArtifact
```

## 🛠 What's Included

- **React 18** - Latest React with hooks and concurrent features
- **Vite** - Fast build tool with hot module replacement
- **Tailwind CSS** - Utility-first CSS framework (pre-configured)
- **Lucide React** - Beautiful icon library commonly used in Claude artifacts
- **ESLint** - Code linting for better code quality

## 📁 Project Structure

```
claude-artifact-react-skeleton/
├── public/
├── src/
│   ├── components/
│   │   └── ArtifactContainer.jsx  # 👈 Replace this with your artifact
│   ├── App.jsx
│   ├── App.css
│   ├── index.css
│   └── main.jsx
├── index.html
├── package.json
├── vite.config.js
├── tailwind.config.js
└── README.md
```

## 🎨 Styling

This skeleton comes with Tailwind CSS pre-configured. Most Claude artifacts use Tailwind for styling, so you should be able to copy and paste them directly without any style issues.

If your artifact uses custom CSS, you can:
- Add styles to `src/App.css` for component-specific styles
- Add global styles to `src/index.css`
- Create new CSS files and import them in your components

## 🔧 Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build locally
- `npm run lint` - Run ESLint

## 🐛 Troubleshooting

### Common Issues:

1. **Missing Dependencies**: If you get import errors, install the missing packages:
   ```bash
   npm install [missing-package-name]
   ```

2. **Tailwind Classes Not Working**: Make sure your artifact is using standard Tailwind classes. The configuration should work out of the box.

3. **Icons Not Showing**: This skeleton includes Lucide React. If your artifact uses different icons, install the appropriate icon library.

4. **TypeScript Errors**: This skeleton uses JavaScript. If your artifact is in TypeScript, you can either:
   - Convert it to JavaScript (remove type annotations)
   - Or convert this project to TypeScript by renaming files to `.tsx` and installing TypeScript

### Getting Help:

1. Check the browser console for error messages
2. Make sure all imports in your artifact are available as installed packages
3. Verify that your component is properly exported and imported

## 💡 Tips for Success

1. **Start Simple**: Test with a basic "Hello World" replacement first to make sure everything works
2. **Check Dependencies**: Look at the imports in your Claude artifact and install any missing packages
3. **Use Hot Reload**: The development server will automatically refresh when you make changes
4. **Responsive Design**: Most Claude artifacts are responsive - test on different screen sizes

## 🌟 Features

- ⚡ **Fast Development** - Vite provides instant hot module replacement
- 🎨 **Beautiful UI** - Tailwind CSS for rapid styling
- 📱 **Responsive** - Mobile-first design approach
- 🔍 **Developer Experience** - ESLint for code quality
- 🚀 **Production Ready** - Optimized build process

---

Happy coding! 🎉

This skeleton is designed to get your Claude artifacts running as quickly as possible. Simply paste your component code and watch it come to life!
