import React, { useState, useEffect } from 'react';
import { 
  RefreshCw, 
  CheckCircle, 
  AlertCircle, 
  ExternalLink, 
  Settings, 
  Copy,
  Download,
  Upload
} from 'lucide-react';
import { useGoogleSheets } from '../hooks/useGoogleSheets';

const GoogleSheetsSync = ({ onDataSync }) => {
  const {
    isConnected,
    isLoading,
    error,
    lastSyncTime,
    spreadsheetInfo,
    initialize,
    syncData,
    getSpreadsheetUrl,
    getSampleData,
    clearError
  } = useGoogleSheets();

  const [showSetup, setShowSetup] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [spreadsheetId, setSpreadsheetId] = useState('');

  // Check if environment variables are configured
  const isConfigured = import.meta.env.VITE_GOOGLE_SHEETS_API_KEY && 
                     import.meta.env.VITE_GOOGLE_SHEETS_SPREADSHEET_ID;

  useEffect(() => {
    if (isConfigured) {
      initialize();
    }
  }, [isConfigured, initialize]);

  const handleSync = async () => {
    const data = await syncData();
    if (data && onDataSync) {
      onDataSync(data);
    }
  };

  const handleCopySampleData = () => {
    const sampleData = getSampleData();
    const csvContent = sampleData.map(row => 
      row.map(cell => `"${cell}"`).join(',')
    ).join('\n');
    
    navigator.clipboard.writeText(csvContent);
    alert('Sample data copied to clipboard! Paste it into your Google Sheet.');
  };

  const formatLastSync = (time) => {
    if (!time) return 'Never';
    const now = new Date();
    const diffMs = now - time;
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins === 1) return '1 minute ago';
    if (diffMins < 60) return `${diffMins} minutes ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours === 1) return '1 hour ago';
    if (diffHours < 24) return `${diffHours} hours ago`;
    
    return time.toLocaleDateString();
  };

  if (!isConfigured && !showSetup) {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings className="text-blue-600" size={20} />
            <div>
              <h3 className="font-semibold text-blue-800">Google Sheets Integration</h3>
              <p className="text-sm text-blue-600">Connect to sync data with Google Sheets in real-time</p>
            </div>
          </div>
          <button
            onClick={() => setShowSetup(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            Setup
          </button>
        </div>
      </div>
    );
  }

  if (showSetup) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-6 mb-4">
        <h3 className="text-lg font-semibold mb-4">Google Sheets Setup</h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Google Sheets API Key
            </label>
            <input
              type="text"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="AIza..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Get your API key from the Google Cloud Console
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Spreadsheet ID
            </label>
            <input
              type="text"
              value={spreadsheetId}
              onChange={(e) => setSpreadsheetId(e.target.value)}
              placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Found in the Google Sheets URL: /spreadsheets/d/[SPREADSHEET_ID]/edit
            </p>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
            <h4 className="font-medium text-yellow-800 mb-2">Setup Instructions:</h4>
            <ol className="text-sm text-yellow-700 space-y-1 list-decimal list-inside">
              <li>Go to Google Cloud Console and create a project</li>
              <li>Enable the Google Sheets API</li>
              <li>Create an API key (restrict it to Google Sheets API)</li>
              <li>Create a Google Spreadsheet and make it publicly readable</li>
              <li>Copy the spreadsheet ID from the URL</li>
            </ol>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleCopySampleData}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
            >
              <Copy size={16} />
              Copy Sample Data
            </button>
            <button
              onClick={() => setShowSetup(false)}
              className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`border rounded-lg p-4 mb-4 ${
      isConnected ? 'bg-green-50 border-green-200' : 
      error ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'
    }`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {isConnected ? (
            <CheckCircle className="text-green-600" size={20} />
          ) : error ? (
            <AlertCircle className="text-red-600" size={20} />
          ) : (
            <Settings className="text-gray-600" size={20} />
          )}
          
          <div>
            <h3 className="font-semibold">
              {isConnected ? 'Google Sheets Connected' : 'Google Sheets'}
            </h3>
            <p className="text-sm text-gray-600">
              {isConnected ? (
                <>
                  {spreadsheetInfo?.properties?.title} • Last sync: {formatLastSync(lastSyncTime)}
                </>
              ) : error ? (
                error
              ) : (
                'Not connected'
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {error && (
            <button
              onClick={clearError}
              className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
            >
              Clear Error
            </button>
          )}
          
          {isConnected && (
            <>
              <button
                onClick={() => window.open(getSpreadsheetUrl(), '_blank')}
                className="flex items-center gap-1 px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
              >
                <ExternalLink size={14} />
                Edit Sheet
              </button>
              
              <button
                onClick={handleSync}
                disabled={isLoading}
                className="flex items-center gap-1 px-3 py-1 text-sm bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={isLoading ? 'animate-spin' : ''} size={14} />
                Sync Now
              </button>
            </>
          )}
          
          {!isConnected && !error && (
            <button
              onClick={initialize}
              disabled={isLoading}
              className="flex items-center gap-1 px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={isLoading ? 'animate-spin' : ''} size={14} />
              Connect
            </button>
          )}
          
          <button
            onClick={() => setShowSetup(true)}
            className="p-1 text-gray-500 hover:text-gray-700 transition-colors"
          >
            <Settings size={16} />
          </button>
        </div>
      </div>
      
      {isConnected && (
        <div className="mt-3 text-xs text-gray-500">
          Auto-sync enabled • Updates every 30 seconds
        </div>
      )}
    </div>
  );
};

export default GoogleSheetsSync;
