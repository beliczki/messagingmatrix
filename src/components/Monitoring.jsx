import React from 'react';
import { BarChart3, Menu } from 'lucide-react';

const Monitoring = ({ onMenuToggle, currentModuleName }) => {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={onMenuToggle}
              className="p-2 hover:bg-gray-100 rounded transition-colors"
              title="Open Menu"
            >
              <Menu size={24} className="text-gray-700" />
            </button>
            <h1 className="text-2xl font-bold text-gray-800">{currentModuleName || 'Monitoring'}</h1>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-8">
        <div className="max-w-7xl mx-auto">
          <div className="bg-white rounded-lg shadow-sm p-8">
            <div className="flex items-center gap-3 mb-6">
              <BarChart3 size={32} className="text-green-600" />
              <h2 className="text-xl font-bold text-gray-800">Monitoring</h2>
            </div>
            <p className="text-gray-600">
              This module will provide analytics, performance metrics, and campaign monitoring.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Monitoring;
