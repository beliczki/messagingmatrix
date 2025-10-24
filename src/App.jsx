import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Routes, Route, useParams } from 'react-router-dom';
import { Menu, X, Table, Image, BarChart3, Users as UsersIcon, Settings as SettingsIcon, FileCode, LogOut, User, CheckSquare, Package, AlertCircle } from 'lucide-react';
import Matrix from './components/Matrix';
import CreativeLibrary from './components/CreativeLibrary';
import Assets from './components/Assets';
import Monitoring from './components/Monitoring';
import Templates from './components/Templates';
import Tasks from './components/Tasks';
import Users from './components/Users';
import Settings from './components/Settings';
import Login from './components/Login';
import PreviewView from './components/PreviewView';
import StateManagementDialog from './components/StateManagementDialog';
import { useAuth } from './contexts/AuthContext';
import { useMatrix } from './hooks/useMatrix';
import settings from './services/settings';
import './App.css';

// Component to wrap PreviewView
const PreviewViewWrapper = () => {
  const { shareId } = useParams();
  return <PreviewView previewId={shareId} />;
};

const App = () => {
  const { currentUser, loading, logout } = useAuth();
  const [currentModule, setCurrentModule] = useState('matrix');
  const [menuOpen, setMenuOpen] = useState(false);
  const [showStateDialog, setShowStateDialog] = useState(false);
  const [matrixStateData, setMatrixStateData] = useState({
    feedData: [],
    downloadFeedCSV: null,
    handleSaveWithProgress: null,
    saveProgress: null
  });
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
  const matrixDataRaw = useMatrix();

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

  // Load look and feel settings
  useEffect(() => {
    const loadLookAndFeel = async () => {
      try {
        await settings.ensureInitialized();
        const laf = settings.getLookAndFeel();
        setLookAndFeel(laf);
      } catch (error) {
        console.error('Error loading look and feel settings:', error);
      }
    };
    loadLookAndFeel();
  }, []);

  const handleLogout = () => {
    logout();
    setMenuOpen(false);
  };

  // Show loading state while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

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

  const CurrentModuleComponent = modules.find(m => m.id === currentModule)?.component || Matrix;

  const handleModuleChange = (moduleId) => {
    setCurrentModule(moduleId);
    setMenuOpen(false);
  };

  // Show loading state while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  // Show login if not authenticated
  if (!currentUser) {
    return (
      <Routes>
        <Route path="/share/:shareId" element={<PreviewViewWrapper />} />
        <Route path="*" element={<Login />} />
      </Routes>
    );
  }

  // Authenticated app layout - inline JSX to prevent remounting
  return (
    <Routes>
      {/* Public preview route - no authentication required */}
      <Route path="/share/:shareId" element={<PreviewViewWrapper />} />

      {/* All other routes require authentication */}
      <Route path="*" element={
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

            {/* State Management Button */}
            <div className="border-t p-4">
              <button
                onClick={() => {
                  setShowStateDialog(true);
                  setMenuOpen(false);
                }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors"
              >
                <AlertCircle size={20} />
                <span>Matrix State</span>
              </button>
            </div>

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
            {/* Module Content */}
            <div className="flex-1 overflow-auto">
              <CurrentModuleComponent
                onMenuToggle={() => setMenuOpen(!menuOpen)}
                currentModuleName={modules.find(m => m.id === currentModule)?.name}
                matrixData={matrixData}
                lookAndFeel={lookAndFeel}
                matrixViewState={matrixViewState}
                setMatrixViewState={setMatrixViewState}
                onStateDataReady={currentModule === 'matrix' ? setMatrixStateData : undefined}
              />
            </div>
          </div>
        </div>

        {/* State Management Dialog - Rendered at app level */}
        <StateManagementDialog
          showStateDialog={showStateDialog}
          setShowStateDialog={setShowStateDialog}
          audiences={matrixData?.audiences || []}
          topics={matrixData?.topics || []}
          messages={matrixData?.messages || []}
          keywords={matrixData?.keywords || {}}
          assets={matrixData?.assets || []}
          lastSync={matrixData?.lastSync}
          isSaving={matrixData?.isSaving}
          saveProgress={matrixStateData.saveProgress}
          handleSaveWithProgress={matrixStateData.handleSaveWithProgress}
          feedData={matrixStateData.feedData}
          downloadFeedCSV={matrixStateData.downloadFeedCSV}
        />
      } />
    </Routes>
  );
};

export default App;
