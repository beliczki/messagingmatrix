import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import { AuthProvider } from './contexts/AuthContext.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'

// Design system CSS - imported via JS for reliable loading in Vite
import './styles/design-tokens.css'
import './styles/components/menu.css'
import './styles/components/toolbar.css'
import './styles/components/dialog.css'
import './styles/components/matrix.css'
import './styles/components/form-elements.css'
import './styles/components/bottom-bar.css'
import './styles/components/error-boundary.css'

// Main app styles (Tailwind + app-specific)
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <ErrorBoundary>
      <AuthProvider>
        <App />
      </AuthProvider>
    </ErrorBoundary>
  </BrowserRouter>,
)
