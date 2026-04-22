import React, { useState, useEffect, useCallback } from 'react';
import { BarChart3, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';
import AIAssistant from './AIAssistant';
import MatrixStatePanel from './MatrixStatePanel';
import { clearAndReloadApp } from '../utils/clearAndReload';
import BottomBar from './BottomBar';
import { apiGet, apiPost } from '../utils/api';

const DAYS_BACK_DEFAULT = 30;

function formatIsoDate(date) {
  return date.toISOString().slice(0, 10);
}

function defaultDateRange() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - DAYS_BACK_DEFAULT);
  return { from: formatIsoDate(from), to: formatIsoDate(to) };
}

const Monitoring = ({ onMenuToggle, currentModuleName, lookAndFeel, matrixData }) => {
  const [saveProgress, setSaveProgress] = useState(null);
  const [campaignPrefix, setCampaignPrefix] = useState('26!');
  const [dateFrom, setDateFrom] = useState(() => defaultDateRange().from);
  const [dateTo, setDateTo] = useState(() => defaultDateRange().to);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState(null);
  const [lastResult, setLastResult] = useState(null);
  const [lastSync, setLastSync] = useState(null);

  const refreshStatus = useCallback(async () => {
    try {
      const response = await apiGet('/api/adform/status');
      if (response.ok) {
        const data = await response.json();
        if (data?.lastSync) {
          setLastResult(data.lastSync);
          setLastSync(data.lastSync.syncedAt || null);
        }
      }
    } catch (err) {
      console.warn('Failed to read AdForm sync status:', err);
    }
  }, []);

  useEffect(() => { refreshStatus(); }, [refreshStatus]);

  const handleSync = async () => {
    setIsSyncing(true);
    setSyncError(null);
    try {
      const response = await apiPost('/api/adform/sync', {
        dateFrom,
        dateTo,
        campaignPrefix,
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(err.error || `HTTP ${response.status}`);
      }
      const data = await response.json();
      setLastResult({ ...data, dateFrom, dateTo, campaignPrefix });
      setLastSync(data.syncedAt);
      if (matrixData?.reloadReporting) {
        await matrixData.reloadReporting();
      }
    } catch (err) {
      console.error('AdForm sync failed:', err);
      setSyncError(err.message);
    } finally {
      setIsSyncing(false);
    }
  };

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
        await new Promise(resolve => setTimeout(resolve, 300));
        if (i === 0) {
          await matrixData.save();
        }
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
      setSaveProgress(null);
    } catch (error) {
      setSaveProgress({
        step: 0,
        total: steps.length,
        message: `Error: ${error.message}`,
        error: true
      });
      await new Promise(resolve => setTimeout(resolve, 3000));
      setSaveProgress(null);
    }
  };

  return (
    <div className="matrix-fullscreen" style={{ backgroundColor: 'var(--color-primary)' }}>
      <div className="matrix-view-container">
        <div className="p-8">
          <div className="max-w-5xl mx-auto space-y-6">
            <div className="bg-white rounded-lg shadow-sm p-8">
              <div className="flex items-center gap-3 mb-6">
                <BarChart3 size={32} className="text-green-600" />
                <h2 className="text-xl font-bold text-gray-800">Monitoring — AdForm Sync</h2>
              </div>

              <p className="text-gray-600 mb-6">
                Pulls impression and click data from AdForm for campaigns whose name starts with the
                prefix below. Results are written to the <code className="bg-gray-100 px-1 py-0.5 rounded text-sm">Reporting</code> tab
                of your matrix spreadsheet, at both banner level and MC-label level.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <label className="block">
                  <span className="text-sm font-medium text-gray-700">Campaign prefix</span>
                  <input
                    type="text"
                    value={campaignPrefix}
                    onChange={(e) => setCampaignPrefix(e.target.value)}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-gray-700">From</span>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-gray-700">To</span>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </label>
              </div>

              <div className="flex items-center gap-4">
                <button
                  onClick={handleSync}
                  disabled={isSyncing || !campaignPrefix || !dateFrom || !dateTo}
                  className="inline-flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                >
                  <RefreshCw size={16} className={isSyncing ? 'animate-spin' : ''} />
                  {isSyncing ? 'Syncing…' : 'Sync now'}
                </button>
                {lastSync && (
                  <span className="text-sm text-gray-500">
                    Last sync: {new Date(lastSync).toLocaleString()}
                  </span>
                )}
              </div>

              {syncError && (
                <div className="mt-4 flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-800">
                  <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="font-medium">Sync failed</div>
                    <div>{syncError}</div>
                  </div>
                </div>
              )}

              {lastResult && !syncError && (
                <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-md">
                  <div className="flex items-center gap-2 mb-3">
                    <CheckCircle size={16} className="text-green-600" />
                    <span className="font-medium text-green-800">Last sync result</span>
                  </div>
                  <dl className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    <div>
                      <dt className="text-gray-500">Campaigns</dt>
                      <dd className="font-mono text-gray-900">{lastResult.campaignCount ?? '—'}</dd>
                    </div>
                    <div>
                      <dt className="text-gray-500">Banners</dt>
                      <dd className="font-mono text-gray-900">{lastResult.bannerCount ?? '—'}</dd>
                    </div>
                    <div>
                      <dt className="text-gray-500">Matched to MC</dt>
                      <dd className="font-mono text-gray-900">{lastResult.matchedCount ?? '—'}</dd>
                    </div>
                    <div>
                      <dt className="text-gray-500">Rows written</dt>
                      <dd className="font-mono text-gray-900">{lastResult.rowsWritten ?? '—'}</dd>
                    </div>
                  </dl>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <BottomBar>
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
          onClearReload={clearAndReloadApp}
          onRegenerateTopicKeys={matrixData?.regenerateTopicKeys}
          downloadFeedCSV={() => {}}
          changeTracking={matrixData?.changeTracking}
          originalState={matrixData?.originalState}
          activeTabs={[]}
          isFullyLoaded={matrixData?.isFullyLoaded}
        />
        <AIAssistant
          moduleContext={{ module: 'monitoring' }}
          matrixData={matrixData}
        />
      </BottomBar>
    </div>
  );
};

export default Monitoring;
