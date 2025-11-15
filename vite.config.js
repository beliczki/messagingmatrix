import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    open: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3003',
        changeOrigin: true
      }
    }
  },
  build: {
    // Optimize bundle splitting
    rollupOptions: {
      output: {
        // Manual chunk splitting for better caching
        manualChunks(id) {
          // Node modules (vendor chunks)
          if (id.includes('node_modules')) {
            // React core
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router')) {
              return 'react-vendor';
            }
            // Icons
            if (id.includes('lucide-react')) {
              return 'ui-vendor';
            }
            // CodeMirror (editor)
            if (id.includes('@codemirror') || id.includes('codemirror')) {
              return 'editor-vendor';
            }
            // Other dependencies
            return 'vendor';
          }

          // Large application components
          if (id.includes('/components/Matrix.jsx')) {
            return 'matrix';
          }
          if (id.includes('/components/MessageEditorDialog.jsx')) {
            return 'message-editor';
          }
          if (id.includes('/components/CreativeLibrary.jsx')) {
            return 'creative-library';
          }
          if (id.includes('/components/AIAssistant.jsx')) {
            return 'ai-assistant';
          }
          if (id.includes('/components/Assets.jsx')) {
            return 'assets';
          }
          if (id.includes('/components/Templates.jsx')) {
            return 'templates';
          }

          // Utilities
          if (id.includes('/utils/')) {
            return 'utils';
          }
        },

        // Use content-based hashing for long-term caching
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]'
      }
    },

    // Increase chunk size warning limit (these are large components)
    chunkSizeWarningLimit: 1000,

    // Enable source maps for production debugging
    sourcemap: true,

    // Minification options
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: false, // Keep console.log for now
        drop_debugger: true,
        pure_funcs: ['console.debug'] // Remove console.debug only
      }
    },

    // Asset optimization
    assetsInlineLimit: 4096, // Inline assets < 4KB as base64

    // CSS code splitting
    cssCodeSplit: true
  },

  // Optimize deps
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      'lucide-react'
    ],
    exclude: []
  }
});
