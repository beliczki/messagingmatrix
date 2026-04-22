// AdForm reporting sync orchestrator.
//
// Pipeline:
//   1. Pull banner-level stats from AdForm for campaigns whose name starts with `campaignPrefix`.
//   2. Extract MC label (e.g. "MC282a") and size ("300x250") from each banner's name.
//   3. Build banner-level + label-level rollup rows.
//   4. Write the Reporting sheet (create the tab if missing, clear existing, then write).
//
// Takes its Google auth and spreadsheet id via params so it doesn't duplicate
// server.js's state.

import adform from './adformService.js';

const SHEETS_BASE_URL = 'https://sheets.googleapis.com/v4/spreadsheets';
const REPORTING_SHEET_NAME = 'Reporting';

const HEADER = [
  'Level',
  'MC_Label',
  'Size',
  'AdForm_Banner_ID',
  'AdForm_Banner_Name',
  'AdForm_Status',
  'Impressions',
  'Clicks',
  'CTR',
  'Campaign_ID',
  'Campaign_Name',
  'Last_Synced_At',
];

function extractMcLabel(bannerName) {
  if (!bannerName) return null;

  // Direct form — banners named "MC282a_300x250" etc.
  const direct = bannerName.match(/MC(\d+)([a-z])/i);
  if (direct) return `MC${parseInt(direct[1], 10)}${direct[2].toLowerCase()}`;

  // AdForm PMMID form — "...m_<number>-...-v_<letter>...". m_00 is a generic
  // placeholder for banners that aren't tied to a specific MC, so skip it.
  const mMatch = bannerName.match(/m_(\d+)/);
  const vMatch = bannerName.match(/v_([a-z])(?:[_-]|$)/i);
  if (mMatch && vMatch) {
    const num = parseInt(mMatch[1], 10);
    if (num > 0) return `MC${num}${vMatch[1].toLowerCase()}`;
  }
  return null;
}

function extractSize(bannerName) {
  if (!bannerName) return '';
  const m = bannerName.match(/(\d+)\s*x\s*(\d+)/);
  if (!m) return '';
  const size = `${m[1]}x${m[2]}`;
  // 1x1 is the richmedia placeholder — not a real banner size.
  if (size === '1x1') return '';
  return size;
}

function computeCtr(impressions, clicks) {
  if (!impressions || impressions <= 0) return 0;
  return Number((clicks / impressions).toFixed(4));
}

async function ensureReportingSheet({ getAccessToken, spreadsheetId }) {
  const token = await getAccessToken();

  const metaResponse = await fetch(`${SHEETS_BASE_URL}/${spreadsheetId}`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  if (!metaResponse.ok) {
    const text = await metaResponse.text();
    throw new Error(`Failed to read spreadsheet metadata (${metaResponse.status}): ${text}`);
  }
  const meta = await metaResponse.json();
  const exists = (meta.sheets || []).some(s => s.properties?.title === REPORTING_SHEET_NAME);
  if (exists) return;

  const addResponse = await fetch(`${SHEETS_BASE_URL}/${spreadsheetId}:batchUpdate`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({
      requests: [{ addSheet: { properties: { title: REPORTING_SHEET_NAME } } }],
    }),
  });
  if (!addResponse.ok) {
    const text = await addResponse.text();
    throw new Error(`Failed to create Reporting sheet (${addResponse.status}): ${text}`);
  }
}

async function writeReportingSheet({ getAccessToken, spreadsheetId, rows }) {
  const token = await getAccessToken();
  const range = encodeURIComponent(REPORTING_SHEET_NAME);

  const clearResponse = await fetch(`${SHEETS_BASE_URL}/${spreadsheetId}/values/${range}:clear`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
  });
  if (!clearResponse.ok) {
    const text = await clearResponse.text();
    throw new Error(`Failed to clear Reporting sheet (${clearResponse.status}): ${text}`);
  }

  const writeResponse = await fetch(
    `${SHEETS_BASE_URL}/${spreadsheetId}/values/${range}?valueInputOption=RAW`,
    {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({ range: REPORTING_SHEET_NAME, values: rows }),
    }
  );
  if (!writeResponse.ok) {
    const text = await writeResponse.text();
    throw new Error(`Failed to write Reporting sheet (${writeResponse.status}): ${text}`);
  }
}

export async function runSync({ getAccessToken, spreadsheetId, dateFrom, dateTo, campaignPrefix = '26!' }) {
  if (!adform.isConfigured()) {
    throw new Error('AdForm credentials missing: set ADFORM_CLIENT_ID and ADFORM_CLIENT_SECRET in .env');
  }
  if (!spreadsheetId) throw new Error('spreadsheetId is required');
  if (!dateFrom || !dateTo) throw new Error('dateFrom and dateTo are required (YYYY-MM-DD)');

  const stats = await adform.fetchStats({ dateFrom, dateTo, campaignNamePrefix: campaignPrefix });

  const campaignIds = new Set();
  const bannerRows = [];
  const byMcLabel = new Map(); // mcLabel -> { impressions, clicks, campaigns: Set, anyLive: bool }
  const syncedAt = new Date().toISOString();
  let matchedCount = 0;

  for (const s of stats) {
    campaignIds.add(s.campaignId);

    const mcLabel = extractMcLabel(s.bannerName);
    if (!mcLabel) continue;
    matchedCount++;

    const size = extractSize(s.bannerName);
    const ctr  = computeCtr(s.impressions, s.clicks);
    const isLive = s.impressions > 0;

    bannerRows.push([
      'banner',
      mcLabel,
      size,
      s.bannerId,
      s.bannerName,
      isLive ? 'live' : 'inactive',
      s.impressions,
      s.clicks,
      ctr,
      s.campaignId,
      s.campaignName,
      syncedAt,
    ]);

    const agg = byMcLabel.get(mcLabel) || { impressions: 0, clicks: 0, campaignIds: new Set(), campaignNames: new Set(), anyLive: false };
    agg.impressions += s.impressions;
    agg.clicks      += s.clicks;
    agg.campaignIds.add(s.campaignId);
    agg.campaignNames.add(s.campaignName);
    agg.anyLive = agg.anyLive || isLive;
    byMcLabel.set(mcLabel, agg);
  }

  const labelRows = [];
  for (const [mcLabel, agg] of byMcLabel.entries()) {
    labelRows.push([
      'label',
      mcLabel,
      '',
      '',
      '',
      agg.anyLive ? 'live' : 'inactive',
      agg.impressions,
      agg.clicks,
      computeCtr(agg.impressions, agg.clicks),
      agg.campaignIds.size === 1 ? [...agg.campaignIds][0] : '',
      agg.campaignNames.size === 1 ? [...agg.campaignNames][0] : '',
      syncedAt,
    ]);
  }

  const allRows = [HEADER, ...bannerRows, ...labelRows];

  await ensureReportingSheet({ getAccessToken, spreadsheetId });
  await writeReportingSheet({ getAccessToken, spreadsheetId, rows: allRows });

  return {
    campaignCount: campaignIds.size,
    bannerCount:   stats.length,
    matchedCount,
    rowsWritten:   bannerRows.length + labelRows.length,
    syncedAt,
  };
}

export default { runSync };
