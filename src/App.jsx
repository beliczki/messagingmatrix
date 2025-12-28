import React, { useState, useEffect, useRef, useMemo, Suspense, lazy } from 'react';
import { Routes, Route, useParams, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { Menu, X, Table, Image, BarChart3, Users as UsersIcon, Settings as SettingsIcon, FileCode, LogOut, User, CheckSquare, Package } from 'lucide-react';
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

// Loading component
const LoadingFallback = () => (
  <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#2870ed' }}>
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
  { id: 'users', name: 'Users', icon: UsersIcon, component: Users, color: 'purple' },
  { id: 'settings', name: 'Settings', icon: SettingsIcon, component: Settings, color: 'gray' }
];

// Authenticated layout component with menu
const AuthenticatedLayout = ({ currentUser, logout, matrixData, lookAndFeel, matrixViewState, setMatrixViewState }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  // Get current module from URL path (handle nested paths like /templates/edit/html)
  const pathParts = location.pathname.slice(1).split('/');
  const currentModule = pathParts[0] || 'matrix';
  const CurrentModuleComponent = modules.find(m => m.id === currentModule)?.component || Matrix;
  const currentModuleName = modules.find(m => m.id === currentModule)?.name || 'Messaging Matrix';

  const handleModuleChange = (moduleId) => {
    navigate(`/${moduleId}`);
    setMenuOpen(false);
  };

  const handleLogout = () => {
    logout();
    setMenuOpen(false);
  };

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Slide-in Menu */}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-xl transform transition-transform duration-300 ease-in-out flex flex-col ${
          menuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Menu Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-xl font-bold text-gray-800">Menu</h2>
          <button
            onClick={() => setMenuOpen(false)}
            className="p-2 hover:bg-gray-100 rounded"
          >
            <X size={20} />
          </button>
        </div>

        {/* Menu Items */}
        <nav className="p-4 flex-1">
          {modules.map((module) => {
            const Icon = module.icon;
            const isActive = currentModule === module.id;
            return (
              <button
                key={module.id}
                onClick={() => handleModuleChange(module.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg mb-2 transition-colors ${
                  isActive
                    ? 'bg-blue-50 text-blue-700 font-semibold'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <Icon size={20} />
                <span>{module.name}</span>
              </button>
            );
          })}
        </nav>

        {/* User Info & Logout */}
        <div className="border-t p-4">
          <div className="flex items-center gap-3 px-4 py-2 mb-2 text-gray-700">
            <User size={20} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{currentUser?.email}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-red-600 hover:bg-red-50 transition-colors"
          >
            <LogOut size={20} />
            <span>Logout</span>
          </button>
        </div>
      </div>

      {/* Overlay */}
      {menuOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={() => setMenuOpen(false)}
        />
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Module Content with Suspense for lazy-loaded components */}
        <div className="flex-1 overflow-auto">
          <Suspense fallback={
            <div className="flex items-center justify-center h-full" style={{ backgroundColor: '#2870ed' }}>
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
    </div>
  );
};

const App = () => {
  const { currentUser, loading, logout } = useAuth();
  const [lookAndFeel, setLookAndFeel] = useState({
    logo: 'https://s3.eu-central-1.amazonaws.com/pomscloud-storage/assets/43/hu-HU/background/EBH_Logo_screen_white.svg',
    headerColor: '#2870ed',
    logoStyle: 'height: 25px; margin-top: -6px;',
    buttonColor: '#ff6130',
    buttonStyle: 'border: 1px solid white;',
    secondaryColor1: '#eb4c79',
    secondaryColor2: '#02a3a4',
    secondaryColor3: '#711c7a'
  });

  // Load matrix data once at app level to share across all components
  // Only load if user is authenticated to avoid API errors on login page
  const matrixDataRaw = useMatrix(currentUser);

  // Memoize matrixData to prevent it from being seen as changed on every render
  const matrixData = useMemo(() => matrixDataRaw, [matrixDataRaw]);

  const prevMatrixDataRef = useRef();
  const matrixDataRefChanged = prevMatrixDataRef.current !== matrixData;
  console.log('🟢 App.jsx render', {
    matrixDataRefChanged,
    matrixDataId: matrixData?.__id || 'no-id',
    rawChanged: prevMatrixDataRef.current !== matrixDataRaw
  });
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
    console.log('🟢 App.jsx: matrixViewState changed, saving to localStorage', matrixViewState);
    const timeoutId = setTimeout(() => {
      localStorage.setItem('matrixViewState', JSON.stringify(matrixViewState));
      console.log('🟢 App.jsx: saved to localStorage');
    }, 300); // Debounce: wait 300ms after last change before saving

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

  // Show loading state while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#2870ed' }}>
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
