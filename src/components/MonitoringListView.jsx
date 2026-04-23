import React, { useMemo } from 'react';
import { Monitor, ArrowUp, ArrowDown, Image as ImageIcon } from 'lucide-react';

const formatNumber = (n) => (n == null ? '—' : Number(n).toLocaleString());
const formatCtr = (n) => (n == null ? '—' : `${(Number(n) * 100).toFixed(2)}%`);

const SortHeader = ({ column, label, sortColumn, sortDirection, onSort, align = 'left' }) => {
  const active = sortColumn === column;
  const alignClass = align === 'right' ? 'text-right' : 'text-left';
  return (
    <th
      className={`${alignClass} py-3 px-4 font-semibold text-gray-700 select-none cursor-pointer hover:bg-gray-100`}
      onClick={() => onSort(column)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {active && (sortDirection === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
      </span>
    </th>
  );
};

const MonitoringListView = ({
  rows,
  sortColumn,
  sortDirection,
  onSort,
  statusColors = {}
}) => {
  const totals = useMemo(() => {
    const tot = rows.reduce(
      (acc, r) => ({
        impressions: acc.impressions + (r.impressions || 0),
        clicks: acc.clicks + (r.clicks || 0)
      }),
      { impressions: 0, clicks: 0 }
    );
    const avgCtr = tot.impressions > 0 ? tot.clicks / tot.impressions : null;
    return { ...tot, avgCtr };
  }, [rows]);

  if (rows.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-12 text-center text-gray-500">
        No matched ads. Run a sync from the toolbar — only banners whose MC label
        appears in the matrix are shown here.
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr className="border-b border-gray-200">
              <SortHeader column="mcLabel" label="MC" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} />
              <SortHeader column="product" label="Product" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} />
              <SortHeader column="bannerName" label="Banner Name" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} />
              <SortHeader column="size" label="Size" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} />
              <SortHeader column="impressions" label="Impressions" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} align="right" />
              <SortHeader column="clicks" label="Clicks" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} align="right" />
              <SortHeader column="ctr" label="CTR" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} align="right" />
              <SortHeader column="adformStatus" label="AdForm" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} />
            </tr>
            <tr className="bg-gray-100 border-b-2 border-gray-300 text-xs font-semibold text-gray-700">
              <td className="py-2 px-4" colSpan={4}>Totals ({rows.length})</td>
              <td className="py-2 px-4 text-right font-mono">{formatNumber(totals.impressions)}</td>
              <td className="py-2 px-4 text-right font-mono">{formatNumber(totals.clicks)}</td>
              <td className="py-2 px-4 text-right font-mono">{formatCtr(totals.avgCtr)}</td>
              <td className="py-2 px-4" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r, idx) => {
              const statusBg = statusColors[(r.adformStatus || '').toUpperCase()];
              return (
                <tr
                  key={`row-${idx}`}
                  className="border-b border-gray-100 hover:bg-gray-50"
                >
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-gray-100 rounded flex items-center justify-center overflow-hidden flex-shrink-0">
                        {r.thumbnailUrl ? (
                          <img
                            src={r.thumbnailUrl}
                            alt={r.mcLabel}
                            className="w-full h-full object-cover"
                            loading="lazy"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <ImageIcon size={20} className="text-gray-400" />
                        )}
                      </div>
                      <span className="font-medium text-gray-800">{r.mcLabel}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-700">{r.product || '—'}</td>
                  <td className="py-3 px-4">
                    <div className="text-sm text-gray-800 truncate max-w-md" title={r.bannerName}>
                      {r.bannerName || '—'}
                    </div>
                    {r.campaignName && (
                      <div className="text-xs text-gray-500 truncate max-w-md" title={r.campaignName}>
                        {r.campaignName}
                      </div>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    {r.size && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">
                        <Monitor size={12} />
                        {r.size}
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-sm text-gray-700">{formatNumber(r.impressions)}</td>
                  <td className="py-3 px-4 text-right font-mono text-sm text-gray-700">{formatNumber(r.clicks)}</td>
                  <td className="py-3 px-4 text-right font-mono text-sm font-medium text-gray-900">{formatCtr(r.ctr)}</td>
                  <td className="py-3 px-4">
                    {r.adformStatus && (
                      <span
                        className="px-2 py-1 rounded text-xs font-medium"
                        style={statusBg ? { backgroundColor: statusBg, color: '#fff' } : { backgroundColor: '#e5e7eb', color: '#374151' }}
                      >
                        {r.adformStatus}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default MonitoringListView;
