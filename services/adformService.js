// AdForm reporting source.
//
// Currently pretends the AdForm API by parsing a local xlsx export — the live
// API code is commented out below until the credentials have been verified end-to-end.
//
// Env:
//   ADFORM_REPORT_PATH   (optional; defaults to ./data/adform-report.xlsx)
//
// Live-API env (unused while the xlsx fallback is in force — do not delete):
//   ADFORM_CLIENT_ID
//   ADFORM_CLIENT_SECRET
//   ADFORM_TOKEN_URL      (default: https://id.adform.com/sts/connect/token)
//   ADFORM_API_BASE       (default: https://api.adform.com)
//   ADFORM_SCOPE          (default: https://api.adform.com/scope/buyer.api)

import fs from 'fs';
import path from 'path';
import XLSX from 'xlsx';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_REPORT_PATH = path.join(__dirname, '..', 'data', 'adform-report.xlsx');

function resolveReportPath() {
  const configured = process.env.ADFORM_REPORT_PATH;
  if (!configured) return DEFAULT_REPORT_PATH;
  return path.isAbsolute(configured) ? configured : path.join(__dirname, '..', configured);
}

export function isConfigured() {
  return fs.existsSync(resolveReportPath());
}

// Parse the XLSX export into the same normalized shape the live API would have
// produced: [{ campaignId, campaignName, bannerId, bannerName, impressions, clicks }].
// Only rows tied to a real MC (m_<nonzero>) and a letter variant (v_<a-z>) will
// actually match in the sync step; everything else flows through and is silently
// dropped by the MC-label regex downstream.
function parseReportXlsx(reportPath) {
  if (!fs.existsSync(reportPath)) {
    throw new Error(`AdForm report not found at ${reportPath}. Set ADFORM_REPORT_PATH or place the xlsx at ./data/adform-report.xlsx`);
  }

  const wb = XLSX.readFile(reportPath);
  const dataSheetName = wb.SheetNames.find(n => {
    const lower = n.toLowerCase().trim();
    return lower !== 'front page' && lower !== 'data';
  }) || wb.SheetNames[0];
  const ws = wb.Sheets[dataSheetName];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

  const headerIdx = rows.findIndex(r =>
    Array.isArray(r) &&
    r.some(c => String(c).trim().toLowerCase() === 'campaign') &&
    r.some(c => String(c).trim().toLowerCase() === 'banner/adgroups')
  );
  if (headerIdx < 0) {
    throw new Error(`Could not locate header row in xlsx sheet "${dataSheetName}"`);
  }

  const header = rows[headerIdx].map(c => String(c).trim().toLowerCase());
  const findCol = (target) => header.findIndex(h => h === target.toLowerCase());
  const iCampaign    = findCol('Campaign');
  const iBanner      = findCol('Banner/Adgroups');
  // The report header repeats "Tracked Ads" / "Clicks" twice (gross vs verified).
  // Use the first occurrence, which matches the totals in the AdForm UI.
  const iImpressions = header.findIndex(h => h === 'tracked ads');
  const iClicks      = header.findIndex(h => h === 'clicks');
  const iMonth       = findCol('Month');

  if (iCampaign < 0 || iBanner < 0 || iImpressions < 0 || iClicks < 0) {
    throw new Error(`Missing expected columns (campaign/banner/tracked ads/clicks) in xlsx header: ${JSON.stringify(rows[headerIdx])}`);
  }

  const results = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;

    const month    = String(row[iMonth] || '').trim();
    const campaign = String(row[iCampaign] || '').trim();
    const banner   = String(row[iBanner] || '').trim();

    // Skip the totals row ("TOTAL" in Month column) and empty rows.
    if (!campaign || !banner) continue;
    if (month.toLowerCase() === 'total') continue;

    results.push({
      campaignId:   campaign,
      campaignName: campaign,
      bannerId:     banner,
      bannerName:   banner,
      impressions:  Number(row[iImpressions]) || 0,
      clicks:       Number(row[iClicks])      || 0,
    });
  }

  return results;
}

// Same signature as the live-API version. dateFrom/dateTo are accepted but
// ignored — the xlsx is already pre-filtered by the person who exported it.
export async function fetchStats({ dateFrom: _dateFrom, dateTo: _dateTo, campaignNamePrefix = '26!' } = {}) {
  const reportPath = resolveReportPath();
  const rows = parseReportXlsx(reportPath);
  if (campaignNamePrefix) {
    return rows.filter(r => r.campaignName?.startsWith(campaignNamePrefix));
  }
  return rows;
}

export default { isConfigured, fetchStats };

// ---------------------------------------------------------------------------
// Live AdForm API implementation — kept commented out until credentials are
// verified end-to-end. To re-enable, delete the xlsx fetchStats above and
// uncomment the block below (plus re-add the top-level token cache state).
// ---------------------------------------------------------------------------
// const DEFAULT_TOKEN_URL = 'https://id.adform.com/sts/connect/token';
// const DEFAULT_API_BASE  = 'https://api.adform.com';
// const DEFAULT_SCOPE     = 'https://api.adform.com/scope/buyer.api';
//
// let cachedToken = null;
// let tokenExpiry = 0;
//
// function readEnv() {
//   const clientId     = process.env.ADFORM_CLIENT_ID;
//   const clientSecret = process.env.ADFORM_CLIENT_SECRET;
//   const tokenUrl     = process.env.ADFORM_TOKEN_URL || DEFAULT_TOKEN_URL;
//   const apiBase      = process.env.ADFORM_API_BASE  || DEFAULT_API_BASE;
//   const scope        = process.env.ADFORM_SCOPE     || DEFAULT_SCOPE;
//   return { clientId, clientSecret, tokenUrl, apiBase, scope };
// }
//
// async function getToken() {
//   if (cachedToken && Date.now() < tokenExpiry) return cachedToken;
//   const { clientId, clientSecret, tokenUrl, scope } = readEnv();
//   if (!clientId || !clientSecret) {
//     throw new Error('AdForm credentials missing: set ADFORM_CLIENT_ID and ADFORM_CLIENT_SECRET in .env');
//   }
//   const body = new URLSearchParams({
//     grant_type:    'client_credentials',
//     client_id:     clientId,
//     client_secret: clientSecret,
//     scope,
//   });
//   const response = await fetch(tokenUrl, {
//     method: 'POST',
//     headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
//     body,
//   });
//   if (!response.ok) throw new Error(`AdForm token request failed (${response.status}): ${await response.text()}`);
//   const data = await response.json();
//   cachedToken = data.access_token;
//   tokenExpiry = Date.now() + ((data.expires_in || 3600) * 1000) - 60000;
//   return cachedToken;
// }
//
// export async function fetchStatsFromApi({ dateFrom, dateTo, campaignNamePrefix = '26!' } = {}) {
//   const token = await getToken();
//   const { apiBase } = readEnv();
//   const payload = {
//     dimensions: ['campaign', 'banner'],
//     metrics: [{ metric: 'impressions' }, { metric: 'clicks' }],
//     filter: { date: { from: dateFrom, to: dateTo } },
//     paging: { limit: 10000 },
//   };
//   const response = await fetch(`${apiBase}/v1/buyer/stats/data`, {
//     method: 'POST',
//     headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
//     body: JSON.stringify(payload),
//   });
//   if (!response.ok) throw new Error(`AdForm stats request failed (${response.status}): ${await response.text()}`);
//   const data = await response.json();
//   const rows = data.reportData?.rows || data.rows || [];
//   const columns = data.reportData?.columnHeaders || data.columnHeaders || [];
//   const idx = (name) => columns.findIndex(c => (c.name || c) === name);
//   const iCampaignId   = idx('campaign');
//   const iCampaignName = idx('campaignName');
//   const iBannerId     = idx('banner');
//   const iBannerName   = idx('bannerName');
//   const iImpressions  = idx('impressions');
//   const iClicks       = idx('clicks');
//   const normalized = rows.map((row) => ({
//     campaignId:   iCampaignId   >= 0 ? String(row[iCampaignId]   ?? '') : '',
//     campaignName: iCampaignName >= 0 ? String(row[iCampaignName] ?? '') : '',
//     bannerId:     iBannerId     >= 0 ? String(row[iBannerId]     ?? '') : '',
//     bannerName:   iBannerName   >= 0 ? String(row[iBannerName]   ?? '') : '',
//     impressions:  iImpressions  >= 0 ? Number(row[iImpressions]  ?? 0) : 0,
//     clicks:       iClicks       >= 0 ? Number(row[iClicks]       ?? 0) : 0,
//   }));
//   if (campaignNamePrefix) return normalized.filter(r => r.campaignName?.startsWith(campaignNamePrefix));
//   return normalized;
// }
