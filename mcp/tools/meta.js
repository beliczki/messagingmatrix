// Meta / discovery MCP tools.
// list_templates — reads src/templates/* directly (no HTTP call to /api/templates).
// list_products — derives from Audiences + Topics sheets.
// matrix_status — counts summary.

import { z } from 'zod';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { readAll, createColumnMap, rowToObject } from '../sheets.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const TEMPLATES_DIR = path.join(__dirname, '..', '..', 'src', 'templates');

function asText(obj) {
  return { content: [{ type: 'text', text: JSON.stringify(obj, null, 2) }] };
}

function listTemplatesFromDisk() {
  if (!fs.existsSync(TEMPLATES_DIR)) return [];
  return fs.readdirSync(TEMPLATES_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => {
      const dir = path.join(TEMPLATES_DIR, d.name);
      const files = fs.readdirSync(dir);

      // Sizes from <w>x<h>.css filenames — same source of truth as /api/templates
      const sizes = files
        .filter(f => /^\d+x\d+\.css$/.test(f))
        .map(f => f.replace('.css', ''))
        .sort()
        .map(dim => {
          const [w, h] = dim.split('x').map(Number);
          return { width: w, height: h, name: dim };
        });

      // Template.json placeholder names if present
      let placeholders = [];
      const jsonPath = path.join(dir, 'template.json');
      if (fs.existsSync(jsonPath)) {
        try {
          const cfg = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
          if (cfg.placeholders) placeholders = Object.keys(cfg.placeholders);
        } catch { /* ignore bad json */ }
      }

      return { name: d.name, sizes, placeholders };
    });
}

export function registerMetaTools(server, ctx) {
  const { getAccessToken, getSpreadsheetId } = ctx;

  server.registerTool(
    'list_templates',
    {
      title: 'List available templates',
      description: 'Returns template names + supported ad sizes (derived from <w>x<h>.css files) + placeholder names from template.json.',
      inputSchema: {},
    },
    async () => asText({ templates: listTemplatesFromDisk() })
  );

  server.registerTool(
    'list_products',
    {
      title: 'List products',
      description: 'Returns sorted unique product values across Audiences and Topics.',
      inputSchema: {},
    },
    async () => {
      const spreadsheetId = getSpreadsheetId();
      const [arows, trows] = await Promise.all([
        readAll(getAccessToken, spreadsheetId, 'Audiences'),
        readAll(getAccessToken, spreadsheetId, 'Topics'),
      ]);
      const products = new Set();
      const pull = (rows) => {
        if (rows.length < 2) return;
        const h = rows[0];
        const idx = h.findIndex(c => String(c || '').toLowerCase() === 'product');
        if (idx < 0) return;
        for (let i = 1; i < rows.length; i++) {
          const v = String(rows[i][idx] || '').trim();
          if (v) products.add(v);
        }
      };
      pull(arows);
      pull(trows);
      return asText({ products: [...products].sort() });
    }
  );

  server.registerTool(
    'matrix_status',
    {
      title: 'Matrix counts + last sync',
      description: 'Returns counts of audiences/topics/messages (by status), plus last AdForm sync timestamp if available.',
      inputSchema: {},
    },
    async () => {
      const spreadsheetId = getSpreadsheetId();
      const [arows, trows, mrows, rrows] = await Promise.all([
        readAll(getAccessToken, spreadsheetId, 'Audiences'),
        readAll(getAccessToken, spreadsheetId, 'Topics'),
        readAll(getAccessToken, spreadsheetId, 'Messages'),
        readAll(getAccessToken, spreadsheetId, 'Reporting').catch(() => []),
      ]);
      const audCount = Math.max(0, arows.length - 1);
      const topCount = Math.max(0, trows.length - 1);

      let msgTotal = 0;
      const byStatus = {};
      if (mrows.length > 1) {
        const cmap = createColumnMap(mrows[0]);
        const statusIdx = cmap['Status'];
        for (let i = 1; i < mrows.length; i++) {
          if (!mrows[i].some(c => c !== '' && c != null)) continue;
          msgTotal++;
          const s = String(mrows[i][statusIdx] || '').trim().toUpperCase() || 'UNKNOWN';
          byStatus[s] = (byStatus[s] || 0) + 1;
        }
      }

      let lastReportingSync = null;
      if (rrows.length > 1) {
        const rcmap = createColumnMap(rrows[0]);
        const tsIdx = rcmap['Last_Synced_At'];
        if (tsIdx !== undefined) {
          const timestamps = rrows.slice(1).map(r => r[tsIdx]).filter(Boolean).sort();
          lastReportingSync = timestamps[timestamps.length - 1] || null;
        }
      }

      return asText({
        audiences: audCount,
        topics: topCount,
        messages: { total: msgTotal, by_status: byStatus },
        last_reporting_sync: lastReportingSync,
      });
    }
  );
}
