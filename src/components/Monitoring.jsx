import React, { useState, useEffect, useCallback, useMemo } from 'react';
import AIAssistant from './AIAssistant';
import MatrixStatePanel from './MatrixStatePanel';
import MonitoringToolbar from './MonitoringToolbar';
import MonitoringListView from './MonitoringListView';
import { clearAndReloadApp } from '../utils/clearAndReload';
import BottomBar from './BottomBar';
import { apiGet, apiPost } from '../utils/api';
import settings from '../services/settings';

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

const Monitoring = ({ matrixData }) => {
  const [saveProgress, setSaveProgress] = useState(null);
  const [campaignPrefix, setCampaignPrefix] = useState('26!');
  const [dateFrom, setDateFrom] = useState(() => defaultDateRange().from);
  const [dateTo, setDateTo] = useState(() => defaultDateRange().to);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState(null);
  const [lastResult, setLastResult] = useState(null);
  const [lastSync, setLastSync] = useState(null);

  const [sortColumn, setSortColumn] = useState(() => localStorage.getItem('monitoring_sortColumn') || 'ctr');
  const [sortDirection, setSortDirection] = useState(() => localStorage.getItem('monitoring_sortDirection') || 'desc');
  const [productFilter, setProductFilter] = useState(() => {
    try {
      const saved = localStorage.getItem('monitoring_productFilter');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [showUnmatched, setShowUnmatched] = useState(() => {
    try { return JSON.parse(localStorage.getItem('monitoring_showUnmatched') || 'false'); }
    catch { return false; }
  });

  useEffect(() => { localStorage.setItem('monitoring_sortColumn', sortColumn); }, [sortColumn]);
  useEffect(() => { localStorage.setItem('monitoring_sortDirection', sortDirection); }, [sortDirection]);
  useEffect(() => { localStorage.setItem('monitoring_productFilter', JSON.stringify(productFilter)); }, [productFilter]);
  useEffect(() => { localStorage.setItem('monitoring_showUnmatched', JSON.stringify(showUnmatched)); }, [showUnmatched]);

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

  // Look up product via audience (primary) or topic (fallback) by key.
  const productByMessage = useMemo(() => {
    const audByKey = new Map((matrixData?.audiences || []).map(a => [a.key, a.product]));
    const topByKey = new Map((matrixData?.topics || []).map(t => [t.key, t.product]));
    return (m) => audByKey.get(m?.audience) || topByKey.get(m?.topic) || '';
  }, [matrixData?.audiences, matrixData?.topics]);

  // MC label → message lookup, plus MC number → first non-empty message image
  // (image1/image2) across any variant — used as a fallback when the exact
  // variant has no image. Values are raw drive IDs/filenames (not URLs).
  const { messagesByMc, msgImgByNumber } = useMemo(() => {
    const byMc = new Map();
    const byNumber = new Map();
    (matrixData?.messages || []).forEach(m => {
      if (m.number == null || m.number === '') return;
      const variant = (m.variant || 'a').toString().toLowerCase();
      byMc.set(`MC${m.number}${variant}`, m);
      if (!byNumber.has(m.number)) {
        const img = m.image1 || m.image2;
        if (img) byNumber.set(m.number, img);
      }
    });
    return { messagesByMc: byMc, msgImgByNumber: byNumber };
  }, [matrixData?.messages]);

  // Resolve a creative → renderable thumbnail URL.
  // Static images: serve via the drive proxy. HTML/dynamic: use Drive's auto
  // thumbnail (File_thumbnail is typically a full https URL from Drive).
  const resolveCreativeThumb = (c) => {
    if (!c) return null;
    const isImage =
      (c.File_format && /jpe?g|png|gif|webp/i.test(c.File_format)) ||
      (c.File_name && /\.(jpe?g|png|gif|webp)$/i.test(c.File_name));
    if (isImage && c.File_driveID) return `/api/drive/proxy/${c.File_driveID}`;
    if (c.File_thumbnail) return c.File_thumbnail;
    return null;
  };

  // Index creatives by exact MC label and by MC number — covers both static
  // image creatives and dynamic HTML banners (which have a Drive thumbnail).
  const { creativeUrlByMc, creativeUrlByNumber } = useMemo(() => {
    const byMc = new Map();
    const byNumber = new Map();
    (matrixData?.creatives || []).forEach(c => {
      const url = resolveCreativeThumb(c);
      if (!url) return;
      const num = c.MC_Number;
      const variant = (c.MC_Variant || '').toString().toLowerCase();
      if (num && variant) {
        const label = `MC${num}${variant}`;
        if (!byMc.has(label)) byMc.set(label, url);
      }
      if (num && !byNumber.has(num)) byNumber.set(num, url);
    });
    return { creativeUrlByMc: byMc, creativeUrlByNumber: byNumber };
  }, [matrixData?.creatives]);

  // Banner-level reporting rows. By default only those whose MC label exists
  // in the matrix; the "show unmatched" toggle relaxes this. Always drops
  // low-volume rows (<50 impressions) — they're noise.
  const matchedBanners = useMemo(() => {
    return (matrixData?.reporting || [])
      .filter(r => r.level === 'banner')
      .filter(r => showUnmatched || (r.mcLabel && messagesByMc.has(r.mcLabel)))
      .filter(r => (r.impressions || 0) >= 50)
      .map(r => {
        const msg = messagesByMc.get(r.mcLabel);
        const msgImgId =
          msg?.image1 ||
          msg?.image2 ||
          msgImgByNumber.get(msg?.number) ||
          null;
        const thumbnailUrl =
          (msgImgId ? `/api/drive/proxy/${msgImgId}` : null) ||
          creativeUrlByMc.get(r.mcLabel) ||
          creativeUrlByNumber.get(msg?.number) ||
          null;
        return { ...r, thumbnailUrl, product: productByMessage(msg) };
      });
  }, [matrixData?.reporting, messagesByMc, msgImgByNumber, creativeUrlByMc, creativeUrlByNumber, productByMessage, showUnmatched]);

  const totalBanners = useMemo(
    () => (matrixData?.reporting || []).filter(r => r.level === 'banner').length,
    [matrixData?.reporting]
  );

  const availableProducts = useMemo(() => {
    const set = new Set();
    matchedBanners.forEach(r => { if (r.product) set.add(r.product); });
    return Array.from(set).sort();
  }, [matchedBanners]);

  // Drop stale entries when the product set changes (e.g. after a new sync).
  useEffect(() => {
    if (productFilter.length === 0 || availableProducts.length === 0) return;
    const valid = productFilter.filter(p => availableProducts.includes(p));
    if (valid.length !== productFilter.length) setProductFilter(valid);
  }, [availableProducts, productFilter]);

  const filteredBanners = useMemo(() => {
    if (productFilter.length === 0) return matchedBanners;
    return matchedBanners.filter(r => productFilter.includes(r.product));
  }, [matchedBanners, productFilter]);

  const sortedRows = useMemo(() => {
    const arr = [...filteredBanners];
    const dir = sortDirection === 'asc' ? 1 : -1;
    arr.sort((a, b) => {
      const av = a[sortColumn];
      const bv = b[sortColumn];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
      return String(av).localeCompare(String(bv)) * dir;
    });
    return arr;
  }, [filteredBanners, sortColumn, sortDirection]);

  const handleSort = (column) => {
    if (sortColumn === column) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(column);
      setSortDirection(column === 'mcLabel' || column === 'size' || column === 'bannerName' || column === 'adformStatus' ? 'asc' : 'desc');
    }
  };

  return (
    <div className="matrix-fullscreen" style={{ backgroundColor: 'var(--color-primary)' }}>
      <div className="matrix-view-container">
        <div className="monitoring-scroll p-8">
          <div className="max-w-7xl mx-auto">
            <MonitoringListView
              rows={sortedRows}
              sortColumn={sortColumn}
              sortDirection={sortDirection}
              onSort={handleSort}
              statusColors={settings.getStatusColors?.() || {}}
            />
          </div>
        </div>
      </div>

      <MonitoringToolbar
        campaignPrefix={campaignPrefix}
        setCampaignPrefix={setCampaignPrefix}
        dateFrom={dateFrom}
        setDateFrom={setDateFrom}
        dateTo={dateTo}
        setDateTo={setDateTo}
        isSyncing={isSyncing}
        onSync={handleSync}
        lastSync={lastSync}
        syncError={syncError}
        lastResult={lastResult}
        filteredCount={sortedRows.length}
        totalCount={totalBanners}
        productFilter={productFilter}
        setProductFilter={setProductFilter}
        availableProducts={availableProducts}
        showUnmatched={showUnmatched}
        setShowUnmatched={setShowUnmatched}
      />

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
