import React, { useState } from 'react';
import { Menu, X, Table, Image, BarChart3, Users as UsersIcon, Settings as SettingsIcon, FileCode, LogOut, User } from 'lucide-react';
import Matrix from './components/Matrix';
import AssetsLibrary from './components/AssetsLibrary';
import Monitoring from './components/Monitoring';
import Users from './components/Users';
import Settings from './components/Settings';
import Login from './components/Login';
import { useAuth } from './contexts/AuthContext';
import './App.css';

const App = () => {
  const { currentUser, loading, logout } = useAuth();
  const [currentModule, setCurrentModule] = useState('matrix');
  const [menuOpen, setMenuOpen] = useState(false);

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

  // Show login if not authenticated
  if (!currentUser) {
    return <Login />;
  }

  const modules = [
    { id: 'matrix', name: 'Messaging Matrix', icon: Table, component: Matrix, color: 'blue' },
    { id: 'assets', name: 'Assets Library', icon: Image, component: AssetsLibrary, color: 'blue' },
    { id: 'monitoring', name: 'Monitoring', icon: BarChart3, component: Monitoring, color: 'green' },
    { id: 'templates', name: 'Templates', icon: FileCode, component: AssetsLibrary, color: 'orange' },
    { id: 'users', name: 'Users', icon: UsersIcon, component: Users, color: 'purple' },
    { id: 'settings', name: 'Settings', icon: SettingsIcon, component: Settings, color: 'gray' }
  ];

  const CurrentModuleComponent = modules.find(m => m.id === currentModule)?.component || Matrix;

  const handleModuleChange = (moduleId) => {
    setCurrentModule(moduleId);
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
        {/* Module Content */}
        <div className="flex-1 overflow-auto">
          <CurrentModuleComponent
            onMenuToggle={() => setMenuOpen(!menuOpen)}
            currentModuleName={modules.find(m => m.id === currentModule)?.name}
          />
        </div>
      </div>
    </div>
  );
};

export default App;
