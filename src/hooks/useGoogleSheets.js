import { useState, useCallback, useEffect } from 'react';
import googleSheetsService from '../services/googleSheetsService';

export const useGoogleSheets = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [spreadsheetInfo, setSpreadsheetInfo] = useState(null);

  // Initialize connection to Google Sheets
  const initialize = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      await googleSheetsService.initialize();
      const info = await googleSheetsService.getSpreadsheetInfo();
      setSpreadsheetInfo(info);
      setIsConnected(true);
    } catch (err) {
      setError(err.message);
      setIsConnected(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Sync data from spreadsheet
  const syncData = useCallback(async () => {
    if (!isConnected) {
      setError('Not connected to Google Sheets. Please initialize first.');
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      const data = await googleSheetsService.syncFromSpreadsheet();
      setLastSyncTime(new Date());
      return data;
    } catch (err) {
      setError(`Sync failed: ${err.message}`);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [isConnected]);

  // Auto-sync every 30 seconds when connected
  useEffect(() => {
    if (!isConnected) return;

    const interval = setInterval(async () => {
      try {
        await syncData();
      } catch (err) {
        console.warn('Auto-sync failed:', err);
      }
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [isConnected, syncData]);

  // Get spreadsheet URL for manual editing
  const getSpreadsheetUrl = useCallback(() => {
    return googleSheetsService.getSpreadsheetUrl();
  }, []);

  // Get sample data structure
  const getSampleData = useCallback(() => {
    return googleSheetsService.generateSampleData();
  }, []);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    // State
    isConnected,
    isLoading,
    error,
    lastSyncTime,
    spreadsheetInfo,

    // Actions
    initialize,
    syncData,
    getSpreadsheetUrl,
    getSampleData,
    clearError
  };
};
