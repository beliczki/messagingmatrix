// Audience MCP tools: create / remove / update / list.
//
// Writes one row at a time via the Google Sheets API (not full-table rewrite).
// Header-row is read at request time; input property names are matched against
// it case-insensitively.

import { z } from 'zod';
import { readAll, createColumnMap, rowToObject, appendRow, updateRow, deleteRow, findRow } from '../sheets.js';

const SHEET = 'Audiences';

function findHeaderCol(header, target) {
  const lower = target.toLowerCase();
  return header.findIndex(h => String(h || '').trim().toLowerCase() === lower);
}

function normalizeInputToHeader(input, header) {
  // Translate user-supplied keys (any case) to the exact header casing.
  const out = {};
  for (const [k, v] of Object.entries(input)) {
    const idx = findHeaderCol(header, k);
    if (idx >= 0) out[header[idx]] = v;
  }
  return out;
}

function asText(obj) {
  return { content: [{ type: 'text', text: JSON.stringify(obj, null, 2) }] };
}

export function registerAudienceTools(server, ctx) {
  const { getAccessToken, getSpreadsheetId } = ctx;

  server.registerTool(
    'audience_create',
    {
      title: 'Create an audience row in the Audiences sheet',
      description: 'Append a new audience. Auto-generates ID and Key if not provided. Property names match the Audiences sheet headers (e.g. Name, Product, Strategy, Device, Key).',
      inputSchema: {
        name: z.string().describe('Audience display name (required)'),
        product: z.string().optional(),
        strategy: z.string().optional(),
        buying_platform: z.string().optional(),
        device: z.string().optional(),
        data_source: z.string().optional(),
        targeting_type: z.string().optional(),
        tag: z.string().optional(),
        key: z.string().optional().describe('Explicit key override; default is aud<order>'),
        order: z.number().optional(),
        status: z.string().optional(),
        comment: z.string().optional(),
        campaign_name: z.string().optional(),
        campaign_id: z.string().optional(),
        lineitem_name: z.string().optional(),
        lineitem_id: z.string().optional(),
      },
    },
    async (input) => {
      const spreadsheetId = getSpreadsheetId();
      if (!spreadsheetId) throw new Error('spreadsheetId not configured');

      const rows = await readAll(getAccessToken, spreadsheetId, SHEET);
      if (rows.length === 0) throw new Error(`Sheet "${SHEET}" has no header row`);
      const header = rows[0];

      // Auto-fill ID + Order + Key
      const cmap = createColumnMap(header);
      const existing = rows.slice(1).filter(r => r.some(c => c !== '' && c != null));
      const nextId = existing.reduce((max, r) => {
        const v = parseInt(r[cmap['ID']] || '0', 10);
        return Number.isFinite(v) && v > max ? v : max;
      }, 0) + 1;
      const nextOrder = input.order ?? (existing.reduce((max, r) => {
        const v = parseInt(r[cmap['Order']] || '0', 10);
        return Number.isFinite(v) && v > max ? v : max;
      }, 0) + 1);
      const key = input.key || `aud${nextOrder}`;

      const rowObj = normalizeInputToHeader({
        ...input,
        id: nextId,
        order: nextOrder,
        key,
      }, header);

      const result = await appendRow(getAccessToken, spreadsheetId, SHEET, rowObj);
      return asText({ created: { id: nextId, key, name: input.name }, wroteRow: result.values });
    }
  );

  server.registerTool(
    'audience_remove',
    {
      title: 'Remove an audience',
      description: 'Delete a row from the Audiences sheet. Match by key or by exact name. WARNING: any messages referencing this audience keep their audience_key but will appear orphaned in the UI until fixed.',
      inputSchema: {
        key: z.string().optional(),
        name: z.string().optional(),
      },
    },
    async ({ key, name }) => {
      if (!key && !name) throw new Error('Provide key or name');
      const spreadsheetId = getSpreadsheetId();
      const found = await findRow(getAccessToken, spreadsheetId, SHEET, (_row, obj) => {
        if (key && String(obj['Key'] || '').trim() === key) return true;
        if (name && String(obj['Name'] || '').trim() === name) return true;
        return false;
      });
      if (!found) throw new Error(`Audience not found (key=${key || '—'}, name=${name || '—'})`);
      await deleteRow(getAccessToken, spreadsheetId, SHEET, found.index);
      return asText({ removed: { index: found.index, ...found.object } });
    }
  );

  server.registerTool(
    'audience_update',
    {
      title: 'Update an audience',
      description: 'Update fields on an existing audience row, matched by key. Only provided fields are changed; others keep their current value.',
      inputSchema: {
        key: z.string().describe('Audience key to match (required)'),
        updates: z.record(z.string(), z.any()).describe('Object of header-name → new value (e.g. { "Product": "szk", "Strategy": "pro" })'),
      },
    },
    async ({ key, updates }) => {
      const spreadsheetId = getSpreadsheetId();
      const found = await findRow(getAccessToken, spreadsheetId, SHEET, (_row, obj) =>
        String(obj['Key'] || '').trim() === key
      );
      if (!found) throw new Error(`Audience key "${key}" not found`);
      const rowObj = normalizeInputToHeader(updates, found.header);
      const result = await updateRow(getAccessToken, spreadsheetId, SHEET, found.index + 1, rowObj, found.header, found.row);
      return asText({ updated: { key, index: found.index, newRow: result.values } });
    }
  );

  server.registerTool(
    'list_audiences',
    {
      title: 'List audiences',
      description: 'Returns audience rows as objects. Optionally filter by product.',
      inputSchema: {
        product: z.string().optional(),
      },
    },
    async ({ product }) => {
      const spreadsheetId = getSpreadsheetId();
      const rows = await readAll(getAccessToken, spreadsheetId, SHEET);
      if (rows.length < 2) return asText({ audiences: [] });
      const header = rows[0];
      const cmap = createColumnMap(header);
      const objs = rows.slice(1)
        .filter(r => r.some(c => c !== '' && c != null))
        .map(r => rowToObject(r, cmap));
      const filtered = product
        ? objs.filter(o => String(o['Product'] || '').toLowerCase() === product.toLowerCase())
        : objs;
      return asText({ count: filtered.length, audiences: filtered });
    }
  );
}
