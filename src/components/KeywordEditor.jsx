import React, { useState, useEffect } from 'react';
import { X, ExternalLink, RefreshCw } from 'lucide-react';
import settings from '../services/settings';
import sheets from '../services/sheets';

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

const KeywordEditor = ({ keywords, onSave, onClose }) => {
  // Initialize with a default URL immediately to avoid flashing
  const spreadsheetId = settings.getSpreadsheetId();
  const defaultUrl = spreadsheetId
    ? `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`
    : null;

  const [keywordsSheetUrl, setKeywordsSheetUrl] = useState(defaultUrl);

  // Convert keywords object to table rows (form, field, values)
  const getTableData = () => {
    const rows = [];
    Object.entries(keywords || {}).forEach(([form, fields]) => {
      Object.entries(fields || {}).forEach(([field, values]) => {
        rows.push({
          form,
          field,
          values: Array.isArray(values) ? values.join(', ') : values
        });
      });
    });
    return rows;
  };

  const tableData = getTableData();

  // Fetch sheet metadata to get the Keywords sheet GID
  useEffect(() => {
    const fetchSheetGid = async () => {
      if (!spreadsheetId) return;

      try {
        const token = await sheets.getAccessToken();
        const response = await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets(properties(sheetId,title))`,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            }
          }
        );

        if (response.ok) {
          const data = await response.json();
          const keywordsSheet = data.sheets?.find(
            sheet => sheet.properties.title.toLowerCase() === 'keywords'
          );

          if (keywordsSheet) {
            const gid = keywordsSheet.properties.sheetId;
            setKeywordsSheetUrl(`https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit#gid=${gid}`);
          }
          // Don't update if not found - keep the default URL
        }
      } catch (error) {
        console.error('Error fetching sheet metadata:', error);
        // Keep the default URL on error
      }
    };

    fetchSheetGid();
  }, [spreadsheetId]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-xl font-bold text-gray-800">Keywords Data</h2>
            {keywordsSheetUrl ? (
              <a
                href={keywordsSheetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-gray-700 hover:text-gray-900 mt-1"
              >
                <GoogleSheetsIcon size={18} />
                <span>Open Keywords sheet</span>
              </a>
            ) : (
              <p className="text-sm text-gray-600 mt-1">
                {tableData.length} keyword entries
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto p-6">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-300 px-4 py-2 text-left font-semibold w-1/6">Form</th>
                <th className="border border-gray-300 px-4 py-2 text-left font-semibold w-1/4">Field</th>
                <th className="border border-gray-300 px-4 py-2 text-left font-semibold">Values</th>
              </tr>
            </thead>
            <tbody>
              {tableData.length === 0 ? (
                <tr>
                  <td colSpan="3" className="border border-gray-300 px-4 py-8 text-center text-gray-500">
                    No keywords found in spreadsheet
                  </td>
                </tr>
              ) : (
                tableData.map((row, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="border border-gray-300 px-4 py-2 font-medium">{row.form}</td>
                    <td className="border border-gray-300 px-4 py-2 font-medium">{row.field}</td>
                    <td className="border border-gray-300 px-4 py-2">{row.values}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 p-6 border-t bg-gray-50">
          <div>
            {keywordsSheetUrl && (
              <a
                href={keywordsSheetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 border border-green-600 text-green-600 rounded-lg hover:bg-green-50 transition-colors"
              >
                <GoogleSheetsIcon size={16} />
                <span>Open in Spreadsheets</span>
                <ExternalLink size={14} />
              </a>
            )}
          </div>
          <div className="flex items-center gap-2">
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
              className="flex items-center gap-2 px-4 py-2 bg-orange-100 text-orange-700 rounded-lg hover:bg-orange-200 transition-colors"
            >
              <RefreshCw size={16} />
              Reload
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default KeywordEditor;
