import React, { useState, useEffect, useRef } from 'react';
import { PocketKnife, GripHorizontal, RefreshCw, AlertCircle, CheckCircle, Filter, ChevronDown, Check } from 'lucide-react';

/**
 * MonitoringToolbar - Floating draggable toolbar for the Monitoring module.
 * Hosts the AdForm sync controls (campaign prefix + date range + Sync button)
 * and shows the last-sync result. Visual style matches MediaToolbar via toolbar.css.
 */
const MonitoringToolbar = ({
  campaignPrefix,
  setCampaignPrefix,
  dateFrom,
  setDateFrom,
  dateTo,
  setDateTo,
  isSyncing,
  onSync,
  lastSync,
  syncError,
  lastResult,
  filteredCount = 0,
  totalCount = 0,
  productFilter = [],
  setProductFilter,
  availableProducts = [],
  showUnmatched = false,
  setShowUnmatched
}) => {
  const [isOpen, setIsOpen] = useState(() => {
    try {
      const saved = localStorage.getItem('monitoring_toolbar_isOpen');
      return saved ? JSON.parse(saved) : false;
    } catch { return false; }
  });

  const [toolbarPosition, setToolbarPosition] = useState(() => {
    try {
      const saved = localStorage.getItem('monitoring_toolbar_position');
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });

  const [productDropdownOpen, setProductDropdownOpen] = useState(false);

  const toolbarRef = useRef(null);
  const productDropdownRef = useRef(null);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0, toolbarX: 0, toolbarY: 0 });

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (productDropdownRef.current && !productDropdownRef.current.contains(e.target)) {
        setProductDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleProduct = (product) => {
    if (!setProductFilter) return;
    setProductFilter(prev =>
      prev.includes(product) ? prev.filter(p => p !== product) : [...prev, product]
    );
  };

  useEffect(() => {
    localStorage.setItem('monitoring_toolbar_isOpen', JSON.stringify(isOpen));
  }, [isOpen]);

  useEffect(() => {
    if (toolbarPosition) {
      localStorage.setItem('monitoring_toolbar_position', JSON.stringify(toolbarPosition));
    }
  }, [toolbarPosition]);

  const handleDragStart = (e) => {
    isDraggingRef.current = true;
    const toolbar = toolbarRef.current;
    if (!toolbar) return;
    const rect = toolbar.getBoundingClientRect();
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      toolbarX: rect.left,
      toolbarY: rect.top
    };
    document.addEventListener('mousemove', handleDragMove);
    document.addEventListener('mouseup', handleDragEnd);
    e.preventDefault();
  };

  const handleDragMove = (e) => {
    if (!isDraggingRef.current) return;
    const deltaX = e.clientX - dragStartRef.current.x;
    const deltaY = e.clientY - dragStartRef.current.y;
    const newX = dragStartRef.current.toolbarX + deltaX;
    const newY = dragStartRef.current.toolbarY + deltaY;
    const toolbar = toolbarRef.current;
    if (!toolbar) return;
    const rect = toolbar.getBoundingClientRect();
    const maxY = window.innerHeight - rect.height - 10;
    const rightOffset = window.innerWidth - newX - rect.width;
    setToolbarPosition({
      right: Math.max(10, rightOffset),
      y: Math.max(10, Math.min(newY, maxY))
    });
  };

  const handleDragEnd = () => {
    isDraggingRef.current = false;
    document.removeEventListener('mousemove', handleDragMove);
    document.removeEventListener('mouseup', handleDragEnd);
  };

  const canSync = !isSyncing && campaignPrefix && dateFrom && dateTo;

  return (
    <>
      <button
        className="toolbar-toggle"
        onClick={() => setIsOpen(!isOpen)}
        title={isOpen ? 'Close toolbar' : 'Open toolbar'}
      >
        <PocketKnife size={24} />
      </button>

      <div
        ref={toolbarRef}
        className={`toolbar ${isOpen ? 'open' : ''}`}
        style={toolbarPosition ? { top: toolbarPosition.y, right: toolbarPosition.right } : undefined}
      >
        <div className="toolbar-drag-row" onMouseDown={handleDragStart}>
          <GripHorizontal size={20} />
        </div>

        <div className="toolbar-content">
          {setProductFilter && availableProducts.length > 0 && (
            <div className="filter-group">
              <div className="filter-dropdown" ref={productDropdownRef}>
                <button
                  className="filter-pill"
                  onClick={() => setProductDropdownOpen(!productDropdownOpen)}
                >
                  <Filter size={16} className="filter-pill-icon" />
                  <span className="filter-pill-text">Products</span>
                  <ChevronDown size={16} className={`filter-pill-chevron ${productDropdownOpen ? 'open' : ''}`} />
                  <span className="filter-pill-badge">
                    {productFilter.length === 0 ? availableProducts.length : productFilter.length}
                  </span>
                </button>
                {productDropdownOpen && (
                  <div className="filter-dropdown-menu">
                    {availableProducts.map(product => (
                      <button
                        key={product}
                        className="filter-dropdown-item"
                        onClick={() => toggleProduct(product)}
                      >
                        <Check size={16} className={productFilter.includes(product) ? 'visible' : 'hidden'} />
                        <span>{product}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {setShowUnmatched && (
            <label className="flex items-center gap-2 cursor-pointer text-white/90 text-sm mb-3 select-none">
              <input
                type="checkbox"
                checked={showUnmatched}
                onChange={(e) => setShowUnmatched(e.target.checked)}
                className="w-4 h-4 rounded accent-white cursor-pointer"
              />
              <span>Show unmatched</span>
            </label>
          )}

          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-white/80 text-xs font-medium">Campaign prefix</span>
              <input
                type="text"
                value={campaignPrefix}
                onChange={(e) => setCampaignPrefix(e.target.value)}
                className="rounded-md bg-white/95 border border-white/20 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-white/50"
              />
            </label>

            <div className="flex gap-2">
              <label className="flex flex-col gap-1 flex-1 min-w-0">
                <span className="text-white/80 text-xs font-medium">From</span>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="rounded-md bg-white/95 border border-white/20 px-2 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-white/50 w-full"
                />
              </label>
              <label className="flex flex-col gap-1 flex-1 min-w-0">
                <span className="text-white/80 text-xs font-medium">To</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="rounded-md bg-white/95 border border-white/20 px-2 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-white/50 w-full"
                />
              </label>
            </div>

            <button
              onClick={onSync}
              disabled={!canSync}
              className="inline-flex items-center justify-center gap-2 bg-white text-gray-900 px-4 py-2 rounded-md font-medium hover:bg-white/90 disabled:bg-white/40 disabled:cursor-not-allowed transition-colors"
            >
              <RefreshCw size={16} className={isSyncing ? 'animate-spin' : ''} />
              {isSyncing ? 'Syncing…' : 'Sync now'}
            </button>

            {lastSync && (
              <div className="text-white/70 text-xs text-center">
                Last sync: {new Date(lastSync).toLocaleString()}
              </div>
            )}
          </div>

          <div className="mt-4 pt-4 border-t border-white/20 text-white/80 text-xs">
            <div className="flex justify-between">
              <span>Showing</span>
              <span className="font-mono">{filteredCount} / {totalCount}</span>
            </div>
          </div>

          {syncError && (
            <div className="mt-4 flex items-start gap-2 p-3 bg-red-500/20 border border-red-300/40 rounded-md text-xs text-white">
              <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
              <div>
                <div className="font-medium">Sync failed</div>
                <div className="opacity-90">{syncError}</div>
              </div>
            </div>
          )}

          {lastResult && !syncError && (
            <div className="mt-4 pt-4 border-t border-white/20">
              <div className="flex items-center gap-2 mb-2 text-white/80 text-xs">
                <CheckCircle size={14} />
                <span className="font-medium">Last result</span>
              </div>
              <dl className="grid grid-cols-2 gap-2 text-xs text-white/80">
                <div>
                  <dt className="opacity-70">Campaigns</dt>
                  <dd className="font-mono">{lastResult.campaignCount ?? '—'}</dd>
                </div>
                <div>
                  <dt className="opacity-70">Banners</dt>
                  <dd className="font-mono">{lastResult.bannerCount ?? '—'}</dd>
                </div>
                <div>
                  <dt className="opacity-70">Matched</dt>
                  <dd className="font-mono">{lastResult.matchedCount ?? '—'}</dd>
                </div>
                <div>
                  <dt className="opacity-70">Rows written</dt>
                  <dd className="font-mono">{lastResult.rowsWritten ?? '—'}</dd>
                </div>
              </dl>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default MonitoringToolbar;
