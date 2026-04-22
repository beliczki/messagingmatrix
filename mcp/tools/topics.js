// Topic MCP tools: create / remove / update / list.
// Topic key is generated from a configured pattern (config.patterns.topicKey) —
// matches the behavior of useMatrix.addTopic / updateTopic in the frontend.

import { z } from 'zod';
import { readAll, createColumnMap, rowToObject, appendRow, updateRow, deleteRow, findRow } from '../sheets.js';
import { generateTopicKey } from '../../src/utils/patternEvaluator.js';

const SHEET = 'Topics';

function findHeaderCol(header, target) {
  const lower = target.toLowerCase();
  return header.findIndex(h => String(h || '').trim().toLowerCase() === lower);
}

function normalizeInputToHeader(input, header) {
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

function readTopicKeyPattern(getSqlite) {
  try {
    const row = getSqlite().prepare("SELECT value FROM config WHERE key = 'patterns'").get();
    if (!row?.value) return null;
    const patterns = JSON.parse(row.value);
    return patterns?.topicKey || null;
  } catch {
    return null;
  }
}

export function registerTopicTools(server, ctx) {
  const { getAccessToken, getSpreadsheetId, getSqlite } = ctx;

  server.registerTool(
    'topic_create',
    {
      title: 'Create a topic',
      description: 'Append a new topic. Auto-generates ID, Order, and Key (via the topicKey pattern, falling back to top<order>).',
      inputSchema: {
        name: z.string().describe('Topic display name (required)'),
        product: z.string().optional(),
        tag1: z.string().optional(),
        tag2: z.string().optional(),
        tag3: z.string().optional(),
        tag4: z.string().optional(),
        order: z.number().optional(),
        status: z.string().optional(),
        comment: z.string().optional(),
        key: z.string().optional().describe('Explicit key override'),
      },
    },
    async (input) => {
      const spreadsheetId = getSpreadsheetId();
      const rows = await readAll(getAccessToken, spreadsheetId, SHEET);
      if (rows.length === 0) throw new Error(`Sheet "${SHEET}" has no header row`);
      const header = rows[0];
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

      const pattern = readTopicKeyPattern(getSqlite);
      let key = input.key;
      if (!key) {
        const topicObj = { name: input.name, product: input.product, tag1: input.tag1, tag2: input.tag2, tag3: input.tag3, tag4: input.tag4 };
        key = pattern ? generateTopicKey(topicObj, pattern) : `top${nextOrder}`;
        if (!key || !key.trim()) key = `top${nextOrder}`;
      }

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
    'topic_remove',
    {
      title: 'Remove a topic',
      description: 'Delete a row from the Topics sheet by key or name.',
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
      if (!found) throw new Error(`Topic not found (key=${key || '—'}, name=${name || '—'})`);
      await deleteRow(getAccessToken, spreadsheetId, SHEET, found.index);
      return asText({ removed: { index: found.index, ...found.object } });
    }
  );

  server.registerTool(
    'topic_update',
    {
      title: 'Update a topic',
      description: 'Update fields on an existing topic row. If product or any tag field changes, the key is regenerated via the topicKey pattern.',
      inputSchema: {
        key: z.string().describe('Current topic key to match'),
        updates: z.record(z.string(), z.any()).describe('Object of header-name → new value (e.g. { "Tag1": "new_tag" })'),
      },
    },
    async ({ key, updates }) => {
      const spreadsheetId = getSpreadsheetId();
      const found = await findRow(getAccessToken, spreadsheetId, SHEET, (_row, obj) =>
        String(obj['Key'] || '').trim() === key
      );
      if (!found) throw new Error(`Topic key "${key}" not found`);

      const pattern = readTopicKeyPattern(getSqlite);
      const keyAffectingFields = new Set(['product', 'tag1', 'tag2', 'tag3', 'tag4']);
      const updatesLower = {};
      for (const [k, v] of Object.entries(updates)) updatesLower[k.toLowerCase()] = v;
      const shouldRegenerateKey = Object.keys(updatesLower).some(k => keyAffectingFields.has(k));

      let updatesFinal = { ...updates };
      if (shouldRegenerateKey && pattern) {
        const mergedObj = {
          name: found.object['Name'],
          product: updatesLower['product'] ?? found.object['Product'],
          tag1: updatesLower['tag1'] ?? found.object['Tag1'],
          tag2: updatesLower['tag2'] ?? found.object['Tag2'],
          tag3: updatesLower['tag3'] ?? found.object['Tag3'],
          tag4: updatesLower['tag4'] ?? found.object['Tag4'],
        };
        const newKey = generateTopicKey(mergedObj, pattern);
        if (newKey && newKey.trim()) updatesFinal = { ...updatesFinal, Key: newKey };
      }

      const rowObj = normalizeInputToHeader(updatesFinal, found.header);
      const result = await updateRow(getAccessToken, spreadsheetId, SHEET, found.index + 1, rowObj, found.header, found.row);
      return asText({ updated: { originalKey: key, newKey: rowObj['Key'] || key, index: found.index, newRow: result.values } });
    }
  );

  server.registerTool(
    'list_topics',
    {
      title: 'List topics',
      description: 'Returns topic rows as objects. Optionally filter by product.',
      inputSchema: {
        product: z.string().optional(),
      },
    },
    async ({ product }) => {
      const spreadsheetId = getSpreadsheetId();
      const rows = await readAll(getAccessToken, spreadsheetId, SHEET);
      if (rows.length < 2) return asText({ topics: [] });
      const header = rows[0];
      const cmap = createColumnMap(header);
      const objs = rows.slice(1)
        .filter(r => r.some(c => c !== '' && c != null))
        .map(r => rowToObject(r, cmap));
      const filtered = product
        ? objs.filter(o => String(o['Product'] || '').toLowerCase() === product.toLowerCase())
        : objs;
      return asText({ count: filtered.length, topics: filtered });
    }
  );
}
