import React, { useState, useMemo, useEffect, useRef } from 'react';
import { AlertCircle, ChevronDown, ChevronUp, GripHorizontal, RefreshCw, Save, Loader, ExternalLink, Download, Sparkles } from 'lucide-react';
import settings from '../services/settings';
import { generatePMMID, generateTraffickingFields } from '../utils/patternEvaluator';
import SaveProgressDialog from './SaveProgressDialog';

// Google Sheets icon component
const GoogleSheetsIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M29.5 4H11C9.34315 4 8 5.34315 8 7V41C8 42.6569 9.34315 44 11 44H37C38.6569 44 40 42.6569 40 41V15.5L29.5 4Z" fill="#0F9D58"/>
    <path d="M29.5 4V12C29.5 13.933 31.067 15.5 33 15.5H40L29.5 4Z" fill="#87CEAC"/>
    <rect x="16" y="20" width="16" height="2" fill="white"/>
    <rect x="16" y="26" width="16" height="2" fill="white"/>
    <rect x="16" y="32" width="16" height="2" fill="white"/>
    <rect x="19" y="18" width="2" height="18" fill="white"/>
    <rect x="27" y="18" width="2" height="18" fill="white"/>
  </svg>
);

const MatrixStatePanel = ({
  audiences,
  topics,
  messages,
  keywords,
  assets,
  creatives,
  textFormatting,
  feedData,
  lastSync,
  isSaving,
  saveProgress,
  onSave,
  onClearReload,
  onRegenerateTopicKeys,
  downloadFeedCSV
}) => {
  const [isCollapsed, setIsCollapsed] = useState(true); // Start collapsed
  const [activeTab, setActiveTab] = useState('audiences');
  const [height, setHeight] = useState(() => {
    const saved = localStorage.getItem('matrix_state_panel_height');
    return saved ? parseInt(saved) : window.innerHeight * 0.6; // Default 60% of viewport height
  });
  const [isResizing, setIsResizing] = useState(false);
  const resizeStartY = useRef(0);
  const resizeStartHeight = useRef(0);

  // Save height to localStorage when it changes
  useEffect(() => {
    if (!isResizing) {
      localStorage.setItem('matrix_state_panel_height', height.toString());
    }
  }, [height, isResizing]);

  // Resize handlers
  const handleResizeStart = (e) => {
    setIsResizing(true);
    resizeStartY.current = e.clientY;
    resizeStartHeight.current = height;
    e.preventDefault();
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isResizing) return;
      const deltaY = resizeStartY.current - e.clientY;
      const newHeight = Math.max(200, Math.min(window.innerHeight * 0.9, resizeStartHeight.current + deltaY));
      setHeight(newHeight);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isResizing]);

  // Format last sync time
  const formatSync = (time) => {
    if (!time) return 'Never';
    const mins = Math.floor((Date.now() - time) / 60000);
    if (mins < 1) return 'Just now';
    if (mins === 1) return '1 min ago';
    if (mins < 60) return `${mins} mins ago`;
    return new Date(time).toLocaleTimeString();
  };

  // Compute complete message data with auto-filled fields
  const completeMessages = useMemo(() => {
    return messages
      .filter(m => m.status !== 'deleted')
      .map(msg => {
        try {
          // Get patterns from settings
          const pmmidPattern = settings.getPattern('pmmid');
          const traffickingPatterns = settings.getPattern('trafficking');

          // Generate PMMID
          const pmmid = generatePMMID(msg, audiences, pmmidPattern);

          // Generate trafficking fields
          const trafficking = generateTraffickingFields(
            { ...msg, pmmid },
            audiences,
            traffickingPatterns
          );

          // Return message with all computed fields
          return {
            ...msg,
            pmmid,
            ...trafficking
          };
        } catch (error) {
          console.error('Error generating fields for message:', msg.id, error);
          return msg; // Return original if there's an error
        }
      });
  }, [messages, audiences]);

  // Count keywords entries
  const keywordsCount = Object.keys(keywords || {}).reduce((count, form) => {
    return count + Object.keys((keywords || {})[form] || {}).length;
  }, 0);

  const tabs = [
    { id: 'audiences', label: 'Audiences', count: audiences?.length || 0 },
    { id: 'topics', label: 'Topics', count: topics?.length || 0 },
    { id: 'messages', label: 'Messages', count: completeMessages.length },
    { id: 'assets', label: 'Assets', count: assets?.length || 0 },
    { id: 'creatives', label: 'Creatives', count: creatives?.length || 0 },
    { id: 'feed', label: 'Feed', count: feedData?.length || 0 },
    { id: 'keywords', label: 'Keywords', count: keywordsCount },
    { id: 'textFormatting', label: 'Text Formatting', count: textFormatting?.length || 0 }
  ];

  // Get data for active tab
  const getActiveTabData = () => {
    switch (activeTab) {
      case 'audiences': return audiences || [];
      case 'topics': return topics || [];
      case 'messages': return completeMessages;
      case 'assets': return assets || [];
      case 'creatives': return creatives || [];
      case 'feed': return feedData || [];
      case 'keywords': return keywords || {};
      case 'textFormatting': return textFormatting || [];
      default: return [];
    }
  };

  if (isCollapsed) {
    return (
      <div className="fixed bottom-0 right-[250px] bg-white shadow-lg rounded-tl-lg z-40 flex items-center gap-2 px-2 py-2">
        <button
          onClick={() => setIsCollapsed(false)}
          className="px-4 py-2 flex items-center gap-2 hover:bg-gray-50 rounded"
        >
          <AlertCircle size={20} className="text-orange-600" />
          <span className="text-sm font-medium text-gray-800">Matrix State</span>
          <ChevronUp size={16} className="text-gray-600" />
        </button>

        <button
          onClick={onClearReload}
          className="flex items-center gap-2 px-3 py-2 text-xs bg-orange-100 text-orange-700 rounded hover:bg-orange-200"
        >
          <RefreshCw size={14} />
          Clear & Reload
        </button>

        {onRegenerateTopicKeys && (
          <button
            onClick={onRegenerateTopicKeys}
            className="flex items-center gap-2 px-3 py-2 text-xs bg-purple-100 text-purple-700 rounded hover:bg-purple-200"
            title="Regenerate all topic keys based on the current pattern in Settings"
          >
            <Sparkles size={14} />
            Regen Keys
          </button>
        )}

        <button
          onClick={onSave}
          disabled={isSaving || saveProgress !== null}
          className="flex items-center gap-2 px-3 py-2 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200 disabled:opacity-50"
        >
          {saveProgress ? (
            <>
              <Loader size={14} className="animate-spin" />
              {saveProgress.message}
            </>
          ) : isSaving ? (
            <>
              <Loader size={14} className="animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save size={14} />
              Save
            </>
          )}
        </button>
      </div>
    );
  }

  return (
    <div
      className="fixed bottom-0 right-0 bg-white shadow-2xl flex flex-col z-40 rounded-tl-lg"
      style={{ height: `${height}px`, width: '90%' }}
    >
      {/* Resize Handle */}
      <div
        className={`w-full h-2 flex items-center justify-center cursor-ns-resize hover:bg-gray-200 transition-colors ${
          isResizing ? 'bg-gray-300' : 'bg-gray-100'
        }`}
        onMouseDown={handleResizeStart}
        title="Drag to resize"
      >
        <GripHorizontal size={16} className="text-gray-400" />
      </div>

      {/* Header with Tabs */}
      <div className="border-b bg-gray-50">
        <div className="px-4 pt-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center gap-2">
                <AlertCircle size={20} className="text-orange-600" />
                <span className="font-semibold text-gray-800">Matrix State</span>
              </div>
              <span className="text-xs text-gray-500 ml-7">
                Last sync: {formatSync(lastSync)}
              </span>
            </div>

            {/* Tabs inline with header */}
            <div className="flex -mb-[1px] mt-[30px]">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-3 text-sm transition-colors whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'bg-white border-b-2 border-orange-500 text-orange-600'
                      : 'text-gray-600 hover:text-gray-800'
                  }`}
                >
                  {tab.label} ({tab.count})
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsCollapsed(true)}
              className="p-1 hover:bg-gray-100 rounded"
              title="Collapse"
            >
              <ChevronDown size={20} className="text-gray-600" />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        <pre className="bg-gray-50 p-3 rounded border border-gray-200 overflow-x-auto text-xs font-mono">
          {JSON.stringify(getActiveTabData(), null, 2)}
        </pre>
      </div>

      {/* Footer with Actions */}
      <div className="flex items-center justify-between px-4 py-3 pr-64 border-t bg-gray-50">
        <div className="flex gap-2">
          {(() => {
            const spreadsheetId = settings.getSpreadsheetId();
            return spreadsheetId ? (
              <a
                href={`https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-3 py-1.5 text-xs border border-green-600 text-green-600 rounded hover:bg-green-50 transition-colors"
              >
                <GoogleSheetsIcon size={14} />
                <span>Open in Spreadsheets</span>
                <ExternalLink size={12} />
              </a>
            ) : null;
          })()}
          {feedData && feedData.length > 0 && downloadFeedCSV && (
            <button
              onClick={downloadFeedCSV}
              className="flex items-center gap-2 px-3 py-1.5 text-xs border border-blue-600 text-blue-600 rounded hover:bg-blue-50 transition-colors"
            >
              <Download size={14} />
              <span>Download Feed CSV</span>
            </button>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setIsCollapsed(true)}
            className="flex items-center gap-2 px-3 py-1.5 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
          >
            Close
          </button>
          <button
            onClick={onClearReload}
            className="flex items-center gap-2 px-3 py-1.5 text-xs bg-orange-100 text-orange-700 rounded hover:bg-orange-200"
          >
            <RefreshCw size={14} />
            Clear & Reload
          </button>
          <button
            onClick={onSave}
            disabled={isSaving || saveProgress !== null}
            className="flex items-center gap-2 px-3 py-1.5 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200 disabled:opacity-50"
          >
            {saveProgress ? (
              <>
                <Loader size={14} className="animate-spin" />
                {saveProgress.message}
              </>
            ) : isSaving ? (
              <>
                <Loader size={14} className="animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save size={14} />
                Save
              </>
            )}
          </button>
        </div>
      </div>

      {/* Save Progress Modal */}
      <SaveProgressDialog saveProgress={saveProgress} />
    </div>
  );
};

export default MatrixStatePanel;
