import React, { useState, useEffect, useRef, useMemo, Suspense, lazy } from 'react';
import { Routes, Route, useParams, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { Menu, X, Table, Image, BarChart3, Users as UsersIcon, Settings as SettingsIcon, FileCode, LogOut, User, CheckSquare, Package, Maximize, Minimize } from 'lucide-react';
import { useAuth } from './contexts/AuthContext';
import { useMatrix } from './hooks/useMatrix';
import './App.css';

// Lazy load heavy components for better code splitting
const Matrix = lazy(() => import('./components/Matrix'));
const CreativeLibrary = lazy(() => import('./components/CreativeLibrary'));
const Assets = lazy(() => import('./components/Assets'));
const Monitoring = lazy(() => import('./components/Monitoring'));
const Templates = lazy(() => import('./components/Templates'));
const Tasks = lazy(() => import('./components/Tasks'));
const Users = lazy(() => import('./components/Users'));
const Settings = lazy(() => import('./components/Settings'));
const Login = lazy(() => import('./components/Login'));
const PreviewView = lazy(() => import('./components/PreviewView'));

// Loading component - uses CSS variable for main color
const LoadingFallback = () => (
  <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--color-primary)' }}>
    <div className="text-white text-lg">Loading...</div>
  </div>
);

// Component to wrap PreviewView
const PreviewViewWrapper = () => {
  const { shareId } = useParams();
  return <PreviewView previewId={shareId} />;
};

// Module definitions - shared between components
const modules = [
  { id: 'matrix', name: 'Messaging Matrix', icon: Table, component: Matrix, color: 'blue' },
  { id: 'creative-library', name: 'Creative Library', icon: Image, component: CreativeLibrary, color: 'blue' },
  { id: 'assets', name: 'Assets', icon: Package, component: Assets, color: 'purple' },
  { id: 'monitoring', name: 'Monitoring', icon: BarChart3, component: Monitoring, color: 'green' },
  { id: 'templates', name: 'Templates', icon: FileCode, component: Templates, color: 'orange' },
  { id: 'tasks', name: 'Tasks', icon: CheckSquare, component: Tasks, color: 'indigo' },
  { id: 'users', name: 'Users', icon: UsersIcon, component: Users, color: 'purple', adminOnly: true },
  { id: 'settings', name: 'Settings', icon: SettingsIcon, component: Settings, color: 'gray', adminOnly: true }
];

// Authenticated layout component with menu
const AuthenticatedLayout = ({ currentUser, logout, matrixData, lookAndFeel, matrixViewState, setMatrixViewState }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const menuContentRef = useRef(null);
  const selectorRef = useRef(null);

  // Filter modules based on user role - only show adminOnly modules to admins
  const isAdmin = currentUser?.role === 'admin';
  const visibleModules = modules.filter(m => !m.adminOnly || isAdmin);

  // Get current module from URL path (handle nested paths like /templates/edit/html)
  const pathParts = location.pathname.slice(1).split('/');
  const currentModule = pathParts[0] || 'matrix';
  const currentModuleConfig = modules.find(m => m.id === currentModule);

  // Check if user has access to current module
  const hasAccess = !currentModuleConfig?.adminOnly || isAdmin;
  const CurrentModuleComponent = hasAccess ? (currentModuleConfig?.component || Matrix) : Matrix;
  const currentModuleName = hasAccess ? (currentModuleConfig?.name || 'Messaging Matrix') : 'Messaging Matrix';

  // Redirect non-admins away from admin-only routes
  useEffect(() => {
    if (currentModuleConfig?.adminOnly && !isAdmin) {
      navigate('/matrix', { replace: true });
    }
  }, [currentModule, isAdmin, navigate, currentModuleConfig]);

  // Fullscreen toggle
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  // Sync state with browser fullscreen changes (e.g. user presses Esc)
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  // Update active index when module changes (using filtered modules)
  useEffect(() => {
    const index = visibleModules.findIndex(m => m.id === currentModule);
    if (index >= 0) setActiveIndex(index);
  }, [currentModule, visibleModules]);

  // Position selector on active item
  useEffect(() => {
    if (menuOpen && menuContentRef.current && selectorRef.current) {
      // Hide selector initially
      selectorRef.current.classList.remove('visible');
      // Wait for scale animation to complete (500ms bounce)
      setTimeout(() => {
        const allItems = menuContentRef.current.querySelectorAll('.nav-item');
        if (allItems[activeIndex]) {
          const item = allItems[activeIndex];
          const menuRect = menuContentRef.current.getBoundingClientRect();
          const itemRect = item.getBoundingClientRect();
          selectorRef.current.style.transform = `translateY(${itemRect.top - menuRect.top}px)`;
          // Show selector after position is set
          selectorRef.current.classList.add('visible');
        }
      }, 500);
    } else if (selectorRef.current) {
      selectorRef.current.classList.remove('visible');
    }
  }, [menuOpen, activeIndex]);

  const handleModuleChange = (moduleId, index) => {
    setActiveIndex(index);
    setTimeout(() => {
      navigate(`/${moduleId}`);
      setMenuOpen(false);
    }, 150);
  };

  const handleLogout = () => {
    logout();
    setMenuOpen(false);
  };

  // Get user initials for avatar
  const userInitials = currentUser?.email?.substring(0, 2).toUpperCase() || 'U';
  // Get username (part before @)
  const userName = currentUser?.email?.split('@')[0] || 'User';

  // Token expiry countdown
  const [tokenExpiry, setTokenExpiry] = useState('');
  useEffect(() => {
    const updateExpiry = () => {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        setTokenExpiry('');
        return;
      }
      try {
        const [, payload] = token.split('.');
        const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
        const exp = decoded.exp * 1000;
        const now = Date.now();
        const remaining = exp - now;

        if (remaining <= 0) {
          setTokenExpiry('expired');
          return;
        }

        const days = Math.floor(remaining / (24 * 60 * 60 * 1000));
        const hours = Math.floor((remaining % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));

        if (days > 0) {
          setTokenExpiry(`${days}d ${hours}h`);
        } else {
          const mins = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
          setTokenExpiry(`${hours}h ${mins}m`);
        }
      } catch {
        setTokenExpiry('');
      }
    };

    updateExpiry();
    const interval = setInterval(updateExpiry, 60000); // Update every minute
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="h-screen overflow-hidden" style={{ backgroundColor: 'var(--color-primary)' }}>
      {/* Hamburger Button */}
      <button
        className={`hamburger-btn ${menuOpen ? 'menu-open' : ''}`}
        onClick={() => setMenuOpen(!menuOpen)}
      >
        <Menu size={24} />
      </button>

      {/* Fullscreen Toggle Button */}
      <button
        className="fullscreen-btn"
        onClick={toggleFullscreen}
        title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
      >
        {isFullscreen ? <Minimize size={14} /> : <Maximize size={14} />}
      </button>

      {/* Menu Panel */}
      <div className={`menu-panel ${menuOpen ? 'open' : ''}`}>
        <div
          className="menu-content"
          ref={menuContentRef}
          onMouseLeave={() => {
            // Return to active only when leaving the entire menu
            if (selectorRef.current && menuContentRef.current) {
              const allItems = menuContentRef.current.querySelectorAll('.nav-item');
              if (allItems[activeIndex]) {
                const menuRect = menuContentRef.current.getBoundingClientRect();
                const itemRect = allItems[activeIndex].getBoundingClientRect();
                const newY = itemRect.top - menuRect.top;
                console.log(`[menu-selector] LEAVE menu → active ${activeIndex}: translateY(${newY}px)`);
                selectorRef.current.style.transform = `translateY(${newY}px)`;
              }
            }
          }}
        >
          {/* Logo Container */}
          <div className="menu-logo-container">
            <svg className="menu-logo" viewBox="0 0 800 800" fill="white">
              <polygon points="297.22773 561.72334 213.69075 561.7234 280.36225 238.27666 363.89923 238.2766 297.22773 561.72334"/>
              <polygon points="372.33197 238.27666 288.79499 238.27661 355.46653 561.72334 439.00351 561.72339 372.33197 238.27666"/>
              <polygon points="514.8137 238.27666 431.27672 238.27661 497.94825 561.72334 581.48524 561.72339 514.8137 238.27666"/>
              <polygon points="530.95895 238.27666 447.42197 238.27661 514.0935 561.72334 597.63048 561.72339 530.95895 238.27666"/>
              <rect x="88.60344" y="87.13551" width="27.34135" height="610.59038"/>
              <rect x="124.98303" y="50.75592" width="30.27721" height="103.03638" transform="translate(242.39574 -37.84752) rotate(90)"/>
              <rect x="124.98303" y="646.20769" width="30.27721" height="103.03638" transform="translate(837.84752 557.60426) rotate(90)"/>
              <rect x="684.05521" y="87.13551" width="27.34135" height="610.59038" transform="translate(1395.45177 784.8614) rotate(-180)"/>
              <rect x="644.73977" y="50.75592" width="30.27721" height="103.03638" transform="translate(762.15248 -557.60426) rotate(90)"/>
              <rect x="644.73977" y="646.20769" width="30.27721" height="103.03638" transform="translate(1357.60426 37.84752) rotate(90)"/>
            </svg>
            {/* Cobranding Logo */}
            {lookAndFeel?.cobranding?.enabled && lookAndFeel?.cobranding?.logoUrl && (
              <>
                <span className="cobranding-separator">×</span>
                <img
                  src={lookAndFeel.cobranding.logoUrl}
                  alt="Cobranding"
                  className="cobranding-logo"
                />
              </>
            )}
          </div>

          {/* Selector highlight */}
          <div className="menu-selector" ref={selectorRef}></div>

          {/* Navigation Menu */}
          <nav className="nav-menu">
            {visibleModules.map((module, index) => {
              const Icon = module.icon;
              return (
                <button
                  key={module.id}
                  className={`nav-item ${currentModule === module.id ? 'active' : ''}`}
                  onClick={() => handleModuleChange(module.id, index)}
                  onMouseEnter={() => {
                    if (selectorRef.current && menuContentRef.current) {
                      selectorRef.current.classList.add('visible');
                      const allItems = menuContentRef.current.querySelectorAll('.nav-item');
                      if (allItems[index]) {
                        const menuRect = menuContentRef.current.getBoundingClientRect();
                        const itemRect = allItems[index].getBoundingClientRect();
                        const newY = itemRect.top - menuRect.top;
                        selectorRef.current.style.transform = `translateY(${newY}px)`;
                      }
                    }
                  }}
                >
                  <Icon size={24} />
                  <span>{module.name}</span>
                </button>
              );
            })}
          </nav>

          {/* Spacer to push profile/logout to bottom */}
          <div className="menu-spacer"></div>

          {/* Profile */}
          <button
            className="nav-item profile-item"
            onMouseEnter={() => {
              if (selectorRef.current && menuContentRef.current) {
                selectorRef.current.classList.add('visible');
                const profileItem = menuContentRef.current.querySelector('.nav-item.profile-item');
                if (profileItem) {
                  const menuRect = menuContentRef.current.getBoundingClientRect();
                  const itemRect = profileItem.getBoundingClientRect();
                  const newY = itemRect.top - menuRect.top;
                  console.log(`[menu-selector] ENTER profile: translateY(${newY}px)`);
                  selectorRef.current.style.transform = `translateY(${newY}px)`;
                }
              }
            }}
          >
            <div className="profile-avatar">{userInitials}</div>
            <span>{userName}</span>
            {tokenExpiry && <span className="token-expiry">{tokenExpiry}</span>}
          </button>

          {/* Logout */}
          <button
            className="nav-item logout"
            onClick={handleLogout}
            onMouseEnter={() => {
              if (selectorRef.current && menuContentRef.current) {
                selectorRef.current.classList.add('visible');
                const logoutItem = menuContentRef.current.querySelector('.nav-item.logout');
                if (logoutItem) {
                  const menuRect = menuContentRef.current.getBoundingClientRect();
                  const itemRect = logoutItem.getBoundingClientRect();
                  const newY = itemRect.top - menuRect.top;
                  console.log(`[menu-selector] ENTER logout: translateY(${newY}px)`);
                  selectorRef.current.style.transform = `translateY(${newY}px)`;
                }
              }
            }}
          >
            <LogOut size={24} />
            <span>Logout</span>
          </button>
        </div>
      </div>

      {/* Menu Overlay */}
      <div
        className={`menu-overlay ${menuOpen ? 'open' : ''}`}
        onClick={() => setMenuOpen(false)}
      />

      {/* Main Content */}
      <div className="h-full overflow-auto">
        <Suspense fallback={
          <div className="flex items-center justify-center h-full" style={{ backgroundColor: 'var(--color-primary)' }}>
            <div className="text-white text-lg">Loading...</div>
          </div>
        }>
          <CurrentModuleComponent
            onMenuToggle={() => setMenuOpen(!menuOpen)}
            currentModuleName={currentModuleName}
            matrixData={matrixData}
            lookAndFeel={lookAndFeel}
            matrixViewState={matrixViewState}
            setMatrixViewState={setMatrixViewState}
          />
        </Suspense>
      </div>
    </div>
  );
};

const App = () => {
  const { currentUser, loading, logout } = useAuth();
  // Initialize with null - colors will be set from config, no hardcoded defaults
  const [lookAndFeel, setLookAndFeel] = useState(null);

  // Load matrix data once at app level to share across all components
  // Only load if user is authenticated to avoid API errors on login page
  const matrixDataRaw = useMatrix(currentUser);

  // Memoize matrixData to prevent it from being seen as changed on every render
  const matrixData = useMemo(() => matrixDataRaw, [matrixDataRaw]);

  const prevMatrixDataRef = useRef();
  prevMatrixDataRef.current = matrixData;

  // Matrix view state - persisted at app level
  const [matrixViewState, setMatrixViewState] = useState(() => {
    // Try to load from localStorage
    const saved = localStorage.getItem('matrixViewState');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse saved matrix view state:', e);
      }
    }
    // Default state - filters will be initialized by Matrix component with all available options
    return {
      viewMode: 'matrix',
      matrixZoom: 1,
      matrixPan: { x: 0, y: 0 },
      treeZoom: 1,
      displayMode: 'informative',
      selectedStatuses: [],
      selectedProducts: [],
      audienceFilter: '',
      topicFilter: ''
    };
  });

  // Save matrix view state to localStorage whenever it changes (debounced to avoid excessive writes)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      localStorage.setItem('matrixViewState', JSON.stringify(matrixViewState));
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [matrixViewState]);

  // Load look and feel settings from basic config endpoint (no auth required)
  useEffect(() => {
    const loadLookAndFeel = async () => {
      try {
        // Use relative URL in production, localhost in development
        const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:3003' : '');
        const response = await fetch(`${API_URL}/api/config-basic`);
        if (response.ok) {
          const data = await response.json();
          setLookAndFeel(data.lookAndFeel);
        }
      } catch (error) {
        console.error('Error loading look and feel settings:', error);
      }
    };
    loadLookAndFeel();
  }, []);

  // Update CSS variables when lookAndFeel colors change
  useEffect(() => {
    if (lookAndFeel?.headerColor) {
      document.documentElement.style.setProperty('--color-primary', lookAndFeel.headerColor);
      document.documentElement.style.setProperty('--main-ui-color', lookAndFeel.headerColor);
    }
    if (lookAndFeel?.secondaryColor1) {
      document.documentElement.style.setProperty('--toolbar-color', lookAndFeel.secondaryColor1);
    }
  }, [lookAndFeel?.headerColor, lookAndFeel?.secondaryColor1]);

  // Update page title
  useEffect(() => {
    document.title = lookAndFeel?.pageTitle || 'Matrix 1.0';
  }, [lookAndFeel?.pageTitle]);

  // Update font family
  useEffect(() => {
    const fontFamily = lookAndFeel?.fontFamily || 'Inter';
    const fontMap = {
      'Inter': "'Inter', system-ui, sans-serif",
      'Poppins': "'Poppins', system-ui, sans-serif",
      'Novatica': "'BC Novatica', system-ui, sans-serif",
      'TeleNeo': "'TeleNeo', system-ui, sans-serif"
    };
    document.documentElement.style.setProperty('--font-family', fontMap[fontFamily] || fontMap['Inter']);
  }, [lookAndFeel?.fontFamily]);

  // Update border-radius for capsule design
  useEffect(() => {
    const root = document.documentElement;
    if (lookAndFeel?.capsuleDesign) {
      root.classList.add('capsule-design');
      root.style.setProperty('--radius-sm', '6px');
      root.style.setProperty('--radius-md', '9999px');
      root.style.setProperty('--radius-lg', '9999px');
      root.style.setProperty('--radius-xl', '9999px');
      root.style.setProperty('--radius-2xl', '20px');
      root.style.setProperty('--radius-3xl', '24px');
    } else {
      root.classList.remove('capsule-design');
      root.style.removeProperty('--radius-sm');
      root.style.removeProperty('--radius-md');
      root.style.removeProperty('--radius-lg');
      root.style.removeProperty('--radius-xl');
      root.style.removeProperty('--radius-2xl');
      root.style.removeProperty('--radius-3xl');
    }
  }, [lookAndFeel?.capsuleDesign]);

  // Show loading state while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--color-primary)' }}>
        <div className="text-white text-lg">Loading...</div>
      </div>
    );
  }

  // Show login if not authenticated
  if (!currentUser) {
    return (
      <Suspense fallback={<LoadingFallback />}>
        <Routes>
          <Route path="/share/:shareId" element={<PreviewViewWrapper />} />
          <Route path="/login" element={<Login />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Suspense>
    );
  }

  // Authenticated app layout with URL-based routing
  return (
    <Suspense fallback={<LoadingFallback />}>
      <Routes>
        {/* Public preview route */}
        <Route path="/share/:shareId" element={<PreviewViewWrapper />} />

        {/* Module routes - use /* for modules that support deep linking */}
        {modules.map(module => (
          <Route
            key={module.id}
            path={`/${module.id}/*`}
            element={
              <AuthenticatedLayout
                currentUser={currentUser}
                logout={logout}
                matrixData={matrixData}
                lookAndFeel={lookAndFeel}
                matrixViewState={matrixViewState}
                setMatrixViewState={setMatrixViewState}
              />
            }
          />
        ))}

        {/* Default redirect to matrix */}
        <Route path="/" element={<Navigate to="/matrix" replace />} />
        <Route path="/login" element={<Navigate to="/matrix" replace />} />
        <Route path="*" element={<Navigate to="/matrix" replace />} />
      </Routes>
    </Suspense>
  );
};

export default App;
