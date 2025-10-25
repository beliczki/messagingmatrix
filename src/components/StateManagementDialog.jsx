import React, { useMemo, useState } from 'react';
import { X, RefreshCw, Save, Loader, ExternalLink, Download } from 'lucide-react';
import settings from '../services/settings';
import { generatePMMID, generateTraffickingFields } from '../utils/patternEvaluator';

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

const StateManagementDialog = ({
  showStateDialog,
  setShowStateDialog,
  audiences,
  topics,
  messages,
  keywords,
  assets,
  creatives,
  textFormatting = [],
  lastSync,
  isSaving,
  saveProgress,
  handleSaveWithProgress,
  feedData,
  downloadFeedCSV
}) => {
  const [activeTab, setActiveTab] = useState('audiences');
  // Format last sync time
  const formatSync = (time) => {
    if (!time) return 'Never';
    const mins = Math.floor((Date.now() - time) / 60000);
    if (mins < 1) return 'Just now';
    if (mins === 1) return '1 min ago';
    if (mins < 60) return `${mins} mins ago`;
    return time.toLocaleTimeString();
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

  if (!showStateDialog) return null;

  // Count keywords entries
  const keywordsCount = Object.keys(keywords || {}).reduce((count, form) => {
    return count + Object.keys(keywords[form] || {}).length;
  }, 0);

  const tabs = [
    { id: 'audiences', label: 'Audiences', count: audiences.length },
    { id: 'topics', label: 'Topics', count: topics.length },
    { id: 'messages', label: 'Messages', count: completeMessages.length },
    { id: 'assets', label: 'Assets', count: assets?.length || 0 },
    { id: 'creatives', label: 'Creatives', count: creatives?.length || 0 },
    { id: 'feed', label: 'Feed', count: feedData?.length || 0 },
    { id: 'keywords', label: 'Keywords', count: keywordsCount },
    { id: 'textFormatting', label: 'Text Formatting', count: textFormatting?.length || 0 }
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h2 className="text-xl font-semibold">Application State</h2>
            <p className="text-sm text-gray-500 mt-1">Last sync: {formatSync(lastSync)}</p>
          </div>
          <button
            onClick={() => setShowStateDialog(false)}
            className="p-1 hover:bg-gray-100 rounded"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b bg-gray-50 px-6">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 font-medium text-sm border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-auto p-6">
          {activeTab === 'audiences' && (
            <pre className="bg-gray-50 p-4 rounded border border-gray-200 overflow-x-auto text-xs font-mono">
              {JSON.stringify(audiences, null, 2)}
            </pre>
          )}

          {activeTab === 'topics' && (
            <pre className="bg-gray-50 p-4 rounded border border-gray-200 overflow-x-auto text-xs font-mono">
              {JSON.stringify(topics, null, 2)}
            </pre>
          )}

          {activeTab === 'messages' && (
            <pre className="bg-gray-50 p-4 rounded border border-gray-200 overflow-x-auto text-xs font-mono">
              {JSON.stringify(completeMessages, null, 2)}
            </pre>
          )}

          {activeTab === 'assets' && (
            <pre className="bg-gray-50 p-4 rounded border border-gray-200 overflow-x-auto text-xs font-mono">
              {JSON.stringify(assets || [], null, 2)}
            </pre>
          )}

          {activeTab === 'creatives' && (
            <pre className="bg-gray-50 p-4 rounded border border-gray-200 overflow-x-auto text-xs font-mono">
              {JSON.stringify(creatives || [], null, 2)}
            </pre>
          )}

          {activeTab === 'feed' && (
            <pre className="bg-gray-50 p-4 rounded border border-gray-200 overflow-x-auto text-xs font-mono">
              {JSON.stringify(feedData || [], null, 2)}
            </pre>
          )}

          {activeTab === 'keywords' && (
            <pre className="bg-gray-50 p-4 rounded border border-gray-200 overflow-x-auto text-xs font-mono">
              {JSON.stringify(keywords, null, 2)}
            </pre>
          )}

          {activeTab === 'textFormatting' && (
            <pre className="bg-gray-50 p-4 rounded border border-gray-200 overflow-x-auto text-xs font-mono">
              {JSON.stringify(textFormatting || [], null, 2)}
            </pre>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t bg-gray-50">
          <div className="flex gap-2">
            {(() => {
              const spreadsheetId = settings.getSpreadsheetId();
              return spreadsheetId ? (
                <a
                  href={`https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 border border-green-600 text-green-600 rounded hover:bg-green-50 transition-colors"
                >
                  <GoogleSheetsIcon size={16} />
                  <span>Open in Spreadsheets</span>
                  <ExternalLink size={14} />
                </a>
              ) : null;
            })()}
            {feedData && feedData.length > 0 && downloadFeedCSV && (
              <button
                onClick={downloadFeedCSV}
                className="flex items-center gap-2 px-4 py-2 border border-blue-600 text-blue-600 rounded hover:bg-blue-50 transition-colors"
              >
                <Download size={16} />
                <span>Download Feed CSV</span>
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowStateDialog(false)}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
            >
              Close
            </button>
            <button
              onClick={() => {
                // Preserve authentication data
                const currentUser = localStorage.getItem('current_user');
                const appUsers = localStorage.getItem('app_users');

                // Clear all localStorage
                localStorage.clear();

                // Restore authentication data
                if (currentUser) localStorage.setItem('current_user', currentUser);
                if (appUsers) localStorage.setItem('app_users', appUsers);

                // Reload the page to fetch fresh data from spreadsheet
                window.location.reload();
              }}
              className="flex items-center gap-2 px-4 py-2 bg-orange-100 text-orange-700 rounded hover:bg-orange-200"
            >
              <RefreshCw size={16} />
              Clear & Reload
            </button>
            <button
              onClick={handleSaveWithProgress}
              disabled={isSaving || saveProgress !== null}
              className="flex items-center gap-2 px-4 py-2 bg-green-100 text-green-700 rounded hover:bg-green-200 disabled:opacity-50"
            >
              {saveProgress ? (
                <>
                  <Loader size={16} className="animate-spin" />
                  {saveProgress.message}
                </>
              ) : isSaving ? (
                <>
                  <Loader size={16} className="animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save size={16} />
                  Save
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StateManagementDialog;
