import React, { useState } from 'react';
import { BarChart3 } from 'lucide-react';
import PageHeader from './PageHeader';
import AIAssistant from './AIAssistant';
import MatrixStatePanel from './MatrixStatePanel';

const Monitoring = ({ onMenuToggle, currentModuleName, lookAndFeel, matrixData }) => {
  const [saveProgress, setSaveProgress] = useState(null); // { step: number, message: string }

  // Save with progress tracking
  const handleSaveWithProgress = async () => {
    const steps = [
      'Preparing data for save...',
      'Saving to spreadsheet...',
      'Finalizing save operation...',
      'Save complete!'
    ];

    try {
      for (let i = 0; i < steps.length; i++) {
        setSaveProgress({ step: i + 1, total: steps.length, message: steps[i] });

        // Small delay to show each step
        await new Promise(resolve => setTimeout(resolve, 300));

        // Actually save on step 1 (after "Preparing data")
        if (i === 0) {
          await matrixData.save();
        }
      }

      // Keep success message visible for a moment
      await new Promise(resolve => setTimeout(resolve, 1000));
      setSaveProgress(null);
    } catch (error) {
      setSaveProgress({
        step: 0,
        total: steps.length,
        message: `Error: ${error.message}`,
        error: true
      });

      // Show error for 3 seconds
      await new Promise(resolve => setTimeout(resolve, 3000));
      setSaveProgress(null);
    }
  };

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

      {/* AI Assistant */}
      <AIAssistant
        moduleContext={{ module: 'monitoring' }}
        matrixData={matrixData}
      />

      {/* Matrix State Panel */}
      <MatrixStatePanel
        audiences={matrixData?.audiences || []}
        topics={matrixData?.topics || []}
        messages={matrixData?.messages || []}
        keywords={matrixData?.keywords || {}}
        assets={matrixData?.assets || []}
        creatives={matrixData?.creatives || []}
        textFormatting={matrixData?.textFormatting || []}
        feedData={[]}
        lastSync={matrixData?.lastSync}
        isSaving={matrixData?.isSaving}
        saveProgress={saveProgress}
        onSave={handleSaveWithProgress}
        onClearReload={() => window.location.reload()}
        onRegenerateTopicKeys={matrixData?.regenerateTopicKeys}
        downloadFeedCSV={() => {}}
      />
    </div>
  );
};

export default Monitoring;
