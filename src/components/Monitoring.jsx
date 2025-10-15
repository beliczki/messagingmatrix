import React from 'react';
import { BarChart3 } from 'lucide-react';
import PageHeader from './PageHeader';

const Monitoring = ({ onMenuToggle, currentModuleName, lookAndFeel }) => {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <PageHeader onMenuToggle={onMenuToggle} title={currentModuleName || 'Monitoring'} lookAndFeel={lookAndFeel} />

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
